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
  draftCableStatus,
  evaluateLink,
  linkHealthLabel,
} from "@/lib/network/linkStatus";
import {
  downloadHtmlSnapshot,
  downloadInventoryCsv,
  downloadPng,
  downloadSvg,
} from "@/lib/network/exportDiagram";
import {
  autosaveLab,
  clearAutosave,
  downloadLab,
  hasAutosaveLab,
  loadAutosave,
  parseLabJson,
} from "@/lib/network/persist";
import { shortPortName } from "@/lib/network/portSort";
import {
  buildAutoSimulation,
  buildDhcpSimulation,
  type SimPacket,
} from "@/lib/network/simulation";
import {
  buildShareUrl,
  decodeLabFromHash,
  readShareParamFromLocation,
} from "@/lib/network/share";
import {
  DEVICE_META,
  isEndHost,
  isL3Device,
  isWifiCapable,
  type Device,
  type DeviceKind,
  type LabState,
} from "@/lib/network/types";

const GRID = 28;
function snap(n: number): number {
  return Math.round(n / GRID) * GRID;
}
import { ContextMenu, type MenuItem } from "./ContextMenu";
import { DeviceIcon } from "./DeviceIcon";
import { ExercisesPanel } from "./ExercisesPanel";
import { PortPicker } from "./PortPicker";
import { RouterConsole } from "./RouterConsole";
import { SimOverlay } from "./SimOverlay";
import { SimpleDevicePanel } from "./SimpleDevicePanel";
import { SwitchPanel } from "./SwitchPanel";
import { WifiApPanel } from "./WifiApPanel";
import { WindowsDesktop } from "./WindowsDesktop";

type Tool = "select" | "cable" | "delete" | "simulate";

/** Collegamento in corso stile Packet Tracer (scelta porta) */
type CableDraft = {
  fromDeviceId: string;
  fromIfaceId: string | null;
  toDeviceId: string | null;
};
type OpenMode = "sim" | "panel" | "switch" | "router" | "wifi";

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
  Hubs: "Hub",
  Wireless: "Wi‑Fi",
  Security: "Sec",
  "WAN Emulation": "WAN",
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
  // Home / wireless router: CLI L3 (IP LAN, rotte) — Wi‑Fi dal menu contestuale
  if (isL3Device(device.type)) {
    return "router";
  }
  if (isWifiCapable(device.type)) {
    return "wifi";
  }
  if (
    device.type === "pc" ||
    device.type === "laptop" ||
    device.type === "server" ||
    device.type === "meraki_server"
  ) {
    return "sim";
  }
  return "panel";
}

