import type { Device, InterfaceConfig, LabState } from "./types";

export function getDevice(state: LabState, id: string): Device | undefined {
  return state.devices.find((d) => d.id === id);
}

export function getIface(
  device: Device,
  ifaceId: string,
): InterfaceConfig | undefined {
  return device.interfaces.find((i) => i.id === ifaceId);
}
