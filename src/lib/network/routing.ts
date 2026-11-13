/**
 * Instradamento IP del simulatore: dal mittente al destinatario hop per hop,
 * con ARP, ACL, rotte statiche, router-on-a-stick e SVI multilayer.
 *
 * Un ping riesce solo se riescono entrambi i viaggi: andata e ritorno.
 */
import { routerAclCheck } from "./acl";
import { learnArp } from "./arp";
import { getDevice, getIface } from "./engine-helpers";
import { hostFirewallBlocks } from "./hostFirewall";
import { parseIp, parseMask, sameSubnet } from "./ip";
import { l2Flood, sviHasMemberLink, type L2Endpoint } from "./l2";
import { isLinkPhysicallyUp } from "./linkStatus";
import {
  isL3Device,
  isManagedSwitch,
  type AclProtocol,
  type Device,
  type InterfaceConfig,
  type LabState,
  type PingHop,
  type StaticRoute,
} from "./types";

const MAX_HOPS = 16;

/** Il dispositivo inoltra pacchetti tra le sue reti? */
export function canRoute(device: Device): boolean {
  if (!isL3Device(device.type)) return false;
  // Switch multilayer: serve "ip routing" (spento di default, come su IOS)
  if (isManagedSwitch(device.type)) return device.ipRouting === true;
  return true;
}

/** Interfaccia L3 attiva (stato up/up). */
export function ifaceLineUp(
  state: LabState,
  device: Device,
  iface: InterfaceConfig,
): boolean {
  if (!iface.enabled) return false;
  if (iface.sviVlan) return sviHasMemberLink(device, iface.sviVlan);
  if (iface.parentIfaceId) {
    const parent = getIface(device, iface.parentIfaceId);
    return parent ? ifaceLineUp(state, device, parent) : false;
  }
  if (!iface.connectedLinkId) return false;
  const link = state.links.find((l) => l.id === iface.connectedLinkId);
  if (!link || link.media === "console") return false;
  return isLinkPhysicallyUp(state, link);
}

/** Interfacce con IP utilizzabili per l’instradamento. */
function l3Ifaces(state: LabState, device: Device): InterfaceConfig[] {
  return device.interfaces.filter(
    (i) => i.ip && i.mask && ifaceLineUp(state, device, i),
  );
}

function prefixLen(mask: string): number {
  const m = parseMask(mask);
  if (m === null) return -1;
  let n = 0;
  for (let v = m; v & 0x80000000; v = (v << 1) >>> 0) n++;
  return n;
}

function matchStaticRoute(device: Device, destIp: string): StaticRoute | null {
  const dest = parseIp(destIp);
  if (dest === null) return null;
  let best: StaticRoute | null = null;
  let bestPrefix = -1;
  for (const r of device.routes ?? []) {
    const net = parseIp(r.network);
    const mask = parseMask(r.mask);
    if (net === null || mask === null) continue;
    if ((dest & mask) >>> 0 !== (net & mask) >>> 0) continue;
    const p = prefixLen(r.mask);
    if (p > bestPrefix) {
      bestPrefix = p;
      best = r;
    }
  }
  return best;
}

function connectedIfaceFor(
  state: LabState,
  device: Device,
  ip: string,
): InterfaceConfig | null {
  let best: InterfaceConfig | null = null;
  let bestPrefix = -1;
  for (const i of l3Ifaces(state, device)) {
    if (!sameSubnet(i.ip!, ip, i.mask!)) continue;
    const p = prefixLen(i.mask!);
    if (p > bestPrefix) {
      bestPrefix = p;
      best = i;
    }
  }
  return best;
}

/** Tabella di routing: rete connessa, poi rotta statica più specifica. */
export function routeLookup(
  state: LabState,
  device: Device,
  destIp: string,
): { egress: InterfaceConfig; nextHop: string } | null {
  const direct = connectedIfaceFor(state, device, destIp);
  if (direct) return { egress: direct, nextHop: destIp };
  const route = matchStaticRoute(device, destIp);
  if (!route) return null;
  const via = connectedIfaceFor(state, device, route.nextHop);
  if (!via) return null;
  return { egress: via, nextHop: route.nextHop };
}

