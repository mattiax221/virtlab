"use client";

import { useMemo, useState } from "react";
import {
  initialRouterCli,
  routerPrompt,
  runSwitchCommand,
  type CommandContext,
  type RouterCliState,
} from "@/lib/network/commands";
import {
  comparePorts,
  portDuplexLabel,
  portSpeedLabel,
  shortPortName,
} from "@/lib/network/portSort";
import { isManagedSwitch, type Device, type LabState } from "@/lib/network/types";
import { PhysicalPanel } from "./PhysicalPanel";
import { Terminal } from "./Terminal";

export function SwitchPanel({
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
  const managed = isManagedSwitch(live.type);
  const [tab, setTab] = useState<"ports" | "cli" | "physical">("ports");
  const [cli, setCli] = useState<RouterCliState>(() =>
    initialRouterCli(live.name),
  );

  const ports = useMemo(
    () =>
      [...live.interfaces.filter((i) => !i.parentIfaceId)].sort(comparePorts),
    [live],
  );

  function makeCtx(): CommandContext {
    return {
      state: stateRef.current,
      deviceId: device.id,
      setState: (next) => {
        stateRef.current = next;
        setState(next);
      },
    };
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex h-[min(720px,94vh)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-emerald-500/30 bg-[#0b1220] shadow-2xl">
        <div className="flex items-center justify-between border-b border-emerald-500/20 bg-slate-900 px-3 py-2 text-sm text-slate-200">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="font-medium">{live.name}</span>
            <span className="hidden text-slate-500 sm:inline">
              · L2 {managed ? "switch (VLAN / MAC)" : "bridge"}
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
          <TabBtn active={tab === "ports"} onClick={() => setTab("ports")}>
            Porte / LED
          </TabBtn>
          {managed && (
            <TabBtn active={tab === "cli"} onClick={() => setTab("cli")}>
              Console CLI
            </TabBtn>
          )}
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
        ) : tab === "ports" || !managed ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
              <Legend color="bg-emerald-400" label="up (link)" />
              <Legend color="bg-sky-400" label="1000 Mbps" />
              <Legend color="bg-lime-400" label="100 Mbps" />
              <Legend color="bg-amber-400" label="admin down" />
              <Legend color="bg-slate-600" label="notconnect" />
              <Legend color="ring-violet-400 ring-2" label="trunk" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {ports.map((iface) => {
                const up = Boolean(iface.enabled && iface.connectedLinkId);
                const adminDown = !iface.enabled;
                const speed = portSpeedLabel(iface);
                const duplex = portDuplexLabel(iface);
                const gig = speed === "1000";
                const led = adminDown
                  ? "bg-amber-400"
                  : !up
                    ? "bg-slate-600"
                    : gig
                      ? "bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.75)]"
                      : "bg-lime-400 shadow-[0_0_10px_rgba(163,230,53,0.75)]";
                const status = adminDown
                  ? "disabled"
                  : up
                    ? "connected"
                    : "notconnect";
                const vlanLabel =
                  iface.mode === "trunk"
                    ? `trunk n${iface.nativeVlan}`
                    : `VLAN ${iface.accessVlan}`;
                const peer = (() => {
                  if (!iface.connectedLinkId) return null;
                  const link = stateRef.current.links.find(
                    (l) => l.id === iface.connectedLinkId,
                  );
                  if (!link) return null;
                  const otherId =
                    link.aDeviceId === live.id
                      ? link.bDeviceId
                      : link.aDeviceId;
                  const otherIfId =
                    link.aDeviceId === live.id
                      ? link.bIfaceId
                      : link.aIfaceId;
                  const other = stateRef.current.devices.find(
                    (d) => d.id === otherId,
                  );
                  const oIf = other?.interfaces.find((i) => i.id === otherIfId);
                  if (!other || !oIf) return null;
                  return `${other.name}:${shortPortName(oIf.name)}`;
                })();
                return (
                  <div
                    key={iface.id}
                    title={
                      peer
                        ? `${iface.name} → ${peer} · ${speed} ${duplex}`
                        : `${iface.name} · ${status}`
                    }
                    className={`rounded-md border bg-slate-950/60 px-2.5 py-2 ${
                      iface.mode === "trunk"
                        ? "border-violet-500/50"
                        : "border-slate-700/80"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`relative h-3 w-3 shrink-0 rounded-full ${led}`}
                      >
                        {up && (
                          <span className="absolute inset-0 animate-ping rounded-full bg-inherit opacity-30" />
                        )}
                      </span>
                      <span className="truncate font-mono text-[11px] text-emerald-300">
                        {shortPortName(iface.name)}
                      </span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
                      <span className="text-slate-500">Stato</span>
                      <span
                        className={
                          up
                            ? "text-emerald-300"
                            : adminDown
                              ? "text-amber-300"
                              : "text-slate-500"
                        }
                      >
                        {status}
                      </span>
                      <span className="text-slate-500">Speed</span>
                      <span className="font-mono text-slate-300">
                        {speed === "—" ? "—" : `${speed}${speed === "WLAN" || speed === "serial" ? "" : " Mbps"}`}
                      </span>
                      <span className="text-slate-500">Duplex</span>
                      <span className="font-mono text-slate-300">{duplex}</span>
                      {managed && (
                        <>
                          <span className="text-slate-500">Mode</span>
                          <span
                            className={
                              iface.mode === "trunk"
                                ? "text-violet-300"
                                : "text-slate-400"
                            }
                          >
                            {vlanLabel}
                          </span>
                        </>
                      )}
                    </div>
                    {peer && (
                      <div className="mt-1 truncate text-[10px] text-sky-300/90">
                        → {peer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {managed && (
              <div className="mt-4 rounded-md border border-slate-700/60 bg-slate-950/40 p-3 text-xs text-slate-400">
                <div className="font-medium text-slate-300">VLAN definite</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(live.vlans ?? [{ id: 1, name: "default" }])
                    .filter((v) => v.id < 1002)
                    .map((v) => (
                      <span
                        key={v.id}
                        className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300"
                      >
                        {v.id} · {v.name}
                      </span>
                    ))}
                </div>
                <p className="mt-2 leading-relaxed text-slate-500">
                  Tab Console CLI:{" "}
                  <code className="text-emerald-400/90">show vlan brief</code>,{" "}
                  <code className="text-emerald-400/90">show mac address-table</code>,{" "}
                  <code className="text-emerald-400/90">switchport access vlan</code>.
                  Ping tra VLAN diverse fallisce senza router.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="min-h-0 flex-1">
            <Terminal
              prompt={routerPrompt(cli)}
              accent="#6ee7b7"
              background="#0b1220"
              welcome={[
                `Switch console — ${live.name}`,
                `L2: VLAN, porte, MAC table. Digita help`,
                ``,
                `  enable`,
                `  show vlan brief`,
                `  show mac address-table`,
                `  show interfaces status`,
                ``,
                `Trunk verso router (inter-VLAN):`,
                `  interface Fa0/X → switchport mode trunk`,
                ``,
              ]}
              onCommand={(line) => {
                let nextCli = cli;
                const result = runSwitchCommand(line, makeCtx(), cli, (n) => {
                  nextCli = n;
                  setCli(n);
                });
                void nextCli;
                return result;
              }}
            />
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
          ? "bg-slate-800 text-emerald-200"
          : "text-slate-500 hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
