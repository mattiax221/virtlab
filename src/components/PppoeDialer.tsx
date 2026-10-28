"use client";

import { useState } from "react";
import { runPing } from "@/lib/network/engine";
import type { Device, LabState } from "@/lib/network/types";

/**
 * PPPoE Dialer Desktop utility (Packet Tracer style).
 */
export function PppoeDialer({
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
  const [user, setUser] = useState(live.pppoe?.username ?? "cisco");
  const [password, setPassword] = useState("cisco");
  const [serverIp, setServerIp] = useState(
    live.pppoe?.serverIp ?? "192.168.1.100",
  );
  const [status, setStatus] = useState(
    live.pppoe?.connected
      ? `Connesso — IP virtuale ${live.pppoe.virtualIp ?? "?"}`
      : "Disconnesso.",
  );

  function commit(nextDev: Device) {
    const next = {
      ...stateRef.current,
      devices: stateRef.current.devices.map((d) =>
        d.id === live.id ? nextDev : d,
      ),
    };
    stateRef.current = next;
    setState(next);
  }

  function connect() {
    const { result, state } = runPing(stateRef.current, live.id, serverIp);
    stateRef.current = state;
    setState(state);
    if (!result.ok) {
      setStatus(`Connessione fallita: host ${serverIp} non raggiungibile.`);
      return;
    }
    if (password !== "cisco" && password !== "admin") {
      setStatus("Autenticazione PPPoE fallita (prova cisco).");
      return;
    }
    const virtualIp = `10.10.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 2}`;
    commit({
      ...live,
      pppoe: {
        connected: true,
        serverIp,
        username: user,
        virtualIp,
      },
    });
    setStatus(`Connesso a ${serverIp} come ${user} · IP ${virtualIp}`);
  }

  function disconnect() {
    commit({
      ...live,
      pppoe: live.pppoe
        ? { ...live.pppoe, connected: false, virtualIp: undefined }
        : undefined,
    });
    setStatus("Disconnesso.");
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f0f0f0] text-[12px] text-black">
      <div className="flex items-center justify-between border-b border-[#aca899] bg-gradient-to-b from-[#0a246a] to-[#a6caf0] px-2 py-1 text-white">
        <span className="font-semibold">PPPoE Dialer — {live.name}</span>
        <button type="button" className="px-2 hover:bg-rose-600" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="space-y-2 p-4">
        <label className="flex flex-col gap-0.5">
          Server / concentrator IP
          <input
            className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 font-mono"
            value={serverIp}
            onChange={(e) => setServerIp(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          User Name
          <input
            className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5"
            value={user}
            onChange={(e) => setUser(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Password
          <input
            type="password"
            className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            className="rounded-none border border-[#003c74] bg-[#ece9d8] px-3 py-1 hover:bg-white disabled:opacity-50"
            disabled={!!live.pppoe?.connected}
            onClick={connect}
          >
            Connect
          </button>
          <button
            type="button"
            className="rounded-none border border-[#003c74] bg-[#ece9d8] px-3 py-1 hover:bg-white disabled:opacity-50"
            disabled={!live.pppoe?.connected}
            onClick={disconnect}
          >
            Disconnect
          </button>
        </div>
        <p className="text-[11px] text-[#555]">{status}</p>
      </div>
    </div>
  );
}
