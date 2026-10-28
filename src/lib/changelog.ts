/**
 * Changelog e roadmap NetLab (italiano) — mostrati in /changelog.
 */

export type ChangelogEntry = {
  /** SHA corto git */
  sha: string;
  /** Data YYYY-MM-DD (Europe/Rome del commit) */
  date: string;
  /** Titolo breve in italiano */
  title: string;
  /** Dettaglio passo-passo */
  detail: string;
};

export type TodoItem = {
  id: string;
  title: string;
  detail: string;
  status: "todo" | "doing" | "done";
  /** Epic / area (per raggruppare la roadmap “pensa in grande”) */
  epic?:
    | "ship"
    | "desktop"
    | "services"
    | "l2l3"
    | "wan"
    | "security"
    | "iot"
    | "pedagogy"
    | "platform";
  /** Orizzonte: ora / prossimo / visione */
  horizon?: "now" | "next" | "vision";
};

export const EPIC_LABELS: Record<NonNullable<TodoItem["epic"]>, string> = {
  ship: "Rilascio & distribuzione",
  desktop: "Desktop end-device (PT)",
  services: "Server Services",
  l2l3: "Switching & Routing",
  wan: "WAN / Accesso remoto",
  security: "Sicurezza",
  iot: "IoT & monitoring",
  pedagogy: "Didattica & esercizi",
  platform: "Piattaforma NetLab",
};

export const HORIZON_LABELS = {
  now: "Subito",
  next: "Prossimo traguardo",
  vision: "Visione (pensa in grande)",
} as const;

