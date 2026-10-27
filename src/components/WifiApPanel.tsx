"use client";

import { useState } from "react";
import type { Device, LabState, WifiSecurity } from "@/lib/network/types";
import { updateWifiRadio } from "@/lib/network/wifi";
import { PhysicalPanel } from "./PhysicalPanel";

export function WifiApPanel({
  device,
  stateRef,
  setState,
  onClose,
}: {
  device: Device;
  stateRef: React.MutableRefObject<LabState>;
  setState: (next: LabState) => void;
  onClose: () => void;
}) {
  const live =
    stateRef.current.devices.find((d) => d.id === device.id) ?? device;
  const wifi = live.wifi;
  const [tab, setTab] = useState<"wifi" | "physical">("wifi");

  function applyWifi(patch: Partial<NonNullable<typeof wifi>>) {
    const next = updateWifiRadio(stateRef.current, live.id, patch);
    stateRef.current = next;
    setState(next);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex h-[min(640px,92vh)] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-cyan-500/30 bg-[#0b1220] shadow-2xl">
        <div className="flex items-center justify-between border-b border-cyan-500/20 bg-slate-900 px-3 py-2 text-sm text-slate-200">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-400" />
            <span className="font-medium">{live.name}</span>
            <span className="hidden text-slate-500 sm:inline">· Wi‑Fi AP</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-slate-300 hover:bg-rose-600 hover:text-white"
          >
            Chiudi
          </button>
        </div>

        <div className="flex gap-1 border-b border-slate-800 px-3 pt-2">
          <TabBtn active={tab === "wifi"} onClick={() => setTab("wifi")}>
            Wireless
          </TabBtn>
          <TabBtn active={tab === "physical"} onClick={() => setTab("physical")}>
            Physical
          </TabBtn>
        </div>

        {tab === "physical" ? (
          <PhysicalPanel
            device={device}
            stateRef={stateRef}
            setState={setState}
          />
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
            {!wifi ? (
              <p className="text-slate-500">
                Nessuna radio Wi‑Fi su questo device.
              </p>
            ) : (
              <>
                <label className="flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={wifi.enabled}
                    onChange={(e) => applyWifi({ enabled: e.target.checked })}
                  />
                  Radio attiva (visibile agli host)
                </label>

                <Field label="SSID (nome rete)">
                  <input
                    value={wifi.ssid}
                    onChange={(e) => applyWifi({ ssid: e.target.value })}
                    className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-slate-100 outline-none focus:border-cyan-500"
                  />
                </Field>

                <Field label="Sicurezza">
                  <select
                    value={wifi.security}
                    onChange={(e) =>
                      applyWifi({ security: e.target.value as WifiSecurity })
                    }
                    className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-slate-100"
                  >
                    <option value="open">Aperta</option>
                    <option value="wpa2">WPA2-Personal</option>
                  </select>
                </Field>

                {wifi.security === "wpa2" && (
                  <Field label="Password">
                    <input
                      type="text"
                      value={wifi.password}
                      onChange={(e) => applyWifi({ password: e.target.value })}
                      className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 font-mono text-slate-100 outline-none focus:border-cyan-500"
                    />
                  </Field>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Canale">
                    <input
                      type="number"
                      min={1}
                      max={13}
                      value={wifi.channel}
                      onChange={(e) =>
                        applyWifi({ channel: Number(e.target.value) || 1 })
                      }
                      className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-slate-100"
                    />
                  </Field>
                  <Field label="Banda">
                    <select
                      value={wifi.band}
                      onChange={(e) =>
                        applyWifi({ band: e.target.value as "2.4" | "5" })
                      }
                      className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-slate-100"
                    >
                      <option value="2.4">2.4 GHz</option>
                      <option value="5">5 GHz</option>
                    </select>
                  </Field>
                </div>

                <p className="text-[11px] leading-relaxed text-slate-500">
                  Dai PC con Wireless NIC: icona Wi‑Fi in basso a destra → elenco
                  reti → Connetti (password predefinita:{" "}
                  <span className="font-mono text-slate-400">cisco123</span>).
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-t px-3 py-1.5 text-xs font-medium ${
        active
          ? "bg-slate-800 text-cyan-200"
          : "text-slate-500 hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] text-slate-400">{label}</span>
      {children}
    </label>
  );
}
