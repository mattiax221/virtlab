import { randomMac } from "./ip";
import {
  DEVICE_META,
  type DeviceKind,
  type InstalledModule,
  type InterfaceConfig,
  type PortMode,
} from "./types";

export type LinkMediaKind =
  | "ethernet"
  | "wireless"
  | "serial"
  | "fiber"
  | "coaxial"
  | "phone";

export type ModuleKind =
  | "host_fe"
  | "host_ge"
  | "host_wifi"
  | "router_fe"
  | "router_ge"
  | "router_serial"
  | "switch_base"
  | "switch_uplink_ge"
  | "switch_uplink_fiber"
  | "ap_radio"
  | "modem_eth"
  | "modem_wan"
  | "generic_eth";

export type ModuleDef = {
  kind: ModuleKind;
  label: string;
  ptModel: string;
  description: string;
  /** How many physical interfaces this module adds */
  ports: number;
  media: LinkMediaKind;
  /** Device categories that can install this */
  fits: Array<"host" | "router" | "switch" | "ap" | "modem" | "other">;
};

export type { InstalledModule };

export const MODULE_CATALOG: Record<ModuleKind, ModuleDef> = {
  host_fe: {
    kind: "host_fe",
    label: "FastEthernet NIC",
    ptModel: "PT-HOST-NM-1CFE",
    description: "Scheda di rete rame 100 Mbps (Ethernet).",
    ports: 1,
    media: "ethernet",
    fits: ["host"],
  },
  host_ge: {
    kind: "host_ge",
    label: "Gigabit NIC",
    ptModel: "PT-HOST-NM-1CGE",
    description: "Scheda di rete rame 1 Gbps.",
    ports: 1,
    media: "ethernet",
    fits: ["host"],
  },
  host_wifi: {
    kind: "host_wifi",
    label: "Wireless NIC",
    ptModel: "PT-HOST-NM-1W",
    description: "Scheda Wi‑Fi (associazione wireless).",
    ports: 1,
    media: "wireless",
    fits: ["host"],
  },
  router_fe: {
    kind: "router_fe",
    label: "WIC-1FE",
    ptModel: "WIC-1T / FE",
    description: "Modulo FastEthernet per router.",
    ports: 1,
    media: "ethernet",
    fits: ["router"],
  },
  router_ge: {
    kind: "router_ge",
    label: "GigabitEthernet",
    ptModel: "HWIC-1GE",
    description: "Porta GigabitEthernet router.",
    ports: 1,
    media: "ethernet",
    fits: ["router"],
  },
  router_serial: {
    kind: "router_serial",
    label: "Serial WIC",
    ptModel: "WIC-1T",
    description: "Interfaccia seriale WAN.",
    ports: 1,
    media: "serial",
    fits: ["router"],
  },
  switch_base: {
    kind: "switch_base",
    label: "Fixed copper ports",
    ptModel: "BASE-BOARD",
    description: "Porte rame integrate dello switch (non rimuovibile).",
    ports: 24, // actual count clamped per device in interfacesFromModules
    media: "ethernet",
    fits: ["switch"],
  },
  switch_uplink_ge: {
    kind: "switch_uplink_ge",
    label: "Uplink GE",
    ptModel: "GLC-T",
    description: "Modulo uplink Gigabit rame.",
    ports: 2,
    media: "ethernet",
    fits: ["switch"],
  },
  switch_uplink_fiber: {
    kind: "switch_uplink_fiber",
    label: "Uplink Fiber",
    ptModel: "GLC-SX-MM",
    description: "Modulo uplink fibra ottica.",
    ports: 2,
    media: "fiber",
    fits: ["switch"],
  },
  ap_radio: {
    kind: "ap_radio",
    label: "AP Radio + Eth",
    ptModel: "AP-RADIO",
    description: "Radio Wi‑Fi e porta Ethernet verso switch.",
    ports: 2,
    media: "ethernet",
    fits: ["ap"],
  },
  modem_eth: {
    kind: "modem_eth",
    label: "Ethernet",
    ptModel: "MODEM-ETH",
    description: "Lato LAN del modem.",
    ports: 1,
    media: "ethernet",
    fits: ["modem"],
  },
  modem_wan: {
    kind: "modem_wan",
    label: "WAN (Coax/DSL)",
    ptModel: "MODEM-WAN",
    description: "Lato WAN modem.",
    ports: 1,
    media: "coaxial",
    fits: ["modem"],
  },
  generic_eth: {
    kind: "generic_eth",
    label: "Ethernet",
    ptModel: "ETH",
    description: "Porta Ethernet generica.",
    ports: 1,
    media: "ethernet",
    fits: ["other", "host", "router"],
  },
};

