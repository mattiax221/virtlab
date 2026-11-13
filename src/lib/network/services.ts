import { getDevice, getIface } from "./engine-helpers";
import { formatIp, parseIp, sameSubnet } from "./ip";
import { l2Flood } from "./l2";
import { canRoute, pickSourceIface, roundTrip } from "./routing";
import type {
  Device,
  DeviceServices,
  DhcpPool,
  DhcpService,
  DnsRecord,
  HttpService,
  LabState,
} from "./types";

function poolEndIp(startIp: string, maxUsers: number): string {
  const s = parseIp(startIp);
  if (s === null) return startIp;
  return formatIp(s + Math.max(0, maxUsers - 1));
}

/** Normalizza DHCP legacy → pools PT */
export function normalizeDhcp(dhcp: DeviceServices["dhcp"]): DhcpService | undefined {
  if (!dhcp) return undefined;
  if ("pools" in dhcp && Array.isArray((dhcp as DhcpService).pools)) {
    return dhcp as DhcpService;
  }
  // legacy flat pool
  const legacy = dhcp as unknown as {
    enabled?: boolean;
    network?: string;
    mask?: string;
    gateway?: string;
    dns?: string;
    startIp?: string;
    endIp?: string;
    leases?: DhcpPool["leases"];
  };
  const start = legacy.startIp ?? "192.168.1.101";
  const end = parseIp(legacy.endIp ?? "192.168.1.200");
  const st = parseIp(start);
  const maxUsers =
    st !== null && end !== null ? Math.max(1, end - st + 1) : 100;
  return {
    enabled: legacy.enabled ?? true,
    pools: [
      {
        name: "serverPool",
        gateway: legacy.gateway ?? "192.168.1.1",
        dns: legacy.dns ?? "192.168.1.100",
        startIp: start,
        mask: legacy.mask ?? "255.255.255.0",
        maxUsers,
        leases: legacy.leases ?? [],
        locked: true,
      },
    ],
  };
}

export function allDhcpLeases(dhcp: DeviceServices["dhcp"]) {
  const n = normalizeDhcp(dhcp);
  if (!n) return [];
  return n.pools.flatMap((p) => p.leases);
}

/** Default servizi Server-PT (docs Configuring Servers). */
export function defaultServerServices(name: string): DeviceServices {
  return {
    displayName: name,
    gateway: "192.168.1.1",
    dnsServer: "192.168.1.100",
    ipv4Mode: "static",
    algorithm: {
      useGlobal: true,
      maxConnections: 100,
      maxSessions: 50,
      retransmitMs: 2000,
    },
    dhcp: {
      enabled: true,
      pools: [
        {
          name: "serverPool",
          gateway: "192.168.1.1",
          dns: "192.168.1.100",
          startIp: "192.168.1.101",
          mask: "255.255.255.0",
          maxUsers: 100,
          leases: [],
          locked: true,
        },
      ],
    },
    dns: {
      enabled: true,
      records: [
        { name: "server.lab", type: "A", ip: "192.168.1.100" },
        { name: "www.lab", type: "A", ip: "192.168.1.100" },
        { name: "mail.lab", type: "A", ip: "192.168.1.100" },
        { name: "router.lab", type: "A", ip: "192.168.1.1" },
        { name: "www", type: "CNAME", target: "www.lab" },
      ],
      cache: [],
    },
    http: {
      enabled: true,
      https: true,
      pages: [
        {
          name: "index.html",
          body: "<html><body><h1>Server-PT</h1><p>NetLab HTTP</p></body></html>",
        },
        {
          name: "helloworld.html",
          body: "<html><body><h1>Hello World</h1></body></html>",
        },
        {
          name: "image.html",
          body: "<html><body><h1>Image</h1><p>(placeholder)</p></body></html>",
        },
      ],
    },
    tftp: {
      enabled: true,
      images: [
        { name: "c1900-universalk9-mz.SPA.151-4.M4.bin", sizeKb: 72000 },
        { name: "c2960-lanbasek9-mz.150-2.SE4.bin", sizeKb: 18000 },
      ],
    },
    syslog: { enabled: true, entries: [] },
    aaa: {
      enabled: true,
      clients: [
        {
          name: "lab-routers",
          ip: "0.0.0.0",
          secret: "cisco",
          type: "radius",
        },
      ],
      users: [
        { username: "admin", password: "cisco" },
        { username: "cisco", password: "cisco" },
      ],
    },
    ntp: {
      enabled: true,
      datetime: new Date().toISOString(),
      authEnabled: false,
      authKey: "1",
      authPassword: "",
    },
    email: {
      enabled: true,
      smtp: true,
      pop3: true,
      domain: "lab.local",
      users: [
        { username: "admin", password: "cisco" },
        { username: "studente", password: "cisco" },
      ],
      mailboxes: {
        admin: [
          {
            id: "welcome",
            from: "postmaster@lab.local",
            to: "admin@lab.local",
            subject: "Benvenuto su Server-PT",
            body: "Casella EMAIL attiva. Usa il client Desktop per rispondere.",
            time: new Date().toISOString(),
            read: false,
          },
        ],
        studente: [],
      },
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
        { name: "startup-config", size: 1024 },
      ],
    },
  };
}

