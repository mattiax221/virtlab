import { routerAllowsIcmp } from "./acl";
import { learnArp } from "./arp";
import { inferCable, type CableKind } from "./catalog";
import { getDevice, getIface } from "./engine-helpers";
import { hostFirewallBlocks } from "./hostFirewall";
import { formatIp, isValidIp, parseIp, parseMask, sameSubnet } from "./ip";
import { l2Flood } from "./l2";
import {
  availableModulesFor,
  defaultModulesFor,
  interfacesFromModules,
  isModuleRemovable,
  MODULE_CATALOG,
  slotCountFor,
  type ModuleKind,
} from "./modules";
import { defaultServerServices, requestDhcp, resolveDnsName } from "./services";
import { recomputeStp } from "./stp";
import { appendSyslog } from "./telemetry";
import {
  DEVICE_META,
  defaultVlans,
  isEndHost,
  isL3Device,
  isManagedSwitch,
  isWifiCapable,
  type Device,
  type DeviceKind,
  type InstalledModule,
  type InterfaceConfig,
  type LabState,
  type Link,
  type PingHop,
  type PingResult,
  type StaticRoute,
} from "./types";

export { getDevice, getIface };
export { availableModulesFor, MODULE_CATALOG, isModuleRemovable };

let idCounter = 0;
export function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function createDevice(
  type: DeviceKind,
  name: string,
  x: number,
  y: number,
): Device {
  const id = uid(type);
  const modules = defaultModulesFor(type, id, uid);
  const device: Device = {
    id,
    type,
    name,
    x,
    y,
    modules,
    slots: slotCountFor(type),
    powered: true,
    interfaces: interfacesFromModules(type, id, modules as InstalledModule[], uid),
    osSlot: DEVICE_META[type].hasOs ? id : undefined,
  };
  if (isManagedSwitch(type)) {
    device.vlans = defaultVlans().filter((v) => v.id === 1);
    device.macTable = [];
  }
  if (isWifiCapable(type)) {
    device.wifi = {
      ssid: `NetLab-${name}`,
      security: "wpa2",
      password: "cisco123",
      channel: 6,
      enabled: true,
      band: "2.4",
    };
  }
  if (
    type === "pc" ||
    type === "laptop" ||
    type === "server" ||
    type === "meraki_server"
  ) {
    device.hostOs = "windows";
  }
  if (type === "server" || type === "meraki_server") {
    device.services = defaultServerServices(name);
    // IP statico tipico Server-PT sulla prima Ethernet
    const eth0 = device.interfaces.find((i) => i.media === "ethernet");
    if (eth0) {
      eth0.ip = "192.168.1.100";
      eth0.mask = "255.255.255.0";
      eth0.gateway = "192.168.1.1";
      eth0.dnsServers = ["192.168.1.100"];
      eth0.dhcpClient = false;
    }
  }
  if (isL3Device(type) || type.startsWith("firewall")) {
    device.accessLists = [];
  }
  return device;
}

/** Drop links attached to removed interfaces */
function pruneLinksForDevice(state: LabState, deviceId: string, keepIfaceIds: Set<string>): LabState {
  const dropLinkIds = new Set<string>();
  const device = getDevice(state, deviceId);
  if (!device) return state;
  for (const iface of device.interfaces) {
    if (!keepIfaceIds.has(iface.id) && iface.connectedLinkId) {
      dropLinkIds.add(iface.connectedLinkId);
    }
  }
  if (dropLinkIds.size === 0) return state;
  let next = state;
  for (const lid of dropLinkIds) next = deleteLink(next, lid);
  return next;
}

export function setDevicePower(
  state: LabState,
  deviceId: string,
  powered: boolean,
): LabState {
  const device = getDevice(state, deviceId);
  let next: LabState = {
    ...state,
    devices: state.devices.map((d) =>
      d.id === deviceId ? { ...d, powered } : d,
    ),
  };
  if (device) {
    next = appendSyslog(
      next,
      device.name,
      powered ? "%SYS-5-RESTART: System restarted" : "%SYS-5-POWEROFF: Power off",
    );
  }
  return next;
}

export function installModule(
  state: LabState,
  deviceId: string,
  kind: ModuleKind,
  slot?: number,
): { state: LabState; error?: string } {
  const device = getDevice(state, deviceId);
  if (!device) return { state, error: "Dispositivo non trovato." };
  if (device.powered) {
    return { state, error: "Spegni il dispositivo (Physical) prima di cambiare i moduli." };
  }
  const allowed = availableModulesFor(device.type);
  if (!allowed.includes(kind)) {
    return { state, error: "Questo modulo non è compatibile." };
  }
  const used = new Set(device.modules.map((m) => m.slot));
  let target = slot;
  if (target == null) {
    for (let i = 0; i < device.slots; i++) {
      if (!used.has(i)) {
        target = i;
        break;
      }
    }
  }
  if (target == null || used.has(target)) {
    return { state, error: "Nessuno slot libero." };
  }
  if (target < 0 || target >= device.slots) {
    return { state, error: "Slot non valido." };
  }
  const mod: InstalledModule = { id: uid("mod"), kind, slot: target };
  const modules = [...device.modules, mod];
  const interfaces = interfacesFromModules(
    device.type,
    device.id,
    modules,
    uid,
    device.interfaces,
  );
  return {
    state: {
      ...state,
      devices: state.devices.map((d) =>
        d.id === deviceId ? { ...d, modules, interfaces } : d,
      ),
    },
  };
}

