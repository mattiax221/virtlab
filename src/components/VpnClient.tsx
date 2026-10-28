"use client";

import { useState } from "react";
import { runPing } from "@/lib/network/engine";
import type { Device, LabState } from "@/lib/network/types";

/**
 * VPN Desktop utility (Packet Tracer style).
 */
export function VpnClient({
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
  const [groupName, setGroupName] = useState(
    live.vpn?.groupName ?? "netlab",
  );
  const [groupKey, setGroupKey] = useState("cisco");
  const [hostIp, setHostIp] = useState(live.vpn?.serverIp ?? "192.168.1.100");
  const [username, setUsername] = useState(live.vpn?.username ?? "vpnuser");
  const [password, setPassword] = useState("cisco");
  const [status, setStatus] = useState(
    live.vpn?.connected
      ? `Tunnel UP — ${live.vpn.virtualIp ?? "?"}`
      : "Tunnel DOWN.",
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
    const { result, state } = runPing(stateRef.current, live.id, hostIp);
    stateRef.current = state;
    setState(state);
    if (!result.ok) {
      setStatus(`VPN fallita: ${hostIp} non raggiungibile.`);
      return;
    }
    if (groupKey !== "cisco" || password !== "cisco") {
      setStatus("Autenticazione di gruppo / utente fallita (key/pass: cisco).");
      return;
    }
    const virtualIp = `172.16.${Math.floor(Math.random() * 20)}.${Math.floor(Math.random() * 200) + 10}`;
    commit({
      ...live,
      vpn: {
        connected: true,
        serverIp: hostIp,
        groupName,
        username,
        virtualIp,
      },
    });
    setStatus(
      `Tunnel UP verso ${hostIp} (gruppo ${groupName}) · IP ${virtualIp}`,
    );
  }

  function disconnect() {
    commit({
      ...live,
      vpn: live.vpn
        ? { ...live.vpn, connected: false, virtualIp: undefined }
        : undefined,
    });
    setStatus("Tunnel DOWN.");
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f0f0f0] text-[12px] text-black">
      <div className="flex items-center justify-between border-b border-[#aca899] bg-gradient-to-b from-[#0a246a] to-[#a6caf0] px-2 py-1 text-white">
        <span className="font-semibold">VPN — {live.name}</span>
        <button type="button" className="px-2 hover:bg-rose-600" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="grid gap-2 p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-0.5">
          GroupName
          <input
            className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Group Key
          <input
            className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5"
            value={groupKey}
            onChange={(e) => setGroupKey(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-0.5 sm:col-span-2">
          Host IP (Server)
          <input
            className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 font-mono"
            value={hostIp}
            onChange={(e) => setHostIp(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Username
          <input
            className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
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
        <div className="flex gap-2 sm:col-span-2">
          <button
            type="button"
            className="rounded-none border border-[#003c74] bg-[#ece9d8] px-3 py-1 hover:bg-white disabled:opacity-50"
            disabled={!!live.vpn?.connected}
            onClick={connect}
          >
            Connect
          </button>
          <button
            type="button"
            className="rounded-none border border-[#003c74] bg-[#ece9d8] px-3 py-1 hover:bg-white disabled:opacity-50"
            disabled={!live.vpn?.connected}
            onClick={disconnect}
          >
            Disconnect
          </button>
        </div>
        <p className="text-[11px] text-[#555] sm:col-span-2">{status}</p>
      </div>
    </div>
  );
}
