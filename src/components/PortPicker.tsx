"use client";

import type { Device, InterfaceConfig } from "@/lib/network/types";
import { DeviceIcon } from "./DeviceIcon";

function portStatus(iface: InterfaceConfig): string {
  if (iface.parentIfaceId) return "subinterface";
  if (!iface.enabled) return "shutdown";
  if (iface.connectedLinkId) return "occupata";
  return "libera";
}

function mediaLabel(media: InterfaceConfig["media"]): string {
  switch (media) {
    case "wireless":
      return "Wi‑Fi";
    case "serial":
      return "Serial";
    case "fiber":
      return "Fiber";
    case "coaxial":
      return "Coax";
    case "phone":
      return "Phone";
    default:
      return "Eth";
  }
}

export function PortPicker({
  device,
  title,
  onPick,
  onCancel,
  /** When connecting the second end, only allow matching media */
  peerMedia,
  cableHint,
}: {
  device: Device;
  title: string;
  onPick: (ifaceId: string) => void;
  onCancel: () => void;
  peerMedia?: InterfaceConfig["media"] | null;
  cableHint?: string;
}) {
  const ports = [...device.interfaces.filter((i) => !i.parentIfaceId)].sort(
    (a, b) => {
      const rank = (m: InterfaceConfig["media"]) =>
        m === "ethernet" || m === "fiber" ? 0 : m === "serial" ? 1 : 2;
      return rank(a.media) - rank(b.media) || a.name.localeCompare(b.name);
    },
  );
  const free = ports.filter((i) => !i.connectedLinkId && i.enabled);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md overflow-hidden rounded-lg border border-slate-600 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-700 bg-slate-950 px-4 py-3">
          <DeviceIcon type={device.type} className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-100">
              {title}
            </div>
            <div className="truncate text-xs text-slate-400">
              {device.name} — scegli la porta
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        {cableHint && (
          <div className="border-b border-amber-500/30 bg-amber-950/40 px-4 py-2 text-[11px] text-amber-100">
            {cableHint}
          </div>
        )}

        <div className="max-h-[min(360px,50vh)] overflow-y-auto p-2">
          {ports.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-slate-500">
              Nessuna porta fisica. Apri Physical e installa un modulo.
            </p>
          )}
          {ports.map((iface) => {
            const status = portStatus(iface);
            const mediaMismatch =
              peerMedia != null &&
              ((peerMedia === "wireless" && iface.media !== "wireless") ||
                (peerMedia !== "wireless" && iface.media === "wireless") ||
                (peerMedia === "serial" && iface.media !== "serial") ||
                (iface.media === "serial" && peerMedia !== "serial"));
            const available = status === "libera" && !mediaMismatch;
            const note = mediaMismatch
              ? peerMedia === "wireless"
                ? "serve Wi‑Fi"
                : "usa Ethernet (non Wi‑Fi)"
              : status;
            return (
              <button
                key={iface.id}
                type="button"
                disabled={!available}
                onClick={() => available && onPick(iface.id)}
                className={`mb-1 flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition ${
                  available
                    ? "border-slate-700 bg-slate-950/80 text-slate-100 hover:border-sky-500 hover:bg-sky-950/40"
                    : "cursor-not-allowed border-transparent bg-slate-950/40 text-slate-600"
                }`}
              >
                <span
                  className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                    available
                      ? "bg-emerald-400"
                      : status === "occupata"
                        ? "bg-amber-500"
                        : "bg-slate-600"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[13px] font-medium">
                    {iface.name}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {mediaLabel(iface.media)}
                    {iface.ip ? ` · ${iface.ip}` : ""}
                    {iface.mac ? ` · ${iface.mac}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] uppercase tracking-wide text-slate-500">
                  {note}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2 text-[11px] text-slate-500">
          <span>
            {free.length} porta{free.length === 1 ? "" : "e"} libera
            {free.length === 1 ? "" : "e"} · per PC↔Switch scegli Ethernet
          </span>
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}
