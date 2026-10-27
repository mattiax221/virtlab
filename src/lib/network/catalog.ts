/**
 * Catalogo ispirato a Cisco Packet Tracer 9.x
 * (modelli e cavi tipici della palette PT — non asset Cisco).
 */
import type { DeviceKind } from "./types";
import { isAccessPoint } from "./types";

export type CableKind =
  | "auto"
  | "straight"
  | "cross"
  | "serial"
  | "fiber"
  | "console"
  | "coaxial"
  | "phone"
  | "wireless";

export const CABLE_META: Record<
  CableKind,
  { label: string; color: string; dash?: string; hint: string }
> = {
  auto: {
    label: "Automatically Choose",
    color: "#38bdf8",
    hint: "PT sceglie il cavo in base ai due dispositivi",
  },
  straight: {
    label: "Copper Straight-Through",
    color: "#38bdf8",
    hint: "PC↔Switch, Router↔Switch, Hub↔PC",
  },
  cross: {
    label: "Copper Cross-Over",
    color: "#f472b6",
    hint: "Switch↔Switch, Router↔Router, PC↔PC",
  },
  serial: {
    label: "Serial DCE/DTE",
    color: "#fbbf24",
    hint: "WAN seriale (clock sul DCE)",
  },
  fiber: {
    label: "Fiber",
    color: "#a78bfa",
    dash: "6 3",
    hint: "Porte ottiche 100/1000 Mbps",
  },
  console: {
    label: "Console",
    color: "#94a3b8",
    dash: "2 2",
    hint: "PC → Router/Switch (gestione CLI)",
  },
  coaxial: {
    label: "Coaxial",
    color: "#fb923c",
    hint: "Cable Modem ↔ Cloud",
  },
  phone: {
    label: "Phone",
    color: "#86efac",
    hint: "Linea telefonica / modem",
  },
  wireless: {
    label: "Wireless Association",
    color: "#67e8f9",
    dash: "4 4",
    hint: "Associazione Wi‑Fi (AP / WRT)",
  },
};

/** Palette UI raggruppata come in Packet Tracer */
export const PT_PALETTE: { title: string; types: DeviceKind[] }[] = [
  {
    title: "End Devices",
    types: [
      "pc",
      "laptop",
      "server",
      "meraki_server",
      "network_controller",
      "printer",
      "ip_phone",
      "voip_device",
      "analog_phone",
      "tv",
      "tablet",
      "smartphone",
      "generic_wireless",
      "generic_wired",
      "sniffer",
    ],
  },
  {
    title: "Switches",
    types: [
      "switch_2960",
      "switch",
      "switch_empty",
      "switch_3560",
      "switch_3650",
      "switch_ie2000",
      "switch_ie3400",
      "switch_ie9320",
      "bridge",
      "switch_2950",
      "switch_2950t",
      "multilayer_switch",
    ],
  },
  {
    title: "Routers",
    types: [
      "router_pt8200",
      "router_4331",
      "router_4321",
      "router_ir8340",
      "router_1941",
      "router_2901",
      "router_2911",
      "router_819iox",
      "router_819hgw",
      "router_829",
      "router_1240",
      "router_ir1101",
      "router",
      "router_empty",
      "router_1841",
      "router_2620xm",
      "router_2621xm",
      "router_2811",
    ],
  },
  {
    title: "Hubs",
    types: ["hub", "repeater", "coaxial_splitter"],
  },
  {
    title: "Wireless",
    types: [
      "meraki_ap",
      "lap",
      "ap_3702i",
      "wlc",
      "wlc_3504",
      "wlc_2504",
      "home_router",
      "access_point",
      "ap_a",
      "ap_ac",
      "ap_n",
      "wireless_router",
      "home_gateway",
      "cell_tower",
      "co_server",
    ],
  },
  {
    title: "Security",
    types: [
      "firewall_isa3000",
      "firewall_asa5506",
      "firewall_asa5505",
      "cyber_observer",
    ],
  },
  {
    title: "WAN Emulation",
    types: ["cloud", "cloud_empty", "modem_dsl", "modem_cable"],
  },
];

export function inferCable(
  aType: DeviceKind,
  bType: DeviceKind,
): Exclude<CableKind, "auto"> {
  const cat = (t: DeviceKind) => {
    if (DEVICE_END.has(t)) return "end";
    if (t === "hub" || t === "bridge" || t === "repeater") return "hub";
    if (t === "coaxial_splitter") return "splitter";
    if (t.startsWith("switch") || t === "multilayer_switch") return "switch";
    if (
      t.startsWith("router") ||
      t === "wireless_router" ||
      t === "home_router" ||
      t === "home_gateway" ||
      t.startsWith("firewall")
    )
      return "router";
    if (t.startsWith("modem")) return "modem";
    if (t === "cloud" || t === "cloud_empty" || t === "co_server" || t === "cell_tower")
      return "cloud";
    if (isAccessPoint(t) || t.startsWith("wlc") || t === "generic_wireless")
      return "wireless";
    if (t === "analog_phone" || t === "voip_device") return "phone";
    return "other";
  };
  const A = cat(aType);
  const B = cat(bType);
  if (A === "modem" || B === "modem" || A === "splitter" || B === "splitter") {
    if (A === "cloud" || B === "cloud" || A === "splitter" || B === "splitter")
      return "coaxial";
    return "straight";
  }
  if (A === "phone" || B === "phone") return "phone";
  if (A === "wireless" || B === "wireless") {
    if (A === "end" || B === "end") return "wireless";
    return "straight";
  }
  if (A === B && (A === "switch" || A === "router" || A === "end")) return "cross";
  if (
    (A === "router" && B === "router") ||
    (A === "switch" && B === "switch") ||
    (A === "end" && B === "end")
  )
    return "cross";
  return "straight";
}

const DEVICE_END = new Set<DeviceKind>([
  "pc",
  "laptop",
  "server",
  "meraki_server",
  "network_controller",
  "printer",
  "tablet",
  "smartphone",
  "tv",
  "ip_phone",
  "voip_device",
  "generic_wireless",
  "generic_wired",
  "sniffer",
]);
