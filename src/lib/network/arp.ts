import { getDevice } from "./engine-helpers";
import type { ArpEntry, Device, LabState } from "./types";

export function learnArp(
  state: LabState,
  deviceId: string,
  ip: string,
  mac: string,
  ifaceId: string,
): LabState {
  const device = getDevice(state, deviceId);
  if (!device || !ip || !mac) return state;
  const table = [...(device.arpTable ?? [])];
  const idx = table.findIndex((e) => e.ip === ip);
  const entry: ArpEntry = { ip, mac, ifaceId, type: "dynamic", ageSec: 0 };
  if (idx >= 0) table[idx] = entry;
  else table.push(entry);
  while (table.length > 64) table.shift();
  return {
    ...state,
    devices: state.devices.map((d) =>
      d.id === deviceId ? { ...d, arpTable: table } : d,
    ),
  };
}

export function formatArpTable(device: Device): string {
  const rows = device.arpTable ?? [];
  if (rows.length === 0) {
    return "Protocol  Address          Age (min)  Hardware Addr   Type  Interface\n";
  }
  const lines = [
    "Protocol  Address          Age (min)  Hardware Addr   Type  Interface",
  ];
  for (const e of rows) {
    const iface =
      device.interfaces.find((i) => i.id === e.ifaceId)?.name ?? "?";
    lines.push(
      `Internet  ${e.ip.padEnd(16)} ${String(e.ageSec ?? 0).padStart(9)}  ${e.mac}  ${e.type.padEnd(5)} ${iface}`,
    );
  }
  return lines.join("\n");
}
