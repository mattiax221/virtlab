import { inferCable, type CableKind } from "./catalog";
import { getDevice, getIface } from "./engine-helpers";
import { formatIp, isValidIp, parseIp, parseMask, randomMac, sameSubnet } from "./ip";
import { l2Flood } from "./l2";
import {
  DEVICE_META,
  defaultVlans,
  isL3Device,
  isManagedSwitch,
  type Device,
  type DeviceKind,
  type InterfaceConfig,
  type LabState,
  type Link,
  type PingHop,
  type PingResult,
} from "./types";

export { getDevice, getIface };

let idCounter = 0;
export function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function defaultIfaces(type: DeviceKind, deviceId: string): InterfaceConfig[] {
  const meta = DEVICE_META[type];
  const count = Math.min(meta.ports, 26);
  return Array.from({ length: count }, (_, i) => {
    let name = `Eth${i}`;
    if (
      type === "switch" ||
      type === "hub" ||
      type === "multilayer_switch" ||
      type.startsWith("switch_")
    ) {
      // PT: Fa0/1..Fa0/24 then Gig0/1..
      if (i < 24) name = `FastEthernet0/${i + 1}`;
      else name = `GigabitEthernet0/${i - 23}`;
    } else if (type === "router_1841" || type === "router_2811" || type === "router") {
      name = `FastEthernet0/${i}`;
    } else if (type.startsWith("router_") || type === "wireless_router" || type === "home_router") {
      if (type === "router_4321" || type === "router_4331") {
        name = `GigabitEthernet0/0/${i}`;
      } else {
        name = `GigabitEthernet0/${i}`;
      }
    } else if (type.startsWith("firewall_")) {
      name = `Ethernet0/${i}`;
    } else if (type === "modem_dsl" || type === "modem_cable") {
      name = i === 0 ? "Ethernet0" : type === "modem_cable" ? "Coaxial0" : "Modem0";
    } else if (
      type === "pc" ||
      type === "laptop" ||
      type === "server" ||
      type === "printer" ||
      type === "tablet" ||
      type === "smartphone" ||
      type === "tv"
    ) {
      name = "FastEthernet0";
    } else if (type === "ip_phone") {
      name = i === 0 ? "Switchport" : "PC port";
    } else if (type === "analog_phone") {
      name = "Phone0";
    } else if (type === "access_point" || type === "ap_n" || type === "lap") {
      name = "Port 0";
    } else if (type === "wlc") {
      name = `GigabitEthernet0/${i}`;
    } else if (type === "cloud" || type === "co_server") {
      name = `Ethernet${i}`;
    } else if (type === "bridge" || type === "repeater") {
      name = `Port${i}`;
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
      mode: "access" as const,
      accessVlan: 1,
      nativeVlan: 1,
      allowedVlans: "all" as const,
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
  const device: Device = {
    id,
    type,
    name,
    x,
    y,
    interfaces: defaultIfaces(type, id),
    osSlot: DEVICE_META[type].hasOs ? id : undefined,
  };
  if (isManagedSwitch(type)) {
    device.vlans = defaultVlans().filter((v) => v.id === 1);
    device.macTable = [];
  }
  return device;
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
    devices: [pc1, pc2, printer, sw, rtr, modem, cloud],
    links,
  };
}

export function getFreeIface(device: Device): InterfaceConfig | undefined {
  return device.interfaces.find((i) => !i.connectedLinkId);
}

export function connectDevices(
  state: LabState,
  aId: string,
  bId: string,
  cable: CableKind = "auto",
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

  const media = cable === "auto" ? inferCable(a.type, b.type) : cable;

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
  patch: Partial<Pick<Device, "name" | "vlans" | "macTable">>,
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

function findLocalRoute(device: Device, destIp: string): InterfaceConfig | null {
  for (const iface of device.interfaces) {
    if (!iface.ip || !iface.mask || !iface.enabled) continue;
    if (sameSubnet(iface.ip, destIp, iface.mask)) return iface;
  }
  return device.interfaces.find((i) => i.ip && i.mask && i.gateway && i.enabled) ?? null;
}

function collectRouterDomains(
  state: LabState,
  router: Device,
): { hosts: Endpoint[]; state: LabState } {
  let next = state;
  const found: Endpoint[] = [];
  const seen = new Set<string>();
  for (const iface of router.interfaces) {
    if (!iface.connectedLinkId || !iface.enabled) continue;
    const link = next.links.find((l) => l.id === iface.connectedLinkId);
    if (!link || link.media === "console") continue;
    const otherId =
      link.aDeviceId === router.id ? link.bDeviceId : link.aDeviceId;
    const flood = l2Flood(next, otherId, { sourceMac: iface.mac });
    next = flood.state;
    for (const h of flood.hosts) {
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

  if (!isValidIp(targetIp)) {
    return {
      state,
      result: failPing("", targetIp, count, [], `Indirizzo non valido: ${targetIp}`),
    };
  }

  const srcIface =
    from.interfaces.find((i) => i.ip && i.enabled) ?? from.interfaces[0];
  const fromIp = srcIface?.ip ?? "";

  if (!srcIface?.ip || !srcIface.mask) {
    return {
      state,
      result: failPing(
        "",
        targetIp,
        count,
        [],
        "Richiesta scaduta.\n\nNessun IP. Usa: ipconfig /ip <ip> <mask> [gateway]",
      ),
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

  // VLAN-aware L2 flood + MAC learning from source
  const flood = l2Flood(state, from.id, { sourceMac: srcIface.mac });
  let nextState = flood.state;

  if (sameSubnet(srcIface.ip, targetIp, srcIface.mask)) {
    if (!srcIface.connectedLinkId) {
      return {
        state: nextState,
        result: failPing(fromIp, targetIp, count, hops, "Cavo non collegato."),
      };
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
    hops.push({
      deviceId: target.device.id,
      deviceName: target.device.name,
      ip: targetIp,
    });
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

  if (isL3Device(gw.device.type)) {
    void findLocalRoute;
    const routed = collectRouterDomains(nextState, gw.device);
    nextState = routed.state;
    const found = routed.hosts.find((e) => e.iface.ip === targetIp);
    if (!found) {
      return {
        state: nextState,
        result: failPing(fromIp, targetIp, count, hops, "Nessuna rotta."),
      };
    }
    hops.push({
      deviceId: found.device.id,
      deviceName: found.device.name,
      ip: targetIp,
    });
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
  else if (type === "cloud") prefix = "Cloud";
  else if (type.startsWith("modem")) prefix = "Modem";
  else if (type === "wireless_router" || type === "home_router") prefix = "WirelessRouter";
  else if (type === "access_point" || type === "ap_n") prefix = "AccessPoint";
  else if (type === "ip_phone") prefix = "IPPhone";
  else prefix = DEVICE_META[type].label.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "Dev";

  let n = 0;
  const names = new Set(state.devices.map((d) => d.name));
  while (names.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

export { formatIp, parseIp, parseMask };
