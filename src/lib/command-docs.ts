/**
 * Riferimento comandi NetLab (cosa fa / cosa non fa).
 * Allineato a src/lib/network/commands.ts — aggiornare insieme.
 */

export type CmdDoc = {
  cmd: string;
  synopsis?: string;
  does: string;
  doesNot: string;
  example?: string;
  mode?: string;
};

export type CmdSection = {
  id: string;
  title: string;
  device: "pc" | "router" | "switch" | "server" | "ftp";
  blurb: string;
  commands: CmdDoc[];
};

export const COMMAND_SECTIONS: CmdSection[] = [
  {
    id: "pc",
    title: "PC / Laptop — Windows CMD",
    device: "pc",
    blurb:
      "Desktop → selettore Windows → Command Prompt. CMD: IP, ping, DNS, HTTP, FTP, NTP. Puoi passare a Linux sullo stesso host.",
    commands: [
      {
        cmd: "Tab (autocomplete)",
        does: "Completa il comando o l’abbreviazione; se ambigua elenca i candidati.",
        doesNot: "Non completa argomenti IP/nomi host liberi.",
      },
      {
        cmd: "help",
        does: "Elenca i comandi disponibili sul PC.",
        doesNot: "Non mostra man page estese né opzioni Windows reali.",
      },
      {
        cmd: "ipconfig",
        does: "Mostra IP, mask, gateway di ogni NIC.",
        doesNot: "Non mostra adapter virtuali Windows né IPv6 dettagliato.",
        example: "ipconfig",
      },
      {
        cmd: "ipconfig /all",
        does: "Come ipconfig + MAC e hostname.",
        doesNot: "Non elenca suffissi DNS multipli o DHCP lease time.",
      },
      {
        cmd: "ipconfig /ip",
        synopsis: "ipconfig /ip <ip> <mask> [gateway]",
        does: "Imposta IP statico sulla NIC preferita (Ethernet).",
        doesNot: "Non configura più NIC in un colpo; non salva profili Windows.",
        example: "ipconfig /ip 192.168.1.10 255.255.255.0 192.168.1.1",
      },
      {
        cmd: "ipconfig /renew",
        does: "Richiede lease DHCP al Server-PT (o gateway DHCP).",
        doesNot: "Non parla con DHCP relay reali; un solo pool alla volta (semplificato).",
      },
      {
        cmd: "ipconfig /release",
        does: "Rilascia il lease e libera l’IP sul server DHCP.",
        doesNot: "Non lascia APIPA 169.254.x.x.",
      },
      {
        cmd: "ping",
        synopsis: "ping <ip|nome>",
        does: "ICMP simulato con percorso L2/L3, ARP learning, DNS se nome.",
        doesNot: "Niente -t, -n, -l; RTT è finto; non MTU discovery.",
        example: "ping 192.168.1.1\nping server.lab",
      },
      {
        cmd: "nslookup",
        synopsis: "nslookup <nome>",
        does: "Query A/CNAME sul DNS Server-PT; aggiorna DNS Cache (TTL).",
        doesNot: "Niente record MX/TXT; niente server DNS alternativo a linea di comando.",
        example: "nslookup www.lab",
      },
      {
        cmd: "http / curl",
        synopsis: "http <host|ip[/page]>",
        does: "GET verso Server-PT HTTP (dopo ping di reachability).",
        doesNot: "Niente HTTPS reale, cookie, POST; pagine = HTML del servizio.",
        example: "http www.lab\nhttp 192.168.1.100/helloworld.html",
      },
      {
        cmd: "ftp",
        synopsis: "ftp <host>",
        does: "Apre sessione FTP interattiva (user/pass/dir/get/delete/bye).",
        doesNot: "Niente modalità passiva/attiva reale; file non scaricano sul disco host.",
        example: "ftp 192.168.1.100",
      },
      {
        cmd: "print / lpr",
        synopsis: "print <ip|nome> | lpr <ip|nome>",
        does: "Invia un job alla coda del Printer-PT (dopo reachability).",
        doesNot: "Niente driver PCL/PostScript reali né anteprima.",
        example: "print 192.168.1.50",
      },
      {
        cmd: "ntp sync",
        synopsis: "ntp sync | w32tm /resync",
        does: "Sincronizza orologio desktop dal Server-PT NTP + SYSLOG.",
        doesNot: "Niente autenticazione NTP key in questo comando (solo sync).",
      },
      {
        cmd: "arp -a",
        does: "Mostra cache ARP imparata dai ping.",
        doesNot: "Niente arp -d / static entries da CMD (ancora).",
      },
      {
        cmd: "route print",
        does: "Mostra gateway e rotte host semplificate.",
        doesNot: "Niente metriche Windows complete né route add persistente.",
      },
      {
        cmd: "netstat",
        does: "Output dimostrativo (listening stub).",
        doesNot: "Non elenca socket TCP reali della simulazione.",
      },
      {
        cmd: "dir / delete",
        does: "Elenco/cancella file locali simulati.",
        doesNot: "Filesystem non persistente tra sessioni.",
      },
      {
        cmd: "hostname / cls",
        does: "Nome host; clear schermo.",
        doesNot: "hostname non rinomina il device in topologia.",
      },
    ],
  },
  {
    id: "linux",
    title: "PC / Laptop — Linux bash",
    device: "pc",
    blurb:
      "Desktop → selettore Linux → Terminal. Stesse capacità di rete del CMD, sintassi GNU/Linux.",
    commands: [
      {
        cmd: "ip addr / ifconfig",
        synopsis: "ip addr | ip a | ifconfig",
        does: "Mostra interfacce eth/wlan con IP, mask, MAC e stato link.",
        doesNot: "Niente ip -j / netplan; etichette eth0 stilizzate.",
      },
      {
        cmd: "ip addr add",
        synopsis: "ip addr add <ip>/<cidr> [gw <gateway>]",
        does: "Imposta IP statico sulla NIC preferita (Ethernet).",
        doesNot: "Niente `dev eth0` obbligatorio; un’interfaccia alla volta.",
        example: "ip addr add 192.168.1.20/24 gw 192.168.1.1",
      },
      {
        cmd: "ifconfig … netmask",
        synopsis: "ifconfig <iface> <ip> netmask <mask> [gw <gateway>]",
        does: "Stesso effetto di ip addr add, stile classico.",
        doesNot: "Il nome iface è cosmetico (configura comunque la NIC preferita).",
        example: "ifconfig eth0 192.168.1.20 netmask 255.255.255.0 gw 192.168.1.1",
      },
      {
        cmd: "dhclient / dhclient -r",
        does: "Renew / release DHCP verso Server-PT.",
        doesNot: "Niente lease file persistente; equivalente a ipconfig /renew|/release.",
      },
      {
        cmd: "ping",
        synopsis: "ping <ip|nome>",
        does: "ICMP simulato (come Windows).",
        doesNot: "Niente -c / -i opzioni.",
      },
      {
        cmd: "nslookup / dig",
        does: "Query A sul DNS Server-PT; dig in formato DiG.",
        doesNot: "Niente zone transfer / EDNS.",
        example: "dig www.lab",
      },
      {
        cmd: "curl / wget",
        synopsis: "curl <host|ip[/page]>",
        does: "GET HTTP su Server-PT (dopo reachability).",
        doesNot: "Niente HTTPS reale, header custom, POST.",
        example: "curl www.lab",
      },
      {
        cmd: "ftp",
        does: "Sessione FTP interattiva (come su Windows).",
        doesNot: "—",
      },
      {
        cmd: "ntpdate / chronyc sync",
        does: "Sync orologio da Server-PT NTP.",
        doesNot: "Niente pool.ntp.org reale.",
      },
      {
        cmd: "ip neigh / arp -a",
        does: "Cache ARP.",
        doesNot: "Formato ancora stile tabella didattica.",
      },
      {
        cmd: "ip route / route -n",
        does: "Tabella routing kernel stilizzata.",
        doesNot: "Niente ip route add persistente da shell (usa Network Settings).",
      },
      {
        cmd: "ls / rm / ss / hostname / uname -a / clear",
        does: "Utility base demo + clear schermo.",
        doesNot: "Filesystem non persistente; ss è stub.",
      },
      {
        cmd: "ipconfig (su Linux)",
        does: "Messaggio: command not found + suggerimento di passare a Windows o usare ip addr.",
        doesNot: "Non esegue la sintassi Windows sul bash.",
      },
    ],
  },
  {
    id: "ftp-session",
    title: "Sessione FTP (dopo `ftp <host>`)",
    device: "ftp",
    blurb: "Comandi validi solo dentro la sessione FTP sul CMD del PC.",
    commands: [
      {
        cmd: "user / pass",
        does: "Login con account Server → Services → FTP (default cisco/cisco).",
        doesNot: "Niente anonymous FTP automatico.",
      },
      {
        cmd: "dir / ls / list",
        does: "Elenca file sul server se permesso LIST.",
        doesNot: "Niente dettagli owner/unix reali.",
      },
      {
        cmd: "get",
        synopsis: "get <file>",
        does: "Simula download (conta byte) se READ.",
        doesNot: "Il file non appare nel Text Editor automaticamente.",
      },
      {
        cmd: "delete",
        synopsis: "delete <file>",
        does: "Rimuove il file dal servizio FTP se DELETE.",
        doesNot: "Niente cestino / undelete.",
      },
      {
        cmd: "bye / quit",
        does: "Chiude la sessione FTP.",
        doesNot: "—",
      },
    ],
  },
  {
    id: "router",
    title: "Router — CLI Cisco-like",
    device: "router",
    blurb:
      "Doppio clic sul router → Console CLI. Modi: user `>` → enable `#` → conf t `(config)#` → interface `(config-if)#`.",
    commands: [
      {
        cmd: "enable / disable",
        mode: "user / enable",
        does: "Entra/esce da privileged EXEC. Con AAA attivo chiede username/password RADIUS.",
        doesNot: "Niente enable secret locale separato (solo AAA o libero).",
      },
      {
        cmd: "configure terminal",
        synopsis: "configure terminal | conf t",
        mode: "enable",
        does: "Entra in configuration mode.",
        doesNot: "Niente conf mem / copy run start (config è lo stato lab).",
      },
      {
        cmd: "hostname",
        synopsis: "hostname <nome>",
        mode: "config",
        does: "Cambia hostname CLI e nome device.",
        doesNot: "—",
        example: "hostname R1",
      },
      {
        cmd: "interface",
        synopsis: "interface <nome> | interface Gi0/0.10",
        mode: "config",
        does: "Seleziona porta o crea subinterface (router-on-a-stick).",
        doesNot: "Niente range; nomi devono esistere dai moduli Physical.",
        example: "interface GigabitEthernet0/0\ninterface GigabitEthernet0/0.10",
      },
      {
        cmd: "encapsulation dot1Q",
        synopsis: "encapsulation dot1Q <vlan>",
        mode: "config-if (subif)",
        does: "Tag VLAN sulla subinterface.",
        doesNot: "Niente second-dot1q / QinQ.",
      },
      {
        cmd: "ip address",
        synopsis: "ip address <ip> <mask>",
        mode: "config-if",
        does: "Assegna IPv4 all’interfaccia.",
        doesNot: "Niente secondary address; niente IPv6 qui.",
        example: "ip address 192.168.10.1 255.255.255.0",
      },
      {
        cmd: "no shutdown / shutdown",
        mode: "config-if",
        does: "Abilita/disabilita amministrativamente la porta.",
        doesNot: "—",
      },
      {
        cmd: "clock rate",
        synopsis: "clock rate <bps>",
        mode: "config-if (serial)",
        does: "Imposta clock sul DCE seriale (line protocol).",
        doesNot: "Solo lato DCE ha effetto; valori tipici 64000.",
        example: "clock rate 64000",
      },
      {
        cmd: "ip route",
        synopsis: "ip route <rete> <mask> <next-hop>",
        mode: "config",
        does: "Aggiunge rotta statica.",
        doesNot: "Niente floating static con AD custom; niente OSPF/EIGRP (roadmap).",
        example: "ip route 192.168.2.0 255.255.255.0 10.0.0.2",
      },
      {
        cmd: "no ip route",
        does: "Rimuove rotta statica.",
        doesNot: "—",
      },
      {
        cmd: "access-list",
        synopsis: "access-list <n> permit|deny ip|icmp <src> <dst>",
        mode: "config",
        does: "Crea ACE semplificate (ip/icmp).",
        doesNot: "Niente porte TCP/UDP, named ACL, time-range (roadmap Firewall).",
      },
      {
        cmd: "ip access-group",
        synopsis: "ip access-group <n> in|out",
        mode: "config-if",
        does: "Applica ACL inbound/outbound sull’interfaccia.",
        doesNot: "Valutata soprattutto su ICMP/ping nella sim attuale.",
      },
      {
        cmd: "aaa new-model",
        mode: "config",
        does: "Abilita AAA sul router.",
        doesNot: "Niente method-list multiple oltre enable.",
      },
      {
        cmd: "radius-server host",
        synopsis: "radius-server host <ip> key <secret>",
        mode: "config",
        does: "Punta al Server-PT AAA (secret tipico cisco).",
        doesNot: "Niente TACACS host separato in questo comando (type via auth line).",
        example: "radius-server host 192.168.1.100 key cisco",
      },
      {
        cmd: "aaa authentication enable …",
        synopsis: "aaa authentication enable default group radius",
        mode: "config",
        does: "enable richiede login RADIUS/TACACS.",
        doesNot: "Niente login vty line AAA completo.",
      },
      {
        cmd: "copy tftp flash",
        synopsis: "copy tftp flash <ip> <file>",
        mode: "enable",
        does: "Scarica immagine dal TFTP Server-PT in flash simulata.",
        doesNot: "Non cambia IOS in esecuzione; solo inventario flash.",
        example: "copy tftp flash 192.168.1.100 c1900-universalk9-mz.SPA.151-4.M4.bin",
      },
      {
        cmd: "show flash",
        mode: "enable",
        does: "Elenca immagini scaricate via TFTP.",
        doesNot: "Niente space free reale.",
      },
      {
        cmd: "ntp sync",
        mode: "enable",
        does: "Client NTP verso Server-PT.",
        doesNot: "Niente `ntp server` IOS classico (equivalente didattico).",
      },
      {
        cmd: "show ip interface brief",
        does: "Tabella interfacce: IP, status, protocol.",
        doesNot: "Niente metodo (manual/DHCP) dettagliato.",
      },
      {
        cmd: "show interfaces",
        does: "Dettaglio porte (up/down, line protocol).",
        doesNot: "Niente contatori error/CRC realistici.",
      },
      {
        cmd: "show ip route",
        does: "Connected + statiche.",
        doesNot: "Niente OSPF/EIGRP codes (roadmap).",
      },
      {
        cmd: "show arp / show ip arp",
        does: "Tabella ARP del router.",
        doesNot: "—",
      },
      {
        cmd: "show access-lists",
        does: "Elenca ACL definite.",
        doesNot: "Hit count spesso non incrementati in UI.",
      },
      {
        cmd: "ping",
        synopsis: "ping <ip>",
        mode: "user/enable",
        does: "ICMP dal router.",
        doesNot: "Niente extended ping interattivo.",
      },
      {
        cmd: "exit / end",
        does: "Esce di un livello / torna a enable.",
        doesNot: "—",
      },
    ],
  },
  {
    id: "switch",
    title: "Switch L2 — CLI Cisco-like",
    device: "switch",
    blurb:
      "Stessa console dei router; comandi VLAN/trunk/MAC/STP. Inter-VLAN richiede trunk + router-on-a-stick.",
    commands: [
      {
        cmd: "vlan / name",
        synopsis: "vlan <id> → name <nome>",
        mode: "config → config-vlan",
        does: "Crea VLAN e assegna nome.",
        doesNot: "Niente VTP; VLAN 1002–1005 riservate stile Cisco.",
        example: "vlan 10\nname SALES",
      },
      {
        cmd: "switchport access vlan",
        synopsis: "switchport access vlan <id>",
        mode: "config-if",
        does: "Porta access in una VLAN.",
        doesNot: "Niente voice VLAN.",
        example: "switchport access vlan 10",
      },
      {
        cmd: "switchport mode trunk",
        does: "Imposta porta trunk (dot1Q).",
        doesNot: "Negoziato DTP non simulato — set manuale.",
      },
      {
        cmd: "switchport trunk native vlan",
        does: "VLAN nativa sul trunk.",
        doesNot: "—",
      },
      {
        cmd: "switchport trunk allowed vlan",
        synopsis: "switchport trunk allowed vlan <lista|all>",
        does: "Filtra VLAN permesse sul trunk.",
        doesNot: "Sintassi add/remove parziale rispetto a IOS.",
      },
      {
        cmd: "show vlan brief",
        does: "VLAN e porte associate.",
        doesNot: "—",
      },
      {
        cmd: "show mac address-table",
        does: "MAC dynamic apprese dal traffico.",
        doesNot: "Niente aging timer configurabile.",
      },
      {
        cmd: "show spanning-tree",
        does: "Ruoli/stati STP semplificati (FWD/BLK).",
        doesNot: "Niente RSTP per-VLAN completo (roadmap).",
      },
      {
        cmd: "show interfaces status / trunk",
        does: "Stato porte e trunk.",
        doesNot: "—",
      },
      {
        cmd: "show ip interface brief",
        does: "Utile anche sullo switch (SVI limitate se presenti).",
        doesNot: "Routing L3 multilayer incompleto (visione).",
      },
    ],
  },
  {
    id: "server-ui",
    title: "Server-PT — Config / Services (UI)",
    device: "server",
    blurb:
      "Non è IOS: si configura da Desktop → Services (e Config). I client usano i comandi PC sopra.",
    commands: [
      {
        cmd: "HTTP / HTTPS",
        does: "Pagine editabili (index, helloworld, …); Web Browser e `http`.",
        doesNot: "Niente CGI/PHP; HTTPS senza certificati reali.",
      },
      {
        cmd: "DHCP pools",
        does: "Pool Name, gateway, DNS, start IP, mask, max users; serverPool locked.",
        doesNot: "Niente opzioni DHCP avanzate / relay.",
      },
      {
        cmd: "DNS",
        does: "Record A, CNAME, SOA, NS + DNS Cache con TTL.",
        doesNot: "Niente zone transfer / DNSSEC.",
      },
      {
        cmd: "TFTP",
        does: "Immagini IOS per `copy tftp flash`.",
        doesNot: "Niente upload arbitrario da PC.",
      },
      {
        cmd: "SYSLOG",
        does: "Log da link-up / power e NTP.",
        doesNot: "Niente facility/severity filtrabili stile rsyslog.",
      },
      {
        cmd: "AAA",
        does: "Client RADIUS/TACACS + users per enable router.",
        doesNot: "Niente 802.1X completo (visione WLC).",
      },
      {
        cmd: "NTP",
        does: "Orologio server + auth key UI; client con ntp sync.",
        doesNot: "Niente stratum gerarchico multi-server.",
      },
      {
        cmd: "EMAIL",
        does: "Dominio, SMTP/POP3, caselle; client Desktop Email.",
        doesNot: "Niente IMAP / allegati binari.",
      },
      {
        cmd: "FTP",
        does: "Account + permessi R/W/D/N/L; file list.",
        doesNot: "Niente SFTP/FTPS.",
      },
      {
        cmd: "Desktop Server",
        does: "Stesse app PC + Config/Services; Remote Desktop inbound.",
        doesNot: "Niente Programming / IoT / VM Management (roadmap).",
      },
    ],
  },
];