/** Host raggiungibili in L2 uscendo da un’interfaccia L3. */
export function segmentHosts(
  state: LabState,
  device: Device,
  iface: InterfaceConfig,
  opts?: { destMac?: string },
): { hosts: L2Endpoint[]; state: LabState } {
  let flood: { hosts: L2Endpoint[]; state: LabState };
  if (iface.sviVlan && isManagedSwitch(device.type)) {
    flood = l2Flood(state, device.id, {
      vlanHint: iface.sviVlan,
      sourceMac: iface.mac,
      destMac: opts?.destMac,
    });
  } else if (iface.parentIfaceId) {
    flood = l2Flood(state, device.id, {
      viaIfaceId: iface.parentIfaceId,
      vlanHint: iface.vlanTag ?? undefined,
      tagged: iface.vlanTag != null,
      sourceMac: iface.mac,
      destMac: opts?.destMac,
    });
  } else {
    flood = l2Flood(state, device.id, {
      viaIfaceId: iface.id,
      sourceMac: iface.mac,
      destMac: opts?.destMac,
    });
  }
  return {
    state: flood.state,
    hosts: flood.hosts.filter((h) => h.device.id !== device.id),
  };
}

export type Delivery = {
  ok: boolean;
  state: LabState;
  hops: PingHop[];
  /** Dove si è fermato il pacchetto (per i messaggi) */
  reason?: string;
  /** Router che ha scartato il pacchetto (risposta "non raggiungibile") */
  rejectedBy?: { device: Device; ip: string };
  target?: L2Endpoint;
  warnings: string[];
};

/**
 * Consegna un pacchetto IP da `from` a `dstIp`.
 * `srcIface` è l’interfaccia d’origine per gli host; per i router si usa
 * quella scelta dalla tabella di routing.
 */
export function deliver(
  state: LabState,
  from: Device,
  srcIface: InterfaceConfig | null,
  srcIp: string,
  dstIp: string,
  proto: AclProtocol = "icmp",
  dstPort?: number,
): Delivery {
  let next = state;
  const warnings: string[] = [];
  const hops: PingHop[] = [];
  let current: Device = from;
  let ingress: InterfaceConfig | null = null;
  let originated = true;
  const fail = (reason: string, rejectedBy?: Delivery["rejectedBy"]): Delivery => ({
    ok: false,
    state: next,
    hops,
    reason,
    rejectedBy,
    warnings,
  });

  for (let step = 0; step < MAX_HOPS; step++) {
    current = getDevice(next, current.id) ?? current;
    if (!current.powered) return fail(`${current.name} è spento.`);

    // Arrivato: l’indirizzo è di questo dispositivo
    const own = current.interfaces.find(
      (i) => i.ip === dstIp && ifaceLineUp(next, current, i),
    );
    if (own) {
      if (!originated) {
        const acl = routerAclCheck(current, ingress, null, srcIp, dstIp, proto, dstPort);
        if (!acl.ok) return fail(acl.reason!);
      }
      return { ok: true, state: next, hops, target: { device: current, iface: own }, warnings };
    }

    // Scelta di uscita e next hop
    let egress: InterfaceConfig;
    let nextHop: string;
    if (canRoute(current)) {
      const r = routeLookup(next, current, dstIp);
      if (!r) {
        const ip = ingress?.ip ?? current.interfaces.find((i) => i.ip)?.ip ?? "";
        return fail(
          `Nessuna rotta verso ${dstIp} su ${current.name}.`,
          originated ? undefined : { device: current, ip },
        );
      }
      egress = r.egress;
      nextHop = r.nextHop;
    } else {
      if (!originated) return fail(`${current.name} non instrada pacchetti.`);
      const nic = srcIface;
      if (!nic?.ip || !nic.mask) return fail("Nessun indirizzo IP configurato.");
      if (!ifaceLineUp(next, current, nic)) {
        return fail(`${nic.name} di ${current.name} non è collegata o è spenta.`);
      }
      if (sameSubnet(nic.ip, dstIp, nic.mask)) {
        nextHop = dstIp;
      } else if (!nic.gateway) {
        return fail(`${current.name}: destinazione fuori rete e nessun gateway configurato.`);
      } else if (!sameSubnet(nic.ip, nic.gateway, nic.mask)) {
        return fail(`${current.name}: il gateway ${nic.gateway} non è nella sua subnet.`);
      } else {
        nextHop = nic.gateway;
      }
      egress = nic;
    }

    // ACL del router (il traffico generato dal router stesso non è filtrato)
    if (!originated) {
      const acl = routerAclCheck(current, ingress, egress, srcIp, dstIp, proto, dstPort);
      if (!acl.ok) return fail(acl.reason!, { device: current, ip: ingress?.ip ?? "" });
    }

    const knownMac = current.arpTable?.find((e) => e.ip === nextHop)?.mac;
    const seg = segmentHosts(next, current, egress, { destMac: knownMac });
    next = seg.state;
    const matches = seg.hosts.filter((h) => h.iface.ip === nextHop);
    if (matches.length === 0) {
      if (nextHop === dstIp) {
        return fail(
          `Nessuna risposta ARP da ${dstIp} (host assente, spento o in un’altra VLAN).`,
          originated ? undefined : { device: current, ip: egress.ip ?? "" },
        );
      }
      return fail(
        `${current.name}: next hop / gateway ${nextHop} non raggiungibile.`,
        originated ? undefined : { device: current, ip: egress.ip ?? "" },
      );
    }
    if (matches.length > 1) {
      warnings.push(
        `Attenzione: l’indirizzo ${nextHop} è duplicato (${matches
          .map((m) => m.device.name)
          .join(", ")}).`,
      );
    }
    const peer = matches[0]!;
    next = learnArp(next, current.id, nextHop, peer.iface.mac, egress.id);
    if (egress.ip) {
      next = learnArp(next, peer.device.id, egress.ip, egress.mac, peer.iface.id);
    }
    hops.push({ deviceId: peer.device.id, deviceName: peer.device.name, ip: nextHop });

    if (nextHop === dstIp) {
      const live = getDevice(next, peer.device.id)!;
      if (canRoute(live)) {
        // L’ACL in ingresso filtra anche il traffico diretto al router
        const acl = routerAclCheck(live, peer.iface, null, srcIp, dstIp, proto, dstPort);
        if (!acl.ok) return fail(acl.reason!);
      }
      return {
        ok: true,
        state: next,
        hops,
        target: { device: live, iface: getIface(live, peer.iface.id) ?? peer.iface },
        warnings,
      };
    }

    // Il next hop deve essere un router che inoltra
    if (!canRoute(peer.device)) {
      return fail(`${peer.device.name} (${nextHop}) non è un router: non può inoltrare.`);
    }
    current = peer.device;
    ingress = peer.iface;
    originated = false;
  }
  return fail("TTL scaduto in transito (loop di routing?).");
}

