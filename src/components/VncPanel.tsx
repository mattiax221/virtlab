"use client";

import { useCallback, useEffect, useState } from "react";

type Status = {
  ok?: boolean;
  running?: boolean;
  activeDevice?: string;
  isoPresent?: boolean;
  novnc?: boolean;
  vncPort?: number;
  novncPort?: number;
  error?: string;
};

export function VncPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/reactos", { cache: "no-store" });
      setStatus(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const host =
    typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4">
      <div className="rounded-lg border border-orange-500/30 bg-orange-950/20 p-4 text-sm text-slate-300">
        <p className="font-medium text-orange-200">ReactOS per ogni PC</p>
        <p className="mt-1">
          OS open-source gratis. Dal lab: doppio clic su PC → ReactOS. Una VM
          attiva alla volta; ogni host ha disco{" "}
          <code className="text-sky-300">vm/disks/&lt;id&gt;.qcow2</code>. Per
          ping tra PC usa il desktop simulato con IP statico.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Stat ok={status?.isoPresent} label="ISO ReactOS" detail="vm/reactos/live.iso" />
        <Stat ok={status?.running} label="VM attiva" detail={status?.activeDevice || "nessuna"} />
        <Stat ok={status?.novnc} label="noVNC" detail={`porta ${status?.novncPort ?? 6080}`} />
        <Stat ok={!!status?.running} label="VNC QEMU" detail={`porta ${status?.vncPort ?? 5902}`} />
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}
      {status?.error && <p className="text-sm text-rose-300">{status.error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-md bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
        >
          Aggiorna
        </button>
        <button
          type="button"
          onClick={async () => {
            await fetch("/api/reactos", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "stop" }),
            });
            void refresh();
          }}
          className="rounded-md bg-rose-800 px-3 py-2 text-sm hover:bg-rose-700"
        >
          Stop VM
        </button>
        <a
          href={`http://${host}:6080/vnc.html?autoconnect=1`}
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-sky-500"
        >
          Apri noVNC
        </a>
      </div>

      <div className="min-h-[420px] flex-1 overflow-hidden rounded-lg border border-slate-700 bg-black">
        {status?.novnc ? (
          <iframe
            title="ReactOS noVNC"
            src={`http://${host}:6080/vnc_lite.html?autoconnect=1`}
            className="h-full min-h-[420px] w-full border-0"
          />
        ) : (
          <div className="flex h-full min-h-[420px] items-center justify-center p-6 text-center text-sm text-slate-500">
            Nessuna sessione ReactOS. Aprila da un PC nel lab.
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
