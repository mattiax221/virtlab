"use client";

import type { Device } from "@/lib/network/types";

export function SwitchPanel({
  device,
  onClose,
}: {
  device: Device;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6">
      <div className="w-full max-w-lg overflow-hidden rounded-lg border border-emerald-500/30 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-emerald-500/20 px-4 py-3">
          <div>
            <h2 className="font-medium text-emerald-200">{device.name}</h2>
            <p className="text-sm text-slate-400">
              Switch L2 — inoltra frame tra le porte collegate
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-slate-300 transition hover:bg-rose-600 hover:text-white"
          >
            Chiudi
          </button>
        </div>
        <div className="space-y-2 p-4">
          {device.interfaces.map((iface) => (
            <div
              key={iface.id}
              className="flex items-center justify-between rounded border border-slate-700/80 bg-slate-950/50 px-3 py-2 text-sm"
            >
              <span className="font-mono text-emerald-300">{iface.name}</span>
              <span
                className={
                  iface.connectedLinkId ? "text-emerald-400" : "text-slate-500"
                }
              >
                {iface.connectedLinkId ? "connected" : "notconnect"}
              </span>
            </div>
          ))}
          <p className="pt-2 text-xs leading-relaxed text-slate-500">
            Uno switch non usa IP per inoltrare traffico locale. Collega i PC e
            configura gli indirizzi dal desktop Windows di ogni host.
          </p>
        </div>
      </div>
    </div>
  );
}
