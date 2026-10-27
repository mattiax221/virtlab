"use client";

import { useEffect, useState } from "react";
import {
  runPcCommand,
  type CommandContext,
} from "@/lib/network/commands";
import type { Device, LabState } from "@/lib/network/types";
import { NetworkConnections } from "./NetworkConnections";
import { PhysicalPanel } from "./PhysicalPanel";
import { ServerServices } from "./ServerServices";
import { Terminal } from "./Terminal";
import { WifiTray } from "./WifiTray";

type AppWindow = "network" | "cmd" | "physical" | "services" | null;

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
  const live =
    stateRef.current.devices.find((d) => d.id === device.id) ?? device;
  const eth = live.interfaces.find((i) => !i.parentIfaceId);
  const [clock, setClock] = useState("--:--");
  const [app, setApp] = useState<AppWindow>("network");

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
      <div className="flex h-[min(760px,94vh)] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-600/60 shadow-2xl">
        <div className="flex items-center justify-between bg-slate-900 px-3 py-2 text-sm text-slate-200">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${live.powered ? "bg-emerald-400" : "bg-slate-500"}`}
            />
            <span className="font-medium">Desktop — {live.name}</span>
            <span className="hidden text-slate-500 sm:inline">
              · {live.powered ? "acceso" : "spento"} · moduli fisici + rete
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
            background: live.powered
              ? "linear-gradient(145deg, #0c4a6e 0%, #0369a1 42%, #0ea5e9 100%)"
              : "linear-gradient(145deg, #1e293b 0%, #0f172a 100%)",
          }}
        >
          <div className="relative z-10 flex flex-wrap gap-3 p-4">
            <DesktopIcon label="Questo PC" kind="pc" onClick={() => undefined} />
            <DesktopIcon
              label="Connessioni di rete"
              kind="net"
              active={app === "network"}
              onClick={() => setApp("network")}
            />
            <DesktopIcon
              label="Prompt dei comandi"
              kind="cmd"
              active={app === "cmd"}
              onClick={() => setApp("cmd")}
            />
            <DesktopIcon
              label="Physical"
              kind="phys"
              active={app === "physical"}
              onClick={() => setApp("physical")}
            />
            {live.type === "server" && (
              <DesktopIcon
                label="Servizi"
                kind="svc"
                active={app === "services"}
                onClick={() => setApp("services")}
              />
            )}
          </div>

          {app && (
            <div
              className={`relative z-10 mx-3 mb-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded border shadow-xl sm:mx-8 sm:mb-10 ${
                app === "physical"
                  ? "border-slate-600 bg-[#0b1220]"
                  : "border-slate-400/80 bg-[#f0f0f0]"
              }`}
            >
              {app === "network" && (
                <NetworkConnections
                  device={device}
                  stateRef={stateRef}
                  setState={setState}
                  onClose={() => setApp(null)}
                />
              )}
              {app === "physical" && (
                <>
                  <div className="flex items-center justify-between border-b border-slate-700 px-3 py-1.5 text-xs text-slate-200">
                    <span>Physical — moduli (NIC / Wi‑Fi)</span>
                    <button
                      type="button"
                      className="px-2 text-slate-400 hover:text-white"
                      onClick={() => setApp(null)}
                    >
                      ✕
                    </button>
                  </div>
                  <PhysicalPanel
                    device={device}
                    stateRef={stateRef}
                    setState={setState}
                  />
                </>
              )}
              {app === "services" && live.type === "server" && (
                <ServerServices
                  device={device}
                  stateRef={stateRef}
                  setState={setState}
                  onClose={() => setApp(null)}
                />
              )}
              {app === "cmd" && (
                <>
                  <div className="flex items-center justify-between border-b border-slate-700 bg-[#1e1e1e] px-2 py-1.5 text-xs text-slate-200">
                    <span>Amministratore: Prompt dei comandi — {live.name}</span>
                    <button
                      type="button"
                      className="px-2 text-slate-400 hover:bg-rose-600 hover:text-white"
                      onClick={() => setApp(null)}
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
                        `(c) NetLab — PC simulato.`,
                        ``,
                        `Host: ${live.name} · power: ${live.powered ? "on" : "off"}`,
                        `NIC: ${live.interfaces.filter((i) => !i.parentIfaceId).map((i) => `${i.name}(${i.media})`).join(", ") || "(nessuna)"}`,
                        `IP: ${eth?.ip ?? "(non configurato)"}`,
                        ``,
                        `Physical: spegni → rimuovi Ethernet → aggiungi Wi‑Fi.`,
                        `Comandi: ipconfig | ping`,
                        ``,
                      ]}
                      onCommand={(line) => runPcCommand(line, makeCtx())}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {!app && (
            <div className="relative z-10 mx-auto mb-16 max-w-sm rounded bg-black/30 px-4 py-3 text-center text-sm text-white/90">
              Usa <strong>Physical</strong> per i moduli e{" "}
              <strong>Connessioni di rete</strong> per l’IP.
            </div>
          )}

          <div className="relative z-10 mt-auto flex h-10 items-center gap-2 border-t border-slate-700/50 bg-slate-900/90 px-2 backdrop-blur">
            <div className="flex h-8 w-10 items-center justify-center rounded bg-sky-700 text-xs font-bold text-white">
              N
            </div>
            {app === "network" && (
              <div className="rounded bg-slate-800 px-3 py-1 text-xs text-slate-200">
                Connessioni di rete
              </div>
            )}
            {app === "cmd" && (
              <div className="rounded bg-slate-800 px-3 py-1 text-xs text-slate-200">
                Prompt dei comandi
              </div>
            )}
            {app === "physical" && (
              <div className="rounded bg-slate-800 px-3 py-1 text-xs text-slate-200">
                Physical
              </div>
            )}
            {app === "services" && (
              <div className="rounded bg-slate-800 px-3 py-1 text-xs text-slate-200">
                Servizi
              </div>
            )}
            <div className="ml-auto flex items-center gap-1 pr-1">
              <WifiTray
                device={device}
                stateRef={stateRef}
                setState={setState}
              />
              <div className="px-2 text-xs text-slate-300">{clock}</div>
            </div>
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
  onClick,
}: {
  label: string;
  kind: "pc" | "cmd" | "net" | "phys" | "svc";
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-[5.5rem] flex-col items-center gap-1 rounded p-2 text-center text-[11px] text-white drop-shadow ${
        active ? "bg-white/20 ring-1 ring-white/50" : "hover:bg-white/10"
      }`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-900/40">
        {kind === "cmd" ? (
          <span className="font-mono text-sm text-emerald-300">&gt;_</span>
        ) : kind === "svc" ? (
          <span className="text-sm font-bold text-amber-200">S</span>
        ) : kind === "net" ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-sky-200" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="6" cy="12" r="2.5" />
            <circle cx="18" cy="6" r="2.5" />
            <circle cx="18" cy="18" r="2.5" />
            <path d="M8.2 11.2 L15.5 7.2 M8.2 12.8 L15.5 16.8" />
          </svg>
        ) : kind === "phys" ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-amber-200" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="6" width="18" height="12" rx="1.5" />
            <path d="M7 10h4M7 14h2M15 10h2M15 14h4" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-100" fill="currentColor">
            <rect x="3" y="4" width="18" height="12" rx="1.5" opacity="0.9" />
            <rect x="7" y="18" width="10" height="2" rx="0.5" />
          </svg>
        )}
      </div>
      <span className="leading-tight">{label}</span>
    </button>
  );
}
