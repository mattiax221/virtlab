"use client";

import { useState } from "react";
import { iosCompletions } from "@/lib/cli-complete";
import {
  initialRouterCli,
  routerPrompt,
  runRouterCommand,
  type CommandContext,
  type RouterCliState,
} from "@/lib/network/commands";
import type { Device, LabState } from "@/lib/network/types";
import { PhysicalPanel } from "./PhysicalPanel";
import { Terminal } from "./Terminal";

export function RouterConsole({
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
  const [tab, setTab] = useState<"cli" | "physical">("cli");
  const [cli, setCli] = useState<RouterCliState>(() =>
    initialRouterCli(live.name),
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
      <div className="flex h-[min(720px,94vh)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-orange-500/30 bg-[#0b1220] shadow-2xl">
        <div className="flex items-center justify-between border-b border-orange-500/20 bg-slate-900 px-3 py-2 text-sm text-slate-200">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${live.powered ? "bg-orange-400" : "bg-slate-500"}`}
            />
            <span className="font-medium">Router — {live.name}</span>
            <span className="hidden text-slate-500 sm:inline">
              · IOS + Physical · inter-VLAN
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-slate-300 transition hover:bg-rose-600 hover:text-white"
          >
            Chiudi
          </button>
        </div>

        <div className="flex gap-1 border-b border-slate-800 px-3 pt-2">
          <button
            type="button"
            onClick={() => setTab("cli")}
            className={`rounded-t px-3 py-1.5 text-xs font-medium ${
              tab === "cli"
                ? "bg-slate-800 text-orange-200"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Console CLI
          </button>
          <button
            type="button"
            onClick={() => setTab("physical")}
            className={`rounded-t px-3 py-1.5 text-xs font-medium ${
              tab === "physical"
                ? "bg-slate-800 text-orange-200"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Physical
          </button>
        </div>

        {tab === "physical" ? (
          <PhysicalPanel
            device={device}
            stateRef={stateRef}
            setState={setState}
          />
        ) : (
          <div className="min-h-0 flex-1">
            <Terminal
              prompt={routerPrompt(cli)}
              accent="#fdba74"
              background="#0b1220"
              welcome={[
                `Router console — ${live.name}`,
                `Tab = autocompletamento (anche abbreviazioni: sh → show).`,
                `Inter-VLAN (router-on-a-stick):`,
                `  conf t`,
                `  interface GigabitEthernet0/0.10`,
                `  encapsulation dot1Q 10`,
                `  ip address 192.168.10.1 255.255.255.0`,
                `  no shutdown`,
                `Sullo switch: porta verso questo router → switchport mode trunk`,
                ``,
              ]}
              getCompletions={() =>
                iosCompletions(
                  cli.mode,
                  live.interfaces
                    .filter((i) => !i.parentIfaceId)
                    .flatMap((i) => [
                      i.name,
                      // suggerisci anche subinterface comuni
                      `${i.name}.10`,
                      `${i.name}.20`,
                    ]),
                )
              }
              onCommand={(line) => {
                let nextCli = cli;
                const result = runRouterCommand(
                  line,
                  makeCtx(),
                  cli,
                  (n) => {
                    nextCli = n;
                    setCli(n);
                  },
                );
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
