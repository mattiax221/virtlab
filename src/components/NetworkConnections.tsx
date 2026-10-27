"use client";

import { useEffect, useMemo, useState } from "react";
import { updateIface } from "@/lib/network/engine";
import { requestDhcp } from "@/lib/network/services";
import type { Device, LabState } from "@/lib/network/types";

type View = "folder" | "adapter" | "tcpip";

const COMPONENTS = [
  { id: "client", label: "Client per reti Microsoft", checked: true, desc: "Consente al computer di accedere alle risorse in una rete Microsoft." },
  { id: "share", label: "Condivisione file e stampanti per reti Microsoft", checked: true, desc: "Consente ad altri computer di accedere alle risorse di questo computer." },
  { id: "qos", label: "Utilità di pianificazione pacchetti QoS", checked: true, desc: "Fornisce il controllo del traffico di rete." },
  { id: "ipv4", label: "Protocollo Internet versione 4 (TCP/IPv4)", checked: true, desc: "Protocollo predefinito TCP/IP di Internet. Occorre installarlo per accedere a Internet." },
  { id: "mux", label: "Protocollo Microsoft Network Adapter Multiplexor", checked: false, desc: "Consente di aggregare più schede di rete." },
  { id: "lldp", label: "Driver protocollo LLDP Microsoft", checked: true, desc: "Driver per il protocollo Link Layer Discovery." },
  { id: "ipv6", label: "Protocollo Internet versione 6 (TCP/IPv6)", checked: true, desc: "Successore del Protocollo Internet (IP) e supporta l'indirizzamento a 128 bit." },
] as const;

