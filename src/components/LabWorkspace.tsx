"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  connectDevices,
  createDemoLab,
  createDevice,
  createEmptyLab,
  deleteDevice,
  deleteLink,
  moveDevice,
  nextDeviceName,
} from "@/lib/network/engine";
import type { Device, DeviceType, LabState } from "@/lib/network/types";
import { DeviceIcon } from "./DeviceIcon";
import { RouterConsole } from "./RouterConsole";
import { SwitchPanel } from "./SwitchPanel";
import { WindowsDesktop } from "./WindowsDesktop";

type Tool = "select" | "cable" | "delete";

export function LabWorkspace() {
  const [state, setState] = useState<LabState>(() => createDemoLab());
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const [tool, setTool] = useState<Tool>("select");
  const [cableFrom, setCableFrom] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openDeviceId, setOpenDeviceId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [drag, setDrag] = useState<{
    id: string;
    ox: number;
    oy: number;
  } | null>(null);
  const [showLanding, setShowLanding] = useState(true);

  const canvasRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const openDevice = state.devices.find((d) => d.id === openDeviceId) ?? null;

  function addDevice(type: DeviceType) {
    const name = nextDeviceName(state, type);
    const device = createDevice(type, name, 180 + Math.random() * 320, 140 + Math.random() * 220);
    setState((s) => ({ ...s, devices: [...s.devices, device] }));
    setTool("select");
    showToast(`Aggiunto ${name}. Doppio clic per aprire.`);
  }

  function onDevicePointerDown(
    e: React.PointerEvent,
    device: Device,
  ) {
    e.stopPropagation();
    if (tool === "delete") {
      setState((s) => deleteDevice(s, device.id));
      if (openDeviceId === device.id) setOpenDeviceId(null);
      showToast(`Eliminato ${device.name}`);
      return;
    }
    if (tool === "cable") {
      if (!cableFrom) {
        setCableFrom(device.id);
        setSelectedId(device.id);
        showToast(`Cavo: seleziona il secondo dispositivo`);
        return;
      }
      const result = connectDevices(state, cableFrom, device.id);
      if (result.error) showToast(result.error);
      else {
        setState(result.state);
        showToast("Cavo collegato");
      }
      setCableFrom(null);
      return;
    }
    setSelectedId(device.id);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDrag({
      id: device.id,
      ox: e.clientX - rect.left - device.x,
      oy: e.clientY - rect.top - device.y,
    });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onCanvasPointerMove(e: React.PointerEvent) {
    if (!drag || tool !== "select") return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(40, Math.min(rect.width - 40, e.clientX - rect.left - drag.ox));
    const y = Math.max(40, Math.min(rect.height - 40, e.clientY - rect.top - drag.oy));
    setState((s) => moveDevice(s, drag.id, x, y));
  }

  function onCanvasPointerUp() {
    setDrag(null);
  }

  function linkPath(linkId: string) {
    const link = state.links.find((l) => l.id === linkId);
    if (!link) return null;
    const a = state.devices.find((d) => d.id === link.aDeviceId);
    const b = state.devices.find((d) => d.id === link.bDeviceId);
    if (!a || !b) return null;
    return { a, b, link };
  }

  if (showLanding) {
    return <Landing onEnter={() => setShowLanding(false)} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--lab-bg)] text-[var(--lab-fg)]">
      <header className="relative z-20 flex flex-wrap items-center gap-3 border-b border-[var(--lab-line)] bg-[var(--lab-panel)]/95 px-3 py-2 backdrop-blur sm:px-4">
        <div className="mr-2 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-sky-600 font-display text-sm font-bold text-white">
            NL
          </div>
          <div>
            <div className="font-display text-base font-semibold tracking-tight">
              NetLab
            </div>
            <div className="text-[11px] text-slate-400">
              Lab di rete · comandi reali, non bottoni magici
            </div>
          </div>
        </div>

        <ToolButton active={tool === "select"} onClick={() => { setTool("select"); setCableFrom(null); }}>
          Seleziona
        </ToolButton>
        <ToolButton active={tool === "cable"} onClick={() => { setTool("cable"); setCableFrom(null); }}>
          Cavo
        </ToolButton>
        <ToolButton active={tool === "delete"} onClick={() => { setTool("delete"); setCableFrom(null); }}>
          Elimina
        </ToolButton>

        <div className="mx-1 hidden h-6 w-px bg-slate-700 sm:block" />

        <ToolButton onClick={() => addDevice("pc")}>+ PC</ToolButton>
        <ToolButton onClick={() => addDevice("switch")}>+ Switch</ToolButton>
        <ToolButton onClick={() => addDevice("router")}>+ Router</ToolButton>

        <div className="ml-auto flex flex-wrap gap-2">
          <ToolButton
            onClick={() => {
              setState(createDemoLab());
              setOpenDeviceId(null);
              showToast("Lab demo ricaricato");
            }}
          >
            Demo LAN
          </ToolButton>
          <ToolButton
            onClick={() => {
              setState(createEmptyLab());
              setOpenDeviceId(null);
            }}
          >
            Svuota
          </ToolButton>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="border-b border-[var(--lab-line)] bg-[var(--lab-panel)] p-3 lg:w-64 lg:border-b-0 lg:border-r">
          <h2 className="font-display text-sm font-semibold text-sky-200">
            Come si usa
          </h2>
          <ol className="mt-2 space-y-2 text-xs leading-relaxed text-slate-400">
            <li>1. Trascina i dispositivi sul foglio.</li>
            <li>2. Attiva <strong className="text-slate-200">Cavo</strong> e collega PC ↔ Switch ↔ Router.</li>
            <li>3. Doppio clic su un <strong className="text-slate-200">PC</strong>: si apre un desktop Windows con CMD.</li>
            <li>4. Configura con <code className="text-sky-300">ipconfig /ip ...</code> e prova <code className="text-sky-300">ping</code>.</li>
            <li>5. Sul router: CLI stile Cisco (<code className="text-orange-300">enable</code>, <code className="text-orange-300">interface</code>, <code className="text-orange-300">ip address</code>).</li>
          </ol>
          <div className="mt-4 rounded border border-sky-500/20 bg-sky-950/40 p-3 text-xs text-sky-100/80">
            <p className="font-medium text-sky-200">Perché non è Packet Tracer “finto”</p>
            <p className="mt-1 text-slate-400">
              Non c’è un pulsante “Assegna IP”. Apri il PC e digiti i comandi come su un sistema reale. La rete sotto è una simulazione L2/L3 (non una VM Windows con licenza).
            </p>
          </div>
          {selectedId && (
            <SelectedInfo
              device={state.devices.find((d) => d.id === selectedId)}
              onOpen={() => setOpenDeviceId(selectedId)}
            />
          )}
        </aside>

        <main className="relative min-h-[420px] flex-1">
          <div
            ref={canvasRef}
            className="lab-grid absolute inset-0 overflow-hidden"
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onPointerLeave={onCanvasPointerUp}
            onClick={() => {
              if (tool === "select") setSelectedId(null);
            }}
          >
            <svg className="absolute inset-0 h-full w-full pointer-events-none">
              {state.links.map((link) => {
                const geo = linkPath(link.id);
                if (!geo) return null;
                return (
                  <g key={link.id}>
                    <line
                      x1={geo.a.x}
                      y1={geo.a.y}
                      x2={geo.b.x}
                      y2={geo.b.y}
                      stroke="#38bdf8"
                      strokeWidth="2.5"
                      strokeOpacity="0.85"
                    />
                    <line
                      x1={geo.a.x}
                      y1={geo.a.y}
                      x2={geo.b.x}
                      y2={geo.b.y}
                      stroke="transparent"
                      strokeWidth="14"
                      className="pointer-events-auto cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (tool === "delete") {
                          setState((s) => deleteLink(s, link.id));
                          showToast("Cavo rimosso");
                        }
                      }}
                    />
                  </g>
                );
              })}
              {tool === "cable" && cableFrom && (
                <CableHint devices={state.devices} fromId={cableFrom} />
              )}
            </svg>

            {state.devices.map((device) => (
              <button
                key={device.id}
                type="button"
                className={`absolute flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-lg p-2 transition ${
                  selectedId === device.id || cableFrom === device.id
                    ? "bg-sky-500/20 ring-2 ring-sky-400"
                    : "hover:bg-white/5"
                }`}
                style={{ left: device.x, top: device.y }}
                onPointerDown={(e) => onDevicePointerDown(e, device)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setOpenDeviceId(device.id);
                  setSelectedId(device.id);
                }}
              >
                <DeviceIcon type={device.type} className="h-12 w-12 drop-shadow-lg" />
                <span className="rounded bg-slate-950/70 px-1.5 py-0.5 text-[11px] font-medium text-slate-100">
                  {device.name}
                </span>
                {device.interfaces[0]?.ip && device.type !== "switch" && (
                  <span className="text-[10px] text-sky-300/90">
                    {device.interfaces[0].ip}
                  </span>
                )}
              </button>
            ))}

            {state.devices.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="max-w-sm text-center text-sm text-slate-500">
                  Foglio vuoto. Aggiungi un PC, uno switch e collega i cavi.
                </p>
              </div>
            )}
          </div>

          {toast && (
            <div className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full border border-slate-600 bg-slate-900/95 px-4 py-2 text-sm text-slate-100 shadow-lg">
              {toast}
            </div>
          )}
        </main>
      </div>

      {openDevice?.type === "pc" && (
        <WindowsDesktop
          device={openDevice}
          stateRef={stateRef}
          setState={setState}
          onClose={() => setOpenDeviceId(null)}
        />
      )}
      {openDevice?.type === "router" && (
        <RouterConsole
          device={openDevice}
          stateRef={stateRef}
          setState={setState}
          onClose={() => setOpenDeviceId(null)}
        />
      )}
      {openDevice?.type === "switch" && (
        <SwitchPanel device={openDevice} onClose={() => setOpenDeviceId(null)} />
      )}
    </div>
  );
}

