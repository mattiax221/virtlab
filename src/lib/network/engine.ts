import { formatIp, isValidIp, parseIp, parseMask, randomMac, sameSubnet } from "./ip";
import type {
  Device,
  DeviceType,
  InterfaceConfig,
  LabState,
  Link,
  PingHop,
  PingResult,
} from "./types";

let idCounter = 0;
export function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function defaultIfaces(type: DeviceType, deviceId: string): InterfaceConfig[] {
  if (type === "pc") {
    return [
      {
        id: uid("if"),
        name: "Ethernet0",
        ip: null,
        mask: null,
        gateway: null,
        mac: randomMac(deviceId + "-eth0"),
        connectedLinkId: null,
        enabled: true,
      },
    ];
  }
  if (type === "switch") {
    return Array.from({ length: 8 }, (_, i) => ({
      id: uid("if"),
      name: `Fa0/${i}`,
      ip: null,
      mask: null,
      gateway: null,
      mac: randomMac(`${deviceId}-fa0/${i}`),
      connectedLinkId: null,
      enabled: true,
    }));
  }
  // router
  return [
    {
      id: uid("if"),
      name: "GigabitEthernet0/0",
      ip: null,
      mask: null,
      gateway: null,
      mac: randomMac(deviceId + "-g0/0"),
      connectedLinkId: null,
      enabled: true,
    },
    {
      id: uid("if"),
      name: "GigabitEthernet0/1",
      ip: null,
      mask: null,
      gateway: null,
      mac: randomMac(deviceId + "-g0/1"),
      connectedLinkId: null,
      enabled: true,
    },
  ];
}

export function createDevice(
  type: DeviceType,
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
  };
}

export function createEmptyLab(): LabState {
  return { devices: [], links: [] };
}

