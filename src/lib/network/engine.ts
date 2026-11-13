import { inferCable, type CableKind } from "./catalog";
import { getDevice, getIface } from "./engine-helpers";
import { hostFirewallBlocks } from "./hostFirewall";
import { formatIp, isValidIp, parseIp, parseMask, randomMac } from "./ip";
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
import { canRoute, pickSourceIface, roundTrip } from "./routing";
import { recomputeStp } from "./stp";
import { isWifiAp, wifiSecurityLabel, wifiSecurityNeedsKey } from "./wifi";
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
} from "./types";

export { getDevice, getIface };
export { availableModulesFor, MODULE_CATALOG, isModuleRemovable };

let idCounter = 0;
export function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * Porta il contatore degli id oltre il numero più alto già presente nel lab.
 * Va chiamata ogni volta che un lab arriva da fuori (autosave, file, link),
 * altrimenti i nuovi dispositivi riprendono id già usati (pc-1, if-4…).
 */
export function reserveIdsFrom(state: LabState): void {
  let max = idCounter;
  const bump = (id: string | null | undefined) => {
    if (!id) return;
    const m = /-(\d+)$/.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  };
  for (const d of state.devices) {
    bump(d.id);
    for (const m of d.modules ?? []) bump(m.id);
    for (const i of d.interfaces) bump(i.id);
  }
  for (const l of state.links) bump(l.id);
  idCounter = max;
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
    device.interfaces.push(makeSvi(id, 1));
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
  if (type === "printer") {
    device.printerService = {
      enabled: true,
      shareName: name.replace(/\s+/g, "_"),
      location: "Lab",
      paper: "A4",
      queue: [],
    };
    // Nessun IP di default — si configura da Config (static/DHCP), come in PT
    const eth0 = device.interfaces.find((i) => i.media === "ethernet");
    if (eth0) {
      eth0.dhcpClient = true;
    }
  }
  if (isL3Device(type) || type.startsWith("firewall")) {
    device.accessLists = [];
  }
  if (type === "router" || type.startsWith("router_")) {
    // Come su IOS: le interfacce dei router partono in shutdown
    for (const i of device.interfaces) {
      if (!i.parentIfaceId) i.enabled = false;
    }
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
  return recomputeStp(next);
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

function makeSvi(deviceId: string, vlanId: number): InterfaceConfig {
  return {
    id: uid("if"),
    name: `Vlan${vlanId}`,
    ip: null,
    mask: null,
    gateway: null,
    mac: randomMac(`${deviceId}-vlan${vlanId}`),
    connectedLinkId: null,
    enabled: true,
    mode: "access",
    accessVlan: vlanId,
    nativeVlan: vlanId,
    allowedVlans: "all",
    media: "ethernet",
    moduleId: null,
    parentIfaceId: null,
    vlanTag: vlanId,
    sviVlan: vlanId,
    dhcpClient: false,
    dnsServers: [],
    clockRate: null,
    aclIn: null,
    aclOut: null,
  };
}

/** interface VlanN — crea la SVI se non c'è (gli switch nuovi hanno già Vlan1). */
export function ensureSvi(
  state: LabState,
  deviceId: string,
  vlanId: number,
): { state: LabState; iface?: InterfaceConfig; error?: string } {
  const device = getDevice(state, deviceId);
  if (!device) return { state, error: "Dispositivo non trovato." };
  if (!isManagedSwitch(device.type)) {
    return { state, error: "SVI solo sugli switch." };
  }
  if (!Number.isInteger(vlanId) || vlanId < 1 || vlanId > 4094) {
    return { state, error: "VLAN non valida." };
  }
  const existing = device.interfaces.find((i) => i.sviVlan === vlanId);
  if (existing) return { state, iface: existing };
  const iface = makeSvi(device.id, vlanId);
  const vlans = [...(device.vlans ?? [{ id: 1, name: "default" }])];
  if (!vlans.some((v) => v.id === vlanId)) {
    vlans.push({ id: vlanId, name: vlanId === 1 ? "default" : `VLAN${vlanId}` });
    vlans.sort((a, b) => a.id - b.id);
  }
  return {
    state: {
      ...state,
      devices: state.devices.map((d) =>
        d.id === deviceId
          ? { ...d, vlans, interfaces: [...d.interfaces, iface] }
          : d,
      ),
    },
    iface,
  };
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
  printer.interfaces[0].dhcpClient = false;
  server.interfaces[0].ip = "192.168.1.100";
  server.interfaces[0].mask = "255.255.255.0";
  server.interfaces[0].gateway = "192.168.1.1";
  if (server.services?.dhcp?.pools?.[0]) {
    server.services.dhcp.pools[0].dns = "192.168.1.100";
  }
  rtr.interfaces[0].enabled = true;
  rtr.interfaces[1].enabled = true;
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

  let lab: LabState = recomputeStp({
    devices: [pc1, pc2, server, printer, sw, rtr, modem, cloud],
    links,
  });
  // PC1 è in DHCP: prende subito l’indirizzo dal Server0
  lab = requestDhcp(lab, pc2.id).state;
  return lab;
}

export function getFreeIface(device: Device): InterfaceConfig | undefined {
  return device.interfaces.find(
    (i) => !i.connectedLinkId && !i.parentIfaceId && !i.sviVlan,
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

/** Porte fisiche senza cavo (anche in shutdown: il cavo si può collegare). */
export function freePhysicalPorts(device: Device): InterfaceConfig[] {
  return device.interfaces.filter(
    (i) => !i.connectedLinkId && !i.parentIfaceId && !i.sviVlan,
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
    if (!aIf || aIf.connectedLinkId || aIf.parentIfaceId || aIf.sviVlan) {
      return { state, error: "Porta sorgente non disponibile." };
    }
  }
  if (opts?.bIfaceId) {
    if (!bIf || bIf.connectedLinkId || bIf.parentIfaceId || bIf.sviVlan) {
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

  if (media === "wireless") {
    const apDev = isWifiAp(a.type) ? a : isWifiAp(b.type) ? b : null;
    const radio = apDev?.wifi;
    if (radio && (!radio.enabled || !radio.ssid.trim())) {
      return {
        state,
        error: radio.enabled
          ? "L’AP non ha un SSID."
          : "Radio Wi‑Fi disattivata sull’AP.",
      };
    }
    if (radio && wifiSecurityNeedsKey(radio.security)) {
      return {
        state,
        error: `Rete «${radio.ssid}» protetta (${wifiSecurityLabel(radio.security)}): connetti dal pannello Wi‑Fi del client con la passphrase.`,
      };
    }
  }

  // Cavo sbagliato: si collega lo stesso → LED rosso via evaluateLink, senza L2

  const link: Link = {
    id: uid("link"),
    aDeviceId: a.id,
    aIfaceId: aIf.id,
    bDeviceId: b.id,
    bIfaceId: bIf.id,
    media,
    ...(media === "wireless" ? { wifiKey: "" } : {}),
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
      | "helperAddress"
    >
  >,
): LabState {
  const next: LabState = {
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
  // shutdown / no shutdown cambia la topologia attiva: ricalcola lo STP
  return "enabled" in patch ? recomputeStp(next) : next;
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
      | "printerService"
      | "arpTable"
      | "routes"
      | "ipRouting"
      | "stpPriority"
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

export function runPing(
  state: LabState,
  fromDeviceId: string,
  targetIp: string,
  count = 4,
  /** Per HTTP/FTP…: verifica la raggiungibilità con quel protocollo (ACL) */
  probe?: { proto: "tcp" | "udp"; port: number },
): { result: PingResult; state: LabState } {
  const proto = probe?.proto ?? "icmp";
  const from = getDevice(state, fromDeviceId);
  if (!from) {
    return {
      state,
      result: failPing("", targetIp, count, [], "Dispositivo sorgente non trovato."),
    };
  }
  if (!from.powered) {
    return {
      state,
      result: failPing("", targetIp, count, [], `${from.name} è spento (Physical → Accendi).`),
    };
  }

  // DNS name → IP
  let label = targetIp;
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
          `La richiesta Ping non ha trovato l'host ${targetIp}. Verificare il nome e riprovare.`,
        ),
      };
    }
    label = `${targetIp} [${resolved}]`;
    targetIp = resolved;
  }

  const srcIface = pickSourceIface(state, from, targetIp);
  const fromIp = srcIface?.ip ?? "";

  if (!srcIface?.ip || !srcIface.mask) {
    return {
      state,
      result: failPing(
        "",
        targetIp,
        count,
        [],
        canRoute(from)
          ? `Nessuna rotta verso ${targetIp} su ${from.name}.`
          : "Nessun IP. Configura Ethernet (non Wi‑Fi) con ipconfig /ip oppure Connessioni di rete.",
        label,
      ),
    };
  }
  if (!srcIface.parentIfaceId && !srcIface.sviVlan && !srcIface.connectedLinkId) {
    return {
      state,
      result: failPing(
        fromIp,
        targetIp,
        count,
        [],
        `L'IP ${fromIp} è su ${srcIface.name} ma quella porta non ha un cavo. Collega Ethernet allo switch (non la porta Wi‑Fi) e riprova.`,
        label,
      ),
    };
  }

  const blockedOut = hostFirewallBlocks(from, "out", proto, targetIp, probe?.port);
  if (blockedOut) {
    return { state, result: failPing(fromIp, targetIp, count, [], blockedOut, label) };
  }

  const firstHop: PingHop = { deviceId: from.id, deviceName: from.name, ip: fromIp };

  if (from.interfaces.some((i) => i.ip === targetIp && i.enabled)) {
    return {
      state,
      result: okPing(fromIp, targetIp, label, count, [firstHop], 1, ttlBase(from), []),
    };
  }

  const rt = roundTrip(state, from, srcIface, targetIp, proto, probe?.port);
  const hops = [firstHop, ...rt.hops];
  if (!rt.ok) {
    return {
      state: rt.state,
      result: failPing(
        fromIp,
        targetIp,
        count,
        hops,
        rt.message ?? "Richiesta scaduta.",
        label,
        rt.rejectedBy?.ip,
      ),
    };
  }
  const routers = rt.hops.filter((h) => h.ip !== targetIp).length;
  const rtt = routers === 0 ? 1 + Math.floor(Math.random() * 3) : 2 + routers * 4;
  const ttl = ttlBase(rt.target?.device ?? from) - routers;
  return {
    state: rt.state,
    result: okPing(fromIp, targetIp, label, count, hops, rtt, ttl, rt.warnings),
  };
}

/** TTL iniziale tipico del sistema che risponde. */
function ttlBase(device: Device): number {
  if (isL3Device(device.type) || isManagedSwitch(device.type)) return 255;
  if (device.hostOs === "linux") return 64;
  return 128;
}

function okPing(
  fromIp: string,
  toIp: string,
  label: string,
  count: number,
  hops: PingHop[],
  rtt: number,
  ttl: number,
  warnings: string[],
): PingResult {
  return {
    ok: true,
    fromIp,
    toIp,
    hops,
    rttMs: rtt,
    message: buildPingOk(toIp, label, count, rtt, ttl, warnings),
    packets: { sent: count, received: count, lost: 0 },
  };
}

function failPing(
  fromIp: string,
  toIp: string,
  count: number,
  hops: PingHop[],
  reason: string,
  label?: string,
  rejectedByIp?: string,
): PingResult {
  const lines = [""];
  if (label) {
    lines.push(`Esecuzione di Ping ${label} con 32 byte di dati:`);
    for (let i = 0; i < count; i++) {
      lines.push(
        rejectedByIp
          ? `Risposta da ${rejectedByIp}: Host di destinazione non raggiungibile.`
          : "Richiesta scaduta.",
      );
    }
    lines.push("");
    lines.push(`Statistiche Ping per ${toIp}:`);
    const received = rejectedByIp ? count : 0;
    lines.push(
      `    Pacchetti: Trasmessi = ${count}, Ricevuti = ${received}, Persi = ${count - received} (${Math.round(((count - received) / count) * 100)}% persi),`,
    );
    lines.push("");
    lines.push(`Motivo (NetLab): ${reason}`);
  } else {
    lines.push(reason);
  }
  return {
    ok: false,
    fromIp,
    toIp,
    hops,
    rttMs: 0,
    message: lines.join("\n"),
    reason,
    packets: { sent: count, received: 0, lost: count },
  };
}

function buildPingOk(
  toIp: string,
  label: string,
  count: number,
  baseRtt: number,
  ttl: number,
  warnings: string[],
): string {
  const lines = ["", `Esecuzione di Ping ${label} con 32 byte di dati:`];
  const rtts: number[] = [];
  for (let i = 0; i < count; i++) {
    const rtt = baseRtt + Math.floor(Math.random() * 3);
    rtts.push(rtt);
    lines.push(`Risposta da ${toIp}: byte=32 durata=${rtt}ms TTL=${ttl}`);
  }
  lines.push("");
  lines.push(`Statistiche Ping per ${toIp}:`);
  lines.push(
    `    Pacchetti: Trasmessi = ${count}, Ricevuti = ${count}, Persi = 0 (0% persi),`,
  );
  lines.push("Tempo approssimativo percorsi andata/ritorno in millisecondi:");
  const min = Math.min(...rtts);
  const max = Math.max(...rtts);
  const avg = Math.round(rtts.reduce((a, b) => a + b, 0) / rtts.length);
  lines.push(`    Minimo = ${min}ms, Massimo = ${max}ms, Medio = ${avg}ms`);
  for (const w of warnings) lines.push(w);
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
