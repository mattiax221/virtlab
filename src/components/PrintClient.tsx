"use client";

import { useMemo, useState } from "react";
import { buildPrintSimulation, type SimPacket } from "@/lib/network/simulation";
import type { Device, LabState } from "@/lib/network/types";

/**
 * Client stampanti di rete: invia un job LPR e anima il percorso sulla griglia.
 */
export function PrintClient({
  device,
  stateRef,
  setState,
  onClose,
  onPrint,
}: {
  device: Device;
  stateRef: React.MutableRefObject<LabState>;
  setState: (next: LabState) => void;
  onClose: () => void;
  onPrint?: (packets: SimPacket[], message: string) => void;
}) {
  const printers = useMemo(() => {
    return stateRef.current.devices
      .filter((d) => d.type === "printer")
      .map((d) => ({
        id: d.id,
        name: d.name,
        ip: d.interfaces.find((i) => i.ip && !i.parentIfaceId)?.ip ?? null,
        share: d.printerService?.shareName ?? d.name,
        powered: d.powered,
        enabled: d.printerService?.enabled !== false,
      }));
  }, [stateRef, device.id]);

  const [dest, setDest] = useState(
    () => printers.find((p) => p.ip)?.ip ?? "192.168.1.50",
  );
  const [log, setLog] = useState<string[]>([
    "Seleziona una stampante di rete e premi Stampa.",
    "Il job segue il percorso L2/L3 sulla griglia del lab.",
  ]);

  function run(target?: string) {
    const host = (target ?? dest).trim();
    if (!host) {
      setLog((l) => ["Specifica un IP stampante.", ...l]);
      return;
    }
    const built = buildPrintSimulation(stateRef.current, device.id, host);
    stateRef.current = built.state;
    setState(built.state);
    setLog((prev) =>
      [
        `[${new Date().toLocaleTimeString("it-IT", { timeZone: "Europe/Rome" })}] PRINT → ${host}`,
        built.message,
        ...built.packets.map(
          (p) =>
            `  · ${p.kind} ${p.label}: ${p.detail} (${p.ok ? "OK" : "FAIL"})`,
        ),
        "",
        ...prev,
      ].slice(0, 60),
    );
    onPrint?.(built.packets, built.message);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f0f0f0] text-[12px] text-black">
      <div className="flex items-center justify-between border-b border-[#aca899] bg-gradient-to-b from-[#0a246a] to-[#a6caf0] px-2 py-1 text-white">
        <span className="font-semibold">Printers — {device.name}</span>
        <button type="button" className="px-2 hover:bg-rose-600" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="space-y-3 border-b border-[#aca899] bg-[#ece9d8] p-3">
        <p className="text-[11px] text-[#444]">
          Stampa remota verso Printer-PT (LPR). Chiude il Desktop e anima il PDU
          magenta sulla topologia.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-[10rem] flex-1 rounded-none border border-[#7f9db9] bg-white px-2 py-1 font-mono"
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="192.168.1.50"
          />
          <button
            type="button"
            className="rounded-none border border-[#003c74] bg-[#ece9d8] px-3 py-1 font-semibold hover:bg-white"
            onClick={() => run()}
          >
            Stampa
          </button>
        </div>
        {printers.length > 0 ? (
          <ul className="space-y-1">
            {printers.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={!p.ip || !p.powered || !p.enabled}
                  onClick={() => {
                    if (p.ip) {
                      setDest(p.ip);
                      run(p.ip);
                    }
                  }}
                  className="flex w-full items-center justify-between rounded border border-[#aca899] bg-white px-2 py-1.5 text-left hover:bg-[#fff8dc] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>
                    <span className="font-semibold">{p.name}</span>
                    <span className="ml-2 text-[#666]">
                      \\\\{p.name}\\{p.share}
                    </span>
                  </span>
                  <span className="font-mono text-[11px] text-[#333]">
                    {p.ip ?? "no IP"}
                    {!p.powered ? " · OFF" : !p.enabled ? " · service off" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[#777]">Nessuna stampante in topologia.</p>
        )}
      </div>

      <pre className="min-h-0 flex-1 overflow-auto bg-white p-3 font-mono text-[11px] text-[#222]">
        {log.join("\n")}
      </pre>
    </div>
  );
}
