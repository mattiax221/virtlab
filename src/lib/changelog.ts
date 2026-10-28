/**
 * Changelog e roadmap NetLab (italiano).
 * Aggiornare a ogni commit rilevante: appendi in fondo a `releases`.
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
};

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
];

/** Roadmap / cose da fare (aggiornare quando si completa un item). */
export const todos: TodoItem[] = [
  {
    id: "deploy-virt-lab",
    title: "Sync su virt-lab + deploy Vercel",
    detail:
      "Far arrivare main aggiornato su aasda-add/virt-lab e ridistribuire virt-lab-wheat.vercel.app (oggi il cloud agent ha 403 sul push).",
    status: "todo",
  },
  {
    id: "traffic-generator",
    title: "Traffic Generator / PDU dal Desktop",
    detail:
      "Utility Desktop PT per generare PDU semplici/complessi come nella Common Tools Bar.",
    status: "todo",
  },
  {
    id: "ftp-interactive",
    title: "FTP interattivo (login + get/put)",
    detail:
      "Sessione FTP stile prompt (USER/PASS, get/put) usando account e permessi del Server-PT.",
    status: "todo",
  },
  {
    id: "email-client",
    title: "Client EMAIL sul Desktop",
    detail: "Invio/ricezione messaggi SMTP/POP3 verso il servizio EMAIL del server.",
    status: "todo",
  },
  {
    id: "stp-unicast",
    title: "STP e MAC unicast più fedeli",
    detail:
      "Spanning Tree semplificato e forwarding unicast basato sulla tabella MAC (meno flood).",
    status: "todo",
  },
  {
    id: "dns-cache-ttl",
    title: "DNS cache con TTL / SOA timer",
    detail: "Cache DNS lato server e client con scadenza TTL come nelle docs PT.",
    status: "todo",
  },
  {
    id: "syslog-ingest",
    title: "SYSLOG da router/switch",
    detail: "I device di rete inviano messaggi al Server-PT SYSLOG quando cambiano stato.",
    status: "todo",
  },
  {
    id: "ntp-sync",
    title: "Sincronizzazione NTP sui device",
    detail: "Router/switch possono fare client NTP verso il server e aggiornare l’orologio.",
    status: "todo",
  },
  {
    id: "aaa-auth",
    title: "AAA su login CLI router",
    detail: "Autenticazione RADIUS/TACACS verso il Server-PT per enable/login.",
    status: "todo",
  },
  {
    id: "tftp-flash",
    title: "TFTP flash IOS (simulato)",
    detail: "Copia immagine dal TFTP del server verso router/switch (simulazione).",
    status: "todo",
  },
  {
    id: "vpn-pppoe",
    title: "PPPoE Dialer e VPN Desktop",
    detail: "Utility Desktop mancanti dalle docs Configuring Servers / PCs.",
    status: "todo",
  },
  {
    id: "mobile-polish",
    title: "Usabilità touch / schermi piccoli",
    detail: "Palette, cavi e desktop più comodi su tablet/telefono.",
    status: "todo",
  },
];

export function latestRelease(): ChangelogEntry {
  return releases[releases.length - 1]!;
}
