"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { CABLE_META, PT_PALETTE, type CableKind } from "@/lib/network/catalog";
import {
  DEVICE_META,
  isEndHost,
  type Device,
  type DeviceKind,
  type LabState,
} from "@/lib/network/types";
import { ContextMenu, type MenuItem } from "./ContextMenu";
import { DeviceIcon } from "./DeviceIcon";
import { RouterConsole } from "./RouterConsole";
import { SimpleDevicePanel } from "./SimpleDevicePanel";
import { SwitchPanel } from "./SwitchPanel";
import { WindowsDesktop } from "./WindowsDesktop";

type Tool = "select" | "cable" | "delete";
type OpenMode = "sim" | "panel" | "switch" | "router";

type CtxTarget =
  | { kind: "device"; id: string }
  | { kind: "link"; id: string }
  | { kind: "palette"; type: DeviceKind }
  | { kind: "canvas" };

type CtxState = { x: number; y: number; target: CtxTarget } | null;

const CATEGORY_LABELS: Record<string, string> = {
  "End Devices": "End",
  Switches: "Switch",
  Routers: "Router",
  Wireless: "Wi‑Fi",
  "Security / WAN": "WAN",
};

function modeFor(device: Device): OpenMode {
  if (
    device.type === "switch" ||
    device.type === "hub" ||
    device.type === "bridge" ||
    device.type === "repeater" ||
    device.type.startsWith("switch_")
  ) {
    return "switch";
  }
  if (
    device.type === "router" ||
    device.type.startsWith("router_") ||
    device.type === "wireless_router" ||
    device.type === "home_router" ||
    device.type.startsWith("firewall_") ||
    device.type === "multilayer_switch" ||
    device.type === "wlc"
  ) {
    return "router";
  }
  if (device.type === "pc" || device.type === "laptop" || device.type === "server") {
    return "sim";
  }
  return "panel";
}

