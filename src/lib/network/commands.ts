import {
  createSubinterface,
  getDevice,
  runPing,
  updateDevice,
  updateIface,
} from "./engine";
import { formatIp, isValidIp, maskToCidr, parseIp, parseMask } from "./ip";
import {
  formatInterfacesStatus,
  formatInterfacesTrunk,
  formatMacTable,
  formatVlanBrief,
  l2Flood,
} from "./l2";
import type { CommandResult, LabState, VlanRecord } from "./types";

export type CommandContext = {
  state: LabState;
  deviceId: string;
  setState: (next: LabState) => void;
};

function helpPc(): string {
  return [
    "Comandi disponibili (stile Windows CMD):",
    "  ipconfig                 Mostra la configurazione IP",
    "  ipconfig /all            Dettagli completi (MAC, gateway)",
    "  ipconfig /ip <ip> <mask> [gateway]",
    "                           Imposta IP statico sull'interfaccia Ethernet0",
    "  ping <indirizzo>         Invia echo ICMP all'host",
    "  arp -a                   Mostra cache ARP (host visti in LAN)",
    "  route print              Mostra tabella di routing",
    "  hostname                 Nome del PC",
    "  cls / clear              Pulisce lo schermo",
    "  help                     Questo aiuto",
    "",
    "Esempio:",
    "  ipconfig /ip 192.168.1.10 255.255.255.0 192.168.1.1",
    "  ping 192.168.1.20",
  ].join("\n");
}

function helpRouter(): string {
  return [
    "Comandi CLI router (semplificati, stile Cisco):",
    "  enable",
    "  show ip interface brief",
    "  show interfaces",
    "  configure terminal",
    "  interface <nome>              es. GigabitEthernet0/0",
    "  interface <nome>.<vlan>       subinterface (router-on-a-stick)",
    "  encapsulation dot1Q <vlan>",
    "  ip address <ip> <mask>",
    "  no shutdown",
    "  exit",
    "  ping <indirizzo>",
    "  hostname <nome>",
    "  help",
    "",
    "Inter-VLAN (router-on-a-stick):",
    "  conf t",
    "  interface GigabitEthernet0/0.10",
    "  encapsulation dot1Q 10",
    "  ip address 192.168.10.1 255.255.255.0",
    "  no shutdown",
    "  (ripeti per .20) — sullo switch: porta verso router in trunk",
  ].join("\n");
}

function ipconfig(state: LabState, deviceId: string, all: boolean): string {
  const device = getDevice(state, deviceId);
  if (!device) return "Errore: dispositivo non trovato.";
  const lines: string[] = [""];
  if (all) {
    lines.push(`Nome host . . . . . . . . . . . . . : ${device.name}`);
    lines.push("");
  }
  for (const iface of device.interfaces) {
    lines.push(`Scheda Ethernet ${iface.name}:`);
    lines.push("");
    lines.push(
      `   Stato supporto. . . . . . . . . . . : ${iface.connectedLinkId ? "Supporto connesso" : "Supporto disconnesso"}`,
    );
    if (all) {
      lines.push(`   Indirizzo fisico. . . . . . . . . : ${iface.mac}`);
    }
    lines.push(
      `   Indirizzo IPv4. . . . . . . . . . . : ${iface.ip ?? "(non configurato)"}`,
    );
    lines.push(
      `   Subnet mask . . . . . . . . . . . . : ${iface.mask ?? "(non configurata)"}`,
    );
    lines.push(
      `   Gateway predefinito . . . . . . . . : ${iface.gateway ?? ""}`,
    );
    lines.push("");
  }
  return lines.join("\n");
}

