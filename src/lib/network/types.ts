export type DeviceKind =
  // End
  | "pc"
  | "laptop"
  | "server"
  | "printer"
  | "ip_phone"
  | "tablet"
  | "smartphone"
  | "tv"
  | "analog_phone"
  // L2 / infra
  | "hub"
  | "bridge"
  | "repeater"
  | "switch"
  | "switch_2950"
  | "switch_2950t"
  | "switch_2960"
  | "switch_3560"
  | "switch_3650"
  | "switch_ie2000"
  | "multilayer_switch"
  // Routers
  | "router"
  | "router_1841"
  | "router_1941"
  | "router_2811"
  | "router_2901"
  | "router_2911"
  | "router_4321"
  | "router_4331"
  | "wireless_router"
  | "home_router"
  // Wireless
  | "access_point"
  | "ap_n"
  | "lap"
  | "wlc"
  // Security / WAN
  | "firewall_asa5505"
  | "firewall_asa5506"
  | "modem_dsl"
  | "modem_cable"
  | "cloud"
  | "co_server";

export type DeviceType = DeviceKind;

export type PortMode = "access" | "trunk";

export type InterfaceConfig = {
  id: string;
  name: string;
  ip: string | null;
  mask: string | null;
  gateway: string | null;
  mac: string;
  connectedLinkId: string | null;
  enabled: boolean;
  /** L2 (switch ports) */
  mode: PortMode;
  accessVlan: number;
  nativeVlan: number;
  /** trunk: 'all' or explicit list */
  allowedVlans: number[] | "all";
};

export type VlanRecord = {
  id: number;
  name: string;
};

export type MacEntry = {
  mac: string;
  vlan: number;
  portId: string;
  type: "dynamic" | "static";
};

export type Device = {
  id: string;
  type: DeviceKind;
  name: string;
  x: number;
  y: number;
  interfaces: InterfaceConfig[];
  osSlot?: string;
  /** Defined VLANs on managed switches (VLAN 1 always exists) */
  vlans?: VlanRecord[];
  /** Learned / static MAC address table */
  macTable?: MacEntry[];
};

export type Link = {
  id: string;
  aDeviceId: string;
  aIfaceId: string;
  bDeviceId: string;
  bIfaceId: string;
  media:
    | "straight"
    | "cross"
    | "serial"
    | "fiber"
    | "console"
    | "coaxial"
    | "phone"
    | "wireless";
};

export type LabState = {
  devices: Device[];
  links: Link[];
};

export type PingHop = {
  deviceId: string;
  deviceName: string;
  ip: string;
};

export type PingResult = {
  ok: boolean;
  fromIp: string;
  toIp: string;
  hops: PingHop[];
  rttMs: number;
  message: string;
  packets: { sent: number; received: number; lost: number };
};

export type CommandResult = {
  output: string;
  clear?: boolean;
};

export type DeviceCategory = "end" | "switch" | "router" | "wan" | "other";

type Meta = {
  label: string;
  category: DeviceCategory;
  ports: number;
  hasOs: boolean;
  ptModel: string;
};

