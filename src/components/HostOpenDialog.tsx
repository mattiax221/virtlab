"use client";

import type { Device } from "@/lib/network/types";

export function HostOpenDialog({
  device,
  onSimulated,
  onClose,
}: {
  device: Device;
  onSimulated: () => void;
  onReactOs?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-slate-600 bg-slate-900 p-5 shadow-2xl">
        <h2 className="font-display text-lg font-semibold text-white">
          Apri {device.name}
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Per il lab stile Packet Tracer usa il{" "}
          <strong className="text-slate-200">desktop simulato</strong>: IP
          statico, ping, cavi. È fluido (non 2 FPS).
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onSimulated}
            className="rounded-md bg-sky-600 px-4 py-3 text-left text-sm font-medium text-slate-950 hover:bg-sky-500"
          >
            Desktop simulato (rete lab / IP statico)
            <div className="text-xs font-normal opacity-80">
              Consigliato — come Packet Tracer, comandi reali
            </div>
          </button>
          <div className="rounded-md border border-slate-700 bg-slate-950/50 px-4 py-3 text-left text-sm text-slate-400">
            ReactOS via VNC
            <div className="mt-1 text-xs leading-relaxed">
              Su questa Cloud VM <strong className="text-rose-300">non
              c’è KVM utilizzabile</strong>: ReactOS resta a ~1–2 FPS e non
              può arrivare a 20–30. Per OS reale avvia ReactOS/VirtualBox{" "}
              <strong className="text-slate-200">sul tuo PC</strong> (con
              virtualizzazione attiva).
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded border border-slate-700 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}
