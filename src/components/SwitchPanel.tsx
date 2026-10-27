"use client";

import { useMemo, useState } from "react";
import {
  initialRouterCli,
  routerPrompt,
  runSwitchCommand,
  type CommandContext,
  type RouterCliState,
} from "@/lib/network/commands";
import { isManagedSwitch, type Device, type LabState } from "@/lib/network/types";
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
  const [tab, setTab] = useState<"ports" | "cli">("ports");
  const [cli, setCli] = useState<RouterCliState>(() =>
    initialRouterCli(live.name),
  );

  const ports = useMemo(() => live.interfaces, [live]);

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

        {managed && (
          <div className="flex gap-1 border-b border-slate-800 px-3 pt-2">
            <TabBtn active={tab === "ports"} onClick={() => setTab("ports")}>
              Porte / LED
            </TabBtn>
            <TabBtn active={tab === "cli"} onClick={() => setTab("cli")}>
              Console CLI
            </TabBtn>
          </div>
        )}

        {tab === "ports" || !managed ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
              <Legend color="bg-emerald-400" label="up / connected" />
              <Legend color="bg-amber-400" label="admin down" />
              <Legend color="bg-slate-600" label="notconnect" />
              <Legend color="ring-sky-400 ring-2" label="trunk" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {ports.map((iface) => {
                const up = Boolean(iface.enabled && iface.connectedLinkId);
                const adminDown = !iface.enabled;
                const led = adminDown
                  ? "bg-amber-400"
                  : up
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
                    : "bg-slate-600";
                const vlanLabel =
                  iface.mode === "trunk"
                    ? `trunk n${iface.nativeVlan}`
                    : `VLAN ${iface.accessVlan}`;
                return (
                  <div
                    key={iface.id}
                    className={`rounded-md border bg-slate-950/60 px-2.5 py-2 ${
                      iface.mode === "trunk"
                        ? "border-sky-500/50"
                        : "border-slate-700/80"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${led}`} />
                      <span className="truncate font-mono text-[11px] text-emerald-300">
                        {iface.name.replace("FastEthernet", "Fa").replace("GigabitEthernet", "Gi")}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px]">
                      <span className="text-slate-500">
                        {adminDown
                          ? "disabled"
                          : up
                            ? "connected"
                            : "notconnect"}
                      </span>
                      {managed && (
                        <span
                          className={
                            iface.mode === "trunk"
                              ? "text-sky-300"
                              : "text-slate-400"
                          }
                        >
                          {vlanLabel}
                        </span>
                      )}
                    </div>
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
