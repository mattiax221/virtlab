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

export function linkNeighbors(
  state: LabState,
  deviceId: string,
): { iface: InterfaceConfig; end: L2Endpoint; link: Link }[] {
  const device = getDevice(state, deviceId);
  if (!device) return [];
  const result: { iface: InterfaceConfig; end: L2Endpoint; link: Link }[] = [];
  for (const iface of device.interfaces) {
    if (!iface.connectedLinkId || !iface.enabled) continue;
    const link = state.links.find((l) => l.id === iface.connectedLinkId);
    if (!link || link.media === "console") continue;
    // Link rosso (cavo sbagliato / spento / no clock) non trasporta frame
    if (!isLinkPhysicallyUp(state, link)) continue;
    const end = otherEnd(state, link, deviceId);
    if (end && end.iface.enabled) result.push({ iface, end, link });
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
 * VLAN-aware L2 flood from a starting device.
 * Returns hosts with IP that share the same broadcast domain (VLAN path).
 * Also returns updated state with MAC learning applied along the walk.
 */
export function l2Flood(
  state: LabState,
  startDeviceId: string,
  opts?: { sourceMac?: string; vlanHint?: number },
): { hosts: L2Endpoint[]; state: LabState } {
  let nextState = state;
  const hosts: L2Endpoint[] = [];
  const seenHostIf = new Set<string>();

  // BFS of (deviceId, vlanId, ingressPortId|null)
  type Node = {
    deviceId: string;
    vlan: number | null;
    ingressPortId: string | null;
    fromDeviceId: string | null;
  };
  const queue: Node[] = [
    {
      deviceId: startDeviceId,
      vlan: opts?.vlanHint ?? null,
      ingressPortId: null,
      fromDeviceId: null,
    },
  ];
  const visited = new Set<string>(); // `${deviceId}:${vlan ?? 'x'}:${ingress}`

  while (queue.length) {
    const node = queue.shift()!;
    const key = `${node.deviceId}:${node.vlan ?? "x"}:${node.ingressPortId ?? "-"}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const device = getDevice(nextState, node.deviceId);
    if (!device) continue;
    // Device spenti non inoltrano (né rispondono come host L2)
    if (!device.powered) continue;

    // Learn source MAC on managed switch ingress
    if (
      opts?.sourceMac &&
      node.ingressPortId &&
      node.vlan != null &&
      isManagedSwitch(device.type)
    ) {
      nextState = learnMac(
        nextState,
        device.id,
        node.ingressPortId,
        opts.sourceMac,
        node.vlan,
      );
    }

    if (!isL2Bridge(device.type)) {
      for (const iface of device.interfaces) {
        if (iface.ip && iface.enabled && !seenHostIf.has(iface.id)) {
          seenHostIf.add(iface.id);
          hosts.push({ device, iface });
        }
      }
    }

    for (const { iface, end } of linkNeighbors(nextState, device.id)) {
      // Don't bounce back out the ingress port
      if (node.ingressPortId && iface.id === node.ingressPortId) continue;

      let vlan = node.vlan;

      if (isManagedSwitch(device.type)) {
        // Leaving this switch via iface
        if (vlan == null) {
          // First hop into a switch from a host: VLAN = access/native of the
          // port that faces the host. That is the *other* side when we just
          // arrived — on start device we're the host; when flooding from
          // switch without vlan, use this egress port's VLAN if access.
          vlan = portAccessVlan(iface);
        }
        if (!portCarriesVlan(iface, vlan)) continue;

        // Enter neighbor
        if (isManagedSwitch(end.device.type)) {
          // Trunk/access into another switch: VLAN must be accepted on peer port
          if (!portCarriesVlan(end.iface, vlan)) continue;
          queue.push({
            deviceId: end.device.id,
            vlan,
            ingressPortId: end.iface.id,
            fromDeviceId: device.id,
          });
        } else if (isL2Bridge(end.device.type) && !isManagedSwitch(end.device.type)) {
          // Hub / AP / cloud — keep VLAN tag conceptually
          queue.push({
            deviceId: end.device.id,
            vlan,
            ingressPortId: end.iface.id,
            fromDeviceId: device.id,
          });
        } else {
          // End host / router — only if access VLAN matches path
          // (router on access port belongs to that VLAN's L2 domain)
          queue.push({
            deviceId: end.device.id,
            vlan,
            ingressPortId: end.iface.id,
            fromDeviceId: device.id,
          });
        }
      } else if (
        device.type === "hub" ||
        device.type === "bridge" ||
        device.type === "repeater" ||
        device.type === "coaxial_splitter" ||
        device.type === "access_point" ||
        device.type === "ap_a" ||
        device.type === "ap_ac" ||
        device.type === "ap_n" ||
        device.type === "ap_3702i" ||
        device.type === "lap" ||
        device.type === "meraki_ap" ||
        device.type === "cloud" ||
        device.type === "cloud_empty" ||
        device.type === "cell_tower"
      ) {
        // Dumb flood — preserve VLAN if any
        if (isManagedSwitch(end.device.type)) {
          const enterVlan = vlan ?? portAccessVlan(end.iface);
          if (!portCarriesVlan(end.iface, enterVlan)) continue;
          queue.push({
            deviceId: end.device.id,
            vlan: enterVlan,
            ingressPortId: end.iface.id,
            fromDeviceId: device.id,
          });
        } else {
          queue.push({
            deviceId: end.device.id,
            vlan,
            ingressPortId: end.iface.id,
            fromDeviceId: device.id,
          });
        }
      } else {
        // Host / router / modem: single hop to neighbor
        if (isManagedSwitch(end.device.type)) {
          const enterVlan = portAccessVlan(end.iface);
          queue.push({
            deviceId: end.device.id,
            vlan: enterVlan,
            ingressPortId: end.iface.id,
            fromDeviceId: device.id,
          });
        } else if (isL2Bridge(end.device.type)) {
          queue.push({
            deviceId: end.device.id,
            vlan: node.vlan,
            ingressPortId: end.iface.id,
            fromDeviceId: device.id,
          });
        } else {
          // Direct host-to-host cable
          queue.push({
            deviceId: end.device.id,
            vlan: node.vlan,
            ingressPortId: end.iface.id,
            fromDeviceId: device.id,
          });
        }
      }
    }
  }

  // Refresh host device refs from nextState
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