function setIp(
  ctx: CommandContext,
  ip: string,
  mask: string,
  gateway?: string,
): string {
  if (!isValidIp(ip)) return `Indirizzo IP non valido: ${ip}`;
  if (parseMask(mask) === null) return `Maschera non valida: ${mask}`;
  if (gateway && !isValidIp(gateway)) return `Gateway non valido: ${gateway}`;

  const device = getDevice(ctx.state, ctx.deviceId);
  if (!device) return "Dispositivo non trovato.";
  const iface = device.interfaces[0];
  if (!iface) return "Nessuna interfaccia.";

  ctx.setState(
    updateIface(ctx.state, ctx.deviceId, iface.id, {
      ip,
      mask,
      gateway: gateway ?? iface.gateway,
    }),
  );

  const cidr = maskToCidr(mask);
  return [
    "Configurazione IP aggiornata.",
    `  Interfaccia : ${iface.name}`,
    `  Indirizzo   : ${ip}/${cidr ?? "?"}`,
    `  Maschera    : ${mask}`,
    `  Gateway     : ${gateway ?? iface.gateway ?? "(nessuno)"}`,
  ].join("\n");
}

function arpTable(ctx: CommandContext): string {
  const device = getDevice(ctx.state, ctx.deviceId);
  const my = device?.interfaces[0];
  if (!my?.ip || !my.mask) {
    return "Nessuna voce ARP (configura prima un IP).";
  }
  const flood = l2Flood(ctx.state, ctx.deviceId, { sourceMac: my.mac });
  ctx.setState(flood.state);
  const lines = [
    "",
    "Interfaccia: Ethernet0 --- 0xffffffff",
    "  Indirizzo Internet      Indirizzo fisico      Tipo",
  ];
  const others = flood.hosts.filter(
    (n) => n.device.id !== ctx.deviceId && n.iface.ip,
  );
  for (const n of others) {
    lines.push(`  ${(n.iface.ip ?? "").padEnd(22)} ${n.iface.mac.padEnd(20)} dinamico`);
  }
  if (others.length === 0) {
    lines.push("  (vuota — collega i cavi / stessa VLAN)");
  }
  return lines.join("\n");
}

function routePrint(state: LabState, deviceId: string): string {
  const device = getDevice(state, deviceId);
  if (!device) return "Dispositivo non trovato.";
  const lines = [
    "===========================================================================",
    "Tabella di routing IPv4",
    "===========================================================================",
    "Itinerario attivo:",
    "Destinazione rete    Netmask          Gateway        Interfaccia  Metrica",
  ];
  let routes = 0;
  for (const iface of device.interfaces) {
    if (!iface.ip || !iface.mask) continue;
    const ip = parseIp(iface.ip);
    const mask = parseMask(iface.mask);
    if (ip === null || mask === null) continue;
    const net = formatIp((ip & mask) >>> 0);
    lines.push(
      `${net.padEnd(21)}${iface.mask.padEnd(17)}${"On-link".padEnd(15)}${iface.ip.padEnd(12)} 25`,
    );
    routes++;
    if (iface.gateway) {
      lines.push(
        `${"0.0.0.0".padEnd(21)}${"0.0.0.0".padEnd(17)}${iface.gateway.padEnd(15)}${iface.ip.padEnd(12)} 25`,
      );
      routes++;
    }
  }
  if (routes === 0) {
    lines.push("(nessuna rotta — configura un IP)");
  }
  lines.push("===========================================================================");
  return lines.join("\n");
}

export function runPcCommand(
  raw: string,
  ctx: CommandContext,
): CommandResult {
  const line = raw.trim();
  if (!line) return { output: "" };

  const lower = line.toLowerCase();
  const parts = line.split(/\s+/);

  if (lower === "help" || lower === "/?") return { output: helpPc() };
  if (lower === "cls" || lower === "clear") return { output: "", clear: true };
  if (lower === "hostname") {
    const d = getDevice(ctx.state, ctx.deviceId);
    return { output: d?.name ?? "" };
  }

  if (lower === "ipconfig") return { output: ipconfig(ctx.state, ctx.deviceId, false) };
  if (lower === "ipconfig /all") return { output: ipconfig(ctx.state, ctx.deviceId, true) };

  if (lower.startsWith("ipconfig /ip")) {
    const ip = parts[2];
    const mask = parts[3];
    const gw = parts[4];
    if (!ip || !mask) {
      return {
        output:
          "Sintassi: ipconfig /ip <indirizzo> <maschera> [gateway]\nEsempio: ipconfig /ip 192.168.1.10 255.255.255.0 192.168.1.1",
      };
    }
    return { output: setIp(ctx, ip, mask, gw) };
  }

  if (lower.startsWith("ping ")) {
    const target = parts[1];
    if (!target) return { output: "Uso: ping <indirizzo>" };
    const { result, state } = runPing(ctx.state, ctx.deviceId, target);
    ctx.setState(state);
    return { output: result.message };
  }

  if (lower === "arp -a" || lower === "arp") {
    return { output: arpTable(ctx) };
  }

  if (lower === "route print" || lower === "route") {
    return { output: routePrint(ctx.state, ctx.deviceId) };
  }

  return {
    output: `'${parts[0]}' non è riconosciuto come comando interno o esterno,\nun programma eseguibile o un file batch.\nDigita help per l'elenco comandi.`,
  };
}