export function LabWorkspace() {
  const [state, setState] = useState<LabState>(() => createDemoLab());
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const [tool, setTool] = useState<Tool>("select");
  const [cableKind, setCableKind] = useState<CableKind>("auto");
  const [cableFrom, setCableFrom] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openDeviceId, setOpenDeviceId] = useState<string | null>(null);
  const [openMode, setOpenMode] = useState<OpenMode | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; ox: number; oy: number } | null>(
    null,
  );
  const [ctx, setCtx] = useState<CtxState>(null);
  const [category, setCategory] = useState<string>(PT_PALETTE[0].title);
  const [filter, setFilter] = useState("");
  const [inspectId, setInspectId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  }, []);

  const openDevice = state.devices.find((d) => d.id === openDeviceId) ?? null;
  const inspectDevice = state.devices.find((d) => d.id === inspectId) ?? null;

  const filteredTypes = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const group = PT_PALETTE.find((g) => g.title === category) ?? PT_PALETTE[0];
    return group.types.filter((t) => {
      if (!q) return true;
      const meta = DEVICE_META[t];
      return (
        meta.label.toLowerCase().includes(q) ||
        meta.ptModel.toLowerCase().includes(q) ||
        t.toLowerCase().includes(q)
      );
    });
  }, [category, filter]);

  const openDeviceUi = useCallback((device: Device) => {
    setCtx(null);
    setInspectId(null);
    setOpenDeviceId(device.id);
    setSelectedId(device.id);
    setOpenMode(modeFor(device));
  }, []);

  function closeOpen() {
    setOpenDeviceId(null);
    setOpenMode(null);
  }

  const addDevice = useCallback(
    (type: DeviceKind) => {
      setState((s) => {
        const name = nextDeviceName(s, type);
        const rect = canvasRef.current?.getBoundingClientRect();
        const x = 120 + Math.random() * Math.max(200, (rect?.width ?? 600) - 240);
        const y = 80 + Math.random() * Math.max(120, (rect?.height ?? 400) - 200);
        const device = createDevice(type, name, x, y);
        queueMicrotask(() => {
          setSelectedId(device.id);
          showToast(`Aggiunto ${name}`);
        });
        return { ...s, devices: [...s.devices, device] };
      });
      setTool("select");
      setCableFrom(null);
    },
    [showToast],
  );

  const startCableFrom = useCallback(
    (deviceId: string) => {
      setTool("cable");
      setCableFrom(deviceId);
      setSelectedId(deviceId);
      showToast("Seleziona il secondo dispositivo");
    },
    [showToast],
  );

  function onDevicePointerDown(e: React.PointerEvent, device: Device) {
    if (e.button === 2) return;
    e.stopPropagation();
    setCtx(null);
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
        showToast("Seleziona il secondo dispositivo");
        return;
      }
      if (cableFrom === device.id) return;
      const result = connectDevices(state, cableFrom, device.id, cableKind);
      if (result.error) showToast(result.error);
      else {
        setState(result.state);
        showToast("Cavo collegato");
      }
      setCableFrom(null);
      setTool("select");
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
    const x = Math.max(48, Math.min(rect.width - 48, e.clientX - rect.left - drag.ox));
    const y = Math.max(48, Math.min(rect.height - 48, e.clientY - rect.top - drag.oy));
    setState((s) => moveDevice(s, drag.id, x, y));
  }

  function openContext(e: React.MouseEvent, target: CtxTarget) {
    e.preventDefault();
    e.stopPropagation();
    setCtx({ x: e.clientX, y: e.clientY, target });
    if (target.kind === "device") setSelectedId(target.id);
  }

  const menuItems: MenuItem[] = useMemo(() => {
    if (!ctx) return [];

    if (ctx.target.kind === "device") {
      const id = ctx.target.id;
      const d = state.devices.find((x) => x.id === id);
      if (!d) return [];
      return [
        {
          type: "item",
          label: "Apri",
          shortcut: "2× clic",
          onClick: () => openDeviceUi(d),
        },
        {
          type: "item",
          label: "Cos'è…",
          onClick: () => setInspectId(d.id),
        },
        { type: "sep" },
        {
          type: "item",
          label: "Collega cavo…",
          onClick: () => startCableFrom(d.id),
        },
        { type: "sep" },
        {
          type: "item",
          label: "Elimina",
          danger: true,
          shortcut: "Canc",
          onClick: () => {
            setState((s) => deleteDevice(s, d.id));
            if (openDeviceId === d.id) closeOpen();
            setSelectedId(null);
            showToast(`Eliminato ${d.name}`);
          },
        },
      ];
    }

    if (ctx.target.kind === "link") {
      const id = ctx.target.id;
      const link = state.links.find((l) => l.id === id);
      if (!link) return [];
      const media = CABLE_META[link.media]?.label ?? link.media;
      return [
        {
          type: "item",
          label: "Cos'è…",
          onClick: () => showToast(`Cavo: ${media}`),
        },
        { type: "sep" },
        {
          type: "item",
          label: "Elimina cavo",
          danger: true,
          onClick: () => {
            setState((s) => deleteLink(s, link.id));
            showToast("Cavo rimosso");
          },
        },
      ];
    }

    if (ctx.target.kind === "palette") {
      const type = ctx.target.type;
      const meta = DEVICE_META[type];
      return [
        {
          type: "item",
          label: `Aggiungi ${meta.label}`,
          onClick: () => addDevice(type),
        },
        {
          type: "item",
          label: "Cos'è…",
          onClick: () =>
            showToast(`${meta.label} · modello PT: ${meta.ptModel}`),
        },
      ];
    }

    return [
      {
        type: "item",
        label: "Carica demo LAN",
        onClick: () => {
          setState(createDemoLab());
          closeOpen();
          showToast("Demo LAN");
        },
      },
      {
        type: "item",
        label: "Svuota topologia",
        danger: true,
        onClick: () => {
          setState(createEmptyLab());
          closeOpen();
          setSelectedId(null);
        },
      },
      { type: "sep" },
      {
        type: "item",
        label: "Seleziona",
        onClick: () => {
          setTool("select");
          setCableFrom(null);
        },
      },
      {
        type: "item",
        label: "Cavo",
        onClick: () => {
          setTool("cable");
          setCableFrom(null);
        },
      },
    ];
  }, [
    ctx,
    state.devices,
    state.links,
    openDeviceId,
    openDeviceUi,
    showToast,
    addDevice,
    startCableFrom,
  ]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setCtx(null);
        setCableFrom(null);
        setInspectId(null);
        if (tool === "cable" || tool === "delete") setTool("select");
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedId &&
        !openDeviceId
      ) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        setState((s) => deleteDevice(s, selectedId));
        showToast("Eliminato");
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, openDeviceId, tool, showToast]);

  return (
    <div
      className="flex h-screen flex-col overflow-hidden bg-[var(--lab-bg)] text-[var(--lab-fg)]"
      onContextMenu={(e) => e.preventDefault()}
    >
      <header className="relative z-20 flex h-11 shrink-0 items-center gap-1.5 border-b border-[var(--lab-line)] bg-[var(--lab-panel)]/95 px-3 backdrop-blur">
        <a
          href="/"
          className="flex h-7 w-7 items-center justify-center rounded bg-sky-600 font-display text-xs font-bold text-white"
          title="Home"
        >
          NL
        </a>
        <span className="mr-1 font-display text-sm font-semibold tracking-tight">
          NetLab
        </span>
        <div className="mx-1 h-4 w-px bg-slate-700" />

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
        {tool === "cable" && (
          <select
            value={cableKind}
            onChange={(e) => setCableKind(e.target.value as CableKind)}
            className="max-w-[10rem] rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
            title={CABLE_META[cableKind].hint}
          >
            {(Object.keys(CABLE_META) as CableKind[]).map((k) => (
              <option key={k} value={k}>
                {CABLE_META[k].label}
              </option>
            ))}
          </select>
        )}
        <ToolButton
          active={tool === "delete"}
          onClick={() => {
            setTool("delete");
            setCableFrom(null);
          }}
        >
          Elimina
        </ToolButton>

        <div className="ml-auto flex items-center gap-2">
          {cableFrom && (
            <span className="hidden text-[11px] text-amber-300/90 sm:inline">
              Cavo in corso…
            </span>
          )}
          <ToolButton
            onClick={() => {
              setState(createDemoLab());
              closeOpen();
              showToast("Demo LAN");
            }}
          >
            Demo
          </ToolButton>
          <ToolButton
            onClick={() => {
              setState(createEmptyLab());
              closeOpen();
              setSelectedId(null);
            }}
          >
            Svuota
          </ToolButton>
        </div>
      </header>

      <main className="relative min-h-0 flex-1">
        <div
          ref={canvasRef}
          className="lab-grid absolute inset-0 overflow-hidden"
          onPointerMove={onCanvasPointerMove}
          onPointerUp={() => setDrag(null)}
          onPointerLeave={() => setDrag(null)}
          onClick={() => {
            setCtx(null);
            if (tool === "select") setSelectedId(null);
            setInspectId(null);
          }}
          onContextMenu={(e) => openContext(e, { kind: "canvas" })}
        >
          <svg className="absolute inset-0 h-full w-full" style={{ pointerEvents: "none" }}>
            {state.links.map((link) => {
              const a = state.devices.find((d) => d.id === link.aDeviceId);
              const b = state.devices.find((d) => d.id === link.bDeviceId);
              if (!a || !b) return null;
              const meta = CABLE_META[link.media] ?? CABLE_META.straight;
              return (
                <g key={link.id} style={{ pointerEvents: "stroke" }}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={meta.color}
                    strokeWidth="2.5"
                    strokeOpacity="0.85"
                    strokeDasharray={meta.dash}
                  />
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="transparent"
                    strokeWidth="14"
                    className="cursor-pointer"
                    style={{ pointerEvents: "stroke" }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCtx({
                        x: e.clientX,
                        y: e.clientY,
                        target: { kind: "link", id: link.id },
                      });
                    }}
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
          </svg>

          {state.devices.map((device) => (
            <button
              key={device.id}
              type="button"
              className={`absolute flex w-[5.5rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 rounded-lg p-1.5 transition ${
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
              onContextMenu={(e) =>
                openContext(e, { kind: "device", id: device.id })
              }
            >
              <DeviceIcon type={device.type} className="h-11 w-11 drop-shadow-lg" />
              <span className="max-w-full truncate rounded bg-slate-950/75 px-1.5 py-0.5 text-[11px] font-medium text-slate-100">
                {device.name}
              </span>
              {device.interfaces[0]?.ip && isEndHost(device.type) && (
                <span className="text-[10px] text-sky-300/90">
                  {device.interfaces[0].ip}
                </span>
              )}
            </button>
          ))}

          {inspectDevice && (
            <div
              className="absolute bottom-3 left-3 z-20 max-w-xs rounded-lg border border-slate-600/80 bg-slate-950/95 p-3 text-xs shadow-xl"
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.preventDefault()}
            >
              <div className="flex items-start gap-2">
                <DeviceIcon
                  type={inspectDevice.type}
                  className="h-9 w-9 shrink-0"
                />
                <div className="min-w-0">
                  <div className="font-medium text-slate-100">
                    {inspectDevice.name}
                  </div>
                  <div className="text-slate-400">
                    {DEVICE_META[inspectDevice.type].label}
                  </div>
                  <p className="mt-1.5 leading-relaxed text-slate-500">
                    Modello PT: {DEVICE_META[inspectDevice.type].ptModel}.{" "}
                    {isEndHost(inspectDevice.type)
                      ? "Host: desktop Windows (Connessioni di rete)."
                      : "Dispositivo simulato nel lab."}
                  </p>
                  {inspectDevice.interfaces[0] && (
                    <div className="mt-2 font-mono text-[10px] text-sky-300/90">
                      {inspectDevice.interfaces[0].name}
                      {inspectDevice.interfaces[0].ip
                        ? ` · ${inspectDevice.interfaces[0].ip}`
                        : " · senza IP"}
                      {inspectDevice.interfaces[0].connectedLinkId
                        ? " · up"
                        : " · down"}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="ml-auto text-slate-500 hover:text-white"
                  onClick={() => setInspectId(null)}
                >
                  ✕
                </button>
              </div>
              <button
                type="button"
                className="mt-2 w-full rounded bg-sky-700 py-1.5 text-slate-50 hover:bg-sky-600"
                onClick={() => openDeviceUi(inspectDevice)}
              >
                Apri
              </button>
            </div>
          )}
        </div>

        {toast && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-full border border-slate-600/80 bg-slate-900/95 px-4 py-1.5 text-sm text-slate-100 shadow-lg">
            {toast}
          </div>
        )}
      </main>

      <footer className="relative z-20 shrink-0 border-t border-[var(--lab-line)] bg-[var(--lab-panel)]">
        <div className="flex items-center gap-2 border-b border-slate-800/80 px-3 py-1.5">
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {PT_PALETTE.map((g) => (
              <button
                key={g.title}
                type="button"
                onClick={() => {
                  setCategory(g.title);
                  setFilter("");
                }}
                className={`shrink-0 rounded px-2.5 py-1 text-[11px] font-medium transition ${
                  category === g.title
                    ? "bg-sky-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                {CATEGORY_LABELS[g.title] ?? g.title}
              </button>
            ))}
          </div>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtra…"
            className="w-28 shrink-0 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600 outline-none focus:border-sky-600 sm:w-40"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto px-2 py-2">
          {filteredTypes.length === 0 && (
            <div className="px-3 py-2 text-[11px] text-slate-500">
              Nessun risultato.
            </div>
          )}
          {filteredTypes.map((type) => (
            <button
              key={type}
              type="button"
              title={`${DEVICE_META[type].label} (${DEVICE_META[type].ptModel})`}
              onClick={() => addDevice(type)}
              onContextMenu={(e) =>
                openContext(e, { kind: "palette", type })
              }
              className="flex w-[4.75rem] shrink-0 flex-col items-center gap-1 rounded-md border border-transparent px-1 py-1.5 text-center text-[10px] text-slate-300 transition hover:border-slate-600 hover:bg-slate-800/70"
            >
              <DeviceIcon type={type} className="h-9 w-9" />
              <span className="line-clamp-2 leading-tight">
                {DEVICE_META[type].label}
              </span>
            </button>
          ))}
        </div>
      </footer>

      {ctx && menuItems.length > 0 && (
        <ContextMenu
          x={ctx.x}
          y={ctx.y}
          items={menuItems}
          onClose={() => setCtx(null)}
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
      className={`rounded px-2.5 py-1 text-xs font-medium transition ${
        active
          ? "bg-sky-600 text-white"
          : "text-slate-300 hover:bg-slate-800 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