export function removeModule(
  state: LabState,
  deviceId: string,
  moduleId: string,
): { state: LabState; error?: string } {
  const device = getDevice(state, deviceId);
  if (!device) return { state, error: "Dispositivo non trovato." };
  if (device.powered) {
    return { state, error: "Spegni il dispositivo prima di rimuovere moduli." };
  }
  const mod = device.modules.find((m) => m.id === moduleId);
  if (!mod) return { state, error: "Modulo non trovato." };
  if (!isModuleRemovable(mod as { id: string; kind: ModuleKind; slot: number }, device.type)) {
    return { state, error: "Questo modulo non è rimovibile." };
  }
  const modules = device.modules.filter((m) => m.id !== moduleId);
  const interfaces = interfacesFromModules(
    device.type,
    device.id,
    modules,
    uid,
    device.interfaces.filter((i) => i.moduleId !== moduleId),
  );
  const keep = new Set(interfaces.map((i) => i.id));
  let next: LabState = {
    ...state,
    devices: state.devices.map((d) =>
      d.id === deviceId ? { ...d, modules, interfaces } : d,
    ),
  };
  next = pruneLinksForDevice(next, deviceId, keep);
  // Re-apply interfaces after link prune (connectedLinkId cleared)
  const d2 = getDevice(next, deviceId)!;
  const ifaces2 = d2.interfaces.map((i) =>
    i.connectedLinkId &&
    !next.links.some((l) => l.id === i.connectedLinkId)
      ? { ...i, connectedLinkId: null }
      : i,
  );
  next = {
    ...next,
    devices: next.devices.map((d) =>
      d.id === deviceId ? { ...d, interfaces: ifaces2 } : d,
    ),
  };
  return { state: next };
}

export function createSubinterface(
  state: LabState,
  deviceId: string,
  parentIfaceId: string,
  vlanTag: number,
): { state: LabState; iface?: InterfaceConfig; error?: string } {
  const device = getDevice(state, deviceId);
  if (!device) return { state, error: "Dispositivo non trovato." };
  const parent = getIface(device, parentIfaceId);
  if (!parent || parent.parentIfaceId) {
    return { state, error: "Interfaccia padre non valida." };
  }
  if (!Number.isInteger(vlanTag) || vlanTag < 1 || vlanTag > 4094) {
    return { state, error: "VLAN tag non valido." };
  }
  const name = `${parent.name}.${vlanTag}`;
  if (device.interfaces.some((i) => i.name.toLowerCase() === name.toLowerCase())) {
    const existing = device.interfaces.find(
      (i) => i.name.toLowerCase() === name.toLowerCase(),
    )!;
    return { state, iface: existing };
  }
  const iface: InterfaceConfig = {
    id: uid("if"),
    name,
    ip: null,
    mask: null,
    gateway: null,
    mac: parent.mac,
    connectedLinkId: null, // uses parent link
    enabled: true,
    mode: "access",
    accessVlan: vlanTag,
    nativeVlan: 1,
    allowedVlans: "all",
    media: parent.media,
    moduleId: parent.moduleId,
    parentIfaceId: parent.id,
    vlanTag,
    dhcpClient: false,
    dnsServers: [],
    clockRate: null,
    aclIn: null,
    aclOut: null,
  };
  return {
    state: {
      ...state,
      devices: state.devices.map((d) =>
        d.id === deviceId
          ? { ...d, interfaces: [...d.interfaces, iface] }
          : d,
      ),
    },
    iface,
  };
}

export function createEmptyLab(): LabState {
  return { devices: [], links: [] };
}

