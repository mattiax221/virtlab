"use client";

import { useEffect, useState } from "react";
import {
  runPcCommand,
  type CommandContext,
} from "@/lib/network/commands";
import { runPing } from "@/lib/network/engine";
import type { Device, LabState } from "@/lib/network/types";
import type { SimPacket } from "@/lib/network/simulation";
import { EmailClient } from "./EmailClient";
import { NetworkConnections } from "./NetworkConnections";
import { PhysicalPanel } from "./PhysicalPanel";
import { PppoeDialer } from "./PppoeDialer";
import { RemoteDesktop } from "./RemoteDesktop";
import { ServerServices } from "./ServerServices";
import { Terminal } from "./Terminal";
import { TextEditor } from "./TextEditor";
import { TrafficGenerator } from "./TrafficGenerator";
import { VpnClient } from "./VpnClient";
import { WebBrowser } from "./WebBrowser";
import { WifiTray } from "./WifiTray";

type AppId =
  | "ipconfig"
  | "cmd"
  | "terminal"
  | "browser"
  | "wireless"
  | "vpn"
  | "traffic"
  | "email"
  | "pppoe"
  | "editor"
  | "firewall"
  | "mib"
  | "voip"
  | "rdp"
  | "ssh"
  | "physical"
  | "services"
  | "stub"
  | null;

type Shortcut = {
  id: AppId;
  label: string;
  glyph: string;
  /** Solo server */
  serverOnly?: boolean;
  stub?: boolean;
};

/** Shortcut Desktop stile Packet Tracer (PC + Server). */
const SHORTCUTS: Shortcut[] = [
  { id: "ipconfig", label: "IP Configuration", glyph: "IP" },
  { id: "cmd", label: "Command Prompt", glyph: ">_" },
  { id: "terminal", label: "Terminal", glyph: "Τ" },
  { id: "browser", label: "Web Browser", glyph: "🌐" },
  { id: "wireless", label: "PC Wireless", glyph: "📡" },
  { id: "vpn", label: "VPN", glyph: "🔒" },
  { id: "traffic", label: "Traffic Generator", glyph: "✉+" },
  { id: "email", label: "Email", glyph: "@" },
  { id: "pppoe", label: "PPPoE Dialer", glyph: "PPP" },
  { id: "editor", label: "Text Editor", glyph: "✎" },
  { id: "rdp", label: "Remote Desktop", glyph: "🖥" },
  { id: "ssh", label: "Telnet / SSH Client", glyph: "SSH" },
  { id: "firewall", label: "Firewall", glyph: "FW", stub: true },
  { id: "mib", label: "MIB Browser", glyph: "MIB", stub: true },
  { id: "voip", label: "IP Communicator", glyph: "☎", stub: true },
  { id: "physical", label: "Physical", glyph: "⚙" },
  { id: "services", label: "Config / Services", glyph: "S", serverOnly: true },
];

