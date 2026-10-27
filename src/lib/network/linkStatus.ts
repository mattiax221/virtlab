/**
 * Link lights stile Packet Tracer
 * @see https://tutorials.ptnetacad.net/help/default/connectionsLinks.htm
 *
 * Verde = link fisico up (cavo corretto + porte up + device accesi)
 * Rosso = link down (cavo sbagliato, spento, shutdown, serial senza clock)
 * Arancio = collegamento in corso / anteprima
 */
import { inferCable, type CableKind } from "./catalog";
import { getDevice, getIface } from "./engine-helpers";
import {
  isAccessPoint,
  isEndHost,
  isL3Device,
  isManagedSwitch,
  type Device,
  type DeviceKind,
  type InterfaceConfig,
  type LabState,
  type Link,
} from "./types";

export type LinkHealth = "up" | "connecting" | "down";

export type LinkStatus = {
  health: LinkHealth;
  color: string;
  reason: string;
};

const COLORS = {
  up: "#22c55e",
  connecting: "#f59e0b",
  down: "#ef4444",
} as const;

/** Categorie “stesso livello OSI” come in PT (straight vs cross). */
export function ptLayerKind(
  type: DeviceKind,
): "end" | "l2" | "l3" | "wireless" | "wan" | "other" {
  if (isEndHost(type) || type === "printer" || type === "ip_phone") return "end";
  if (
    type === "hub" ||
    type === "bridge" ||
    type === "repeater" ||
    isManagedSwitch(type)
  )
    return "l2";
  if (isL3Device(type) && !isAccessPoint(type)) return "l3";
  if (isAccessPoint(type)) return "wireless";
  if (
    type.startsWith("modem") ||
    type === "cloud" ||
    type === "cloud_empty" ||
    type === "coaxial_splitter"
  )
    return "wan";
  return "other";
}

function idealCopper(a: DeviceKind, b: DeviceKind): "straight" | "cross" {
  const ideal = inferCable(a, b);
  return ideal === "cross" ? "cross" : "straight";
}

/**
 * Controlli PT prima di creare/accendere un link.
 * Restituisce messaggio errore oppure null se ok.
 */
export function cableChoiceError(
  a: Device,
  b: Device,
  media: Exclude<CableKind, "auto">,
  aIf: InterfaceConfig,
  bIf: InterfaceConfig,
): string | null {
  // --- Console: solo PC/Laptop → Router/Switch ---
  if (media === "console") {
    const aOk =
      (a.type === "pc" || a.type === "laptop") &&
      (isL3Device(b.type) || isManagedSwitch(b.type));
    const bOk =
      (b.type === "pc" || b.type === "laptop") &&
      (isL3Device(a.type) || isManagedSwitch(a.type));
    if (!aOk && !bOk) {
      return "Console: solo PC/Laptop verso Router o Switch";
    }
    return null;
  }

  // --- Wireless ---
  if (media === "wireless") {
    if (aIf.media !== "wireless" || bIf.media !== "wireless") {
      return "Wireless: servono due porte Wi‑Fi (es. PC ↔ AP)";
    }
    return null;
  }

  // --- Serial ---
  if (media === "serial") {
    if (aIf.media !== "serial" || bIf.media !== "serial") {
      return "Serial: entrambe le porte devono essere Serial";
    }
    return null;
  }

  // --- Fiber ---
  if (media === "fiber") {
    if (aIf.media !== "fiber" || bIf.media !== "fiber") {
      return "Fiber: entrambe le porte devono essere ottiche";
    }
    return null;
  }

  // --- Coaxial ---
  if (media === "coaxial") {
    if (aIf.media !== "coaxial" && bIf.media !== "coaxial") {
      // allow modem/cloud even if iface tagged ethernet in our model — check types
      const wan =
        ptLayerKind(a.type) === "wan" || ptLayerKind(b.type) === "wan";
      if (!wan) return "Coaxial: tipicamente Modem ↔ Cloud";
    }
    return null;
  }

  // --- Phone ---
  if (media === "phone") {
    if (aIf.media !== "phone" && bIf.media !== "phone") {
      return "Phone: serve almeno una porta telefonica/modem";
    }
    return null;
  }

  // --- Copper Straight / Cross (Ethernet) ---
  // Docs PT: Straight = device a livelli OSI diversi; Cross = stesso livello
  if (media === "straight" || media === "cross") {
    if (aIf.media === "wireless" || bIf.media === "wireless") {
      return "Rame non va su porta Wi‑Fi — usa associazione Wireless";
    }
    if (aIf.media === "serial" || bIf.media === "serial") {
      return "Su Serial usa il cavo Serial";
    }
    if (aIf.media === "fiber" || bIf.media === "fiber") {
      return "Su fibra usa il cavo Fiber";
    }
    if (aIf.media !== "ethernet" || bIf.media !== "ethernet") {
      return "Straight/Cross: entrambe le porte devono essere Ethernet rame";
    }

    const need = idealCopper(a.type, b.type);
    if (need !== media) {
      return `Cavo sbagliato: tra ${a.name} e ${b.name} serve ${
        need === "cross" ? "Copper Cross-Over" : "Copper Straight-Through"
      }`;
    }
    return null;
  }

  return null;
}

