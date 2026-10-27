import { getDevice } from "./engine-helpers";
import { isValidIp } from "./ip";
import { resolveDnsName, requestDhcp, fetchHttp } from "./services";
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
  const packets: SimPacket[] = [];
  let next = state;

  if (!isValidIp(dest)) {
    const resolved = resolveDnsName(state, fromDeviceId, dest);
    if (!resolved) {
      return {
        packets: [],
        state,
        message: `DNS fallito per ${target}`,
      };
    }
    const dnsPath = pathBetween(
      state,
      fromDeviceId,
      findDnsServerId(state, fromDeviceId),
    );
    if (dnsPath.length >= 2) {
      packets.push({
        id: `dns-${Date.now()}`,
        kind: "DNS",
        label: "DNS Query",
        fromDeviceId,
        toDeviceId: dnsPath[dnsPath.length - 1]?.deviceId ?? null,
        hops: dnsPath,
        hopIndex: 0,
        ok: true,
        detail: `A? ${target} → ${resolved}`,
      });
    }
    dest = resolved;
  }

  const { result, state: afterPing } = runPing(next, fromDeviceId, dest);
  next = afterPing;
  const hops = result.hops;
  const path = hopsToPath(next, hops);

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

export function buildDhcpSimulation(
  state: LabState,
  fromDeviceId: string,
  ifaceId?: string,
): { packets: SimPacket[]; state: LabState; message: string } {
  const from = getDevice(state, fromDeviceId);
  if (!from) return { packets: [], state, message: "Host non trovato" };
  const iface =
    from.interfaces.find((i) => i.id === ifaceId) ??
    from.interfaces.find((i) => i.media !== "wireless") ??
    from.interfaces[0];
  if (!iface) return { packets: [], state, message: "Nessuna interfaccia" };

  const server = state.devices.find(
    (d) => d.type === "server" && d.services?.dhcp?.enabled,
  );
  const path = server
    ? pathBetween(state, fromDeviceId, server.id)
    : devicePoint(state, fromDeviceId);

  const result = requestDhcp(state, fromDeviceId, iface.id);
  const leased =
    getDevice(result.state, fromDeviceId)?.interfaces.find((i) => i.id === iface.id)
      ?.ip ?? null;
  const packets: SimPacket[] = [];
  if (path.length >= 1) {
    packets.push({
      id: `dhcp-disc-${Date.now()}`,
      kind: "DHCP",
      label: "DHCP Discover",
      fromDeviceId,
      toDeviceId: server?.id ?? null,
      hops: path.length >= 2 ? path : [...path, ...path],
      hopIndex: 0,
      ok: result.ok,
      detail: "DHCPDISCOVER",
    });
    if (server && path.length >= 2) {
      packets.push({
        id: `dhcp-offer-${Date.now()}`,
        kind: "DHCP",
        label: "DHCP Offer",
        fromDeviceId: server.id,
        toDeviceId: fromDeviceId,
        hops: [...path].reverse(),
        hopIndex: 0,
        ok: result.ok,
        detail: result.ok ? `DHCPOFFER ${leased ?? ""}` : "Nessuna offerta",
      });
      packets.push({
        id: `dhcp-req-${Date.now()}`,
        kind: "DHCP",
        label: "DHCP Request",
        fromDeviceId,
        toDeviceId: server.id,
        hops: path,
        hopIndex: 0,
        ok: result.ok,
        detail: "DHCPREQUEST",
      });
      packets.push({
        id: `dhcp-ack-${Date.now()}`,
        kind: "DHCP",
        label: "DHCP ACK",
        fromDeviceId: server.id,
        toDeviceId: fromDeviceId,
        hops: [...path].reverse(),
        hopIndex: 0,
        ok: result.ok,
        detail: result.ok ? `DHCPACK ${leased ?? ""}` : "NACK",
      });
    }
  }
  return {
    packets,
    state: result.state,
    message: result.ok
      ? `DHCP OK: ${leased ?? ""}`
      : result.message || "DHCP fallito",
  };
}

export function buildDnsSimulation(
  state: LabState,
  fromDeviceId: string,
  name: string,
): { packets: SimPacket[]; state: LabState; message: string } {
  const serverId = findDnsServerId(state, fromDeviceId);
  const path = pathBetween(state, fromDeviceId, serverId);
  const ip = resolveDnsName(state, fromDeviceId, name);
  const packets: SimPacket[] = [];
  if (path.length >= 2) {
    packets.push({
      id: `dns-q-${Date.now()}`,
      kind: "DNS",
      label: "DNS Query",
      fromDeviceId,
      toDeviceId: serverId,
      hops: path,
      hopIndex: 0,
      ok: !!ip,
      detail: `A? ${name}`,
    });
    packets.push({
      id: `dns-a-${Date.now()}`,
      kind: "DNS",
      label: "DNS Answer",
      fromDeviceId: serverId ?? fromDeviceId,
      toDeviceId: fromDeviceId,
      hops: [...path].reverse(),
      hopIndex: 0,
      ok: !!ip,
      detail: ip ? `${name} → ${ip}` : `NXDOMAIN ${name}`,
    });
  }
  return {
    packets,
    state,
    message: ip ? `${name} = ${ip}` : `DNS fallito per ${name}`,
  };
}

