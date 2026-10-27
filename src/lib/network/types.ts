export type DeviceKind =
  // End
  | "pc"
  | "laptop"
  | "server"
  | "printer"
  | "ip_phone"
  // L2
  | "hub"
  | "switch_2950"
  | "switch_2960"
  | "switch_3560"
  | "switch_3650"
  | "switch" // generic alias UI
  | "multilayer_switch"
  // L3 / WAN
  | "router_1841"
  | "router_1941"
  | "router_2911"
  | "router_4321"
  | "router"
  | "wireless_router"
  | "access_point"
  | "modem_dsl"
  | "modem_cable"
  | "cloud"
  | "firewall_asa";

/** @deprecated alias */
export type DeviceType = DeviceKind;

export type InterfaceConfig = {
  id: string;
  name: string;
  ip: string | null;
  mask: string | null;
  gateway: string | null;
  mac: string;
  connectedLinkId: string | null;
  enabled: boolean;
};

export type Device = {
  id: string;
  type: DeviceKind;
  name: string;
  x: number;
  y: number;
  interfaces: InterfaceConfig[];
  osSlot?: string;
};

export type Link = {
  id: string;
  aDeviceId: string;
  aIfaceId: string;
  bDeviceId: string;
  bIfaceId: string;
  media?: "copper" | "serial" | "fiber" | "wireless";
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

export const DEVICE_META: Record<
  DeviceKind,
  {
    label: string;
    category: DeviceCategory;
    ports: number;
    hasOs: boolean;
    ptModel?: string;
  }
> = {
  pc: { label: "PC-PT", category: "end", ports: 1, hasOs: true, ptModel: "PC-PT" },
  laptop: {
    label: "Laptop-PT",
    category: "end",
    ports: 1,
    hasOs: true,
    ptModel: "Laptop-PT",
  },
  server: {
    label: "Server-PT",
    category: "end",
    ports: 1,
    hasOs: true,
    ptModel: "Server-PT",
  },
  printer: {
    label: "Printer-PT",
    category: "end",
    ports: 1,
    hasOs: false,
    ptModel: "Printer-PT",
  },
  ip_phone: {
    label: "IP Phone 7960",
    category: "end",
    ports: 2,
    hasOs: false,
    ptModel: "7960",
  },
  hub: { label: "Hub-PT", category: "switch", ports: 8, hasOs: false, ptModel: "Hub-PT" },
  switch: {
    label: "Switch-PT",
    category: "switch",
    ports: 8,
    hasOs: false,
    ptModel: "Switch-PT",
  },
  switch_2950: {
    label: "2950-24",
    category: "switch",
    ports: 24,
    hasOs: false,
    ptModel: "2950-24",
  },
  switch_2960: {
    label: "2960-24TT",
    category: "switch",
    ports: 24,
    hasOs: false,
    ptModel: "2960-24TT",
  },
  switch_3560: {
    label: "3560-24PS",
    category: "switch",
    ports: 24,
    hasOs: false,
    ptModel: "3560-24PS",
  },
  switch_3650: {
    label: "3650-24PS",
    category: "switch",
    ports: 24,
    hasOs: false,
    ptModel: "3650-24PS",
  },
  multilayer_switch: {
    label: "Switch L3-PT",
    category: "switch",
    ports: 8,
    hasOs: false,
    ptModel: "3560-24PS",
  },
  router: {
    label: "Router-PT",
    category: "router",
    ports: 2,
    hasOs: false,
    ptModel: "Router-PT",
  },
  router_1841: {
    label: "1841",
    category: "router",
    ports: 2,
    hasOs: false,
    ptModel: "1841",
  },
  router_1941: {
    label: "1941",
    category: "router",
    ports: 3,
    hasOs: false,
    ptModel: "1941",
  },
  router_2911: {
    label: "2911",
    category: "router",
    ports: 3,
    hasOs: false,
    ptModel: "2911",
  },
  router_4321: {
    label: "4321",
    category: "router",
    ports: 3,
    hasOs: false,
    ptModel: "4321",
  },
  wireless_router: {
    label: "WRT300N",
    category: "router",
    ports: 5,
    hasOs: false,
    ptModel: "WRT300N",
  },
  access_point: {
    label: "AccessPoint-PT",
    category: "other",
    ports: 1,
    hasOs: false,
    ptModel: "AccessPoint-PT",
  },
  modem_dsl: {
    label: "DSL Modem",
    category: "wan",
    ports: 2,
    hasOs: false,
    ptModel: "DSL Modem",
  },
  modem_cable: {
    label: "Cable Modem",
    category: "wan",
    ports: 2,
    hasOs: false,
    ptModel: "Cable Modem",
  },
  cloud: {
    label: "Cloud-PT",
    category: "wan",
    ports: 4,
    hasOs: false,
    ptModel: "Cloud-PT",
  },
  firewall_asa: {
    label: "ASA 5505",
    category: "router",
    ports: 3,
    hasOs: false,
    ptModel: "5505",
  },
};

export function isL2Bridge(type: DeviceKind): boolean {
  return (
    type === "hub" ||
    type === "switch" ||
    type.startsWith("switch_") ||
    type === "access_point" ||
    type === "cloud"
  );
}

export function isL3Device(type: DeviceKind): boolean {
  return (
    type === "router" ||
    type.startsWith("router_") ||
    type === "wireless_router" ||
    type === "firewall_asa" ||
    type === "multilayer_switch" ||
    type === "switch_3560" ||
    type === "switch_3650" ||
    type === "modem_dsl" ||
    type === "modem_cable"
  );
}

export function isEndHost(type: DeviceKind): boolean {
  return (
    type === "pc" ||
    type === "laptop" ||
    type === "server" ||
    type === "printer" ||
    type === "ip_phone"
  );
}

export function iconFamily(
  type: DeviceKind,
): "pc" | "laptop" | "server" | "printer" | "phone" | "hub" | "switch" | "router" | "wifi" | "ap" | "modem" | "cloud" | "firewall" {
  if (type === "pc") return "pc";
  if (type === "laptop") return "laptop";
  if (type === "server") return "server";
  if (type === "printer") return "printer";
  if (type === "ip_phone") return "phone";
  if (type === "hub") return "hub";
  if (type === "switch" || type.startsWith("switch_") || type === "multilayer_switch")
    return "switch";
  if (type === "firewall_asa") return "firewall";
  if (type === "wireless_router") return "wifi";
  if (type === "access_point") return "ap";
  if (type === "modem_dsl" || type === "modem_cable") return "modem";
  if (type === "cloud") return "cloud";
  return "router";
}
