import { isLinkPhysicallyUp } from "./linkStatus";
import {
  isManagedSwitch,
  type Device,
  type InterfaceConfig,
  type LabState,
} from "./types";

/**
 * Spanning Tree (802.1D, un’unica istanza per tutte le VLAN).
 *
 * - root bridge: priorità più bassa, a parità MAC più basso;
 * - ogni switch non root sceglie la root port (costo verso la root minore);
 * - su ogni collegamento tra switch la porta designata è quella col costo
 *   minore verso la root; l’altra, se non è root port, va in blocking.
 * Così si bloccano sia i cavi doppi sia gli anelli tra tre o più switch.
 */

export const STP_DEFAULT_PRIORITY = 32768;

type StpRole = NonNullable<InterfaceConfig["stpRole"]>;

export function bridgeMac(device: Device): string {
  const svi = device.interfaces.find((i) => i.sviVlan === 1);
  return (svi ?? device.interfaces[0])?.mac ?? "ff:ff:ff:ff:ff:ff";
}

function bridgePriority(device: Device): number {
  return device.stpPriority ?? STP_DEFAULT_PRIORITY;
}

/** Confronto tra bridge id: negativo se a è “migliore” (più basso). */
function compareBridge(a: Device, b: Device): number {
  const pa = bridgePriority(a);
  const pb = bridgePriority(b);
  if (pa !== pb) return pa - pb;
  return bridgeMac(a).localeCompare(bridgeMac(b));
}

export function portCost(iface: InterfaceConfig): number {
  if (iface.media === "fiber" || /^(Gi|Gigabit|Te|Ten)/i.test(iface.name)) return 4;
  return 19;
}

function portIndex(device: Device, iface: InterfaceConfig): number {
  return device.interfaces.indexOf(iface) + 1;
}

type Edge = {
  aId: string;
  aIf: InterfaceConfig;
  bId: string;
  bIf: InterfaceConfig;
};

export function recomputeStp(state: LabState): LabState {
  const switches = state.devices.filter(
    (d) => isManagedSwitch(d.type) && d.powered,
  );
  const byId = new Map(switches.map((d) => [d.id, d]));

  // Collegamenti attivi tra due switch
  const edges: Edge[] = [];
  for (const link of state.links) {
    if (link.media === "console" || link.media === "serial") continue;
    const a = byId.get(link.aDeviceId);
    const b = byId.get(link.bDeviceId);
    if (!a || !b) continue;
    const aIf = a.interfaces.find((i) => i.id === link.aIfaceId);
    const bIf = b.interfaces.find((i) => i.id === link.bIfaceId);
    if (!aIf || !bIf || !aIf.enabled || !bIf.enabled) continue;
    if (!isLinkPhysicallyUp(state, link)) continue;
    edges.push({ aId: a.id, aIf, bId: b.id, bIf });
  }

  // Root bridge per ciascuna isola di switch collegati
  const rootOf = new Map<string, string>();
  const cost = new Map<string, number>();
  const rootPort = new Map<string, string>(); // deviceId → ifaceId
  const neighbors = (id: string) =>
    edges.flatMap((e) =>
      e.aId === id
        ? [{ local: e.aIf, peerId: e.bId, peerIf: e.bIf }]
        : e.bId === id
          ? [{ local: e.bIf, peerId: e.aId, peerIf: e.aIf }]
          : [],
    );

  for (const sw of switches) {
    if (rootOf.has(sw.id)) continue;
    // componente connessa
    const comp: string[] = [];
    const stack = [sw.id];
    const seen = new Set([sw.id]);
    while (stack.length) {
      const id = stack.pop()!;
      comp.push(id);
      for (const n of neighbors(id)) {
        if (!seen.has(n.peerId)) {
          seen.add(n.peerId);
          stack.push(n.peerId);
        }
      }
    }
    const root = comp
      .map((id) => byId.get(id)!)
      .sort(compareBridge)[0]!;
    for (const id of comp) rootOf.set(id, root.id);

    // Dijkstra dal root (costo, poi bridge id del vicino, poi porta)
    cost.set(root.id, 0);
    const done = new Set<string>();
    while (done.size < comp.length) {
      let best: string | null = null;
      for (const id of comp) {
        if (done.has(id) || !cost.has(id)) continue;
        if (best === null || cost.get(id)! < cost.get(best)!) best = id;
      }
      if (best === null) break;
      done.add(best);
      for (const n of neighbors(best)) {
        if (done.has(n.peerId)) continue;
        const c = cost.get(best)! + portCost(n.peerIf);
        const prev = cost.get(n.peerId);
        const curRp = rootPort.get(n.peerId);
        let better = prev === undefined || c < prev;
        if (!better && prev === c && curRp) {
          // pareggio: bridge id del mittente più basso, poi porta del mittente
          const peer = byId.get(n.peerId)!;
          const curIf = peer.interfaces.find((i) => i.id === curRp)!;
          const curSender = neighbors(n.peerId).find((x) => x.local.id === curIf.id);
          if (curSender) {
            const cmp = compareBridge(byId.get(best)!, byId.get(curSender.peerId)!);
            better =
              cmp < 0 ||
              (cmp === 0 &&
                portIndex(byId.get(best)!, n.local) <
                  portIndex(byId.get(curSender.peerId)!, curSender.peerIf));
          }
        }
        if (better) {
          cost.set(n.peerId, c);
          rootPort.set(n.peerId, n.peerIf.id);
        }
      }
    }
  }

  // Ruoli per porta
  const roles = new Map<string, StpRole>(); // ifaceId → ruolo
  for (const [devId, ifId] of rootPort) {
    if (rootOf.get(devId) !== devId) roles.set(ifId, "root");
  }
  for (const e of edges) {
    if (roles.get(e.aIf.id) === "root" || roles.get(e.bIf.id) === "root") {
      // l’altra estremità del collegamento con una root port è designata
      if (roles.get(e.aIf.id) !== "root") roles.set(e.aIf.id, "designated");
      if (roles.get(e.bIf.id) !== "root") roles.set(e.bIf.id, "designated");
      continue;
    }
    const a = byId.get(e.aId)!;
    const b = byId.get(e.bId)!;
    const ca = cost.get(e.aId) ?? 0;
    const cb = cost.get(e.bId) ?? 0;
    let aWins: boolean;
    if (ca !== cb) aWins = ca < cb;
    else {
      const cmp = compareBridge(a, b);
      aWins = cmp !== 0 ? cmp < 0 : portIndex(a, e.aIf) < portIndex(b, e.bIf);
    }
    roles.set(e.aIf.id, aWins ? "designated" : "alternate");
    roles.set(e.bIf.id, aWins ? "alternate" : "designated");
  }

  const devices = state.devices.map((d) => {
    if (!isManagedSwitch(d.type)) {
      if (!d.interfaces.some((i) => i.stpState || i.stpRole)) return d;
      return {
        ...d,
        interfaces: d.interfaces.map((i) => ({
          ...i,
          stpState: undefined,
          stpRole: undefined,
        })),
      };
    }
    return {
      ...d,
      interfaces: d.interfaces.map((i) => {
        if (i.sviVlan || i.parentIfaceId) {
          return { ...i, stpState: undefined, stpRole: undefined };
        }
        const role: StpRole = roles.get(i.id) ?? (i.connectedLinkId ? "designated" : "disabled");
        return {
          ...i,
          stpRole: role,
          stpState:
            role === "alternate"
              ? ("blocking" as const)
              : ("forwarding" as const),
        };
      }),
    };
  });

  return { ...state, devices };
}