/** Dal primo commit all’ultimo (ordine cronologico). */
export const releases: ChangelogEntry[] = [
  {
    sha: "6dc4bb4",
    date: "2026-10-27",
    title: "Inizializzazione progetto",
    detail: "Scaffold Next.js / TypeScript / Tailwind: base vuota del laboratorio.",
  },
  {
    sha: "69555f9",
    date: "2026-10-27",
    title: "Prima NetLab funzionante",
    detail:
      "Topologia stile Packet Tracer, desktop Windows con CMD (ipconfig, ping), switch e router base.",
  },
  {
    sha: "a831378",
    date: "2026-10-27",
    title: "Ingresso diretto al lab",
    detail: "Parametro ?lab=1 per saltare la landing e aprire subito il canvas.",
  },
  {
    sha: "34b14bc",
    date: "2026-10-27",
    title: "Fix pulsante «Apri laboratorio»",
    detail: "Ripristinato il link/navigazione verso il lab dalla home.",
  },
  {
    sha: "a5eddd7",
    date: "2026-10-27",
    title: "Pulizia artifact screenshot",
    detail: "Rimossi dal tracking git gli screenshot locali di debug.",
  },
  {
    sha: "cc1f39d",
    date: "2026-10-27",
    title: "Bind su 0.0.0.0",
    detail: "Next.js in ascolto su tutte le interfacce; chiarito l’accesso da Chrome locale.",
  },
  {
    sha: "c75f92c",
    date: "2026-10-27",
    title: "Percorso QEMU / noVNC (Windows Evaluation)",
    detail:
      "Aggiunto percorso opzionale verso VM Windows Evaluation legittima (non obbligatorio per il lab simulato).",
  },
  {
    sha: "4666ec5",
    date: "2026-10-27",
    title: "Catalogo dispositivi PT + ReactOS per-PC",
    detail: "Espanso il catalogo Packet Tracer; sperimentazione ReactOS per singolo PC.",
  },
  {
    sha: "00f0171",
    date: "2026-10-27",
    title: "Fix UI lab dietro tunnel Cloudflare",
    detail: "Risolto il canvas «morto» (HTML senza React) quando si usava un tunnel pubblico.",
  },
  {
    sha: "666a7e8",
    date: "2026-10-27",
    title: "ReactOS black screen + nomi modelli Cisco",
    detail: "Fix schermo nero ReactOS; etichette dispositivi allineate ai modelli Cisco PT.",
  },
  {
    sha: "f9944db",
    date: "2026-10-27",
    title: "Rimozione screenshot ReactOS",
    detail: "Pulizia repo dagli screenshot di debug ReactOS.",
  },
  {
    sha: "7eec321",
    date: "2026-10-27",
    title: "Allineamento catalogo PT 9",
    detail:
      "Dispositivi e cavi allineati a Packet Tracer 9; ReactOS declassato sull’ambiente cloud.",
  },
  {
    sha: "75e696b",
    date: "2026-10-27",
    title: "Connessioni di rete Windows (al posto di ReactOS)",
    detail:
      "Desktop con Pannello di controllo → Connessioni di rete → TCP/IPv4 (IP statico / DHCP).",
  },
  {
    sha: "e1bbde5",
    date: "2026-10-27",
    title: "UI lab più pulita",
    detail:
      "Dock dispositivi in basso, filtri, menu contestuali; canvas più vicino a Packet Tracer.",
  },
  {
    sha: "348a80c",
    date: "2026-10-27",
    title: "Fondamenta L2 Cisco-like",
    detail: "VLAN, tabella MAC, LED porte sullo switch.",
  },
  {
    sha: "363a24e",
    date: "2026-10-27",
    title: "Inter-VLAN + Physical modules",
    detail:
      "Router-on-a-stick; moduli fisici PT (spegni device → aggiungi/rimuovi NIC, WIC, Wi‑Fi).",
  },
  {
    sha: "866942f",
    date: "2026-10-27",
    title: "Tray Wi‑Fi Windows",
    detail: "Scan SSID dagli Access Point, connessione WPA2 dal desktop dell’host.",
  },
  {
    sha: "3ce4ad2",
    date: "2026-10-27",
    title: "DHCP / DNS / HTTP + simulazione + ACL",
    detail:
      "Servizi Server-PT, salva/carica lab, modalità Simulation, clock rate seriale, ACL base.",
  },
  {
    sha: "f541888",
    date: "2026-10-27",
    title: "Lab vuoto + palette ampliata",
    detail: "Avvio senza topologia precaricata; più dispositivi nella palette PT.",
  },
  {
    sha: "46a13f7",
    date: "2026-10-27",
    title: "Hint canvas vuoto",
    detail: "Messaggio guida quando non ci sono ancora dispositivi sul canvas.",
  },
  {
    sha: "3ad01b2",
    date: "2026-10-27",
    title: "Selezione porte stile PT",
    detail: "Lo strumento cavo chiede le porte come in Packet Tracer.",
  },
  {
    sha: "f40bdfa",
    date: "2026-10-27",
    title: "Fix ping PC↔switch",
    detail: "I collegamenti usano le porte Ethernet (non Wi‑Fi) per il ping cablato.",
  },
  {
    sha: "099f1b1",
    date: "2026-10-27",
    title: "Porte switch ordinate",
    detail: "Nel selettore porte le FastEthernet sono in ordine numerico.",
  },
  {
    sha: "2650e8a",
    date: "2026-10-27",
    title: "LED switch, undo, export",
    detail: "Dettaglio LED porte, Annulla, export multi-formato del lab.",
  },
  {
    sha: "c8c961e",
    date: "2026-10-27",
    title: "Condivisione lab via URL",
    detail:
      "Snapshot `#lab=…` nell’URL (senza account/DB); ARP, rotte statiche, simulazione multi-protocollo, drag dalla palette.",
  },
  {
    sha: "ecb9db1",
    date: "2026-10-27",
    title: "Autosave, share UX, HTTP reachability",
    detail:
      "Fix wipe autosave, UX condivisione, HTTP che rispetta il ping, polish canvas.",
  },
  {
    sha: "c42d50f",
    date: "2026-10-27",
    title: "LED stato cavo (verde / ambra / rosso)",
    detail: "Link status sulle estremità dei cavi come in Packet Tracer.",
  },
  {
    sha: "8b4549b",
    date: "2026-10-27",
    title: "Icona Server distinta + regole cavo PT",
    detail: "Server non più uguale al PC; validazione tipi di cavo stile Packet Tracer.",
  },
  {
    sha: "a8eac2b",
    date: "2026-10-27",
    title: "Cavi sbagliati restano (rossi) + servizi Server",
    detail:
      "Cavo errato si collega ma resta rosso (niente L2); espansione servizi Server-PT.",
  },
  {
    sha: "5a14279",
    date: "2026-10-27",
    title: "Pannello Server-PT Config / Services",
    detail:
      "Ricostruito dalle docs PT: Config (GLOBAL/INTERFACE) e Services (HTTP, DHCP pools, TFTP, DNS, SYSLOG, AAA, NTP, EMAIL, FTP).",
  },
  {
    sha: "13acb20",
    date: "2026-10-28",
    title: "Web Browser, Text Editor, CLI extra",
    detail:
      "Utility Desktop PT: Web Browser e Text Editor; CMD con nslookup, ftp, dir, delete, netstat.",
  },
  {
    sha: "f3e4b79",
    date: "2026-10-28",
    title: "Pagina Changelog + roadmap",
    detail:
      "Pagina /changelog in italiano: cronologia dal primo commit e elenco cose da fare.",
  },
  {
    sha: "8bb325d",
    date: "2026-10-28",
    title: "Traffic Generator, FTP, SYSLOG, NTP, DNS cache",
    detail:
      "Desktop Traffic Generator (PDU su canvas); FTP interattivo user/pass/dir/get; SYSLOG su link-up/power; ntp sync; DNS cache con TTL.",
  },
  {
    sha: "de97204",
    date: "2026-10-28",
    title: "Client Email Desktop + TFTP flash",
    detail:
      "Email SMTP/POP3 sul Desktop (admin/studente); sui router copy tftp flash e show flash.",
  },
  {
    sha: "c08243f",
    date: "2026-10-28",
    title: "Esercizi su pagina dedicata",
    detail: "Checklist lab spostata da overlay canvas a /esercizi (legge autosave).",
  },
  {
    sha: "9d147df",
    date: "2026-10-28",
    title: "AAA, STP/unicast, PPPoE/VPN, mobile",
    detail:
      "Enable con RADIUS; STP semplificato + MAC unicast; PPPoE/VPN Desktop; header/desktop touch-friendly.",
  },
  {
    sha: "340a8cb",
    date: "2026-10-28",
    title: "Desktop PT shortcuts + Remote Desktop",
    detail:
      "Griglia shortcut stile Packet Tracer (niente «Questo PC»); Remote Desktop verso altri PC/Server; stub per MIB/Firewall/VoIP.",
  },
  {
    sha: "42be714",
    date: "2026-10-28",
    title: "Icone Desktop unificate",
    detail: "SVG coerenti e tipografia più leggibile sulla griglia shortcut.",
  },
  {
    sha: "2e3418d",
    date: "2026-10-28",
    title: "Roadmap ambiziosa (pensa in grande)",
    detail:
      "Todo list ripensata: Subito / Prossimo / Visione (OSPF, classroom, IoT, CyberOps, tutor AI, tracce CCNA).",
  },
  {
    sha: "0cb9f72",
    date: "2026-10-28",
    title: "Pagina Comandi + SSH CLI remota",
    detail:
      "/comandi (a cosa serve / cosa non fa); Telnet/SSH Desktop apre la CLI del router/switch.",
  },
  {
    sha: "709f3da",
    date: "2026-10-28",
    title: "Desktop Windows o Linux a scelta",
    detail:
      "Selettore OS sul Desktop: CMD Windows oppure bash (ip addr, dhclient, curl, dig…).",
  },
  {
    sha: "31bdebb",
    date: "2026-10-28",
    title: "Tab autocomplete + Firewall host",
    detail:
      "Tab completa comandi (CMD/bash/IOS); Desktop Firewall con regole su ping.",
  },
  {
    sha: "401eeb4",
    date: "2026-10-28",
    title: "Printer-PT configurabile",
    detail:
      "Config IP/DHCP, Physical, Services PRINT e coda; dai PC: print/lpr <ip>.",
  },
  {
    sha: "d3c9499",
    date: "2026-10-28",
    title: "Stampa remota animata",
    detail:
      "Job LPR con PDU PRINT sulla topologia; Desktop → Printers; pulse sulla stampante.",
  },
  {
    sha: "34ae333",
    date: "2026-10-28",
    title: "RDP UX + drag + MIB Browser",
    detail:
      "Remote Desktop più chiaro, movimento griglia fluido, MIB Walk SNMP.",
  },
];

