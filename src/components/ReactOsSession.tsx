"use client";

import { useEffect, useState } from "react";
import type { Device } from "@/lib/network/types";

export function ReactOsSession({
  device,
  onClose,
}: {
  device: Device;
  onClose: () => void;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Give QEMU a moment; ReactOS Live is slow without KVM.
    const t = window.setTimeout(() => setReady(true), 1500);
    return () => window.clearTimeout(t);
  }, []);

  async function stopAndClose() {
    try {
      await fetch("/api/reactos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
    } catch {
      /* ignore */
    }
    onClose();
  }

  // Same-origin via lab-gateway (/novnc → websockify). Works through Cloudflare.
  const src =
    "/novnc/vnc_lite.html?autoconnect=1&resize=scale&path=websockify&reconnect=1";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200">
        <div>
          <span className="font-medium">ReactOS — {device.name}</span>
          <span className="ml-2 hidden text-slate-500 sm:inline">
            boot lento senza KVM · se vedi blu “Installing devices…” aspetta
          </span>
        </div>
        <div className="flex gap-2">
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
          >
            Schermo intero
          </a>
          <button
            type="button"
            onClick={() => void stopAndClose()}
            className="rounded bg-rose-700 px-2 py-1 text-xs hover:bg-rose-600"
          >
            Chiudi VM
          </button>
        </div>
      </div>
      {ready ? (
        <iframe
          title={`ReactOS ${device.name}`}
          src={src}
          className="flex-1 border-0 bg-black"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
          Avvio ReactOS (emulazione software, può richiedere 1–2 minuti)…
        </div>
      )}
    </div>
  );
}