export function LabWorkspace() {
  const [state, setState] = useState<LabState>(() => createEmptyLab());
  const stateRef = useRef(state);
  const bootDoneRef = useRef(false);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  // Autosave solo dopo il boot (evita wipe del lab precedente con empty)
  useEffect(() => {
    if (!bootDoneRef.current) return;
    if (state.devices.length === 0 && state.links.length === 0) return;
    autosaveLab(state);
  }, [state]);

  const [tool, setTool] = useState<Tool>("select");
  const [cableKind, setCableKind] = useState<CableKind>("auto");
  const [cableDraft, setCableDraft] = useState<CableDraft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openDeviceId, setOpenDeviceId] = useState<string | null>(null);
  const [openMode, setOpenMode] = useState<OpenMode | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; ox: number; oy: number } | null>(
    null,
  );
  const [paletteDrag, setPaletteDrag] = useState<{
    type: DeviceKind;
    x: number;
    y: number;
    startX: number;
    startY: number;
  } | null>(null);
  const paletteDragRef = useRef(paletteDrag);
  paletteDragRef.current = paletteDrag;
  const skipPaletteClickRef = useRef(false);
  const [ctx, setCtx] = useState<CtxState>(null);
  const [category, setCategory] = useState<string>(PT_PALETTE[0].title);
  const [filter, setFilter] = useState("");
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [simPackets, setSimPackets] = useState<SimPacket[] | null>(null);
  const [simFrom, setSimFrom] = useState<string | null>(null);
  const [showExercises, setShowExercises] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  /** Link appena creati: arancio “collegamento…” poi diventano verdi/rossi */
  const [connectingIds, setConnectingIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [cableCursor, setCableCursor] = useState<{ x: number; y: number } | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<LabState[]>([]);
  const redoRef = useRef<LabState[]>([]);
  const shareLoadedRef = useRef(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  const markConnecting = useCallback((linkId: string) => {
    setConnectingIds((prev) => new Set(prev).add(linkId));
    window.setTimeout(() => {
      setConnectingIds((prev) => {
        const next = new Set(prev);
        next.delete(linkId);
        return next;
      });
    }, 900);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  // Boot: share URL > autosave prompt > lab vuoto
  useEffect(() => {
    if (shareLoadedRef.current) return;
    shareLoadedRef.current = true;
    void (async () => {
      const param = readShareParamFromLocation();
      if (param) {
        const decoded = await decodeLabFromHash(param);
        if (decoded.state) {
          setState(decoded.state);
          showToast("Lab aperto dal link (snapshot)");
        } else if (decoded.error) {
          showToast(decoded.error);
        }
        bootDoneRef.current = true;
        return;
      }
      if (hasAutosaveLab()) {
        const ok = window.confirm(
          "Trovato un lab salvato in automatico.\nVuoi ripristinarlo?",
        );
        if (ok) {
          const saved = loadAutosave();
          if (saved) setState(saved);
          showToast("Lab ripristinato dall’autosave");
        }
      }
      bootDoneRef.current = true;
    })();
  }, [showToast]);

  const pushHistory = useCallback(() => {
    historyRef.current = [
      ...historyRef.current.slice(-39),
      structuredClone(stateRef.current),
    ];
    redoRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const applyState = useCallback(
    (next: LabState | ((prev: LabState) => LabState)) => {
      pushHistory();
      setState(next);
    },
    [pushHistory],
  );

  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) {
      setCanUndo(false);
      showToast("Niente da annullare");
      return;
    }
    redoRef.current = [
      ...redoRef.current.slice(-39),
      structuredClone(stateRef.current),
    ];
    setState(prev);
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
    showToast("Annullato");
  }, [showToast]);

  const redo = useCallback(() => {
    const next = redoRef.current.pop();
    if (!next) {
      setCanRedo(false);
      showToast("Niente da ripetere");
      return;
    }
    historyRef.current = [
      ...historyRef.current.slice(-39),
      structuredClone(stateRef.current),
    ];
    setState(next);
    setCanRedo(redoRef.current.length > 0);
    setCanUndo(true);
    showToast("Ripetuto");
  }, [showToast]);

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

  const confirmNewLab = useCallback(() => {
    const dirty =
      stateRef.current.devices.length > 0 || stateRef.current.links.length > 0;
    if (
      dirty &&
      !window.confirm(
        "Nuovo lab: cancellare la topologia attuale?\n(Puoi usare Annulla subito dopo)",
      )
    ) {
      return;
    }
    applyState(createEmptyLab());
    clearAutosave();
    setOpenDeviceId(null);
    setOpenMode(null);
    setSelectedId(null);
    setCableDraft(null);
    showToast("Nuovo lab vuoto");
  }, [applyState, showToast]);

  const addDeviceAt = useCallback(
    (type: DeviceKind, x?: number, y?: number) => {
      applyState((s) => {
        const name = nextDeviceName(s, type);
        const rect = canvasRef.current?.getBoundingClientRect();
        const px = snap(
          x ??
            120 + Math.random() * Math.max(200, (rect?.width ?? 600) - 240),
        );
        const py = snap(
          y ??
            80 + Math.random() * Math.max(120, (rect?.height ?? 400) - 200),
        );
        const device = createDevice(type, name, px, py);
        queueMicrotask(() => {
          setSelectedId(device.id);
          showToast(`Aggiunto ${name}`);
        });
        return { ...s, devices: [...s.devices, device] };
      });
      setTool("select");
      setCableDraft(null);
    },
    [applyState, showToast],
  );

  const addDevice = useCallback(
    (type: DeviceKind) => addDeviceAt(type),
    [addDeviceAt],
  );

  const shareLab = useCallback(async () => {
    setShareBusy(true);
    try {
      const url = await buildShareUrl(stateRef.current);
      if (url.length > 7000) {
        showToast("Lab grande: il link potrebbe non funzionare — usa Esporta JSON");
      }
      window.history.replaceState(null, "", url);
      try {
        await navigator.clipboard.writeText(url);
        showToast("Link snapshot copiato — ripremi Condividi dopo le modifiche");
      } catch {
        showToast("Link snapshot in barra — non si aggiorna da solo");
      }
    } catch {
      showToast("Condivisione fallita (lab troppo grande?) — usa Esporta JSON");
    } finally {
      setShareBusy(false);
    }
  }, [showToast]);

  const cancelCable = useCallback(() => {
    setCableDraft(null);
    setCableCursor(null);
    setTool("select");
  }, []);

  const startCableFrom = useCallback(
    (deviceId: string) => {
      setTool("cable");
      setCableDraft({
        fromDeviceId: deviceId,
        fromIfaceId: null,
        toDeviceId: null,
      });
      setSelectedId(deviceId);
      showToast("Scegli la porta sul primo dispositivo");
    },
    [showToast],
  );

  function onDevicePointerDown(e: React.PointerEvent, device: Device) {
    if (e.button === 2) return;
    e.stopPropagation();
    setCtx(null);
    if (tool === "delete") {
      applyState((s) => deleteDevice(s, device.id));
      if (openDeviceId === device.id) closeOpen();
      showToast(`Eliminato ${device.name}`);
      return;
    }
    if (tool === "simulate") {
      if (!simFrom) {
        setSimFrom(device.id);
        setSelectedId(device.id);
        showToast("Simulation: seleziona destinazione (ping/DHCP/DNS/HTTP)");
        return;
      }
      if (simFrom === device.id) {
        // Stesso host → simula DHCP renew
        const built = buildDhcpSimulation(state, simFrom);
        applyState(built.state);
        setSimPackets(built.packets.length ? built.packets : null);
        showToast(built.message);
        setSimFrom(null);
        setTool("select");
        return;
      }
      const built = buildAutoSimulation(state, simFrom, device.id);
      applyState(built.state);
      setSimPackets(built.packets.length ? built.packets : null);
      showToast(built.packets.length ? "Simulation avviata" : built.message);
      setSimFrom(null);
      setTool("select");
      return;
    }
    if (tool === "cable") {
      // 1) primo device → picker porta
      if (!cableDraft) {
        setCableDraft({
          fromDeviceId: device.id,
          fromIfaceId: null,
          toDeviceId: null,
        });
        setSelectedId(device.id);
        showToast("Scegli la porta");
        return;
      }
      // ancora in attesa della porta del primo
      if (!cableDraft.fromIfaceId) {
        if (cableDraft.fromDeviceId !== device.id) {
          setCableDraft({
            fromDeviceId: device.id,
            fromIfaceId: null,
            toDeviceId: null,
          });
          setSelectedId(device.id);
        }
        return;
      }
      // 2) secondo device → picker porta
      if (cableDraft.fromDeviceId === device.id) {
        showToast("Scegli un altro dispositivo");
        return;
      }
      setCableDraft({
        ...cableDraft,
        toDeviceId: device.id,
      });
      setSelectedId(device.id);
      showToast("Scegli la porta di destinazione");
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
    const rawX = Math.max(
      48,
      Math.min(rect.width - 48, e.clientX - rect.left - drag.ox),
    );
    const rawY = Math.max(
      48,
      Math.min(rect.height - 48, e.clientY - rect.top - drag.oy),
    );
    setState((s) => moveDevice(s, drag.id, snap(rawX), snap(rawY)));
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
        ...(isWifiCapable(d.type) && isL3Device(d.type)
          ? [
              {
                type: "item" as const,
                label: "Configura Wi‑Fi…",
                onClick: () => {
                  setCtx(null);
                  setOpenDeviceId(d.id);
                  setSelectedId(d.id);
                  setOpenMode("wifi");
                },
              },
            ]
          : []),
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
        {
          type: "item",
          label: "Simula ping da qui…",
          onClick: () => {
            setTool("simulate");
            setSimFrom(d.id);
            showToast("Clicca la destinazione");
          },
        },
        { type: "sep" },
        {
          type: "item",
          label: "Elimina",
          danger: true,
          shortcut: "Canc",
          onClick: () => {
            applyState((s) => deleteDevice(s, d.id));
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
      const a = state.devices.find((d) => d.id === link.aDeviceId);
      const b = state.devices.find((d) => d.id === link.bDeviceId);
      const aIf = a?.interfaces.find((i) => i.id === link.aIfaceId);
      const bIf = b?.interfaces.find((i) => i.id === link.bIfaceId);
      const ends =
        a && b && aIf && bIf
          ? `${a.name}:${shortPortName(aIf.name)} ↔ ${b.name}:${shortPortName(bIf.name)}`
          : media;
      return [
        {
          type: "item",
          label: ends,
          onClick: () => showToast(`${ends} · ${media}`),
        },
        { type: "sep" },
        {
          type: "item",
          label: "Elimina cavo",
          danger: true,
          onClick: () => {
            applyState((s) => deleteLink(s, link.id));
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
          applyState(createDemoLab());
          closeOpen();
          showToast("Demo LAN");
        },
      },
      {
        type: "item",
        label: "Nuovo lab…",
        onClick: () => confirmNewLab(),
      },
      {
        type: "item",
        label: "Annulla",
        shortcut: "Ctrl+Z",
        onClick: () => undo(),
      },
      {
        type: "item",
        label: "Ripeti",
        shortcut: "Ctrl+Y",
        onClick: () => redo(),
      },
      { type: "sep" },
      {
        type: "item",
        label: "Seleziona",
        onClick: () => {
          setTool("select");
          setCableDraft(null);
        },
      },
      {
        type: "item",
        label: "Cavo",
        onClick: () => {
          setTool("cable");
          setCableDraft(null);
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
    applyState,
    confirmNewLab,
    undo,
    redo,
  ]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setCtx(null);
        setCableDraft(null);
        setInspectId(null);
        setShowExport(false);
        if (tool === "cable" || tool === "delete") setTool("select");
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        undo();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === "y" ||
          (e.key.toLowerCase() === "z" && e.shiftKey))
      ) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        redo();
        return;
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedId &&
        !openDeviceId
      ) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        applyState((s) => deleteDevice(s, selectedId));
        showToast("Eliminato");
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, openDeviceId, tool, showToast, undo, redo, applyState]);

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
            setCableDraft(null);
            setSimFrom(null);
          }}
        >
          Seleziona
        </ToolButton>
        <ToolButton
          active={tool === "cable"}
          onClick={() => {
            setTool("cable");
            setCableDraft(null);
            setSimFrom(null);
            showToast("Cavo: clicca un device e scegli la porta");
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
            setCableDraft(null);
            setSimFrom(null);
          }}
        >
          Elimina
        </ToolButton>
        <ToolButton
          active={tool === "simulate"}
          onClick={() => {
            setTool("simulate");
            setCableDraft(null);
            setSimFrom(null);
            showToast("Simulation: clicca sorgente poi destinazione");
          }}
        >
          Simulation
        </ToolButton>

        <div className="ml-auto flex items-center gap-2">
          {(cableDraft || simFrom) && (
            <span className="hidden text-[11px] text-amber-300/90 sm:inline">
              {simFrom
                ? "Sim… destinazione"
                : !cableDraft?.fromIfaceId
                  ? "Cavo… scegli porta 1"
                  : !cableDraft?.toDeviceId
                    ? "Cavo… clicca device 2"
                    : "Cavo… scegli porta 2"}
            </span>
          )}
          <ToolButton active={canUndo} onClick={undo} title="Ctrl+Z">
            Annulla
          </ToolButton>
          <ToolButton active={canRedo} onClick={redo} title="Ctrl+Y">
            Ripeti
          </ToolButton>
          <div className="relative">
            <ToolButton
              active={showExport}
              onClick={() => setShowExport((v) => !v)}
            >
              Esporta
            </ToolButton>
            {showExport && (
              <div className="absolute right-0 top-full z-40 mt-1 w-52 overflow-hidden rounded-md border border-slate-700 bg-slate-950 py-1 text-xs shadow-xl">
                {(
                  [
                    {
                      id: "json",
                      label: "Lab JSON (.json)",
                      run: () => {
                        downloadLab(state);
                        showToast("Esportato JSON");
                      },
                    },
                    {
                      id: "png",
                      label: "Schema PNG (.png)",
                      run: async () => {
                        await downloadPng(state);
                        showToast("Esportato PNG");
                      },
                    },
                    {
                      id: "svg",
                      label: "Schema SVG (.svg)",
                      run: () => {
                        downloadSvg(state);
                        showToast("Esportato SVG");
                      },
                    },
                    {
                      id: "html",
                      label: "Snapshot HTML (.html)",
                      run: () => {
                        downloadHtmlSnapshot(state);
                        showToast("Esportato HTML");
                      },
                    },
                    {
                      id: "csv",
                      label: "Inventario CSV (.csv)",
                      run: () => {
                        downloadInventoryCsv(state);
                        showToast("Esportato CSV");
                      },
                    },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-slate-200 hover:bg-sky-900/50"
                    onClick={() => {
                      void item.run();
                      setShowExport(false);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <ToolButton
            onClick={() => void shareLab()}
            title="Copia link con topologia (nessun account)"
          >
            {shareBusy ? "…" : "Condividi"}
          </ToolButton>
          <ToolButton onClick={() => fileRef.current?.click()}>Carica</ToolButton>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const text = await file.text();
              const parsed = parseLabJson(text);
              if (parsed.error || !parsed.state) {
                showToast(parsed.error ?? "Caricamento fallito");
                return;
              }
              applyState(parsed.state);
              closeOpen();
              showToast("Lab caricato");
            }}
          />
          <ToolButton
            onClick={() => {
              applyState(createDemoLab());
              closeOpen();
              showToast("Demo LAN");
            }}
          >
            Demo
          </ToolButton>
          <ToolButton onClick={confirmNewLab}>Nuovo</ToolButton>
        </div>
      </header>

      <main className="relative min-h-0 flex-1">
        <div
          ref={canvasRef}
          className="lab-grid absolute inset-0 overflow-hidden"
          onPointerMove={(e) => {
            onCanvasPointerMove(e);
            if (cableDraft) {
              const rect = canvasRef.current?.getBoundingClientRect();
              if (rect) {
                setCableCursor({
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                });
              }
            }
          }}
          onPointerUp={() => {
            setDrag(null);
          }}
          onPointerLeave={() => {
            setDrag(null);
            if (!cableDraft) setCableCursor(null);
          }}
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
              const aIf = a.interfaces.find((i) => i.id === link.aIfaceId);
              const bIf = b.interfaces.find((i) => i.id === link.bIfaceId);
              const status = evaluateLink(state, link, {
                connecting: connectingIds.has(link.id),
              });
              const ax = a.x + (b.x - a.x) * 0.2;
              const ay = a.y + (b.y - a.y) * 0.2;
              const bx = a.x + (b.x - a.x) * 0.8;
              const by = a.y + (b.y - a.y) * 0.8;
              const tip = `${linkHealthLabel(status.health)} — ${status.reason}\n${a.name}:${aIf ? shortPortName(aIf.name) : "?"} ↔ ${b.name}:${bIf ? shortPortName(bIf.name) : "?"} (${meta.label})`;
              const dash =
                status.health === "connecting"
                  ? "6 4"
                  : status.health === "down"
                    ? "5 5"
                    : meta.dash;
              return (
                <g key={link.id} style={{ pointerEvents: "stroke" }}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={status.color}
                    strokeWidth={status.health === "up" ? 2.5 : 3}
                    strokeOpacity={status.health === "down" ? 0.85 : 0.95}
                    strokeDasharray={dash}
                  />
                  {/* LED al centro del cavo */}
                  <circle
                    cx={(a.x + b.x) / 2}
                    cy={(a.y + b.y) / 2}
                    r={4}
                    fill={status.color}
                    stroke="#020617"
                    strokeWidth="1"
                  />
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="transparent"
                    strokeWidth="16"
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
                        applyState((s) => deleteLink(s, link.id));
                        showToast("Cavo rimosso");
                      } else {
                        showToast(
                          `${linkHealthLabel(status.health)}: ${status.reason}`,
                        );
                      }
                    }}
                  >
                    <title>{tip}</title>
                  </line>
                  {aIf && (
                    <g style={{ pointerEvents: "none" }}>
                      <rect
                        x={ax - 24}
                        y={ay - 18}
                        width={48}
                        height={14}
                        rx={3}
                        fill="#020617"
                        fillOpacity="0.92"
                        stroke="#334155"
                        strokeWidth="1"
                      />
                      <text
                        x={ax}
                        y={ay - 7}
                        textAnchor="middle"
                        fill="#f1f5f9"
                        style={{ fontSize: 9, fontFamily: "ui-monospace, monospace" }}
                      >
                        {shortPortName(aIf.name)}
                      </text>
                    </g>
                  )}
                  {bIf && (
                    <g style={{ pointerEvents: "none" }}>
                      <rect
                        x={bx - 24}
                        y={by - 18}
                        width={48}
                        height={14}
                        rx={3}
                        fill="#020617"
                        fillOpacity="0.92"
                        stroke="#334155"
                        strokeWidth="1"
                      />
                      <text
                        x={bx}
                        y={by - 7}
                        textAnchor="middle"
                        fill="#f1f5f9"
                        style={{ fontSize: 9, fontFamily: "ui-monospace, monospace" }}
                      >
                        {shortPortName(bIf.name)}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
            {/* Anteprima cavo in fase di collegamento (arancio) */}
            {cableDraft &&
              (() => {
                const from = state.devices.find(
                  (d) => d.id === cableDraft.fromDeviceId,
                );
                if (!from) return null;
                const to = cableDraft.toDeviceId
                  ? state.devices.find((d) => d.id === cableDraft.toDeviceId)
                  : null;
                const end = to
                  ? { x: to.x, y: to.y }
                  : cableCursor;
                if (!end) return null;
                const st = draftCableStatus();
                return (
                  <g key="draft-cable">
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={end.x}
                      y2={end.y}
                      stroke={st.color}
                      strokeWidth="2.5"
                      strokeDasharray="7 5"
                      strokeOpacity="0.95"
                    />
                    <circle
                      cx={(from.x + end.x) / 2}
                      cy={(from.y + end.y) / 2}
                      r={4}
                      fill={st.color}
                      stroke="#020617"
                      strokeWidth="1"
                    />
                  </g>
                );
              })()}
          </svg>

          <div className="pointer-events-none absolute bottom-3 right-3 z-20 flex gap-3 rounded-md border border-slate-700/80 bg-slate-950/90 px-2.5 py-1.5 text-[10px] text-slate-300">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Connesso
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
              Collegamento…
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
              Errore / spento
            </span>
          </div>

          {state.devices.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="max-w-sm text-center text-sm text-slate-500">
                Canvas vuoto — scegli un dispositivo dalla barra sotto
                (stile Packet Tracer).
              </p>
            </div>
          )}

          {state.devices.map((device) => (
            <button
              key={device.id}
              type="button"
              className={`absolute flex w-[5.5rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 rounded-lg p-1.5 transition ${
                selectedId === device.id ||
                cableDraft?.fromDeviceId === device.id ||
                cableDraft?.toDeviceId === device.id ||
                simFrom === device.id
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

          {simPackets && (
            <SimOverlay
              packets={simPackets}
              onDone={() => setSimPackets(null)}
            />
          )}

          {showExercises && (
            <div className="absolute bottom-3 right-3 z-20 w-72">
              <ExercisesPanel state={state} />
              <button
                type="button"
                className="mt-1 text-[10px] text-slate-500 hover:text-slate-300"
                onClick={() => setShowExercises(false)}
              >
                Nascondi esercizi
              </button>
            </div>
          )}
          {!showExercises && (
            <button
              type="button"
              className="absolute bottom-3 right-3 z-20 rounded border border-slate-700 bg-slate-900/90 px-2 py-1 text-[10px] text-slate-400"
              onClick={() => setShowExercises(true)}
            >
              Esercizi
            </button>
          )}

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
              title={`${DEVICE_META[type].label} — trascina sul canvas o clicca`}
              onClick={() => {
                if (skipPaletteClickRef.current) {
                  skipPaletteClickRef.current = false;
                  return;
                }
                addDevice(type);
              }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                const rect = canvasRef.current?.getBoundingClientRect();
                const x = rect ? e.clientX - rect.left : e.clientX;
                const y = rect ? e.clientY - rect.top : e.clientY;
                const next = { type, x, y, startX: x, startY: y };
                paletteDragRef.current = next;
                setPaletteDrag(next);
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                const drag = paletteDragRef.current;
                if (!drag || drag.type !== type) return;
                const rect = canvasRef.current?.getBoundingClientRect();
                if (!rect) return;
                const next = {
                  ...drag,
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                };
                paletteDragRef.current = next;
                setPaletteDrag(next);
              }}
              onPointerUp={(e) => {
                const drag = paletteDragRef.current;
                paletteDragRef.current = null;
                setPaletteDrag(null);
                try {
                  (e.currentTarget as HTMLElement).releasePointerCapture(
                    e.pointerId,
                  );
                } catch {
                  /* ignore */
                }
                if (!drag || drag.type !== type) return;
                const rect = canvasRef.current?.getBoundingClientRect();
                const x = rect ? e.clientX - rect.left : drag.x;
                const y = rect ? e.clientY - rect.top : drag.y;
                const inCanvas =
                  !!rect &&
                  e.clientX >= rect.left &&
                  e.clientX <= rect.right &&
                  e.clientY >= rect.top &&
                  e.clientY <= rect.bottom;
                const moved =
                  Math.hypot(x - drag.startX, y - drag.startY) > 14;
                skipPaletteClickRef.current = true;
                if (inCanvas && moved) {
                  addDeviceAt(type, x, y);
                } else if (!moved) {
                  addDevice(type);
                } else {
                  skipPaletteClickRef.current = false;
                }
              }}
              onContextMenu={(e) =>
                openContext(e, { kind: "palette", type })
              }
              className="flex w-[4.6rem] shrink-0 cursor-grab flex-col items-center gap-1 rounded-md border border-slate-600/70 bg-slate-200/95 px-1 py-1.5 text-center text-[10px] font-medium text-slate-800 shadow-sm transition hover:border-sky-500 hover:bg-white active:cursor-grabbing"
            >
              <DeviceIcon type={type} className="h-9 w-9" />
              <span className="line-clamp-2 leading-tight">
                {DEVICE_META[type].label}
              </span>
            </button>
          ))}
        </div>
      </footer>

      {paletteDrag && (
        <div
          className="pointer-events-none fixed z-[80] -translate-x-1/2 -translate-y-1/2 opacity-90"
          style={{
            left:
              (canvasRef.current?.getBoundingClientRect().left ?? 0) +
              paletteDrag.x,
            top:
              (canvasRef.current?.getBoundingClientRect().top ?? 0) +
              paletteDrag.y,
          }}
        >
          <div className="flex flex-col items-center rounded-md border border-sky-400 bg-slate-200/95 px-2 py-1 shadow-xl">
            <DeviceIcon type={paletteDrag.type} className="h-10 w-10" />
            <span className="text-[10px] font-medium text-slate-800">
              {DEVICE_META[paletteDrag.type].label}
            </span>
          </div>
        </div>
      )}

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
        <SwitchPanel
          device={openDevice}
          stateRef={stateRef}
          setState={setState}
          onClose={closeOpen}
        />
      )}
      {openDevice && openMode === "wifi" && (
        <WifiApPanel
          device={openDevice}
          stateRef={stateRef}
          setState={setState}
          onClose={closeOpen}
        />
      )}
      {openDevice && openMode === "panel" && (
        <SimpleDevicePanel device={openDevice} onClose={closeOpen} />
      )}

      {cableDraft && !cableDraft.fromIfaceId && (
        <PortPicker
          device={
            state.devices.find((d) => d.id === cableDraft.fromDeviceId)!
          }
          title="Collega cavo — porta di partenza"
          cableHint="PC ↔ Switch: scegli FastEthernet/GigabitEthernet (non Wi‑Fi)."
          onCancel={cancelCable}
          onPick={(ifaceId) => {
            setCableDraft({
              ...cableDraft,
              fromIfaceId: ifaceId,
            });
            showToast("Ora clicca il secondo dispositivo");
          }}
        />
      )}
      {cableDraft?.fromIfaceId && cableDraft.toDeviceId && (
        <PortPicker
          device={state.devices.find((d) => d.id === cableDraft.toDeviceId)!}
          title="Collega cavo — porta di arrivo"
          peerMedia={
            state.devices
              .find((d) => d.id === cableDraft.fromDeviceId)
              ?.interfaces.find((i) => i.id === cableDraft.fromIfaceId)?.media
          }
          cableHint="La porta deve essere compatibile con quella di partenza (Ethernet↔Ethernet, Wi‑Fi↔Wi‑Fi)."
          onCancel={cancelCable}
          onPick={(ifaceId) => {
            const result = connectDevices(
              state,
              cableDraft.fromDeviceId,
              cableDraft.toDeviceId!,
              cableKind,
              {
                aIfaceId: cableDraft.fromIfaceId!,
                bIfaceId: ifaceId,
              },
            );
            if (result.error) {
              showToast(result.error);
              return;
            }
            const a = state.devices.find((d) => d.id === cableDraft.fromDeviceId);
            const b = state.devices.find((d) => d.id === cableDraft.toDeviceId);
            const aName =
              a?.interfaces.find((i) => i.id === cableDraft.fromIfaceId)?.name ??
              "?";
            const bName =
              b?.interfaces.find((i) => i.id === ifaceId)?.name ?? "?";
            const newLink = result.state.links.find(
              (l) =>
                !state.links.some((old) => old.id === l.id),
            );
            applyState(result.state);
            if (newLink) markConnecting(newLink.id);
            setCableDraft(null);
            setCableCursor(null);
            setTool("select");
            const st = newLink
              ? evaluateLink(result.state, newLink, { connecting: true })
              : null;
            showToast(
              st
                ? `${linkHealthLabel(st.health)}: ${a?.name}:${shortPortName(aName)} ↔ ${b?.name}:${shortPortName(bName)}`
                : `Collegato ${a?.name}:${shortPortName(aName)} ↔ ${b?.name}:${shortPortName(bName)}`,
            );
          }}
        />
      )}
    </div>
  );
}

function ToolButton({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
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
