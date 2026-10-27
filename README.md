# NetLab

Laboratorio stile **Cisco Packet Tracer 9** nel browser.

## Cosa c’è

- Palette dispositivi ispirata a PT 9: PC/Laptop/Server/Printer/7960/Tablet/Smartphone/TV, Hub/Bridge/Repeater, 2950/2960/3560/3650/IE-2000, 1841/1941/2811/2901/2911/ISR4321/4331, WRT300N, AP/LAP/WLC, ASA 5505/5506-X, DSL/Cable Modem, Cloud, Central Office
- Cavi PT: Automatically Choose, Straight-Through, Cross-Over, Serial, Fiber, Console, Coaxial, Phone, Wireless
- Desktop simulato sugli host: `ipconfig /ip …`, `ping`, `arp` (fluido)
- Motore L2/L3 semplificato

## ReactOS / FPS

Su questa Cloud VM **non c’è KVM nested utilizzabile**. ReactOS in QEMU resta a ~1–2 FPS: **non può arrivare a 20–30 FPS qui**.

Per un OS vero usabile: VirtualBox/VMware/QEMU **sul tuo PC** con virtualizzazione attiva. Nel lab NetLab usa il **desktop simulato**.

## Avvio

```bash
npm install
npm run build && npm run start
# opzionale stesso-origine noVNC:
npm run gateway   # :43130
```

Lab: [http://127.0.0.1:43127/lab](http://127.0.0.1:43127/lab)

## Packet Tracer sul tuo PC

Il path `C:\Program Files\Cisco Packet Tracer 9.0.1` non è leggibile dalla Cloud VM.  
Per allineare ancora meglio: manda screenshot della palette (End Devices / Switches / Routers / Connections) oppure l’elenco file dalla cartella dispositivi.
