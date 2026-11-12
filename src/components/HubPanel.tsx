"use client";

import { useMemo, useState } from "react";
import { setDevicePower, updateDevice, updateIface } from "@/lib/network/engine";
import { shortPortName } from "@/lib/network/portSort";
import {
  DEVICE_META,
  type Device,
  type DeviceKind,
  type InterfaceConfig,
  type LabState,
} from "@/lib/network/types";
import { PhysicalPanel } from "./PhysicalPanel";

function hubBlurb(type: DeviceKind): string {
  if (type === "repeater") {
    return "Il repeater rigenera il segnale fra le porte abilitate. Una porta in shutdown interrompe quel segmento.";
  }
  if (type === "coaxial_splitter") {
    return "Lo splitter coassiale distribuisce il segnale solo sulle porte abilitate.";
  }
  return "Hub di livello 1: un frame in ingresso su una porta attiva viene inoltrato a tutte le altre porte abilitate (un solo dominio di collisione).";
}

function peerLabel(
  state: LabState,
  deviceId: string,
  iface: InterfaceConfig,
): string | null {
  if (!iface.connectedLinkId) return null;
  const link = state.links.find((l) => l.id === iface.connectedLinkId);
  if (!link) return null;
  const otherId = link.aDeviceId === deviceId ? link.bDeviceId : link.aDeviceId;
  const otherIfId = link.aDeviceId === deviceId ? link.bIfaceId : link.aIfaceId;
  const other = state.devices.find((d) => d.id === otherId);
  const otherIf = other?.interfaces.find((i) => i.id === otherIfId);
  if (!other || !otherIf) return null;
  return `${other.name}:${shortPortName(otherIf.name)}`;
}

export function HubPanel({
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
  const meta = DEVICE_META[live.type];
  const [tab, setTab] = useState<"config" | "physical">("config");
  const [name, setName] = useState(live.name);
  const [msg, setMsg] = useState<string | null>(null);

  const ports = useMemo(
    () => live.interfaces.filter((i) => !i.parentIfaceId),
    [live],
  );

  function apply(next: LabState) {
    stateRef.current = next;
    setState(next);
  }

  function commitName() {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(live.name);
      setMsg("Il nome non può essere vuoto.");
      return;
    }
    if (trimmed === live.name) return;
    apply(updateDevice(stateRef.current, live.id, { name: trimmed }));
    setMsg("Nome aggiornato.");
  }

  function togglePort(iface: InterfaceConfig, enabled: boolean) {
    apply(
      updateIface(stateRef.current, live.id, iface.id, { enabled }),
    );
    setMsg(
      enabled
        ? `${iface.name} di nuovo attiva.`
        : `${iface.name} in shutdown: non inoltra più frame.`,
    );
  }

  const active = ports.filter((p) => p.enabled).length;
  const linked = ports.filter((p) => p.enabled && p.connectedLinkId).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex h-[min(720px,94vh)] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-amber-500/30 bg-[#0b1220] shadow-2xl">
        <div className="flex items-center justify-between border-b border-amber-500/20 bg-slate-900 px-3 py-2 text-sm text-slate-200">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                live.powered ? "bg-amber-400" : "bg-slate-600"
              }`}
            />
            <span className="font-medium">{live.name}</span>
            <span className="hidden text-slate-500 sm:inline">
              · {meta.label}
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
          <TabBtn active={tab === "config"} onClick={() => setTab("config")}>
            Config
          </TabBtn>
          <TabBtn active={tab === "physical"} onClick={() => setTab("physical")}>
            Physical
          </TabBtn>
        </div>

        {tab === "physical" ? (
          <PhysicalPanel device={device} stateRef={stateRef} setState={setState} />
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <label className="block min-w-[12rem] flex-1 space-y-1">
                <span className="text-[11px] text-slate-400">Nome</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                  className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-slate-100 outline-none focus:border-amber-500"
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  apply(setDevicePower(stateRef.current, live.id, !live.powered))
                }
                className={`rounded px-3 py-1.5 text-xs font-semibold ${
                  live.powered
                    ? "bg-amber-600 text-white hover:bg-amber-500"
                    : "bg-slate-600 text-white hover:bg-slate-500"
                }`}
              >
                {live.powered ? "Acceso" : "Spento"}
              </button>
            </div>

            <p className="text-[11px] leading-relaxed text-slate-500">
              {hubBlurb(live.type)} Modello {meta.ptModel}. {active}/{ports.length}{" "}
              porte attive, {linked} collegate.
              {!live.powered && " Il dispositivo è spento: non inoltra traffico."}
            </p>

            <div className="overflow-hidden rounded-md border border-slate-700">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-[11px] text-slate-400">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">Porta</th>
                    <th className="px-2 py-1.5 font-medium">Stato</th>
                    <th className="px-2 py-1.5 font-medium">Collegata a</th>
                    <th className="px-2 py-1.5 font-medium">Attiva</th>
                  </tr>
                </thead>
                <tbody>
                  {ports.map((iface) => {
                    const peer = peerLabel(state, live.id, iface);
                    const up = Boolean(iface.enabled && iface.connectedLinkId);
                    const status = !iface.enabled
                      ? "shutdown"
                      : up
                        ? "up"
                        : "down";
                    return (
                      <tr key={iface.id} className="border-t border-slate-800">
                        <td className="px-2 py-1.5 font-mono text-amber-200">
                          {iface.name}
                          <span className="ml-1 font-sans text-[10px] text-slate-500">
                            {iface.media}
                          </span>
                        </td>
                        <td
                          className={`px-2 py-1.5 ${
                            status === "up"
                              ? "text-emerald-300"
                              : status === "shutdown"
                                ? "text-amber-300"
                                : "text-slate-500"
                          }`}
                        >
                          {status}
                        </td>
                        <td className="px-2 py-1.5 text-sky-300/90">
                          {peer ?? "—"}
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={iface.enabled}
                            aria-label={`Abilita ${iface.name}`}
                            onChange={(e) => togglePort(iface, e.target.checked)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {msg && (
              <p className="rounded border border-amber-500/30 bg-amber-950/30 px-2 py-1.5 text-[11px] text-amber-100">
                {msg}
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
        active
          ? "bg-slate-800 text-amber-200"
          : "text-slate-500 hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}
