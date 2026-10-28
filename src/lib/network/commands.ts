import { formatArpTable, learnArp } from "./arp";
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
  formatSpanningTree,
  formatVlanBrief,
  l2Flood,
} from "./l2";
import {
  fetchHttp,
  releaseDhcp,
  requestDhcp,
  resolveDnsQuery,
} from "./services";
import { authenticateAaa } from "./aaa";
import { syncNtp } from "./telemetry";
import type { CommandResult, LabState, StaticRoute, VlanRecord } from "./types";

type FtpSession = {
  serverId: string;
  serverIp: string;
  user: string | null;
  authed: boolean;
};

const ftpSessions = new Map<string, FtpSession>();

export type CommandContext = {
  state: LabState;
  deviceId: string;
  setState: (next: LabState) => void;
};

function helpPc(): string {
  return [
    "Comandi disponibili (stile Windows CMD / Packet Tracer):",
    "  ipconfig                 Mostra la configurazione IP",
    "  ipconfig /all            Dettagli completi (MAC, gateway)",
    "  ipconfig /ip <ip> <mask> [gateway]",
    "                           Imposta IP statico",
    "  ipconfig /renew          Richiede IP via DHCP",
    "  ipconfig /release        Rilascia lease DHCP",
    "  ping <indirizzo|nome>    ICMP (anche nomi DNS tipo server.lab)",
    "  nslookup <nome>          Query DNS",
    "  http <host>              GET HTTP su Server-PT",
    "  ftp <host>               Sessione FTP (user/pass, dir, get, bye)",
    "  ntp sync                 Sincronizza orologio da Server-PT NTP",
    "  dir / delete <file>      File locali (simulati)",
    "  arp -a                   Cache ARP reale (imparata dai ping)",
    "  route print              Tabella di routing",
    "  netstat                  Connessioni simulazione",
    "  hostname                 Nome del PC",
    "  cls / clear              Pulisce lo schermo",
    "  help                     Questo aiuto",
    "",
    "Esempio:",
    "  ipconfig /renew",
    "  nslookup www.lab",
    "  ping server.lab",
    "  http www.lab",
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
    "  clock rate <bps>              Serial DCE (es. 64000)",
    "  no shutdown",
    "  access-list <n> permit|deny ip|icmp <src> <dst>",
    "  ip access-group <n> in|out",
    "  show access-lists",
    "  show arp / show ip arp    Tabella ARP",
    "  show ip route             Rotte connesse + statiche",
    "  ip route <rete> <mask> <next-hop>",
    "  no ip route <rete> <mask> [next-hop]",
    "  exit",
    "  ping <indirizzo>",
    "  hostname <nome>",
    "  copy tftp flash <ip> <file>   Scarica IOS dal Server-PT TFTP",
    "  show flash                    Immagini in flash",
    "  ntp sync                      Sincronizza da Server-PT NTP",
    "  aaa new-model / radius-server host <ip> key <secret>",
    "  aaa authentication enable default group radius",
    "  help",
    "",
    "Inter-VLAN (router-on-a-stick):",
    "  conf t",
    "  interface GigabitEthernet0/0.10",
    "  encapsulation dot1Q 10",
    "  ip address 192.168.10.1 255.255.255.0",
    "  no shutdown",
    "  (ripeti per .20) — sullo switch: porta verso router in trunk",
    "",
    "Routing statico tra due router:",
    "  ip route 192.168.2.0 255.255.255.0 10.0.0.2",
    "",
    "WAN seriale: Physical → Serial WIC → cavo Serial → clock rate sul DCE",
    "ACL: access-list 100 deny icmp any host 192.168.1.100",
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

function preferredHostIface(device: NonNullable<ReturnType<typeof getDevice>>) {
  // Prefer the plugged Ethernet NIC (PC↔Switch), never the idle Wi‑Fi by default
  return (
    device.interfaces.find(
      (i) =>
        !i.parentIfaceId &&
        i.enabled &&
        i.connectedLinkId &&
        (i.media === "ethernet" || i.media === "fiber"),
    ) ??
    device.interfaces.find(
      (i) =>
        !i.parentIfaceId &&
        i.enabled &&
        (i.media === "ethernet" || i.media === "fiber"),
    ) ??
    device.interfaces.find((i) => !i.parentIfaceId && i.connectedLinkId) ??
    device.interfaces.find((i) => !i.parentIfaceId) ??
    device.interfaces[0]
  );
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
  const iface = preferredHostIface(device);
  if (!iface) return "Nessuna interfaccia.";

  ctx.setState(
    updateIface(ctx.state, ctx.deviceId, iface.id, {
      ip,
      mask,
      gateway: gateway ?? iface.gateway,
      dhcpClient: false,
    }),
  );

  const cidr = maskToCidr(mask);
  const warn = !iface.connectedLinkId
    ? "\nAttenzione: questa porta non ha un cavo collegato."
    : iface.media === "wireless"
      ? "\nNota: IP sulla Wi‑Fi — per lo switch usa Ethernet."
      : "";
  return [
    "Configurazione IP aggiornata.",
    `  Interfaccia : ${iface.name}`,
    `  Indirizzo   : ${ip}/${cidr ?? "?"}`,
    `  Maschera    : ${mask}`,
    `  Gateway     : ${gateway ?? iface.gateway ?? "(nessuno)"}`,
    warn,
  ]
    .filter(Boolean)
    .join("\n");
}

function arpTable(ctx: CommandContext): string {
  const device = getDevice(ctx.state, ctx.deviceId);
  if (!device) return "Dispositivo non trovato.";
  const cached = device.arpTable ?? [];
  if (cached.length > 0) {
    const lines = [
      "",
      "Interfaccia: Ethernet0 --- 0xffffffff",
      "  Indirizzo Internet      Indirizzo fisico      Tipo",
    ];
    for (const e of cached) {
      lines.push(
        `  ${e.ip.padEnd(22)} ${e.mac.padEnd(20)} ${e.type === "static" ? "statico" : "dinamico"}`,
      );
    }
    return lines.join("\n");
  }
  // Prima consultazione: scopri i vicini L2 e popola la cache
  const my = device.interfaces.find((i) => i.ip && i.mask);
  if (!my?.ip || !my.mask) {
    return "Nessuna voce ARP (configura prima un IP).";
  }
  const flood = l2Flood(ctx.state, ctx.deviceId, { sourceMac: my.mac });
  let next = flood.state;
  for (const n of flood.hosts) {
    if (n.device.id === ctx.deviceId || !n.iface.ip) continue;
    next = learnArp(next, ctx.deviceId, n.iface.ip, n.iface.mac, my.id);
  }
  ctx.setState(next);
  const updated = getDevice(next, ctx.deviceId);
  if (!updated) return "Dispositivo non trovato.";
  const rows = updated.arpTable ?? [];
  const lines = [
    "",
    "Interfaccia: Ethernet0 --- 0xffffffff",
    "  Indirizzo Internet      Indirizzo fisico      Tipo",
  ];
  for (const e of rows) {
    lines.push(
      `  ${e.ip.padEnd(22)} ${e.mac.padEnd(20)} ${e.type === "static" ? "statico" : "dinamico"}`,
    );
  }
  if (rows.length === 0) {
    lines.push("  (vuota — collega i cavi / stessa VLAN, poi ping)");
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

  if (lower === "ipconfig /renew" || lower === "ipconfig /release") {
    const device = getDevice(ctx.state, ctx.deviceId);
    const iface = device ? preferredHostIface(device) : undefined;
    if (!iface) return { output: "Nessuna interfaccia." };
    if (lower.endsWith("/release")) {
      const res = releaseDhcp(ctx.state, ctx.deviceId, iface.id);
      ctx.setState(res.state);
      return { output: res.message };
    }
    const res = requestDhcp(ctx.state, ctx.deviceId, iface.id);
    ctx.setState(res.state);
    return { output: res.message };
  }

  if (lower.startsWith("ping ")) {
    const target = parts[1];
    if (!target) return { output: "Uso: ping <indirizzo|nome>" };
    const { result, state } = runPing(ctx.state, ctx.deviceId, target);
    ctx.setState(state);
    return { output: result.message };
  }

  if (lower.startsWith("http ") || lower.startsWith("curl ")) {
    const target = parts[1]?.replace(/^https?:\/\//, "");
    if (!target) return { output: "Uso: http <host|ip>" };
    const probe = fetchHttp(ctx.state, ctx.deviceId, target);
    const dest = probe.destIp ?? target;
    const { result, state } = runPing(ctx.state, ctx.deviceId, dest);
    ctx.setState(state);
    if (!result.ok) {
      return {
        output: `HTTP fallito: host non raggiungibile.\n${result.message.split("\n")[0]}`,
      };
    }
    const res = fetchHttp(state, ctx.deviceId, target, { reachable: true });
    return { output: res.output };
  }

  if (lower.startsWith("nslookup ")) {
    const name = parts[1];
    if (!name) return { output: "Uso: nslookup <nome>" };
    const device = getDevice(ctx.state, ctx.deviceId);
    const dns =
      device?.interfaces.find((i) => i.dnsServers.length)?.dnsServers[0] ??
      "???";
    const { ip, state } = resolveDnsQuery(ctx.state, ctx.deviceId, name);
    ctx.setState(state);
    if (!ip) {
      return {
        output: [
          `Server:  ${dns}`,
          `Address:  ${dns}`,
          ``,
          `*** ${dns} non trova ${name}: Non-existent domain`,
        ].join("\n"),
      };
    }
    return {
      output: [
        `Server:  ${dns}`,
        `Address:  ${dns}`,
        ``,
        `Nome:    ${name}`,
        `Address:  ${ip}`,
        ``,
        `(cache DNS aggiornata, TTL 300s)`,
      ].join("\n"),
    };
  }

  const ftpSession = ftpSessions.get(ctx.deviceId);
  if (ftpSession) {
    return handleFtpSession(raw, ctx, ftpSession);
  }

  if (lower.startsWith("ftp ")) {
    const target = parts[1];
    if (!target) return { output: "Uso: ftp <host|ip>" };
    return startFtpSession(ctx, target);
  }

  if (lower === "ntp sync" || lower === "w32tm /resync") {
    const res = syncNtp(ctx.state, ctx.deviceId);
    ctx.setState(res.state);
    return { output: res.message };
  }

  if (lower === "dir" || lower === "dir /") {
    return {
      output: [
        ` Directory of C:\\Users\\Studente`,
        ``,
        `01/01/2026  12:00    <DIR>          .`,
        `01/01/2026  12:00    <DIR>          ..`,
        `01/01/2026  12:00                48 readme.txt`,
        `               1 File(s)             48 bytes`,
      ].join("\n"),
    };
  }

  if (lower.startsWith("delete ") || lower.startsWith("del ")) {
    const file = parts[1];
    if (!file) return { output: "Uso: delete <file>" };
    return { output: `Eliminato ${file}` };
  }

  if (lower === "netstat") {
    return {
      output: [
        `Connessioni attive`,
        ``,
        `  Proto  Indirizzo locale          Indirizzo esterno        Stato`,
        `  TCP    0.0.0.0:0                 0.0.0.0:0                LISTENING`,
      ].join("\n"),
    };
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

function startFtpSession(ctx: CommandContext, target: string): CommandResult {
  let ip = target;
  let state = ctx.state;
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(target)) {
    const q = resolveDnsQuery(state, ctx.deviceId, target);
    state = q.state;
    if (!q.ip) return { output: `ftp: Impossibile risolvere ${target}` };
    ip = q.ip;
  }
  const { result, state: afterPing } = runPing(state, ctx.deviceId, ip);
  ctx.setState(afterPing);
  if (!result.ok) {
    return {
      output: `ftp: connessione a ${ip} fallita — host non raggiungibile`,
    };
  }
  const server = afterPing.devices.find(
    (d) => d.interfaces.some((i) => i.ip === ip) && d.services?.ftp,
  );
  if (!server?.services?.ftp?.enabled) {
    return { output: `ftp: nessun servizio FTP attivo su ${ip}` };
  }
  ftpSessions.set(ctx.deviceId, {
    serverId: server.id,
    serverIp: ip,
    user: null,
    authed: false,
  });
  return {
    output: [
      `Connected to ${server.name} (${ip}).`,
      `220 ${server.name} FTP server (NetLab) ready.`,
      `Name (${ip}): (digita: user <nome>)`,
      `Comandi: user <u> | pass <p> | dir | get <file> | bye`,
    ].join("\n"),
  };
}

function handleFtpSession(
  raw: string,
  ctx: CommandContext,
  session: FtpSession,
): CommandResult {
  const line = raw.trim();
  const lower = line.toLowerCase();
  const parts = line.split(/\s+/);
  const server = getDevice(ctx.state, session.serverId);
  const ftp = server?.services?.ftp;

  if (!server || !ftp?.enabled) {
    ftpSessions.delete(ctx.deviceId);
    return { output: "421 Service not available — sessione chiusa." };
  }

  if (lower === "bye" || lower === "quit" || lower === "exit") {
    ftpSessions.delete(ctx.deviceId);
    return { output: "221 Goodbye." };
  }

  if (lower.startsWith("user ")) {
    const user = parts[1];
    if (!user) return { output: "503 Specify USER." };
    session.user = user;
    session.authed = false;
    ftpSessions.set(ctx.deviceId, session);
    return { output: `331 Password required for ${user}.\n(usa: pass <password>)` };
  }

  if (lower.startsWith("pass ")) {
    if (!session.user) return { output: "503 Login with USER first." };
    const pass = parts.slice(1).join(" ");
    const acc = ftp.accounts.find((a) => a.username === session.user);
    if (!acc || acc.password !== pass) {
      session.authed = false;
      ftpSessions.set(ctx.deviceId, session);
      return { output: "530 Login incorrect." };
    }
    session.authed = true;
    ftpSessions.set(ctx.deviceId, session);
    return { output: `230 User ${session.user} logged in.` };
  }

  if (!session.authed) {
    return {
      output:
        "530 Please login with USER and PASS.\n(es. user cisco  poi  pass cisco)",
    };
  }

  const acc = ftp.accounts.find((a) => a.username === session.user)!;

  if (lower === "dir" || lower === "ls" || lower === "list") {
    if (!acc.permissions.list) return { output: "550 Permission denied (LIST)." };
    const files =
      ftp.files.length === 0
        ? "  (vuoto)"
        : ftp.files
            .map((f) => `-rw-r--r-- 1 ftp ftp ${String(f.size).padStart(6)} ${f.name}`)
            .join("\n");
    return { output: `200 PORT command successful.\n150 Opening ASCII mode.\n${files}\n226 Transfer complete.` };
  }

  if (lower.startsWith("get ") || lower.startsWith("recv ")) {
    if (!acc.permissions.read) return { output: "550 Permission denied (READ)." };
    const file = parts[1];
    if (!file) return { output: "Uso: get <file>" };
    const found = ftp.files.find((f) => f.name === file);
    if (!found) return { output: `550 ${file}: No such file.` };
    return {
      output: [
        `200 PORT command successful.`,
        `150 Opening BINARY mode data connection for ${file} (${found.size} bytes).`,
        `226 Transfer complete.`,
        `ftp: ${found.size} bytes received.`,
      ].join("\n"),
    };
  }

  if (lower.startsWith("delete ") || lower.startsWith("rm ")) {
    if (!acc.permissions.delete) {
      return { output: "550 Permission denied (DELETE)." };
    }
    const file = parts[1];
    if (!file) return { output: "Uso: delete <file>" };
    if (!ftp.files.some((f) => f.name === file)) {
      return { output: `550 ${file}: No such file.` };
    }
    const nextFiles = ftp.files.filter((f) => f.name !== file);
    ctx.setState({
      ...ctx.state,
      devices: ctx.state.devices.map((d) =>
        d.id === server.id
          ? {
              ...d,
              services: {
                ...d.services,
                ftp: { ...ftp, files: nextFiles },
              },
            }
          : d,
      ),
    });
    return { output: `250 DELE command successful.` };
  }

  return {
    output: `500 Unknown command '${parts[0]}'.\nComandi: user | pass | dir | get | delete | bye`,
  };
}

export type RouterCliMode =
  | "user"
  | "enable"
  | "config"
  | "config-if"
  | "config-vlan"
  | "aaa-user"
  | "aaa-pass";

export type RouterCliState = {
  mode: RouterCliMode;
  ifaceId: string | null;
  vlanId: number | null;
  hostname: string;
  aaaUser?: string;
  prevMode?: RouterCliMode;
};

export function initialRouterCli(hostname: string): RouterCliState {
  return { mode: "user", ifaceId: null, vlanId: null, hostname };
}

export function routerPrompt(cli: RouterCliState): string {
  if (cli.mode === "aaa-user") return "Username: ";
  if (cli.mode === "aaa-pass") return "Password: ";
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
    "  show spanning-tree",
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

  if (cli.mode === "aaa-user") {
    const user = line.trim();
    if (!user) return { output: "Username: " };
    setCli({ ...cli, mode: "aaa-pass", aaaUser: user });
    return { output: "" };
  }

  if (cli.mode === "aaa-pass") {
    const pass = line;
    const user = cli.aaaUser ?? "";
    const auth = authenticateAaa(ctx.state, device, user, pass);
    ctx.setState(auth.state);
    if (!auth.ok) {
      setCli({ ...cli, mode: "user", aaaUser: undefined });
      return { output: auth.message };
    }
    setCli({
      ...cli,
      mode: "enable",
      aaaUser: undefined,
    });
    return { output: auth.message };
  }

  if (lower === "enable") {
    if (device.aaaConfig?.newModel && device.aaaConfig.authEnable) {
      setCli({ ...cli, mode: "aaa-user", aaaUser: undefined });
      return { output: "" };
    }
    setCli({ ...cli, mode: "enable" });
    return { output: "" };
  }

  if (lower === "disable" || (lower === "exit" && cli.mode === "enable")) {
    setCli({ ...cli, mode: "user" });
    return { output: "" };
  }

  if (lower === "aaa new-model" && cli.mode === "config") {
    ctx.setState({
      ...ctx.state,
      devices: ctx.state.devices.map((d) =>
        d.id === device.id
          ? {
              ...d,
              aaaConfig: {
                newModel: true,
                authEnable: d.aaaConfig?.authEnable ?? false,
                serverIp: d.aaaConfig?.serverIp ?? "",
                secret: d.aaaConfig?.secret ?? "cisco",
                type: d.aaaConfig?.type ?? "radius",
              },
            }
          : d,
      ),
    });
    return { output: "" };
  }

  if (lower.startsWith("radius-server host ") && cli.mode === "config") {
    const ip = parts[2];
    const keyIdx = parts.findIndex((p) => p.toLowerCase() === "key");
    const secret = keyIdx >= 0 ? parts[keyIdx + 1] : "cisco";
    if (!ip) return { output: "Uso: radius-server host <ip> key <secret>" };
    ctx.setState({
      ...ctx.state,
      devices: ctx.state.devices.map((d) =>
        d.id === device.id
          ? {
              ...d,
              aaaConfig: {
                newModel: d.aaaConfig?.newModel ?? true,
                authEnable: d.aaaConfig?.authEnable ?? false,
                serverIp: ip,
                secret: secret ?? "cisco",
                type: "radius",
              },
            }
          : d,
      ),
    });
    return { output: "" };
  }

  if (
    (lower === "aaa authentication enable default group radius" ||
      lower === "aaa authentication enable default group tacacs+") &&
    cli.mode === "config"
  ) {
    const type = lower.includes("tacacs") ? "tacacs" : "radius";
    ctx.setState({
      ...ctx.state,
      devices: ctx.state.devices.map((d) =>
        d.id === device.id
          ? {
              ...d,
              aaaConfig: {
                newModel: true,
                authEnable: true,
                serverIp: d.aaaConfig?.serverIp ?? "",
                secret: d.aaaConfig?.secret ?? "cisco",
                type,
              },
            }
          : d,
      ),
    });
    return { output: "" };
  }

  if (
    (lower === "ntp sync" || lower === "ntp update-calendar") &&
    (cli.mode === "enable" || cli.mode === "user")
  ) {
    const res = syncNtp(ctx.state, ctx.deviceId);
    ctx.setState(res.state);
    return { output: res.message };
  }

  if (
    lower === "show flash" &&
    (cli.mode === "enable" || cli.mode === "user")
  ) {
    const imgs = device.flashImages ?? [];
    if (imgs.length === 0) {
      return { output: "Directory of flash:/\n\nNo files found." };
    }
    return {
      output: [
        "Directory of flash:/",
        "",
        ...imgs.map(
          (f, i) =>
            `${String(i + 1).padStart(2)}.  ${String(f.sizeKb).padStart(8)} KB  ${f.name}`,
        ),
        "",
        `${imgs.length} file(s)`,
      ].join("\n"),
    };
  }

  if (
    lower.startsWith("copy tftp flash") &&
    (cli.mode === "enable" || cli.mode === "config")
  ) {
    // copy tftp flash <ip> <filename>
    const ip = parts[3];
    const file = parts[4];
    if (!ip || !file) {
      return {
        output:
          "Uso: copy tftp flash <server-ip> <filename>\nEsempio: copy tftp flash 192.168.1.100 c1900-universalk9-mz.SPA.151-4.M4.bin",
      };
    }
    const { result, state } = runPing(ctx.state, ctx.deviceId, ip);
    ctx.setState(state);
    if (!result.ok) {
      return { output: `%Error opening tftp://${ip}/${file} (Timed out)` };
    }
    const server = state.devices.find(
      (d) =>
        d.interfaces.some((i) => i.ip === ip) && d.services?.tftp?.enabled,
    );
    const image = server?.services?.tftp?.images.find((i) => i.name === file);
    if (!image) {
      return {
        output: `%Error opening tftp://${ip}/${file} (No such file)`,
      };
    }
    const flash = [
      ...(device.flashImages ?? []).filter((f) => f.name !== file),
      { name: image.name, sizeKb: image.sizeKb },
    ];
    ctx.setState({
      ...state,
      devices: state.devices.map((d) =>
        d.id === device.id ? { ...d, flashImages: flash } : d,
      ),
    });
    return {
      output: [
        `Accessing tftp://${ip}/${file}...`,
        `Loading ${file} from ${ip} (via FastEthernet0/0): !!!!!`,
        `[OK - ${image.sizeKb}KB]`,
        `${image.sizeKb * 1024} bytes copied in 0.120 secs`,
      ].join("\n"),
    };
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
    (lower === "show spanning-tree" ||
      lower === "show spanning-tree vlan 1" ||
      lower === "show stp") &&
    (cli.mode === "enable" || cli.mode === "user")
  ) {
    return { output: formatSpanningTree(device) };
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
    lower.startsWith("clock rate ") &&
    cli.mode === "config-if" &&
    cli.ifaceId
  ) {
    const rate = Number(parts[2]);
    if (!Number.isFinite(rate) || rate <= 0) {
      return { output: "% Incomplete command. Uso: clock rate 64000" };
    }
    const iface = device.interfaces.find((i) => i.id === cli.ifaceId);
    if (iface && iface.media !== "serial") {
      return { output: "% clock rate solo su interfacce Serial" };
    }
    ctx.setState(
      updateIface(ctx.state, ctx.deviceId, cli.ifaceId, { clockRate: rate }),
    );
    return { output: "" };
  }

  if (lower.startsWith("access-list ") && cli.mode === "config") {
    // access-list <n> permit|deny ip|icmp <src> <dst>
    const id = Number(parts[1]);
    const action = parts[2]?.toLowerCase();
    const protocol = (parts[3]?.toLowerCase() ?? "ip") as "ip" | "icmp" | "any";
    let src = parts[4];
    let dst = parts[5];
    if (src?.toLowerCase() === "host" && parts[5]) {
      src = `host ${parts[5]}`;
      dst = parts[6]?.toLowerCase() === "host" && parts[7] ? `host ${parts[7]}` : parts[6];
    } else if (dst?.toLowerCase() === "host" && parts[6]) {
      dst = `host ${parts[6]}`;
    }
    if (
      !Number.isInteger(id) ||
      id < 1 ||
      id > 199 ||
      (action !== "permit" && action !== "deny") ||
      !src ||
      !dst
    ) {
      return {
        output:
          "% Uso: access-list <1-199> permit|deny ip|icmp <src|any|host X> <dst|any|host Y>",
      };
    }
    const lists = [...(device.accessLists ?? [])];
    const existing = lists.find((l) => l.id === id);
    const prevAces = existing?.aces ?? [];
    const seq =
      prevAces.length === 0
        ? 10
        : Math.max(...prevAces.map((a) => a.sequence)) + 10;
    const nextList = {
      id,
      aces: [
        ...prevAces,
        {
          sequence: seq,
          action: action as "permit" | "deny",
          protocol:
            protocol === "icmp" || protocol === "ip" || protocol === "any"
              ? protocol
              : "ip",
          source: src.toLowerCase() === "any" ? "any" : src,
          destination: dst.toLowerCase() === "any" ? "any" : dst,
        },
      ],
    };
    const nextLists = existing
      ? lists.map((l) => (l.id === id ? nextList : l))
      : [...lists, nextList];
    ctx.setState(updateDevice(ctx.state, ctx.deviceId, { accessLists: nextLists }));
    return { output: "" };
  }

  if (
    lower.startsWith("ip access-group ") &&
    cli.mode === "config-if" &&
    cli.ifaceId
  ) {
    const id = Number(parts[2]);
    const dir = parts[3]?.toLowerCase();
    if (!Number.isInteger(id) || (dir !== "in" && dir !== "out")) {
      return { output: "% Uso: ip access-group <n> in|out" };
    }
    const patch =
      dir === "in" ? { aclIn: id } : { aclOut: id };
    ctx.setState(updateIface(ctx.state, ctx.deviceId, cli.ifaceId, patch));
    return { output: "" };
  }

  if (
    (lower === "no ip access-group in" || lower === "no ip access-group out") &&
    cli.mode === "config-if" &&
    cli.ifaceId
  ) {
    const patch = lower.endsWith(" in")
      ? { aclIn: null }
      : { aclOut: null };
    ctx.setState(updateIface(ctx.state, ctx.deviceId, cli.ifaceId, patch));
    return { output: "" };
  }

  if (
    (lower === "show access-lists" ||
      lower === "show access-list" ||
      lower === "show ip access-lists" ||
      lower === "sh access-lists") &&
    (cli.mode === "enable" || cli.mode === "user")
  ) {
    const lists = device.accessLists ?? [];
    if (lists.length === 0) return { output: "" };
    const blocks = lists.map((l) => {
      const lines = l.aces.map(
        (a) =>
          `  ${a.sequence} ${a.action} ${a.protocol} ${a.source} ${a.destination}`,
      );
      return [`Extended IP access list ${l.id}`, ...lines].join("\n");
    });
    return { output: blocks.join("\n") };
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
      let lineProto = i.connectedLinkId ? "up" : "down";
      if (i.media === "serial" && i.connectedLinkId) {
        const link = ctx.state.links.find((l) => l.id === i.connectedLinkId);
        const peerId =
          link &&
          (link.aDeviceId === device.id ? link.bDeviceId : link.aDeviceId);
        const peerIfId =
          link &&
          (link.aDeviceId === device.id ? link.bIfaceId : link.aIfaceId);
        const peer = peerId ? getDevice(ctx.state, peerId) : null;
        const peerIf = peer?.interfaces.find((x) => x.id === peerIfId);
        const hasClock =
          (i.clockRate != null && i.clockRate > 0) ||
          (peerIf?.clockRate != null && peerIf.clockRate > 0);
        if (!hasClock) lineProto = "down";
      }
      const hw =
        i.media === "serial"
          ? "Serial"
          : i.media === "wireless"
            ? "802.11 Radio"
            : "Gigabit Ethernet";
      return [
        `${i.name} is ${i.enabled ? "up" : "administratively down"}, line protocol is ${lineProto}`,
        `  Hardware is ${hw}, address is ${i.mac}`,
        i.media === "serial" && i.clockRate
          ? `  Clock rate is ${i.clockRate}`
          : null,
        i.aclIn != null ? `  Inbound access list is ${i.aclIn}` : null,
        i.aclOut != null ? `  Outbound access list is ${i.aclOut}` : null,
        i.ip
          ? `  Internet address is ${i.ip}/${maskToCidr(i.mask ?? "255.255.255.0") ?? 24}`
          : `  Internet protocol processing disabled`,
      ]
        .filter(Boolean)
        .join("\n");
    });
    return { output: blocks.join("\n") };
  }

  if (
    (lower === "show arp" ||
      lower === "show ip arp" ||
      lower === "sh arp" ||
      lower === "sh ip arp") &&
    (cli.mode === "enable" || cli.mode === "user")
  ) {
    const cached = device.arpTable ?? [];
    if (cached.length === 0) {
      // Popola da vicini L2 (come arp -a su PC)
      const my = device.interfaces.find((i) => i.ip);
      if (my) {
        const flood = l2Flood(ctx.state, ctx.deviceId, { sourceMac: my.mac });
        let next = flood.state;
        for (const n of flood.hosts) {
          if (n.device.id === ctx.deviceId || !n.iface.ip) continue;
          next = learnArp(next, ctx.deviceId, n.iface.ip, n.iface.mac, my.id);
        }
        ctx.setState(next);
        const updated = getDevice(next, ctx.deviceId);
        return { output: formatArpTable(updated ?? device) };
      }
    }
    return { output: formatArpTable(device) };
  }

  if (
    (lower === "show ip route" || lower === "sh ip route") &&
    (cli.mode === "enable" || cli.mode === "user")
  ) {
    const lines = [
      "Codes: C - connected, S - static, * - candidate default",
      "",
    ];
    for (const iface of device.interfaces) {
      if (!iface.ip || !iface.mask) continue;
      const ipn = parseIp(iface.ip);
      const maskn = parseMask(iface.mask);
      if (ipn === null || maskn === null) continue;
      const net = formatIp((ipn & maskn) >>> 0);
      const cidr = maskToCidr(iface.mask) ?? 24;
      lines.push(`C    ${net}/${cidr} is directly connected, ${iface.name}`);
    }
    for (const r of device.routes ?? []) {
      const cidr = maskToCidr(r.mask) ?? 24;
      lines.push(
        `S    ${r.network}/${cidr} [1/0] via ${r.nextHop}${r.outIface ? `, ${r.outIface}` : ""}`,
      );
    }
    if (lines.length <= 2) lines.push("  (nessuna rotta)");
    return { output: lines.join("\n") };
  }

  if (
    lower.startsWith("ip route ") &&
    (cli.mode === "config" || cli.mode === "enable")
  ) {
    const network = parts[2];
    const mask = parts[3];
    const nextHop = parts[4];
    if (!network || !mask || !nextHop) {
      return { output: "% Uso: ip route <rete> <mask> <next-hop>" };
    }
    if (
      !isValidIp(network) ||
      parseMask(mask) === null ||
      !isValidIp(nextHop)
    ) {
      return { output: "% Invalid network, mask or next-hop" };
    }
    const route: StaticRoute = { network, mask, nextHop };
    const routes = [...(device.routes ?? [])].filter(
      (r) => !(r.network === network && r.mask === mask && r.nextHop === nextHop),
    );
    routes.push(route);
    ctx.setState(updateDevice(ctx.state, ctx.deviceId, { routes }));
    return { output: "" };
  }

  if (
    lower.startsWith("no ip route ") &&
    (cli.mode === "config" || cli.mode === "enable")
  ) {
    const network = parts[3];
    const mask = parts[4];
    const nextHop = parts[5];
    if (!network || !mask) {
      return { output: "% Uso: no ip route <rete> <mask> [next-hop]" };
    }
    const routes = (device.routes ?? []).filter((r) => {
      if (r.network !== network || r.mask !== mask) return true;
      if (nextHop && r.nextHop !== nextHop) return true;
      return false;
    });
    ctx.setState(updateDevice(ctx.state, ctx.deviceId, { routes }));
    return { output: "" };
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
