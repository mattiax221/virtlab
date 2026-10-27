"use client";

import { useCallback, useEffect, useState } from "react";

type Status = {
  isoPresent: boolean;
  diskPresent: boolean;
  vncUp: boolean;
  novncUp: boolean;
  message: string;
};

export function VncPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/vnc-status", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore di stato");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const novncUrl =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:6080/vnc.html?autoconnect=1&resize=scale`
      : "http://127.0.0.1:6080/vnc.html";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4">
      <div className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-4 text-sm leading-relaxed text-amber-100/90">
        <p className="font-medium text-amber-200">Licenza</p>
        <p className="mt-1 text-slate-300">
          Non avviamo Windows pirata o “senza licenza”. Serve un ISO{" "}
          <strong className="text-slate-100">Evaluation Microsoft</strong> (prova
          ufficiale) oppure un ISO che possiedi già legalmente. Mettilo in{" "}
          <code className="text-sky-300">vm/windows.iso</code> e avvia gli script.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Stat
          ok={status?.isoPresent}
          label="ISO Windows"
          detail="vm/windows.iso"
        />
        <Stat
          ok={status?.diskPresent}
          label="Disco VM"
          detail="vm/windows.qcow2"
        />
        <Stat ok={status?.vncUp} label="QEMU VNC" detail="porta 5901" />
        <Stat ok={status?.novncUp} label="noVNC web" detail="porta 6080" />
      </div>

      {error && (
        <p className="text-sm text-rose-300">Stato non leggibile: {error}</p>
      )}
      {status && (
        <p className="text-sm text-slate-400">{status.message}</p>
      )}

      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-400">
        <li>
          Scarica Windows Evaluation dal Microsoft Evaluation Center e salvalo
          come <code className="text-sky-300">vm/windows.iso</code>
        </li>
        <li>
          <code className="text-sky-300">./scripts/start-windows-vm.sh</code>
        </li>
        <li>
          <code className="text-sky-300">./scripts/start-novnc.sh</code>
        </li>
        <li>Apri la console sotto (o il link noVNC)</li>
      </ol>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-md bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
        >
          Aggiorna stato
        </button>
        <a
          href={novncUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-sky-500"
        >
          Apri noVNC
        </a>
      </div>

      <div className="min-h-[420px] flex-1 overflow-hidden rounded-lg border border-slate-700 bg-black">
        {status?.novncUp ? (
          <iframe
            title="noVNC Windows"
            src={`http://${typeof window !== "undefined" ? window.location.hostname : "127.0.0.1"}:6080/vnc_lite.html?autoconnect=1`}
            className="h-full min-h-[420px] w-full border-0"
          />
        ) : (
          <div className="flex h-full min-h-[420px] items-center justify-center p-6 text-center text-sm text-slate-500">
            noVNC non è in ascolto. Quando la VM e websockify sono attivi, il
            desktop Windows compare qui.
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  ok,
  label,
  detail,
}: {
  ok?: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            ok ? "bg-emerald-400" : "bg-slate-600"
          }`}
        />
        {label}
      </div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  );
}
