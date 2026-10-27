#!/usr/bin/env node
/**
 * Single public port for NetLab + noVNC (same origin through Cloudflare).
 *   /novnc/* and /websockify → websockify :6080
 *   everything else → Next :43127
 */
import http from "node:http";
import httpProxy from "http-proxy";

const LISTEN = Number(process.env.NETLAB_GATEWAY_PORT || 43130);
const NEXT = process.env.NETLAB_NEXT_URL || "http://127.0.0.1:43127";
const NOVNC = process.env.NETLAB_NOVNC_URL || "http://127.0.0.1:6080";

const proxy = httpProxy.createProxyServer({
  ws: true,
  xfwd: true,
  changeOrigin: true,
});

proxy.on("error", (err, _req, res) => {
  console.error("[gateway]", err.message);
  if (res && !res.headersSent && typeof res.writeHead === "function") {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Bad gateway");
  }
});

function targetFor(url = "") {
  if (url.startsWith("/novnc") || url.startsWith("/websockify")) return NOVNC;
  return NEXT;
}

function rewriteNovnc(url = "") {
  // /novnc/vnc_lite.html → /vnc_lite.html on websockify
  if (url.startsWith("/novnc")) {
    const rest = url.slice("/novnc".length) || "/";
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  // noVNC default WS path
  if (url.startsWith("/websockify")) {
    return "/" + url.slice("/websockify".length).replace(/^\//, "");
  }
  return url;
}

const server = http.createServer((req, res) => {
  const target = targetFor(req.url || "");
  if (target === NOVNC) {
    req.url = rewriteNovnc(req.url || "");
  }
  proxy.web(req, res, { target });
});

server.on("upgrade", (req, socket, head) => {
  const target = targetFor(req.url || "");
  if (target === NOVNC) {
    req.url = rewriteNovnc(req.url || "");
  }
  proxy.ws(req, socket, head, { target });
});

server.listen(LISTEN, "0.0.0.0", () => {
  console.log(
    `NetLab gateway :${LISTEN} → Next ${NEXT} | noVNC ${NOVNC} (paths /novnc /websockify)`,
  );
});