export function deviceFamily(
  type: DeviceKind,
): "host" | "router" | "switch" | "ap" | "modem" | "other" {
  if (
    type === "pc" ||
    type === "laptop" ||
    type === "server" ||
    type === "printer" ||
    type === "tablet" ||
    type === "smartphone" ||
    type === "tv" ||
    type === "ip_phone"
  )
    return "host";
  if (
    type === "router" ||
    type.startsWith("router_") ||
    type === "wireless_router" ||
    type === "home_router" ||
    type.startsWith("firewall_")
  )
    return "router";
  if (
    type === "switch" ||
    type.startsWith("switch_") ||
    type === "multilayer_switch" ||
    type === "hub" ||
    type === "bridge" ||
    type === "repeater"
  )
    return "switch";
  if (type === "access_point" || type === "ap_n" || type === "lap" || type === "wlc")
    return "ap";
  if (type.startsWith("modem")) return "modem";
  return "other";
}

export function slotCountFor(type: DeviceKind): number {
  const fam = deviceFamily(type);
  if (fam === "host") return type === "server" ? 4 : 2;
  if (fam === "router") return 4;
  if (fam === "switch") return 3; // slot 0 = base (locked), 1-2 = uplinks
  if (fam === "ap") return 1;
  if (fam === "modem") return 2;
  return 2;
}

export function defaultModulesFor(
  type: DeviceKind,
  deviceId: string,
  uid: (p: string) => string,
): InstalledModule[] {
  const fam = deviceFamily(type);
  if (fam === "host") {
    if (type === "smartphone" || type === "tablet") {
      return [{ id: uid("mod"), kind: "host_wifi", slot: 0 }];
    }
    if (type === "analog_phone") return [];
    return [{ id: uid("mod"), kind: "host_fe", slot: 0 }];
  }
  if (fam === "router") {
    const n =
      type === "router_2911" || type === "router_4331"
        ? 3
        : type.startsWith("firewall_")
          ? 3
          : type === "wireless_router" || type === "home_router"
            ? 5
            : 2;
    const kind: ModuleKind =
      type === "router_1841" || type === "router_2811" || type === "router"
        ? "router_fe"
        : "router_ge";
    return Array.from({ length: Math.min(n, 4) }, (_, i) => ({
      id: uid("mod"),
      kind: i === 0 && (type === "wireless_router" || type === "home_router")
        ? "router_ge"
        : kind,
      slot: i,
    }));
  }
  if (fam === "switch") {
    if (type === "hub" || type === "bridge" || type === "repeater") {
      const ports = type === "hub" ? 8 : 2;
      return Array.from({ length: ports }, (_, i) => ({
        id: uid("mod"),
        kind: "generic_eth",
        slot: i,
      }));
    }
    const metaPorts =
      type === "switch_ie2000" ? 8 : type === "switch" || type === "multilayer_switch" ? 8 : 24;
    return [
      { id: uid("mod"), kind: "switch_base", slot: 0 },
      ...(metaPorts >= 24
        ? [{ id: uid("mod"), kind: "switch_uplink_ge" as const, slot: 1 }]
        : []),
    ];
  }
  if (fam === "ap") {
    return [{ id: uid("mod"), kind: "ap_radio", slot: 0 }];
  }
  if (fam === "modem") {
    return [
      { id: uid("mod"), kind: "modem_eth", slot: 0 },
      { id: uid("mod"), kind: "modem_wan", slot: 1 },
    ];
  }
  // cloud etc.
  return Array.from({ length: 4 }, (_, i) => ({
    id: uid("mod"),
    kind: "generic_eth" as const,
    slot: i,
  }));
}

export function availableModulesFor(type: DeviceKind): ModuleKind[] {
  const fam = deviceFamily(type);
  return (Object.keys(MODULE_CATALOG) as ModuleKind[]).filter((k) => {
    const def = MODULE_CATALOG[k];
    if (k === "switch_base") return false; // never install twice from catalog
    return def.fits.includes(fam);
  });
}

