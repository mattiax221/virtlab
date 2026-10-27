# OS reali (ReactOS) + dispositivi simulati

## Modello NetLab (allineato al lab Packet Tracer)

| Componente | Modalità |
|---|---|
| PC / Laptop / Server | **ReactOS** (OS gratis open-source) — un disco per ogni host |
| Stampanti, IP phone, hub, switch, router, modem, cloud, AP, firewall | **Simulati** (rete L2/L3 nel browser) |

IP statico per la topologia lab: apri l’host → **Desktop simulato** → `ipconfig /ip …` poi `ping`.

ReactOS: OS vero via VNC; **una sola VM attiva alla volta** (RAM / no KVM). Ogni PC ha comunque il suo file disco `vm/disks/<deviceId>.qcow2`.

## ReactOS ISO

Metti l’ISO live come:

```text
vm/reactos/live.iso
```

(già scaricabile dagli script di setup / SourceForge ReactOS 0.4.14 Live)

```bash
./scripts/reactos-pc.sh start <deviceId>
./scripts/reactos-pc.sh stop
./scripts/reactos-pc.sh status
```

noVNC: porta **6080** · VNC QEMU: **5902**

## Nota licenze

ReactOS è libero. Windows Microsoft non è “free”: Evaluation a tempo oppure licenza. NetLab usa ReactOS per gli host.
