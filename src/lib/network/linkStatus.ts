import { inferCable, type CableKind } from "./catalog";
import { getDevice, getIface } from "./engine-helpers";
import type { Device, InterfaceConfig, LabState, Link } from "./types";

export type LinkHealth = "up" | "connecting" | "down";

export type LinkStatus = {
  health: LinkHealth;
  /** Colore LED del cavo */
  color: string;
  reason: string;
};

const COLORS = {
  up: "#22c55e",
  connecting: "#f59e0b",
  down: "#ef4444",
} as const;

function mediaMismatch(
  a: InterfaceConfig,
  b: InterfaceConfig,
  media: Link["media"],
): string | null {
  if (media === "wireless" || a.media === "wireless" || b.media === "wireless") {
    if (a.media !== "wireless" || b.media !== "wireless") {
      return "Cavo sbagliato: Wi‑Fi solo tra porte wireless";
    }
  }
  if (a.media === "serial" || b.media === "serial") {
    if (a.media !== "serial" || b.media !== "serial") {
      return "Cavo sbagliato: Serial va con Serial";
    }
    if (media !== "serial") return "Serve cavo Serial";
  }
  if (
    (a.media === "fiber" || b.media === "fiber") &&
    media !== "fiber" &&
    a.media !== b.media
  ) {
    return "Cavo sbagliato: porta fibra richiede cavo Fiber";
  }
  return null;
}

function wrongCopperType(
  a: Device,
  b: Device,
  media: Link["media"],
): string | null {
  if (media !== "straight" && media !== "cross") return null;
  const ideal = inferCable(a.type, b.type);
  if (ideal === "straight" || ideal === "cross") {
    if (ideal !== media) {
      return `Cavo non adatto: meglio ${ideal === "cross" ? "Cross-Over" : "Straight-Through"}`;
    }
  }
  return null;
}

function serialClockOk(
  a: InterfaceConfig,
  b: InterfaceConfig,
): boolean {
  if (a.media !== "serial" && b.media !== "serial") return true;
  return (
    (a.clockRate != null && a.clockRate > 0) ||
    (b.clockRate != null && b.clockRate > 0)
  );
}

/** Stato operativo di un link già presente in topologia. */
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
    const who = !a.powered && !b.powered
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

  const mediaErr = mediaMismatch(aIf, bIf, link.media);
  if (mediaErr) {
    return { health: "down", color: COLORS.down, reason: mediaErr };
  }

  const copperErr = wrongCopperType(a, b, link.media);
  if (copperErr) {
    // Pedagogico: link fisico c’è ma cavo “sbagliato” → rosso come PT
    return { health: "down", color: COLORS.down, reason: copperErr };
  }

  if (link.media === "serial" && !serialClockOk(aIf, bIf)) {
    return {
      health: "down",
      color: COLORS.down,
      reason: "Serial: manca clock rate sul DCE",
    };
  }

  if (link.media === "console") {
    return {
      health: "up",
      color: COLORS.up,
      reason: "Console collegata",
    };
  }

  return {
    health: "up",
    color: COLORS.up,
    reason: "Connesso",
  };
}

export function linkHealthLabel(h: LinkHealth): string {
  if (h === "up") return "Connesso";
  if (h === "connecting") return "Collegamento…";
  return "Non attivo";
}

/** Preview cavo in bozza (sempre arancio). */
export function draftCableStatus(): LinkStatus {
  return {
    health: "connecting",
    color: COLORS.connecting,
    reason: "Collegamento in corso…",
  };
}

export type { CableKind };