export function buildHttpSimulation(
  state: LabState,
  fromDeviceId: string,
  host: string,
): { packets: SimPacket[]; state: LabState; message: string } {
  let destIp = host;
  const packets: SimPacket[] = [];
  let next = state;

  if (!isValidIp(host)) {
    const dns = buildDnsSimulation(state, fromDeviceId, host);
    packets.push(...dns.packets);
    const resolved = resolveDnsName(state, fromDeviceId, host);
    if (!resolved) {
      return { packets, state, message: dns.message };
    }
    destIp = resolved;
  }

  const { result, state: afterPing } = runPing(next, fromDeviceId, destIp);
  next = afterPing;
  const path = hopsToPath(next, result.hops);

  if (path.length >= 2) {
    packets.push({
      id: `arp-http-${Date.now()}`,
      kind: "ARP",
      label: "ARP",
      fromDeviceId,
      toDeviceId: path[1]?.deviceId ?? null,
      hops: path.slice(0, 2),
      hopIndex: 0,
      ok: result.ok,
      detail: `ARP for ${destIp}`,
    });
  }

  const reachable = result.ok;
  const http = fetchHttp(next, fromDeviceId, host, { reachable });
  const serverId = path[path.length - 1]?.deviceId ?? null;
  const ok = reachable && http.ok;

  packets.push({
    id: `http-req-${Date.now()}`,
    kind: "HTTP",
    label: "HTTP GET",
    fromDeviceId,
    toDeviceId: serverId,
    hops: path.length >= 2 ? path : devicePoint(state, fromDeviceId),
    hopIndex: 0,
    ok,
    detail: `GET http://${host}/`,
  });
  if (path.length >= 2) {
    packets.push({
      id: `http-res-${Date.now()}`,
      kind: "HTTP",
      label: ok ? "HTTP 200" : "HTTP ERR",
      fromDeviceId: serverId ?? fromDeviceId,
      toDeviceId: fromDeviceId,
      hops: [...path].reverse(),
      hopIndex: 0,
      ok,
      detail: ok
        ? `200 OK (${http.output.split("\n").slice(-2).join(" ").slice(0, 48)}…)`
        : !reachable
          ? result.message.split("\n")[0] || "Non raggiungibile"
          : http.output || "HTTP fallito",
    });
  }

  return {
    packets,
    state: next,
    message: ok
      ? `HTTP OK da ${host}`
      : !reachable
        ? result.message.split("\n")[0] || "HTTP: non raggiungibile"
        : http.output || "HTTP fallito",
  };
}

/** Auto-pick simulation protocol based on destination device/services. */
export function buildAutoSimulation(
  state: LabState,
  fromDeviceId: string,
  toDeviceId: string,
): { packets: SimPacket[]; state: LabState; message: string } {
  const to = getDevice(state, toDeviceId);
  const from = getDevice(state, fromDeviceId);
  if (!to || !from) {
    return { packets: [], state, message: "Dispositivo non trovato" };
  }

  if (to.services?.http?.enabled) {
    const host =
      to.services.dns?.records.find((r) => r.ip === to.interfaces.find((i) => i.ip)?.ip)
        ?.name ??
      to.interfaces.find((i) => i.ip)?.ip ??
      "www.lab";
    return buildHttpSimulation(state, fromDeviceId, host);
  }
  if (to.services?.dns?.enabled) {
    const name = to.services.dns.records[0]?.name ?? "server.lab";
    return buildDnsSimulation(state, fromDeviceId, name);
  }
  if (to.services?.dhcp?.enabled) {
    return buildDhcpSimulation(state, fromDeviceId);
  }

  const targetIp =
    to.interfaces.find((i) => i.ip)?.ip ?? to.name;
  return buildPingSimulation(state, fromDeviceId, targetIp);
}

function findDnsServerId(
  state: LabState,
  fromDeviceId: string,
): string | null {
  const from = getDevice(state, fromDeviceId);
  const dnsIp = from?.interfaces.find((i) => i.dnsServers?.length)?.dnsServers?.[0];
  if (dnsIp) {
    for (const d of state.devices) {
      if (d.interfaces.some((i) => i.ip === dnsIp)) return d.id;
    }
  }
  const srv = state.devices.find((d) => d.services?.dns?.enabled);
  return srv?.id ?? null;
}

function devicePoint(
  state: LabState,
  id: string,
): { deviceId: string; x: number; y: number; label: string }[] {
  const d = getDevice(state, id);
  if (!d) return [];
  return [{ deviceId: id, x: d.x, y: d.y, label: d.name }];
}

function pathBetween(
  state: LabState,
  fromId: string,
  toId: string | null,
): { deviceId: string; x: number; y: number; label: string }[] {
  const from = getDevice(state, fromId);
  if (!from) return [];
  if (!toId) return devicePoint(state, fromId);
  const to = getDevice(state, toId);
  if (!to) return devicePoint(state, fromId);
  // Path semplificato: source → eventuali switch in comune → dest
  const mid: { deviceId: string; x: number; y: number; label: string }[] = [];
  for (const link of state.links) {
    const touchesFrom =
      link.aDeviceId === fromId || link.bDeviceId === fromId;
    if (!touchesFrom) continue;
    const other =
      link.aDeviceId === fromId ? link.bDeviceId : link.aDeviceId;
    if (other === toId) continue;
    const od = getDevice(state, other);
    if (od && (od.type.startsWith("switch") || od.type === "hub")) {
      mid.push({ deviceId: od.id, x: od.x, y: od.y, label: od.name });
      break;
    }
  }
  return [
    { deviceId: from.id, x: from.x, y: from.y, label: from.name },
    ...mid,
    { deviceId: to.id, x: to.x, y: to.y, label: to.name },
  ];
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
