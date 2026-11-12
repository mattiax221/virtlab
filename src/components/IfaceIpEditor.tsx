"use client";

import { useState } from "react";
import { updateIface } from "@/lib/network/engine";
import { isValidIp, parseMask } from "@/lib/network/ip";
import { releaseDhcp, requestDhcp } from "@/lib/network/services";
import type { Device, InterfaceConfig, LabState } from "@/lib/network/types";

const inputCls =
  "w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 font-mono text-slate-100 outline-none focus:border-cyan-500 disabled:opacity-50";

export function IfaceIpEditor({
  device,
  stateRef,
  setState,
}: {
  device: Device;
  stateRef: React.MutableRefObject<LabState>;
  setState: (next: LabState) => void;
}) {
  const ifaces = device.interfaces.filter((i) => !i.parentIfaceId);
  const [ifaceId, setIfaceId] = useState(ifaces[0]?.id ?? "");
  const iface = ifaces.find((i) => i.id === ifaceId) ?? ifaces[0];

  function applyState(next: LabState) {
    stateRef.current = next;
    setState(next);
  }

  function toggleEnabled(on: boolean) {
    if (!iface) return;
    applyState(updateIface(stateRef.current, device.id, iface.id, { enabled: on }));
  }

  if (ifaces.length === 0 || !iface) {
    return (
      <p className="text-sm text-slate-500">
        Nessuna interfaccia su questo dispositivo. Aggiungine una da Physical.
      </p>
    );
  }

  const linkUp = Boolean(iface.enabled && iface.connectedLinkId);
  const formKey = [
    iface.id,
    iface.dhcpClient ? "dhcp" : "static",
    iface.ip ?? "",
    iface.mask ?? "",
    iface.gateway ?? "",
    iface.dnsServers?.[0] ?? "",
  ].join("|");

  return (
    <div className="space-y-3 text-sm">
      <label className="block space-y-1">
        <span className="text-[11px] text-slate-400">Interfaccia</span>
        <select
          value={iface.id}
          onChange={(e) => setIfaceId(e.target.value)}
          className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-slate-100"
        >
          {ifaces.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} · {i.media}
            </option>
          ))}
        </select>
      </label>

      <p className="text-[11px] text-slate-500">
        Link{" "}
        <span className={linkUp ? "text-emerald-300" : "text-slate-400"}>
          {linkUp ? "up" : iface.enabled ? "down" : "shutdown"}
        </span>
        {" · "}MAC <span className="font-mono text-slate-400">{iface.mac}</span>
      </p>

      <label className="flex items-center gap-2 text-slate-300">
        <input
          type="checkbox"
          checked={iface.enabled}
          onChange={(e) => toggleEnabled(e.target.checked)}
        />
        Interfaccia attiva (no shutdown)
      </label>

      <IfaceIpForm
        key={formKey}
        deviceId={device.id}
        iface={iface}
        stateRef={stateRef}
        setState={setState}
      />
    </div>
  );
}

function IfaceIpForm({
  deviceId,
  iface,
  stateRef,
  setState,
}: {
  deviceId: string;
  iface: InterfaceConfig;
  stateRef: React.MutableRefObject<LabState>;
  setState: (next: LabState) => void;
}) {
  const [dhcp, setDhcp] = useState(Boolean(iface.dhcpClient));
  const [ip, setIp] = useState(iface.ip ?? "");
  const [mask, setMask] = useState(iface.mask ?? "255.255.255.0");
  const [gw, setGw] = useState(iface.gateway ?? "");
  const [dns, setDns] = useState(iface.dnsServers?.[0] ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  function applyState(next: LabState) {
    stateRef.current = next;
    setState(next);
  }

  function applyIp() {
    if (dhcp) {
      const res = requestDhcp(stateRef.current, deviceId, iface.id);
      applyState(res.state);
      setMsg(res.message);
      return;
    }
    if (!isValidIp(ip)) {
      setMsg("Indirizzo IP non valido.");
      return;
    }
    if (parseMask(mask) === null) {
      setMsg("Subnet mask non valida.");
      return;
    }
    if (gw.trim() && !isValidIp(gw.trim())) {
      setMsg("Gateway non valido.");
      return;
    }
    if (dns.trim() && !isValidIp(dns.trim())) {
      setMsg("DNS non valido.");
      return;
    }
    const next = updateIface(stateRef.current, deviceId, iface.id, {
      ip: ip.trim(),
      mask: mask.trim(),
      gateway: gw.trim() ? gw.trim() : null,
      dhcpClient: false,
      dnsServers: dns.trim() ? [dns.trim()] : [],
    });
    applyState(next);
    setMsg(`IP statico applicato su ${iface.name}.`);
  }

  function doRelease() {
    const res = releaseDhcp(stateRef.current, deviceId, iface.id);
    applyState(res.state);
    setMsg(res.message);
  }

  return (
    <>
      <label className="flex items-center gap-2 text-slate-300">
        <input type="radio" checked={dhcp} onChange={() => setDhcp(true)} />
        DHCP (automatico)
      </label>
      <label className="flex items-center gap-2 text-slate-300">
        <input type="radio" checked={!dhcp} onChange={() => setDhcp(false)} />
        IP statico
      </label>

      <div className={`grid gap-3 sm:grid-cols-2 ${dhcp ? "opacity-60" : ""}`}>
        <Field label="Indirizzo IP">
          <input
            disabled={dhcp}
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="192.168.1.1"
            className={inputCls}
          />
        </Field>
        <Field label="Subnet mask">
          <input
            disabled={dhcp}
            value={mask}
            onChange={(e) => setMask(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Gateway">
          <input
            disabled={dhcp}
            value={gw}
            onChange={(e) => setGw(e.target.value)}
            placeholder="opzionale"
            className={inputCls}
          />
        </Field>
        <Field label="DNS">
          <input
            disabled={dhcp}
            value={dns}
            onChange={(e) => setDns(e.target.value)}
            placeholder="opzionale"
            className={inputCls}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={applyIp}
          className="rounded bg-cyan-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-600"
        >
          {dhcp ? "Richiedi DHCP" : "Applica IP"}
        </button>
        {dhcp && (
          <button
            type="button"
            onClick={doRelease}
            className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            Rilascia
          </button>
        )}
      </div>

      {msg && (
        <p className="rounded border border-cyan-500/30 bg-cyan-950/40 px-2 py-1.5 text-[11px] text-cyan-100">
          {msg}
        </p>
      )}
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] text-slate-400">{label}</span>
      {children}
    </label>
  );
}
