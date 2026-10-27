"use client";

import { useState } from "react";
import type { Device, LabState } from "@/lib/network/types";

export function ServerServices({
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
  const svc = live.services;
  const [tab, setTab] = useState<"dhcp" | "dns" | "http">("dhcp");

  function patch(nextServices: NonNullable<typeof svc>) {
    const next = {
      ...stateRef.current,
      devices: stateRef.current.devices.map((d) =>
        d.id === live.id ? { ...d, services: nextServices } : d,
      ),
    };
    stateRef.current = next;
    setState(next);
  }

  if (!svc) {
    return (
      <div className="p-4 text-sm text-slate-600">
        Nessun servizio su questo host.
        <button type="button" className="ml-2 underline" onClick={onClose}>
          Chiudi
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f0f0f0] text-[12px] text-black" style={{ fontFamily: "Segoe UI, Tahoma, sans-serif" }}>
      <div className="flex items-center justify-between border-b border-[#d4d4d4] bg-white px-2 py-1.5">
        <span className="text-[13px] font-semibold">Servizi — {live.name}</span>
        <button type="button" className="px-2 hover:bg-rose-500 hover:text-white" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="flex gap-1 border-b border-[#d4d4d4] bg-[#fafafa] px-2 pt-1">
        {(["dhcp", "dns", "http"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1 ${tab === t ? "border border-b-0 border-[#d4d4d4] bg-white" : "text-[#666]"}`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {tab === "dhcp" && svc.dhcp && (
          <>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={svc.dhcp.enabled}
                onChange={(e) =>
                  patch({
                    ...svc,
                    dhcp: { ...svc.dhcp!, enabled: e.target.checked },
                  })
                }
              />
              Servizio DHCP attivo
            </label>
            {(
              [
                ["network", "Rete"],
                ["mask", "Maschera"],
                ["gateway", "Gateway"],
                ["dns", "DNS"],
                ["startIp", "Inizio pool"],
                ["endIp", "Fine pool"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-2">
                <span>{label}</span>
                <input
                  value={svc.dhcp![key]}
                  onChange={(e) =>
                    patch({
                      ...svc,
                      dhcp: { ...svc.dhcp!, [key]: e.target.value },
                    })
                  }
                  className="w-40 border border-[#7a9cbc] px-1 py-0.5 font-mono"
                />
              </label>
            ))}
            <div className="rounded border border-[#d4d4d4] bg-white p-2">
              <div className="mb-1 font-medium">Lease attivi</div>
              {svc.dhcp.leases.length === 0 ? (
                <div className="text-[#888]">Nessuno</div>
              ) : (
                svc.dhcp.leases.map((l) => (
                  <div key={l.ifaceId} className="font-mono text-[11px]">
                    {l.ip} · {l.mac}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {tab === "dns" && svc.dns && (
          <>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={svc.dns.enabled}
                onChange={(e) =>
                  patch({
                    ...svc,
                    dns: { ...svc.dns!, enabled: e.target.checked },
                  })
                }
              />
              Servizio DNS attivo
            </label>
            <div className="space-y-2">
              {svc.dns.records.map((r, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    value={r.name}
                    onChange={(e) => {
                      const records = [...svc.dns!.records];
                      records[idx] = { ...r, name: e.target.value };
                      patch({ ...svc, dns: { ...svc.dns!, records } });
                    }}
                    className="flex-1 border border-[#7a9cbc] px-1 py-0.5 font-mono"
                    placeholder="nome"
                  />
                  <input
                    value={r.ip}
                    onChange={(e) => {
                      const records = [...svc.dns!.records];
                      records[idx] = { ...r, ip: e.target.value };
                      patch({ ...svc, dns: { ...svc.dns!, records } });
                    }}
                    className="w-32 border border-[#7a9cbc] px-1 py-0.5 font-mono"
                    placeholder="IP"
                  />
                </div>
              ))}
              <button
                type="button"
                className="border border-[#adadad] bg-[#e1e1e1] px-2 py-1"
                onClick={() =>
                  patch({
                    ...svc,
                    dns: {
                      ...svc.dns!,
                      records: [
                        ...svc.dns!.records,
                        { name: "host.lab", ip: "192.168.1.10" },
                      ],
                    },
                  })
                }
              >
                Aggiungi record
              </button>
            </div>
          </>
        )}

        {tab === "http" && svc.http && (
          <>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={svc.http.enabled}
                onChange={(e) =>
                  patch({
                    ...svc,
                    http: { ...svc.http!, enabled: e.target.checked },
                  })
                }
              />
              Servizio HTTP attivo
            </label>
            <label className="block space-y-1">
              <span>Titolo pagina</span>
              <input
                value={svc.http.title}
                onChange={(e) =>
                  patch({
                    ...svc,
                    http: { ...svc.http!, title: e.target.value },
                  })
                }
                className="w-full border border-[#7a9cbc] px-1 py-0.5"
              />
            </label>
            <label className="block space-y-1">
              <span>Contenuto</span>
              <textarea
                value={svc.http.body}
                onChange={(e) =>
                  patch({
                    ...svc,
                    http: { ...svc.http!, body: e.target.value },
                  })
                }
                rows={6}
                className="w-full border border-[#7a9cbc] px-1 py-0.5 font-mono"
              />
            </label>
          </>
        )}
      </div>
      <div className="border-t border-[#d4d4d4] px-3 py-2 text-[11px] text-[#555]">
        Dai PC: Connessioni di rete → Ottieni IP automaticamente · ping server.lab · http www.lab
      </div>
    </div>
  );
}