function serialClockOk(a: InterfaceConfig, b: InterfaceConfig): boolean {
  if (a.media !== "serial" && b.media !== "serial") return true;
  return (
    (a.clockRate != null && a.clockRate > 0) ||
    (b.clockRate != null && b.clockRate > 0)
  );
}

/** True se il link può trasportare frame (LED verde). */
export function isLinkPhysicallyUp(state: LabState, link: Link): boolean {
  return evaluateLink(state, link).health === "up";
}

export function evaluateLink(
  state: LabState,
  link: Link,
  opts?: { connecting?: boolean },
): LinkStatus {
  if (opts?.connecting) {
    return {
      health: "connecting",
      color: COLORS.connecting,
      reason: "Collegamento in corso…",
    };
  }

  const a = getDevice(state, link.aDeviceId);
  const b = getDevice(state, link.bDeviceId);
  if (!a || !b) {
    return {
      health: "down",
      color: COLORS.down,
      reason: "Dispositivo mancante",
    };
  }

  if (!a.powered || !b.powered) {
    const who =
      !a.powered && !b.powered
        ? `${a.name} e ${b.name}`
        : !a.powered
          ? a.name
          : b.name;
    return {
      health: "down",
      color: COLORS.down,
      reason: `${who} spento`,
    };
  }

  const aIf = getIface(a, link.aIfaceId);
  const bIf = getIface(b, link.bIfaceId);
  if (!aIf || !bIf) {
    return {
      health: "down",
      color: COLORS.down,
      reason: "Porta non trovata",
    };
  }

  if (!aIf.enabled || !bIf.enabled) {
    return {
      health: "down",
      color: COLORS.down,
      reason: `Porta ${!aIf.enabled ? aIf.name : bIf.name} in shutdown`,
    };
  }

  const cableMedia = link.media as Exclude<CableKind, "auto">;
  const choiceErr = cableChoiceError(a, b, cableMedia, aIf, bIf);
  if (choiceErr) {
    return { health: "down", color: COLORS.down, reason: choiceErr };
  }

  if (link.media === "serial" && !serialClockOk(aIf, bIf)) {
    return {
      health: "down",
      color: COLORS.down,
      reason: "Serial: manca clock rate sul DCE (line protocol down)",
    };
  }

  return {
    health: "up",
    color: COLORS.up,
    reason: "Link fisico up",
  };
}

export function linkHealthLabel(h: LinkHealth): string {
  if (h === "up") return "Connesso";
  if (h === "connecting") return "Collegamento…";
  return "Non attivo";
}

export function draftCableStatus(): LinkStatus {
  return {
    health: "connecting",
    color: COLORS.connecting,
    reason: "Collegamento in corso…",
  };
}
