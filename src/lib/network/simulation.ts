import { getDevice } from "./engine-helpers";
import { isValidIp } from "./ip";
import { resolveDnsName } from "./services";
import { runPing } from "./engine";
import type { LabState, PingHop } from "./types";

export type SimPacket = {
  id: string;
  kind: "ICMP" | "ARP" | "DHCP" | "DNS" | "HTTP";
  label: string;
  fromDeviceId: string;
  toDeviceId: string | null;
  hops: { deviceId: string; x: number; y: number; label: string }[];
  hopIndex: number;
  ok: boolean;
  detail: string;
};

export function buildPingSimulation(
  state: LabState,
  fromDeviceId: string,
  target: string,
): { packets: SimPacket[]; state: LabState; message: string } {
  let dest = target;
  if (!isValidIp(dest)) {
    const resolved = resolveDnsName(state, fromDeviceId, dest);
    if (!resolved) {
      return {
        packets: [],
        state,
        message: `DNS fallito per ${target}`,
      };
    }
    dest = resolved;
  }

  const { result, state: next } = runPing(state, fromDeviceId, dest);
  const hops = result.hops;
  const path = hopsToPath(next, hops);
  const packets: SimPacket[] = [];

  // ARP before ICMP if same subnet path length >= 2
  if (path.length >= 2) {
    packets.push({
      id: `arp-${Date.now()}`,
      kind: "ARP",
      label: "ARP Who has?",
      fromDeviceId,
      toDeviceId: path[1]?.deviceId ?? null,
      hops: path.slice(0, 2),
      hopIndex: 0,
      ok: result.ok,
      detail: `ARP request for ${dest}`,
    });
  }

  packets.push({
    id: `icmp-${Date.now()}`,
    kind: "ICMP",
    label: "ICMP Echo",
    fromDeviceId,
    toDeviceId: path[path.length - 1]?.deviceId ?? null,
    hops: path,
    hopIndex: 0,
    ok: result.ok,
    detail: result.ok
      ? `Echo request → ${dest}`
      : `Echo fallito: ${result.message.split("\n")[0]}`,
  });

  if (result.ok && path.length >= 2) {
    packets.push({
      id: `icmp-reply-${Date.now()}`,
      kind: "ICMP",
      label: "ICMP Reply",
      fromDeviceId: path[path.length - 1].deviceId,
      toDeviceId: fromDeviceId,
      hops: [...path].reverse(),
      hopIndex: 0,
      ok: true,
      detail: `Echo reply from ${dest}`,
    });
  }

  return { packets, state: next, message: result.message };
}

function hopsToPath(
  state: LabState,
  hops: PingHop[],
): { deviceId: string; x: number; y: number; label: string }[] {
  return hops.map((h) => {
    const d = getDevice(state, h.deviceId);
    return {
      deviceId: h.deviceId,
      x: d?.x ?? 0,
      y: d?.y ?? 0,
      label: `${h.deviceName}\n${h.ip}`,
    };
  });
}
