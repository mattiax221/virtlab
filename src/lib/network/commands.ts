import {
  getDevice,
  runPing,
  updateIface,
} from "./engine";
import { formatIp, isValidIp, maskToCidr, parseIp, parseMask, sameSubnet } from "./ip";
import type { CommandResult, LabState } from "./types";

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
    "  interface <nome>         es. interface GigabitEthernet0/0",
    "  ip address <ip> <mask>",
    "  no shutdown",
    "  exit",
    "  ping <indirizzo>",
    "  hostname <nome>",
    "  help",
    "",
    "Flusso tipico:",
    "  enable",
    "  configure terminal",
    "  interface GigabitEthernet0/0",
    "  ip address 192.168.1.1 255.255.255.0",
    "  no shutdown",
    "  exit",
    "  exit",
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

function l2Neighbors(
  state: LabState,
  deviceId: string,
): { deviceId: string; ip: string; mac: string }[] {
  const device = getDevice(state, deviceId);
  const my = device?.interfaces[0];
  const result: { deviceId: string; ip: string; mac: string }[] = [];
  if (!my?.ip || !my.mask) return result;

  const visited = new Set<string>();
  const queue = [deviceId];
  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const d = getDevice(state, id);
    if (!d) continue;
    if (d.type !== "switch") {
      for (const iface of d.interfaces) {
        if (iface.ip && sameSubnet(my.ip, iface.ip, my.mask)) {
          result.push({ deviceId: d.id, ip: iface.ip, mac: iface.mac });
        }
      }
    }
    for (const iface of d.interfaces) {
      if (!iface.connectedLinkId) continue;
      const link = state.links.find((l) => l.id === iface.connectedLinkId);
      if (!link) continue;
      const other = link.aDeviceId === id ? link.bDeviceId : link.aDeviceId;
      if (!visited.has(other)) queue.push(other);
    }
  }
  return result;
}

function arpTable(state: LabState, deviceId: string): string {
  const device = getDevice(state, deviceId);
  if (!device?.interfaces[0]?.ip) {
    return "Nessuna voce ARP (configura prima un IP).";
  }
  const neighbors = l2Neighbors(state, deviceId);
  const lines = [
    "",
    "Interfaccia: Ethernet0 --- 0xffffffff",
    "  Indirizzo Internet      Indirizzo fisico      Tipo",
  ];
  const others = neighbors.filter((n) => n.deviceId !== deviceId);
  for (const n of others) {
    lines.push(`  ${n.ip.padEnd(22)} ${n.mac.padEnd(20)} dinamico`);
  }
  if (others.length === 0) {
    lines.push("  (vuota — collega i cavi e configura gli IP)");
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
    const result = runPing(ctx.state, ctx.deviceId, target);
    return { output: result.message };
  }

  if (lower === "arp -a" || lower === "arp") {
    return { output: arpTable(ctx.state, ctx.deviceId) };
  }

  if (lower === "route print" || lower === "route") {
    return { output: routePrint(ctx.state, ctx.deviceId) };
  }

  return {
    output: `'${parts[0]}' non è riconosciuto come comando interno o esterno,\nun programma eseguibile o un file batch.\nDigita help per l'elenco comandi.`,
  };
}

export type RouterCliMode = "user" | "enable" | "config" | "config-if";

export type RouterCliState = {
  mode: RouterCliMode;
  ifaceId: string | null;
  hostname: string;
};

export function initialRouterCli(hostname: string): RouterCliState {
  return { mode: "user", ifaceId: null, hostname };
}

export function routerPrompt(cli: RouterCliState): string {
  if (cli.mode === "user") return `${cli.hostname}>`;
  if (cli.mode === "enable") return `${cli.hostname}#`;
  if (cli.mode === "config") return `${cli.hostname}(config)#`;
  return `${cli.hostname}(config-if)#`;
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

  if (lower === "help" || lower === "?") return { output: helpRouter() };
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
    const iface = device.interfaces.find(
      (i) => i.name.toLowerCase() === name.toLowerCase(),
    );
    if (!iface) {
      return {
        output: `% Invalid input detected\nInterfacce: ${device.interfaces.map((i) => i.name).join(", ")}`,
      };
    }
    setCli({ ...cli, mode: "config-if", ifaceId: iface.id });
    return { output: "" };
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
    const result = runPing(ctx.state, ctx.deviceId, target);
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
