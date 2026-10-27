import { getDevice } from "./engine-helpers";
import { formatIp, parseIp } from "./ip";
import { l2Flood } from "./l2";
import type {
  Device,
  DeviceServices,
  DhcpPool,
  DnsRecord,
  HttpService,
  LabState,
} from "./types";

export function defaultServerServices(name: string): DeviceServices {
  return {
    dhcp: {
      enabled: true,
      network: "192.168.1.0",
      mask: "255.255.255.0",
      gateway: "192.168.1.1",
      dns: "192.168.1.100",
      startIp: "192.168.1.100",
      endIp: "192.168.1.200",
      leases: [],
    },
    dns: {
      enabled: true,
      records: [
        { name: "server.lab", ip: "192.168.1.100" },
        { name: "www.lab", ip: "192.168.1.100" },
        { name: "router.lab", ip: "192.168.1.1" },
      ],
    },
    http: {
      enabled: true,
      title: `${name} — NetLab Web`,
      body: "Benvenuto sul Server-PT.\nServizio HTTP attivo nel laboratorio.",
    },
  };
}

function ipInRange(ip: string, start: string, end: string): boolean {
  const a = parseIp(ip);
  const s = parseIp(start);
  const e = parseIp(end);
  if (a === null || s === null || e === null) return false;
  return a >= s && a <= e;
}

function nextFreeIp(pool: DhcpPool, used: Set<string>): string | null {
  const start = parseIp(pool.startIp);
  const end = parseIp(pool.endIp);
  if (start === null || end === null) return null;
  for (let v = start; v <= end; v++) {
    const ip = formatIp(v);
    if (!used.has(ip)) return ip;
  }
  return null;
}

/** Find DHCP servers reachable at L2 from client and request a lease */
export function requestDhcp(
  state: LabState,
  clientId: string,
  ifaceId?: string,
): { state: LabState; message: string; ok: boolean } {
  const client = getDevice(state, clientId);
  if (!client) return { state, ok: false, message: "Client non trovato." };
  const iface =
    (ifaceId
      ? client.interfaces.find((i) => i.id === ifaceId)
      : null) ??
    client.interfaces.find(
      (i) => i.connectedLinkId && i.media === "ethernet" && !i.parentIfaceId,
    ) ??
    client.interfaces.find((i) => i.connectedLinkId && !i.parentIfaceId) ??
    client.interfaces[0];
  if (!iface) return { state, ok: false, message: "Interfaccia non trovata." };
  ifaceId = iface.id;
  if (!iface.connectedLinkId && iface.media !== "wireless") {
    // wireless may connect later; still need link for DHCP
  }
  if (!iface.connectedLinkId) {
    return {
      state,
      ok: false,
      message: "Cavo / Wi‑Fi non collegato — DHCP impossibile.",
    };
  }

  const flood = l2Flood(state, clientId, { sourceMac: iface.mac });
  let next = flood.state;

  // Discover DHCP servers in the L2 domain (including the servers themselves)
  const servers: Device[] = [];
  const seen = new Set<string>();
  for (const h of flood.hosts) {
    const d = getDevice(next, h.device.id);
    if (!d || seen.has(d.id)) continue;
    if (d.services?.dhcp?.enabled) {
      servers.push(d);
      seen.add(d.id);
    }
  }
  // Also check any L2-reachable device by walking all devices that appear in flood path
  for (const d of next.devices) {
    if (seen.has(d.id)) continue;
    if (!d.services?.dhcp?.enabled) continue;
    // Must share L2 with client: re-check via flood from server
    const back = l2Flood(next, d.id);
    next = back.state;
    if (back.hosts.some((h) => h.device.id === clientId)) {
      servers.push(getDevice(next, d.id)!);
      seen.add(d.id);
    }
  }

  if (servers.length === 0) {
    return {
      state: next,
      ok: false,
      message: "Timeout DHCP: nessun server DHCP nella VLAN/LAN.",
    };
  }

  const server = servers[0];
  const pool = server.services!.dhcp!;
  const used = new Set<string>();
  for (const l of pool.leases) {
    if (!(l.deviceId === clientId && l.ifaceId === ifaceId)) used.add(l.ip);
  }
  // Also mark static IPs in the domain
  for (const h of flood.hosts) {
    if (h.iface.ip) used.add(h.iface.ip);
  }
  for (const d of next.devices) {
    for (const i of d.interfaces) {
      if (i.ip) used.add(i.ip);
    }
  }

  // Reuse existing lease for same MAC/iface
  let ip =
    pool.leases.find((l) => l.deviceId === clientId && l.ifaceId === ifaceId)
      ?.ip ?? null;
  if (ip && used.has(ip) && !pool.leases.some((l) => l.ip === ip && l.ifaceId === ifaceId)) {
    ip = null;
  }
  if (!ip) {
    // Free this iface from used so we can reassign
    used.delete(
      pool.leases.find((l) => l.deviceId === clientId && l.ifaceId === ifaceId)
        ?.ip ?? "",
    );
    ip = nextFreeIp(pool, used);
  }
  if (!ip) {
    return { state: next, ok: false, message: "Pool DHCP esaurito." };
  }

  const leases = pool.leases.filter(
    (l) => !(l.deviceId === clientId && l.ifaceId === ifaceId),
  );
  leases.push({
    mac: iface.mac,
    ip,
    deviceId: clientId,
    ifaceId,
  });

  next = {
    ...next,
    devices: next.devices.map((d) => {
      if (d.id === server.id) {
        return {
          ...d,
          services: {
            ...d.services,
            dhcp: { ...pool, leases },
          },
        };
      }
      if (d.id === clientId) {
        return {
          ...d,
          interfaces: d.interfaces.map((i) =>
            i.id === ifaceId
              ? {
                  ...i,
                  ip,
                  mask: pool.mask,
                  gateway: pool.gateway || null,
                  dhcpClient: true,
                  dnsServers: pool.dns ? [pool.dns] : [],
                }
              : i,
          ),
        };
      }
      return d;
    }),
  };

  return {
    state: next,
    ok: true,
    message: `DHCP OK: ${ip} mask ${pool.mask} gw ${pool.gateway || "—"} dns ${pool.dns || "—"} (da ${server.name})`,
  };
}

