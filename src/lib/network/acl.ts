import { parseIp } from "./ip";
import type { AclAce, AclProtocol, Device, InterfaceConfig } from "./types";

/** ACL standard: 1-99 e 1300-1999 (filtrano solo l’origine). */
export function isStandardAcl(id: number): boolean {
  return (id >= 1 && id <= 99) || (id >= 1300 && id <= 1999);
}

/** ACL estese: 100-199 e 2000-2699. */
export function isExtendedAcl(id: number): boolean {
  return (id >= 100 && id <= 199) || (id >= 2000 && id <= 2699);
}

/**
 * Confronta un indirizzo con un criterio ACL:
 * "any", "host A.B.C.D", "A.B.C.D W.W.W.W" (wildcard) o "A.B.C.D" (host).
 */
export function matchAclAddress(pattern: string, ip: string): boolean {
  const p = pattern.trim().toLowerCase();
  if (p === "any") return true;
  const addr = parseIp(ip);
  if (addr === null) return false;
  if (p.startsWith("host ")) return parseIp(p.slice(5).trim()) === addr;
  const [netStr, wildStr] = p.split(/\s+/);
  const net = parseIp(netStr ?? "");
  if (net === null) return false;
  const wild = wildStr ? parseIp(wildStr) : 0;
  if (wild === null) return false;
  const care = ~wild >>> 0;
  return ((addr & care) >>> 0) === ((net & care) >>> 0);
}

function matchProto(ace: AclAce, proto: AclProtocol): boolean {
  if (ace.protocol === "any" || ace.protocol === "ip") return true;
  return ace.protocol === proto;
}

/** Valuta una ACL numerata; deny implicito in fondo. */
export function evaluateAccessList(
  aces: AclAce[],
  src: string,
  dst: string,
  proto: AclProtocol,
  dstPort?: number,
): "permit" | "deny" {
  const sorted = [...aces].sort((a, b) => a.sequence - b.sequence);
  for (const ace of sorted) {
    if (!matchProto(ace, proto)) continue;
    if (!matchAclAddress(ace.source, src)) continue;
    if (!matchAclAddress(ace.destination, dst)) continue;
    if (ace.dstPort != null && ace.dstPort !== dstPort) continue;
    return ace.action;
  }
  return "deny";
}

export function ifaceAclDecision(
  device: Device,
  iface: InterfaceConfig | undefined | null,
  direction: "in" | "out",
  src: string,
  dst: string,
  proto: AclProtocol,
  dstPort?: number,
): "permit" | "deny" | "none" {
  if (!iface) return "none";
  const listId = direction === "in" ? iface.aclIn : iface.aclOut;
  if (listId == null) return "none";
  const list = device.accessLists?.find((a) => a.id === listId);
  // Su IOS un access-group che punta a una ACL inesistente lascia passare tutto
  if (!list || list.aces.length === 0) return "none";
  return evaluateAccessList(list.aces, src, dst, proto, dstPort);
}

/** Controlla le ACL in ingresso e in uscita di un router per un pacchetto. */
export function routerAclCheck(
  router: Device,
  ingressIface: InterfaceConfig | null,
  egressIface: InterfaceConfig | null,
  srcIp: string,
  dstIp: string,
  proto: AclProtocol = "icmp",
  dstPort?: number,
): { ok: boolean; reason?: string } {
  if (
    ifaceAclDecision(router, ingressIface, "in", srcIp, dstIp, proto, dstPort) ===
    "deny"
  ) {
    return {
      ok: false,
      reason: `ACL ${ingressIface?.aclIn} in ingresso su ${router.name} ${ingressIface?.name}: deny`,
    };
  }
  if (
    ifaceAclDecision(router, egressIface, "out", srcIp, dstIp, proto, dstPort) ===
    "deny"
  ) {
    return {
      ok: false,
      reason: `ACL ${egressIface?.aclOut} in uscita su ${router.name} ${egressIface?.name}: deny`,
    };
  }
  return { ok: true };
}