export function createDemoLab(): LabState {
  const pc1 = createDevice("pc", "PC0", 100, 200);
  const pc2 = createDevice("pc", "PC1", 280, 80);
  const server = createDevice("server", "Server0", 480, 80);
  const printer = createDevice("printer", "Printer0", 100, 80);
  const sw = createDevice("switch_2960", "Switch0", 300, 220);
  const rtr = createDevice("router_2911", "Router0", 300, 380);
  const modem = createDevice("modem_cable", "CableModem0", 500, 380);
  const cloud = createDevice("cloud", "Internet", 680, 380);

  // Ethernet is interfaces[0]; leave PC1 on DHCP for demo of auto-IP
  pc1.interfaces[0].ip = "192.168.1.10";
  pc1.interfaces[0].mask = "255.255.255.0";
  pc1.interfaces[0].gateway = "192.168.1.1";
  pc1.interfaces[0].dnsServers = ["192.168.1.100"];
  printer.interfaces[0].ip = "192.168.1.50";
  printer.interfaces[0].mask = "255.255.255.0";
  printer.interfaces[0].gateway = "192.168.1.1";
  server.interfaces[0].ip = "192.168.1.100";
  server.interfaces[0].mask = "255.255.255.0";
  server.interfaces[0].gateway = "192.168.1.1";
  if (server.services?.dhcp?.pools?.[0]) {
    server.services.dhcp.pools[0].dns = "192.168.1.100";
  }
  rtr.interfaces[0].ip = "192.168.1.1";
  rtr.interfaces[0].mask = "255.255.255.0";
  rtr.interfaces[1].ip = "10.0.0.2";
  rtr.interfaces[1].mask = "255.255.255.252";
  modem.interfaces[0].ip = "10.0.0.1";
  modem.interfaces[0].mask = "255.255.255.252";

  const linksSpec: [Device, number, Device, number][] = [
    [pc1, 0, sw, 0],
    [pc2, 0, sw, 1],
    [server, 0, sw, 2],
    [printer, 0, sw, 3],
    [rtr, 0, sw, 4],
    [rtr, 1, modem, 0],
    [modem, 1, cloud, 0],
  ];

  const links: Link[] = [];
  for (const [a, ai, b, bi] of linksSpec) {
    const media = inferCable(a.type, b.type);
    const link: Link = {
      id: uid("link"),
      aDeviceId: a.id,
      aIfaceId: a.interfaces[ai].id,
      bDeviceId: b.id,
      bIfaceId: b.interfaces[bi].id,
      media,
    };
    a.interfaces[ai].connectedLinkId = link.id;
    b.interfaces[bi].connectedLinkId = link.id;
    links.push(link);
  }

  return {
    devices: [pc1, pc2, server, printer, sw, rtr, modem, cloud],
    links,
  };
}

export function getFreeIface(device: Device): InterfaceConfig | undefined {
  return device.interfaces.find(
    (i) => !i.connectedLinkId && !i.parentIfaceId && i.enabled,
  );
}

function ifaceLinkCompatible(
  a: InterfaceConfig,
  b: InterfaceConfig,
  media: CableKind,
): string | null {
  // Wireless association requires Wi‑Fi on BOTH ends (PC↔AP), never copper to switch
  if (media === "wireless" || a.media === "wireless" || b.media === "wireless") {
    if (a.media !== "wireless" || b.media !== "wireless") {
      return "Wi‑Fi solo tra due porte wireless (es. PC ↔ Access Point). Per lo switch usa Ethernet.";
    }
    if (media !== "wireless" && media !== "auto") {
      return "Porta Wi‑Fi: usa associazione Wireless.";
    }
  }
  if (
    (a.media === "serial" || b.media === "serial") &&
    media !== "serial" &&
    media !== "auto"
  ) {
    return "Porte seriali richiedono cavo Serial.";
  }
  if (a.media === "serial" && b.media !== "serial") {
    return "Serial va collegata a un’altra porta Serial.";
  }
  if (b.media === "serial" && a.media !== "serial") {
    return "Serial va collegata a un’altra porta Serial.";
  }
  return null;
}

export function freePhysicalPorts(device: Device): InterfaceConfig[] {
  return device.interfaces.filter(
    (i) => !i.connectedLinkId && !i.parentIfaceId && i.enabled,
  );
}

