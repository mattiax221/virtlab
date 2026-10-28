"use client";

import { useMemo, useState } from "react";
import { runPing } from "@/lib/network/engine";
import { isEndHost, type Device, type LabState } from "@/lib/network/types";
/**
 * Desktop Remoto stile Packet Tracer: collega a un altro PC/Server raggiungibile.
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
  const peers = useMemo(() => {
    return stateRef.current.devices
      .filter(
        (d) =>
          d.id !== device.id &&
          d.powered &&
          isEndHost(d.type),
      )
      .map((d) => ({
        device: d,
        ip:
          d.interfaces.find((i) => i.ip && !i.parentIfaceId)?.ip ?? null,
      }));
  }, [device.id, stateRef]);

  const [ip, setIp] = useState(() => peers.find((p) => p.ip)?.ip ?? "");
  const [status, setStatus] = useState("Inserisci l’IP del PC/Server remoto.");

  function connect(targetIp?: string) {
    const dest = (targetIp ?? ip).trim();
    if (!dest) {
      setStatus("Specificare un indirizzo IP.");
      return;
    }
    const { result, state } = runPing(stateRef.current, device.id, dest);
    stateRef.current = state;
    setState(state);
    if (!result.ok) {
      setStatus(`Connessione Remote Desktop fallita — ${dest} non raggiungibile.`);
      return;
    }
    const target = state.devices.find(
      (d) =>
        isEndHost(d.type) &&
        d.interfaces.some((i) => i.ip === dest),
    );
    if (!target) {
      setStatus(`Nessun Desktop su ${dest} (solo PC/Laptop/Server).`);
      return;
    }
    if (!target.powered) {
      setStatus(`${target.name} è spento.`);
      return;
    }
    setStatus(`Connesso a ${target.name} (${dest})…`);
    onOpenRemote(target);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f0f0f0] text-[12px] text-black">
      <div className="flex items-center justify-between border-b border-[#aca899] bg-gradient-to-b from-[#0a246a] to-[#a6caf0] px-2 py-1 text-white">
        <span className="font-semibold">Remote Desktop — {device.name}</span>
        <button type="button" className="px-2 hover:bg-rose-600" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="space-y-3 p-4">
        <p className="text-[11px] text-[#555]">
          Come in Packet Tracer: digita l’IP di un altro PC/Server sulla rete e
          apri il suo Desktop.
        </p>
        <label className="flex flex-col gap-0.5">
          Indirizzo IP
          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-none border border-[#7f9db9] bg-white px-2 py-1 font-mono"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") connect();
              }}
              placeholder="192.168.1.10"
              list="rdp-peers"
            />
            <datalist id="rdp-peers">
              {peers.map((p) =>
                p.ip ? (
                  <option key={p.device.id} value={p.ip}>
                    {p.device.name}
                  </option>
                ) : null,
              )}
            </datalist>
            <button
              type="button"
              className="rounded-none border border-[#003c74] bg-[#ece9d8] px-3 py-1 font-semibold hover:bg-white"
              onClick={() => connect()}
            >
              Connect
            </button>
          </div>
        </label>
        <p className="text-[11px] text-[#666]">{status}</p>
        {peers.length > 0 && (
          <div>
            <div className="mb-1 font-semibold">Host rilevati</div>
            <ul className="divide-y divide-[#ddd] rounded border border-[#aca899] bg-white">
              {peers.map((p) => (
                <li key={p.device.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[#e8f0fe] disabled:opacity-40"
                    disabled={!p.ip}
                    onClick={() => {
                      if (p.ip) {
                        setIp(p.ip);
                        connect(p.ip);
                      }
                    }}
                  >
                    <span>{p.device.name}</span>
                    <span className="font-mono text-[11px] text-[#555]">
                      {p.ip ?? "(senza IP)"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
