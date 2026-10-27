export type DeviceKind =
  // End Devices (Packet Tracer)
  | "pc"
  | "laptop"
  | "server"
  | "meraki_server"
  | "network_controller"
  | "printer"
  | "ip_phone"
  | "voip_device"
  | "analog_phone"
  | "tv"
  | "tablet"
  | "smartphone"
  | "generic_wireless"
  | "generic_wired"
  | "sniffer"
  // Hubs / L1
  | "hub"
  | "repeater"
  | "coaxial_splitter"
  // Switches / Bridge
  | "bridge"
  | "switch"
  | "switch_empty"
  | "switch_2950"
  | "switch_2950t"
  | "switch_2960"
  | "switch_3560"
  | "switch_3650"
  | "switch_ie2000"
  | "switch_ie3400"
  | "switch_ie9320"
  | "multilayer_switch"
  // Routers
  | "router"
  | "router_empty"
  | "router_pt8200"
  | "router_1841"
  | "router_1941"
  | "router_2620xm"
  | "router_2621xm"
  | "router_2811"
  | "router_2901"
  | "router_2911"
  | "router_4321"
  | "router_4331"
  | "router_819iox"
  | "router_819hgw"
  | "router_829"
  | "router_1240"
  | "router_ir1101"
  | "router_ir8340"
  | "wireless_router"
  | "home_router"
  | "home_gateway"
  // Wireless
  | "access_point"
  | "ap_a"
  | "ap_ac"
  | "ap_n"
  | "ap_3702i"
  | "lap"
  | "meraki_ap"
  | "wlc"
  | "wlc_2504"
  | "wlc_3504"
  | "cell_tower"
  // Security / WAN
  | "firewall_asa5505"
  | "firewall_asa5506"
  | "firewall_isa3000"
  | "cyber_observer"
  | "modem_dsl"
  | "modem_cable"
  | "cloud"
  | "cloud_empty"
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
  /** Physical media (from module) */
  media: "ethernet" | "wireless" | "serial" | "fiber" | "coaxial" | "phone";
  /** Owning physical module id (null for legacy/orphan) */
  moduleId: string | null;
  /** Subinterface: parent physical iface id */
  parentIfaceId: string | null;
  /** encapsulation dot1Q VLAN (subinterface) */
  vlanTag: number | null;
  /** Obtained address via DHCP */
  dhcpClient: boolean;
  /** Preferred DNS (from DHCP or static) */
  dnsServers: string[];
  /** Serial WAN: clock rate (bps) — DCE side must set it */
  clockRate: number | null;
  /** Named ACL applied inbound / outbound (standard numbered ACL) */
  aclIn: number | null;
  aclOut: number | null;
};

export type AclAction = "permit" | "deny";
export type AclProtocol = "ip" | "icmp" | "any";

/** Cisco-like numbered ACL entry (standard/extended simplified) */
export type AclAce = {
  sequence: number;
  action: AclAction;
  protocol: AclProtocol;
  /** "any" or host IP */
  source: string;
  destination: string;
};