export type RouterCliMode =
  | "user"
  | "enable"
  | "config"
  | "config-if"
  | "config-vlan";

export type RouterCliState = {
  mode: RouterCliMode;
  ifaceId: string | null;
  vlanId: number | null;
  hostname: string;
};

export function initialRouterCli(hostname: string): RouterCliState {
  return { mode: "user", ifaceId: null, vlanId: null, hostname };
}

export function routerPrompt(cli: RouterCliState): string {
  if (cli.mode === "user") return `${cli.hostname}>`;
  if (cli.mode === "enable") return `${cli.hostname}#`;
  if (cli.mode === "config") return `${cli.hostname}(config)#`;
  if (cli.mode === "config-vlan") return `${cli.hostname}(config-vlan)#`;
  return `${cli.hostname}(config-if)#`;
}

function helpSwitch(): string {
  return [
    "Comandi switch L2 (stile Cisco IOS):",
    "  enable",
    "  show vlan brief",
    "  show mac address-table",
    "  show interfaces status",
    "  show interfaces trunk",
    "  show ip interface brief",
    "  configure terminal",
    "  vlan <id>",
    "  name <nome>                 (in config-vlan)",
    "  interface FastEthernet0/1",
    "  switchport mode access|trunk",
    "  switchport access vlan <id>",
    "  switchport trunk native vlan <id>",
    "  switchport trunk allowed vlan all|<lista>",
    "  no shutdown / shutdown",
    "  exit / end",
    "  help",
    "",
    "Esempio VLAN:",
    "  enable → conf t → vlan 10 → name SALES → exit",
    "  interface Fa0/1 → switchport mode access → switchport access vlan 10",
  ].join("\n");
}

function findIfaceByName(device: NonNullable<ReturnType<typeof getDevice>>, name: string) {
  const n = name.toLowerCase().replace(/\s+/g, "");
  return device.interfaces.find((i) => {
    const full = i.name.toLowerCase().replace(/\s+/g, "");
    const short = full
      .replace("fastethernet", "fa")
      .replace("gigabitethernet", "gi")
      .replace("ethernet", "et");
    return full === n || short === n || full.endsWith(n);
  });
}

