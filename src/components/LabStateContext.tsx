"use client";

import { createContext, useContext } from "react";
import type { LabState } from "@/lib/network/types";

const EMPTY_LAB: LabState = { devices: [], links: [] };

/**
 * Stato del lab per i pannelli, da leggere durante il disegno.
 * `stateRef` resta per gli handler (valore aggiornato senza attendere il
 * render); per ciò che si mostra a schermo si usa questo, che è sempre
 * allineato all’ultimo render.
 */
export const LabStateContext = createContext<LabState>(EMPTY_LAB);

export function useLabState(): LabState {
  return useContext(LabStateContext);
}
