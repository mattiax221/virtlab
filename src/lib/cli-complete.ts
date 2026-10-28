/**
 * Autocompletamento Tab per CMD / bash / Cisco IOS-like.
 */

export type CompleteResult = {
  /** Nuovo contenuto della riga di input */
  value: string;
  /** Se più candidati senza progresso: elenco da stampare */
  suggestions?: string[];
};

/** Prefisso comune (case preservata dal primo match). */
function commonPrefix(items: string[]): string {
  if (items.length === 0) return "";
  let prefix = items[0];
  for (let i = 1; i < items.length; i++) {
    const s = items[i];
    let j = 0;
    while (
      j < prefix.length &&
      j < s.length &&
      prefix[j].toLowerCase() === s[j].toLowerCase()
    ) {
      j++;
    }
    prefix = prefix.slice(0, j);
    if (!prefix) break;
  }
  return prefix;
}

/** Ogni token di `input` è abbreviazione del token corrispondente in `cmd`. */
function abbrevMatch(input: string, cmd: string): boolean {
  const endsSpace = /\s$/.test(input);
  const inToks = input.trim().split(/\s+/).filter(Boolean);
  const cmdToks = cmd.split(/\s+/);
  if (inToks.length === 0) return true;
  if (inToks.length > cmdToks.length) return false;
  for (let i = 0; i < inToks.length; i++) {
    const last = i === inToks.length - 1;
    if (last && !endsSpace) {
      if (!cmdToks[i].toLowerCase().startsWith(inToks[i].toLowerCase())) {
        return false;
      }
    } else if (cmdToks[i].toLowerCase() !== inToks[i].toLowerCase()) {
      // token completo: accetta anche abbreviazione univoca già tipizzata
      if (!cmdToks[i].toLowerCase().startsWith(inToks[i].toLowerCase())) {
        return false;
      }
    }
  }
  if (endsSpace && inToks.length >= cmdToks.length) return false;
  return true;
}

/**
 * Completa `input` contro un dizionario di comandi/frasi.
 * - 1 match → espande il comando (con spazio se ha sotto-comandi)
 * - N match → estende al prefisso comune; se non avanza, restituisce la lista
 */
export function completeLine(
  input: string,
  dictionary: string[],
): CompleteResult {
  const dict = [...new Set(dictionary.filter(Boolean))];
  if (dict.length === 0) return { value: input };

  const matches = dict
    .filter((c) => abbrevMatch(input, c))
    .sort((a, b) => a.localeCompare(b));

  if (matches.length === 0) return { value: input };

  const endsSpace = /\s$/.test(input);
  const inToks = input.trim().split(/\s+/).filter(Boolean);

  // Prossimo pezzo da completare: token corrente o successivo
  if (matches.length === 1) {
    const only = matches[0];
    const hasChildren = dict.some(
      (c) => c !== only && c.toLowerCase().startsWith(only.toLowerCase() + " "),
    );
    return { value: hasChildren ? only + " " : only };
  }

  // Espandi token per token al massimo comune
  const tokenColumns: string[][] = [];
  const maxTok = Math.max(...matches.map((m) => m.split(/\s+/).length));
  for (let col = 0; col < maxTok; col++) {
    tokenColumns.push(
      matches.map((m) => m.split(/\s+/)[col]).filter(Boolean) as string[],
    );
  }

  const built: string[] = [];
  for (let col = 0; col < tokenColumns.length; col++) {
    const uniq = [...new Set(tokenColumns[col].map((t) => t.toLowerCase()))];
    if (uniq.length !== 1) {
      // Prefisso comune sul token ambiguo
      const variants = [
        ...new Set(tokenColumns[col].filter(Boolean)),
      ] as string[];
      const cp = commonPrefix(variants);
      const typed = !endsSpace && col === inToks.length - 1 ? inToks[col] : "";
      if (cp.length > typed.length) {
        built.push(cp);
        return { value: built.join(" ") };
      }
      // Nessun progresso → suggerimenti (mostra coda del comando)
      const suggestions = [
        ...new Set(
          matches.map((m) => {
            const toks = m.split(/\s+/);
            return toks.slice(col).join(" ");
          }),
        ),
      ].sort();
      return { value: input, suggestions };
    }
    // Token univoco
    const canon = tokenColumns[col].find((t) => t.toLowerCase() === uniq[0])!;
    built.push(canon);
    // Se l'utente non ha ancora finito questo token, fermati dopo averlo espanso
    if (!endsSpace && col === inToks.length - 1) {
      const hasMore = matches.some((m) => m.split(/\s+/).length > col + 1);
      return { value: built.join(" ") + (hasMore ? " " : "") };
    }
    if (endsSpace && col === inToks.length - 1) {
      continue;
    }
    if (col >= inToks.length) {
      const hasMore = matches.some((m) => m.split(/\s+/).length > col + 1);
      return { value: built.join(" ") + (hasMore ? " " : "") };
    }
  }

  const prefix = commonPrefix(matches);
  if (prefix.length > input.trimEnd().length) {
    const hasChildren = dict.some(
      (c) =>
        c.toLowerCase() !== prefix.toLowerCase() &&
        c.toLowerCase().startsWith(prefix.toLowerCase() + " "),
    );
    return { value: hasChildren ? prefix + " " : prefix };
  }

  return { value: input, suggestions: matches };
}

