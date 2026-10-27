#!/usr/bin/env bash
# Avvia una VM Windows (eval/licenziata) con display VNC sulla porta 5901.
# NON usa copie pirata: serve un ISO legittimo (es. Windows Evaluation Microsoft).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VM_DIR="${NETLAB_VM_DIR:-$ROOT/vm}"
DISK="$VM_DIR/windows.qcow2"
ISO="$VM_DIR/windows.iso"
# 5901 is often già usato dal desktop Cloud Agent — Windows usa 5902
VNC_PORT="${NETLAB_VNC_PORT:-5902}"
RAM_MB="${NETLAB_VM_RAM_MB:-3072}"
CPUS="${NETLAB_VM_CPUS:-2}"

mkdir -p "$VM_DIR"

if [[ ! -f "$ISO" ]]; then
  cat <<EOF
Manca l'ISO Windows in:
  $ISO

Scarica un'immagine LEGITTIMA, ad esempio:
  - Windows 10/11 Enterprise Evaluation (Microsoft Evaluation Center)
  - oppure un ISO che hai già con licenza valida

Poi:
  mv /percorso/Windows.iso "$ISO"
  $0

Copie crackate / senza licenza non sono supportate.
EOF
  exit 1
fi

if [[ ! -f "$DISK" ]]; then
  echo "Creo disco virtuale 40G in $DISK"
  qemu-img create -f qcow2 "$DISK" 40G
fi

ACCEL=()
if [[ -r /dev/kvm ]]; then
  ACCEL=(-enable-kvm -cpu host)
  echo "KVM disponibile — accelerazione hardware attiva"
else
  ACCEL=(-cpu qemu64)
  echo "ATTENZIONE: senza /dev/kvm la VM sarà molto lenta (emulazione software)"
fi

echo "VNC su 127.0.0.1:${VNC_PORT} (poi avvia scripts/start-novnc.sh)"
exec qemu-system-x86_64 \
  "${ACCEL[@]}" \
  -m "$RAM_MB" \
  -smp "$CPUS" \
  -drive "file=$DISK,if=virtio,cache=writeback" \
  -cdrom "$ISO" \
  -boot order=dc \
  -netdev user,id=net0 \
  -device virtio-net-pci,netdev=net0 \
  -vga std \
  -display none \
  -vnc "127.0.0.1:$((VNC_PORT - 5900))" \
  -name "NetLab-Windows"