export function resolveDnsName(
  state: LabState,
  clientId: string,
  name: string,
): string | null {
  const client = getDevice(state, clientId);
  if (!client) return null;
  const q = name.trim().toLowerCase();
  if (!q) return null;

  const dnsIps = new Set<string>();
  for (const i of client.interfaces) {
    for (const d of i.dnsServers) dnsIps.add(d);
  }

  // Search DNS servers by IP, or any enabled DNS service in L2 domain
  const flood = l2Flood(state, clientId);
  const candidates: Device[] = [];
  for (const d of flood.state.devices) {
    if (!d.services?.dns?.enabled) continue;
    const hasIp = d.interfaces.some((i) => i.ip && dnsIps.has(i.ip));
    const inDomain = flood.hosts.some((h) => h.device.id === d.id);
    if (hasIp || inDomain || dnsIps.size === 0) candidates.push(d);
  }

  for (const d of candidates) {
    const rec = d.services?.dns?.records.find(
      (r) => r.name.toLowerCase() === q,
    );
    if (rec) return rec.ip;
  }
  // Hostname match
  for (const h of flood.hosts) {
    if (h.device.name.toLowerCase() === q && h.iface.ip) return h.iface.ip;
  }
  return null;
}

export function updateDeviceServices(
  state: LabState,
  deviceId: string,
  patch: Partial<DeviceServices>,
): LabState {
  return {
    ...state,
    devices: state.devices.map((d) => {
      if (d.id !== deviceId) return d;
      return {
        ...d,
        services: {
          ...d.services,
          ...patch,
          dhcp: patch.dhcp
            ? { ...(d.services?.dhcp as DhcpPool), ...patch.dhcp }
            : d.services?.dhcp,
          dns: patch.dns
            ? {
                enabled: patch.dns.enabled ?? d.services?.dns?.enabled ?? true,
                records: patch.dns.records ?? d.services?.dns?.records ?? [],
              }
            : d.services?.dns,
          http: patch.http
            ? { ...(d.services?.http as HttpService), ...patch.http }
            : d.services?.http,
        },
      };
    }),
  };
}

export function fetchHttp(
  state: LabState,
  clientId: string,
  target: string,
): { ok: boolean; output: string } {
  let ip = target;
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(target)) {
    const resolved = resolveDnsName(state, clientId, target);
    if (!resolved) {
      return { ok: false, output: `Impossibile risolvere: ${target}` };
    }
    ip = resolved;
  }
  const flood = l2Flood(state, clientId);
  // Also try via gateway later — for now L2 or any host with that IP in lab
  let server: Device | undefined;
  for (const d of state.devices) {
    if (d.interfaces.some((i) => i.ip === ip) && d.services?.http?.enabled) {
      server = d;
      break;
    }
  }
  if (!server) {
    return { ok: false, output: `Nessun servizio HTTP su ${ip}` };
  }
  // Reachability: same L2 or through router (simplified: any path via ping logic omitted — check L2 first)
  const onL2 = flood.hosts.some((h) => h.device.id === server!.id);
  if (!onL2) {
    // allow if client has gateway (assume routed) when server has IP
    const client = getDevice(state, clientId);
    const hasGw = client?.interfaces.some((i) => i.gateway);
    if (!hasGw) {
      return { ok: false, output: `Host ${ip} non raggiungibile.` };
    }
  }
  const http = server.services!.http!;
  return {
    ok: true,
    output: [
      `HTTP/1.1 200 OK`,
      `Server: ${server.name}`,
      `Content-Type: text/plain`,
      ``,
      http.title,
      ``,
      http.body,
    ].join("\n"),
  };
}

export type { DnsRecord };
