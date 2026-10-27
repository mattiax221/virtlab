import { formatIp, isValidIp, parseIp, parseMask, randomMac, sameSubnet } from "./ip";
import {
  DEVICE_META,
  isL2Bridge,
  isL3Device,
  type Device,
  type DeviceKind,
  type InterfaceConfig,
  type LabState,
  type Link,
  type PingHop,
  type PingResult,
} from "./types";

let idCounter = 0;
export function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function defaultIfaces(type: DeviceKind, deviceId: string): InterfaceConfig[] {
  const meta = DEVICE_META[type];
  // Cap UI/sim ports: real 24-port switch still works; keep first N usable.
  const count = Math.min(meta.ports, type.startsWith("switch_") ? 24 : meta.ports);
  return Array.from({ length: count }, (_, i) => {
    let name = `Eth${i}`;
    if (
      type === "switch" ||
      type === "hub" ||
      type === "multilayer_switch" ||
      type.startsWith("switch_")
    ) {
      name = i < 24 ? `FastEthernet0/${i}` : `GigabitEthernet0/${i - 24}`;
    } else if (
      type === "router" ||
      type.startsWith("router_") ||
      type === "firewall_asa" ||
      type === "wireless_router"
    ) {
      name = `GigabitEthernet0/${i}`;
    } else if (type === "modem_dsl" || type === "modem_cable") {
      name = i === 0 ? "Ethernet0" : "ATM0";
    } else if (type === "pc" || type === "laptop" || type === "server" || type === "printer") {
      name = "FastEthernet0";
    } else if (type === "ip_phone") {
      name = i === 0 ? "Switchport" : "PC port";
    } else if (type === "access_point") {
      name = "Port 0";
    } else if (type === "cloud") {
      name = `Ethernet${i}`;
    }
    return {
      id: uid("if"),
      name,
      ip: null,
      mask: null,
      gateway: null,
      mac: randomMac(`${deviceId}-${name}`),
      connectedLinkId: null,
      enabled: true,
    };
  });
}

export function createDevice(
  type: DeviceKind,
  name: string,
  x: number,
  y: number,
): Device {
  const id = uid(type);
  return {
    id,
    type,
    name,
    x,
    y,
    interfaces: defaultIfaces(type, id),
    osSlot: DEVICE_META[type].hasOs ? id : undefined,
  };
}

export function createEmptyLab(): LabState {
  return { devices: [], links: [] };
}

export function createDemoLab(): LabState {
  const pc1 = createDevice("pc", "PC0", 120, 200);
  const pc2 = createDevice("pc", "PC1", 520, 200);
  const printer = createDevice("printer", "Printer0", 320, 80);
  const sw = createDevice("switch_2960", "Switch0", 320, 200);
  const rtr = createDevice("router_2911", "Router0", 320, 380);
  const modem = createDevice("modem_cable", "CableModem0", 520, 380);
  const cloud = createDevice("cloud", "Internet", 700, 380);

  pc1.interfaces[0].ip = "192.168.1.10";
  pc1.interfaces[0].mask = "255.255.255.0";
  pc1.interfaces[0].gateway = "192.168.1.1";

  pc2.interfaces[0].ip = "192.168.1.20";
  pc2.interfaces[0].mask = "255.255.255.0";
  pc2.interfaces[0].gateway = "192.168.1.1";

  printer.interfaces[0].ip = "192.168.1.50";
  printer.interfaces[0].mask = "255.255.255.0";
  printer.interfaces[0].gateway = "192.168.1.1";

  rtr.interfaces[0].ip = "192.168.1.1";
  rtr.interfaces[0].mask = "255.255.255.0";
  rtr.interfaces[1].ip = "10.0.0.2";
  rtr.interfaces[1].mask = "255.255.255.252";

  modem.interfaces[0].ip = "10.0.0.1";
  modem.interfaces[0].mask = "255.255.255.252";

  const linksSpec: [Device, number, Device, number][] = [
    [pc1, 0, sw, 0],
    [pc2, 0, sw, 1],
    [printer, 0, sw, 2],
    [rtr, 0, sw, 3],
    [rtr, 1, modem, 0],
    [modem, 1, cloud, 0],
  ];

  const links: Link[] = [];
  for (const [a, ai, b, bi] of linksSpec) {
    const link: Link = {
      id: uid("link"),
      aDeviceId: a.id,
      aIfaceId: a.interfaces[ai].id,
      bDeviceId: b.id,
      bIfaceId: b.interfaces[bi].id,
      media: b.type === "cloud" || a.type === "modem_cable" ? "serial" : "copper",
    };
    a.interfaces[ai].connectedLinkId = link.id;
    b.interfaces[bi].connectedLinkId = link.id;
    links.push(link);
  }

  return {
    devices: [pc1, pc2, printer, sw, rtr, modem, cloud],
    links,
  };
}

