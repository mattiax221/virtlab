# NetLab

Laboratorio stile **Cisco Packet Tracer** nel browser.

## Cosa c’è

- Palette dispositivi ispirata a PT: PC/Laptop/Server/Printer/telefono/Tablet/Smartphone, Hub/Bridge/Repeater, switch e router Cisco-like, AP/WLC, firewall, modem, Cloud
- Cavi: Automatically Choose, Straight-Through, Cross-Over, Serial, Fiber, Console, Coaxial, Phone, Wireless
- **PC / Laptop / Server**: desktop Windows simulato con
  `Pannello di controllo \ Rete e Internet \ Connessioni di rete`
  → Proprietà adattatore → TCP/IPv4 (IP statico come in Windows)
- Desktop PT-like: **Web Browser**, **Text Editor**, **Traffic Generator**, Prompt, Physical
- Prompt dei comandi: `ipconfig`, `ping`, `nslookup`, `http`, `ftp`, …
- **L2 switch (Cisco-like)**: LED porte, VLAN access/trunk, `show vlan brief`,
  `show mac address-table`, `show interfaces status`, isolamento tra VLAN
- **Inter-VLAN**: router-on-a-stick (`interface Gi0/0.10` + `encapsulation dot1Q`)
- **Physical**: spegni il device → rimuovi/aggiungi moduli (Ethernet, Wi‑Fi, WIC, uplink)
- **Wi‑Fi**: tray stile Windows, scan SSID dagli AP, WPA2
- **Server-PT Config/Services** (docs PT): HTTP, DHCP pools, TFTP, DNS A/CNAME/SOA/NS, SYSLOG, AAA, NTP, EMAIL, FTP
- **DHCP / DNS / HTTP** sul Server-PT (`ipconfig /renew`, `nslookup www.lab`, Web Browser → `www.lab`)
- **DHCP automatico** quando colleghi il cavo Ethernet a un host senza IP
- **ARP reale**: cache su host (`arp -a`) e router (`show arp`); si aggiorna con i ping
- **Routing statico**: `ip route` / `show ip route` tra due router
- **Salva / Carica** lab in JSON + autosave locale
- **Condividi link** (`#lab=…`): snapshot statico nell’URL (ripremi Condividi dopo modifiche), niente account/database
- **Autosave** locale con ripristino all’apertura (prompt)
- **Simulation**: ARP, ICMP, DHCP, DNS, HTTP (click destinazione Server)
- Trascina i dispositivi dalla barra sotto sul canvas (snap griglia + Annulla/Ripeti)
- **WAN Serial**: cavo Serial + `clock rate` sul DCE
- **ACL** base Cisco-like (`access-list`, `ip access-group`)
- Esercizi guidati VLAN (access + trunk + router-on-a-stick)
- Motore L2/L3 con flood VLAN-aware + learning MAC

## Avvio

```bash
npm install
npm run build && npm run start
# oppure in sviluppo:
npm run dev
```

Lab: [http://127.0.0.1:43127/lab](http://127.0.0.1:43127/lab)

Gateway opzionale (stesso origine): `npm run gateway` → porta 43130.
