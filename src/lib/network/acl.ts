import type { AclAce, AclProtocol, Device, InterfaceConfig } from "./types";

function matchHost(pattern: string, ip: string): boolean {
  if (pattern === "any" || pattern === "0.0.0.0") return true;
  if (pattern.startsWith("host ")) {
    return pattern.slice(5).trim() === ip;
  }
  return pattern === ip;
}

function matchProto(ace: AclAce, proto: AclProtocol): boolean {
  if (ace.protocol === "any" || ace.protocol === "ip") return true;
  return ace.protocol === proto;
}

/** Evaluate numbered ACL; implicit deny if list exists and no match. */
export function evaluateAccessList(
  aces: AclAce[],
  src: string,
  dst: string,
  proto: AclProtocol,
): "permit" | "deny" {
  const sorted = [...aces].sort((a, b) => a.sequence - b.sequence);
  for (const ace of sorted) {
    if (!matchProto(ace, proto)) continue;
    if (!matchHost(ace.source, src)) continue;
    if (!matchHost(ace.destination, dst)) continue;
    return ace.action;
  }
  return "deny";
}

export function ifaceAclDecision(
  device: Device,
  iface: InterfaceConfig | undefined,
  direction: "in" | "out",
  src: string,
  dst: string,
  proto: AclProtocol,
): "permit" | "deny" | "none" {
  if (!iface) return "none";
  const listId = direction === "in" ? iface.aclIn : iface.aclOut;
  if (listId == null) return "none";
  const list = device.accessLists?.find((a) => a.id === listId);
  if (!list || list.aces.length === 0) return "deny";
  return evaluateAccessList(list.aces, src, dst, proto);
}

/** True if traffic may pass the router hop (ACL + serial already handled elsewhere). */
export function routerAllowsIcmp(
  router: Device,
  ingressIface: InterfaceConfig | null,
  egressIface: InterfaceConfig | null,
  srcIp: string,
  dstIp: string,
): { ok: boolean; reason?: string } {
  const inn = ifaceAclDecision(
    router,
    ingressIface ?? undefined,
    "in",
    srcIp,
    dstIp,
    "icmp",
  );
  if (inn === "deny") {
    return {
      ok: false,
      reason: `ACL ${ingressIface?.aclIn} inbound deny su ${router.name}`,
    };
  }
  const out = ifaceAclDecision(
    router,
    egressIface ?? undefined,
    "out",
    srcIp,
    dstIp,
    "icmp",
  );
  if (out === "deny") {
    return {
      ok: false,
      reason: `ACL ${egressIface?.aclOut} outbound deny su ${router.name}`,
    };
  }
  return { ok: true };
}
