#!/usr/bin/env bash
# ReactOS per host — SOLO utile con KVM/VirtualBox locale.
# Su Cloud Agent nested-virt: ~1-2 FPS, inutilizzabile per il lab.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ISO="${NETLAB_REACTOS_ISO:-$ROOT/vm/reactos/live.iso}"
DISK_DIR="${NETLAB_REACTOS_DISKS:-$ROOT/vm/disks}"
RUN_DIR="${NETLAB_REACTOS_RUN:-$ROOT/vm/run}"
VNC_DISPLAY="${NETLAB_REACTOS_VNC_DISPLAY:-2}"
RAM_MB="${NETLAB_REACTOS_RAM_MB:-1024}"
NOVNC_PORT="${NETLAB_NOVNC_PORT:-6080}"

mkdir -p "$DISK_DIR" "$RUN_DIR"

usage() {
  echo "Uso: $0 start <deviceId> | stop | status"
  exit 1
}

[[ $# -ge 1 ]] || usage
CMD="$1"
DEVICE_ID="${2:-}"

PID_FILE="$RUN_DIR/qemu.pid"
ACTIVE_FILE="$RUN_DIR/active-device"
NOVNC_PID_FILE="$RUN_DIR/novnc.pid"
MONITOR_SOCK="$RUN_DIR/qemu.monitor"

stop_all() {
  if [[ -f "$PID_FILE" ]]; then
    pid="$(cat "$PID_FILE" || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 0.5
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi
  if [[ -f "$NOVNC_PID_FILE" ]]; then
    npid="$(cat "$NOVNC_PID_FILE" || true)"
    if [[ -n "${npid:-}" ]] && kill -0 "$npid" 2>/dev/null; then
      kill "$npid" 2>/dev/null || true
    fi
    rm -f "$NOVNC_PID_FILE"
  fi
  pkill -f "qemu-system-x86_64.*NetLab-ReactOS" 2>/dev/null || true
  pkill -f "websockify.*${NOVNC_PORT}" 2>/dev/null || true
  rm -f "$ACTIVE_FILE" "$MONITOR_SOCK"
}

case "$CMD" in
  stop)
    stop_all
    echo '{"ok":true,"running":false}'
    ;;
  status|active)
    running=false
    active=""
    if [[ -f "$PID_FILE" ]]; then
      pid="$(cat "$PID_FILE")"
      if kill -0 "$pid" 2>/dev/null; then
        running=true
        active="$(cat "$ACTIVE_FILE" 2>/dev/null || true)"
      fi
    fi
    iso=false
    [[ -f "$ISO" ]] && iso=true
    novnc=false
    if [[ -f "$NOVNC_PID_FILE" ]] && kill -0 "$(cat "$NOVNC_PID_FILE")" 2>/dev/null; then
      novnc=true
    fi
    # Nested KVM on this cloud image hangs — do not claim kvm:true.
    echo "{\"ok\":true,\"running\":$running,\"activeDevice\":\"$active\",\"isoPresent\":$iso,\"novnc\":$novnc,\"kvm\":false,\"usableFps\":false,\"vncPort\":$((5900 + VNC_DISPLAY)),\"novncPort\":$NOVNC_PORT,\"novncPath\":\"/novnc/vnc_lite.html\",\"note\":\"ReactOS needs local KVM/VirtualBox for 20-30+ FPS\"}"
    ;;
  start)
    [[ -n "$DEVICE_ID" ]] || usage
    if [[ ! -f "$ISO" ]]; then
      echo "{\"ok\":false,\"error\":\"Manca ISO ReactOS in $ISO\"}"
      exit 1
    fi
    stop_all
    disk="$DISK_DIR/${DEVICE_ID}.qcow2"
    if [[ ! -f "$disk" ]]; then
      qemu-img create -f qcow2 "$disk" 8G >/dev/null
    fi
    # Force TCG here: nested KVM hangs on this host.
    qemu-system-x86_64 \
      -accel tcg,thread=multi \
      -cpu qemu64 \
      -m "$RAM_MB" \
      -smp 2 \
      -usb -device usb-tablet \
      -drive "file=$disk,if=ide,index=0,media=disk" \
      -drive "file=$ISO,if=ide,index=1,media=cdrom,readonly=on" \
      -boot order=d \
      -netdev user,id=net0 \
      -device e1000,netdev=net0 \
      -vga std \
      -display none \
      -vnc "127.0.0.1:${VNC_DISPLAY}" \
      -monitor "unix:$MONITOR_SOCK,server,nowait" \
      -name "NetLab-ReactOS-$DEVICE_ID" \
      -pidfile "$PID_FILE" \
      -daemonize

    echo "$DEVICE_ID" > "$ACTIVE_FILE"
    websockify --web /usr/share/novnc "$NOVNC_PORT" "127.0.0.1:$((5900 + VNC_DISPLAY))" \
      >/tmp/netlab-websockify.log 2>&1 &
    echo $! > "$NOVNC_PID_FILE"
    echo "{\"ok\":true,\"running\":true,\"activeDevice\":\"$DEVICE_ID\",\"kvm\":false,\"usableFps\":false,\"note\":\"Use simulated desktop for lab; ReactOS is demo-only here\"}"
    ;;
  *)
    usage
    ;;
esac