function ToolButton({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition sm:text-sm ${
        active
          ? "bg-sky-600 text-white shadow"
          : "bg-slate-800/80 text-slate-200 hover:bg-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function SelectedInfo({
  device,
  onOpen,
}: {
  device?: Device;
  onOpen: () => void;
}) {
  if (!device) return null;
  return (
    <div className="mt-4 rounded border border-slate-700 bg-slate-950/50 p-3 text-xs">
      <div className="font-medium text-slate-200">{device.name}</div>
      <div className="mt-1 capitalize text-slate-500">{device.type}</div>
      {device.interfaces
        .filter((i) => i.ip || i.connectedLinkId)
        .slice(0, 4)
        .map((i) => (
          <div key={i.id} className="mt-1 font-mono text-[11px] text-slate-400">
            {i.name}: {i.ip ?? "no ip"} {i.connectedLinkId ? "· up" : "· down"}
          </div>
        ))}
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 w-full rounded bg-sky-700 py-1.5 text-slate-50 hover:bg-sky-600"
      >
        Apri console / desktop
      </button>
    </div>
  );
}

function CableHint({
  devices,
  fromId,
}: {
  devices: Device[];
  fromId: string;
}) {
  const from = devices.find((d) => d.id === fromId);
  if (!from) return null;
  return (
    <circle
      cx={from.x}
      cy={from.y}
      r="28"
      fill="none"
      stroke="#38bdf8"
      strokeDasharray="4 4"
      className="animate-pulse"
    />
  );
}

function Landing({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#07111f] text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 70% 40%, rgba(14,165,233,0.28), transparent 55%), radial-gradient(ellipse 50% 40% at 15% 80%, rgba(15,118,110,0.25), transparent 50%), linear-gradient(180deg, #07111f 0%, #0b1a2e 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.35) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16">
        <p className="font-display text-5xl font-bold tracking-tight text-white sm:text-7xl animate-[fadeUp_0.7s_ease_both]">
          NetLab
        </p>
        <h1 className="mt-4 max-w-2xl font-display text-2xl font-medium leading-snug text-sky-100/90 sm:text-3xl animate-[fadeUp_0.7s_ease_0.12s_both]">
          Impara le reti come si fanno davvero: topologia, cavi, e il prompt dei comandi.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-400 animate-[fadeUp_0.7s_ease_0.2s_both]">
          Come Packet Tracer per lo schema, ma quando apri un PC entri in un desktop Windows
          simulato e digiti <span className="text-sky-300">ipconfig</span>,{" "}
          <span className="text-sky-300">ping</span>,{" "}
          <span className="text-sky-300">arp</span> — non clicchi un form “Assegna IP”.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 animate-[fadeUp_0.7s_ease_0.28s_both]">
          <button
            type="button"
            onClick={onEnter}
            className="rounded-md bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            Apri il laboratorio
          </button>
          <a
            href="#limiti"
            className="rounded-md border border-slate-600 px-5 py-3 text-sm text-slate-300 transition hover:border-slate-400"
          >
            Cosa è reale e cosa no
          </a>
        </div>

        <div
          id="limiti"
          className="mt-16 max-w-2xl border-t border-slate-700/80 pt-6 text-sm leading-relaxed text-slate-400 animate-[fadeUp_0.7s_ease_0.35s_both]"
        >
          <p className="font-medium text-slate-200">Trasparenza</p>
          <p className="mt-2">
            Una VM Windows vera (QEMU/Hyper-V + licenza Microsoft) si può collegare in un secondo
            passo, ma pesa giga di immagini e richiede infrastruttura. Qui la rete L2/L3 è
            simulata in modo coerente e l’interazione sul PC è un desktop/CMD fedeli ai comandi
            reali — così impari il funzionamento, non l’interfaccia a bottoni.
          </p>
        </div>
      </div>
    </div>
  );
}