export function connectDevices(
  state: LabState,
  aId: string,
  bId: string,
  cable: CableKind = "auto",
  opts?: { aIfaceId?: string; bIfaceId?: string },
): { state: LabState; error?: string } {
  if (aId === bId) return { state, error: "Non puoi collegare un dispositivo a se stesso." };
  const a = getDevice(state, aId);
  const b = getDevice(state, bId);
  if (!a || !b) return { state, error: "Dispositivo non trovato." };

  const aFree = freePhysicalPorts(a);
  const bFree = freePhysicalPorts(b);
  if (!aFree.length || !bFree.length) {
    return { state, error: "Nessuna porta libera su uno dei due dispositivi." };
  }

  let media = cable === "auto" ? inferCable(a.type, b.type) : cable;
  let aIf =
    (opts?.aIfaceId
      ? a.interfaces.find((i) => i.id === opts.aIfaceId)
      : undefined) ?? aFree[0];
  let bIf =
    (opts?.bIfaceId
      ? b.interfaces.find((i) => i.id === opts.bIfaceId)
      : undefined) ?? bFree[0];

  if (opts?.aIfaceId) {
    if (!aIf || aIf.connectedLinkId || aIf.parentIfaceId || !aIf.enabled) {
      return { state, error: "Porta sorgente non disponibile." };
    }
  }
  if (opts?.bIfaceId) {
    if (!bIf || bIf.connectedLinkId || bIf.parentIfaceId || !bIf.enabled) {
      return { state, error: "Porta destinazione non disponibile." };
    }
  }

  // Auto-pick matching media only when ports were not chosen explicitly
  if (!opts?.aIfaceId && !opts?.bIfaceId) {
    // Prefer copper/ethernet for normal LAN; wireless ONLY if both ends are Wi‑Fi
    const aw = aFree.find((i) => i.media === "wireless");
    const bw = bFree.find((i) => i.media === "wireless");
    const ae = aFree.find(
      (i) => i.media === "ethernet" || i.media === "fiber",
    );
    const be = bFree.find(
      (i) => i.media === "ethernet" || i.media === "fiber",
    );
    if (cable === "wireless") {
      if (!aw || !bw) {
        return { state, error: "Associazione Wi‑Fi: servono porte wireless su entrambi." };
      }
      aIf = aw;
      bIf = bw;
      media = "wireless";
    } else if (cable === "serial" || media === "serial") {
      const as = aFree.find((i) => i.media === "serial");
      const bs = bFree.find((i) => i.media === "serial");
      if (as) aIf = as;
      if (bs) bIf = bs;
      if (as || bs) media = "serial";
    } else if (cable === "auto" && aw && bw && !ae && !be) {
      aIf = aw;
      bIf = bw;
      media = "wireless";
    } else {
      if (ae) aIf = ae;
      if (be) bIf = be;
    }
  } else {
    // Infer media from chosen ports when cable is auto
    if (cable === "auto") {
      if (aIf.media === "serial" || bIf.media === "serial") media = "serial";
      else if (aIf.media === "wireless" && bIf.media === "wireless")
        media = "wireless";
      else if (aIf.media === "fiber" || bIf.media === "fiber") media = "fiber";
      else if (aIf.media === "coaxial" || bIf.media === "coaxial")
        media = "coaxial";
      else if (aIf.media === "phone" || bIf.media === "phone") media = "phone";
      else media = inferCable(a.type, b.type);
    }
  }

  const compat = ifaceLinkCompatible(aIf, bIf, media);
  if (compat) return { state, error: compat };

  // Cavo sbagliato: si collega lo stesso → LED rosso via evaluateLink, senza L2

  const link: Link = {
    id: uid("link"),
    aDeviceId: a.id,
    aIfaceId: aIf.id,
    bDeviceId: b.id,
    bIfaceId: bIf.id,
    media,
  };

  let next: LabState = {
    devices: state.devices.map((d) => {
      if (d.id === a.id) {
        return {
          ...d,
          interfaces: d.interfaces.map((i) =>
            i.id === aIf.id ? { ...i, connectedLinkId: link.id } : i,
          ),
        };
      }
      if (d.id === b.id) {
        return {
          ...d,
          interfaces: d.interfaces.map((i) =>
            i.id === bIf.id ? { ...i, connectedLinkId: link.id } : i,
          ),
        };
      }
      return d;
    }),
    links: [...state.links, link],
  };

  // DHCP renew automatico su host Ethernet collegati (LAN del nuovo cavo)
  {
    const flood = l2Flood(next, a.id);
    next = flood.state;
    const seen = new Set<string>();
    const tryDhcp = (deviceId: string, ifaceId: string) => {
      const key = `${deviceId}:${ifaceId}`;
      if (seen.has(key)) return;
      seen.add(key);
      const d = getDevice(next, deviceId);
      if (!d || !isEndHost(d.type)) return;
      const iface = d.interfaces.find((i) => i.id === ifaceId);
      if (!iface || !iface.connectedLinkId) return;
      if (iface.media === "wireless" || iface.media === "serial") return;
      if (iface.ip && !iface.dhcpClient) return;
      const dhcp = requestDhcp(next, deviceId, ifaceId);
      next = dhcp.state;
    };
    tryDhcp(a.id, aIf.id);
    tryDhcp(b.id, bIf.id);
    for (const d of next.devices) {
      if (!isEndHost(d.type)) continue;
      for (const i of d.interfaces) {
        if (i.connectedLinkId) tryDhcp(d.id, i.id);
      }
    }
  }

  next = appendSyslog(
    next,
    a.name,
    `LINK-UP: ${aIf.name} connected to ${b.name} ${bIf.name} (${media})`,
  );
  next = recomputeStp(next);

  return { state: next };
}

export function deleteDevice(state: LabState, deviceId: string): LabState {
  const linkIds = new Set(
    state.links
      .filter((l) => l.aDeviceId === deviceId || l.bDeviceId === deviceId)
      .map((l) => l.id),
  );
  const links = state.links.filter((l) => !linkIds.has(l.id));
  const devices = state.devices
    .filter((d) => d.id !== deviceId)
    .map((d) => ({
      ...d,
      interfaces: d.interfaces.map((i) =>
        i.connectedLinkId && linkIds.has(i.connectedLinkId)
          ? { ...i, connectedLinkId: null }
          : i,
      ),
    }));
  return { devices, links };
}

