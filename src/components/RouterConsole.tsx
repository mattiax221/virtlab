"use client";

import { useState } from "react";
import {
  initialRouterCli,
  routerPrompt,
  runRouterCommand,
  type CommandContext,
  type RouterCliState,
} from "@/lib/network/commands";
import type { Device, LabState } from "@/lib/network/types";
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
  const [cli, setCli] = useState<RouterCliState>(() =>
    initialRouterCli(device.name),
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
      <div className="flex h-[min(640px,90vh)] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-orange-500/30 bg-[#0b1220] shadow-2xl">
        <div className="flex items-center justify-between border-b border-orange-500/20 bg-slate-900 px-3 py-2 text-sm text-slate-200">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-400" />
            <span className="font-medium">Console CLI — {device.name}</span>
            <span className="hidden text-slate-500 sm:inline">
              · comandi stile Cisco IOS
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
        <div className="min-h-0 flex-1">
          <Terminal
            prompt={routerPrompt(cli)}
            accent="#fdba74"
            background="#0b1220"
            welcome={[
              `Router console — ${device.name}`,
              `Digita help oppure: enable → configure terminal → interface GigabitEthernet0/0`,
              ``,
            ]}
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
      </div>
    </div>
  );
}