export const PC_WIN_COMPLETIONS: string[] = [
  "help",
  "cls",
  "clear",
  "hostname",
  "ipconfig",
  "ipconfig /all",
  "ipconfig /ip",
  "ipconfig /renew",
  "ipconfig /release",
  "ping",
  "nslookup",
  "http",
  "curl",
  "ftp",
  "ntp sync",
  "w32tm /resync",
  "dir",
  "delete",
  "del",
  "netstat",
  "arp",
  "arp -a",
  "route",
  "route print",
];

export const PC_LINUX_COMPLETIONS: string[] = [
  "help",
  "man",
  "clear",
  "cls",
  "hostname",
  "uname",
  "uname -a",
  "whoami",
  "pwd",
  "ip addr",
  "ip a",
  "ip address",
  "ip addr add",
  "ip link",
  "ip route",
  "ip r",
  "ip neigh",
  "ip n",
  "ifconfig",
  "dhclient",
  "dhclient -r",
  "ping",
  "nslookup",
  "dig",
  "curl",
  "wget",
  "http",
  "ftp",
  "ntpdate",
  "ntp sync",
  "chronyc sync",
  "ls",
  "ls -la",
  "rm",
  "ss",
  "ss -tuln",
  "netstat",
  "arp",
  "arp -a",
  "route",
  "route -n",
];

export const FTP_COMPLETIONS: string[] = [
  "user",
  "pass",
  "dir",
  "ls",
  "list",
  "get",
  "recv",
  "delete",
  "rm",
  "bye",
  "quit",
  "exit",
  "help",
];

type IosMode =
  | "user"
  | "enable"
  | "config"
  | "config-if"
  | "config-vlan"
  | "aaa-user"
  | "aaa-pass";

export function iosCompletions(
  mode: IosMode,
  ifaceNames: string[] = [],
): string[] {
  const baseShow = [
    "show ip interface brief",
    "show interfaces",
    "show interfaces status",
    "show interfaces trunk",
    "show int status",
    "show int trunk",
    "show int",
    "show arp",
    "show ip arp",
    "show ip route",
    "show access-lists",
    "show access-list",
    "show ip access-lists",
    "show flash",
    "show vlan brief",
    "show vlan",
    "show mac address-table",
    "show mac-address-table",
    "show mac",
    "show spanning-tree",
    "show spanning-tree vlan 1",
    "show stp",
  ];

  const user = [
    "enable",
    "help",
    "?",
    "cls",
    "clear",
    "exit",
    "ping",
    ...baseShow,
  ];

  const enable = [
    "disable",
    "configure terminal",
    "conf t",
    "config t",
    "hostname",
    "ping",
    "copy tftp flash",
    "ntp sync",
    "exit",
    "end",
    "help",
    "?",
    "cls",
    "clear",
    ...baseShow,
  ];

  const config = [
    "hostname",
    "interface",
    ...ifaceNames.map((n) => `interface ${n}`),
    "vlan",
    "ip route",
    "no ip route",
    "access-list",
    "aaa new-model",
    "radius-server host",
    "aaa authentication enable default group radius",
    "aaa authentication enable default group tacacs",
    "exit",
    "end",
    "help",
    "?",
  ];

  const configIf = [
    "ip address",
    "no shutdown",
    "shutdown",
    "encapsulation dot1Q",
    "encapsulation dot1q",
    "clock rate",
    "ip access-group",
    "switchport mode access",
    "switchport mode trunk",
    "switchport access vlan",
    "switchport trunk native vlan",
    "switchport trunk allowed vlan",
    "exit",
    "end",
    "help",
    "?",
  ];

  const configVlan = ["name", "exit", "end", "help", "?"];

  switch (mode) {
    case "user":
      return user;
    case "enable":
      return enable;
    case "config":
      return config;
    case "config-if":
      return configIf;
    case "config-vlan":
      return configVlan;
    case "aaa-user":
    case "aaa-pass":
      return [];
    default:
      return user;
  }
}