export function deleteLink(state: LabState, linkId: string): LabState {
  const links = state.links.filter((l) => l.id !== linkId);
  const devices = state.devices.map((d) => ({
    ...d,
    interfaces: d.interfaces.map((i) =>
      i.connectedLinkId === linkId ? { ...i, connectedLinkId: null } : i,
    ),
  }));
  return recomputeStp({ devices, links });
}

export function updateIface(
  state: LabState,
  deviceId: string,
  ifaceId: string,
  patch: Partial<
    Pick<
      InterfaceConfig,
      | "ip"
      | "mask"
      | "gateway"
      | "enabled"
      | "mode"
      | "accessVlan"
      | "nativeVlan"
      | "allowedVlans"
      | "vlanTag"
      | "dhcpClient"
      | "dnsServers"
      | "clockRate"
      | "aclIn"
      | "aclOut"
    >
  >,
): LabState {
  return {
    ...state,
    devices: state.devices.map((d) => {
      if (d.id !== deviceId) return d;
      return {
        ...d,
        interfaces: d.interfaces.map((i) =>
          i.id === ifaceId ? { ...i, ...patch } : i,
        ),
      };
    }),
  };
}

export function updateDevice(
  state: LabState,
  deviceId: string,
  patch: Partial<
    Pick<
      Device,
      | "name"
      | "hostOs"
      | "vlans"
      | "macTable"
      | "accessLists"
      | "services"
      | "arpTable"
      | "routes"
    >
  >,
): LabState {
  return {
    ...state,
    devices: state.devices.map((d) =>
      d.id === deviceId ? { ...d, ...patch } : d,
    ),
  };
}

export function moveDevice(
  state: LabState,
  deviceId: string,
  x: number,
  y: number,
): LabState {
  return {
    ...state,
    devices: state.devices.map((d) =>
      d.id === deviceId ? { ...d, x, y } : d,
    ),
  };
}

type Endpoint = { device: Device; iface: InterfaceConfig };

/** Choose the NIC that should originate traffic toward targetIp. */
function pickSourceIface(
  device: Device,
  targetIp: string,
): InterfaceConfig | null {
  const withIp = device.interfaces.filter(
    (i) => i.ip && i.mask && i.enabled && !i.parentIfaceId,
  );
  // 1) Connected iface whose subnet contains the target
  const connectedInSubnet = withIp.find(
    (i) =>
      i.connectedLinkId &&
      i.ip &&
      i.mask &&
      sameSubnet(i.ip, targetIp, i.mask),
  );
  if (connectedInSubnet) return connectedInSubnet;
  // 2) Any connected iface with IP (ethernet preferred)
  const connectedEth = withIp.find(
    (i) => i.connectedLinkId && (i.media === "ethernet" || i.media === "fiber"),
  );
  if (connectedEth) return connectedEth;
  const connectedAny = withIp.find((i) => i.connectedLinkId);
  if (connectedAny) return connectedAny;
  // 3) Subnet match even if unplugged (so we can give a clear error)
  const subnetMatch = withIp.find(
    (i) => i.ip && i.mask && sameSubnet(i.ip, targetIp, i.mask),
  );
  if (subnetMatch) return subnetMatch;
  return withIp[0] ?? null;
}

function findLocalRoute(device: Device, destIp: string): InterfaceConfig | null {
  for (const iface of device.interfaces) {
    if (!iface.ip || !iface.mask || !iface.enabled) continue;
    if (sameSubnet(iface.ip, destIp, iface.mask)) return iface;
  }
  return device.interfaces.find((i) => i.ip && i.mask && i.gateway && i.enabled) ?? null;
}

/**
 * Discover L2 hosts reachable from each router interface / subinterface
 * (router-on-a-stick: subiface uses parent trunk + vlanTag).
 */
