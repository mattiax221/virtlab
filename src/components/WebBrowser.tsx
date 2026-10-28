"use client";

import { useState } from "react";
import { runPing } from "@/lib/network/engine";
import { fetchHttp } from "@/lib/network/services";
import type { Device, LabState } from "@/lib/network/types";

/**
 * Web Browser Desktop utility (Packet Tracer style).
 * Docs: Configuring Servers → Web Browser Utility
 */
export function WebBrowser({
  device,
  stateRef,
  setState,
  onClose,
}: {
  device: Device;
  stateRef: React.MutableRefObject<LabState>;
  setState: (next: LabState) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("http://www.lab");
  const [status, setStatus] = useState("Pronto.");
  const [html, setHtml] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function go(raw?: string) {
    const typed = (raw ?? url).trim();
    if (!typed) {
      setStatus("Inserisci un URL o un indirizzo IP.");
      return;
    }
    setBusy(true);
    setHtml(null);

    let hostPath = typed.replace(/^https?:\/\//i, "");
    hostPath = hostPath.replace(/\/$/, "") || hostPath;
    const slash = hostPath.indexOf("/");
    const host = slash >= 0 ? hostPath.slice(0, slash) : hostPath;
    const path =
      slash >= 0 ? hostPath.slice(slash + 1) || "index.html" : "index.html";
    const target = path === "index.html" ? host : `${host}/${path}`;

    const probe = fetchHttp(stateRef.current, device.id, target);
    const dest = probe.destIp ?? host;
    const { result, state: afterPing } = runPing(
      stateRef.current,
      device.id,
      dest,
    );
    stateRef.current = afterPing;
    setState(afterPing);

    if (!result.ok) {
      setStatus(`Impossibile visualizzare la pagina — host non raggiungibile.`);
      setHtml(
        `<html><body style="font-family:Segoe UI,sans-serif;padding:24px;color:#333">
          <h2>This page can't be displayed</h2>
          <p>Make sure the web address <b>${escapeHtml(typed)}</b> is correct.</p>
          <p style="color:#666;font-size:13px">${escapeHtml(result.message.split("\n")[0] ?? "")}</p>
        </body></html>`,
      );
      setBusy(false);
      return;
    }

    const res = fetchHttp(afterPing, device.id, target, {
      reachable: true,
      path,
    });
    if (!res.ok) {
      setStatus(res.output);
      setHtml(
        `<html><body style="font-family:Segoe UI,sans-serif;padding:24px">
          <h2>404 / Error</h2><p>${escapeHtml(res.output)}</p>
        </body></html>`,
      );
      setBusy(false);
      return;
    }

    const body = res.output.includes("\n\n")
      ? res.output.slice(res.output.indexOf("\n\n") + 2)
      : res.output;
    setStatus(`Completato — ${res.destIp ?? host} · ${path}`);
    setHtml(body);
    setBusy(false);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f0f0f0] text-[12px] text-black">
      <div className="flex items-center justify-between border-b border-[#aca899] bg-gradient-to-b from-[#0a246a] to-[#a6caf0] px-2 py-1 text-white">
        <span className="font-semibold">Web Browser — {device.name}</span>
        <button
          type="button"
          className="px-2 hover:bg-rose-600"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div className="flex items-center gap-1 border-b border-[#aca899] bg-[#ece9d8] px-2 py-1">
        <button
          type="button"
          className="rounded-none border border-[#003c74] bg-[#ece9d8] px-2 py-0.5 hover:bg-white disabled:opacity-50"
          disabled={busy}
          onClick={() => go()}
        >
          Go
        </button>
        <input
          className="min-w-0 flex-1 rounded-none border border-[#7f9db9] bg-white px-2 py-0.5 font-mono text-[12px]"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") go();
          }}
          placeholder="http://www.lab  oppure  192.168.1.100"
          spellCheck={false}
        />
      </div>

      <div className="border-b border-[#aca899] bg-white px-2 py-0.5 text-[11px] text-[#555]">
        {busy ? "Caricamento…" : status}
      </div>

      <div className="min-h-0 flex-1 bg-white">
        {html ? (
          <iframe
            title="NetLab Web Browser"
            className="h-full w-full border-0 bg-white"
            sandbox=""
            srcDoc={html}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-[#555]">
            <p className="text-sm font-semibold text-[#333]">
              Packet Tracer — Web Browser
            </p>
            <p className="max-w-md text-[12px]">
              Digita l’IP del Server-PT o un nome DNS (es.{" "}
              <button
                type="button"
                className="text-sky-700 underline"
                onClick={() => {
                  setUrl("http://www.lab");
                  go("http://www.lab");
                }}
              >
                www.lab
              </button>
              ) se DHCP/DNS sono configurati.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