/** Uscita di "show spanning-tree". */
export function formatStp(state: LabState, device: Device): string {
  const live = state.devices.find((d) => d.id === device.id) ?? device;
  // Ricava la root seguendo le root port
  let root: Device = live;
  let rootCost = 0;
  const visited = new Set<string>();
  for (;;) {
    visited.add(root.id);
    const rp = root.interfaces.find((i) => i.stpRole === "root");
    if (!rp?.connectedLinkId) break;
    const link = state.links.find((l) => l.id === rp.connectedLinkId);
    if (!link) break;
    const peerId = link.aDeviceId === root.id ? link.bDeviceId : link.aDeviceId;
    const peer = state.devices.find((d) => d.id === peerId);
    if (!peer || visited.has(peer.id)) break;
    rootCost += portCost(rp);
    root = peer;
  }
  const myRootPort = live.interfaces.find((i) => i.stpRole === "root");
  const short = (n: string) =>
    n.replace("FastEthernet", "Fa").replace("GigabitEthernet", "Gi");
  const lines = [
    "VLAN0001",
    "  Spanning tree enabled protocol ieee",
    `  Root ID    Priority    ${bridgePriority(root)}`,
    `             Address     ${bridgeMac(root)}`,
    root.id === live.id
      ? "             This bridge is the root"
      : `             Cost        ${rootCost}\n             Port        ${myRootPort ? `${portIndex(live, myRootPort)} (${short(myRootPort.name)})` : "-"}`,
    "",
    `  Bridge ID  Priority    ${bridgePriority(live)}`,
    `             Address     ${bridgeMac(live)}`,
    "",
    "Interface           Role Sts Cost      Prio.Nbr Type",
    "------------------- ---- --- --------- -------- --------------------------------",
  ];
  const roleShort: Record<string, string> = {
    root: "Root",
    designated: "Desg",
    alternate: "Altn",
    disabled: "Disa",
  };
  for (const i of live.interfaces) {
    if (i.sviVlan || i.parentIfaceId || !i.connectedLinkId || !i.enabled) continue;
    if (i.media === "wireless") continue;
    const role = roleShort[i.stpRole ?? "designated"] ?? "Desg";
    const sts = i.stpState === "blocking" ? "BLK" : "FWD";
    lines.push(
      `${short(i.name).padEnd(20)}${role} ${sts} ${String(portCost(i)).padEnd(9)} 128.${String(portIndex(live, i)).padEnd(4)} P2p`,
    );
  }
  return lines.join("\n");
}
