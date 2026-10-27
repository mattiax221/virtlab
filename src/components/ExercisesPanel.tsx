"use client";

import { isL3Device, type LabState } from "@/lib/network/types";

type Check = { id: string; label: string; ok: boolean; hint?: string };

function evaluate(state: LabState): Check[] {
  const pcs = state.devices.filter((d) => d.type === "pc");
  const sw = state.devices.find(
    (d) => d.type.startsWith("switch") || d.type === "multilayer_switch",
  );
  const server = state.devices.find((d) => d.type === "server");
  const routers = state.devices.filter((d) => isL3Device(d.type));
  const hasTrunk = sw?.interfaces.some((i) => i.mode === "trunk") ?? false;
  const dhcpOn = server?.services?.dhcp?.enabled ?? false;
  const leases = server?.services?.dhcp?.leases.length ?? 0;
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
  const accessVlans = new Set(
    sw?.interfaces
      .filter((i) => i.mode === "access" && i.connectedLinkId && i.accessVlan)
      .map((i) => i.accessVlan!) ?? [],
  );
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
      id: "topo",
      label: "Almeno 2 PC collegati allo switch",
      ok:
        pcs.length >= 2 &&
        (sw?.interfaces.filter((i) => i.connectedLinkId).length ?? 0) >= 2,
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
      ok: accessVlans.size >= 2 && pcsOnDifferentVlans,
      hint: "PC-A su Fa0/1 VLAN 10, PC-B su Fa0/2 VLAN 20",
    },
    {
      id: "vlan-trunk",
      label: "VLAN: porta trunk verso il router (dot1Q)",
      ok: hasTrunk,
      hint: "Switch porta verso router → mode trunk",
    },
    {
      id: "vlan-rois",
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
  const checks = evaluate(state);
  const done = checks.filter((c) => c.ok).length;
  const vlanGuide = checks.filter((c) => c.id.startsWith("vlan-"));

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/90 p-3 text-xs text-slate-200 shadow-xl">
      <div className="font-medium text-sky-200">
        Esercizi lab ({done}/{checks.length})
      </div>
      <p className="mt-1 text-[10px] leading-snug text-slate-500">
        Guida VLAN: PC in VLAN diverse → trunk → router-on-a-stick. Poi ping
        inter-VLAN.
      </p>
      <ul className="mt-2 space-y-1.5">
        {checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2">
            <span className={c.ok ? "text-emerald-400" : "text-slate-600"}>
              {c.ok ? "✓" : "○"}
            </span>
            <span className="min-w-0">
              <span className={c.ok ? "text-slate-300" : "text-slate-500"}>
                {c.label}
              </span>
              {!c.ok && c.hint && (
                <span className="mt-0.5 block text-[10px] text-slate-600">
                  {c.hint}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 border-t border-slate-800 pt-2 text-[10px] text-slate-500">
        Passi VLAN: {vlanGuide.filter((c) => c.ok).length}/{vlanGuide.length}
      </div>
    </div>
  );
}