export function runRouterCommand(
  raw: string,
  ctx: CommandContext,
  cli: RouterCliState,
  setCli: (next: RouterCliState) => void,
): CommandResult {
  const line = raw.trim();
  if (!line) return { output: "" };
  const lower = line.toLowerCase();
  const parts = line.split(/\s+/);
  const device = getDevice(ctx.state, ctx.deviceId);
  if (!device) return { output: "Dispositivo non trovato." };

  if (lower === "help" || lower === "?") {
    return { output: helpRouter() + "\n\n--- Switch L2 ---\n" + helpSwitch() };
  }
  if (lower === "cls" || lower === "clear") return { output: "", clear: true };

  if (lower === "enable") {
    setCli({ ...cli, mode: "enable" });
    return { output: "" };
  }

  if (lower === "disable" || (lower === "exit" && cli.mode === "enable")) {
    setCli({ ...cli, mode: "user" });
    return { output: "" };
  }

  if (
    (lower === "configure terminal" || lower === "conf t" || lower === "config t") &&
    (cli.mode === "enable" || cli.mode === "config")
  ) {
    setCli({ ...cli, mode: "config" });
    return { output: "Enter configuration commands, one per line. End with CNTL/Z." };
  }

  if (lower === "exit" || lower === "end") {
    if (cli.mode === "config-if") {
      setCli({ ...cli, mode: "config", ifaceId: null });
      return { output: "" };
    }
    if (cli.mode === "config-vlan") {
      setCli({ ...cli, mode: "config", vlanId: null });
      return { output: "" };
    }
    if (cli.mode === "config") {
      setCli({ ...cli, mode: "enable" });
      return { output: "" };
    }
    if (cli.mode === "enable") {
      setCli({ ...cli, mode: "user" });
      return { output: "" };
    }
    return { output: "" };
  }

  if (lower.startsWith("hostname ") && (cli.mode === "config" || cli.mode === "enable")) {
    const name = parts[1];
    if (!name) return { output: "% Incomplete command." };
    setCli({ ...cli, hostname: name });
    ctx.setState({
      ...ctx.state,
      devices: ctx.state.devices.map((d) =>
        d.id === ctx.deviceId ? { ...d, name } : d,
      ),
    });
    return { output: "" };
  }

  if (lower.startsWith("interface ") && cli.mode === "config") {
    const name = parts.slice(1).join(" ");
    // Subinterface: Gi0/0.10
    const sub = name.match(/^(.+)\.(\d+)$/);
    if (sub) {
      const parentName = sub[1];
      const tag = Number(sub[2]);
      const parent = findIfaceByName(device, parentName);
      if (!parent || parent.parentIfaceId) {
        return { output: `% Invalid parent interface: ${parentName}` };
      }
      const created = createSubinterface(
        ctx.state,
        ctx.deviceId,
        parent.id,
        tag,
      );
      if (created.error || !created.iface) {
        return { output: created.error ?? "% Failed" };
      }
      ctx.setState(created.state);
      setCli({
        ...cli,
        mode: "config-if",
        ifaceId: created.iface.id,
        vlanId: null,
      });
      return { output: "" };
    }
    const iface = findIfaceByName(device, name);
    if (!iface) {
      return {
        output: `% Invalid input detected\nInterfacce: ${device.interfaces
          .slice(0, 8)
          .map((i) => i.name)
          .join(", ")}…`,
      };
    }
    setCli({ ...cli, mode: "config-if", ifaceId: iface.id, vlanId: null });
    return { output: "" };
  }

  if (
    (lower.startsWith("encapsulation dot1q ") ||
      lower.startsWith("encapsulation dot1Q ")) &&
    cli.mode === "config-if" &&
    cli.ifaceId
  ) {
    const tag = Number(parts[2]);
    if (!Number.isInteger(tag) || tag < 1 || tag > 4094) {
      return { output: "% Invalid VLAN id" };
    }
    const iface = device.interfaces.find((i) => i.id === cli.ifaceId);
    if (!iface?.parentIfaceId) {
      return { output: "% encapsulation only on subinterfaces" };
    }
    const parent = device.interfaces.find((i) => i.id === iface.parentIfaceId);
    const newName = `${parent?.name ?? "If"}.${tag}`;
    ctx.setState({
      ...ctx.state,
      devices: ctx.state.devices.map((d) => {
        if (d.id !== ctx.deviceId) return d;
        return {
          ...d,
          interfaces: d.interfaces.map((i) =>
            i.id === cli.ifaceId
              ? { ...i, vlanTag: tag, accessVlan: tag, name: newName }
              : i,
          ),
        };
      }),
    });
    return { output: "" };
  }

  // ---- VLAN / switchport (L2) ----
  if (lower.startsWith("vlan ") && cli.mode === "config") {
    const id = Number(parts[1]);
    if (!Number.isInteger(id) || id < 1 || id > 4094) {
      return { output: "% Invalid VLAN id (1-4094)" };
    }
    const vlans: VlanRecord[] = [...(device.vlans ?? [{ id: 1, name: "default" }])];
    if (!vlans.some((v) => v.id === id)) {
      vlans.push({ id, name: `VLAN${id}` });
      vlans.sort((a, b) => a.id - b.id);
      ctx.setState(updateDevice(ctx.state, ctx.deviceId, { vlans }));
    }
    setCli({ ...cli, mode: "config-vlan", vlanId: id, ifaceId: null });
    return { output: "" };
  }

  if (lower.startsWith("name ") && cli.mode === "config-vlan" && cli.vlanId != null) {
    const name = parts.slice(1).join(" ") || `VLAN${cli.vlanId}`;
    const vlans = [...(device.vlans ?? [{ id: 1, name: "default" }])];
    const idx = vlans.findIndex((v) => v.id === cli.vlanId);
    if (idx >= 0) vlans[idx] = { ...vlans[idx], name };
    else vlans.push({ id: cli.vlanId, name });
    ctx.setState(updateDevice(ctx.state, ctx.deviceId, { vlans }));
    return { output: "" };
  }

  if (
    (lower === "switchport mode access" || lower === "switchport mode trunk") &&
    cli.mode === "config-if" &&
    cli.ifaceId
  ) {
    const mode = lower.endsWith("trunk") ? "trunk" : "access";
    ctx.setState(
      updateIface(ctx.state, ctx.deviceId, cli.ifaceId, { mode }),
    );
    return { output: "" };
  }

  if (
    lower.startsWith("switchport access vlan ") &&
    cli.mode === "config-if" &&
    cli.ifaceId
  ) {
    const id = Number(parts[3]);
    if (!Number.isInteger(id) || id < 1 || id > 4094) {
      return { output: "% Invalid VLAN id" };
    }
    let next = updateIface(ctx.state, ctx.deviceId, cli.ifaceId, {
      mode: "access",
      accessVlan: id,
    });
    const d = getDevice(next, ctx.deviceId)!;
    const vlans = [...(d.vlans ?? [{ id: 1, name: "default" }])];
    if (!vlans.some((v) => v.id === id)) {
      vlans.push({ id, name: `VLAN${id}` });
      vlans.sort((a, b) => a.id - b.id);
      next = updateDevice(next, ctx.deviceId, { vlans });
    }
    ctx.setState(next);
    return { output: "" };
  }

  if (
    lower.startsWith("switchport trunk native vlan ") &&
    cli.mode === "config-if" &&
    cli.ifaceId
  ) {
    const id = Number(parts[4]);
    if (!Number.isInteger(id) || id < 1 || id > 4094) {
      return { output: "% Invalid VLAN id" };
    }
    ctx.setState(
      updateIface(ctx.state, ctx.deviceId, cli.ifaceId, {
        mode: "trunk",
        nativeVlan: id,
      }),
    );
    return { output: "" };
  }

  if (
    lower.startsWith("switchport trunk allowed vlan ") &&
    cli.mode === "config-if" &&
    cli.ifaceId
  ) {
    const rest = parts.slice(4).join("").toLowerCase();
    if (rest === "all") {
      ctx.setState(
        updateIface(ctx.state, ctx.deviceId, cli.ifaceId, {
          mode: "trunk",
          allowedVlans: "all",
        }),
      );
      return { output: "" };
    }
    const ids = rest
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 4094);
    if (ids.length === 0) return { output: "% Incomplete command." };
    ctx.setState(
      updateIface(ctx.state, ctx.deviceId, cli.ifaceId, {
        mode: "trunk",
        allowedVlans: ids,
      }),
    );
    return { output: "" };
  }

  if (
    (lower === "show vlan brief" ||
      lower === "show vlan" ||
      lower === "sh vlan brief" ||
      lower === "sh vlan") &&
    (cli.mode === "enable" || cli.mode === "user")
  ) {
    return { output: formatVlanBrief(device) };
  }

  if (
    (lower === "show mac address-table" ||
      lower === "show mac-address-table" ||
      lower === "sh mac address-table" ||
      lower === "show mac") &&
    (cli.mode === "enable" || cli.mode === "user")
  ) {
    return { output: formatMacTable(device) };
  }

  if (
    (lower === "show interfaces status" || lower === "show int status") &&
    (cli.mode === "enable" || cli.mode === "user")
  ) {
    return { output: formatInterfacesStatus(device) };
  }

  if (
    (lower === "show interfaces trunk" || lower === "show int trunk") &&
    (cli.mode === "enable" || cli.mode === "user")
  ) {
    return { output: formatInterfacesTrunk(device) };
  }

  if (lower.startsWith("ip address ") && cli.mode === "config-if" && cli.ifaceId) {
    const ip = parts[2];
    const mask = parts[3];
    if (!ip || !mask) return { output: "% Incomplete command." };
    if (!isValidIp(ip) || parseMask(mask) === null) {
      return { output: "% Invalid IP address or mask" };
    }
    ctx.setState(
      updateIface(ctx.state, ctx.deviceId, cli.ifaceId, { ip, mask }),
    );
    return { output: "" };
  }

  if (
    (lower === "no shutdown" || lower === "no shut") &&
    cli.mode === "config-if" &&
    cli.ifaceId
  ) {
    ctx.setState(
      updateIface(ctx.state, ctx.deviceId, cli.ifaceId, { enabled: true }),
    );
    return { output: "" };
  }

  if (lower === "shutdown" && cli.mode === "config-if" && cli.ifaceId) {
    ctx.setState(
      updateIface(ctx.state, ctx.deviceId, cli.ifaceId, { enabled: false }),
    );
    return { output: "" };
  }

  if (
    (lower === "show ip interface brief" || lower === "sh ip int br") &&
    (cli.mode === "enable" || cli.mode === "user")
  ) {
    const header =
      "Interface                  IP-Address      OK? Method Status                Protocol";
    const rows = device.interfaces.map((i) => {
      const status = i.enabled ? "up" : "administratively down";
      const proto = i.enabled && i.connectedLinkId ? "up" : "down";
      return `${i.name.padEnd(27)}${(i.ip ?? "unassigned").padEnd(16)}YES manual ${status.padEnd(22)}${proto}`;
    });
    return { output: [header, ...rows].join("\n") };
  }

  if (
    (lower === "show interfaces" || lower === "show int") &&
    (cli.mode === "enable" || cli.mode === "user")
  ) {
    const blocks = device.interfaces.map((i) => {
      const lineProto = i.connectedLinkId ? "up" : "down";
      return [
        `${i.name} is ${i.enabled ? "up" : "administratively down"}, line protocol is ${lineProto}`,
        `  Hardware is Gigabit Ethernet, address is ${i.mac}`,
        i.ip
          ? `  Internet address is ${i.ip}/${maskToCidr(i.mask ?? "255.255.255.0") ?? 24}`
          : `  Internet protocol processing disabled`,
      ].join("\n");
    });
    return { output: blocks.join("\n") };
  }

  if (lower.startsWith("ping ") && (cli.mode === "enable" || cli.mode === "user")) {
    const target = parts[1];
    if (!target) return { output: "% Incomplete command." };
    const { result, state } = runPing(ctx.state, ctx.deviceId, target);
    ctx.setState(state);
    if (result.ok) {
      return {
        output: [
          `Type escape sequence to abort.`,
          `Sending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:`,
          `!!!!!`,
          `Success rate is 100 percent (5/5), round-trip min/avg/max = ${result.rttMs}/${result.rttMs + 1}/${result.rttMs + 2} ms`,
        ].join("\n"),
      };
    }
    return {
      output: [
        `Type escape sequence to abort.`,
        `Sending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:`,
        `.....`,
        `Success rate is 0 percent (0/5)`,
        result.message.split("\n")[0],
      ].join("\n"),
    };
  }

  return { output: `% Unknown command / incomplete command: "${line}"\nDigita help` };
}

/** Alias: same CLI engine, switch-oriented welcome/help */
export function runSwitchCommand(
  raw: string,
  ctx: CommandContext,
  cli: RouterCliState,
  setCli: (next: RouterCliState) => void,
): CommandResult {
  const lower = raw.trim().toLowerCase();
  if (lower === "help" || lower === "?") return { output: helpSwitch() };
  return runRouterCommand(raw, ctx, cli, setCli);
}
