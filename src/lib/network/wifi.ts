import { getDevice, getIface } from "./engine-helpers";
import type {
  Device,
  DeviceKind,
  InterfaceConfig,
  LabState,
  Link,
  WifiRadio,
} from "./types";

/** Local uid to avoid circular import with engine */
let wifiId = 0;
function wifiUid(prefix: string): string {
  wifiId += 1;
  return `${prefix}-w${wifiId}`;
}

function deleteLinkLocal(state: LabState, linkId: string): LabState {
  const links = state.links.filter((l) => l.id !== linkId);
  const devices = state.devices.map((d) => ({
    ...d,
    interfaces: d.interfaces.map((i) =>
      i.connectedLinkId === linkId ? { ...i, connectedLinkId: null } : i,
    ),
  }));
  return { devices, links };
}

export type WifiNetworkInfo = {
  deviceId: string;
  deviceName: string;
  ssid: string;
  security: WifiRadio["security"];
  channel: number;
  band: WifiRadio["band"];
  signal: number; // 0-100
  connected: boolean;
};

export function isWifiAp(type: DeviceKind): boolean {
  return (
    type === "access_point" ||
    type === "ap_a" ||
    type === "ap_ac" ||
    type === "ap_n" ||
    type === "ap_3702i" ||
    type === "lap" ||
    type === "meraki_ap" ||
    type === "wireless_router" ||
    type === "home_router" ||
    type === "home_gateway"
  );
}

export function defaultWifiRadio(name: string): WifiRadio {
  return {
    ssid: `NetLab-${name}`,
    security: "wpa2",
    password: "cisco123",
    channel: 6,
    enabled: true,
    band: "2.4",
  };
}

export function clientWifiIface(device: Device): InterfaceConfig | undefined {
  return device.interfaces.find(
    (i) => i.media === "wireless" && !i.parentIfaceId && i.enabled,
  );
}

export function apWifiIface(device: Device): InterfaceConfig | undefined {
  // Prefer dedicated Wireless0; else any wireless media port
  return (
    device.interfaces.find(
      (i) =>
        i.media === "wireless" &&
        !i.parentIfaceId &&
        i.enabled &&
        i.name.toLowerCase().includes("wireless"),
    ) ??
    device.interfaces.find(
      (i) => i.media === "wireless" && !i.parentIfaceId && i.enabled,
    )
  );
}

function signalBetween(a: Device, b: Device): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // Canvas distances: ~100 = strong, ~500 = weak
  const s = Math.max(5, Math.min(100, Math.round(100 - dist / 5)));
  return s;
}

export function scanWifiNetworks(
  state: LabState,
  clientId: string,
): WifiNetworkInfo[] {
  const client = getDevice(state, clientId);
  if (!client || !client.powered) return [];
  const wifiIf = clientWifiIface(client);
  if (!wifiIf) return [];

  const connectedApId = (() => {
    if (!wifiIf.connectedLinkId) return null;
    const link = state.links.find((l) => l.id === wifiIf.connectedLinkId);
    if (!link) return null;
    return link.aDeviceId === clientId ? link.bDeviceId : link.aDeviceId;
  })();

  const list: WifiNetworkInfo[] = [];
  for (const d of state.devices) {
    if (d.id === clientId) continue;
    if (!isWifiAp(d.type) || !d.powered) continue;
    const radio = d.wifi;
    if (!radio?.enabled || !radio.ssid.trim()) continue;
    if (!apWifiIface(d)) continue;
    list.push({
      deviceId: d.id,
      deviceName: d.name,
      ssid: radio.ssid,
      security: radio.security,
      channel: radio.channel,
      band: radio.band,
      signal: signalBetween(client, d),
      connected: connectedApId === d.id,
    });
  }
  return list.sort((a, b) => b.signal - a.signal || a.ssid.localeCompare(b.ssid));
}

export function updateWifiRadio(
  state: LabState,
  deviceId: string,
  patch: Partial<WifiRadio>,
): LabState {
  return {
    ...state,
    devices: state.devices.map((d) => {
      if (d.id !== deviceId) return d;
      const base = d.wifi ?? defaultWifiRadio(d.name);
      return { ...d, wifi: { ...base, ...patch } };
    }),
  };
}