export type AccessList = {
  id: number;
  aces: AclAce[];
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

export type ArpEntry = {
  ip: string;
  mac: string;
  ifaceId: string;
  type: "dynamic" | "static";
  ageSec?: number;
};

export type StaticRoute = {
  network: string;
  mask: string;
  nextHop: string;
  /** Optional outbound interface name */
  outIface?: string | null;
};

export type InstalledModule = {
  id: string;
  kind: string;
  slot: number;
};

export type WifiSecurity = "open" | "wpa2";

/** Broadcast Wi‑Fi settings on AP / wireless router */
export type WifiRadio = {
  ssid: string;
  security: WifiSecurity;
  password: string;
  channel: number;
  enabled: boolean;
  band: "2.4" | "5";
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
  /** Physical modules (NIC, WIC, uplink…) */
  modules: InstalledModule[];
  /** Max module slots */
  slots: number;
  /** Powered on — modules can change when off (PT-style) */
  powered: boolean;
  /** Wi‑Fi radio (AP / WRT / home router) */
  wifi?: WifiRadio;
  /** Server / router services (DHCP, DNS, HTTP…) */
  services?: DeviceServices;
  /** Numbered ACLs on routers / firewalls */
  accessLists?: AccessList[];
  /** Host / router ARP cache */
  arpTable?: ArpEntry[];
  /** Router static routes (ip route) */
  routes?: StaticRoute[];
};

export type DhcpLease = {
  mac: string;
  ip: string;
  deviceId: string;
  ifaceId: string;
};

/** Pool DHCP stile PT (Pool Name, Gateway, DNS, Start IP, Mask, Max Users) */
export type DhcpPool = {
  name: string;
  gateway: string;
  dns: string;
  startIp: string;
  mask: string;
  maxUsers: number;
  leases: DhcpLease[];
  /** serverPool non rimovibile */
  locked?: boolean;
};

export type DhcpService = {
  enabled: boolean;
  pools: DhcpPool[];
};

export type DnsRecordType = "A" | "CNAME" | "NS" | "SOA";

export type DnsRecord = {
  name: string;
  type?: DnsRecordType;
  ip?: string;
  target?: string;
};

export type HttpService = {
  enabled: boolean;
  https?: boolean;
  pages: { name: string; body: string }[];
};

export type ServerUser = { username: string; password: string };

export type EmailService = {
  enabled: boolean;
  smtp: boolean;
  pop3: boolean;
  domain: string;
  users: ServerUser[];
};

export type FtpPermissions = {
  write: boolean;
  read: boolean;
  delete: boolean;
  rename: boolean;
  list: boolean;
};

export type FtpAccount = ServerUser & { permissions: FtpPermissions };

export type FtpService = {
  enabled: boolean;
  accounts: FtpAccount[];
  files: { name: string; size: number }[];
};

export type AaaClient = {
  name: string;
  ip: string;
  secret: string;
  type: "radius" | "tacacs";
};

export type AaaService = {
  enabled: boolean;
  clients: AaaClient[];
  users: ServerUser[];
};

export type TftpService = {
  enabled: boolean;
  images: { name: string; sizeKb: number }[];
};

export type SyslogEntry = {
  time: string;
  hostname: string;
  message: string;
};

export type SyslogService = {
  enabled: boolean;
  entries: SyslogEntry[];
};

export type NtpService = {
  enabled: boolean;
  /** ISO date/time o sync host */
  datetime: string;
  authEnabled: boolean;
  authKey: string;
  authPassword: string;
};

export type ServerAlgorithm = {
  useGlobal: boolean;
  maxConnections: number;
  maxSessions: number;
  retransmitMs: number;
};

/** Servizi Server-PT — https://tutorials.ptnetacad.net/help/default/config_servers.htm */
export type DeviceServices = {
  displayName?: string;
  gateway?: string;
  dnsServer?: string;
  ipv4Mode?: "static" | "dhcp";
  algorithm?: ServerAlgorithm;
  dhcp?: DhcpService;
  dns?: { enabled: boolean; records: DnsRecord[]; cache?: { name: string; ip: string }[] };
  http?: HttpService;
  email?: EmailService;
  ftp?: FtpService;
  aaa?: AaaService;
  tftp?: TftpService;
  syslog?: SyslogService;
  ntp?: NtpService;
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
  // End
  pc: { label: "PC", category: "end", ports: 1, hasOs: true, ptModel: "PC-PT" },
  laptop: { label: "Laptop", category: "end", ports: 1, hasOs: true, ptModel: "Laptop-PT" },
  server: { label: "Server", category: "end", ports: 1, hasOs: true, ptModel: "Server-PT" },
  meraki_server: { label: "Meraki Server", category: "end", ports: 1, hasOs: true, ptModel: "Meraki-Server-PT" },
  network_controller: { label: "Network Controller", category: "end", ports: 1, hasOs: false, ptModel: "Network-Controller" },
  printer: { label: "Printer", category: "end", ports: 1, hasOs: false, ptModel: "Printer-PT" },
  ip_phone: { label: "IP Phone", category: "end", ports: 2, hasOs: false, ptModel: "IP-Phone-7960" },
  voip_device: { label: "VoIP Device", category: "end", ports: 1, hasOs: false, ptModel: "VoIP-Device" },
  analog_phone: { label: "Phone", category: "end", ports: 1, hasOs: false, ptModel: "Analog-Phone-PT" },
  tv: { label: "TV", category: "end", ports: 1, hasOs: false, ptModel: "TV-PT" },
  tablet: { label: "Tablet", category: "end", ports: 1, hasOs: false, ptModel: "TabletPC-PT" },
  smartphone: { label: "Smart Phone", category: "end", ports: 1, hasOs: false, ptModel: "SMARTPHONE-PT" },
  generic_wireless: { label: "Generic Wireless", category: "end", ports: 1, hasOs: false, ptModel: "Generic-Wireless" },
  generic_wired: { label: "Generic Wired", category: "end", ports: 1, hasOs: false, ptModel: "Generic-Wired" },
  sniffer: { label: "Sniffer", category: "end", ports: 1, hasOs: false, ptModel: "Sniffer" },
  // Hubs
  hub: { label: "PT-Hub", category: "switch", ports: 8, hasOs: false, ptModel: "Hub-PT" },
  repeater: { label: "PT-Repeater", category: "switch", ports: 2, hasOs: false, ptModel: "Repeater-PT" },
  coaxial_splitter: { label: "Coaxial Splitter", category: "wan", ports: 3, hasOs: false, ptModel: "Coaxial-Splitter" },
  // Switches
  bridge: { label: "PT-Bridge", category: "switch", ports: 2, hasOs: false, ptModel: "Bridge-PT" },
  switch: { label: "PT-Switch", category: "switch", ports: 8, hasOs: false, ptModel: "Switch-PT" },
  switch_empty: { label: "PT-Empty", category: "switch", ports: 0, hasOs: false, ptModel: "Switch-PT-Empty" },
  switch_2950: { label: "2950-24", category: "switch", ports: 24, hasOs: false, ptModel: "2950-24" },
  switch_2950t: { label: "2950T", category: "switch", ports: 26, hasOs: false, ptModel: "2950T-24" },
  switch_2960: { label: "2960", category: "switch", ports: 26, hasOs: false, ptModel: "2960-24TT" },
  switch_3560: { label: "3560 24PS", category: "switch", ports: 26, hasOs: false, ptModel: "3560-24PS" },
  switch_3650: { label: "3650 24PS", category: "switch", ports: 26, hasOs: false, ptModel: "3650-24PS" },
  switch_ie2000: { label: "IE 2000", category: "switch", ports: 10, hasOs: false, ptModel: "IE-2000" },
  switch_ie3400: { label: "IE-3400", category: "switch", ports: 10, hasOs: false, ptModel: "IE-3400" },
  switch_ie9320: { label: "IE-9320", category: "switch", ports: 24, hasOs: false, ptModel: "IE-9320" },
  multilayer_switch: { label: "3560 24PS", category: "switch", ports: 26, hasOs: false, ptModel: "3560-24PS" },
  // Routers
  router: { label: "PT-Router", category: "router", ports: 2, hasOs: false, ptModel: "Router-PT" },
  router_empty: { label: "PT-Empty", category: "router", ports: 0, hasOs: false, ptModel: "Router-PT-Empty" },
  router_pt8200: { label: "PT8200", category: "router", ports: 2, hasOs: false, ptModel: "PT8200" },
  router_1841: { label: "1841", category: "router", ports: 2, hasOs: false, ptModel: "1841" },
  router_1941: { label: "1941", category: "router", ports: 2, hasOs: false, ptModel: "1941" },
  router_2620xm: { label: "2620XM", category: "router", ports: 2, hasOs: false, ptModel: "2620XM" },
  router_2621xm: { label: "2621XM", category: "router", ports: 2, hasOs: false, ptModel: "2621XM" },
  router_2811: { label: "2811", category: "router", ports: 2, hasOs: false, ptModel: "2811" },
  router_2901: { label: "2901", category: "router", ports: 2, hasOs: false, ptModel: "2901" },
  router_2911: { label: "2911", category: "router", ports: 3, hasOs: false, ptModel: "2911" },
  router_4321: { label: "4321", category: "router", ports: 2, hasOs: false, ptModel: "ISR4321" },
  router_4331: { label: "4331", category: "router", ports: 3, hasOs: false, ptModel: "ISR4331" },
  router_819iox: { label: "819IOX", category: "router", ports: 2, hasOs: false, ptModel: "C819G-4G-IOX" },
  router_819hgw: { label: "819HGW", category: "router", ports: 2, hasOs: false, ptModel: "C819HGW" },
  router_829: { label: "829", category: "router", ports: 2, hasOs: false, ptModel: "IR829" },
  router_1240: { label: "1240", category: "router", ports: 2, hasOs: false, ptModel: "IR1240" },
  router_ir1101: { label: "IR1101", category: "router", ports: 2, hasOs: false, ptModel: "IR1101" },
  router_ir8340: { label: "IR8340", category: "router", ports: 3, hasOs: false, ptModel: "IR8340" },
  wireless_router: { label: "WRT300N", category: "router", ports: 5, hasOs: false, ptModel: "Linksys-WRT300N" },
  home_router: { label: "Home Router", category: "router", ports: 5, hasOs: false, ptModel: "HomeRouter-PT" },
  home_gateway: { label: "Home Gateway", category: "router", ports: 5, hasOs: false, ptModel: "Home-Gateway" },
  // Wireless
  access_point: { label: "AP-PT", category: "other", ports: 1, hasOs: false, ptModel: "AccessPoint-PT" },
  ap_a: { label: "AP-PT-A", category: "other", ports: 1, hasOs: false, ptModel: "AccessPoint-PT-A" },
  ap_ac: { label: "AP-PT-AC", category: "other", ports: 1, hasOs: false, ptModel: "AccessPoint-PT-AC" },
  ap_n: { label: "AP-PT-N", category: "other", ports: 1, hasOs: false, ptModel: "AccessPoint-PT-N" },
  ap_3702i: { label: "3702i", category: "other", ports: 1, hasOs: false, ptModel: "AIR-CAP3702I" },
  lap: { label: "LAP-PT", category: "other", ports: 1, hasOs: false, ptModel: "LAP-PT" },
  meraki_ap: { label: "Meraki", category: "other", ports: 1, hasOs: false, ptModel: "Meraki-MR" },
  wlc: { label: "WLC", category: "other", ports: 2, hasOs: false, ptModel: "WLC-PT" },
  wlc_2504: { label: "2504", category: "other", ports: 2, hasOs: false, ptModel: "AIR-CT2504" },
  wlc_3504: { label: "3504", category: "other", ports: 2, hasOs: false, ptModel: "AIR-CT3504" },
  cell_tower: { label: "Cell Tower", category: "wan", ports: 1, hasOs: false, ptModel: "Cell-Tower" },
  // Security / WAN
  firewall_asa5505: { label: "5505", category: "router", ports: 3, hasOs: false, ptModel: "ASA5505" },
  firewall_asa5506: { label: "5506", category: "router", ports: 4, hasOs: false, ptModel: "ASA5506-X" },
  firewall_isa3000: { label: "ISA3000", category: "router", ports: 4, hasOs: false, ptModel: "ISA-3000" },
  cyber_observer: { label: "Cyber Observer", category: "other", ports: 1, hasOs: false, ptModel: "Cyber-Observer" },
  modem_dsl: { label: "DSL Modem", category: "wan", ports: 2, hasOs: false, ptModel: "DSL-Modem-PT" },
  modem_cable: { label: "Cable Modem", category: "wan", ports: 2, hasOs: false, ptModel: "Cable-Modem-PT" },
  cloud: { label: "PT-Cloud", category: "wan", ports: 4, hasOs: false, ptModel: "Cloud-PT" },
  cloud_empty: { label: "PT-Empty", category: "wan", ports: 0, hasOs: false, ptModel: "Cloud-PT-Empty" },
  co_server: { label: "CO Server", category: "wan", ports: 2, hasOs: false, ptModel: "Central-Office-Server" },
};

/** Managed Cisco-like switch (VLAN / MAC table / switchport) */
export function isManagedSwitch(type: DeviceKind): boolean {
  return (
    type === "switch" ||
    type.startsWith("switch_") ||
    type === "multilayer_switch"
  );
}

export function isAccessPoint(type: DeviceKind): boolean {
  return (
    type === "access_point" ||
    type === "ap_a" ||
    type === "ap_ac" ||
    type === "ap_n" ||
    type === "ap_3702i" ||
    type === "lap" ||
    type === "meraki_ap"
  );
}

export function isWifiCapable(type: DeviceKind): boolean {
  return (
    isAccessPoint(type) ||
    type === "wireless_router" ||
    type === "home_router" ||
    type === "home_gateway"
  );
}

/** Floods frames at L2 (hubs, switches, AP, cloud…) */
export function isL2Bridge(type: DeviceKind): boolean {
  return (
    type === "hub" ||
    type === "bridge" ||
    type === "repeater" ||
    type === "coaxial_splitter" ||
    isManagedSwitch(type) ||
    isAccessPoint(type) ||
    type === "cloud" ||
    type === "cloud_empty" ||
    type === "cell_tower"
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
    type === "home_gateway" ||
    type.startsWith("firewall_") ||
    type === "multilayer_switch" ||
    type === "switch_3560" ||
    type === "switch_3650" ||
    type === "switch_ie3400" ||
    type === "switch_ie9320" ||
    type === "wlc" ||
    type === "wlc_2504" ||
    type === "wlc_3504" ||
    type === "modem_dsl" ||
    type === "modem_cable"
  );
}

export function isEndHost(type: DeviceKind): boolean {
  return DEVICE_META[type].category === "end";
}

export function iconFamily(type: DeviceKind): string {
  if (type === "pc" || type === "tablet" || type === "generic_wired") return "pc";
  if (type === "laptop") return "laptop";
  if (
    type === "server" ||
    type === "meraki_server" ||
    type === "network_controller" ||
    type === "co_server" ||
    type === "cyber_observer"
  )
    return "server";
  if (type === "printer") return "printer";
  if (
    type === "ip_phone" ||
    type === "analog_phone" ||
    type === "voip_device" ||
    type === "smartphone"
  )
    return "phone";
  if (type === "tv") return "tv";
  if (type === "sniffer") return "sniffer";
  if (type === "hub" || type === "repeater") return "hub";
  if (type === "bridge") return "bridge";
  if (type === "coaxial_splitter") return "modem";
  if (type.startsWith("switch") || type === "multilayer_switch") return "switch";
  if (type.startsWith("firewall")) return "firewall";
  if (
    type === "wireless_router" ||
    type === "home_router" ||
    type === "home_gateway"
  )
    return "wifi";
  if (
    isAccessPoint(type) ||
    type === "wlc" ||
    type === "wlc_2504" ||
    type === "wlc_3504" ||
    type === "generic_wireless"
  )
    return "ap";
  if (type === "cell_tower") return "tower";
  if (type.startsWith("modem")) return "modem";
  if (type === "cloud" || type === "cloud_empty") return "cloud";
  return "router";
}
