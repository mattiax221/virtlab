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

/** Default servizi Server-PT (DHCP/DNS/HTTP/Email/FTP/AAA). */
export function defaultServerServices(name: string): DeviceServices {
  return {
    domain: "lab.local",
    dhcp: {
      enabled: true,
      network: "192.168.1.0",
      mask: "255.255.255.0",
      gateway: "192.168.1.1",
      dns: "192.168.1.100",
      startIp: "192.168.1.101",
      endIp: "192.168.1.200",
      leases: [],
    },
    dns: {
      enabled: true,
      records: [
        { name: "server.lab", type: "A", ip: "192.168.1.100" },
        { name: "www.lab", type: "A", ip: "192.168.1.100" },
        { name: "mail.lab", type: "A", ip: "192.168.1.100" },
        { name: "router.lab", type: "A", ip: "192.168.1.1" },
        { name: "www", type: "CNAME", target: "server.lab" },
      ],
    },
    http: {
      enabled: true,
      https: true,
      title: `${name} — NetLab Web`,
      body: "Benvenuto sul Server-PT.\nHTTP/HTTPS attivo. Configura DNS/Email/FTP dal pannello Servizi.",
      pages: [
        { name: "index.html", body: "<h1>Server-PT</h1><p>NetLab</p>" },
        { name: "helloworld.html", body: "<h1>Hello World</h1>" },
      ],
    },
    email: {
      enabled: true,
      smtp: true,
      pop3: true,
      domain: "lab.local",
      users: [
        { username: "admin", password: "cisco" },
        { username: "user1", password: "cisco" },
      ],
    },
    ftp: {
      enabled: true,
      accounts: [
        {
          username: "cisco",
          password: "cisco",
          permissions: {
            write: true,
            read: true,
            delete: true,
            rename: true,
            list: true,
          },
        },
      ],
      files: [
        { name: "readme.txt", size: 48 },
        { name: "secret.txt", size: 32 },
      ],
    },
    aaa: {
      enabled: false,
      clients: [],
      users: [{ username: "admin", password: "cisco" }],
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
  if (!iface.connectedLinkId) {
    return {
      state,
      ok: false,
      message: "Cavo / Wi‑Fi non collegato — DHCP impossibile.",
    };
  }

  const flood = l2Flood(state, clientId, { sourceMac: iface.mac });
  let next = flood.state;

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
  for (const d of next.devices) {
    if (seen.has(d.id)) continue;
    if (!d.services?.dhcp?.enabled) continue;
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
  for (const h of flood.hosts) {
    if (h.iface.ip) used.add(h.iface.ip);
  }
  for (const d of next.devices) {
    for (const i of d.interfaces) {
      if (i.ip) used.add(i.ip);
    }
  }

  let ip =
    pool.leases.find((l) => l.deviceId === clientId && l.ifaceId === ifaceId)
      ?.ip ?? null;
  if (
    ip &&
    used.has(ip) &&
    !pool.leases.some((l) => l.ip === ip && l.ifaceId === ifaceId)
  ) {
    ip = null;
  }
  if (!ip) {
    used.delete(
      pool.leases.find((l) => l.deviceId === clientId && l.ifaceId === ifaceId)
        ?.ip ?? "",
    );
    ip = nextFreeIp(pool, used);
  }
  if (!ip) {
    return { state: next, ok: false, message: "Pool DHCP esaurito." };
  }
  if (!ipInRange(ip, pool.startIp, pool.endIp) && !pool.leases.some((l) => l.ip === ip)) {
    ip = nextFreeIp(pool, used) ?? ip;
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

/** Rilascia IP sul client e rimuove il lease dai server DHCP della LAN. */
export function releaseDhcp(
  state: LabState,
  clientId: string,
  ifaceId?: string,
): { state: LabState; message: string } {
  const client = getDevice(state, clientId);
  if (!client) return { state, message: "Client non trovato." };
  const iface =
    (ifaceId
      ? client.interfaces.find((i) => i.id === ifaceId)
      : null) ??
    client.interfaces.find(
      (i) => i.connectedLinkId && i.media === "ethernet" && !i.parentIfaceId,
    ) ??
    client.interfaces.find((i) => i.connectedLinkId && !i.parentIfaceId) ??
    client.interfaces[0];
  if (!iface) return { state, message: "Nessuna interfaccia." };

  let next: LabState = {
    ...state,
    devices: state.devices.map((d) => {
      if (d.id !== clientId) return d;
      return {
        ...d,
        interfaces: d.interfaces.map((i) =>
          i.id === iface.id
            ? {
                ...i,
                ip: null,
                mask: null,
                gateway: null,
                dhcpClient: true,
                dnsServers: [],
              }
            : i,
        ),
      };
    }),
  };

  next = {
    ...next,
    devices: next.devices.map((d) => {
      const dhcp = d.services?.dhcp;
      if (!dhcp?.leases?.length) return d;
      const leases = dhcp.leases.filter(
        (l) => !(l.deviceId === clientId && l.ifaceId === iface.id),
      );
      if (leases.length === dhcp.leases.length) return d;
      return {
        ...d,
        services: {
          ...d.services,
          dhcp: { ...dhcp, leases },
        },
      };
    }),
  };

  return { state: next, message: "Indirizzo IP rilasciato." };
}

function lookupDnsOnServer(
  records: DnsRecord[],
  q: string,
  depth = 0,
): string | null {
  if (depth > 5) return null;
  const rec = records.find((r) => r.name.toLowerCase() === q);
  if (!rec) return null;
  const t = rec.type ?? "A";
  if (t === "A" && rec.ip) return rec.ip;
  if ((t === "CNAME" || t === "NS") && rec.target) {
    const next = rec.target.toLowerCase();
    const asA = records.find(
      (r) =>
        r.name.toLowerCase() === next && (r.type ?? "A") === "A" && r.ip,
    );
    if (asA?.ip) return asA.ip;
    return lookupDnsOnServer(records, next, depth + 1);
  }
  if (rec.ip) return rec.ip;
  return null;
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

  const flood = l2Flood(state, clientId);
  const candidates: Device[] = [];
  for (const d of flood.state.devices) {
    if (!d.services?.dns?.enabled) continue;
    const hasIp = d.interfaces.some((i) => i.ip && dnsIps.has(i.ip));
    const inDomain = flood.hosts.some((h) => h.device.id === d.id);
    if (hasIp || inDomain || dnsIps.size === 0) candidates.push(d);
  }

  for (const d of candidates) {
    const ip = lookupDnsOnServer(d.services!.dns!.records, q);
    if (ip) return ip;
  }

  // Fallback: qualsiasi DNS abilitato nel lab
  for (const d of state.devices) {
    if (!d.services?.dns?.enabled) continue;
    const ip = lookupDnsOnServer(d.services.dns.records, q);
    if (ip) return ip;
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
          email: patch.email ?? d.services?.email,
          ftp: patch.ftp ?? d.services?.ftp,
          aaa: patch.aaa ?? d.services?.aaa,
          domain: patch.domain ?? d.services?.domain,
        },
      };
    }),
  };
}

/**
 * HTTP GET simulato. Passa `reachable: true` solo dopo un ping/rotta ok.
 */
export function fetchHttp(
  state: LabState,
  clientId: string,
  target: string,
  opts?: { reachable?: boolean },
): { ok: boolean; output: string; destIp?: string } {
  let ip = target;
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(target)) {
    const resolved = resolveDnsName(state, clientId, target);
    if (!resolved) {
      return { ok: false, output: `Impossibile risolvere: ${target}` };
    }
    ip = resolved;
  }
  let server: Device | undefined;
  for (const d of state.devices) {
    if (d.interfaces.some((i) => i.ip === ip) && d.services?.http?.enabled) {
      server = d;
      break;
    }
  }
  if (!server) {
    return { ok: false, output: `Nessun servizio HTTP su ${ip}`, destIp: ip };
  }
  if (!opts?.reachable) {
    const flood = l2Flood(state, clientId);
    const onL2 = flood.hosts.some((h) => h.device.id === server!.id);
    if (!onL2) {
      return {
        ok: false,
        output: `Host ${ip} non raggiungibile (verifica routing / usa ping).`,
        destIp: ip,
      };
    }
  }
  if (!server.powered) {
    return { ok: false, output: `Host ${ip} spento.`, destIp: ip };
  }
  const http = server.services!.http!;
  return {
    ok: true,
    destIp: ip,
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
