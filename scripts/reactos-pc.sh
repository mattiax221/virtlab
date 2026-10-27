#!/usr/bin/env bash
# Una VM ReactOS per ogni PC del lab (disco dedicato).
# Solo UNA VM attiva alla volta (RAM limitata, no KVM).
# IMPORTANTE: IDE + e1000 (ReactOS Live non gestisce bene virtio → schermo nero).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ISO="${NETLAB_REACTOS_ISO:-$ROOT/vm/reactos/live.iso}"
DISK_DIR="${NETLAB_REACTOS_DISKS:-$ROOT/vm/disks}"
RUN_DIR="${NETLAB_REACTOS_RUN:-$ROOT/vm/run}"
VNC_DISPLAY="${NETLAB_REACTOS_VNC_DISPLAY:-2}" # 5900+2 = 5902
RAM_MB="${NETLAB_REACTOS_RAM_MB:-1024}"
NOVNC_PORT="${NETLAB_NOVNC_PORT:-6080}"

mkdir -p "$DISK_DIR" "$RUN_DIR"

usage() {
  echo "Uso: $0 start <deviceId> | stop | status | active"
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
      for _ in 1 2 3 4 5; do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.4
      done
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
  active|status)
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
    echo "{\"ok\":true,\"running\":$running,\"activeDevice\":\"$active\",\"isoPresent\":$iso,\"novnc\":$novnc,\"vncPort\":$((5900 + VNC_DISPLAY)),\"novncPort\":$NOVNC_PORT,\"novncPath\":\"/novnc/vnc_lite.html\"}"
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
    ACCEL=(-cpu qemu64)
    if [[ -r /dev/kvm ]]; then
      ACCEL=(-enable-kvm -cpu host)
    fi

    # IDE + e1000: ReactOS Live 0.4.14 si blocca/nero con virtio
    qemu-system-x86_64 \
      "${ACCEL[@]}" \
      -m "$RAM_MB" \
      -smp 1 \
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

    echo "{\"ok\":true,\"running\":true,\"activeDevice\":\"$DEVICE_ID\",\"novncPort\":$NOVNC_PORT,\"vncPort\":$((5900 + VNC_DISPLAY)),\"novncPath\":\"/novnc/vnc_lite.html\"}"
    ;;
  *)
    usage
    ;;
esac
