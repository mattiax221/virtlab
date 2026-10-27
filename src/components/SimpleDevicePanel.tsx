"use client";

import { DEVICE_META, type Device } from "@/lib/network/types";

export function SimpleDevicePanel({
  device,
  onClose,
}: {
  device: Device;
  onClose: () => void;
}) {
  const meta = DEVICE_META[device.type];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6">
      <div className="w-full max-w-lg overflow-hidden rounded-lg border border-slate-600 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <div>
            <h2 className="font-medium text-slate-100">{device.name}</h2>
            <p className="text-sm text-slate-400">{meta.label} · simulato</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-slate-300 hover:bg-rose-600 hover:text-white"
          >
            Chiudi
          </button>
        </div>
        <div className="space-y-2 p-4">
          {device.interfaces.map((iface) => (
            <div
              key={iface.id}
              className="flex items-center justify-between rounded border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm"
            >
              <span className="font-mono text-sky-300">{iface.name}</span>
              <span className="text-slate-400">
                {iface.ip ?? "no ip"} ·{" "}
                {iface.connectedLinkId ? "up" : "down"}
              </span>
            </div>
          ))}
          <p className="pt-2 text-xs leading-relaxed text-slate-500">
            Questo dispositivo è simulato (come in Packet Tracer). La rete L2/L3
            funziona con i cavi e gli IP configurati su PC / Laptop / Server
            (Connessioni di rete Windows).
          </p>
        </div>
      </div>
    </div>
  );
}
