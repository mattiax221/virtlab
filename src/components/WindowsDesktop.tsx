"use client";

import { useEffect, useState } from "react";
import {
  FTP_COMPLETIONS,
  PC_LINUX_COMPLETIONS,
  PC_WIN_COMPLETIONS,
  iosCompletions,
} from "@/lib/cli-complete";
import {
  hasFtpSession,
  initialRouterCli,
  routerPrompt,
  runPcCommand,
  runRouterCommand,
  type CommandContext,
  type RouterCliState,
} from "@/lib/network/commands";
import { runPing, updateDevice } from "@/lib/network/engine";
import {
  getHostOs,
  isL3Device,
  isManagedSwitch,
  type Device,
  type HostOs,
  type LabState,
} from "@/lib/network/types";
import type { SimPacket } from "@/lib/network/simulation";
import { EmailClient } from "./EmailClient";
import { HostFirewallPanel } from "./HostFirewall";
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

type IconKind =
  | "ip"
  | "cmd"
  | "terminal"
  | "browser"
  | "wireless"
  | "vpn"
  | "traffic"
  | "email"
  | "pppoe"
  | "editor"
  | "rdp"
  | "ssh"
  | "firewall"
  | "mib"
  | "voip"
  | "physical"
  | "services";

type Shortcut = {
  id: AppId;
  label: string;
  icon: IconKind;
  /** Solo server */
  serverOnly?: boolean;
  stub?: boolean;
};

/** Shortcut Desktop stile Packet Tracer — etichette corte e leggibili. */
const SHORTCUTS_WIN: Shortcut[] = [
  { id: "ipconfig", label: "IP Configuration", icon: "ip" },
  { id: "cmd", label: "Command Prompt", icon: "cmd" },
  { id: "terminal", label: "Terminal", icon: "terminal" },
  { id: "browser", label: "Web Browser", icon: "browser" },
  { id: "wireless", label: "PC Wireless", icon: "wireless" },
  { id: "vpn", label: "VPN", icon: "vpn" },
  { id: "traffic", label: "Traffic Generator", icon: "traffic" },
  { id: "email", label: "Email", icon: "email" },
  { id: "pppoe", label: "PPPoE Dialer", icon: "pppoe" },
  { id: "editor", label: "Text Editor", icon: "editor" },
  { id: "rdp", label: "Remote Desktop", icon: "rdp" },
  { id: "ssh", label: "Telnet / SSH", icon: "ssh" },
  { id: "firewall", label: "Firewall", icon: "firewall" },
  { id: "mib", label: "MIB Browser", icon: "mib", stub: true },
  { id: "voip", label: "IP Communicator", icon: "voip", stub: true },
  { id: "physical", label: "Physical", icon: "physical" },
  { id: "services", label: "Services", icon: "services", serverOnly: true },
];

