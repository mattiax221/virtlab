import type { Device, HostFirewall, HostFirewallRule } from "./types";

export function defaultHostFirewall(): HostFirewall {
  return {
    enabled: false,
    defaultDeny: false,
    rules: [
      {
        id: "allow-icmp-in",
        enabled: true,
        action: "allow",
        direction: "in",
        proto: "icmp",
        description: "Allow ping inbound",
      },
      {
        id: "allow-icmp-out",
        enabled: true,
        action: "allow",
        direction: "out",
        proto: "icmp",
        description: "Allow ping outbound",
      },
    ],
  };
}

function ruleMatches(
  rule: HostFirewallRule,
  direction: "in" | "out",
  proto: "icmp" | "tcp" | "udp",
  remoteIp: string,
  port?: number,
): boolean {
  if (!rule.enabled) return false;
  if (rule.direction !== direction) return false;
  if (rule.proto !== "any" && rule.proto !== proto) return false;
  if (rule.remoteIp && rule.remoteIp !== remoteIp) return false;
  if (
    (proto === "tcp" || proto === "udp") &&
    rule.port != null &&
    port != null &&
    rule.port !== port
  ) {
    return false;
  }
  if (
    (proto === "tcp" || proto === "udp") &&
    rule.port != null &&
    port == null
  ) {
    return false;
  }
  return true;
}

/**
 * @returns messaggio di blocco, oppure null se permesso
 */
export function hostFirewallBlocks(
  device: Device,
  direction: "in" | "out",
  proto: "icmp" | "tcp" | "udp",
  remoteIp: string,
  port?: number,
): string | null {
  const fw = device.hostFirewall;
  if (!fw?.enabled) return null;

  for (const rule of fw.rules) {
    if (!ruleMatches(rule, direction, proto, remoteIp, port)) continue;
    if (rule.action === "deny") {
      return `Firewall ${device.name}: ${direction} ${proto}${port != null ? `/${port}` : ""} da/verso ${remoteIp} DENY${rule.description ? ` (${rule.description})` : ""}`;
    }
    return null; // allow
  }

  if (fw.defaultDeny) {
    return `Firewall ${device.name}: ${direction} ${proto} default DENY`;
  }
  return null;
}