function collectRouterDomains(
  state: LabState,
  router: Device,
): { hosts: Endpoint[]; state: LabState } {
  let next = state;
  const found: Endpoint[] = [];
  const seen = new Set<string>();

  for (const iface of router.interfaces) {
    if (!iface.enabled || !iface.ip || !iface.mask) continue;

    let peerDeviceId: string | null = null;
    let vlanHint: number | undefined;

    if (iface.parentIfaceId && iface.vlanTag != null) {
      const parent = getIface(router, iface.parentIfaceId);
      if (!parent?.connectedLinkId) continue;
      const link = next.links.find((l) => l.id === parent.connectedLinkId);
      if (!link || link.media === "console") continue;
      peerDeviceId =
        link.aDeviceId === router.id ? link.bDeviceId : link.aDeviceId;
      vlanHint = iface.vlanTag;
    } else if (iface.connectedLinkId) {
      const link = next.links.find((l) => l.id === iface.connectedLinkId);
      if (!link || link.media === "console") continue;
      // Serial WAN requires clock rate on at least one side (DCE)
      if (link.media === "serial" || iface.media === "serial") {
        const peer =
          link.aDeviceId === router.id
            ? getDevice(next, link.bDeviceId)
            : getDevice(next, link.aDeviceId);
        const peerIf = peer?.interfaces.find(
          (i) =>
            i.id ===
            (link.aDeviceId === router.id ? link.bIfaceId : link.aIfaceId),
        );
        const hasClock =
          (iface.clockRate != null && iface.clockRate > 0) ||
          (peerIf?.clockRate != null && peerIf.clockRate > 0);
        if (!hasClock) continue; // line protocol down
      }
      peerDeviceId =
        link.aDeviceId === router.id ? link.bDeviceId : link.aDeviceId;
    } else {
      continue;
    }

    const flood = l2Flood(next, peerDeviceId, {
      sourceMac: iface.mac,
      vlanHint,
    });
    next = flood.state;
    for (const h of flood.hosts) {
      // Only hosts on this connected subnet
      if (!h.iface.ip || !sameSubnet(iface.ip, h.iface.ip, iface.mask)) continue;
      if (!seen.has(h.iface.id)) {
        seen.add(h.iface.id);
        found.push(h);
      }
    }
  }
  for (const iface of router.interfaces) {
    if (iface.ip && iface.enabled) found.push({ device: router, iface });
  }
  return { hosts: found, state: next };
}

