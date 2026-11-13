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

Senza variabili Supabase il lab parte comunque in modalità ospite
(«Continua senza account»).

## Account (Supabase)

Copia `.env.example` in `.env.local` e, su Vercel, imposta le stesse variabili
prima del deploy:

| Variabile | Dove |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client e server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client e server (chiave anon, non mostrarla in pagina) |
| `SUPABASE_SERVICE_ROLE_KEY` | solo server, per eliminare o bloccare l’utente Auth da `/admin` |

In Authentication → URL Configuration aggiungi il redirect
`https://<dominio>/auth/callback` (in locale `http://127.0.0.1:43127/auth/callback`).

Applica lo schema con il file
`supabase/migrations/20261113120000_profiles.sql`
(SQL editor di Supabase, oppure `supabase db push`).

Ruoli: `user` (laboratorio), `viewer` (stesso accesso al lab, non è admin),
`admin` (pagina `/admin`).

**Primo amministratore:** registrati dall’app, poi nel SQL editor:

```sql
update public.profiles
set role = 'admin'
where email = 'tuo@indirizzo.it';
```

Quel comando gira senza sessione utente, quindi può impostare il ruolo.
Un utente normale non può cambiare `role` dal client.

Gateway opzionale (stesso origine): `npm run gateway` → porta 43130.

## Pubblicazione (GitHub + Vercel)

Repo pubblico: [github.com/mattiax221/virtlab](https://github.com/mattiax221/virtlab)

1. **GitHub**: push su `main` → `https://github.com/mattiax221/virtlab.git`
2. **Vercel**: Import del repo → Framework Next.js → Deploy
3. **Changelog**: ogni rilascio aggiorna `/changelog`

Dopo ogni update: GitHub → Vercel → `/changelog`.