export const DEVICE_META: Record<DeviceKind, Meta> = {
  pc: { label: "PC-PT", category: "end", ports: 1, hasOs: true, ptModel: "PC-PT" },
  laptop: { label: "Laptop-PT", category: "end", ports: 1, hasOs: true, ptModel: "Laptop-PT" },
  server: { label: "Server-PT", category: "end", ports: 1, hasOs: true, ptModel: "Server-PT" },
  printer: { label: "Printer-PT", category: "end", ports: 1, hasOs: false, ptModel: "Printer-PT" },
  ip_phone: { label: "IP Phone 7960", category: "end", ports: 2, hasOs: false, ptModel: "7960" },
  tablet: { label: "TabletPC-PT", category: "end", ports: 1, hasOs: false, ptModel: "TabletPC-PT" },
  smartphone: { label: "Smartphone-PT", category: "end", ports: 1, hasOs: false, ptModel: "SMARTPHONE-PT" },
  tv: { label: "TV-PT", category: "end", ports: 1, hasOs: false, ptModel: "TV-PT" },
  analog_phone: { label: "Analog Phone", category: "end", ports: 1, hasOs: false, ptModel: "Analog-Phone-PT" },
  hub: { label: "Hub-PT", category: "switch", ports: 8, hasOs: false, ptModel: "Hub-PT" },
  bridge: { label: "Bridge-PT", category: "switch", ports: 2, hasOs: false, ptModel: "Bridge-PT" },
  repeater: { label: "Repeater-PT", category: "switch", ports: 2, hasOs: false, ptModel: "Repeater-PT" },
  switch: { label: "Switch-PT", category: "switch", ports: 8, hasOs: false, ptModel: "Switch-PT" },
  switch_2950: { label: "2950-24", category: "switch", ports: 24, hasOs: false, ptModel: "2950-24" },
  switch_2950t: { label: "2950T-24", category: "switch", ports: 26, hasOs: false, ptModel: "2950T-24" },
  switch_2960: { label: "2960-24TT", category: "switch", ports: 26, hasOs: false, ptModel: "2960-24TT" },
  switch_3560: { label: "3560-24PS", category: "switch", ports: 26, hasOs: false, ptModel: "3560-24PS" },
  switch_3650: { label: "3650-24PS", category: "switch", ports: 26, hasOs: false, ptModel: "3650-24PS" },
  switch_ie2000: { label: "IE-2000", category: "switch", ports: 10, hasOs: false, ptModel: "IE-2000" },
  multilayer_switch: { label: "MLS-PT", category: "switch", ports: 8, hasOs: false, ptModel: "3560-24PS" },
  router: { label: "Router-PT", category: "router", ports: 2, hasOs: false, ptModel: "Router-PT" },
  router_1841: { label: "1841", category: "router", ports: 2, hasOs: false, ptModel: "1841" },
  router_1941: { label: "1941", category: "router", ports: 2, hasOs: false, ptModel: "1941" },
  router_2811: { label: "2811", category: "router", ports: 2, hasOs: false, ptModel: "2811" },
  router_2901: { label: "2901", category: "router", ports: 2, hasOs: false, ptModel: "2901" },
  router_2911: { label: "2911", category: "router", ports: 3, hasOs: false, ptModel: "2911" },
  router_4321: { label: "ISR4321", category: "router", ports: 2, hasOs: false, ptModel: "ISR4321" },
  router_4331: { label: "ISR4331", category: "router", ports: 3, hasOs: false, ptModel: "ISR4331" },
  wireless_router: { label: "WRT300N", category: "router", ports: 5, hasOs: false, ptModel: "Linksys-WRT300N" },
  home_router: { label: "Home Router AC", category: "router", ports: 5, hasOs: false, ptModel: "HomeRouter-PT-AC" },
  access_point: { label: "AccessPoint-PT", category: "other", ports: 1, hasOs: false, ptModel: "AccessPoint-PT" },
  ap_n: { label: "AP-PT-N", category: "other", ports: 1, hasOs: false, ptModel: "AccessPoint-PT-N" },
  lap: { label: "LAP-PT", category: "other", ports: 1, hasOs: false, ptModel: "LAP-PT" },
  wlc: { label: "WLC-PT", category: "other", ports: 2, hasOs: false, ptModel: "WLC-PT" },
  firewall_asa5505: { label: "ASA 5505", category: "router", ports: 3, hasOs: false, ptModel: "5505" },
  firewall_asa5506: { label: "ASA 5506-X", category: "router", ports: 4, hasOs: false, ptModel: "5506-X" },
  modem_dsl: { label: "DSL Modem", category: "wan", ports: 2, hasOs: false, ptModel: "DSL-Modem-PT" },
  modem_cable: { label: "Cable Modem", category: "wan", ports: 2, hasOs: false, ptModel: "Cable-Modem-PT" },
  cloud: { label: "Cloud-PT", category: "wan", ports: 4, hasOs: false, ptModel: "Cloud-PT" },
  co_server: { label: "Central Office", category: "wan", ports: 2, hasOs: false, ptModel: "Central-Office-Server" },
};

/** Managed Cisco-like switch (VLAN / MAC table / switchport) */
export function isManagedSwitch(type: DeviceKind): boolean {
  return (
    type === "switch" ||
    type.startsWith("switch_") ||
    type === "multilayer_switch"
  );
}

/** Floods frames at L2 (hubs, switches, AP, cloud…) */
export function isL2Bridge(type: DeviceKind): boolean {
  return (
    type === "hub" ||
    type === "bridge" ||
    type === "repeater" ||
    isManagedSwitch(type) ||
    type === "access_point" ||
    type === "ap_n" ||
    type === "lap" ||
    type === "cloud"
  );
}

export function defaultVlans(): VlanRecord[] {
  return [
    { id: 1, name: "default" },
    { id: 1002, name: "fddi-default" },
    { id: 1003, name: "token-ring-default" },
    { id: 1004, name: "fddinet-default" },
    { id: 1005, name: "trnet-default" },
  ];
}

export function isL3Device(type: DeviceKind): boolean {
  return (
    type === "router" ||
    type.startsWith("router_") ||
    type === "wireless_router" ||
    type === "home_router" ||
    type.startsWith("firewall_") ||
    type === "multilayer_switch" ||
    type === "switch_3560" ||
    type === "switch_3650" ||
    type === "wlc" ||
    type === "modem_dsl" ||
    type === "modem_cable"
  );
}

export function isEndHost(type: DeviceKind): boolean {
  return DEVICE_META[type].category === "end";
}

export function iconFamily(type: DeviceKind): string {
  if (type === "pc" || type === "tablet") return "pc";
  if (type === "laptop") return "laptop";
  if (type === "server" || type === "co_server") return "server";
  if (type === "printer") return "printer";
  if (type === "ip_phone" || type === "analog_phone") return "phone";
  if (type === "smartphone") return "phone";
  if (type === "tv") return "tv";
  if (type === "hub" || type === "bridge" || type === "repeater") return "hub";
  if (type.startsWith("switch") || type === "multilayer_switch") return "switch";
  if (type.startsWith("firewall")) return "firewall";
  if (type === "wireless_router" || type === "home_router") return "wifi";
  if (type === "access_point" || type === "ap_n" || type === "lap" || type === "wlc")
    return "ap";
  if (type.startsWith("modem")) return "modem";
  if (type === "cloud") return "cloud";
  return "router";
}