export function runPing(
  state: LabState,
  fromDeviceId: string,
  targetIp: string,
  count = 4,
): { result: PingResult; state: LabState } {
  const from = getDevice(state, fromDeviceId);
  if (!from) {
    return {
      state,
      result: {
        ok: false,
        fromIp: "",
        toIp: targetIp,
        hops: [],
        rttMs: 0,
        message: "Dispositivo sorgente non trovato.",
        packets: { sent: 0, received: 0, lost: 0 },
      },
    };
  }
  if (!from.powered) {
    return {
      state,
      result: failPing(
        "",
        targetIp,
        count,
        [],
        `${from.name} è spento (Physical → Accendi).`,
      ),
    };
  }

  // DNS name → IP
  if (!isValidIp(targetIp)) {
    const resolved = resolveDnsName(state, fromDeviceId, targetIp);
    if (!resolved) {
      return {
        state,
        result: failPing(
          "",
          targetIp,
          count,
          [],
          `Impossibile risolvere nome host: ${targetIp}`,
        ),
      };
    }
    targetIp = resolved;
  }

  // Prefer a connected iface that can reach the target subnet
  const srcIface =
    pickSourceIface(from, targetIp) ??
    from.interfaces.find((i) => i.ip && i.enabled) ??
    from.interfaces[0];
  const fromIp = srcIface?.ip ?? "";

  if (!srcIface?.ip || !srcIface.mask) {
    return {
      state,
      result: failPing(
        "",
        targetIp,
        count,
        [],
        "Richiesta scaduta.\n\nNessun IP. Configura Ethernet (non Wi‑Fi) con ipconfig /ip oppure Connessioni di rete.",
      ),
    };
  }
  if (!srcIface.connectedLinkId) {
    return {
      state,
      result: failPing(
        fromIp,
        targetIp,
        count,
        [],
        `Richiesta scaduta.\n\nL'IP ${fromIp} è su ${srcIface.name} ma quella porta non ha un cavo.\nCollega Ethernet allo switch (non la porta Wi‑Fi) e riprova.`,
      ),
    };
  }

  const blockedOut = hostFirewallBlocks(from, "out", "icmp", targetIp);
  if (blockedOut) {
    return {
      state,
      result: failPing(fromIp, targetIp, count, [], blockedOut),
    };
  }

  if (srcIface.ip === targetIp) {
    return {
      state,
      result: {
        ok: true,
        fromIp,
        toIp: targetIp,
        hops: [{ deviceId: from.id, deviceName: from.name, ip: fromIp }],
        rttMs: 1,
        message: buildPingOk(targetIp, count, 1),
        packets: { sent: count, received: count, lost: 0 },
      },
    };
  }

  const hops: PingHop[] = [
    { deviceId: from.id, deviceName: from.name, ip: fromIp },
  ];

  // VLAN-aware L2 flood + MAC learning; unicast se ARP già conosciuto
  const knownMac = from.arpTable?.find((e) => e.ip === targetIp)?.mac;
  const flood = l2Flood(state, from.id, {
    sourceMac: srcIface.mac,
    destMac: knownMac,
  });
  let nextState = flood.state;

  if (sameSubnet(srcIface.ip, targetIp, srcIface.mask)) {
    // Serial same-subnet: need clock on DCE
    if (srcIface.media === "serial") {
      const link = nextState.links.find((l) => l.id === srcIface.connectedLinkId);
      if (link) {
        const peerId =
          link.aDeviceId === from.id ? link.bDeviceId : link.aDeviceId;
        const peerIfId =
          link.aDeviceId === from.id ? link.bIfaceId : link.aIfaceId;
        const peer = getDevice(nextState, peerId);
        const peerIf = peer?.interfaces.find((i) => i.id === peerIfId);
        const hasClock =
          (srcIface.clockRate != null && srcIface.clockRate > 0) ||
          (peerIf?.clockRate != null && peerIf.clockRate > 0);
        if (!hasClock) {
          return {
            state: nextState,
            result: failPing(
              fromIp,
              targetIp,
              count,
              hops,
              "Serial: line protocol down (manca clock rate sul DCE).",
            ),
          };
        }
      }
    }
    const target = flood.hosts.find((e) => e.iface.ip === targetIp);
    if (!target) {
      return {
        state: nextState,
        result: failPing(
          fromIp,
          targetIp,
          count,
          hops,
          "Host non raggiungibile in questa VLAN (L2).",
        ),
      };
    }
    // Learn destination MAC on return path
    const back = l2Flood(nextState, target.device.id, {
      sourceMac: target.iface.mac,
    });
    nextState = back.state;
    nextState = learnArp(
      nextState,
      from.id,
      targetIp,
      target.iface.mac,
      srcIface.id,
    );
    nextState = learnArp(
      nextState,
      target.device.id,
      fromIp,
      srcIface.mac,
      target.iface.id,
    );
    hops.push({
      deviceId: target.device.id,
      deviceName: target.device.name,
      ip: targetIp,
    });
    const blockedIn = hostFirewallBlocks(
      target.device,
      "in",
      "icmp",
      fromIp,
    );
    if (blockedIn) {
      return {
        state: nextState,
        result: failPing(fromIp, targetIp, count, hops, blockedIn),
      };
    }
    const rtt = 2 + Math.floor(Math.random() * 4);
    return {
      state: nextState,
      result: {
        ok: true,
        fromIp,
        toIp: targetIp,
        hops,
        rttMs: rtt,
        message: buildPingOk(targetIp, count, rtt),
        packets: { sent: count, received: count, lost: 0 },
      },
    };
  }

  if (!srcIface.gateway) {
    return {
      state: nextState,
      result: failPing(fromIp, targetIp, count, hops, "Fuori rete: serve un gateway."),
    };
  }
  if (!sameSubnet(srcIface.ip, srcIface.gateway, srcIface.mask)) {
    return {
      state: nextState,
      result: failPing(fromIp, targetIp, count, hops, "Gateway non in subnet."),
    };
  }

  const gw = flood.hosts.find((e) => e.iface.ip === srcIface.gateway);
  if (!gw) {
    return {
      state: nextState,
      result: failPing(fromIp, targetIp, count, hops, "Gateway non raggiungibile."),
    };
  }

  hops.push({
    deviceId: gw.device.id,
    deviceName: gw.device.name,
    ip: srcIface.gateway,
  });
  nextState = learnArp(
    nextState,
    from.id,
    srcIface.gateway,
    gw.iface.mac,
    srcIface.id,
  );

  if (isL3Device(gw.device.type)) {
    const ingress =
      gw.iface ??
      findLocalRoute(gw.device, fromIp) ??
      gw.device.interfaces.find((i) => i.ip === srcIface.gateway) ??
      null;
    void findLocalRoute;
    let current = gw.device;
    const routed = collectRouterDomains(nextState, current);
    nextState = routed.state;
    let found = routed.hosts.find((e) => e.iface.ip === targetIp) ?? null;

    // Routing statico: ip route tra router (fino a 4 hop)
    for (let i = 0; !found && i < 4; i++) {
      const route = matchStaticRoute(current, targetIp);
      if (!route) break;
      const floodR = l2Flood(nextState, current.id, {
        sourceMac: current.interfaces.find((x) => x.ip)?.mac,
      });
      nextState = floodR.state;
      const nextHop = floodR.hosts.find((e) => e.iface.ip === route.nextHop);
      if (!nextHop || !isL3Device(nextHop.device.type)) break;
      nextState = learnArp(
        nextState,
        current.id,
        route.nextHop,
        nextHop.iface.mac,
        current.interfaces.find((x) => x.ip)?.id ?? nextHop.iface.id,
      );
      hops.push({
        deviceId: nextHop.device.id,
        deviceName: nextHop.device.name,
        ip: route.nextHop,
      });
      current = nextHop.device;
      const more = collectRouterDomains(nextState, current);
      nextState = more.state;
      found = more.hosts.find((e) => e.iface.ip === targetIp) ?? null;
    }

    if (!found) {
      return {
        state: nextState,
        result: failPing(fromIp, targetIp, count, hops, "Nessuna rotta."),
      };
    }
    const egress =
      findLocalRoute(current, targetIp) ??
      current.interfaces.find(
        (i) =>
          i.ip &&
          i.mask &&
          found!.iface.ip &&
          sameSubnet(i.ip, found!.iface.ip, i.mask),
      ) ??
      null;
    const acl = routerAllowsIcmp(
      current,
      ingress,
      egress,
      fromIp,
      targetIp,
    );
    if (!acl.ok) {
      return {
        state: nextState,
        result: failPing(
          fromIp,
          targetIp,
          count,
          hops,
          acl.reason ?? "Negato da ACL.",
        ),
      };
    }
    nextState = learnArp(
      nextState,
      current.id,
      targetIp,
      found.iface.mac,
      egress?.id ?? found.iface.id,
    );
    hops.push({
      deviceId: found.device.id,
      deviceName: found.device.name,
      ip: targetIp,
    });
    const blockedInL3 = hostFirewallBlocks(found.device, "in", "icmp", fromIp);
    if (blockedInL3) {
      return {
        state: nextState,
        result: failPing(fromIp, targetIp, count, hops, blockedInL3),
      };
    }
    const rtt = 8 + Math.floor(Math.random() * 12);
    return {
      state: nextState,
      result: {
        ok: true,
        fromIp,
        toIp: targetIp,
        hops,
        rttMs: rtt,
        message: buildPingOk(targetIp, count, rtt),
        packets: { sent: count, received: count, lost: 0 },
      },
    };
  }

  return {
    state: nextState,
    result: failPing(fromIp, targetIp, count, hops, "Richiesta scaduta."),
  };
}

