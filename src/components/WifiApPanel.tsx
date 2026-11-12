"use client";

import { useState } from "react";
import { updateDevice } from "@/lib/network/engine";
import {
  DEVICE_META,
  isWifiCapable,
  isWlc,
  type Device,
  type LabState,
  type WifiSecurity,
} from "@/lib/network/types";
import {
  defaultWifiRadio,
  WIFI_CHANNELS,
  updateWifiRadio,
  wifiSecurityNeedsKey,
} from "@/lib/network/wifi";
import { IfaceIpEditor } from "./IfaceIpEditor";
import { PhysicalPanel } from "./PhysicalPanel";

const inputCls =
  "w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-slate-100 outline-none focus:border-cyan-500";

function roleLabel(device: Device): string {
  if (
    device.type === "wireless_router" ||
    device.type === "home_router" ||
    device.type === "home_gateway"
  ) {
    return "Router wireless";
  }
  if (isWlc(device.type)) return "Wireless LAN Controller";
  return "Access Point";
}

export function WifiApPanel({
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
  const capable = isWifiCapable(live.type);
  const wifi = live.wifi ?? (capable ? defaultWifiRadio(live.name) : undefined);
  const [tab, setTab] = useState<"wifi" | "ip" | "physical">("wifi");
  const [name, setName] = useState(live.name);

  function apply(next: LabState) {
    stateRef.current = next;
    setState(next);
  }

  function applyWifi(patch: Partial<NonNullable<typeof wifi>>) {
    apply(updateWifiRadio(stateRef.current, live.id, patch));
  }

  function commitName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === live.name) {
      setName(live.name);
      return;
    }
    apply(updateDevice(stateRef.current, live.id, { name: trimmed }));
  }

  const channels = wifi ? WIFI_CHANNELS[wifi.band] : WIFI_CHANNELS["2.4"];
  const channel =
    wifi && channels.includes(wifi.channel) ? wifi.channel : channels[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex h-[min(680px,92vh)] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-cyan-500/30 bg-[#0b1220] shadow-2xl">
        <div className="flex items-center justify-between border-b border-cyan-500/20 bg-slate-900 px-3 py-2 text-sm text-slate-200">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                wifi?.enabled && live.powered ? "bg-cyan-400" : "bg-slate-600"
              }`}
            />
            <span className="font-medium">{live.name}</span>
            <span className="hidden text-slate-500 sm:inline">
              · {roleLabel(live)}
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
              {capable
                ? "Indirizzo di gestione o LAN. Sul router wireless l’IP si imposta sulla porta Ethernet (o Wireless) che deve rispondere in rete."
                : "Indirizzo di gestione del controller. Gli SSID dei client si configurano sugli Access Point."}
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

            {!wifi ? (
              <p className="text-[12px] leading-relaxed text-slate-400">
                {DEVICE_META[live.type].label} non ha una radio 802.11 in questo
                lab. Configura gli SSID sugli Access Point associati e l’IP di
                gestione nel tab IP.
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
                    className={inputCls}
                  />
                </Field>

                <Field label="Sicurezza">
                  <select
                    value={wifi.security}
                    onChange={(e) =>
                      applyWifi({ security: e.target.value as WifiSecurity })
                    }
                    className={inputCls}
                  >
                    <option value="open">Aperta</option>
                    <option value="wep">WEP</option>
                    <option value="wpa2">WPA2-Personal</option>
                    <option value="wpa3">WPA3-Personal</option>
                  </select>
                </Field>

                {wifiSecurityNeedsKey(wifi.security) && (
                  <Field
                    label={
                      wifi.security === "wep" ? "Chiave WEP" : "Passphrase"
                    }
                  >
                    <input
                      type="text"
                      value={wifi.password}
                      onChange={(e) => applyWifi({ password: e.target.value })}
                      className={`${inputCls} font-mono`}
                    />
                  </Field>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Canale">
                    <select
                      value={channel}
                      onChange={(e) =>
                        applyWifi({ channel: Number(e.target.value) })
                      }
                      className={inputCls}
                    >
                      {channels.map((ch) => (
                        <option key={ch} value={ch}>
                          {ch}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Banda">
                    <select
                      value={wifi.band}
                      onChange={(e) => {
                        const band = e.target.value as "2.4" | "5";
                        const nextChannels = WIFI_CHANNELS[band];
                        const channel = nextChannels.includes(wifi.channel)
                          ? wifi.channel
                          : nextChannels[0];
                        applyWifi({ band, channel });
                      }}
                      className={inputCls}
                    >
                      <option value="2.4">2.4 GHz</option>
                      <option value="5">5 GHz</option>
                    </select>
                  </Field>
                </div>

                <p className="text-[11px] leading-relaxed text-slate-500">
                  I client si associano solo se radio, SSID e chiave coincidono.
                  Cambiare SSID, sicurezza o passphrase li disconnette. Password
                  predefinita del lab:{" "}
                  <span className="font-mono text-slate-400">cisco123</span>.
                  PC e laptop usano l’icona Wi‑Fi del desktop; tablet, smartphone
                  e generic wireless hanno il pannello Client.
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
