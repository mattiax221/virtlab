# NetLab

Laboratorio stile **Cisco Packet Tracer** nel browser:

- topologia con tanti dispositivi (PC, laptop, server, stampante, IP phone, hub, switch L2/L3, router, Wi‑Fi, modem DSL/Cable, cloud, AP, firewall)
- cavi e ping L2/L3
- **PC / Laptop / Server**: desktop simulato (IP statico + comandi) **oppure** **ReactOS** reale via VNC (un disco per host)
- altri dispositivi: simulati (come in Packet Tracer)

## Avvio

```bash
npm install
npm run dev
```

Apri [http://127.0.0.1:43127/lab](http://127.0.0.1:43127/lab).

In Cloud Agent, `127.0.0.1` dal Chrome del tuo PC non funziona: serve tunnel o `npm run dev` in locale.

## ReactOS (gratis)

```bash
# ISO in vm/reactos/live.iso
./scripts/reactos-pc.sh status
```

Dal lab: doppio clic su un PC → **ReactOS reale (VNC)**.

## Cosa non è (ancora)

Parità totale con Packet Tracer (tutti i moduli, IoT, activity wizard, …) è un percorso a slice. Questo repo parte dal core reti + catalogo dispositivi + OS per host.
