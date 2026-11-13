import {
  getDevice,
  getIface,
} from "./engine-helpers";
import { isLinkPhysicallyUp } from "./linkStatus";
import {
  isL2Bridge,
  isManagedSwitch,
  type Device,
  type InterfaceConfig,
  type LabState,
  type Link,
  type MacEntry,
} from "./types";

export type L2Endpoint = { device: Device; iface: InterfaceConfig };

function otherEnd(
  state: LabState,
  link: Link,
  deviceId: string,
): L2Endpoint | null {
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

/** SVI protocol up: almeno una porta della VLAN è link-up. */
export function sviHasMemberLink(device: Device, vlan: number): boolean {
  return device.interfaces.some((p) => {
    if (p.sviVlan || p.parentIfaceId) return false;
    if (!p.enabled || !p.connectedLinkId || p.stpState === "blocking") return false;
    if (p.mode === "trunk") {
      if (p.allowedVlans === "all") return true;
      return p.allowedVlans.includes(vlan);
    }
    return p.accessVlan === vlan;
  });
}

export function linkNeighbors(
  state: LabState,
  deviceId: string,
): { iface: InterfaceConfig; end: L2Endpoint; link: Link }[] {
  const device = getDevice(state, deviceId);
  if (!device) return [];
  const result: { iface: InterfaceConfig; end: L2Endpoint; link: Link }[] = [];
  for (const iface of device.interfaces) {
    if (!iface.connectedLinkId || !iface.enabled) continue;
    if (iface.stpState === "blocking") continue;
    const link = state.links.find((l) => l.id === iface.connectedLinkId);
    if (!link || link.media === "console") continue;
    // Link rosso (cavo sbagliato / spento / no clock) non trasporta frame
    if (!isLinkPhysicallyUp(state, link)) continue;
    const end = otherEnd(state, link, deviceId);
    if (end && end.iface.enabled && end.iface.stpState !== "blocking") {
      result.push({ iface, end, link });
    }
  }
  return result;
}

/** VLAN carried by an access or trunk port when sending/receiving untagged from an end host */
export function portAccessVlan(iface: InterfaceConfig): number {
  return iface.mode === "trunk" ? iface.nativeVlan : iface.accessVlan;
}

export function portCarriesVlan(iface: InterfaceConfig, vlanId: number): boolean {
  if (!iface.enabled) return false;
  if (iface.mode === "access") return iface.accessVlan === vlanId;
  if (iface.allowedVlans === "all") return true;
  return iface.allowedVlans.includes(vlanId);
}

function learnMac(
  state: LabState,
  switchId: string,
  portId: string,
  mac: string,
  vlan: number,
): LabState {
  const sw = getDevice(state, switchId);
  if (!sw || !isManagedSwitch(sw.type)) return state;
  const table = [...(sw.macTable ?? [])];
  const idx = table.findIndex((e) => e.mac === mac && e.vlan === vlan);
  const entry: MacEntry = { mac, vlan, portId, type: "dynamic" };
  if (idx >= 0) table[idx] = entry;
  else table.push(entry);
  // Cap table size
  while (table.length > 200) table.shift();
  return {
    ...state,
    devices: state.devices.map((d) =>
      d.id === switchId ? { ...d, macTable: table } : d,
    ),
  };
}

/**
 * Propagazione L2 (broadcast) a partire da un dispositivo.
 *
 * Restituisce le interfacce con IP che stanno nello stesso dominio di
 * broadcast e applica il learning MAC sugli switch attraversati.
 *
 * Regole:
 * - switch gestiti: VLAN access/trunk, tag 802.1Q, native VLAN, STP;
 * - hub, AP, cloud: ripetono il frame così com’è;
 * - host e router sono estremi: il frame si ferma lì (un router NON
 *   inoltra i broadcast). Solo il dispositivo di partenza trasmette.
 *
 * opts.viaIfaceId limita l’uscita del dispositivo di partenza a quella porta;
 * opts.vlanHint + opts.tagged descrivono un frame che parte già taggato
 * (sottointerfaccia del router) o, se si parte da uno switch, la VLAN della SVI.
 */
export function l2Flood(
  state: LabState,
  startDeviceId: string,
  opts?: {
    sourceMac?: string;
    destMac?: string;
    vlanHint?: number;
    tagged?: boolean;
    viaIfaceId?: string;
  },
): { hosts: L2Endpoint[]; state: LabState } {
  let nextState = state;
  const hosts: L2Endpoint[] = [];
  const seenHostIf = new Set<string>();
  const addHost = (device: Device, iface: InterfaceConfig) => {
    if (!iface.ip || !iface.enabled || seenHostIf.has(iface.id)) return;
    seenHostIf.add(iface.id);
    hosts.push({ device, iface });
  };

  type Frame = { vlan: number | null; tagged: boolean };
  type Node = Frame & { deviceId: string; ingressPortId: string | null };

  const start = getDevice(nextState, startDeviceId);
  if (!start || !start.powered) return { hosts, state };

  const queue: Node[] = [];
  const visited = new Set<string>();

  /** Accoda il frame verso il vicino `end`. */
  const emit = (end: L2Endpoint, frame: Frame) => {
    queue.push({
      deviceId: end.device.id,
      ingressPortId: end.iface.id,
      vlan: frame.vlan,
      tagged: frame.tagged,
    });
  };

  /** Uscita da uno switch gestito sulla VLAN `vlan`. */
  const switchEgress = (
    device: Device,
    vlan: number,
    ingressPortId: string | null,
  ) => {
    const live = getDevice(nextState, device.id) ?? device;
    const known = opts?.destMac
      ? live.macTable?.find(
          (e) =>
            e.mac.toLowerCase() === opts.destMac!.toLowerCase() &&
            e.vlan === vlan,
        )
      : undefined;
    for (const { iface, end } of linkNeighbors(nextState, device.id)) {
      if (iface.id === ingressPortId) continue;
      if (known && known.portId !== iface.id) continue;
      if (iface.mode === "access") {
        if (iface.accessVlan !== vlan) continue;
        emit(end, { vlan, tagged: false });
      } else {
        if (!portCarriesVlan(iface, vlan)) continue;
        emit(end, { vlan, tagged: vlan !== iface.nativeVlan });
      }
    }
  };

  // ---- dispositivo di partenza ----
  if (isManagedSwitch(start.type)) {
    // Traffico generato dallo switch stesso (SVI): esce sulla VLAN indicata
    const vlan = opts?.vlanHint ?? 1;
    visited.add(`${start.id}:${vlan}:-`);
    for (const iface of start.interfaces) {
      if (iface.sviVlan === vlan) addHost(start, iface);
    }
    switchEgress(start, vlan, null);
  } else {
    for (const iface of start.interfaces) {
      if (opts?.viaIfaceId && iface.id !== opts.viaIfaceId) {
        if (iface.parentIfaceId !== opts.viaIfaceId) continue;
      }
      addHost(start, iface);
    }
    for (const { iface, end } of linkNeighbors(nextState, start.id)) {
      if (opts?.viaIfaceId && iface.id !== opts.viaIfaceId) continue;
      emit(end, {
        vlan: opts?.tagged ? (opts.vlanHint ?? null) : null,
        tagged: Boolean(opts?.tagged && opts.vlanHint != null),
      });
    }
  }

  // ---- propagazione ----
  while (queue.length) {
    const node = queue.shift()!;
    const device = getDevice(nextState, node.deviceId);
    if (!device || !device.powered) continue;
    const ingress = device.interfaces.find((i) => i.id === node.ingressPortId);
    if (!ingress) continue;

    if (isManagedSwitch(device.type)) {
      // VLAN assegnata dalla porta d’ingresso
      let vlan: number;
      if (ingress.mode === "access") {
        if (node.tagged) continue; // una porta access scarta i frame taggati
        vlan = ingress.accessVlan;
      } else if (node.tagged && node.vlan != null) {
        vlan = node.vlan;
      } else {
        vlan = ingress.nativeVlan;
      }
      if (!portCarriesVlan(ingress, vlan)) continue;
      const key = `${device.id}:${vlan}:${ingress.id}`;
      if (visited.has(key)) continue;
      visited.add(key);

      if (opts?.sourceMac) {
        nextState = learnMac(nextState, device.id, ingress.id, opts.sourceMac, vlan);
      }
      for (const iface of device.interfaces) {
        if (iface.sviVlan !== vlan) continue;
        if (!sviHasMemberLink(device, vlan)) continue;
        addHost(device, iface);
      }
      switchEgress(device, vlan, ingress.id);
      continue;
    }

    if (isL2Bridge(device.type)) {
      // Hub / AP / cloud: ripete il frame su tutte le altre porte
      const key = `${device.id}:${node.vlan ?? "x"}:${node.tagged ? "t" : "u"}:${ingress.id}`;
      if (visited.has(key)) continue;
      visited.add(key);
      for (const { iface, end } of linkNeighbors(nextState, device.id)) {
        if (iface.id === ingress.id) continue;
        emit(end, { vlan: node.vlan, tagged: node.tagged });
      }
      continue;
    }

    // Host o router: il frame si ferma qui.
    if (node.tagged && node.vlan != null) {
      // Frame 802.1Q: lo riceve solo la sottointerfaccia con quel tag
      for (const sub of device.interfaces) {
        if (sub.parentIfaceId === ingress.id && sub.vlanTag === node.vlan) {
          addHost(device, sub);
        }
      }
    } else {
      addHost(device, ingress);
    }
  }

  // Riferimenti aggiornati dallo stato finale
  const refreshed = hosts.map((h) => {
    const d = getDevice(nextState, h.device.id)!;
    const iface = getIface(d, h.iface.id)!;
    return { device: d, iface };
  });

  return { hosts: refreshed, state: nextState };
}

export function formatMacTable(device: Device): string {
  const table = device.macTable ?? [];
  const lines = [
    "          Mac Address Table",
    "-------------------------------------------",
    "",
    "Vlan    Mac Address       Type        Ports",
    "----    -----------       --------    -----",
  ];
  if (table.length === 0) {
    lines.push("      (vuota — genera traffico con ping)");
  } else {
    const sorted = [...table].sort(
      (a, b) => a.vlan - b.vlan || a.mac.localeCompare(b.mac),
    );
    for (const e of sorted) {
      const port = device.interfaces.find((i) => i.id === e.portId);
      const portName = port?.name ?? "?";
      lines.push(
        `${String(e.vlan).padEnd(8)}${e.mac.padEnd(18)}${e.type.padEnd(12)}${portName}`,
      );
    }
  }
  return lines.join("\n");
}

export function formatVlanBrief(device: Device): string {
  const vlans = device.vlans ?? [{ id: 1, name: "default" }];
  const lines = [
    "VLAN Name                             Status    Ports",
    "---- -------------------------------- --------- -------------------------------",
  ];
  const usable = vlans.filter((v) => v.id < 1002);
  for (const v of usable) {
    const ports = device.interfaces
      .filter(
        (i) =>
          i.mode === "access" &&
          i.accessVlan === v.id &&
          (i.connectedLinkId || true),
      )
      .map((i) => shortPort(i.name));
    // Also show trunks that allow this vlan? Cisco show vlan brief only shows access ports
    const portStr = ports.slice(0, 12).join(", ");
    lines.push(
      `${String(v.id).padEnd(5)}${v.name.padEnd(33)}active    ${portStr}`,
    );
  }
  return lines.join("\n");
}

export function formatInterfacesStatus(device: Device): string {
  const lines = [
    "Port      Name               Status       Vlan       Duplex  Speed Type",
    "--------- ------------------ ------------ ---------- ------ ----- ------------",
  ];
  for (const i of device.interfaces) {
    const status =
      !i.enabled
        ? "disabled"
        : i.connectedLinkId
          ? "connected"
          : "notconnect";
    const vlan =
      i.mode === "trunk" ? "trunk" : String(i.accessVlan);
    lines.push(
      `${shortPort(i.name).padEnd(10)}${"".padEnd(19)}${status.padEnd(13)}${vlan.padEnd(11)}${"auto".padEnd(7)}${"auto".padEnd(6)}10/100BaseTX`,
    );
  }
  return lines.join("\n");
}

export function formatInterfacesTrunk(device: Device): string {
  const trunks = device.interfaces.filter((i) => i.mode === "trunk");
  if (trunks.length === 0) {
    return "No trunks configured.";
  }
  const lines: string[] = [
    "Port        Mode             Encapsulation  Status        Native vlan",
  ];
  for (const i of trunks) {
    const status = i.connectedLinkId && i.enabled ? "trunking" : "not-trunking";
    lines.push(
      `${shortPort(i.name).padEnd(12)}${"on".padEnd(17)}${"802.1q".padEnd(15)}${status.padEnd(14)}${i.nativeVlan}`,
    );
  }
  lines.push("");
  lines.push("Port        Vlans allowed on trunk");
  for (const i of trunks) {
    const allowed =
      i.allowedVlans === "all" ? "1-4094" : i.allowedVlans.join(",");
    lines.push(`${shortPort(i.name).padEnd(12)}${allowed}`);
  }
  return lines.join("\n");
}

function shortPort(name: string): string {
  return name
    .replace("FastEthernet", "Fa")
    .replace("GigabitEthernet", "Gi")
    .replace("Ethernet", "Et");
}

export function ensureSwitchDefaults(device: Device): Device {
  if (!isManagedSwitch(device.type)) return device;
  return {
    ...device,
    vlans: device.vlans ?? [
      { id: 1, name: "default" },
    ],
    macTable: device.macTable ?? [],
  };
}
