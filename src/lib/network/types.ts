export type DeviceKind =
  | "pc"
  | "laptop"
  | "server"
  | "printer"
  | "ip_phone"
  | "hub"
  | "switch"
  | "multilayer_switch"
  | "router"
  | "wireless_router"
  | "access_point"
  | "modem_dsl"
  | "modem_cable"
  | "cloud"
  | "firewall";

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
  /** Persisted ReactOS disk slot (end hosts with OS). */
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
  { label: string; category: DeviceCategory; ports: number; hasOs: boolean }
> = {
  pc: { label: "PC", category: "end", ports: 1, hasOs: true },
  laptop: { label: "Laptop", category: "end", ports: 1, hasOs: true },
  server: { label: "Server", category: "end", ports: 1, hasOs: true },
  printer: { label: "Printer", category: "end", ports: 1, hasOs: false },
  ip_phone: { label: "IP Phone", category: "end", ports: 2, hasOs: false },
  hub: { label: "Hub", category: "switch", ports: 8, hasOs: false },
  switch: { label: "Switch", category: "switch", ports: 8, hasOs: false },
  multilayer_switch: {
    label: "Switch L3",
    category: "switch",
    ports: 8,
    hasOs: false,
  },
  router: { label: "Router", category: "router", ports: 2, hasOs: false },
  wireless_router: {
    label: "Router Wi‑Fi",
    category: "router",
    ports: 5,
    hasOs: false,
  },
  access_point: { label: "Access Point", category: "other", ports: 1, hasOs: false },
  modem_dsl: { label: "Modem DSL", category: "wan", ports: 2, hasOs: false },
  modem_cable: { label: "Modem Cable", category: "wan", ports: 2, hasOs: false },
  cloud: { label: "Cloud", category: "wan", ports: 4, hasOs: false },
  firewall: { label: "Firewall", category: "router", ports: 3, hasOs: false },
};

export function isL2Bridge(type: DeviceKind): boolean {
  return (
    type === "hub" ||
    type === "switch" ||
    type === "access_point" ||
    type === "cloud"
  );
}

export function isL3Device(type: DeviceKind): boolean {
  return (
    type === "router" ||
    type === "wireless_router" ||
    type === "firewall" ||
    type === "multilayer_switch" ||
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
