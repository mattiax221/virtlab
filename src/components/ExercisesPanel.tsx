"use client";

import { isL3Device, type LabState } from "@/lib/network/types";

type Check = { id: string; label: string; ok: boolean; hint?: string };

export function evaluateExercises(state: LabState): Check[] {
  const pcs = state.devices.filter((d) => d.type === "pc");
  const sw = state.devices.find(
    (d) => d.type.startsWith("switch") || d.type === "multilayer_switch",
  );
  const server = state.devices.find((d) => d.type === "server");
  const routers = state.devices.filter((d) => isL3Device(d.type));
  const hasTrunk = sw?.interfaces.some((i) => i.mode === "trunk") ?? false;
  const dhcpOn = server?.services?.dhcp?.enabled ?? false;
  const leases =
    server?.services?.dhcp?.pools?.reduce((n, p) => n + p.leases.length, 0) ??
    0;
  const pcWithIp = pcs.filter((p) => p.interfaces.some((i) => i.ip)).length;
  const wifiLinks = state.links.filter((l) => l.media === "wireless").length;
  const serialLinks = state.links.filter((l) => l.media === "serial").length;
  const serialClock = state.devices.some((d) =>
    d.interfaces.some(
      (i) => i.media === "serial" && i.clockRate != null && i.clockRate > 0,
    ),
  );
  const hasAcl = state.devices.some(
    (d) => d.accessLists?.some((a) => a.aces.length > 0) ?? false,
  );
  const aclApplied = state.devices.some((d) =>
    d.interfaces.some((i) => i.aclIn != null || i.aclOut != null),
  );
  const httpOn = server?.services?.http?.enabled ?? false;

  const vlanIds = new Set<number>();
  for (const d of state.devices) {
    for (const v of d.vlans ?? []) vlanIds.add(v.id);
    for (const i of d.interfaces) {
      if (i.accessVlan) vlanIds.add(i.accessVlan);
      if (i.vlanTag) vlanIds.add(i.vlanTag);
    }
  }
  const pcsOnDifferentVlans = (() => {
    const vlans = new Set<number>();
    for (const pc of pcs) {
      for (const i of pc.interfaces) {
        if (!i.connectedLinkId) continue;
        const link = state.links.find((l) => l.id === i.connectedLinkId);
        if (!link || !sw) continue;
        const swIfId =
          link.aDeviceId === sw.id
            ? link.aIfaceId
            : link.bDeviceId === sw.id
              ? link.bIfaceId
              : null;
        const swIf = sw.interfaces.find((x) => x.id === swIfId);
        if (swIf?.mode === "access" && swIf.accessVlan) {
          vlans.add(swIf.accessVlan);
        }
      }
    }
    return vlans.size >= 2;
  })();
  const subIfs = routers.some((r) =>
    r.interfaces.some((i) => i.parentIfaceId != null && i.vlanTag != null),
  );
  const staticRoutes = routers.some((r) => (r.routes?.length ?? 0) > 0);
  const twoRoutersLinked =
    routers.length >= 2 &&
    state.links.some((l) => {
      const a = state.devices.find((d) => d.id === l.aDeviceId);
      const b = state.devices.find((d) => d.id === l.bDeviceId);
      return a && b && isL3Device(a.type) && isL3Device(b.type);
    });
  const arpLearned = state.devices.some((d) => (d.arpTable?.length ?? 0) > 0);

  return [
    {
      id: "pcs",
      label: "Almeno 2 PC collegati allo switch",
      ok:
        pcs.filter((p) => p.interfaces.some((i) => i.connectedLinkId)).length >=
        2,
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
      hint: "Collega il PC Ethernet: renew automatico se dhcpClient",
    },
    {
      id: "http",
      label: "Server HTTP attivo (prova: http www.lab)",
      ok: httpOn,
    },
    {
      id: "vlan-create",
      label: "VLAN: create almeno VLAN 10 e 20 sullo switch",
      ok: vlanIds.has(10) && vlanIds.has(20),
      hint: "Switch → VLAN → add 10 / 20",
    },
    {
      id: "vlan-access",
      label: "VLAN: due porte access su VLAN diverse + PC collegati",
      ok: pcsOnDifferentVlans,
      hint: "PC-A su Fa0/1 VLAN 10, PC-B su Fa0/2 VLAN 20",
    },
    {
      id: "vlan-trunk",
      label: "VLAN: porta trunk verso il router (dot1Q)",
      ok: hasTrunk,
      hint: "Switch porta verso router → mode trunk",
    },
    {
      id: "vlan-stick",
      label: "VLAN: router-on-a-stick (subinterface .10 / .20)",
      ok: subIfs,
      hint: "interface Gi0/0.10 → encapsulation dot1Q 10 → ip address …",
    },
    {
      id: "static-route",
      label: "Routing: due router collegati + ip route statica",
      ok: twoRoutersLinked && staticRoutes,
      hint: "ip route 192.168.2.0 255.255.255.0 10.0.0.2",
    },
    {
      id: "arp",
      label: "ARP: cache popolata (ping o arp -a / show arp)",
      ok: arpLearned,
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
  const checks = evaluateExercises(state);
  const done = checks.filter((c) => c.ok).length;
  const vlanGuide = checks.filter((c) => c.id.startsWith("vlan-"));
  const pct = Math.round((done / checks.length) * 100);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-white">
              Checklist lab
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Completati {done}/{checks.length} · Passi VLAN{" "}
              {vlanGuide.filter((c) => c.ok).length}/{vlanGuide.length}
            </p>
          </div>
          <div className="text-right">
            <div className="font-display text-3xl font-bold text-sky-300">
              {pct}%
            </div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">
              progresso
            </div>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-sky-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <section className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-5">
        <h3 className="text-sm font-semibold text-sky-200">Guida VLAN</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          PC in VLAN diverse → trunk sullo switch → router-on-a-stick
          (subinterface + encapsulation dot1Q). Poi ping inter-VLAN.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-300">
          <li>Crea VLAN 10 e 20 sullo switch</li>
          <li>Porte access: PC-A VLAN 10, PC-B VLAN 20</li>
          <li>Porta verso il router in trunk</li>
          <li>
            Sul router: <code className="text-sky-300">Gi0/0.10</code> /{" "}
            <code className="text-sky-300">.20</code> con IP di gateway
          </li>
        </ol>
      </section>

      <ul className="space-y-2">
        {checks.map((c) => (
          <li
            key={c.id}
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
              c.ok
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-slate-700/80 bg-slate-900/40"
            }`}
          >
            <span
              className={`mt-0.5 text-base ${
                c.ok ? "text-emerald-400" : "text-slate-600"
              }`}
              aria-hidden
            >
              {c.ok ? "✓" : "○"}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`text-sm ${
                  c.ok ? "text-slate-100" : "text-slate-400"
                }`}
              >
                {c.label}
              </span>
              {!c.ok && c.hint && (
                <span className="mt-1 block text-xs text-slate-500">
                  {c.hint}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