function blankIface(
  deviceId: string,
  name: string,
  media: LinkMediaKind,
  moduleId: string,
  uid: (p: string) => string,
): InterfaceConfig {
  return {
    id: uid("if"),
    name,
    ip: null,
    mask: null,
    gateway: null,
    mac: randomMac(`${deviceId}-${name}-${moduleId}`),
    connectedLinkId: null,
    enabled: true,
    mode: "access" as PortMode,
    accessVlan: 1,
    nativeVlan: 1,
    allowedVlans: "all",
    media,
    moduleId,
    parentIfaceId: null,
    vlanTag: null,
  };
}

/** Build physical interfaces from installed modules (keeps subinterfaces separately). */
export function interfacesFromModules(
  type: DeviceKind,
  deviceId: string,
  modules: InstalledModule[],
  uid: (p: string) => string,
  existing?: InterfaceConfig[],
): InterfaceConfig[] {
  const sorted = [...modules].sort((a, b) => a.slot - b.slot);
  const physical: InterfaceConfig[] = [];
  let fe = 0;
  let gi = 0;
  let se = 0;
  let wi = 0;
  let eth = 0;

  for (const mod of sorted) {
    const kind = mod.kind as ModuleKind;
    const def = MODULE_CATALOG[kind];
    if (!def) continue;
    const prevForMod = existing?.filter((i) => i.moduleId === mod.id && !i.parentIfaceId) ?? [];

    for (let p = 0; p < def.ports; p++) {
      let name: string;
      if (def.kind === "host_fe") name = "FastEthernet0";
      else if (def.kind === "host_ge") name = "GigabitEthernet0";
      else if (def.kind === "host_wifi") name = `Wireless0`;
      else if (def.kind === "router_fe") {
        name = `FastEthernet0/${fe++}`;
      } else if (def.kind === "router_ge") {
        name = `GigabitEthernet0/${gi++}`;
      } else if (def.kind === "router_serial") {
        name = `Serial0/${se++}`;
      } else if (def.kind === "switch_base") {
        const basePorts = Math.min(
          DEVICE_META[type]?.ports ?? 24,
          24,
        );
        if (p >= basePorts) continue;
        name = `FastEthernet0/${p + 1}`;
      } else if (def.kind === "switch_uplink_ge") {
        name = `GigabitEthernet0/${p + 1}`;
      } else if (def.kind === "switch_uplink_fiber") {
        name = `GigabitEthernet1/${p + 1}`;
      } else if (def.kind === "ap_radio") {
        name = p === 0 ? "Port 0" : "Wireless0";
      } else if (def.kind === "modem_eth") name = "Ethernet0";
      else if (def.kind === "modem_wan")
        name = type === "modem_cable" ? "Coaxial0" : "Modem0";
      else name = `Ethernet${eth++}`;

      // For host_wifi unique naming if multiple
      if (def.kind === "host_wifi" && wi > 0) name = `Wireless${wi}`;
      if (def.kind === "host_wifi") wi++;
      if (def.kind === "host_fe" && physical.some((i) => i.name.startsWith("FastEthernet"))) {
        name = `FastEthernet${physical.filter((i) => i.media === "ethernet").length}`;
      }

      const media: LinkMediaKind =
        def.kind === "ap_radio" && p === 1 ? "wireless" : def.media;

      const reuse = prevForMod[p];
      if (reuse) {
        physical.push({
          ...reuse,
          name,
          media,
          moduleId: mod.id,
          parentIfaceId: null,
          // keep ip/mac/link if same module retained
        });
      } else {
        physical.push(blankIface(deviceId, name, media, mod.id, uid));
      }
    }
  }

  // Preserve subinterfaces whose parent still exists
  const parentIds = new Set(physical.map((i) => i.id));
  const subs =
    existing?.filter(
      (i) => i.parentIfaceId && parentIds.has(i.parentIfaceId),
    ) ?? [];

  return [...physical, ...subs];
}

export function isModuleRemovable(mod: InstalledModule, type: DeviceKind): boolean {
  if (mod.kind === "switch_base") return false;
  void type;
  return true;
}
