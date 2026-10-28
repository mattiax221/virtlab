"use client";

import { useEffect, useState } from "react";
import { setDevicePower, updateDevice, updateIface } from "@/lib/network/engine";
import { isValidIp, parseMask } from "@/lib/network/ip";
import { requestDhcp, releaseDhcp } from "@/lib/network/services";
import type { Device, LabState, PrinterService } from "@/lib/network/types";
import { PhysicalPanel } from "./PhysicalPanel";

type Tab = "config" | "physical" | "services";

function defaultPrinterService(name: string): PrinterService {
  return {
    enabled: true,
    shareName: name.replace(/\s+/g, "_"),
    location: "Lab",
    paper: "A4",
    queue: [],
  };
}

export function PrinterPanel({
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
  const iface =
    live.interfaces.find(
      (i) =>
        !i.parentIfaceId &&
        (i.media === "ethernet" || i.media === "fiber"),
    ) ?? live.interfaces.find((i) => !i.parentIfaceId);
  const svc = live.printerService ?? defaultPrinterService(live.name);

  const [tab, setTab] = useState<Tab>("config");
  const [name, setName] = useState(live.name);
  const [dhcp, setDhcp] = useState(Boolean(iface?.dhcpClient) || !iface?.ip);
  const [ip, setIp] = useState(iface?.ip ?? "");
  const [mask, setMask] = useState(iface?.mask ?? "255.255.255.0");
  const [gw, setGw] = useState(iface?.gateway ?? "");
  const [dns, setDns] = useState(iface?.dnsServers?.[0] ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [shareName, setShareName] = useState(svc.shareName);
  const [location, setLocation] = useState(svc.location ?? "");
  const [paper, setPaper] = useState(svc.paper ?? "A4");

  useEffect(() => {
    const d =
      stateRef.current.devices.find((x) => x.id === device.id) ?? device;
    const i =
      d.interfaces.find(
        (x) =>
          !x.parentIfaceId &&
          (x.media === "ethernet" || x.media === "fiber"),
      ) ?? d.interfaces.find((x) => !x.parentIfaceId);
    setName(d.name);
    setDhcp(Boolean(i?.dhcpClient) || !i?.ip);
    setIp(i?.ip ?? "");
    setMask(i?.mask ?? "255.255.255.0");
    setGw(i?.gateway ?? "");
    setDns(i?.dnsServers?.[0] ?? "");
    const s = d.printerService ?? defaultPrinterService(d.name);
    setShareName(s.shareName);
    setLocation(s.location ?? "");
    setPaper(s.paper ?? "A4");
  }, [device.id, stateRef, live.powered, iface?.ip, iface?.dhcpClient]);

  function applyName() {
    const next = updateDevice(stateRef.current, device.id, {
      name: name.trim() || live.name,
    });
    stateRef.current = next;
    setState(next);
    setMsg("Nome aggiornato.");
  }

  function applyIp() {
    if (!iface) {
      setMsg("Nessuna interfaccia Ethernet.");
      return;
    }
    if (dhcp) {
      const res = requestDhcp(stateRef.current, device.id, iface.id);
      stateRef.current = res.state;
      setState(res.state);
      const d = res.state.devices.find((x) => x.id === device.id);
      const i = d?.interfaces.find((x) => x.id === iface.id);
      setIp(i?.ip ?? "");
      setMask(i?.mask ?? mask);
      setGw(i?.gateway ?? "");
      setMsg(res.message);
      return;
    }
    if (!isValidIp(ip)) {
      setMsg("IP non valido.");
      return;
    }
    if (parseMask(mask) === null) {
      setMsg("Maschera non valida.");
      return;
    }
    if (gw && !isValidIp(gw)) {
      setMsg("Gateway non valido.");
      return;
    }
    const next = updateIface(stateRef.current, device.id, iface.id, {
      ip,
      mask,
      gateway: gw || undefined,
      dnsServers: dns && isValidIp(dns) ? [dns] : [],
      dhcpClient: false,
    });
    stateRef.current = next;
    setState(next);
    setMsg(
      iface.connectedLinkId
        ? `IP ${ip} applicato su ${iface.name}.`
        : `IP ${ip} salvato — collega un cavo Ethernet allo switch.`,
    );
  }

  function doRelease() {
    if (!iface) return;
    const res = releaseDhcp(stateRef.current, device.id, iface.id);
    stateRef.current = res.state;
    setState(res.state);
    setIp("");
    setMsg(res.message);
  }

  function applyService() {
    const next = updateDevice(stateRef.current, device.id, {
      printerService: {
        ...svc,
        enabled: true,
        shareName: shareName.trim() || live.name,
        location: location.trim() || undefined,
        paper,
      },
    });
    stateRef.current = next;
    setState(next);
    setMsg("Servizio di stampa aggiornato.");
  }

  function clearQueue() {
    const next = updateDevice(stateRef.current, device.id, {
      printerService: { ...svc, queue: [] },
    });
    stateRef.current = next;
    setState(next);
  }

  function togglePower() {
    const next = setDevicePower(stateRef.current, device.id, !live.powered);
    stateRef.current = next;
    setState(next);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "config", label: "Config" },
    { id: "physical", label: "Physical" },
    { id: "services", label: "Services" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:p-6">
      <div className="flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden border-0 border-slate-600 bg-[#f3f3f3] shadow-2xl sm:h-[min(640px,92vh)] sm:rounded-lg sm:border">
        <div className="flex items-center justify-between bg-slate-800 px-3 py-2 text-sm text-slate-100">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${live.powered ? "bg-emerald-400" : "bg-slate-500"}`}
            />
            <span className="font-medium">Printer — {live.name}</span>
            <span className="hidden text-slate-400 sm:inline">
              · Printer-PT
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 hover:bg-rose-600"
          >
            Chiudi
          </button>
        </div>

        <div className="flex gap-1 border-b border-[#aca899] bg-[#ece9d8] px-2 pt-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-t px-3 py-1.5 text-xs font-medium ${
                tab === t.id
                  ? "bg-white text-slate-900"
                  : "text-slate-600 hover:bg-white/60"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white p-4 text-[12px] text-black">
          {tab === "config" && (
            <div className="mx-auto max-w-lg space-y-5">
              <section className="space-y-2">
                <h3 className="border-b border-[#aca899] pb-1 text-[13px] font-semibold">
                  Global Settings
                </h3>
                <label className="flex items-center gap-2">
                  <span className="w-24 text-[#333]">Display Name</span>
                  <input
                    className="min-w-0 flex-1 rounded border border-[#7a9cbc] px-2 py-1"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <button
                    type="button"
                    className="rounded border border-[#aca899] bg-[#ece9d8] px-2 py-1 hover:bg-white"
                    onClick={applyName}
                  >
                    Apply
                  </button>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-24 text-[#333]">Power</span>
                  <button
                    type="button"
                    className={`rounded px-3 py-1 text-white ${live.powered ? "bg-emerald-700" : "bg-slate-500"}`}
                    onClick={togglePower}
                  >
                    {live.powered ? "On" : "Off"}
                  </button>
                </label>
              </section>

              <section className="space-y-2">
                <h3 className="border-b border-[#aca899] pb-1 text-[13px] font-semibold">
                  IP Configuration
                </h3>
                <p className="text-[11px] text-[#555]">
                  Porta:{" "}
                  <span className="font-mono">
                    {iface?.name ?? "—"}
                  </span>{" "}
                  · link{" "}
                  {iface?.connectedLinkId ? (
                    <span className="text-emerald-700">up</span>
                  ) : (
                    <span className="text-rose-700">down</span>
                  )}{" "}
                  · MAC{" "}
                  <span className="font-mono">{iface?.mac ?? "—"}</span>
                </p>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={dhcp}
                    onChange={() => setDhcp(true)}
                  />
                  DHCP
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={!dhcp}
                    onChange={() => setDhcp(false)}
                  />
                  Static
                </label>
                <div
                  className={`grid gap-2 sm:grid-cols-2 ${dhcp ? "opacity-50" : ""}`}
                >
                  <label className="flex flex-col gap-0.5">
                    IP Address
                    <input
                      disabled={dhcp}
                      className="rounded border border-[#7a9cbc] px-2 py-1 font-mono disabled:bg-[#eee]"
                      value={ip}
                      onChange={(e) => setIp(e.target.value)}
                      placeholder="192.168.1.50"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    Subnet Mask
                    <input
                      disabled={dhcp}
                      className="rounded border border-[#7a9cbc] px-2 py-1 font-mono disabled:bg-[#eee]"
                      value={mask}
                      onChange={(e) => setMask(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    Default Gateway
                    <input
                      disabled={dhcp}
                      className="rounded border border-[#7a9cbc] px-2 py-1 font-mono disabled:bg-[#eee]"
                      value={gw}
                      onChange={(e) => setGw(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    DNS Server
                    <input
                      disabled={dhcp}
                      className="rounded border border-[#7a9cbc] px-2 py-1 font-mono disabled:bg-[#eee]"
                      value={dns}
                      onChange={(e) => setDns(e.target.value)}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    className="rounded border border-[#aca899] bg-[#ece9d8] px-3 py-1.5 font-medium hover:bg-white"
                    onClick={applyIp}
                  >
                    {dhcp ? "DHCP Request" : "Apply"}
                  </button>
                  {dhcp && (
                    <button
                      type="button"
                      className="rounded border border-[#aca899] bg-white px-3 py-1.5 hover:bg-[#ece9d8]"
                      onClick={doRelease}
                    >
                      Release
                    </button>
                  )}
                </div>
              </section>

              {msg && (
                <p className="rounded border border-sky-300 bg-sky-50 px-2 py-1.5 text-[11px] text-sky-900">
                  {msg}
                </p>
              )}
            </div>
          )}

          {tab === "physical" && (
            <PhysicalPanel
              device={device}
              stateRef={stateRef}
              setState={setState}
            />
          )}

          {tab === "services" && (
            <div className="mx-auto max-w-lg space-y-4">
              <h3 className="border-b border-[#aca899] pb-1 text-[13px] font-semibold">
                PRINT Service
              </h3>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={svc.enabled}
                  onChange={(e) => {
                    const next = updateDevice(stateRef.current, device.id, {
                      printerService: {
                        ...svc,
                        enabled: e.target.checked,
                      },
                    });
                    stateRef.current = next;
                    setState(next);
                  }}
                />
                Service On
              </label>
              <label className="flex flex-col gap-0.5">
                Share Name
                <input
                  className="rounded border border-[#7a9cbc] px-2 py-1"
                  value={shareName}
                  onChange={(e) => setShareName(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                Location
                <input
                  className="rounded border border-[#7a9cbc] px-2 py-1"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                Paper
                <select
                  className="rounded border border-[#7a9cbc] px-2 py-1"
                  value={paper}
                  onChange={(e) => setPaper(e.target.value)}
                >
                  <option>A4</option>
                  <option>Letter</option>
                  <option>Legal</option>
                </select>
              </label>
              <button
                type="button"
                className="rounded border border-[#aca899] bg-[#ece9d8] px-3 py-1.5 hover:bg-white"
                onClick={applyService}
              >
                Apply
              </button>
              <p className="text-[11px] text-[#555]">
                Dai PC:{" "}
                <code className="rounded bg-[#eee] px-1">
                  print {iface?.ip || "&lt;ip&gt;"}
                </code>{" "}
                o{" "}
                <code className="rounded bg-[#eee] px-1">
                  lpr {iface?.ip || "&lt;ip&gt;"}
                </code>{" "}
                (dopo ping).
              </p>

              <div className="flex items-center justify-between border-b border-[#aca899] pb-1">
                <h4 className="font-semibold">Print Queue ({svc.queue.length})</h4>
                <button
                  type="button"
                  className="text-[11px] text-rose-700 hover:underline"
                  onClick={clearQueue}
                >
                  Clear
                </button>
              </div>
              {svc.queue.length === 0 ? (
                <p className="text-[#777]">Coda vuota.</p>
              ) : (
                <ul className="space-y-1">
                  {svc.queue.map((j) => (
                    <li
                      key={j.id}
                      className="rounded border border-[#ddd] bg-[#fafafa] px-2 py-1 font-mono text-[11px]"
                    >
                      #{j.id.slice(-4)} · {j.from} · {j.pages} pg · {j.status} ·{" "}
                      {j.at}
                    </li>
                  ))}
                </ul>
              )}
              {msg && (
                <p className="rounded border border-sky-300 bg-sky-50 px-2 py-1.5 text-[11px] text-sky-900">
                  {msg}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