function matchStaticRoute(
  router: Device,
  destIp: string,
): StaticRoute | null {
  const dest = parseIp(destIp);
  if (dest === null) return null;
  let best: StaticRoute | null = null;
  let bestPrefix = -1;
  for (const r of router.routes ?? []) {
    const net = parseIp(r.network);
    const mask = parseMask(r.mask);
    if (net === null || mask === null) continue;
    if ((dest & mask) >>> 0 !== (net & mask) >>> 0) continue;
    const prefix = mask.toString(2).split("1").length - 1;
    if (prefix > bestPrefix) {
      bestPrefix = prefix;
      best = r;
    }
  }
  return best;
}

function failPing(
  fromIp: string,
  toIp: string,
  count: number,
  hops: PingHop[],
  message: string,
): PingResult {
  return {
    ok: false,
    fromIp,
    toIp,
    hops,
    rttMs: 0,
    message,
    packets: { sent: count, received: 0, lost: count },
  };
}

function buildPingOk(toIp: string, count: number, baseRtt: number): string {
  const lines = ["", `Esecuzione di Ping ${toIp} con 32 byte di dati:`];
  for (let i = 0; i < count; i++) {
    const rtt = baseRtt + Math.floor(Math.random() * 3);
    lines.push(`Risposta da ${toIp}: byte=32 durata=${rtt}ms TTL=128`);
  }
  lines.push("");
  lines.push(`Statistiche Ping per ${toIp}:`);
  lines.push(
    `    Pacchetti: Trasmessi = ${count}, Ricevuti = ${count}, Persi = 0 (0% persi),`,
  );
  lines.push(
    `    Minimo = ${baseRtt}ms, Massimo = ${baseRtt + 2}ms, Medio = ${baseRtt + 1}ms`,
  );
  return lines.join("\n");
}

export function nextDeviceName(state: LabState, type: DeviceKind): string {
  let prefix = "Device";
  if (type === "pc") prefix = "PC";
  else if (type === "laptop") prefix = "Laptop";
  else if (type === "server") prefix = "Server";
  else if (type === "printer") prefix = "Printer";
  else if (type.startsWith("switch") || type === "multilayer_switch") prefix = "Switch";
  else if (type.startsWith("router")) prefix = "Router";
  else if (type.startsWith("firewall")) prefix = "ASA";
  else if (type === "hub") prefix = "Hub";
  else if (type === "cloud" || type === "cloud_empty") prefix = "Cloud";
  else if (type.startsWith("modem")) prefix = "Modem";
  else if (
    type === "wireless_router" ||
    type === "home_router" ||
    type === "home_gateway"
  )
    prefix = "WirelessRouter";
  else if (type.startsWith("ap_") || type === "access_point" || type === "lap" || type === "meraki_ap")
    prefix = "AccessPoint";
  else if (type.startsWith("wlc")) prefix = "WLC";
  else if (type === "ip_phone" || type === "voip_device") prefix = "IPPhone";
  else prefix = DEVICE_META[type].label.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "Dev";

  let n = 0;
  const names = new Set(state.devices.map((d) => d.name));
  while (names.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

export { formatIp, parseIp, parseMask };