/** Roadmap NetLab — Packet Tracer didattico nel browser. */
export const todos: TodoItem[] = [
  // —— Completato (base già in lab) ——
  {
    id: "traffic-generator",
    title: "Traffic Generator / PDU dal Desktop",
    detail: "ICMP/HTTP/DNS/DHCP con animazione sul canvas.",
    status: "done",
    epic: "desktop",
    horizon: "now",
  },
  {
    id: "ftp-interactive",
    title: "FTP interattivo",
    detail: "user/pass/dir/get/delete/bye verso Server-PT.",
    status: "done",
    epic: "desktop",
    horizon: "now",
  },
  {
    id: "dns-cache-ttl",
    title: "DNS cache con TTL",
    detail: "Cache Server-PT (TTL 300s) da query/nslookup.",
    status: "done",
    epic: "services",
    horizon: "now",
  },
  {
    id: "syslog-ingest",
    title: "SYSLOG da eventi di rete",
    detail: "Link-up e power on/off → Server-PT SYSLOG.",
    status: "done",
    epic: "services",
    horizon: "now",
  },
  {
    id: "ntp-sync",
    title: "NTP sync host/router",
    detail: "`ntp sync` / `w32tm /resync` dal Server-PT.",
    status: "done",
    epic: "services",
    horizon: "now",
  },
  {
    id: "email-client",
    title: "Client EMAIL Desktop",
    detail: "SMTP/POP3 admin & studente @ lab.local.",
    status: "done",
    epic: "desktop",
    horizon: "now",
  },
  {
    id: "tftp-flash",
    title: "TFTP flash IOS",
    detail: "`copy tftp flash` + `show flash` sui router.",
    status: "done",
    epic: "services",
    horizon: "now",
  },
  {
    id: "aaa-auth",
    title: "AAA su enable router",
    detail: "RADIUS verso Server-PT per privilege mode.",
    status: "done",
    epic: "security",
    horizon: "now",
  },
  {
    id: "stp-unicast",
    title: "STP + MAC unicast (v1)",
    detail: "Loop switch, porte BLK, unicast se MAC noto.",
    status: "done",
    epic: "l2l3",
    horizon: "now",
  },
  {
    id: "vpn-pppoe",
    title: "PPPoE + VPN Desktop",
    detail: "Dialer e tunnel con IP virtuale.",
    status: "done",
    epic: "wan",
    horizon: "now",
  },
  {
    id: "desktop-pt-grid",
    title: "Desktop shortcut stile PT + RDP",
    detail: "Griglia icone unificate, Remote Desktop, stub PT.",
    status: "done",
    epic: "desktop",
    horizon: "now",
  },
  {
    id: "esercizi-page",
    title: "Pagina esercizi dedicata",
    detail: "/esercizi con checklist da autosave.",
    status: "done",
    epic: "pedagogy",
    horizon: "now",
  },

  // —— Subito ——
  {
    id: "deploy-virt-lab",
    title: "Pubblicare su Vercel (virt-lab live)",
    detail:
      "Sbloccare push su aasda-add/virt-lab e ridistribuire virt-lab-wheat.vercel.app — oggi il lab “vero” resta indietro.",
    status: "todo",
    epic: "ship",
    horizon: "now",
  },
  {
    id: "desktop-stubs-real",
    title: "Chiudere gli stub Desktop PT",
    detail:
      "Firewall + MIB Browser fatti; restano IP Communicator e Dial-up modem.",
    status: "doing",
    epic: "desktop",
    horizon: "now",
  },
  {
    id: "rdp-ux-drag",
    title: "Remote Desktop chiaro + drag griglia",
    detail:
      "RDP a due colonne con stati; sessione remota evidenziata; drag fluido con cavi che seguono.",
    status: "done",
    epic: "desktop",
    horizon: "now",
  },
  {
    id: "mib-browser",
    title: "MIB Browser SNMP",
    detail: "Walk OID (sysDescr, ifDescr, IP) su device raggiungibile.",
    status: "done",
    epic: "desktop",
    horizon: "now",
  },
  {
    id: "cli-tab-complete",
    title: "Tab autocomplete CLI",
    detail:
      "Tab su CMD/bash/router/switch con abbreviazioni (sh→show) e lista candidati.",
    status: "done",
    epic: "desktop",
    horizon: "now",
  },
  {
    id: "host-firewall",
    title: "Firewall Desktop host",
    detail:
      "Regole allow/deny in/out su ICMP (e porte TCP/UDP) applicate al ping.",
    status: "done",
    epic: "desktop",
    horizon: "now",
  },
  {
    id: "printer-config",
    title: "Printer-PT configurabile",
    detail:
      "Pannello Config (IP static/DHCP) + Physical + Services PRINT; print/lpr dai PC.",
    status: "done",
    epic: "desktop",
    horizon: "now",
  },
  {
    id: "print-sim-anim",
    title: "Stampa remota animata sulla griglia",
    detail:
      "PDU PRINT magenta PC→stampante, shortcut Printers, Traffic Generator LPR.",
    status: "done",
    epic: "l2l3",
    horizon: "now",
  },
  {
    id: "ssh-real-cli",
    title: "Telnet/SSH → CLI del device remoto",
    detail:
      "Desktop Telnet/SSH apre la CLI Cisco-like del router/switch raggiungibile.",
    status: "done",
    epic: "desktop",
    horizon: "now",
  },
  {
    id: "comandi-page",
    title: "Pagina riferimento comandi",
    detail:
      "/comandi con filtro device e per ogni comando: a cosa serve / cosa non fa.",
    status: "done",
    epic: "pedagogy",
    horizon: "now",
  },
  {
    id: "host-os-choice",
    title: "Desktop Windows | Linux",
    detail:
      "Su PC/Laptop/Server scegli OS: CMD (ipconfig) o bash (ip addr, dhclient, curl).",
    status: "done",
    epic: "desktop",
    horizon: "now",
  },

  // —— Prossimo traguardo ——
  {
    id: "server-tabs-pt",
    title: "Finestra Server = Physical | Config | Services | Desktop",
    detail:
      "Come in PT: tab unificate, Programming/Attributes opzionali; Services con DHCPv6, IoT, VM Management, Radius EAP, PRP.",
    status: "todo",
    epic: "services",
    horizon: "next",
  },
  {
    id: "complex-pdu",
    title: "Add Complex PDU + PDU list",
    detail:
      "Editor pacchetti (L2–L4), coda PDU, cattura tipo Simulation Mode avanzata con hop-by-hop e fail reason.",
    status: "todo",
    epic: "l2l3",
    horizon: "next",
  },
  {
    id: "ospf-eigrp",
    title: "Routing dinamico OSPF / EIGRP (lab)",
    detail:
      "Adiacenze, LSA semplificate, `show ip route ospf`, multi-area base — esercizi CCNA oltre lo statico.",
    status: "todo",
    epic: "l2l3",
    horizon: "next",
  },
  {
    id: "stp-rstp-full",
    title: "STP/RSTP per-VLAN + PortFast/BPDU guard",
    detail:
      "Root election reale (priority+MAC), costi, `show spanning-tree detail`, topologie ad anello multi-switch.",
    status: "todo",
    epic: "l2l3",
    horizon: "next",
  },
  {
    id: "etherchannel-hsrp",
    title: "EtherChannel + HSRP/VRRP",
    detail:
      "Lag tra switch e first-hop redundancy tra router — lab HA da curriculum.",
    status: "todo",
    epic: "l2l3",
    horizon: "next",
  },
  {
    id: "acl-firewall-host",
    title: "Firewall Desktop + ACL estese",
    detail:
      "Regole IPv4/IPv6 sul PC; ACL numbered/named estese (TCP/UDP porte) su router; hit counters.",
    status: "todo",
    epic: "security",
    horizon: "next",
  },
  {
    id: "nat-pat",
    title: "NAT / PAT sul bordo",
    detail:
      "`ip nat inside/outside`, pool, overload, `show ip nat translations` — lab Internet edge.",
    status: "todo",
    epic: "wan",
    horizon: "next",
  },
  {
    id: "dhcpv6-slaac",
    title: "IPv6 first-class (SLAAC + DHCPv6)",
    detail:
      "Indirizzi link-local, RA, DHCPv6 sul Server-PT, ping6/tracert6, dual-stack UI.",
    status: "todo",
    epic: "services",
    horizon: "next",
  },
  {
    id: "wireless-enterprise",
    title: "Wi‑Fi enterprise (WLC + CAPWAP)",
    detail:
      "Lightweight AP, controller, SSID multipli, 802.1X verso AAA — oltre WPA2 PSK.",
    status: "todo",
    epic: "wan",
    horizon: "next",
  },
  {
    id: "activity-wizard",
    title: "Activity / Assessment mode",
    detail:
      "Esercizi con obiettivi, hint, punteggio automatico, export risultato studente (come PT Activity Wizard).",
    status: "todo",
    epic: "pedagogy",
    horizon: "next",
  },

  // —— Visione (pensa in grande) ——
  {
    id: "netlab-classroom",
    title: "NetLab Classroom (multi-utente)",
    detail:
      "Docente crea lab template; studenti clonano sandbox isolate; share link + sessione live opzionale; nessun account obbligatorio ma classi opzionali.",
    status: "todo",
    epic: "platform",
    horizon: "vision",
  },
  {
    id: "pkt-import",
    title: "Import / export .pkt (o JSON PT-compat)",
    detail:
      "Apri topologie da Packet Tracer o esporta verso strumenti esterni; bridge con community curriculum.",
    status: "todo",
    epic: "platform",
    horizon: "vision",
  },
  {
    id: "full-ios-feel",
    title: "IOS-like depth (switch L3 + router ISR)",
    detail:
      "SVI, routing on multilayer, VRF light, QoS marking base, SNMP trap → MIB Browser.",
    status: "todo",
    epic: "l2l3",
    horizon: "vision",
  },
  {
    id: "iot-stack",
    title: "IoT Monitor / IoT IDE / Supervisory",
    detail:
      "Cose PT: sensori, MCU/SBC, home gateway, dashboard supervisory — lab smart building.",
    status: "todo",
    epic: "iot",
    horizon: "vision",
  },
  {
    id: "netflow-siem",
    title: "NetFlow Collector + correlazione SYSLOG",
    detail:
      "Flussi esportati dai router, grafici top talkers, timeline incidenti per esercizi security.",
    status: "todo",
    epic: "iot",
    horizon: "vision",
  },
  {
    id: "cyberops-path",
    title: "Percorso CyberOps / blue team",
    detail:
      "Scenario attacco simulato (scan, brute AAA, lateral) + detection su SYSLOG/NetFlow/ACL drop — senza malware reale.",
    status: "todo",
    epic: "security",
    horizon: "vision",
  },
  {
    id: "offline-pwa",
    title: "PWA offline + installabile",
    detail:
      "Lab usabile senza rete (scuole), autosave robusto, sync quando torna la connessione.",
    status: "todo",
    epic: "platform",
    horizon: "vision",
  },
  {
    id: "ai-lab-tutor",
    title: "Tutor AI nel lab (opzionale)",
    detail:
      "Spiega perché il ping fallisce (cavo, VLAN, rotta, ACL) citando lo stato reale del lab — mai bypassare la sim.",
    status: "todo",
    epic: "pedagogy",
    horizon: "vision",
  },
  {
    id: "cert-tracks",
    title: "Tracce certificate (CCNA / Network+)",
    detail:
      "Percorsi guidati con lab progressivi, badge, e checklist allineate agli exam topic.",
    status: "todo",
    epic: "pedagogy",
    horizon: "vision",
  },
];

export function latestRelease(): ChangelogEntry {
  return releases[releases.length - 1]!;
}