/** Interfaccia d’origine per un host o per un router verso `targetIp`. */
export function pickSourceIface(
  state: LabState,
  device: Device,
  targetIp: string,
): InterfaceConfig | null {
  if (canRoute(device)) {
    return routeLookup(state, device, targetIp)?.egress ?? null;
  }
  const withIp = device.interfaces.filter((i) => i.ip && i.mask && i.enabled);
  const up = withIp.filter((i) => ifaceLineUp(state, device, i));
  return (
    up.find((i) => sameSubnet(i.ip!, targetIp, i.mask!)) ??
    up.find((i) => i.gateway && (i.media === "ethernet" || i.media === "fiber")) ??
    up.find((i) => i.gateway) ??
    up.find((i) => i.media === "ethernet" || i.media === "fiber") ??
    up[0] ??
    withIp.find((i) => sameSubnet(i.ip!, targetIp, i.mask!)) ??
    withIp[0] ??
    null
  );
}

/** Andata e ritorno: true solo se anche la risposta torna al mittente. */
export function roundTrip(
  state: LabState,
  from: Device,
  srcIface: InterfaceConfig,
  dstIp: string,
  proto: AclProtocol = "icmp",
  dstPort?: number,
): {
  ok: boolean;
  state: LabState;
  hops: PingHop[];
  message?: string;
  rejectedBy?: Delivery["rejectedBy"];
  replyLost?: boolean;
  target?: L2Endpoint;
  warnings: string[];
} {
  const srcIp = srcIface.ip ?? "";
  const go = deliver(state, from, srcIface, srcIp, dstIp, proto, dstPort);
  if (!go.ok || !go.target) {
    return {
      ok: false,
      state: go.state,
      hops: go.hops,
      message: go.reason,
      rejectedBy: go.rejectedBy,
      warnings: go.warnings,
    };
  }
  const target = go.target;
  const fwIn = hostFirewallBlocks(target.device, "in", proto === "icmp" ? "icmp" : proto === "udp" ? "udp" : "tcp", srcIp, dstPort);
  if (fwIn) {
    return { ok: false, state: go.state, hops: go.hops, message: fwIn, replyLost: true, warnings: go.warnings };
  }
  // Ritorno: lo genera il destinatario verso il mittente
  const replyIface =
    canRoute(target.device)
      ? routeLookup(go.state, target.device, srcIp)?.egress ?? target.iface
      : target.iface;
  const replySrc = canRoute(target.device) ? dstIp : (target.iface.ip ?? dstIp);
  const back = deliver(go.state, target.device, replyIface, replySrc, srcIp, proto);
  if (!back.ok) {
    return {
      ok: false,
      state: back.state,
      hops: go.hops,
      message: `La richiesta arriva a ${target.device.name}, ma la risposta non torna: ${back.reason ?? "percorso di ritorno assente"}`,
      replyLost: true,
      target,
      warnings: [...go.warnings, ...back.warnings],
    };
  }
  return {
    ok: true,
    state: back.state,
    hops: go.hops,
    target,
    warnings: [...go.warnings, ...back.warnings],
  };
}