export function getDevice(state: LabState, id: string): Device | undefined {
  return state.devices.find((d) => d.id === id);
}

export function getIface(
  device: Device,
  ifaceId: string,
): InterfaceConfig | undefined {
  return device.interfaces.find((i) => i.id === ifaceId);
}

export function getFreeIface(device: Device): InterfaceConfig | undefined {
  return device.interfaces.find((i) => !i.connectedLinkId);
}

export function connectDevices(
  state: LabState,
  aId: string,
  bId: string,
): { state: LabState; error?: string } {
  if (aId === bId) return { state, error: "Non puoi collegare un dispositivo a se stesso." };
  const a = getDevice(state, aId);
  const b = getDevice(state, bId);
  if (!a || !b) return { state, error: "Dispositivo non trovato." };

  const aIf = getFreeIface(a);
  const bIf = getFreeIface(b);
  if (!aIf || !bIf) {
    return { state, error: "Nessuna porta libera su uno dei due dispositivi." };
  }

  const media: Link["media"] =
    a.type === "cloud" ||
    b.type === "cloud" ||
    a.type.startsWith("modem") ||
    b.type.startsWith("modem")
      ? "serial"
      : a.type === "access_point" || b.type === "access_point"
        ? "wireless"
        : "copper";

  const link: Link = {
    id: uid("link"),
    aDeviceId: a.id,
    aIfaceId: aIf.id,
    bDeviceId: b.id,
    bIfaceId: bIf.id,
    media,
  };

  const devices = state.devices.map((d) => {
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
  });

  return { state: { devices, links: [...state.links, link] } };
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
  return { devices, links };
}

export function updateIface(
  state: LabState,
  deviceId: string,
  ifaceId: string,
  patch: Partial<Pick<InterfaceConfig, "ip" | "mask" | "gateway" | "enabled">>,
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

type Endpoint = {
  device: Device;
  iface: InterfaceConfig;
};

function otherEnd(state: LabState, link: Link, deviceId: string): Endpoint | null {
  const otherDeviceId =
    link.aDeviceId === deviceId ? link.bDeviceId : link.aDeviceId;
  const otherIfaceId =
    link.aDeviceId === deviceId ? link.bIfaceId : link.aIfaceId;
  const device = getDevice(state, otherDeviceId);
  if (!device) return null;
  const iface = getIface(device, otherIfaceId);
  if (!iface) return null;
  return { device, iface };
}

function neighbors(state: LabState, deviceId: string): Endpoint[] {
  const device = getDevice(state, deviceId);
  if (!device) return [];
  const result: Endpoint[] = [];
  for (const iface of device.interfaces) {
    if (!iface.connectedLinkId || !iface.enabled) continue;
    const link = state.links.find((l) => l.id === iface.connectedLinkId);
    if (!link) continue;
    const end = otherEnd(state, link, deviceId);
    if (end && end.iface.enabled) result.push(end);
  }
  return result;
}

function l2ReachableHosts(state: LabState, startDeviceId: string): Endpoint[] {
  const visited = new Set<string>();
  const queue = [startDeviceId];
  const hosts: Endpoint[] = [];

  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const device = getDevice(state, id);
    if (!device) continue;

    if (!isL2Bridge(device.type)) {
      for (const iface of device.interfaces) {
        if (iface.ip && iface.enabled) {
          hosts.push({ device, iface });
        }
      }
    }

    for (const n of neighbors(state, id)) {
      if (isL2Bridge(n.device.type) || !visited.has(n.device.id)) {
        queue.push(n.device.id);
      }
    }
  }

  return hosts;
}

