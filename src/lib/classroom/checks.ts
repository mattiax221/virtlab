/**
 * Verifiche automatiche delle consegne: girano sul motore del simulatore,
 * quindi danno lo stesso esito che l’allievo vede con ping e browser.
 */
import { runPing } from "@/lib/network/engine";
import { fetchHttp } from "@/lib/network/services";
import type { LabState } from "@/lib/network/types";
import type { AssignmentCheck, CheckKind, CheckReport, CheckResult } from "./types";

export const CHECK_KIND_LABEL: Record<CheckKind, string> = {
  "ping-ok": "Il ping deve riuscire",
  "ping-ko": "Il ping deve fallire",
  "http-ok": "La pagina web deve aprirsi",
  "dhcp-ok": "Deve ottenere l’IP via DHCP",
};

export function describeCheck(c: AssignmentCheck): string {
  if (c.label?.trim()) return c.label.trim();
  switch (c.kind) {
    case "ping-ok":
      return `${c.from} raggiunge ${c.target} (ping)`;
    case "ping-ko":
      return `${c.from} NON raggiunge ${c.target} (ping bloccato)`;
    case "http-ok":
      return `${c.from} apre http://${c.target}`;
    case "dhcp-ok":
      return `${c.from} riceve l’indirizzo via DHCP`;
  }
}

/** Raggruppa i motivi di errore del simulatore in poche categorie leggibili. */
export function categorize(reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes("non esiste nel lab")) return "Dispositivo mancante o nome diverso";
  if (r.includes("è spento")) return "Dispositivo spento";
  if (r.includes("firewall")) return "Firewall dell’host";
  if (r.includes("acl")) return "Bloccato da ACL";
  if (r.includes("risolvere") || r.includes("non ha trovato l'host")) return "Nome non risolto (DNS)";
  if (r.includes("risposta non torna")) {
    if (r.includes("gateway")) return "Gateway mancante o sbagliato";
    return "Rotta di ritorno mancante";
  }
  if (r.includes("nessun gateway") || r.includes("non è nella sua subnet")) {
    return "Gateway mancante o sbagliato";
  }
  if (r.includes("nessuna rotta")) return "Rotta mancante";
  if (r.includes("next hop") || r.includes("gateway")) {
    return "Gateway non raggiungibile (VLAN, trunk, shutdown)";
  }
  if (r.includes("arp") || r.includes("vlan")) return "Host non raggiungibile in LAN (VLAN, cavo, IP)";
  if (r.includes("nessun ip") || r.includes("nessun indirizzo")) return "IP non configurato";
  if (r.includes("cavo") || r.includes("non è collegata")) return "Cavo scollegato";
  if (r.includes("dhcp")) return "DHCP non riuscito";
  return "Altro";
}

function deviceByName(state: LabState, name: string) {
  const n = name.trim().toLowerCase();
  return state.devices.find((d) => d.name.trim().toLowerCase() === n);
}

export function runCheck(state: LabState, check: AssignmentCheck): CheckResult {
  const from = deviceByName(state, check.from);
  if (!from) {
    const detail = `Il dispositivo “${check.from}” non esiste nel lab.`;
    return { check, ok: false, detail, category: categorize(detail) };
  }
  const target = (check.target ?? "").trim();

  if (check.kind === "dhcp-ok") {
    const nic = from.interfaces.find((i) => i.dhcpClient && i.ip);
    if (nic) return { check, ok: true, detail: `${nic.name}: ${nic.ip} via DHCP` };
    const detail = `${from.name} non ha un indirizzo ottenuto via DHCP.`;
    return { check, ok: false, detail, category: "DHCP non riuscito" };
  }

  if (!target) {
    return { check, ok: false, detail: "Verifica senza destinazione.", category: "Altro" };
  }

  if (check.kind === "http-ok") {
    const probe = fetchHttp(state, from.id, target);
    const dest = probe.destIp ?? target;
    const { result, state: after } = runPing(state, from.id, dest, 1, { proto: "tcp", port: 80 });
    if (!result.ok) {
      const detail = result.reason ?? "Server web non raggiungibile.";
      return { check, ok: false, detail, category: categorize(detail) };
    }
    const page = fetchHttp(after, from.id, target, { reachable: true });
    return page.ok
      ? { check, ok: true, detail: `Pagina aperta da ${dest}` }
      : { check, ok: false, detail: page.output, category: "Servizio HTTP assente" };
  }

  const { result } = runPing(state, from.id, target, 1);
  if (check.kind === "ping-ok") {
    if (result.ok) return { check, ok: true, detail: "Risposta ricevuta" };
    const detail = result.reason ?? "Richiesta scaduta.";
    return { check, ok: false, detail, category: categorize(detail) };
  }
  // ping-ko: deve essere bloccato
  if (!result.ok) return { check, ok: true, detail: `Bloccato: ${result.reason ?? "nessuna risposta"}` };
  return {
    check,
    ok: false,
    detail: "Il ping passa, ma doveva essere bloccato.",
    category: "Isolamento mancante (ACL o VLAN)",
  };
}

