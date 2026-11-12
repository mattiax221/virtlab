"use client";

import { useState } from "react";
import { updateDevice, updateIface } from "@/lib/network/engine";
import { DEVICE_META, type Device, type LabState } from "@/lib/network/types";
import {
  clientWifiIfaceAny,
  connectWifi,
  disconnectWifi,
  scanWifiNetworks,
  wifiSecurityLabel,
  wifiSecurityNeedsKey,
  wifiStatusLabel,
} from "@/lib/network/wifi";
import { IfaceIpEditor } from "./IfaceIpEditor";
import { PhysicalPanel } from "./PhysicalPanel";

const inputCls =
  "w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-slate-100 outline-none focus:border-sky-500";

export function WifiClientPanel({
  device,
  state,
  stateRef,
  setState,
  onClose,
}: {
  device: Device;
  state: LabState;
  stateRef: React.MutableRefObject<LabState>;
  setState: (next: LabState) => void;
  onClose: () => void;
}) {
  const live = state.devices.find((d) => d.id === device.id) ?? device;
  const nic = clientWifiIfaceAny(live);
  const status = wifiStatusLabel(state, live.id);
  const networks = scanWifiNetworks(state, live.id);
  const [tab, setTab] = useState<"wifi" | "ip" | "physical">("wifi");
  const [name, setName] = useState(live.name);
  const [password, setPassword] = useState("");
  const [pendingAp, setPendingAp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function apply(next: LabState) {
    stateRef.current = next;
    setState(next);
  }

  function commitName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === live.name) {
      setName(live.name);
      return;
    }
    apply(updateDevice(stateRef.current, live.id, { name: trimmed }));
  }

  function toggleRadio(on: boolean) {
    if (!nic) return;
    let next = stateRef.current;
    if (!on) next = disconnectWifi(next, live.id).state;
    next = updateIface(next, live.id, nic.id, { enabled: on });
    apply(next);
    setError(null);
  }

  function join(apId: string, key: string) {
    const res = connectWifi(stateRef.current, live.id, apId, key);
    if (res.error) {
      setError(res.error);
      return;
    }
    apply(res.state);
    setPendingAp(null);
    setPassword("");
    setError(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex h-[min(680px,92vh)] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-sky-500/30 bg-[#0b1220] shadow-2xl">
        <div className="flex items-center justify-between border-b border-sky-500/20 bg-slate-900 px-3 py-2 text-sm text-slate-200">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                status.connectedSsid ? "bg-sky-400" : "bg-slate-600"
              }`}
            />
            <span className="font-medium">{live.name}</span>
            <span className="hidden text-slate-500 sm:inline">
              · {DEVICE_META[live.type].label} · Wi‑Fi
            </span>
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
          <TabBtn active={tab === "ip"} onClick={() => setTab("ip")}>
            IP
          </TabBtn>
          <TabBtn active={tab === "physical"} onClick={() => setTab("physical")}>
            Physical
          </TabBtn>
        </div>

        {tab === "physical" ? (
          <PhysicalPanel device={device} stateRef={stateRef} setState={setState} />
        ) : tab === "ip" ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
              Indirizzo della scheda wireless (e delle altre interfacce, se
              presenti). Il DHCP funziona solo dopo l’associazione a una rete.
            </p>
            <IfaceIpEditor
              device={live}
              stateRef={stateRef}
              setState={setState}
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
            <Field label="Nome">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                className={inputCls}
              />
            </Field>

            {!nic ? (
              <p className="text-[12px] leading-relaxed text-slate-400">
                Nessuna scheda Wi‑Fi. Nel tab Physical spegni il dispositivo,
                installa una Wireless NIC e riaccendilo.
              </p>
            ) : (
              <>
                <label className="flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={nic.enabled}
                    onChange={(e) => toggleRadio(e.target.checked)}
                  />
                  Radio attiva ({nic.name})
                </label>

                <p className="text-[12px] text-slate-400">
                  {status.connectedSsid
                    ? `Associato a «${status.connectedSsid}» · segnale ${status.signal}%`
                    : nic.enabled
                      ? "Non associato. Scegli un SSID in vista."
                      : "Radio spenta: il client non vede le reti e non trasmette."}
                </p>

                {status.connectedSsid && (
                  <button
                    type="button"
                    className="rounded border border-rose-500/40 px-3 py-1 text-xs text-rose-200 hover:bg-rose-950/50"
                    onClick={() => {
                      const res = disconnectWifi(stateRef.current, live.id);
                      apply(res.state);
                      setError(res.error ?? null);
                    }}
                  >
                    Disconnetti
                  </button>
                )}

                <div className="overflow-hidden rounded-md border border-slate-700">
                  {networks.length === 0 ? (
                    <p className="px-3 py-4 text-[12px] text-slate-500">
                      {nic.enabled
                        ? "Nessuna rete in vista. Aggiungi un Access Point o un router wireless e accendi la radio."
                        : "Accendi la radio per eseguire la scansione."}
                    </p>
                  ) : (
                    networks.map((n) => (
                      <div
                        key={n.deviceId}
                        className={`border-b border-slate-800 px-3 py-2 last:border-b-0 ${
                          n.connected ? "bg-sky-950/40" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-medium text-slate-100">
                              {n.ssid}
                              {n.connected && (
                                <span className="ml-1 text-[10px] font-normal text-sky-300">
                                  · connesso
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {wifiSecurityLabel(n.security)} · ch {n.channel} ·{" "}
                              {n.band} GHz · {n.deviceName} · segnale {n.signal}%
                            </div>
                          </div>
                          {!n.connected && pendingAp !== n.deviceId && (
                            <button
                              type="button"
                              className="shrink-0 rounded bg-sky-700 px-2 py-1 text-[11px] text-white hover:bg-sky-600"
                              onClick={() => {
                                setError(null);
                                if (!wifiSecurityNeedsKey(n.security)) {
                                  join(n.deviceId, "");
                                  return;
                                }
                                setPendingAp(n.deviceId);
                                setPassword("");
                              }}
                            >
                              Connetti
                            </button>
                          )}
                        </div>

                        {pendingAp === n.deviceId && !n.connected && (
                          <div className="mt-2 space-y-1.5">
                            <input
                              type="password"
                              value={password}
                              autoFocus
                              placeholder={
                                n.security === "wep"
                                  ? "Chiave WEP"
                                  : "Passphrase"
                              }
                              onChange={(e) => setPassword(e.target.value)}
                              className={`${inputCls} font-mono text-[12px]`}
                            />
                            <div className="flex gap-1">
                              <button
                                type="button"
                                className="rounded bg-sky-700 px-2 py-1 text-[11px] text-white hover:bg-sky-600"
                                onClick={() => join(n.deviceId, password)}
                              >
                                Associa
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
                      </div>
                    ))
                  )}
                </div>

                <p className="text-[11px] leading-relaxed text-slate-500">
                  L’associazione riesce solo con SSID e chiave dell’access point.
                  Password predefinita del lab:{" "}
                  <span className="font-mono text-slate-400">cisco123</span>.
                </p>
              </>
            )}

            {error && (
              <p className="rounded border border-rose-500/40 bg-rose-950/40 px-2 py-1.5 text-[11px] text-rose-100">
                {error}
              </p>
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
        active ? "bg-slate-800 text-sky-200" : "text-slate-500 hover:text-slate-300"
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
