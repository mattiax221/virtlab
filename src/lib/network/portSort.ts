import type { InterfaceConfig } from "./types";

/** Ordine Cisco: Fa0/1…Fa0/9, Fa0/10 (non Fa0/1, Fa0/10, Fa0/2). */
export function portSortKey(name: string): [string, number, number, string] {
  const m = name.match(/^([A-Za-z]+)(\d+)(?:\/(\d+))?(?:\.(\d+))?$/);
  if (!m) return [name.toLowerCase(), 0, 0, name];
  return [m[1].toLowerCase(), Number(m[2]) || 0, m[3] != null ? Number(m[3]) : -1, name];
}

export function comparePorts(a: InterfaceConfig, b: InterfaceConfig): number {
  const mediaRank = (m: InterfaceConfig["media"]) =>
    m === "ethernet" ? 0 : m === "fiber" ? 1 : m === "serial" ? 2 : m === "wireless" ? 3 : 4;
  const mr = mediaRank(a.media) - mediaRank(b.media);
  if (mr !== 0) return mr;
  const ka = portSortKey(a.name);
  const kb = portSortKey(b.name);
  if (ka[0] !== kb[0]) return ka[0] < kb[0] ? -1 : 1;
  if (ka[1] !== kb[1]) return ka[1] - kb[1];
  if (ka[2] !== kb[2]) return ka[2] - kb[2];
  return ka[3].localeCompare(kb[3]);
}

export function shortPortName(name: string): string {
  return name
    .replace("FastEthernet", "Fa")
    .replace("GigabitEthernet", "Gi")
    .replace("Serial", "Se")
    .replace("Wireless", "Wi");
}

/** Velocità operativa stimata (PT-style). */
export function portSpeedLabel(iface: InterfaceConfig): string {
  if (!iface.enabled) return "—";
  if (!iface.connectedLinkId) return "—";
  if (iface.media === "wireless") return "WLAN";
  if (iface.media === "serial") {
    return iface.clockRate ? `${Math.round(iface.clockRate / 1000)}k` : "serial";
  }
  if (iface.media === "fiber" || /Gigabit/i.test(iface.name)) return "1000";
  if (/FastEthernet|Ethernet/i.test(iface.name)) return "100";
  return "100";
}

export function portDuplexLabel(iface: InterfaceConfig): string {
  if (!iface.enabled || !iface.connectedLinkId) return "—";
  if (iface.media === "wireless" || iface.media === "serial") return "—";
  return "full";
}