function findLocalRoute(device: Device, destIp: string): InterfaceConfig | null {
  for (const iface of device.interfaces) {
    if (!iface.ip || !iface.mask || !iface.enabled) continue;
    if (sameSubnet(iface.ip, destIp, iface.mask)) return iface;
  }
  const gwIface = device.interfaces.find(
    (i) => i.ip && i.mask && i.gateway && i.enabled,
  );
  if (gwIface && gwIface.gateway) return gwIface;
  return null;
}

function collectRouterDomains(state: LabState, router: Device): Endpoint[] {
  const found: Endpoint[] = [];
  const seen = new Set<string>();
  for (const iface of router.interfaces) {
    if (!iface.connectedLinkId || !iface.enabled) continue;
    const link = state.links.find((l) => l.id === iface.connectedLinkId);
    if (!link) continue;
    const next = otherEnd(state, link, router.id);
    if (!next) continue;
    for (const h of l2ReachableHosts(state, next.device.id)) {
      if (!seen.has(h.iface.id)) {
        seen.add(h.iface.id);
        found.push(h);
      }
    }
  }
  for (const iface of router.interfaces) {
    if (iface.ip && iface.enabled) {
      found.push({ device: router, iface });
    }
  }
  return found;
}

function isL3ReachableViaRouter(
  state: LabState,
  router: Device,
  target: Endpoint,
): boolean {
  return collectRouterDomains(state, router).some(
    (e) => e.iface.ip === target.iface.ip,
  );
}

function findIfaceByIp(state: LabState, ip: string): Endpoint | null {
  for (const device of state.devices) {
    for (const iface of device.interfaces) {
      if (iface.ip === ip && iface.enabled) return { device, iface };
    }
  }
  return null;
}

