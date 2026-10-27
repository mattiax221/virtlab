# NetLab

Laboratorio stile **Cisco Packet Tracer** nel browser.

## Cosa c’è

- Palette dispositivi ispirata a PT: PC/Laptop/Server/Printer/telefono/Tablet/Smartphone, Hub/Bridge/Repeater, switch e router Cisco-like, AP/WLC, firewall, modem, Cloud
- Cavi: Automatically Choose, Straight-Through, Cross-Over, Serial, Fiber, Console, Coaxial, Phone, Wireless
- **PC / Laptop / Server**: desktop Windows simulato con
  `Pannello di controllo \ Rete e Internet \ Connessioni di rete`
  → Proprietà adattatore → TCP/IPv4 (IP statico come in Windows)
- Prompt dei comandi: `ipconfig`, `ping`, …
- **L2 switch (Cisco-like)**: LED porte, VLAN access/trunk, `show vlan brief`,
  `show mac address-table`, `show interfaces status`, isolamento tra VLAN
- **Inter-VLAN**: router-on-a-stick (`interface Gi0/0.10` + `encapsulation dot1Q`)
- **Physical**: spegni il device → rimuovi/aggiungi moduli (Ethernet, Wi‑Fi, WIC, uplink)
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
