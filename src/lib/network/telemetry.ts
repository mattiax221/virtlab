import { getDevice } from "./engine-helpers";
import type { Device, LabState, SyslogEntry } from "./types";

function nowStamp(): string {
  return new Date().toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    hour12: false,
  });
}

/** Scrive una riga SYSLOG su tutti i Server-PT con SYSLOG abilitato. */
export function appendSyslog(
  state: LabState,
  hostname: string,
  message: string,
): LabState {
  const entry: SyslogEntry = {
    time: nowStamp(),
    hostname,
    message,
  };
  let changed = false;
  const devices = state.devices.map((d) => {
    const syslog = d.services?.syslog;
    if (!syslog?.enabled) return d;
    changed = true;
    const entries = [entry, ...(syslog.entries ?? [])].slice(0, 200);
    return {
      ...d,
      services: {
        ...d.services,
        syslog: { ...syslog, entries },
      },
    };
  });
  return changed ? { ...state, devices } : state;
}

/** Client NTP: sincronizza orologio host/router dal Server-PT NTP. */
export function syncNtp(
  state: LabState,
  clientId: string,
): { state: LabState; message: string } {
  const client = getDevice(state, clientId);
  if (!client) return { state, message: "Device non trovato." };

  const servers = state.devices.filter(
    (d) =>
      d.powered &&
      d.services?.ntp?.enabled &&
      d.interfaces.some((i) => i.ip),
  );
  if (servers.length === 0) {
    return { state, message: "Nessun server NTP raggiungibile." };
  }

  const server = pickNearestNtp(state, client, servers) ?? servers[0]!;
  const datetime = server.services!.ntp!.datetime || new Date().toISOString();

  let next: LabState = {
    ...state,
    devices: state.devices.map((d) =>
      d.id === clientId
        ? { ...d, clockIso: datetime, ntpServerId: server.id }
        : d,
    ),
  };
  next = appendSyslog(
    next,
    client.name,
    `NTP synchronized to ${server.name} (${datetime})`,
  );

  return {
    state: next,
    message: `Orologio sincronizzato con ${server.name}\n${datetime}`,
  };
}

function pickNearestNtp(
  state: LabState,
  client: Device,
  servers: Device[],
): Device | undefined {
  const clientIps = new Set(
    client.interfaces.map((i) => i.ip).filter(Boolean) as string[],
  );
  // Prefer server that shares a /24 with the client (best-effort)
  for (const s of servers) {
    for (const i of s.interfaces) {
      if (!i.ip) continue;
      const prefix = i.ip.split(".").slice(0, 3).join(".");
      for (const cip of clientIps) {
        if (cip.startsWith(prefix + ".")) return s;
      }
    }
  }
  void state;
  return servers[0];
}