export function runPing(
  state: LabState,
  fromDeviceId: string,
  targetIp: string,
  count = 4,
): PingResult {
  const from = getDevice(state, fromDeviceId);
  if (!from) {
    return {
      ok: false,
      fromIp: "",
      toIp: targetIp,
      hops: [],
      rttMs: 0,
      message: "Dispositivo sorgente non trovato.",
      packets: { sent: 0, received: 0, lost: 0 },
    };
  }

  if (!isValidIp(targetIp)) {
    return failPing("", targetIp, count, [], `Indirizzo non valido: ${targetIp}`);
  }

  const srcIface =
    from.interfaces.find((i) => i.ip && i.enabled) ?? from.interfaces[0];
  const fromIp = srcIface?.ip ?? "";

  if (!srcIface?.ip || !srcIface.mask) {
    return failPing(
      "",
      targetIp,
      count,
      [],
      "Richiesta scaduta.\n\nNessun indirizzo IP. Usa: ipconfig /ip <ip> <mask> [gateway]",
    );
  }

  if (srcIface.ip === targetIp) {
    return {
      ok: true,
      fromIp,
      toIp: targetIp,
      hops: [{ deviceId: from.id, deviceName: from.name, ip: fromIp }],
      rttMs: 1,
      message: buildPingOk(targetIp, count, 1),
      packets: { sent: count, received: count, lost: 0 },
    };
  }

  const hops: PingHop[] = [
    { deviceId: from.id, deviceName: from.name, ip: fromIp },
  ];

  if (sameSubnet(srcIface.ip, targetIp, srcIface.mask)) {
    if (!srcIface.connectedLinkId) {
      return failPing(fromIp, targetIp, count, hops, "Cavo non collegato.");
    }
    const domain = l2ReachableHosts(state, from.id);
    const target = domain.find((e) => e.iface.ip === targetIp);
    if (!target) {
      return failPing(
        fromIp,
        targetIp,
        count,
        hops,
        "Richiesta scaduta.\n\nHost non in LAN (cavo/switch/IP).",
      );
    }
    hops.push({
      deviceId: target.device.id,
      deviceName: target.device.name,
      ip: targetIp,
    });
    const rtt = 2 + Math.floor(Math.random() * 4);
    return {
      ok: true,
      fromIp,
      toIp: targetIp,
      hops,
      rttMs: rtt,
      message: buildPingOk(targetIp, count, rtt),
      packets: { sent: count, received: count, lost: 0 },
    };
  }

  if (!srcIface.gateway) {
    return failPing(
      fromIp,
      targetIp,
      count,
      hops,
      "Fuori rete: configura gateway con ipconfig /ip …",
    );
  }

  if (!sameSubnet(srcIface.ip, srcIface.gateway, srcIface.mask)) {
    return failPing(fromIp, targetIp, count, hops, "Gateway non in subnet.");
  }

  const domain = l2ReachableHosts(state, from.id);
  const gw = domain.find((e) => e.iface.ip === srcIface.gateway);
  if (!gw) {
    return failPing(fromIp, targetIp, count, hops, "Gateway non raggiungibile.");
  }

  hops.push({
    deviceId: gw.device.id,
    deviceName: gw.device.name,
    ip: srcIface.gateway,
  });

  if (isL3Device(gw.device.type)) {
    const outIface = findLocalRoute(gw.device, targetIp);
    if (!outIface || !outIface.connectedLinkId) {
      // still search all domains
    }
    const allFromRouter = collectRouterDomains(state, gw.device);
    const found = allFromRouter.find((e) => e.iface.ip === targetIp);
    if (!found) {
      return failPing(
        fromIp,
        targetIp,
        count,
        hops,
        "Nessuna rotta verso la destinazione.",
      );
    }
    hops.push({
      deviceId: found.device.id,
      deviceName: found.device.name,
      ip: targetIp,
    });
    const rtt = 8 + Math.floor(Math.random() * 12);
    return {
      ok: true,
      fromIp,
      toIp: targetIp,
      hops,
      rttMs: rtt,
      message: buildPingOk(targetIp, count, rtt),
      packets: { sent: count, received: count, lost: 0 },
    };
  }

  void isL3ReachableViaRouter;
  void findIfaceByIp;
  return failPing(fromIp, targetIp, count, hops, "Richiesta scaduta.");
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
  const lines: string[] = [
    "",
    `Esecuzione di Ping ${toIp} con 32 byte di dati:`,
  ];
  for (let i = 0; i < count; i++) {
    const rtt = baseRtt + Math.floor(Math.random() * 3);
    lines.push(`Risposta da ${toIp}: byte=32 durata=${rtt}ms TTL=128`);
  }
  lines.push("");
  lines.push(`Statistiche Ping per ${toIp}:`);
  lines.push(
    `    Pacchetti: Trasmessi = ${count}, Ricevuti = ${count}, Persi = 0 (0% persi),`,
  );
  lines.push(`Tempo approssimativo percorsi andata/ritorno in millisecondi:`);
  lines.push(
    `    Minimo = ${baseRtt}ms, Massimo = ${baseRtt + 2}ms, Medio = ${baseRtt + 1}ms`,
  );
  return lines.join("\n");
}

export function nextDeviceName(state: LabState, type: DeviceKind): string {
  let prefix = DEVICE_META[type].label.replace(/\s+/g, "");
  if (type === "switch" || type.startsWith("switch_") || type === "multilayer_switch") {
    prefix = "Switch";
  } else if (type === "router" || type.startsWith("router_")) {
    prefix = "Router";
  } else if (type === "firewall_asa") {
    prefix = "ASA";
  } else if (type === "wireless_router") {
    prefix = "WirelessRouter";
  } else if (type === "hub") {
    prefix = "Hub";
  } else if (type === "pc") {
    prefix = "PC";
  } else if (type === "laptop") {
    prefix = "Laptop";
  } else if (type === "server") {
    prefix = "Server";
  } else if (type === "printer") {
    prefix = "Printer";
  }
  let n = 0;
  const names = new Set(state.devices.map((d) => d.name));
  while (names.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

export { formatIp, parseIp, parseMask };
