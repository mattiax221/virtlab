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
- **Routing statico**: `ip route` / `show ip route` tra router; il ping verifica andata **e ritorno**
- **Switch multilayer**: `ip routing` + SVI (`interface vlan N`) per il routing tra VLAN
- **DHCP relay**: `ip helper-address` sul router, un pool per subnet sul Server-PT
- **STP 802.1D**: root bridge, root port e porte bloccate anche negli anelli; `spanning-tree vlan N priority`
- **Salva / Carica** lab in JSON + autosave locale
- **Condividi link** (`#lab=…`): snapshot statico nell’URL (ripremi Condividi dopo modifiche), niente account/database
- **Autosave** locale con ripristino all’apertura (prompt)
- **Simulation**: ARP, ICMP, DHCP, DNS, HTTP (click destinazione Server)
- Trascina i dispositivi dalla barra sotto sul canvas (snap griglia + Annulla/Ripeti)
- **WAN Serial**: cavo Serial + `clock rate` sul DCE
- **ACL** Cisco-like: standard 1-99 e estese 100-199 con wildcard, `tcp/udp eq porta` (`access-list`, `ip access-group`)
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

Applica lo schema con i due file, in ordine
(SQL editor di Supabase, oppure `supabase db push`):

1. `supabase/migrations/20261113120000_profiles.sql`
2. `supabase/migrations/20261113130000_classi_lab_consegne.sql`

Ruoli: `user` (allievo), `teacher` (docente), `admin` (amministratore).
Il vecchio ruolo `viewer` diventa `teacher` con la seconda migrazione.

**Primo amministratore:** registrati dall’app, poi nel SQL editor:

```sql
update public.profiles
set role = 'admin'
where email = 'tuo@indirizzo.it';
```

Quel comando gira senza sessione utente, quindi può impostare il ruolo.
Un utente normale non può cambiare `role` dal client.

### Classi, lab online e consegne

- **I miei lab** (pulsante nel laboratorio, solo con account): salva il lab
  sul server, riaprilo da qualsiasi PC; il lab aperto si salva da solo.
- **Classi**: il docente crea una classe e ottiene un **codice**. L’allievo
  lo inserisce quando si registra (campo “Codice classe”) oppure da
  *I miei lab → Classi*. Il docente può anche aggiungere utenti per email.
- **Consegne**: il docente assegna un esercizio a una classe, con scadenza e
  **verifiche automatiche** (il ping deve riuscire / essere bloccato, la
  pagina web si apre, l’IP arriva via DHCP). L’allievo apre la consegna,
  preme *Verifica* per vedere cosa manca e poi *Consegna*.
- **Area docente / Amministrazione** (`/admin`): panoramica con grafici
  (avanzamento per classe, errori più frequenti, attività), classi con
  codice e membri, esito di ogni allievo con il motivo degli errori,
  lab dell’allievo in sola lettura (`/lab/vedi/<id>`), esportazione CSV per Excel.
  Le verifiche si ricalcolano sul server dal lab consegnato.
- Il docente vede solo le sue classi; l’amministratore vede tutto e gestisce
  ruoli e account.

Gateway opzionale (stesso origine): `npm run gateway` → porta 43130.

## Pubblicazione (GitHub + Vercel)

Repo pubblico: [github.com/mattiax221/virtlab](https://github.com/mattiax221/virtlab)

1. **GitHub**: push su `main` → `https://github.com/mattiax221/virtlab.git`
2. **Vercel**: Import del repo → Framework Next.js → Deploy
3. **Changelog**: ogni rilascio aggiorna `/changelog`

Dopo ogni update: GitHub → Vercel → `/changelog`.