/** Testo di una ACE come in "show access-lists". */
export function formatAce(ace: AclAce, standard: boolean): string {
  const addr = (p: string) => {
    const t = p.trim();
    if (t === "any" || t.startsWith("host ")) return t;
    const [net, wild] = t.split(/\s+/);
    if (!wild || wild === "0.0.0.0") return standard ? net! : `host ${net}`;
    return standard ? `${net}, wildcard bits ${wild}` : `${net} ${wild}`;
  };
  if (standard) return `${ace.sequence} ${ace.action} ${addr(ace.source)}`;
  const port = ace.dstPort != null ? ` eq ${ace.dstPort}` : "";
  return `${ace.sequence} ${ace.action} ${ace.protocol} ${addr(ace.source)} ${addr(ace.destination)}${port}`;
}

const PORT_NAMES: Record<string, number> = {
  www: 80,
  http: 80,
  https: 443,
  ftp: 21,
  telnet: 23,
  ssh: 22,
  smtp: 25,
  pop3: 110,
  domain: 53,
  tftp: 69,
  snmp: 161,
  ntp: 123,
};

/**
 * Interpreta la parte dopo "access-list N permit|deny".
 * Restituisce l’ACE (senza sequence/action) oppure un errore.
 */
export function parseAceTokens(
  id: number,
  tokens: string[],
): { ace?: Omit<AclAce, "sequence" | "action">; error?: string } {
  const t = tokens.map((x) => x.toLowerCase());
  let pos = 0;
  const readAddr = (): string | null => {
    const a = t[pos];
    if (!a) return null;
    if (a === "any") {
      pos += 1;
      return "any";
    }
    if (a === "host") {
      const ip = t[pos + 1];
      if (!ip || parseIp(ip) === null) return null;
      pos += 2;
      return `host ${ip}`;
    }
    if (parseIp(a) === null) return null;
    const w = t[pos + 1];
    if (w && parseIp(w) !== null) {
      pos += 2;
      return w === "0.0.0.0" ? `host ${a}` : `${a} ${w}`;
    }
    pos += 1;
    return `host ${a}`;
  };

  if (isStandardAcl(id)) {
    const source = readAddr();
    if (!source) return { error: "% Indirizzo origine non valido" };
    return { ace: { protocol: "ip", source, destination: "any" } };
  }
  if (!isExtendedAcl(id)) {
    return { error: "% Numero ACL non valido (1-99, 100-199, 1300-1999, 2000-2699)" };
  }
  const proto = t[pos];
  if (proto !== "ip" && proto !== "icmp" && proto !== "tcp" && proto !== "udp") {
    return { error: "% Protocollo non supportato (ip, icmp, tcp, udp)" };
  }
  pos += 1;
  const source = readAddr();
  if (!source) return { error: "% Indirizzo origine non valido" };
  // porta origine (eq/gt/lt/neq N, range A B): accettata e ignorata
  const skipPortOp = () => {
    const op = t[pos];
    if (op === "eq" || op === "gt" || op === "lt" || op === "neq") pos += 2;
    else if (op === "range") pos += 3;
  };
  if (proto === "tcp" || proto === "udp") skipPortOp();
  const destination = readAddr();
  if (!destination) return { error: "% Indirizzo destinazione non valido" };
  let dstPort: number | undefined;
  if ((proto === "tcp" || proto === "udp") && t[pos] === "eq") {
    const raw = t[pos + 1] ?? "";
    const n = /^\d+$/.test(raw) ? Number(raw) : PORT_NAMES[raw];
    if (n == null || n < 1 || n > 65535) return { error: "% Porta non valida" };
    dstPort = n;
  }
  return {
    ace: {
      protocol: proto,
      source,
      destination,
      ...(dstPort != null ? { dstPort } : {}),
    },
  };
}
