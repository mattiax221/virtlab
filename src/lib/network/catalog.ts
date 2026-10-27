/**
 * Catalogo ispirato a Cisco Packet Tracer 9.x
 * (modelli e cavi tipici della palette PT — non asset Cisco).
 */
import type { DeviceKind } from "./types";

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
      "printer",
      "ip_phone",
      "tablet",
      "smartphone",
      "tv",
      "analog_phone",
    ],
  },
  {
    title: "Switches",
    types: [
      "hub",
      "switch",
      "switch_2950",
      "switch_2950t",
      "switch_2960",
      "switch_3560",
      "switch_3650",
      "switch_ie2000",
      "multilayer_switch",
      "bridge",
      "repeater",
    ],
  },
  {
    title: "Routers",
    types: [
      "router",
      "router_1841",
      "router_1941",
      "router_2811",
      "router_2901",
      "router_2911",
      "router_4321",
      "router_4331",
      "wireless_router",
      "home_router",
    ],
  },
  {
    title: "Wireless",
    types: ["access_point", "ap_n", "lap", "wlc"],
  },
  {
    title: "Security / WAN",
    types: [
      "firewall_asa5505",
      "firewall_asa5506",
      "modem_dsl",
      "modem_cable",
      "cloud",
      "co_server",
    ],
  },
];

export function inferCable(
  aType: DeviceKind,
  bType: DeviceKind,
): Exclude<CableKind, "auto"> {
  const cat = (t: DeviceKind) => {
    if (
      t === "pc" ||
      t === "laptop" ||
      t === "server" ||
      t === "printer" ||
      t === "tablet" ||
      t === "smartphone" ||
      t === "tv" ||
      t === "ip_phone"
    )
      return "end";
    if (t === "hub" || t === "bridge" || t === "repeater") return "hub";
    if (t.startsWith("switch") || t === "multilayer_switch") return "switch";
    if (
      t.startsWith("router") ||
      t === "wireless_router" ||
      t === "home_router" ||
      t.startsWith("firewall")
    )
      return "router";
    if (t.startsWith("modem")) return "modem";
    if (t === "cloud" || t === "co_server") return "cloud";
    if (t === "access_point" || t === "ap_n" || t === "lap" || t === "wlc")
      return "wireless";
    if (t === "analog_phone") return "phone";
    return "other";
  };
  const A = cat(aType);
  const B = cat(bType);
  if (A === "modem" || B === "modem") {
    if (A === "cloud" || B === "cloud") return "coaxial";
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
