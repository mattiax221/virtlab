# Windows reale via VNC (QEMU + noVNC)

## Licenza

Qui si usa solo Windows **legittimo**:

- [Windows Enterprise Evaluation](https://www.microsoft.com/evalcenter) (periodo di prova Microsoft), oppure
- un ISO che possiedi già con licenza valida

**Non** supportiamo ISO crackate, activator o “Windows senza licenza”.
Un Windows non attivato in prova può mostrare watermark e scade: non è lo stesso di una copia pirata.

## Setup

1. Metti l’ISO qui come `vm/windows.iso` (il file è in `.gitignore`).
2. Avvia la VM:

```bash
chmod +x scripts/start-windows-vm.sh scripts/start-novnc.sh
./scripts/start-windows-vm.sh
```

3. In un altro terminale:

```bash
./scripts/start-novnc.sh
```

4. Apri nel browser: `http://127.0.0.1:6080/vnc.html`  
   (in Cloud Agent serve un tunnel anche su quella porta, come per NetLab).

Installazione Windows nella VM: segui il setup Microsoft a schermo (lingua, partizioni, account locale).
