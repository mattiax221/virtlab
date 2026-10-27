"use client";

import {
  availableModulesFor,
  installModule,
  isModuleRemovable,
  MODULE_CATALOG,
  removeModule,
  setDevicePower,
} from "@/lib/network/engine";
import type { ModuleKind } from "@/lib/network/modules";
import type { Device, LabState } from "@/lib/network/types";

export function PhysicalPanel({
  device,
  stateRef,
  setState,
}: {
  device: Device;
  stateRef: React.MutableRefObject<LabState>;
  setState: (next: LabState) => void;
}) {
  const live =
    stateRef.current.devices.find((d) => d.id === device.id) ?? device;
  const catalog = availableModulesFor(live.type);

  function apply(next: LabState) {
    stateRef.current = next;
    setState(next);
  }

  function togglePower() {
    apply(setDevicePower(stateRef.current, live.id, !live.powered));
  }

  function onRemove(moduleId: string) {
    const res = removeModule(stateRef.current, live.id, moduleId);
    if (res.error) {
      window.alert(res.error);
      return;
    }
    apply(res.state);
  }

  function onInstall(kind: ModuleKind) {
    const res = installModule(stateRef.current, live.id, kind);
    if (res.error) {
      window.alert(res.error);
      return;
    }
    apply(res.state);
  }

  const usedSlots = new Set(live.modules.map((m) => m.slot));
  const freeSlots = live.slots - usedSlots.size;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 text-sm text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2">
        <div>
          <div className="font-medium text-slate-100">Physical</div>
          <p className="text-[11px] text-slate-500">
            Come in Packet Tracer: spegni il device, poi aggiungi/rimuovi moduli
            (NIC Ethernet, Wi‑Fi, WIC…).
          </p>
        </div>
        <button
          type="button"
          onClick={togglePower}
          className={`rounded px-3 py-1.5 text-xs font-semibold ${
            live.powered
              ? "bg-emerald-600 text-white hover:bg-emerald-500"
              : "bg-slate-700 text-slate-200 hover:bg-slate-600"
          }`}
        >
          {live.powered ? "Acceso — clicca per spegnere" : "Spento — clicca per accendere"}
        </button>
      </div>

      {!live.powered && (
        <div className="mt-2 rounded border border-amber-500/40 bg-amber-950/30 px-3 py-1.5 text-[11px] text-amber-200/90">
          Device spento: puoi rimuovere la scheda Ethernet e installare la Wi‑Fi
          (o altri moduli compatibili).
        </div>
      )}

      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Slot ({live.modules.length}/{live.slots})
      </h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {Array.from({ length: live.slots }, (_, slot) => {
          const mod = live.modules.find((m) => m.slot === slot);
          const def = mod
            ? MODULE_CATALOG[mod.kind as ModuleKind]
            : null;
          const ifaces = live.interfaces.filter(
            (i) => i.moduleId === mod?.id && !i.parentIfaceId,
          );
          return (
            <div
              key={slot}
              className="rounded-md border border-slate-700 bg-slate-900/80 p-3"
            >
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Slot {slot}</span>
                {mod && def && (
                  <span className="font-mono text-slate-400">{def.ptModel}</span>
                )}
              </div>
              {mod && def ? (
                <>
                  <div className="mt-1 font-medium text-slate-100">
                    {def.label}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                    {def.description}
                  </p>
                  <div className="mt-2 space-y-0.5 text-[10px] font-mono text-sky-300/90">
                    {ifaces.map((i) => (
                      <div key={i.id}>
                        {i.name} · {i.media}
                        {i.connectedLinkId ? " · cablata" : ""}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={
                      live.powered ||
                      !isModuleRemovable(
                        { id: mod.id, kind: mod.kind as ModuleKind, slot: mod.slot },
                        live.type,
                      )
                    }
                    onClick={() => onRemove(mod.id)}
                    className="mt-2 rounded border border-rose-500/40 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-950/50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Rimuovi
                  </button>
                </>
              ) : (
                <div className="mt-2 text-[11px] text-slate-600">Vuoto</div>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Moduli disponibili {freeSlots === 0 ? "(nessuno slot libero)" : ""}
      </h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {catalog.map((kind) => {
          const def = MODULE_CATALOG[kind];
          return (
            <button
              key={kind}
              type="button"
              disabled={live.powered || freeSlots === 0}
              onClick={() => onInstall(kind)}
              className="rounded-md border border-slate-700 bg-slate-950/40 p-3 text-left hover:border-sky-500/50 hover:bg-slate-800/50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="font-medium text-slate-200">{def.label}</div>
              <div className="font-mono text-[10px] text-slate-500">
                {def.ptModel}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{def.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
