# NetLab

Laboratorio di rete nel browser: topologia stile Packet Tracer, ma quando apri un PC entri in un **desktop Windows simulato** e usi il **Prompt dei comandi** (`ipconfig`, `ping`, `arp`, `route print`) invece di form e bottoni.

## Cosa fa

- Dispositivi: PC, Switch, Router
- Collegamenti a cavo sulla topologia
- Motore L2/L3 semplificato (LAN, gateway, ping)
- Desktop Windows + CMD sul PC
- CLI stile Cisco sul router (`enable`, `configure terminal`, `ip address`, …)

## Cosa non è (ancora)

Non è una VM Windows reale (QEMU/Hyper-V + licenza Microsoft). La rete e i comandi sono simulati in modo coerente a scopo didattico. Un passo successivo può collegare console/noVNC a macchine virtuali vere.

## Avvio locale

```bash
npm install
npm run dev
```

Apri [http://127.0.0.1:43127](http://127.0.0.1:43127).

## Percorso consigliato

1. Dalla home clicca **Apri il laboratorio** (oppure apri `/lab` — c’è già una demo LAN).
2. Doppio clic su **PC0** → digita `ipconfig`, poi `ping 192.168.1.20`.
3. Prova a scollegare un cavo (strumento Elimina sul cavo) e ripeti il ping.
4. Sul router: doppio clic → `enable` → `show ip interface brief`.

## Stack

Next.js, TypeScript, Tailwind CSS. Tutta la simulazione gira nel client.