export function WindowsDesktop({
  device,
  stateRef,
  setState,
  onClose,
  onSimulate,
  nested = false,
}: {
  device: Device;
  stateRef: React.MutableRefObject<LabState>;
  setState: (next: LabState) => void;
  onClose: () => void;
  onSimulate?: (packets: SimPacket[], message: string) => void;
  /** Sessione Remote Desktop annidata (niente altro RDP ricorsivo) */
  nested?: boolean;
}) {
  const live =
    stateRef.current.devices.find((d) => d.id === device.id) ?? device;
  const eth = live.interfaces.find((i) => !i.parentIfaceId);
  const isServer =
    live.type === "server" || live.type === "meraki_server";
  const [clock, setClock] = useState("--:--");
  const [app, setApp] = useState<AppId>(null);
  const [stubName, setStubName] = useState("");
  const [remoteTarget, setRemoteTarget] = useState<Device | null>(null);

  useEffect(() => {
    const tick = () => {
      const src = live.clockIso ? new Date(live.clockIso) : new Date();
      setClock(
        src.toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Rome",
        }),
      );
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [live.clockIso]);

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

  function openShortcut(s: Shortcut) {
    if (s.stub) {
      setStubName(s.label);
      setApp("stub");
      return;
    }
    if (s.id === "rdp" && nested) return;
    setApp(s.id);
  }

  const icons = SHORTCUTS.filter((s) => {
    if (s.serverOnly && !isServer) return false;
    if (s.id === "rdp" && nested) return false;
    return true;
  });

  if (remoteTarget) {
    return (
      <WindowsDesktop
        device={remoteTarget}
        stateRef={stateRef}
        setState={setState}
        onSimulate={onSimulate}
        nested
        onClose={() => setRemoteTarget(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:p-6">
      <div className="flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden border-0 border-slate-600/60 shadow-2xl sm:h-[min(760px,94vh)] sm:rounded-lg sm:border">
        <div className="flex items-center justify-between bg-slate-900 px-3 py-2 text-sm text-slate-200">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${live.powered ? "bg-emerald-400" : "bg-slate-500"}`}
            />
            <span className="font-medium">
              {nested ? "Remote Desktop — " : "Desktop — "}
              {live.name}
            </span>
            <span className="hidden text-slate-500 sm:inline">
              · tab Desktop (Packet Tracer)
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-slate-300 transition hover:bg-rose-600 hover:text-white"
          >
            {nested ? "Disconnetti" : "Chiudi"}
          </button>
        </div>

        <div
          className="relative flex min-h-0 flex-1 flex-col"
          style={{
            background: live.powered
              ? "#0a2a5c"
              : "linear-gradient(145deg, #1e293b 0%, #0f172a 100%)",
          }}
        >
          {/* Griglia shortcut PT */}
          {!app && (
            <div className="relative z-10 grid grid-cols-3 gap-3 overflow-y-auto p-4 sm:grid-cols-5 sm:gap-4 sm:p-6">
              {icons.map((s) => (
                <PtShortcut
                  key={s.id}
                  label={s.label}
                  glyph={s.glyph}
                  dimmed={!!s.stub}
                  onClick={() => openShortcut(s)}
                />
              ))}
            </div>
          )}

          {app && (
            <div
              className={`relative z-10 m-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded border shadow-xl sm:m-4 ${
                app === "physical" || app === "cmd" || app === "terminal" || app === "ssh"
                  ? "border-slate-600 bg-[#0b1220]"
                  : "border-slate-400/80 bg-[#f0f0f0]"
              }`}
            >
              {app === "ipconfig" && (
                <NetworkConnections
                  device={device}
                  stateRef={stateRef}
                  setState={setState}
                  onClose={() => setApp(null)}
                />
              )}
              {app === "wireless" && (
                <WifiSettingsPanel
                  device={device}
                  stateRef={stateRef}
                  setState={setState}
                  onClose={() => setApp(null)}
                />
              )}
              {app === "physical" && (
                <>
                  <PanelTitle onClose={() => setApp(null)}>
                    Physical — moduli (NIC / Wi‑Fi)
                  </PanelTitle>
                  <PhysicalPanel
                    device={device}
                    stateRef={stateRef}
                    setState={setState}
                  />
                </>
              )}
              {app === "services" && isServer && (
                <ServerServices
                  device={device}
                  stateRef={stateRef}
                  setState={setState}
                  onClose={() => setApp(null)}
                />
              )}
              {(app === "cmd" || app === "terminal") && (
                <>
                  <PanelTitle dark onClose={() => setApp(null)}>
                    {app === "terminal"
                      ? `Terminal — ${live.name}`
                      : `Command Prompt — ${live.name}`}
                  </PanelTitle>
                  <div className="min-h-0 flex-1">
                    <Terminal
                      prompt={`C:\\Users\\Studente>`}
                      accent="#f0f0f0"
                      background="#0c0c0c"
                      welcome={[
                        `Microsoft Windows [Versione NetLab 10.0]`,
                        `(c) NetLab — ${app === "terminal" ? "Terminal" : "CMD"}.`,
                        ``,
                        `Host: ${live.name} · IP: ${eth?.ip ?? "(n/d)"}`,
                        `help | ipconfig | ping | nslookup | ftp | ntp sync`,
                        ``,
                      ]}
                      onCommand={(line) => runPcCommand(line, makeCtx())}
                    />
                  </div>
                </>
              )}
              {app === "ssh" && (
                <SshClientPanel
                  device={device}
                  stateRef={stateRef}
                  setState={setState}
                  onClose={() => setApp(null)}
                />
              )}
              {app === "browser" && (
                <WebBrowser
                  device={device}
                  stateRef={stateRef}
                  setState={setState}
                  onClose={() => setApp(null)}
                />
              )}
              {app === "editor" && (
                <TextEditor
                  deviceName={live.name}
                  onClose={() => setApp(null)}
                />
              )}
              {app === "traffic" && (
                <TrafficGenerator
                  device={device}
                  stateRef={stateRef}
                  setState={setState}
                  onClose={() => setApp(null)}
                  onGenerate={(packets, message) => {
                    onSimulate?.(packets, message);
                  }}
                />
              )}
              {app === "email" && (
                <EmailClient
                  device={device}
                  stateRef={stateRef}
                  setState={setState}
                  onClose={() => setApp(null)}
                />
              )}
              {app === "pppoe" && (
                <PppoeDialer
                  device={device}
                  stateRef={stateRef}
                  setState={setState}
                  onClose={() => setApp(null)}
                />
              )}
              {app === "vpn" && (
                <VpnClient
                  device={device}
                  stateRef={stateRef}
                  setState={setState}
                  onClose={() => setApp(null)}
                />
              )}
              {app === "rdp" && (
                <RemoteDesktop
                  device={device}
                  stateRef={stateRef}
                  setState={setState}
                  onClose={() => setApp(null)}
                  onOpenRemote={(target) => {
                    setApp(null);
                    setRemoteTarget(target);
                  }}
                />
              )}
              {app === "stub" && (
                <div className="flex h-full flex-col bg-[#f0f0f0] text-[12px] text-black">
                  <PanelTitle light onClose={() => setApp(null)}>
                    {stubName}
                  </PanelTitle>
                  <div className="p-6 text-[#444]">
                    <p className="font-semibold text-[#222]">{stubName}</p>
                    <p className="mt-2">
                      Presente in Packet Tracer. In NetLab è in roadmap — usa
                      le altre shortcut (IP Configuration, CMD, Browser, Email,
                      VPN, PPPoE, Traffic Generator, Remote Desktop…).
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="relative z-10 mt-auto flex h-10 items-center gap-2 border-t border-slate-700/50 bg-slate-900/90 px-2 backdrop-blur">
            <button
              type="button"
              className="flex h-8 w-10 items-center justify-center rounded bg-sky-700 text-xs font-bold text-white"
              title="Mostra Desktop"
              onClick={() => setApp(null)}
            >
              N
            </button>
            {app && (
              <div className="truncate rounded bg-slate-800 px-3 py-1 text-xs text-slate-200">
                {SHORTCUTS.find((s) => s.id === app)?.label ??
                  (app === "stub" ? stubName : app)}
              </div>
            )}
            <div className="ml-auto flex items-center gap-1 pr-1">
              <WifiTray
                device={device}
                stateRef={stateRef}
                setState={setState}
              />
              <div className="px-2 text-xs text-slate-300">{clock}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PtShortcut({
  label,
  glyph,
  dimmed,
  onClick,
}: {
  label: string;
  glyph: string;
  dimmed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 text-center touch-manipulation ${
        dimmed ? "opacity-70" : ""
      }`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-sm bg-[#5dade2] text-[13px] font-bold text-[#0a2a5c] shadow-md ring-1 ring-white/30 transition hover:brightness-110 sm:h-16 sm:w-16">
        <span className="leading-none">{glyph}</span>
      </div>
      <span className="max-w-[5.5rem] text-[10px] leading-tight text-white drop-shadow sm:text-[11px]">
        {label}
      </span>
    </button>
  );
}

function PanelTitle({
  children,
  onClose,
  dark,
  light,
}: {
  children: React.ReactNode;
  onClose: () => void;
  dark?: boolean;
  light?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between border-b px-3 py-1.5 text-xs ${
        dark
          ? "border-slate-700 bg-[#1e1e1e] text-slate-200"
          : light
            ? "border-[#aca899] bg-gradient-to-b from-[#0a246a] to-[#a6caf0] text-white"
            : "border-slate-700 px-3 text-slate-200"
      }`}
    >
      <span>{children}</span>
      <button
        type="button"
        className="px-2 text-slate-300 hover:bg-rose-600 hover:text-white"
        onClick={onClose}
      >
        ✕
      </button>
    </div>
  );
}

function WifiSettingsPanel({
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
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f0f0f0] text-[12px] text-black">
      <PanelTitle light onClose={onClose}>
        PC Wireless — {device.name}
      </PanelTitle>
      <div className="space-y-3 p-4">
        <p className="text-[#444]">
          Configura la radio Wi‑Fi dal tray in basso a destra (icona segnale),
          oppure spegni il PC → Physical → modulo Wireless.
        </p>
        <div className="rounded border border-[#aca899] bg-white p-3">
          <WifiTray device={device} stateRef={stateRef} setState={setState} />
        </div>
      </div>
    </div>
  );
}

function SshClientPanel({
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
  const [host, setHost] = useState("192.168.1.1");
  const [log, setLog] = useState<string[]>([
    "Telnet / SSH Client (NetLab)",
    "Digita un IP e Connect — verifica raggiungibilità con ping.",
  ]);

  function connect() {
    const { result, state } = runPing(stateRef.current, device.id, host.trim());
    stateRef.current = state;
    setState(state);
    const target = state.devices.find((d) =>
      d.interfaces.some((i) => i.ip === host.trim()),
    );
    setLog((prev) => [
      ...prev,
      ``,
      `> connect ${host}`,
      result.ok
        ? `Connected to ${target?.name ?? host}.`
        : `Connection failed: ${result.message.split("\n")[0]}`,
      result.ok
        ? `(Apri il device dal canvas per la CLI completa router/switch.)`
        : "",
    ]);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0c0c0c] text-[12px] text-[#f0f0f0]">
      <PanelTitle dark onClose={onClose}>
        Telnet / SSH Client — {device.name}
      </PanelTitle>
      <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-900 px-2 py-1">
        <input
          className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-950 px-2 py-1 font-mono text-[12px]"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && connect()}
        />
        <button
          type="button"
          className="rounded bg-sky-700 px-3 py-1 text-white hover:bg-sky-600"
          onClick={connect}
        >
          Connect
        </button>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-[11px]">
        {log.join("\n")}
      </pre>
    </div>
  );
}
