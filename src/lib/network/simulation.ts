import { getDevice } from "./engine-helpers";
import { isValidIp } from "./ip";
import { sendPrintJob } from "./print";
import {
  resolveDnsName,
  resolveDnsQuery,
  requestDhcp,
  fetchHttp,
} from "./services";
import { runPing } from "./engine";
import type { LabState, PingHop } from "./types";

export type SimPacket = {
  id: string;
  kind: "ICMP" | "ARP" | "DHCP" | "DNS" | "HTTP" | "PRINT";
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
  const path = hopsToPath(next, hops, {
    allowWireless: sourceUsesWireless(next, fromDeviceId, dest),
  });

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
  const resolved = resolveDnsQuery(state, fromDeviceId, name);
  const next = resolved.state;
  const serverId = resolved.serverId ?? findDnsServerId(next, fromDeviceId);
  const path = pathBetween(next, fromDeviceId, serverId);
  const ip = resolved.ip;
  const packets: SimPacket[] = [];
  if (path.length >= 2) {
    packets.push({
      id: `dns-q-${Date.now()}`,
      kind: "DNS",
      label: "DNS Query",
      fromDeviceId,
      toDeviceId: serverId ?? null,
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
    state: next,
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
  const path = hopsToPath(next, result.hops, {
    allowWireless: sourceUsesWireless(next, fromDeviceId, destIp),
  });

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

/** Stampa remota PC → Printer-PT con PDU animati sulla griglia. */
export function buildPrintSimulation(
  state: LabState,
  fromDeviceId: string,
  target: string,
): { packets: SimPacket[]; state: LabState; message: string } {
  const packets: SimPacket[] = [];
  let dest = target;
  let next = state;

  if (!isValidIp(dest)) {
    const dns = buildDnsSimulation(state, fromDeviceId, dest);
    packets.push(...dns.packets);
    const resolved = resolveDnsName(dns.state, fromDeviceId, dest);
    if (!resolved) {
      return { packets, state: dns.state, message: dns.message };
    }
    dest = resolved;
    next = dns.state;
  }

  const printed = sendPrintJob(next, fromDeviceId, dest);
  next = printed.state;

  const printerId =
    printed.printerId ??
    next.devices.find(
      (d) =>
        d.type === "printer" && d.interfaces.some((i) => i.ip === dest),
    )?.id ??
    null;

  // Percorso lungo i cavi (BFS). Wi‑Fi solo se la NIC usata dal PC è wireless.
  const allowWireless = sourceUsesWireless(next, fromDeviceId, dest);
  let path =
    printerId != null
      ? cablePathBetween(next, fromDeviceId, printerId, { allowWireless })
      : devicePoint(next, fromDeviceId);
  // Fallback: espandi gli hop del ping (inserisce comunque gli switch sul cavo)
  if (path.length < 2) {
    const reach = runPing(next, fromDeviceId, dest);
    path = hopsToPath(reach.state, reach.result.hops, { allowWireless });
  }

  if (path.length >= 2) {
    packets.push({
      id: `arp-print-${Date.now()}`,
      kind: "ARP",
      label: "ARP",
      fromDeviceId,
      toDeviceId: path[1]?.deviceId ?? null,
      hops: path.slice(0, 2),
      hopIndex: 0,
      ok: printed.ok,
      detail: allowWireless
        ? `ARP (Wi‑Fi) for ${dest}`
        : `ARP via cavo → ${path[1]?.label ?? "peer"}`,
    });
  }

  packets.push({
    id: `print-job-${Date.now()}`,
    kind: "PRINT",
    label: "LPR / Print Job",
    fromDeviceId,
    toDeviceId: printerId,
    hops: path.length >= 2 ? path : devicePoint(next, fromDeviceId),
    hopIndex: 0,
    ok: printed.ok,
    detail: printed.ok
      ? `Job ${printed.job?.id ?? ""} → ${printed.job?.pages ?? "?"} pg @ ${dest}` +
        (allowWireless ? " [Wi‑Fi]" : " [cablato]")
      : printed.message.split("\n")[0],
  });

  if (printed.ok && path.length >= 2) {
    packets.push({
      id: `print-ack-${Date.now()}`,
      kind: "PRINT",
      label: "Print ACK",
      fromDeviceId: printerId ?? fromDeviceId,
      toDeviceId: fromDeviceId,
      hops: [...path].reverse(),
      hopIndex: 0,
      ok: true,
      detail: `ACK coda ${getDevice(next, printerId ?? "")?.name ?? "printer"}`,
    });
  }

  return { packets, state: next, message: printed.message };
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

  if (to.type === "printer") {
    const ip = to.interfaces.find((i) => i.ip)?.ip;
    if (!ip) {
      return {
        packets: [],
        state,
        message: `${to.name}: configura un IP (Config → Static/DHCP) prima di stampare.`,
      };
    }
    return buildPrintSimulation(state, fromDeviceId, ip);
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

type PathNode = {
  deviceId: string;
  x: number;
  y: number;
  label: string;
};

function devicePoint(state: LabState, id: string): PathNode[] {
  const d = getDevice(state, id);
  if (!d) return [];
  return [{ deviceId: id, x: d.x, y: d.y, label: d.name }];
}

/**
 * BFS lungo i link reali. Di default esclude i link wireless
 * (animazione “via cavo”: PC → switch → stampante).
 */
function cablePathBetween(
  state: LabState,
  fromId: string,
  toId: string | null,
  opts?: { allowWireless?: boolean },
): PathNode[] {
  const from = getDevice(state, fromId);
  if (!from) return [];
  if (!toId) return devicePoint(state, fromId);
  const to = getDevice(state, toId);
  if (!to) return devicePoint(state, fromId);
  if (fromId === toId) return devicePoint(state, fromId);

  const allowWireless = opts?.allowWireless ?? false;
  const prev = new Map<string, string | null>();
  prev.set(fromId, null);
  const queue: string[] = [fromId];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === toId) break;
    for (const link of state.links) {
      if (link.aDeviceId !== cur && link.bDeviceId !== cur) continue;
      const other = link.aDeviceId === cur ? link.bDeviceId : link.aDeviceId;
      if (prev.has(other)) continue;

      const isWifiLink =
        link.media === "wireless" ||
        (() => {
          const a = getDevice(state, link.aDeviceId);
          const b = getDevice(state, link.bDeviceId);
          const aIf = a?.interfaces.find((i) => i.id === link.aIfaceId);
          const bIf = b?.interfaces.find((i) => i.id === link.bIfaceId);
          return aIf?.media === "wireless" || bIf?.media === "wireless";
        })();
      if (isWifiLink && !allowWireless) continue;

      const peer = getDevice(state, other);
      if (peer && !peer.powered) continue;

      prev.set(other, cur);
      queue.push(other);
    }
  }

  if (!prev.has(toId)) {
    // Nessun percorso cablato: non inventare una linea diretta “wireless”
    return devicePoint(state, fromId);
  }

  const ids: string[] = [];
  let walk: string | null = toId;
  while (walk) {
    ids.push(walk);
    walk = prev.get(walk) ?? null;
  }
  ids.reverse();
  return ids.map((id) => {
    const d = getDevice(state, id)!;
    return { deviceId: id, x: d.x, y: d.y, label: d.name };
  });
}

/** True se la sorgente raggiunge `destIp` dalla NIC Wi‑Fi (non Ethernet). */
function sourceUsesWireless(
  state: LabState,
  fromDeviceId: string,
  destIp: string,
): boolean {
  const from = getDevice(state, fromDeviceId);
  if (!from) return false;
  // Preferisci Ethernet cablata se ha IP e cavo
  const eth = from.interfaces.find(
    (i) =>
      !i.parentIfaceId &&
      i.enabled &&
      i.ip &&
      i.connectedLinkId &&
      (i.media === "ethernet" || i.media === "fiber"),
  );
  if (eth) return false;
  const wifi = from.interfaces.find(
    (i) =>
      !i.parentIfaceId &&
      i.enabled &&
      i.ip &&
      i.media === "wireless" &&
      i.connectedLinkId,
  );
  if (!wifi) return false;
  // Se l’unica NIC con IP verso quella rete è Wi‑Fi
  void destIp;
  return true;
}

function pathBetween(
  state: LabState,
  fromId: string,
  toId: string | null,
  opts?: { allowWireless?: boolean },
): PathNode[] {
  return cablePathBetween(state, fromId, toId, opts);
}

/**
 * Espande gli hop L3 (PC → stampante) inserendo switch/hub lungo i cavi.
 */
function hopsToPath(
  state: LabState,
  hops: PingHop[],
  opts?: { allowWireless?: boolean },
): PathNode[] {
  if (hops.length === 0) return [];
  if (hops.length === 1) {
    const d = getDevice(state, hops[0].deviceId);
    return d
      ? [
          {
            deviceId: d.id,
            x: d.x,
            y: d.y,
            label: `${hops[0].deviceName}\n${hops[0].ip}`,
          },
        ]
      : [];
  }

  const allowWireless = opts?.allowWireless ?? false;
  const full: PathNode[] = [];
  for (let i = 0; i < hops.length - 1; i++) {
    const segment = cablePathBetween(
      state,
      hops[i].deviceId,
      hops[i + 1].deviceId,
      { allowWireless },
    );
    if (segment.length === 0) continue;
    if (full.length > 0) segment.shift();
    // etichetta IP sugli estremi L3
    if (segment.length) {
      segment[0] = {
        ...segment[0],
        label: `${hops[i].deviceName}\n${hops[i].ip}`,
      };
      const last = segment[segment.length - 1];
      segment[segment.length - 1] = {
        ...last,
        label: `${hops[i + 1].deviceName}\n${hops[i + 1].ip}`,
      };
    }
    full.push(...segment);
  }
  return full;
}