function nextFreeIp(
  startIp: string,
  maxUsers: number,
  used: Set<string>,
): string | null {
  const start = parseIp(startIp);
  if (start === null) return null;
  const end = start + Math.max(0, maxUsers - 1);
  for (let v = start; v <= end; v++) {
    const ip = formatIp(v);
    if (!used.has(ip)) return ip;
  }
  return null;
}

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

  // DHCPDISCOVER: broadcast nella LAN/VLAN dell’interfaccia (non attraversa router)
  const flood = l2Flood(state, clientId, {
    sourceMac: iface.mac,
    viaIfaceId: iface.id,
  });
  let next = flood.state;

  let server: Device | undefined;
  /** Indirizzo del relay (giaddr) se la richiesta passa da ip helper-address */
  let relayIp: string | null = null;
  for (const h of flood.hosts) {
    if (h.device.id === clientId) continue;
    const d = getDevice(next, h.device.id);
    if (d?.powered && normalizeDhcp(d.services?.dhcp)?.enabled) {
      server = d;
      break;
    }
  }
  if (!server) {
    // Relay: interfaccia di router nella stessa LAN con ip helper-address
    for (const h of flood.hosts) {
      const helper = h.iface.helperAddress;
      if (!helper || !h.iface.ip || !canRoute(h.device)) continue;
      const target = next.devices.find(
        (d) =>
          d.powered &&
          normalizeDhcp(d.services?.dhcp)?.enabled &&
          d.interfaces.some((i) => i.ip === helper),
      );
      if (!target) continue;
      const routerIf = getIface(h.device, h.iface.id)!;
      const out = pickSourceIface(next, h.device, helper);
      if (!out) continue;
      const rt = roundTrip(next, h.device, out, helper, "udp", 67);
      next = rt.state;
      if (!rt.ok) {
        return {
          state: next,
          ok: false,
          message: `Timeout DHCP: il relay ${h.device.name} non raggiunge il server ${helper} (${rt.message ?? "nessuna rotta"}).`,
        };
      }
      server = getDevice(next, target.id);
      relayIp = routerIf.ip;
      break;
    }
  }

  if (!server) {
    return {
      state: next,
      ok: false,
      message:
        "Timeout DHCP: nessun server DHCP nella VLAN/LAN (oltre un router serve ip helper-address).",
    };
  }

  const dhcpSvc = normalizeDhcp(server.services!.dhcp)!;
  // Pool: quello della subnet del relay, altrimenti quello della subnet del server
  const serverIp =
    server.interfaces.find((i) => i.ip && flood.hosts.some((h) => h.iface.id === i.id))?.ip ??
    server.interfaces.find((i) => i.ip)?.ip ??
    null;
  const subnetIp = relayIp ?? serverIp;
  let poolIndex = dhcpSvc.pools.findIndex(
    (p) => subnetIp && p.startIp && p.mask && sameSubnet(p.startIp, subnetIp, p.mask),
  );
  if (poolIndex < 0) {
    if (relayIp) {
      return {
        state: next,
        ok: false,
        message: `Timeout DHCP: sul server ${server.name} nessun pool per la rete di ${relayIp}.`,
      };
    }
    poolIndex = 0;
  }
  const pool = dhcpSvc.pools[poolIndex];
  if (!pool) {
    return { state: next, ok: false, message: "Nessun pool DHCP." };
  }

  const used = new Set<string>();
  for (const p of dhcpSvc.pools) {
    for (const l of p.leases) {
      if (!(l.deviceId === clientId && l.ifaceId === ifaceId)) used.add(l.ip);
    }
  }
  for (const d of next.devices) {
    for (const i of d.interfaces) {
      if (i.ip) used.add(i.ip);
    }
  }

  let ip =
    pool.leases.find((l) => l.deviceId === clientId && l.ifaceId === ifaceId)
      ?.ip ?? null;
  if (!ip || used.has(ip)) {
    ip = nextFreeIp(pool.startIp, pool.maxUsers, used);
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
  const pools = dhcpSvc.pools.map((p, i) =>
    i === poolIndex ? { ...p, leases } : p,
  );

  next = {
    ...next,
    devices: next.devices.map((d) => {
      if (d.id === server.id) {
        return {
          ...d,
          services: {
            ...d.services,
            dhcp: { enabled: true, pools },
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
    message: `DHCP OK: ${ip} mask ${pool.mask} gw ${pool.gateway || "—"} dns ${pool.dns || "—"} (pool ${pool.name} @ ${server.name})`,
  };
}

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
      const dhcp = normalizeDhcp(d.services?.dhcp);
      if (!dhcp) return d;
      let changed = false;
      const pools = dhcp.pools.map((p) => {
        const leases = p.leases.filter(
          (l) => !(l.deviceId === clientId && l.ifaceId === iface.id),
        );
        if (leases.length !== p.leases.length) changed = true;
        return { ...p, leases };
      });
      if (!changed) return d;
      return {
        ...d,
        services: {
          ...d.services,
          dhcp: { enabled: dhcp.enabled, pools },
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

const DEFAULT_DNS_TTL = 300;

function readDnsCache(
  dns: NonNullable<DeviceServices["dns"]>,
  q: string,
  now = Date.now(),
): string | null {
  const hit = dns.cache?.find(
    (c) => c.name.toLowerCase() === q && (!c.expiresAt || c.expiresAt > now),
  );
  return hit?.ip ?? null;
}

function writeDnsCache(
  state: LabState,
  serverId: string,
  name: string,
  ip: string,
  ttl = DEFAULT_DNS_TTL,
): LabState {
  const now = Date.now();
  return {
    ...state,
    devices: state.devices.map((d) => {
      if (d.id !== serverId || !d.services?.dns) return d;
      const dns = d.services.dns;
      const rest = (dns.cache ?? []).filter(
        (c) =>
          c.name.toLowerCase() !== name.toLowerCase() &&
          (!c.expiresAt || c.expiresAt > now),
      );
      return {
        ...d,
        services: {
          ...d.services,
          dns: {
            ...dns,
            cache: [
              {
                name,
                ip,
                ttl,
                expiresAt: now + ttl * 1000,
              },
              ...rest,
            ].slice(0, 64),
          },
        },
      };
    }),
  };
}

export function resolveDnsName(
  state: LabState,
  clientId: string,
  name: string,
): string | null {
  return resolveDnsQuery(state, clientId, name).ip;
}

/** Risolve A/CNAME e aggiorna la DNS Cache del server (TTL). */
export function resolveDnsQuery(
  state: LabState,
  clientId: string,
  name: string,
): { ip: string | null; state: LabState; serverId?: string } {
  const client = getDevice(state, clientId);
  if (!client) return { ip: null, state };
  const q = name.trim().toLowerCase();
  if (!q) return { ip: null, state };

  const dnsIps = new Set<string>();
  for (const i of client.interfaces) {
    for (const d of i.dnsServers) dnsIps.add(d);
  }

  // Server DNS: quelli configurati sul client, se raggiungibili (andata e
  // ritorno); senza DNS configurati, solo quelli nella stessa LAN.
  const candidates: Device[] = [];
  if (dnsIps.size > 0) {
    for (const dnsIp of dnsIps) {
      const d = state.devices.find(
        (x) =>
          x.powered &&
          x.services?.dns?.enabled &&
          x.interfaces.some((i) => i.ip === dnsIp),
      );
      if (!d || candidates.includes(d)) continue;
      if (d.id === client.id) {
        candidates.push(d);
        continue;
      }
      const src = pickSourceIface(state, client, dnsIp);
      if (!src?.ip) continue;
      if (roundTrip(state, client, src, dnsIp, "udp", 53).ok) candidates.push(d);
    }
  } else {
    const flood = l2Flood(state, clientId);
    for (const h of flood.hosts) {
      if (h.device.services?.dns?.enabled && !candidates.includes(h.device)) {
        candidates.push(h.device);
      }
    }
  }

  for (const d of candidates) {
    const cached = readDnsCache(d.services!.dns!, q);
    if (cached) return { ip: cached, state, serverId: d.id };
    const ip = lookupDnsOnServer(d.services!.dns!.records, q);
    if (ip) {
      return {
        ip,
        state: writeDnsCache(state, d.id, q, ip),
        serverId: d.id,
      };
    }
  }
  return { ip: null, state };
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
        },
      };
    }),
  };
}

export function fetchHttp(
  state: LabState,
  clientId: string,
  target: string,
  opts?: { reachable?: boolean; path?: string },
): { ok: boolean; output: string; destIp?: string } {
  let ip = target;
  let path = opts?.path ?? "index.html";
  if (target.includes("/") && !/^\d+\.\d+\.\d+\.\d+$/.test(target)) {
    // host/path
  }
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip.split("/")[0]!)) {
    const host = ip.split("/")[0]!;
    if (ip.includes("/")) path = ip.slice(host.length + 1) || "index.html";
    const resolved = resolveDnsName(state, clientId, host);
    if (!resolved) {
      return { ok: false, output: `Impossibile risolvere: ${host}` };
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
    const client = getDevice(state, clientId);
    const src = client ? pickSourceIface(state, client, ip) : null;
    const reachable =
      client?.id === server.id ||
      (client && src?.ip ? roundTrip(state, client, src, ip, "tcp", 80).ok : false);
    if (!reachable) {
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
  const page =
    http.pages.find((p) => p.name === path || p.name === path.replace(/^\//, "")) ??
    http.pages.find((p) => p.name === "index.html") ??
    http.pages[0];
  return {
    ok: true,
    destIp: ip,
    output: [
      `HTTP/1.1 200 OK`,
      `Server: ${server.name}`,
      `Content-Type: text/html`,
      ``,
      page?.body ?? "<h1>Empty</h1>",
    ].join("\n"),
  };
}

export { poolEndIp };
export type { DnsRecord, HttpService };
