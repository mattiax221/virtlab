"use client";

import { useMemo, useState } from "react";
import { runPing } from "@/lib/network/engine";
import type { Device, LabState } from "@/lib/network/types";

type MibRow = { oid: string; name: string; value: string };

function buildMib(device: Device): MibRow[] {
  const rows: MibRow[] = [
    {
      oid: "1.3.6.1.2.1.1.1.0",
      name: "sysDescr",
      value: `NetLab ${device.type} — ${device.name}`,
    },
    {
      oid: "1.3.6.1.2.1.1.5.0",
      name: "sysName",
      value: device.name,
    },
    {
      oid: "1.3.6.1.2.1.1.3.0",
      name: "sysUpTime",
      value: device.powered ? "up" : "down",
    },
  ];
  let idx = 1;
  for (const iface of device.interfaces.filter((i) => !i.parentIfaceId)) {
    rows.push({
      oid: `1.3.6.1.2.1.2.2.1.2.${idx}`,
      name: `ifDescr.${idx}`,
      value: iface.name,
    });
    rows.push({
      oid: `1.3.6.1.2.1.2.2.1.6.${idx}`,
      name: `ifPhysAddress.${idx}`,
      value: iface.mac,
    });
    rows.push({
      oid: `1.3.6.1.2.1.4.20.1.1.${idx}`,
      name: `ipAdEntAddr.${idx}`,
      value: iface.ip ?? "(none)",
    });
    rows.push({
      oid: `1.3.6.1.2.1.2.2.1.8.${idx}`,
      name: `ifOperStatus.${idx}`,
      value: iface.connectedLinkId && iface.enabled ? "up(1)" : "down(2)",
    });
    idx++;
  }
  return rows;
}

/**
 * MIB Browser semplificato (SNMP get/walk didattico).
 */
export function MibBrowser({
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
  const snmpPeers = useMemo(() => {
    return stateRef.current.devices
      .filter((d) => d.id !== device.id)
      .map((d) => ({
        device: d,
        ip: d.interfaces.find((i) => i.ip && !i.parentIfaceId)?.ip ?? null,
      }));
  }, [device.id, stateRef]);

  const [host, setHost] = useState(
    () => snmpPeers.find((p) => p.ip)?.ip ?? "192.168.1.1",
  );
  const [community, setCommunity] = useState("public");
  const [rows, setRows] = useState<MibRow[]>([]);
  const [status, setStatus] = useState(
    "Inserisci l’IP di un device raggiungibile e premi Walk.",
  );

  function walk() {
    const dest = host.trim();
    if (!dest) {
      setStatus("Serve un IP.");
      return;
    }
    const { result, state } = runPing(stateRef.current, device.id, dest);
    stateRef.current = state;
    setState(state);
    if (!result.ok) {
      setRows([]);
      setStatus(`SNMP timeout — ${result.message.split("\n")[0]}`);
      return;
    }
    const target = state.devices.find((d) =>
      d.interfaces.some((i) => i.ip === dest),
    );
    if (!target) {
      setRows([]);
      setStatus(`Nessun agent SNMP su ${dest}.`);
      return;
    }
    const mib = buildMib(target);
    setRows(mib);
    setStatus(
      `SNMP walk ${dest} (community ${community}) — ${mib.length} OID · ${target.name}`,
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f0f0f0] text-[12px] text-black">
      <div className="flex items-center justify-between border-b border-[#aca899] bg-gradient-to-b from-[#0a246a] to-[#a6caf0] px-3 py-1.5 text-white">
        <span className="font-semibold">MIB Browser — {device.name}</span>
        <button type="button" className="px-2 hover:bg-rose-600" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2 border-b border-[#aca899] bg-[#ece9d8] p-3">
        <label className="flex flex-col gap-0.5">
          Agent IP
          <input
            className="w-36 rounded-none border border-[#7f9db9] bg-white px-2 py-1 font-mono"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && walk()}
            list="mib-peers"
          />
          <datalist id="mib-peers">
            {snmpPeers.map((p) =>
              p.ip ? (
                <option key={p.device.id} value={p.ip}>
                  {p.device.name}
                </option>
              ) : null,
            )}
          </datalist>
        </label>
        <label className="flex flex-col gap-0.5">
          Community
          <input
            className="w-24 rounded-none border border-[#7f9db9] bg-white px-2 py-1"
            value={community}
            onChange={(e) => setCommunity(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="rounded-none border border-[#003c74] bg-[#ece9d8] px-3 py-1.5 font-semibold hover:bg-white"
          onClick={walk}
        >
          Walk
        </button>
        <p className="w-full text-[11px] text-[#555]">{status}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-white">
        <table className="w-full border-collapse text-left text-[11px]">
          <thead className="sticky top-0 bg-[#ece9d8]">
            <tr>
              <th className="border-b border-[#aca899] px-2 py-1.5 font-semibold">
                OID
              </th>
              <th className="border-b border-[#aca899] px-2 py-1.5 font-semibold">
                Name
              </th>
              <th className="border-b border-[#aca899] px-2 py-1.5 font-semibold">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-[#888]">
                  Nessun risultato — esegui Walk su un IP raggiungibile.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.oid} className="odd:bg-[#fafafa]">
                  <td className="border-b border-[#eee] px-2 py-1 font-mono text-[10px] text-[#333]">
                    {r.oid}
                  </td>
                  <td className="border-b border-[#eee] px-2 py-1 text-sky-800">
                    {r.name}
                  </td>
                  <td className="border-b border-[#eee] px-2 py-1 font-mono">
                    {r.value}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
