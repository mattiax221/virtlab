"use client";

import { useMemo, useState } from "react";
import {
  clientWifiIface,
  connectWifi,
  disconnectWifi,
  scanWifiNetworks,
  wifiStatusLabel,
} from "@/lib/network/wifi";
import type { Device, LabState } from "@/lib/network/types";

export function WifiTray({
  device,
  stateRef,
  setState,
}: {
  device: Device;
  stateRef: React.MutableRefObject<LabState>;
  setState: (next: LabState) => void;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [pendingAp, setPendingAp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, bump] = useState(0);

  const live =
    stateRef.current.devices.find((d) => d.id === device.id) ?? device;
  const status = wifiStatusLabel(stateRef.current, live.id);
  const networks = useMemo(
    () => scanWifiNetworks(stateRef.current, live.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [live.id, open, stateRef.current.links.length, stateRef.current.devices],
  );

  function refresh() {
    bump((n) => n + 1);
  }

  function apply(next: LabState) {
    stateRef.current = next;
    setState(next);
    refresh();
  }

  const bars = status.connectedSsid
    ? status.signal >= 70
      ? 3
      : status.signal >= 40
        ? 2
        : 1
    : 0;

  return (
    <div className="relative">
      <button
        type="button"
        title={
          !status.hasNic
            ? "Nessuna scheda Wi‑Fi"
            : status.connectedSsid
              ? `Connesso a ${status.connectedSsid}`
              : "Reti Wi‑Fi disponibili"
        }
        onClick={() => {
          setOpen((v) => !v);
          setError(null);
          setPendingAp(null);
          setPassword("");
        }}
        className={`flex h-8 items-center gap-1 rounded px-1.5 ${
          open ? "bg-white/20" : "hover:bg-white/10"
        } ${!status.hasNic ? "opacity-40" : ""}`}
      >
        <WifiIcon bars={status.hasNic ? (status.connectedSsid ? bars : 0) : -1} />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] cursor-default"
            aria-label="Chiudi Wi‑Fi"
            onClick={() => setOpen(false)}
          />
          <div className="absolute bottom-10 right-0 z-[70] w-72 overflow-hidden rounded-lg border border-slate-600/80 bg-slate-900/98 text-slate-100 shadow-2xl backdrop-blur">
            <div className="border-b border-slate-700 px-3 py-2">
              <div className="text-sm font-medium">Rete</div>
              <div className="text-[11px] text-slate-400">
                {status.hasNic
                  ? status.connectedSsid
                    ? `Connesso a ${status.connectedSsid}`
                    : "Wi‑Fi attivo — seleziona una rete"
                  : "Installa una Wireless NIC da Physical"}
              </div>
            </div>

            {!status.hasNic ? (
              <div className="px-3 py-4 text-[12px] leading-relaxed text-slate-400">
                Nessuna scheda Wi‑Fi. Spegni il PC in <strong>Physical</strong>,
                rimuovi Ethernet se serve, installa <strong>Wireless NIC</strong>,
                riaccendi.
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto py-1">
                {networks.length === 0 && (
                  <div className="px-3 py-4 text-[12px] text-slate-500">
                    Nessuna rete in vista. Aggiungi un Access Point o WRT300N sul
                    canvas e configura l’SSID.
                  </div>
                )}
                {networks.map((n) => (
                  <div
                    key={n.deviceId}
                    className={`border-b border-slate-800/80 px-3 py-2 ${
                      n.connected ? "bg-sky-950/40" : "hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <WifiIcon
                        bars={n.signal >= 70 ? 3 : n.signal >= 40 ? 2 : 1}
                        small
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium">
                          {n.ssid}
                          {n.connected && (
                            <span className="ml-1 text-[10px] font-normal text-sky-300">
                              · connesso
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {n.security === "wpa2" ? "WPA2-Personal" : "Aperta"} ·
                          ch {n.channel} · {n.band} GHz · segnale {n.signal}%
                        </div>
                      </div>
                    </div>

                    {pendingAp === n.deviceId && !n.connected && (
                      <div className="mt-2 space-y-1.5">
                        {n.security === "wpa2" && (
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password di rete"
                            className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-[12px] outline-none focus:border-sky-500"
                            autoFocus
                          />
                        )}
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="flex-1 rounded bg-sky-600 py-1 text-[11px] font-medium hover:bg-sky-500"
                            onClick={() => {
                              const res = connectWifi(
                                stateRef.current,
                                live.id,
                                n.deviceId,
                                password,
                              );
                              if (res.error) {
                                setError(res.error);
                                return;
                              }
                              apply(res.state);
                              setPendingAp(null);
                              setPassword("");
                              setError(null);
                            }}
                          >
                            Connetti
                          </button>
                          <button
                            type="button"
                            className="rounded px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-800"
                            onClick={() => {
                              setPendingAp(null);
                              setPassword("");
                              setError(null);
                            }}
                          >
                            Annulla
                          </button>
                        </div>
                      </div>
                    )}

                    {pendingAp !== n.deviceId && (
                      <div className="mt-1.5">
                        {n.connected ? (
                          <button
                            type="button"
                            className="text-[11px] text-rose-300 hover:underline"
                            onClick={() => {
                              const res = disconnectWifi(
                                stateRef.current,
                                live.id,
                              );
                              apply(res.state);
                            }}
                          >
                            Disconnetti
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="text-[11px] text-sky-300 hover:underline"
                            onClick={() => {
                              setPendingAp(n.deviceId);
                              setPassword("");
                              setError(null);
                              if (n.security === "open") {
                                const res = connectWifi(
                                  stateRef.current,
                                  live.id,
                                  n.deviceId,
                                );
                                if (res.error) {
                                  setError(res.error);
                                  setPendingAp(n.deviceId);
                                  return;
                                }
                                apply(res.state);
                                setPendingAp(null);
                              }
                            }}
                          >
                            Connetti
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="border-t border-rose-500/30 bg-rose-950/40 px-3 py-1.5 text-[11px] text-rose-200">
                {error}
              </div>
            )}

            <div className="border-t border-slate-700 px-3 py-1.5 text-[10px] text-slate-500">
              NIC: {clientWifiIface(live)?.name ?? "—"} · default password lab:{" "}
              <span className="font-mono text-slate-400">cisco123</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function WifiIcon({ bars, small }: { bars: number; small?: boolean }) {
  const h = small ? 14 : 16;
  const w = small ? 16 : 18;
  if (bars < 0) {
    return (
      <svg width={w} height={h} viewBox="0 0 24 24" className="text-slate-500">
        <path
          fill="currentColor"
          d="M12 18a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm-7.07-2.93l1.41 1.41A7 7 0 0112 14c1.8 0 3.45.68 4.66 1.8l1.41-1.41A9 9 0 0012 12a9 9 0 00-7.07 3.07zM3.51 9.51l1.42 1.42A11 11 0 0112 8c2.9 0 5.54 1.12 7.07 2.93l1.42-1.42A13 13 0 0012 6a13 13 0 00-8.49 3.51z"
          opacity="0.35"
        />
        <path stroke="currentColor" strokeWidth="2" d="M4 4l16 16" />
      </svg>
    );
  }
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" className="text-slate-100">
      <circle cx="12" cy="19" r="1.6" fill="currentColor" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity={bars >= 1 ? 1 : 0.25}
        d="M8.5 15.5a5 5 0 017 0"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity={bars >= 2 ? 1 : 0.25}
        d="M5.5 12.5a9 9 0 0113 0"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity={bars >= 3 ? 1 : 0.25}
        d="M2.5 9.5a13 13 0 0119 0"
      />
    </svg>
  );
}
