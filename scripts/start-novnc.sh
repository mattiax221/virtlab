#!/usr/bin/env bash
# Espone la VNC della VM Windows via noVNC (browser) sulla porta 6080.
set -euo pipefail

VNC_TARGET="${NETLAB_VNC_TARGET:-127.0.0.1:5901}"
WEB_PORT="${NETLAB_NOVNC_PORT:-6080}"
NOVNC_WEB="${NOVNC_WEB:-/usr/share/novnc}"

if [[ ! -d "$NOVNC_WEB" ]]; then
  echo "noVNC non trovato in $NOVNC_WEB"
  exit 1
fi

echo "noVNC → http://0.0.0.0:${WEB_PORT}/vnc.html?host=HOST&port=${WEB_PORT}&path=websockify&autoconnect=1"
echo "Backend VNC: $VNC_TARGET"
exec websockify --web "$NOVNC_WEB" "$WEB_PORT" "$VNC_TARGET"