export function runChecks(state: LabState, checks: AssignmentCheck[]): CheckReport {
  const results = checks.map((c) => runCheck(state, c));
  return {
    results,
    passed: results.filter((r) => r.ok).length,
    total: results.length,
  };
}

/** Modelli di partenza per il docente (nomi e IP si modificano). */
export const CHECK_TEMPLATES: {
  id: string;
  title: string;
  description: string;
  checks: AssignmentCheck[];
}[] = [
  {
    id: "lan",
    title: "LAN con switch",
    description:
      "Collega due PC a uno switch e configura gli indirizzi 192.168.1.10 e 192.168.1.11 /24.",
    checks: [{ kind: "ping-ok", from: "PC0", target: "192.168.1.11" }],
  },
  {
    id: "vlan-isolamento",
    title: "VLAN separate",
    description:
      "Sullo stesso switch metti PC0 in VLAN 10 e PC1 in VLAN 20, con IP della stessa rete: non devono vedersi.",
    checks: [{ kind: "ping-ko", from: "PC0", target: "192.168.1.11" }],
  },
  {
    id: "router-on-a-stick",
    title: "Inter-VLAN router-on-a-stick",
    description:
      "VLAN 10 (192.168.10.0/24) e VLAN 20 (192.168.20.0/24), trunk verso il router, sottointerfacce .10 e .20.",
    checks: [
      { kind: "ping-ok", from: "PC0", target: "192.168.10.1" },
      { kind: "ping-ok", from: "PC0", target: "192.168.20.10" },
    ],
  },
  {
    id: "routing-statico",
    title: "Routing statico tra due router",
    description:
      "Due LAN collegate da due router: configura le rotte statiche in entrambi i versi.",
    checks: [{ kind: "ping-ok", from: "PC0", target: "192.168.2.10" }],
  },
  {
    id: "acl",
    title: "ACL: blocca il ping, lascia il web",
    description:
      "Con una ACL estesa blocca l’ICMP verso il server ma lascia passare HTTP.",
    checks: [
      { kind: "ping-ko", from: "PC0", target: "192.168.2.100" },
      { kind: "http-ok", from: "PC0", target: "192.168.2.100" },
    ],
  },
  {
    id: "dhcp-relay",
    title: "DHCP con relay",
    description:
      "Il server DHCP sta in un’altra rete: configura ip helper-address sul router e un pool per ogni rete.",
    checks: [{ kind: "dhcp-ok", from: "PC0" }],
  },
];

/** Normalizza le verifiche arrivate dal database (jsonb). */
export function parseChecks(raw: unknown): AssignmentCheck[] {
  if (!Array.isArray(raw)) return [];
  const kinds: CheckKind[] = ["ping-ok", "ping-ko", "http-ok", "dhcp-ok"];
  return raw
    .filter(
      (c): c is AssignmentCheck =>
        !!c &&
        typeof c === "object" &&
        kinds.includes((c as AssignmentCheck).kind) &&
        typeof (c as AssignmentCheck).from === "string",
    )
    .map((c) => ({
      kind: c.kind,
      from: c.from,
      target: typeof c.target === "string" ? c.target : "",
      label: typeof c.label === "string" ? c.label : undefined,
    }));
}
