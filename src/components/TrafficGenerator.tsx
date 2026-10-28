"use client";

import { useMemo, useState } from "react";
import {
  buildDhcpSimulation,
  buildDnsSimulation,
  buildHttpSimulation,
  buildPingSimulation,
  buildPrintSimulation,
  type SimPacket,
} from "@/lib/network/simulation";
import type { Device, LabState } from "@/lib/network/types";

type Proto = "ICMP" | "HTTP" | "DNS" | "DHCP" | "PRINT";

/**
 * Desktop Traffic Generator (Packet Tracer style).
 * Generates PDU and optionally animates them on the canvas.
 */
export function TrafficGenerator({
  device,
  stateRef,
  setState,
  onClose,
  onGenerate,
}: {
  device: Device;
  stateRef: React.MutableRefObject<LabState>;
  setState: (next: LabState) => void;
  onClose: () => void;
  onGenerate?: (packets: SimPacket[], message: string) => void;
}) {
  const live =
    stateRef.current.devices.find((d) => d.id === device.id) ?? device;
  const peers = useMemo(() => {
    return stateRef.current.devices
      .filter((d) => d.id !== live.id)
      .map((d) => {
        const ip =
          d.interfaces.find((i) => i.ip && !i.parentIfaceId)?.ip ?? null;
        return { id: d.id, name: d.name, ip };
      });
  }, [live.id, stateRef]);

  const [proto, setProto] = useState<Proto>("ICMP");
  const [dest, setDest] = useState(
    () => peers.find((p) => p.ip)?.ip ?? "192.168.1.100",
  );
  const [dnsName, setDnsName] = useState("www.lab");
  const [log, setLog] = useState<string[]>([]);

  function run() {
    const state = stateRef.current;
    let built: { packets: SimPacket[]; state: LabState; message: string };

    if (proto === "ICMP") {
      built = buildPingSimulation(state, live.id, dest.trim());
    } else if (proto === "HTTP") {
      built = buildHttpSimulation(state, live.id, dest.trim() || dnsName);
    } else if (proto === "DNS") {
      built = buildDnsSimulation(state, live.id, dnsName.trim());
    } else if (proto === "PRINT") {
      built = buildPrintSimulation(state, live.id, dest.trim());
    } else {
      built = buildDhcpSimulation(state, live.id);
    }

    stateRef.current = built.state;
    setState(built.state);
    const lines = [
      `[${new Date().toLocaleTimeString("it-IT", { timeZone: "Europe/Rome" })}] ${proto} → ${
        proto === "DNS" ? dnsName : proto === "DHCP" ? "(broadcast)" : dest
      }`,
      built.message,
      ...built.packets.map(
        (p) => `  · ${p.kind} ${p.label}: ${p.detail} (${p.ok ? "OK" : "FAIL"})`,
      ),
      "",
    ];
    setLog((prev) => [...lines, ...prev].slice(0, 80));
    onGenerate?.(built.packets, built.message);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f0f0f0] text-[12px] text-black">
      <div className="flex items-center justify-between border-b border-[#aca899] bg-gradient-to-b from-[#0a246a] to-[#a6caf0] px-2 py-1 text-white">
        <span className="font-semibold">Traffic Generator — {live.name}</span>
        <button type="button" className="px-2 hover:bg-rose-600" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="grid gap-2 border-b border-[#aca899] bg-[#ece9d8] p-3 sm:grid-cols-2">
        <label className="flex flex-col gap-0.5">
          <span className="font-semibold">Application</span>
          <select
            className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5"
            value={proto}
            onChange={(e) => setProto(e.target.value as Proto)}
          >
            <option value="ICMP">ICMP (Ping)</option>
            <option value="HTTP">HTTP</option>
            <option value="DNS">DNS</option>
            <option value="PRINT">PRINT (LPR)</option>
            <option value="DHCP">DHCP</option>
          </select>
        </label>

        {proto !== "DHCP" && proto !== "DNS" && (
          <label className="flex flex-col gap-0.5">
            <span className="font-semibold">Destination IP / host</span>
            <input
              className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 font-mono"
              value={dest}
              onChange={(e) => setDest(e.target.value)}
              list="tg-peers"
            />
            <datalist id="tg-peers">
              {peers.map((p) => (
                <option
                  key={p.id}
                  value={p.ip ?? p.name}
                  label={`${p.name}${p.ip ? ` (${p.ip})` : ""}`}
                />
              ))}
            </datalist>
          </label>
        )}

        {(proto === "DNS" || proto === "HTTP") && (
          <label className="flex flex-col gap-0.5">
            <span className="font-semibold">
              {proto === "DNS" ? "Nome da risolvere" : "Host HTTP (opz.)"}
            </span>
            <input
              className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 font-mono"
              value={dnsName}
              onChange={(e) => setDnsName(e.target.value)}
            />
          </label>
        )}

        <div className="flex items-end sm:col-span-2">
          <button
            type="button"
            className="rounded-none border border-[#003c74] bg-[#ece9d8] px-3 py-1 font-semibold hover:bg-white"
            onClick={run}
          >
            Generate PDU
          </button>
          <span className="ml-3 text-[11px] text-[#555]">
            I pacchetti compaiono sul canvas (animazione Simulation).
          </span>
        </div>
      </div>

      <pre className="min-h-0 flex-1 overflow-auto bg-white p-3 font-mono text-[11px] text-[#222]">
        {log.length === 0
          ? "Nessun PDU generato.\nScegli Application e Destination, poi Generate PDU."
          : log.join("\n")}
      </pre>
    </div>
  );
}
