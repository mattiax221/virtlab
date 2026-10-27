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
  const [host, setHost] = useState("127.0.0.1");

  useEffect(() => {
    setHost(window.location.hostname);
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

  const src = `http://${host}:6080/vnc_lite.html?autoconnect=1&resize=scale`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200">
        <div>
          <span className="font-medium">ReactOS — {device.name}</span>
          <span className="ml-2 hidden text-slate-500 sm:inline">
            disco dedicato · IP statico da impostare dentro ReactOS (rete guest
            NAT)
          </span>
        </div>
        <div className="flex gap-2">
          <a
            href={`http://${host}:6080/vnc.html?autoconnect=1`}
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
      <iframe title={`ReactOS ${device.name}`} src={src} className="flex-1 border-0 bg-black" />
    </div>
  );
}