const SHORTCUTS_LINUX: Shortcut[] = [
  { id: "ipconfig", label: "Network Settings", icon: "ip" },
  { id: "cmd", label: "Terminal", icon: "terminal" },
  { id: "browser", label: "Web Browser", icon: "browser" },
  { id: "wireless", label: "Wi‑Fi", icon: "wireless" },
  { id: "vpn", label: "VPN", icon: "vpn" },
  { id: "traffic", label: "Traffic Generator", icon: "traffic" },
  { id: "email", label: "Email", icon: "email" },
  { id: "pppoe", label: "PPPoE Dialer", icon: "pppoe" },
  { id: "editor", label: "Text Editor", icon: "editor" },
  { id: "rdp", label: "Remote Desktop", icon: "rdp" },
  { id: "ssh", label: "Telnet / SSH", icon: "ssh" },
  { id: "firewall", label: "Firewall", icon: "firewall" },
  { id: "mib", label: "MIB Browser", icon: "mib", stub: true },
  { id: "voip", label: "IP Communicator", icon: "voip", stub: true },
  { id: "physical", label: "Physical", icon: "physical" },
  { id: "services", label: "Services", icon: "services", serverOnly: true },
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
  const hostOs = getHostOs(live);
  const isLinux = hostOs === "linux";
  const [clock, setClock] = useState("--:--");
  const [app, setApp] = useState<AppId>(null);
  const [stubName, setStubName] = useState("");
  const [remoteTarget, setRemoteTarget] = useState<Device | null>(null);

  function setHostOs(next: HostOs) {
    const updated = updateDevice(stateRef.current, device.id, {
      hostOs: next,
    });
    stateRef.current = updated;
    setState(updated);
    // Chiudi shell aperta così riparte col prompt giusto
    if (app === "cmd" || app === "terminal") setApp(null);
  }

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

  const icons = (isLinux ? SHORTCUTS_LINUX : SHORTCUTS_WIN).filter((s) => {
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
              · {isLinux ? "Linux Desktop" : "Windows Desktop"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex overflow-hidden rounded border border-slate-600 text-[11px]"
              title="Sistema operativo del Desktop (CMD vs bash)"
            >
              <button
                type="button"
                onClick={() => setHostOs("windows")}
                className={`px-2.5 py-1 transition ${
                  !isLinux
                    ? "bg-sky-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                Windows
              </button>
              <button
                type="button"
                onClick={() => setHostOs("linux")}
                className={`px-2.5 py-1 transition ${
                  isLinux
                    ? "bg-amber-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                Linux
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded px-2 py-1 text-slate-300 transition hover:bg-rose-600 hover:text-white"
            >
              {nested ? "Disconnetti" : "Chiudi"}
            </button>
          </div>
        </div>

        <div
          className="relative flex min-h-0 flex-1 flex-col"
          style={{
            background: !live.powered
              ? "linear-gradient(145deg, #1e293b 0%, #0f172a 100%)"
              : isLinux
                ? "linear-gradient(165deg, #1a3a2f 0%, #0d1f18 45%, #12261c 100%)"
                : "linear-gradient(180deg, #0c356e 0%, #082448 100%)",
            fontFamily: isLinux
              ? "'Ubuntu', 'Cantarell', 'DejaVu Sans', sans-serif"
              : "Tahoma, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
          }}
        >
          {/* Griglia shortcut PT */}
          {!app && (
            <div className="relative z-10 grid grid-cols-3 gap-x-2 gap-y-5 overflow-y-auto px-3 py-5 sm:grid-cols-5 sm:gap-x-4 sm:gap-y-6 sm:px-8 sm:py-7">
              {icons.map((s) => (
                <PtShortcut
                  key={s.id}
                  label={s.label}
                  icon={s.icon}
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
              {app === "firewall" && (
                <HostFirewallPanel
                  device={device}
                  stateRef={stateRef}
                  setState={setState}
                  onClose={() => setApp(null)}
                />
              )}
              {(app === "cmd" || app === "terminal") && (
                <>
                  <PanelTitle dark onClose={() => setApp(null)}>
                    {isLinux
                      ? `Terminal — ${live.name} (bash)`
                      : app === "terminal"
                        ? `Terminal — ${live.name}`
                        : `Command Prompt — ${live.name}`}
                  </PanelTitle>
                  <div className="min-h-0 flex-1">
                    <Terminal
                      key={`${hostOs}-${app}`}
                      prompt={
                        isLinux
                          ? `studente@${live.name}:~$`
                          : `C:\\Users\\Studente>`
                      }
                      accent={isLinux ? "#a8e6a3" : "#f0f0f0"}
                      background={isLinux ? "#1e1e1e" : "#0c0c0c"}
                      welcome={
                        isLinux
                          ? [
                              `NetLab Linux ${live.name} 6.8.0-netlab`,
                              `Welcome to bash — digita help · Tab = completa.`,
                              ``,
                              `Host: ${live.name} · IP: ${eth?.ip ?? "(n/d)"}`,
                              `ip addr | dhclient | ping | dig | curl | ftp`,
                              ``,
                            ]
                          : [
                              `Microsoft Windows [Versione NetLab 10.0]`,
                              `(c) NetLab — ${app === "terminal" ? "Terminal" : "CMD"} · Tab = completa.`,
                              ``,
                              `Host: ${live.name} · IP: ${eth?.ip ?? "(n/d)"}`,
                              `help | ipconfig | ping | nslookup | ftp | ntp sync`,
                              ``,
                            ]
                      }
                      getCompletions={() =>
                        hasFtpSession(device.id)
                          ? FTP_COMPLETIONS
                          : isLinux
                            ? PC_LINUX_COMPLETIONS
                            : PC_WIN_COMPLETIONS
                      }
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
                {(isLinux ? SHORTCUTS_LINUX : SHORTCUTS_WIN).find(
                  (s) => s.id === app,
                )?.label ?? (app === "stub" ? stubName : app)}
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
  icon,
  dimmed,
  onClick,
}: {
  label: string;
  icon: IconKind;
  dimmed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col items-center gap-2 text-center touch-manipulation ${
        dimmed ? "opacity-60" : ""
      }`}
    >
      <div className="flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-[3px] bg-[#7ec8e8] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_2px_6px_rgba(0,0,0,0.35)] ring-1 ring-[#2a6f9a]/35 transition group-hover:bg-[#95d4f0] group-hover:brightness-105 sm:h-[4.25rem] sm:w-[4.25rem]">
        <DesktopGlyph kind={icon} />
      </div>
      <span className="max-w-[6.25rem] text-[11px] font-medium leading-snug tracking-wide text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.85)] sm:max-w-[7rem] sm:text-[12px]">
        {label}
      </span>
    </button>
  );
}

function DesktopGlyph({ kind }: { kind: IconKind }) {
  const common = {
    viewBox: "0 0 48 48",
    className: "h-9 w-9 sm:h-10 sm:w-10",
    fill: "none" as const,
    stroke: "#0b2d4d",
    strokeWidth: 2.1,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (kind) {
    case "ip":
      return (
        <svg {...common}>
          <rect x="8" y="14" width="32" height="20" rx="2" fill="#f4f8fc" />
          <path d="M16 14v20M24 14v20M32 14v20" />
          <text
            x="12"
            y="28"
            fill="#0b2d4d"
            stroke="none"
            fontSize="9"
            fontFamily="ui-monospace,monospace"
            fontWeight="700"
          >
            192
          </text>
        </svg>
      );
    case "cmd":
      return (
        <svg {...common}>
          <rect x="7" y="10" width="34" height="26" rx="2" fill="#1e3a5f" />
          <path d="M14 20l5 4-5 4M22 28h10" stroke="#e8f4ff" />
        </svg>
      );
    case "terminal":
      return (
        <svg {...common}>
          <rect x="9" y="8" width="30" height="24" rx="2" fill="#1e3a5f" />
          <path d="M16 30h16" />
          <path d="M16 18l4 3-4 3" stroke="#e8f4ff" />
          <path d="M22 24h8" stroke="#e8f4ff" />
        </svg>
      );
    case "browser":
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="12" fill="#f4f8fc" />
          <path d="M12 24h24M24 12c3.5 3.5 3.5 20.5 0 24M24 12c-3.5 3.5-3.5 20.5 0 24" />
          <path
            d="M14 30c4-2 16-2 20 0"
            stroke="#c9a227"
            strokeWidth="2.4"
          />
        </svg>
      );
    case "wireless":
      return (
        <svg {...common}>
          <path d="M24 36v-8" />
          <path d="M18 36h12" />
          <path d="M24 14c6 0 11 5 11 11" />
          <path d="M24 14c-6 0-11 5-11 11" />
          <path d="M24 20c3 0 6 2.5 6 5.5" />
          <path d="M24 20c-3 0-6 2.5-6 5.5" />
          <circle cx="24" cy="28" r="1.8" fill="#0b2d4d" stroke="none" />
        </svg>
      );
    case "vpn":
      return (
        <svg {...common}>
          <rect x="10" y="12" width="28" height="20" rx="2" fill="#f4f8fc" />
          <rect
            x="20"
            y="24"
            width="14"
            height="12"
            rx="2"
            fill="#d9e2ec"
          />
          <path d="M24 24v-3a3 3 0 016 0v3" />
          <circle cx="27" cy="30" r="1.4" fill="#0b2d4d" stroke="none" />
        </svg>
      );
    case "traffic":
      return (
        <svg {...common}>
          <rect x="10" y="18" width="22" height="14" rx="1.5" fill="#f4f8fc" />
          <rect x="14" y="14" width="22" height="14" rx="1.5" fill="#e8eef5" />
          <rect x="18" y="10" width="22" height="14" rx="1.5" fill="#f4f8fc" />
          <path d="M22 17h10M22 21h8" />
          <circle cx="36" cy="34" r="7" fill="#2f9e44" stroke="#0b2d4d" />
          <path d="M36 30v8M32 34h8" stroke="#fff" strokeWidth="2" />
        </svg>
      );
    case "email":
      return (
        <svg {...common}>
          <rect x="8" y="14" width="26" height="20" rx="1.5" fill="#f4f8fc" />
          <path d="M8 16l13 10L34 16" />
          <rect x="22" y="20" width="16" height="14" rx="1" fill="#fff8e7" />
          <text
            x="26"
            y="30"
            fill="#0b2d4d"
            stroke="none"
            fontSize="11"
            fontFamily="Georgia,serif"
            fontWeight="700"
          >
            @
          </text>
        </svg>
      );
    case "pppoe":
      return (
        <svg {...common}>
          <rect x="10" y="16" width="28" height="16" rx="2" fill="#f4f8fc" />
          <circle cx="16" cy="24" r="1.6" fill="#e03131" stroke="none" />
          <circle cx="22" cy="24" r="1.6" fill="#e03131" stroke="none" />
          <circle cx="28" cy="24" r="1.6" fill="#e03131" stroke="none" />
          <path d="M34 20v8" />
        </svg>
      );
    case "editor":
      return (
        <svg {...common}>
          <path d="M14 10h14l8 8v20H14z" fill="#f4f8fc" />
          <path d="M28 10v8h8" />
          <path d="M18 24h12M18 29h10M18 34h8" />
          <path d="M32 36l6-6 2 2-6 6h-2z" fill="#c9a227" />
        </svg>
      );
    case "rdp":
      return (
        <svg {...common}>
          <rect x="6" y="10" width="22" height="16" rx="1.5" fill="#f4f8fc" />
          <rect x="18" y="20" width="22" height="16" rx="1.5" fill="#dce9f5" />
          <path d="M12 30h10M24 40h10" />
        </svg>
      );
    case "ssh":
      return (
        <svg {...common}>
          <rect x="8" y="12" width="32" height="22" rx="2" fill="#1e3a5f" />
          <path d="M14 20l4 3-4 3" stroke="#e8f4ff" />
          <path d="M20 26h8" stroke="#e8f4ff" />
          <rect
            x="28"
            y="28"
            width="12"
            height="10"
            rx="1.5"
            fill="#d9e2ec"
          />
          <path d="M31 28v-2a3 3 0 016 0v2" />
        </svg>
      );
    case "firewall":
      return (
        <svg {...common}>
          <rect x="10" y="10" width="28" height="18" rx="1.5" fill="#f4f8fc" />
          <text
            x="16"
            y="22"
            fill="#0b2d4d"
            stroke="none"
            fontSize="8"
            fontFamily="ui-monospace,monospace"
            fontWeight="700"
          >
            IPv4
          </text>
          <path d="M12 32h6v6H12zm8 0h6v6h-6zm8 0h6v6h-6z" fill="#b35c1e" />
          <path d="M18 30c2-4 4-4 6 0" stroke="#e8590c" />
        </svg>
      );
    case "mib":
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="12" fill="#f4f8fc" />
          <path d="M12 24h24M24 12c3.5 3.5 3.5 20.5 0 24M24 12c-3.5 3.5-3.5 20.5 0 24" />
          <rect x="14" y="20" width="20" height="8" rx="1" fill="#fff8e7" />
          <text
            x="17"
            y="26"
            fill="#0b2d4d"
            stroke="none"
            fontSize="7"
            fontFamily="ui-sans-serif,system-ui"
            fontWeight="700"
          >
            MIB
          </text>
        </svg>
      );
    case "voip":
      return (
        <svg {...common}>
          <rect x="10" y="10" width="28" height="20" rx="2" fill="#f4f8fc" />
          <path d="M18 36h12" />
          <path
            d="M20 26c0 4 8 4 8 0v-4H20z"
            fill="#2f9e44"
            stroke="#0b2d4d"
          />
          <circle cx="24" cy="20" r="3" fill="#2f9e44" stroke="#0b2d4d" />
        </svg>
      );
    case "physical":
      return (
        <svg {...common}>
          <rect x="8" y="14" width="32" height="20" rx="2" fill="#f4f8fc" />
          <path d="M14 20h6M14 26h4M24 20h4M24 26h10" />
          <circle cx="36" cy="20" r="2" />
        </svg>
      );
    case "services":
      return (
        <svg {...common}>
          <rect x="10" y="10" width="28" height="28" rx="2" fill="#f4f8fc" />
          <path d="M16 18h16M16 24h16M16 30h10" />
          <circle cx="32" cy="30" r="3" fill="#2f9e44" stroke="#0b2d4d" />
        </svg>
      );
    default:
      return null;
  }
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
  const [status, setStatus] = useState(
    "Inserisci l’IP di un router/switch e Connect.",
  );
  const [session, setSession] = useState<{
    target: Device;
    cli: RouterCliState;
  } | null>(null);

  function connect() {
    const dest = host.trim();
    const { result, state } = runPing(stateRef.current, device.id, dest);
    stateRef.current = state;
    setState(state);
    if (!result.ok) {
      setStatus(`Connessione fallita — ${result.message.split("\n")[0]}`);
      setSession(null);
      return;
    }
    const target = state.devices.find((d) =>
      d.interfaces.some((i) => i.ip === dest),
    );
    if (!target) {
      setStatus(`Nessun device con IP ${dest}.`);
      setSession(null);
      return;
    }
    if (!isL3Device(target.type) && !isManagedSwitch(target.type)) {
      setStatus(
        `${target.name} non ha CLI IOS (usa Remote Desktop per PC/Server).`,
      );
      setSession(null);
      return;
    }
    setStatus(`SSH session → ${target.name} (${dest})`);
    setSession({
      target,
      cli: initialRouterCli(target.name),
    });
  }

  function makeRemoteCtx(): CommandContext {
    return {
      state: stateRef.current,
      deviceId: session!.target.id,
      setState: (next) => {
        stateRef.current = next;
        setState(next);
      },
    };
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0c0c0c] text-[12px] text-[#f0f0f0]">
      <PanelTitle dark onClose={onClose}>
        Telnet / SSH Client — {device.name}
      </PanelTitle>
      {!session ? (
        <div className="space-y-3 p-4">
          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-950 px-2 py-1.5 font-mono text-[12px]"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && connect()}
              placeholder="192.168.1.1"
            />
            <button
              type="button"
              className="rounded bg-sky-700 px-3 py-1.5 text-white hover:bg-sky-600"
              onClick={connect}
            >
              Connect
            </button>
          </div>
          <p className="text-[11px] text-slate-400">{status}</p>
          <p className="text-[11px] text-slate-500">
            Dopo Connect ottieni la CLI Cisco-like del device remoto (enable,
            conf t, show…). Vedi{" "}
            <a href="/comandi" className="text-sky-400 underline">
              /comandi
            </a>
            .
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300">
            <span>
              Connected: {session.target.name} · {status}
            </span>
            <button
              type="button"
              className="rounded px-2 py-0.5 hover:bg-rose-700"
              onClick={() => {
                setSession(null);
                setStatus("Sessione chiusa.");
              }}
            >
              Disconnect
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <Terminal
              prompt={routerPrompt(session.cli)}
              accent="#f0f0f0"
              background="#0c0c0c"
              welcome={[
                `SSH to ${session.target.name}`,
                `User Access Verification`,
                ``,
                `Type help or ? · Tab completa. Digita enable per privilegi.`,
                ``,
              ]}
              getCompletions={() =>
                iosCompletions(
                  session.cli.mode,
                  session.target.interfaces
                    .filter((i) => !i.parentIfaceId)
                    .map((i) => i.name),
                )
              }
              onCommand={(line) => {
                let nextCli = session.cli;
                const res = runRouterCommand(
                  line,
                  makeRemoteCtx(),
                  session.cli,
                  (c) => {
                    nextCli = c;
                    setSession((s) => (s ? { ...s, cli: c } : s));
                  },
                );
                void nextCli;
                return res;
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
