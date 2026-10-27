"use client";

import type { LabState } from "@/lib/network/types";

type Check = { id: string; label: string; ok: boolean };

function evaluate(state: LabState): Check[] {
  const pcs = state.devices.filter((d) => d.type === "pc");
  const sw = state.devices.find((d) => d.type.startsWith("switch"));
  const server = state.devices.find((d) => d.type === "server");
  const hasTrunk = sw?.interfaces.some((i) => i.mode === "trunk") ?? false;
  const dhcpOn = server?.services?.dhcp?.enabled ?? false;
  const leases = server?.services?.dhcp?.leases.length ?? 0;
  const pcWithIp = pcs.filter((p) => p.interfaces.some((i) => i.ip)).length;
  const wifiLinks = state.links.filter((l) => l.media === "wireless").length;
  const serialLinks = state.links.filter((l) => l.media === "serial").length;
  const serialClock = state.devices.some((d) =>
    d.interfaces.some((i) => i.media === "serial" && i.clockRate != null && i.clockRate > 0),
  );
  const hasAcl = state.devices.some(
    (d) => (d.accessLists?.some((a) => a.aces.length > 0) ?? false),
  );
  const aclApplied = state.devices.some((d) =>
    d.interfaces.some((i) => i.aclIn != null || i.aclOut != null),
  );
  const httpOn = server?.services?.http?.enabled ?? false;

  return [
    {
      id: "topo",
      label: "Almeno 2 PC collegati allo switch",
      ok: pcs.length >= 2 && (sw?.interfaces.filter((i) => i.connectedLinkId).length ?? 0) >= 2,
    },
    {
      id: "ip",
      label: "Almeno un PC ha un IP configurato",
      ok: pcWithIp >= 1,
    },
    {
      id: "dhcp",
      label: "Server DHCP attivo + almeno 1 lease",
      ok: dhcpOn && leases >= 1,
    },
    {
      id: "http",
      label: "Server HTTP attivo (prova: http www.lab)",
      ok: httpOn,
    },
    {
      id: "vlan-trunk",
      label: "Switch: almeno una porta in trunk (inter-VLAN)",
      ok: hasTrunk,
    },
    {
      id: "wifi",
      label: "Almeno un’associazione Wi‑Fi attiva",
      ok: wifiLinks >= 1,
    },
    {
      id: "serial",
      label: "Cavo Serial + clock rate sul DCE",
      ok: serialLinks >= 1 && serialClock,
    },
    {
      id: "acl",
      label: "ACL definita e applicata su un’interfaccia",
      ok: hasAcl && aclApplied,
    },
  ];
}

export function ExercisesPanel({ state }: { state: LabState }) {
  const checks = evaluate(state);
  const done = checks.filter((c) => c.ok).length;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/90 p-3 text-xs text-slate-200 shadow-xl">
      <div className="font-medium text-sky-200">
        Esercizi lab ({done}/{checks.length})
      </div>
      <ul className="mt-2 space-y-1.5">
        {checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2">
            <span className={c.ok ? "text-emerald-400" : "text-slate-600"}>
              {c.ok ? "✓" : "○"}
            </span>
            <span className={c.ok ? "text-slate-300" : "text-slate-500"}>
              {c.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
