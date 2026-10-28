"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExercisesPanel } from "@/components/ExercisesPanel";
import { createEmptyLab } from "@/lib/network/engine";
import { loadAutosave } from "@/lib/network/persist";
import type { LabState } from "@/lib/network/types";

export default function EserciziPage() {
  const [state, setState] = useState<LabState>(() => createEmptyLab());
  const [source, setSource] = useState<"autosave" | "empty">("empty");
  const [updatedAt, setUpdatedAt] = useState<string>("—");

  useEffect(() => {
    function refresh() {
      const saved = loadAutosave();
      if (saved && (saved.devices.length > 0 || saved.links.length > 0)) {
        setState(saved);
        setSource("autosave");
      } else {
        setState(createEmptyLab());
        setSource("empty");
      }
      setUpdatedAt(
        new Date().toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "Europe/Rome",
        }),
      );
    }
    refresh();
    const id = window.setInterval(refresh, 2000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "netlab-autosave") refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07111f] text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 50% at 20% 0%, rgba(14,165,233,0.2), transparent 55%), radial-gradient(ellipse 40% 35% at 90% 80%, rgba(16,185,129,0.12), transparent 50%)",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
          <Link href="/" className="hover:text-sky-300">
            ← NetLab
          </Link>
          <span aria-hidden>·</span>
          <Link href="/lab" className="hover:text-sky-300">
            Laboratorio
          </Link>
          <span aria-hidden>·</span>
          <Link href="/changelog" className="hover:text-sky-300">
            Changelog
          </Link>
        </div>

        <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Esercizi lab
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-400">
          Checklist basata sul lab salvato in automatico nel browser. Lavora
          nel laboratorio: questa pagina si aggiorna da sola.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>
            Fonte:{" "}
            {source === "autosave" ? (
              <span className="text-emerald-400">autosave locale</span>
            ) : (
              <span className="text-amber-400">lab vuoto — apri /lab e costruisci</span>
            )}
          </span>
          <span aria-hidden>·</span>
          <span>Aggiornato: {updatedAt} (Europe/Rome)</span>
          <Link
            href="/lab"
            className="rounded border border-sky-600/50 bg-sky-500/10 px-2 py-1 text-sky-300 hover:bg-sky-500/20"
          >
            Apri laboratorio
          </Link>
        </div>

        <div className="mt-10">
          <ExercisesPanel state={state} />
        </div>
      </div>
    </div>
  );
}