export function createDemoLab(): LabState {
  const pc1 = createDevice("pc", "PC0", 140, 220);
  const pc2 = createDevice("pc", "PC1", 620, 220);
  const sw = createDevice("switch", "Switch0", 380, 220);
  const rtr = createDevice("router", "Router0", 380, 420);

  pc1.interfaces[0].ip = "192.168.1.10";
  pc1.interfaces[0].mask = "255.255.255.0";
  pc1.interfaces[0].gateway = "192.168.1.1";

  pc2.interfaces[0].ip = "192.168.1.20";
  pc2.interfaces[0].mask = "255.255.255.0";
  pc2.interfaces[0].gateway = "192.168.1.1";

  rtr.interfaces[0].ip = "192.168.1.1";
  rtr.interfaces[0].mask = "255.255.255.0";

  const link1: Link = {
    id: uid("link"),
    aDeviceId: pc1.id,
    aIfaceId: pc1.interfaces[0].id,
    bDeviceId: sw.id,
    bIfaceId: sw.interfaces[0].id,
  };
  const link2: Link = {
    id: uid("link"),
    aDeviceId: pc2.id,
    aIfaceId: pc2.interfaces[0].id,
    bDeviceId: sw.id,
    bIfaceId: sw.interfaces[1].id,
  };
  const link3: Link = {
    id: uid("link"),
    aDeviceId: rtr.id,
    aIfaceId: rtr.interfaces[0].id,
    bDeviceId: sw.id,
    bIfaceId: sw.interfaces[2].id,
  };

  pc1.interfaces[0].connectedLinkId = link1.id;
  sw.interfaces[0].connectedLinkId = link1.id;
  pc2.interfaces[0].connectedLinkId = link2.id;
  sw.interfaces[1].connectedLinkId = link2.id;
  rtr.interfaces[0].connectedLinkId = link3.id;
  sw.interfaces[2].connectedLinkId = link3.id;

  return { devices: [pc1, pc2, sw, rtr], links: [link1, link2, link3] };
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

  const link: Link = {
    id: uid("link"),
    aDeviceId: a.id,
    aIfaceId: aIf.id,
    bDeviceId: b.id,
    bIfaceId: bIf.id,
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

/** L2 flood through switches; collect L3-capable endpoints in the broadcast domain. */
function l2ReachableHosts(
  state: LabState,
  startDeviceId: string,
): Endpoint[] {
  const visited = new Set<string>();
  const queue = [startDeviceId];
  const hosts: Endpoint[] = [];

  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const device = getDevice(state, id);
    if (!device) continue;

    if (device.type !== "switch") {
      for (const iface of device.interfaces) {
        if (iface.ip && iface.enabled) {
          hosts.push({ device, iface });
        }
      }
    }

    for (const n of neighbors(state, id)) {
      if (n.device.type === "switch") {
        queue.push(n.device.id);
      } else if (!visited.has(n.device.id)) {
        // Direct L3 neighbor on same L2 segment via switch or direct cable
        queue.push(n.device.id);
      }
    }
  }

  return hosts;
}

function findIfaceByIp(
  state: LabState,
  ip: string,
): Endpoint | null {
  for (const device of state.devices) {
    for (const iface of device.interfaces) {
      if (iface.ip === ip && iface.enabled) return { device, iface };
    }
  }
  return null;
}

function findLocalRoute(
  device: Device,
  destIp: string,
): InterfaceConfig | null {
  for (const iface of device.interfaces) {
    if (!iface.ip || !iface.mask || !iface.enabled) continue;
    if (sameSubnet(iface.ip, destIp, iface.mask)) return iface;
  }
  // default gateway iface for PCs
  const gwIface = device.interfaces.find(
    (i) => i.ip && i.mask && i.gateway && i.enabled,
  );
  if (gwIface && gwIface.gateway) return gwIface;
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
    return {
      ok: false,
      fromIp: "",
      toIp: targetIp,
      hops: [],
      rttMs: 0,
      message: `Impossibile raggiungere l'host di destinazione ${targetIp}. Indirizzo non valido.`,
      packets: { sent: count, received: 0, lost: count },
    };
  }

  const srcIface =
    from.interfaces.find((i) => i.ip && i.enabled) ?? from.interfaces[0];
  const fromIp = srcIface?.ip ?? "";

  if (!srcIface?.ip || !srcIface.mask) {
    return {
      ok: false,
      fromIp: "",
      toIp: targetIp,
      hops: [],
      rttMs: 0,
      message:
        "Richiesta scaduta.\n\nNessun indirizzo IP configurato. Usa: ipconfig /ip <ip> <mask> [gateway]",
      packets: { sent: count, received: 0, lost: count },
    };
  }

  if (srcIface.ip === targetIp) {
    return {
      ok: true,
      fromIp,
      toIp: targetIp,
      hops: [{ deviceId: from.id, deviceName: from.name, ip: fromIp }],
      rttMs: 1,
      message: buildPingOk(fromIp, targetIp, count, 1),
      packets: { sent: count, received: count, lost: 0 },
    };
  }

  const hops: PingHop[] = [
    { deviceId: from.id, deviceName: from.name, ip: fromIp },
  ];

  // Same subnet?
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
        "Richiesta scaduta.\n\nL'host non risponde sulla stessa LAN (cavo, switch o IP errato).",
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
      message: buildPingOk(fromIp, targetIp, count, rtt),
      packets: { sent: count, received: count, lost: 0 },
    };
  }

  // Need gateway
  if (!srcIface.gateway) {
    return failPing(
      fromIp,
      targetIp,
      count,
      hops,
      "Richiesta scaduta.\n\nDestinazione fuori rete. Configura un gateway: ipconfig /ip <ip> <mask> <gateway>",
    );
  }

  if (!sameSubnet(srcIface.ip, srcIface.gateway, srcIface.mask)) {
    return failPing(
      fromIp,
      targetIp,
      count,
      hops,
      "Gateway non raggiungibile (non è nella stessa subnet).",
    );
  }

  const domain = l2ReachableHosts(state, from.id);
  const gw = domain.find((e) => e.iface.ip === srcIface.gateway);
  if (!gw) {
    return failPing(
      fromIp,
      targetIp,
      count,
      hops,
      "Richiesta scaduta.\n\nGateway non raggiungibile.",
    );
  }

  hops.push({
    deviceId: gw.device.id,
    deviceName: gw.device.name,
    ip: srcIface.gateway,
  });

  // From gateway, look for destination on any of its interfaces' L2 domains
  if (gw.device.type === "router") {
    const outIface = findLocalRoute(gw.device, targetIp);
    if (!outIface || !outIface.connectedLinkId) {
      return failPing(
        fromIp,
        targetIp,
        count,
        hops,
        "Richiesta scaduta.\n\nIl router non ha una rotta verso la destinazione.",
      );
    }
    // Explore from router through that interface's neighbor
    const link = state.links.find((l) => l.id === outIface.connectedLinkId);
    if (!link) {
      return failPing(fromIp, targetIp, count, hops, "Link del router assente.");
    }
    const next = otherEnd(state, link, gw.device.id);
    if (!next) {
      return failPing(fromIp, targetIp, count, hops, "Vicino del router assente.");
    }
    const farDomain = l2ReachableHosts(state, next.device.id);
    // Also include router itself if dest is on another iface
    const target = farDomain.find((e) => e.iface.ip === targetIp)
      ?? findIfaceByIp(state, targetIp);
    if (!target || !isL3ReachableViaRouter(state, gw.device, target)) {
      // Check if destination is on another interface of same router domain
      const allFromRouter = collectRouterDomains(state, gw.device);
      const found = allFromRouter.find((e) => e.iface.ip === targetIp);
      if (!found) {
        return failPing(
          fromIp,
          targetIp,
          count,
          hops,
          "Richiesta scaduta.\n\nNessuna rotta verso l'host di destinazione.",
        );
      }
      hops.push({
        deviceId: found.device.id,
        deviceName: found.device.name,
        ip: targetIp,
      });
    } else {
      hops.push({
        deviceId: target.device.id,
        deviceName: target.device.name,
        ip: targetIp,
      });
    }
    const rtt = 8 + Math.floor(Math.random() * 12);
    return {
      ok: true,
      fromIp,
      toIp: targetIp,
      hops,
      rttMs: rtt,
      message: buildPingOk(fromIp, targetIp, count, rtt),
      packets: { sent: count, received: count, lost: 0 },
    };
  }

  return failPing(fromIp, targetIp, count, hops, "Richiesta scaduta.");
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
  // include router's own IPs
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

function buildPingOk(
  fromIp: string,
  toIp: string,
  count: number,
  baseRtt: number,
): string {
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
  void fromIp;
  return lines.join("\n");
}

export function nextDeviceName(state: LabState, type: DeviceType): string {
  const prefix = type === "pc" ? "PC" : type === "switch" ? "Switch" : "Router";
  let n = 0;
  const names = new Set(state.devices.map((d) => d.name));
  while (names.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

export function describePath(result: PingResult): string {
  if (result.hops.length === 0) return "Nessun hop.";
  return result.hops.map((h) => `${h.deviceName} (${h.ip})`).join(" → ");
}

export { formatIp, parseIp, parseMask };
