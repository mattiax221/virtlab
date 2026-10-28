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

  const modulesLocked = live.powered || freeSlots === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-md bg-[#0b1220] p-4 text-sm text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2">
        <div>
          <div className="font-medium text-white">Physical</div>
          <p className="text-[11px] text-slate-400">
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
              : "bg-slate-600 text-white hover:bg-slate-500"
          }`}
        >
          {live.powered ? "Acceso — clicca per spegnere" : "Spento — clicca per accendere"}
        </button>
      </div>

      {live.powered ? (
        <div className="mt-2 rounded border border-sky-500/40 bg-sky-950/40 px-3 py-1.5 text-[11px] text-sky-100">
          Device acceso: i moduli sotto sono bloccati. Spegnilo per
          aggiungere/rimuovere schede.
        </div>
      ) : (
        <div className="mt-2 rounded border border-amber-500/40 bg-amber-950/40 px-3 py-1.5 text-[11px] text-amber-100">
          Device spento: puoi rimuovere la scheda Ethernet e installare la Wi‑Fi
          (o altri moduli compatibili).
        </div>
      )}

      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
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
          const canRemove =
            !live.powered &&
            !!mod &&
            isModuleRemovable(
              { id: mod.id, kind: mod.kind as ModuleKind, slot: mod.slot },
              live.type,
            );
          return (
            <div
              key={slot}
              className="rounded-md border border-slate-600 bg-slate-900 p-3"
            >
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Slot {slot}</span>
                {mod && def && (
                  <span className="font-mono text-slate-300">{def.ptModel}</span>
                )}
              </div>
              {mod && def ? (
                <>
                  <div className="mt-1 font-medium text-white">{def.label}</div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                    {def.description}
                  </p>
                  <div className="mt-2 space-y-0.5 text-[10px] font-mono text-sky-300">
                    {ifaces.map((i) => (
                      <div key={i.id}>
                        {i.name} · {i.media}
                        {i.connectedLinkId ? " · cablata" : ""}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={!canRemove}
                    onClick={() => onRemove(mod.id)}
                    className={`mt-2 rounded border px-2 py-1 text-[11px] ${
                      canRemove
                        ? "border-rose-400/60 text-rose-200 hover:bg-rose-950/50"
                        : "cursor-not-allowed border-slate-600 text-slate-500"
                    }`}
                  >
                    {live.powered ? "Rimuovi (spegni prima)" : "Rimuovi"}
                  </button>
                </>
              ) : (
                <div className="mt-2 text-[11px] text-slate-500">Vuoto</div>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Moduli disponibili {freeSlots === 0 ? "(nessuno slot libero)" : ""}
      </h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {catalog.map((kind) => {
          const def = MODULE_CATALOG[kind];
          const locked = modulesLocked;
          return (
            <button
              key={kind}
              type="button"
              disabled={locked}
              onClick={() => onInstall(kind)}
              className={`rounded-md border p-3 text-left transition ${
                locked
                  ? "cursor-not-allowed border-slate-700 bg-slate-900/80"
                  : "border-slate-500 bg-slate-800 hover:border-sky-400 hover:bg-slate-700"
              }`}
            >
              <div
                className={`font-medium ${locked ? "text-slate-300" : "text-white"}`}
              >
                {def.label}
              </div>
              <div
                className={`font-mono text-[10px] ${locked ? "text-slate-500" : "text-slate-400"}`}
              >
                {def.ptModel}
              </div>
              <p
                className={`mt-1 text-[11px] ${locked ? "text-slate-500" : "text-slate-400"}`}
              >
                {def.description}
              </p>
              {locked && (
                <p className="mt-2 text-[10px] font-medium text-amber-300/90">
                  {live.powered
                    ? "Spegni il device per installare"
                    : "Nessuno slot libero"}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
