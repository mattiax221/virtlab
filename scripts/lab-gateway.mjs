#!/usr/bin/env node
/**
 * Optional same-origin gateway for NetLab (e.g. Cloudflare tunnel).
 * Everything → Next :43127
 */
import http from "node:http";
import httpProxy from "http-proxy";

const LISTEN = Number(process.env.NETLAB_GATEWAY_PORT || 43130);
const NEXT = process.env.NETLAB_NEXT_URL || "http://127.0.0.1:43127";

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

const server = http.createServer((req, res) => {
  proxy.web(req, res, { target: NEXT });
});

server.on("upgrade", (req, socket, head) => {
  proxy.ws(req, socket, head, { target: NEXT });
});

server.listen(LISTEN, "0.0.0.0", () => {
  console.log(`NetLab gateway :${LISTEN} → ${NEXT}`);
});
