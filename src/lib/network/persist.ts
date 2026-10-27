import type { LabState } from "./types";

const STORAGE_KEY = "netlab-autosave";

export function serializeLab(state: LabState): string {
  return JSON.stringify({ version: 1, savedAt: new Date().toISOString(), ...state }, null, 2);
}

export function parseLabJson(raw: string): { state?: LabState; error?: string } {
  try {
    const data = JSON.parse(raw) as LabState & { version?: number };
    if (!data || !Array.isArray(data.devices) || !Array.isArray(data.links)) {
      return { error: "JSON non valido: manca devices/links." };
    }
    return {
      state: {
        devices: data.devices,
        links: data.links,
      },
    };
  } catch {
    return { error: "JSON non leggibile." };
  }
}

export function downloadLab(state: LabState, filename = "netlab.json") {
  const blob = new Blob([serializeLab(state)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function autosaveLab(state: LabState) {
  try {
    localStorage.setItem(STORAGE_KEY, serializeLab(state));
  } catch {
    /* ignore quota */
  }
}

export function loadAutosave(): LabState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = parseLabJson(raw);
    return parsed.state ?? null;
  } catch {
    return null;
  }
}

/** True se c’è un lab non vuoto in autosave. */
export function hasAutosaveLab(): boolean {
  const s = loadAutosave();
  return !!s && (s.devices.length > 0 || s.links.length > 0);
}

export function clearAutosave() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