function QuadIp({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const parts = useMemo(() => {
    const p = (value || "...").split(".");
    while (p.length < 4) p.push("");
    return p.slice(0, 4).map((x) => (x === "" ? "" : x.replace(/\D/g, "").slice(0, 3)));
  }, [value]);

  function setPart(i: number, raw: string) {
    const next = [...parts];
    next[i] = raw.replace(/\D/g, "").slice(0, 3);
    onChange(next.join("."));
  }

  return (
    <div
      className={`inline-flex items-center border border-[#7a9cbc] bg-white px-0.5 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      {parts.map((p, i) => (
        <span key={i} className="flex items-center">
          <input
            disabled={disabled}
            value={p}
            maxLength={3}
            onChange={(e) => setPart(i, e.target.value)}
            className="w-8 bg-transparent px-0.5 py-0.5 text-center text-[12px] text-black outline-none disabled:cursor-not-allowed"
          />
          {i < 3 && <span className="text-[12px] text-black">.</span>}
        </span>
      ))}
    </div>
  );
}

export function NetworkConnections({
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
  const adapters = live.interfaces.filter((i) => !i.parentIfaceId);
  const [ifaceId, setIfaceId] = useState(adapters[0]?.id ?? "");
  const iface = adapters.find((i) => i.id === ifaceId) ?? adapters[0];
  const linked = Boolean(iface?.connectedLinkId);

  const [view, setView] = useState<View>("folder");
  const [selectedComp, setSelectedComp] = useState<string>("ipv4");
  const [dhcp, setDhcp] = useState(!iface?.ip);
  const [ip, setIp] = useState(iface?.ip ?? "");
  const [mask, setMask] = useState(iface?.mask ?? "255.255.255.0");
  const [gw, setGw] = useState(iface?.gateway ?? "");
  const [dns, setDns] = useState("");
  const [dnsAuto, setDnsAuto] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const d =
      stateRef.current.devices.find((x) => x.id === device.id) ?? device;
    const list = d.interfaces.filter((i) => !i.parentIfaceId);
    const i = list.find((x) => x.id === ifaceId) ?? list[0];
    if (i && i.id !== ifaceId) setIfaceId(i.id);
    setDhcp(!i?.ip);
    setIp(i?.ip ?? "");
    setMask(i?.mask ?? "255.255.255.0");
    setGw(i?.gateway ?? "");
  }, [device, stateRef, view, ifaceId]);

  const adapterName =
    iface?.media === "wireless"
      ? "Wi-Fi"
      : iface?.name?.startsWith("Gigabit")
        ? "Ethernet"
        : iface?.name ?? "Ethernet";
  const adapterDriver =
    iface?.media === "wireless"
      ? "NetLab Wireless Adapter 802.11n"
      : "NetLab Virtual Ethernet Adapter";

  function applyTcpIp() {
    if (!iface) return;
    if (dhcp) {
      const res = requestDhcp(stateRef.current, device.id, iface.id);
      stateRef.current = res.state;
      setState(res.state);
      setToast(res.message);
      if (res.ok) {
        const d =
          res.state.devices.find((x) => x.id === device.id) ?? device;
        const i = d.interfaces.find((x) => x.id === iface.id);
        setIp(i?.ip ?? "");
        setMask(i?.mask ?? "255.255.255.0");
        setGw(i?.gateway ?? "");
        setDns(i?.dnsServers?.[0] ?? "");
      }
      setView("adapter");
      return;
    }
    const parts = ip.split(".");
    if (parts.length !== 4 || parts.some((p) => p === "" || Number(p) > 255)) {
      setToast("Indirizzo IP non valido.");
      return;
    }
    const mParts = mask.split(".");
    if (mParts.length !== 4 || mParts.some((p) => p === "" || Number(p) > 255)) {
      setToast("Subnet mask non valida.");
      return;
    }
    if (gw) {
      const gParts = gw.split(".");
      if (gParts.length !== 4 || gParts.some((p) => p === "" || Number(p) > 255)) {
        setToast("Gateway non valido.");
        return;
      }
    }
    const dnsList = !dnsAuto && dns.trim() ? [dns.trim()] : [];
    const next = updateIface(stateRef.current, device.id, iface.id, {
      ip,
      mask,
      gateway: gw || null,
      dhcpClient: false,
      dnsServers: dnsList,
    });
    stateRef.current = next;
    setState(next);
    setToast(`IP statico: ${ip}`);
    setView("adapter");
  }

  const selectedMeta = COMPONENTS.find((c) => c.id === selectedComp);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f0f0f0] text-[12px] text-black" style={{ fontFamily: "Segoe UI, Tahoma, sans-serif" }}>
      {/* title bar of the explorer-like window */}
      <div className="flex items-center justify-between border-b border-[#d4d4d4] bg-gradient-to-b from-[#ffffff] to-[#f0f0f0] px-2 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold">
            {view === "folder" && "Connessioni di rete"}
            {view === "adapter" && `Proprietà - ${adapterName}`}
            {view === "tcpip" && "Proprietà - Protocollo Internet versione 4 (TCP/IPv4)"}
          </span>
        </div>
        <div className="flex gap-1">
          {view !== "folder" && (
            <button
              type="button"
              className="rounded px-2 py-0.5 text-[11px] hover:bg-[#e5f3ff]"
              onClick={() => setView(view === "tcpip" ? "adapter" : "folder")}
            >
              Indietro
            </button>
          )}
          <button
            type="button"
            className="rounded px-2 py-0.5 text-[11px] hover:bg-rose-500 hover:text-white"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
      </div>

      {view === "folder" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-[#d4d4d4] bg-[#fafafa] px-3 py-1 text-[11px] text-[#666]">
            Pannello di controllo ▸ Rete e Internet ▸ Connessioni di rete
          </div>
          <div className="flex-1 p-4">
            {adapters.length === 0 ? (
              <p className="text-[12px] text-[#666]">
                Nessuna scheda di rete. Apri <strong>Physical</strong>, spegni il PC e
                installa Ethernet o Wi‑Fi.
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {adapters.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onDoubleClick={() => {
                      setIfaceId(a.id);
                      setView("adapter");
                    }}
                    onClick={() => {
                      setIfaceId(a.id);
                      setView("adapter");
                    }}
                    className="flex w-40 flex-col items-center gap-1 rounded p-3 text-center hover:bg-[#cce8ff]"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-[#0078d4] text-white shadow">
                      {a.media === "wireless" ? (
                        <span className="text-lg">≈</span>
                      ) : (
                        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.7">
                          <circle cx="6" cy="12" r="2.2" fill="currentColor" stroke="none" />
                          <circle cx="18" cy="6" r="2.2" fill="currentColor" stroke="none" />
                          <circle cx="18" cy="18" r="2.2" fill="currentColor" stroke="none" />
                          <path d="M8 11.3 L15.6 7.2 M8 12.7 L15.6 16.8" />
                        </svg>
                      )}
                    </div>
                    <div className="font-medium">
                      {a.media === "wireless" ? "Wi-Fi" : "Ethernet"}
                    </div>
                    <div
                      className={`text-[10px] ${a.connectedLinkId ? "text-green-700" : "text-red-700"}`}
                    >
                      {a.connectedLinkId ? "Connessa" : "Scollegata"}
                    </div>
                    <div className="text-[10px] text-[#666]">
                      {a.ip ?? "Nessun IP"}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <p className="mt-6 max-w-md text-[11px] leading-relaxed text-[#555]">
              Schede da Physical (Ethernet / Wi‑Fi). Poi TCP/IPv4 per l’IP statico.
            </p>
          </div>
        </div>
      )}

      {view === "adapter" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex gap-1 border-b border-[#d4d4d4] px-2 pt-1">
            <div className="border border-b-0 border-[#d4d4d4] bg-white px-3 py-1 text-[12px]">
              Rete
            </div>
            <div className="px-3 py-1 text-[12px] text-[#888]">Condivisione</div>
          </div>
          <div className="flex-1 space-y-3 overflow-auto p-3">
            <div>
              <div className="mb-1 text-[11px]">Connetti tramite:</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 border border-[#7a9cbc] bg-white px-2 py-1">
                  {adapterDriver}
                </div>
                <button
                  type="button"
                  className="border border-[#adadad] bg-[#e1e1e1] px-3 py-1 hover:bg-[#d0d0d0]"
                >
                  Configura...
                </button>
              </div>
            </div>
            <div>
              <div className="mb-1 text-[11px]">
                La connessione utilizza gli elementi seguenti:
              </div>
              <div className="h-44 overflow-auto border border-[#7a9cbc] bg-white">
                {COMPONENTS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedComp(c.id)}
                    className={`flex w-full items-center gap-2 px-2 py-1 text-left ${
                      selectedComp === c.id ? "bg-[#0078d4] text-white" : "hover:bg-[#e5f3ff]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={c.checked}
                      readOnly
                      className="accent-[#0078d4]"
                    />
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <button type="button" className="border border-[#adadad] bg-[#e1e1e1] px-3 py-1">
                  Installa...
                </button>
                <button type="button" className="border border-[#adadad] bg-[#e1e1e1] px-3 py-1 opacity-50">
                  Disinstalla
                </button>
                <button
                  type="button"
                  disabled={selectedComp !== "ipv4"}
                  onClick={() => selectedComp === "ipv4" && setView("tcpip")}
                  className="border border-[#adadad] bg-[#e1e1e1] px-3 py-1 enabled:hover:bg-[#d0d0d0] disabled:opacity-40"
                >
                  Proprietà
                </button>
              </div>
            </div>
            <div>
              <div className="mb-1 text-[11px]">Descrizione</div>
              <div className="min-h-[48px] border border-[#d4d4d4] bg-[#f8f8f8] p-2 text-[11px] text-[#333]">
                {selectedMeta?.desc}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-[#d4d4d4] bg-[#f0f0f0] px-3 py-2">
            <button
              type="button"
              onClick={() => setView("folder")}
              className="min-w-[72px] border border-[#adadad] bg-[#e1e1e1] px-3 py-1 hover:bg-[#d0d0d0]"
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => setView("folder")}
              className="min-w-[72px] border border-[#adadad] bg-[#e1e1e1] px-3 py-1 hover:bg-[#d0d0d0]"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {view === "tcpip" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex gap-1 border-b border-[#d4d4d4] px-2 pt-1">
            <div className="border border-b-0 border-[#d4d4d4] bg-white px-3 py-1">
              Generale
            </div>
            <div className="px-3 py-1 text-[#888]">Configurazione alternativa</div>
          </div>
          <div className="flex-1 space-y-3 overflow-auto p-3">
            <p className="text-[11px] leading-relaxed text-[#333]">
              È possibile ottenere l&apos;assegnazione automatica delle impostazioni IP se
              la rete supporta tale caratteristica. In caso contrario, sarà necessario
              richiedere all&apos;amministratore di rete le impostazioni IP corrette.
            </p>

            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={dhcp}
                onChange={() => setDhcp(true)}
                name="ipmode"
              />
              Ottieni automaticamente un indirizzo IP
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={!dhcp}
                onChange={() => setDhcp(false)}
                name="ipmode"
              />
              Utilizza il seguente indirizzo IP:
            </label>
            <div className={`ml-6 space-y-2 ${dhcp ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <span>Indirizzo IP:</span>
                <QuadIp value={ip} onChange={setIp} disabled={dhcp} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Subnet mask:</span>
                <QuadIp value={mask} onChange={setMask} disabled={dhcp} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Gateway predefinito:</span>
                <QuadIp value={gw} onChange={setGw} disabled={dhcp} />
              </div>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={dnsAuto}
                onChange={() => setDnsAuto(true)}
                name="dnsmode"
              />
              Ottieni indirizzo server DNS automaticamente
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={!dnsAuto}
                onChange={() => setDnsAuto(false)}
                name="dnsmode"
              />
              Utilizza i seguenti indirizzi server DNS:
            </label>
            <div className={`ml-6 space-y-2 ${dnsAuto ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <span>Server DNS preferito:</span>
                <QuadIp value={dns} onChange={setDns} disabled={dnsAuto} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Server DNS alternativo:</span>
                <QuadIp value="" onChange={() => {}} disabled={dnsAuto} />
              </div>
            </div>

            <label className="flex items-center gap-2 pt-1">
              <input type="checkbox" />
              Convalida impostazioni all&apos;uscita
            </label>
          </div>
          <div className="flex items-center justify-between border-t border-[#d4d4d4] bg-[#f0f0f0] px-3 py-2">
            <button
              type="button"
              className="border border-[#adadad] bg-[#e1e1e1] px-3 py-1 opacity-60"
            >
              Avanzate...
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={applyTcpIp}
                className="min-w-[72px] border border-[#adadad] bg-[#e1e1e1] px-3 py-1 font-medium hover:bg-[#d0d0d0]"
              >
                OK
              </button>
              <button
                type="button"
                onClick={() => setView("adapter")}
                className="min-w-[72px] border border-[#adadad] bg-[#e1e1e1] px-3 py-1 hover:bg-[#d0d0d0]"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="border-t border-[#d4d4d4] bg-[#fff8dc] px-3 py-1 text-[11px] text-[#333]">
          {toast}
        </div>
      )}
    </div>
  );
}
