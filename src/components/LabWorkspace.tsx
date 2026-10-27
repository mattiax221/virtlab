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
import {
  DEVICE_META,
  isEndHost,
  type Device,
  type DeviceKind,
  type LabState,
} from "@/lib/network/types";
import { DeviceIcon } from "./DeviceIcon";
import { HostOpenDialog } from "./HostOpenDialog";
import { ReactOsSession } from "./ReactOsSession";
import { RouterConsole } from "./RouterConsole";
import { SimpleDevicePanel } from "./SimpleDevicePanel";
import { SwitchPanel } from "./SwitchPanel";
import { WindowsDesktop } from "./WindowsDesktop";

type Tool = "select" | "cable" | "delete";
type OpenMode = "chooser" | "sim" | "reactos" | "panel" | "switch" | "router";

const PALETTE: { title: string; types: DeviceKind[] }[] = [
  {
    title: "End Devices (PT)",
    types: ["pc", "laptop", "server", "printer", "ip_phone"],
  },
  {
    title: "Switches / Hub",
    types: [
      "hub",
      "switch",
      "switch_2950",
      "switch_2960",
      "switch_3560",
      "switch_3650",
      "multilayer_switch",
    ],
  },
  {
    title: "Routers / Security",
    types: [
      "router",
      "router_1841",
      "router_1941",
      "router_2911",
      "router_4321",
      "wireless_router",
      "firewall_asa",
    ],
  },
  {
    title: "WAN / Wireless",
    types: ["modem_dsl", "modem_cable", "cloud", "access_point"],
  },
];

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
  const [openMode, setOpenMode] = useState<OpenMode | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; ox: number; oy: number } | null>(
    null,
  );

  const canvasRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const openDevice = state.devices.find((d) => d.id === openDeviceId) ?? null;

  function openDeviceUi(device: Device) {
    setOpenDeviceId(device.id);
    setSelectedId(device.id);
    if (
      device.type === "switch" ||
      device.type === "hub" ||
      device.type.startsWith("switch_")
    ) {
      setOpenMode("switch");
    } else if (
      device.type === "router" ||
      device.type.startsWith("router_") ||
      device.type === "wireless_router" ||
      device.type === "firewall_asa" ||
      device.type === "multilayer_switch"
    ) {
      setOpenMode("router");
    } else if (
      device.type === "pc" ||
      device.type === "laptop" ||
      device.type === "server"
    ) {
      setOpenMode("chooser");
    } else {
      setOpenMode("panel");
    }
  }

  function closeOpen() {
    setOpenDeviceId(null);
    setOpenMode(null);
  }

  function addDevice(type: DeviceKind) {
    const name = nextDeviceName(state, type);
    const device = createDevice(
      type,
      name,
      160 + Math.random() * 360,
      120 + Math.random() * 240,
    );
    setState((s) => ({ ...s, devices: [...s.devices, device] }));
    setTool("select");
    showToast(`Aggiunto ${name}`);
  }

  function onDevicePointerDown(e: React.PointerEvent, device: Device) {
    e.stopPropagation();
    if (tool === "delete") {
      setState((s) => deleteDevice(s, device.id));
      if (openDeviceId === device.id) closeOpen();
      showToast(`Eliminato ${device.name}`);
      return;
    }
    if (tool === "cable") {
      if (!cableFrom) {
        setCableFrom(device.id);
        setSelectedId(device.id);
        showToast("Cavo: seleziona il secondo dispositivo");
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

  return (
    <div className="flex min-h-screen flex-col bg-[var(--lab-bg)] text-[var(--lab-fg)]">
      <header className="relative z-20 flex flex-wrap items-center gap-2 border-b border-[var(--lab-line)] bg-[var(--lab-panel)]/95 px-3 py-2 backdrop-blur sm:gap-3 sm:px-4">
        <a
          href="/"
          className="flex h-8 w-8 items-center justify-center rounded bg-sky-600 font-display text-sm font-bold text-white"
          title="Home"
        >
          NL
        </a>
        <div className="mr-1">
          <div className="font-display text-base font-semibold tracking-tight">
            NetLab
          </div>
          <div className="text-[11px] text-slate-400">
            Packet Tracer–like · ReactOS per host · resto simulato
          </div>
        </div>

        <ToolButton
          active={tool === "select"}
          onClick={() => {
            setTool("select");
            setCableFrom(null);
          }}
        >
          Seleziona
        </ToolButton>
        <ToolButton
          active={tool === "cable"}
          onClick={() => {
            setTool("cable");
            setCableFrom(null);
          }}
        >
          Cavo
        </ToolButton>
        <ToolButton
          active={tool === "delete"}
          onClick={() => {
            setTool("delete");
            setCableFrom(null);
          }}
        >
          Elimina
        </ToolButton>

        <div className="ml-auto flex flex-wrap gap-2">
          <a
            href="/vnc"
            className="rounded-md bg-orange-700/90 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-orange-600 sm:text-sm"
          >
            ReactOS / VNC
          </a>
          <ToolButton
            onClick={() => {
              setState(createDemoLab());
              closeOpen();
              showToast("Demo LAN ricaricata");
            }}
          >
            Demo LAN
          </ToolButton>
          <ToolButton
            onClick={() => {
              setState(createEmptyLab());
              closeOpen();
            }}
          >
            Svuota
          </ToolButton>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="max-h-[40vh] overflow-y-auto border-b border-[var(--lab-line)] bg-[var(--lab-panel)] p-3 lg:max-h-none lg:w-72 lg:border-b-0 lg:border-r">
          <h2 className="font-display text-sm font-semibold text-sky-200">
            Dispositivi
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Catalogo in stile Packet Tracer (slice 1). Host con OS: PC / Laptop /
            Server → ReactOS. Switch, modem, stampanti = simulati.
          </p>
          {PALETTE.map((group) => (
            <div key={group.title} className="mt-3">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {group.title}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {group.types.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addDevice(type)}
                    className="flex items-center gap-1.5 rounded border border-slate-700/80 bg-slate-950/40 px-1.5 py-1.5 text-left text-[11px] text-slate-200 hover:border-sky-500/50 hover:bg-slate-800/60"
                  >
                    <DeviceIcon type={type} className="h-7 w-7 shrink-0" />
                    <span className="leading-tight">{DEVICE_META[type].label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {selectedId && (
            <SelectedInfo
              device={state.devices.find((d) => d.id === selectedId)}
              onOpen={() => {
                const d = state.devices.find((x) => x.id === selectedId);
                if (d) openDeviceUi(d);
              }}
            />
          )}
        </aside>

        <main className="relative min-h-[420px] flex-1">
          <div
            ref={canvasRef}
            className="lab-grid absolute inset-0 overflow-hidden"
            onPointerMove={onCanvasPointerMove}
            onPointerUp={() => setDrag(null)}
            onPointerLeave={() => setDrag(null)}
            onClick={() => {
              if (tool === "select") setSelectedId(null);
            }}
          >
            <svg
              className="absolute inset-0 h-full w-full"
              style={{ pointerEvents: tool === "delete" ? "auto" : "none" }}
            >
              {state.links.map((link) => {
                const a = state.devices.find((d) => d.id === link.aDeviceId);
                const b = state.devices.find((d) => d.id === link.bDeviceId);
                if (!a || !b) return null;
                const color =
                  link.media === "serial"
                    ? "#fbbf24"
                    : link.media === "wireless"
                      ? "#a78bfa"
                      : "#38bdf8";
                return (
                  <g key={link.id}>
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={color}
                      strokeWidth="2.5"
                      strokeOpacity="0.85"
                      strokeDasharray={link.media === "wireless" ? "4 3" : undefined}
                    />
                    {tool === "delete" && (
                      <line
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke="transparent"
                        strokeWidth="14"
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setState((s) => deleteLink(s, link.id));
                          showToast("Cavo rimosso");
                        }}
                      />
                    )}
                  </g>
                );
              })}
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
                  openDeviceUi(device);
                }}
              >
                <DeviceIcon type={device.type} className="h-12 w-12 drop-shadow-lg" />
                <span className="rounded bg-slate-950/70 px-1.5 py-0.5 text-[11px] font-medium text-slate-100">
                  {device.name}
                </span>
                {device.interfaces[0]?.ip && isEndHost(device.type) && (
                  <span className="text-[10px] text-sky-300/90">
                    {device.interfaces[0].ip}
                  </span>
                )}
              </button>
            ))}
          </div>

          {toast && (
            <div className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full border border-slate-600 bg-slate-900/95 px-4 py-2 text-sm text-slate-100 shadow-lg">
              {toast}
            </div>
          )}
        </main>
      </div>

      {openDevice && openMode === "chooser" && (
        <HostOpenDialog
          device={openDevice}
          onClose={closeOpen}
          onSimulated={() => setOpenMode("sim")}
          onReactOs={() => setOpenMode("reactos")}
        />
      )}
      {openDevice && openMode === "sim" && (
        <WindowsDesktop
          device={openDevice}
          stateRef={stateRef}
          setState={setState}
          onClose={closeOpen}
        />
      )}
      {openDevice && openMode === "reactos" && (
        <ReactOsSession device={openDevice} onClose={closeOpen} />
      )}
      {openDevice && openMode === "router" && (
        <RouterConsole
          device={openDevice}
          stateRef={stateRef}
          setState={setState}
          onClose={closeOpen}
        />
      )}
      {openDevice && openMode === "switch" && (
        <SwitchPanel device={openDevice} onClose={closeOpen} />
      )}
      {openDevice && openMode === "panel" && (
        <SimpleDevicePanel device={openDevice} onClose={closeOpen} />
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
      <div className="mt-1 text-slate-500">{DEVICE_META[device.type].label}</div>
      {device.osSlot && (
        <div className="mt-1 text-orange-300/90">ReactOS slot: {device.osSlot}</div>
      )}
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 w-full rounded bg-sky-700 py-1.5 text-slate-50 hover:bg-sky-600"
      >
        Apri
      </button>
    </div>
  );
}
