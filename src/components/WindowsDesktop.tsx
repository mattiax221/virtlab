"use client";

import { useEffect, useState } from "react";
import {
  runPcCommand,
  type CommandContext,
} from "@/lib/network/commands";
import type { Device, LabState } from "@/lib/network/types";
import { Terminal } from "./Terminal";

export function WindowsDesktop({
  device,
  stateRef,
  setState,
  onClose,
}: {
  device: Device;
  stateRef: React.MutableRefObject<LabState>;
  setState: (next: LabState) => void;
  onClose: () => void;
}) {
  const eth = device.interfaces[0];
  const [clock, setClock] = useState("--:--");
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Rome",
        }),
      );
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  function makeCtx(): CommandContext {
    return {
      state: stateRef.current,
      deviceId: device.id,
      setState: (next) => {
        stateRef.current = next;
        setState(next);
      },
    };
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex h-[min(720px,92vh)] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-600/60 shadow-2xl">
        <div className="flex items-center justify-between bg-slate-900 px-3 py-2 text-sm text-slate-200">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-medium">Sessione su {device.name}</span>
            <span className="hidden text-slate-500 sm:inline">
              — desktop Windows simulato · digita i comandi reali in CMD
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-slate-300 transition hover:bg-rose-600 hover:text-white"
          >
            Chiudi
          </button>
        </div>

        <div
          className="relative flex min-h-0 flex-1 flex-col"
          style={{
            background:
              "linear-gradient(145deg, #0c4a6e 0%, #0369a1 42%, #0ea5e9 100%)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25), transparent 40%), radial-gradient(circle at 80% 0%, rgba(14,165,233,0.4), transparent 35%)",
            }}
          />

          <div className="relative z-10 flex gap-4 p-4">
            <DesktopIcon label="Questo PC" kind="pc" />
            <DesktopIcon label="Prompt dei comandi" kind="cmd" active />
            <DesktopIcon label="Rete" kind="net" />
          </div>

          <div className="relative z-10 mx-3 mb-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-slate-500/80 bg-[#0c0c0c] shadow-xl sm:mx-8 sm:mb-10">
            <div className="flex items-center justify-between border-b border-slate-700 bg-[#1e1e1e] px-2 py-1.5 text-xs text-slate-200">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-sm bg-slate-500" />
                <span>Amministratore: Prompt dei comandi — {device.name}</span>
              </div>
              <button
                type="button"
                className="px-2 text-slate-400 hover:bg-rose-600 hover:text-white"
                onClick={onClose}
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <Terminal
                prompt={`C:\\Users\\Studente>`}
                accent="#f0f0f0"
                background="#0c0c0c"
                welcome={[
                  `Microsoft Windows [Versione NetLab 10.0]`,
                  `(c) NetLab Learning Environment. Nessuna VM reale — ma i comandi sono quelli veri.`,
                  ``,
                  `Host: ${device.name}`,
                  `Interfaccia: ${eth?.name ?? "Ethernet0"} · cavo: ${eth?.connectedLinkId ? "collegato" : "scollegato"}`,
                  `Digita help per i comandi. Prova: ipconfig   poi   ping 192.168.1.20`,
                  ``,
                ]}
                onCommand={(line) => runPcCommand(line, makeCtx())}
              />
            </div>
          </div>

          <div className="relative z-10 flex h-10 items-center gap-2 border-t border-slate-700/50 bg-slate-900/90 px-2 backdrop-blur">
            <div className="flex h-8 w-10 items-center justify-center rounded bg-sky-700 text-xs font-bold text-white">
              N
            </div>
            <div className="rounded bg-slate-800 px-3 py-1 text-xs text-slate-200">
              Prompt dei comandi
            </div>
            <div className="ml-auto pr-2 text-xs text-slate-300">{clock} · Roma</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopIcon({
  label,
  kind,
  active,
}: {
  label: string;
  kind: "pc" | "cmd" | "net";
  active?: boolean;
}) {
  return (
    <div
      className={`flex w-20 flex-col items-center gap-1 rounded p-2 text-center text-[11px] text-white drop-shadow ${
        active ? "bg-white/15 ring-1 ring-white/40" : "hover:bg-white/10"
      }`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-900/40">
        {kind === "cmd" ? (
          <span className="font-mono text-sm text-emerald-300">&gt;_</span>
        ) : kind === "net" ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-sky-200" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="6" cy="12" r="2.5" />
            <circle cx="18" cy="6" r="2.5" />
            <circle cx="18" cy="18" r="2.5" />
            <path d="M8.2 11.2 L15.5 7.2 M8.2 12.8 L15.5 16.8" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-100" fill="currentColor">
            <rect x="3" y="4" width="18" height="12" rx="1.5" opacity="0.9" />
            <rect x="7" y="18" width="10" height="2" rx="0.5" />
          </svg>
        )}
      </div>
      <span className="leading-tight">{label}</span>
    </div>
  );
}
