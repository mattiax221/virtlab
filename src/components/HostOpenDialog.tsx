"use client";

import { useState } from "react";
import type { Device } from "@/lib/network/types";

export function HostOpenDialog({
  device,
  onSimulated,
  onReactOs,
  onClose,
}: {
  device: Device;
  onSimulated: () => void;
  onReactOs: () => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function startReactOs() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/reactos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", deviceId: device.id }),
      });
      const data = await res.json();
      if (!data.ok) {
        setErr(String(data.error || "Avvio fallito"));
        setBusy(false);
        return;
      }
      onReactOs();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Errore rete");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-slate-600 bg-slate-900 p-5 shadow-2xl">
        <h2 className="font-display text-lg font-semibold text-white">
          Apri {device.name}
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Ogni host ha il proprio disco ReactOS. Per la rete del lab (ping tra
          PC) usa il desktop simulato: lì imposti IP statico con{" "}
          <code className="text-sky-300">ipconfig /ip …</code>
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onSimulated}
            className="rounded-md bg-sky-600 px-4 py-3 text-left text-sm font-medium text-slate-950 hover:bg-sky-500"
          >
            Desktop simulato (rete lab / IP statico)
            <div className="text-xs font-normal opacity-80">
              Come Packet Tracer: ping, cavi, gateway
            </div>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void startReactOs()}
            className="rounded-md bg-orange-700 px-4 py-3 text-left text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {busy ? "Avvio ReactOS…" : "ReactOS reale (VNC)"}
            <div className="text-xs font-normal opacity-80">
              OS gratis open-source · 1 VM attiva alla volta · disco dedicato a
              questo PC
            </div>
          </button>
        </div>
        {err && <p className="mt-3 text-sm text-rose-300">{err}</p>}
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
