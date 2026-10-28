"use client";

import { useMemo, useState } from "react";
import { runPing } from "@/lib/network/engine";
import type { Device, DeviceKind, LabState } from "@/lib/network/types";

function hasWindowsDesktop(type: DeviceKind): boolean {
  return (
    type === "pc" ||
    type === "laptop" ||
    type === "server" ||
    type === "meraki_server"
  );
}

type PeerRow = {
  device: Device;
  ip: string | null;
  kind: string;
};

/**
 * Remote Desktop: scegli un host, verifica la rete, apri il suo Desktop.
 */
export function RemoteDesktop({
  device,
  stateRef,
  setState,
  onClose,
  onOpenRemote,
}: {
  device: Device;
  stateRef: React.MutableRefObject<LabState>;
  setState: (next: LabState) => void;
  onClose: () => void;
  onOpenRemote: (target: Device) => void;
}) {
  const peers = useMemo((): PeerRow[] => {
    return stateRef.current.devices
      .filter((d) => d.id !== device.id && hasWindowsDesktop(d.type))
      .map((d) => ({
        device: d,
        ip: d.interfaces.find((i) => i.ip && !i.parentIfaceId)?.ip ?? null,
        kind:
          d.type === "server" || d.type === "meraki_server"
            ? "Server"
            : d.type === "laptop"
              ? "Laptop"
              : "PC",
      }))
      .sort((a, b) => a.device.name.localeCompare(b.device.name));
  }, [device.id, stateRef]);

  const [selectedId, setSelectedId] = useState<string | null>(
    () => peers.find((p) => p.ip && p.device.powered)?.device.id ?? null,
  );
  const selected = peers.find((p) => p.device.id === selectedId) ?? null;
  const [ip, setIp] = useState(() => selected?.ip ?? "");
  const [phase, setPhase] = useState<"idle" | "testing" | "connecting" | "error">(
    "idle",
  );
  const [status, setStatus] = useState(
    "1) Scegli un PC/Server  ·  2) Connetti  ·  3) Lavori sul Desktop remoto",
  );

  function selectPeer(p: PeerRow) {
    setSelectedId(p.device.id);
    if (p.ip) setIp(p.ip);
    setPhase("idle");
    if (!p.device.powered) {
      setStatus(`${p.device.name} è spento — accendilo dal Physical.`);
    } else if (!p.ip) {
      setStatus(`${p.device.name} non ha IP — configura la scheda di rete.`);
    } else {
      setStatus(`Selezionato ${p.device.name} (${p.ip}). Premi Connetti.`);
    }
  }

  function connect(targetIp?: string) {
    const dest = (targetIp ?? ip).trim();
    if (!dest) {
      setPhase("error");
      setStatus("Serve un indirizzo IP.");
      return;
    }
    setPhase("testing");
    setStatus(`Verifica rete verso ${dest}…`);

    // micro-delay così si vede lo stato “testing”
    window.setTimeout(() => {
      const { result, state } = runPing(stateRef.current, device.id, dest);
      stateRef.current = state;
      setState(state);
      if (!result.ok) {
        setPhase("error");
        setStatus(
          `Non raggiungibile: ${result.message.split("\n")[0]}. Controlla cavi, VLAN e IP.`,
        );
        return;
      }
      const target = state.devices.find(
        (d) =>
          hasWindowsDesktop(d.type) &&
          d.interfaces.some((i) => i.ip === dest),
      );
      if (!target) {
        setPhase("error");
        setStatus(
          `Su ${dest} non c’è un Desktop (solo PC, Laptop o Server).`,
        );
        return;
      }
      if (!target.powered) {
        setPhase("error");
        setStatus(`${target.name} è spento.`);
        return;
      }
      setPhase("connecting");
      setStatus(`Connesso a ${target.name} — apertura Desktop…`);
      window.setTimeout(() => onOpenRemote(target), 280);
    }, 220);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f0f0f0] text-[12px] text-black">
      <div className="flex items-center justify-between border-b border-[#aca899] bg-gradient-to-b from-[#0a246a] to-[#a6caf0] px-3 py-1.5 text-white">
        <div>
          <div className="font-semibold">Remote Desktop Connection</div>
          <div className="text-[10px] text-white/80">
            Da {device.name} · come in Packet Tracer
          </div>
        </div>
        <button type="button" className="px-2 hover:bg-rose-600" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[1fr_1.1fr]">
        {/* Lista host */}
        <div className="flex min-h-0 flex-col border-b border-[#aca899] md:border-b-0 md:border-r">
          <div className="bg-[#ece9d8] px-3 py-2 text-[11px] font-semibold text-[#333]">
            Computer in topologia
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto bg-white">
            {peers.length === 0 && (
              <li className="px-3 py-4 text-[#777]">
                Nessun altro PC/Laptop/Server. Aggiungine uno sulla griglia.
              </li>
            )}
            {peers.map((p) => {
              const active = selectedId === p.device.id;
              const ready = !!p.ip && p.device.powered;
              return (
                <li key={p.device.id}>
                  <button
                    type="button"
                    onClick={() => selectPeer(p)}
                    className={`flex w-full items-center gap-2 border-b border-[#eee] px-3 py-2.5 text-left transition ${
                      active ? "bg-[#e8f0fe]" : "hover:bg-[#f7f7f7]"
                    }`}
                  >
                    <span
                      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                        ready
                          ? "bg-emerald-500"
                          : p.device.powered
                            ? "bg-amber-400"
                            : "bg-slate-400"
                      }`}
                      title={
                        ready
                          ? "Pronto"
                          : p.device.powered
                            ? "Senza IP"
                            : "Spento"
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {p.device.name}
                      </span>
                      <span className="block text-[10px] text-[#666]">
                        {p.kind}
                        {!p.device.powered
                          ? " · spento"
                          : !p.ip
                            ? " · senza IP"
                            : " · online"}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-[#444]">
                      {p.ip ?? "—"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Pannello connessione */}
        <div className="flex flex-col gap-3 bg-[#f7f7f7] p-4">
          <div className="rounded border border-[#aca899] bg-white p-3">
            <p className="text-[11px] leading-relaxed text-[#444]">
              Apri il <strong>Desktop</strong> di un altro host sulla rete (stesso
              lab). Serve IP raggiungibile con ping — come RDP in Packet Tracer.
            </p>
          </div>

          <label className="flex flex-col gap-1">
            <span className="font-semibold text-[#222]">Computer</span>
            <input
              className="rounded-none border border-[#7f9db9] bg-white px-2 py-1.5 font-mono text-[13px]"
              value={ip}
              onChange={(e) => {
                setIp(e.target.value);
                setPhase("idle");
              }}
              onKeyDown={(e) => e.key === "Enter" && connect()}
              placeholder="192.168.1.10"
            />
            {selected && (
              <span className="text-[10px] text-[#666]">
                Destinazione: {selected.device.name}
                {selected.ip ? ` · ${selected.ip}` : ""}
              </span>
            )}
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={phase === "testing" || phase === "connecting"}
              className="rounded-none border border-[#003c74] bg-[#ece9d8] px-4 py-1.5 font-semibold hover:bg-white disabled:opacity-50"
              onClick={() => connect()}
            >
              {phase === "testing"
                ? "Verifica…"
                : phase === "connecting"
                  ? "Apertura…"
                  : "Connetti"}
            </button>
            <button
              type="button"
              className="rounded-none border border-[#aca899] bg-white px-3 py-1.5 hover:bg-[#ece9d8]"
              onClick={onClose}
            >
              Annulla
            </button>
          </div>

          <div
            className={`rounded border px-3 py-2 text-[11px] leading-relaxed ${
              phase === "error"
                ? "border-rose-300 bg-rose-50 text-rose-900"
                : phase === "connecting"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : phase === "testing"
                    ? "border-sky-300 bg-sky-50 text-sky-900"
                    : "border-[#ccc] bg-white text-[#444]"
            }`}
          >
            {status}
          </div>

          <ol className="mt-auto list-decimal space-y-1 pl-4 text-[10px] text-[#666]">
            <li>Host con Desktop (PC / Laptop / Server) e IP configurato</li>
            <li>Cavo (o Wi‑Fi) fino a quel host — stesso lab</li>
            <li>
              Dopo Connetti: barra verde «Sessione remota» · Disconnetti per
              tornare qui
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
