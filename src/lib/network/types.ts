export type DeviceType = "pc" | "router" | "switch";

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
  type: DeviceType;
  name: string;
  x: number;
  y: number;
  interfaces: InterfaceConfig[];
};

export type Link = {
  id: string;
  aDeviceId: string;
  aIfaceId: string;
  bDeviceId: string;
  bIfaceId: string;
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