export function disconnectWifi(
  state: LabState,
  clientId: string,
): { state: LabState; error?: string } {
  const client = getDevice(state, clientId);
  if (!client) return { state, error: "Client non trovato." };
  const wifiIf = clientWifiIface(client);
  if (!wifiIf?.connectedLinkId) return { state };
  return { state: deleteLinkLocal(state, wifiIf.connectedLinkId) };
}

export function connectWifi(
  state: LabState,
  clientId: string,
  apId: string,
  password?: string,
): { state: LabState; error?: string } {
  const client = getDevice(state, clientId);
  const ap = getDevice(state, apId);
  if (!client || !ap) return { state, error: "Dispositivo non trovato." };
  if (!client.powered || !ap.powered) {
    return { state, error: "Entrambi i dispositivi devono essere accesi." };
  }
  const radio = ap.wifi;
  if (!radio?.enabled) return { state, error: "Radio Wi‑Fi disattivata sull’AP." };
  if (radio.security === "wpa2") {
    if ((password ?? "") !== radio.password) {
      return { state, error: "Password Wi‑Fi non corretta." };
    }
  }

  const clientIf = clientWifiIface(client);
  const apIf = apWifiIface(ap);
  if (!clientIf) {
    return {
      state,
      error: "Nessuna scheda Wi‑Fi sul PC. Physical → installa Wireless NIC.",
    };
  }
  if (!apIf) return { state, error: "L’AP non ha un’interfaccia wireless." };

  // Drop existing wireless association on client
  let next = state;
  if (clientIf.connectedLinkId) {
    next = deleteLinkLocal(next, clientIf.connectedLinkId);
  }
  let aIf = getIface(getDevice(next, apId)!, apIf.id)!;

  // One association per AP wireless port; free previous client if needed
  if (aIf.connectedLinkId) {
    next = deleteLinkLocal(next, aIf.connectedLinkId);
    aIf = getIface(getDevice(next, apId)!, apIf.id)!;
  }

  const cIf2 = getIface(getDevice(next, clientId)!, clientIf.id)!;
  if (cIf2.connectedLinkId || aIf.connectedLinkId) {
    return { state: next, error: "Porta wireless ancora occupata." };
  }

  const link: Link = {
    id: wifiUid("link"),
    aDeviceId: clientId,
    aIfaceId: cIf2.id,
    bDeviceId: apId,
    bIfaceId: aIf.id,
    media: "wireless",
  };

  next = {
    ...next,
    links: [...next.links, link],
    devices: next.devices.map((d) => {
      if (d.id === clientId) {
        return {
          ...d,
          interfaces: d.interfaces.map((i) =>
            i.id === cIf2.id ? { ...i, connectedLinkId: link.id } : i,
          ),
        };
      }
      if (d.id === apId) {
        return {
          ...d,
          interfaces: d.interfaces.map((i) =>
            i.id === aIf.id ? { ...i, connectedLinkId: link.id } : i,
          ),
        };
      }
      return d;
    }),
  };
  return { state: next };
}

export function wifiStatusLabel(
  state: LabState,
  clientId: string,
): { hasNic: boolean; connectedSsid: string | null; signal: number } {
  const client = getDevice(state, clientId);
  if (!client) return { hasNic: false, connectedSsid: null, signal: 0 };
  const wifiIf = clientWifiIface(client);
  if (!wifiIf) return { hasNic: false, connectedSsid: null, signal: 0 };
  if (!wifiIf.connectedLinkId) return { hasNic: true, connectedSsid: null, signal: 0 };
  const link = state.links.find((l) => l.id === wifiIf.connectedLinkId);
  if (!link) return { hasNic: true, connectedSsid: null, signal: 0 };
  const apId = link.aDeviceId === clientId ? link.bDeviceId : link.aDeviceId;
  const ap = getDevice(state, apId);
  return {
    hasNic: true,
    connectedSsid: ap?.wifi?.ssid ?? ap?.name ?? null,
    signal: ap ? signalBetween(client, ap) : 0,
  };
}
