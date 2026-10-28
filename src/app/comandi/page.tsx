"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { COMMAND_SECTIONS, type CmdSection } from "@/lib/command-docs";

const FILTERS: { id: "all" | CmdSection["device"]; label: string }[] = [
  { id: "all", label: "Tutti" },
  { id: "pc", label: "PC / Laptop" },
  { id: "router", label: "Router" },
  { id: "switch", label: "Switch" },
  { id: "server", label: "Server" },
  { id: "ftp", label: "FTP" },
];

export default function ComandiPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [q, setQ] = useState("");

  const sections = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return COMMAND_SECTIONS.filter((s) => {
      if (filter !== "all" && s.device !== filter) return false;
      if (!qq) return true;
      if (s.title.toLowerCase().includes(qq) || s.blurb.toLowerCase().includes(qq))
        return true;
      return s.commands.some(
        (c) =>
          c.cmd.toLowerCase().includes(qq) ||
          c.does.toLowerCase().includes(qq) ||
          (c.synopsis?.toLowerCase().includes(qq) ?? false),
      );
    }).map((s) => {
      if (!qq) return s;
      return {
        ...s,
        commands: s.commands.filter(
          (c) =>
            c.cmd.toLowerCase().includes(qq) ||
            c.does.toLowerCase().includes(qq) ||
            (c.synopsis?.toLowerCase().includes(qq) ?? false) ||
            s.title.toLowerCase().includes(qq),
        ),
      };
    }).filter((s) => s.commands.length > 0);
  }, [filter, q]);

  const totalCmds = COMMAND_SECTIONS.reduce((n, s) => n + s.commands.length, 0);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07111f] text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 45% at 15% 0%, rgba(56,189,248,0.18), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 70%, rgba(52,211,153,0.12), transparent 50%)",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-4xl px-5 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
          <Link href="/" className="hover:text-sky-300">
            ← NetLab
          </Link>
          <span aria-hidden>·</span>
          <Link href="/lab" className="hover:text-sky-300">
            Laboratorio
          </Link>
          <span aria-hidden>·</span>
          <Link href="/esercizi" className="hover:text-sky-300">
            Esercizi
          </Link>
          <span aria-hidden>·</span>
          <Link href="/changelog" className="hover:text-sky-300">
            Changelog
          </Link>
        </div>

        <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Comandi
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-400">
          Riferimento di tutto ciò che puoi digitare o configurare in NetLab
          oggi: cosa fa ogni comando e cosa{" "}
          <em className="text-slate-300">non</em> fa (limiti della sim).{" "}
          {totalCmds} voci documentate.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca: ping, vlan, ip route…"
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100 outline-none ring-sky-500/40 placeholder:text-slate-600 focus:ring-2"
          />
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  filter === f.id
                    ? "bg-sky-500 text-slate-950"
                    : "border border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 space-y-12">
          {sections.length === 0 && (
            <p className="text-slate-500">Nessun comando corrisponde alla ricerca.</p>
          )}
          {sections.map((s) => (
            <section key={s.id} id={s.id}>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-400/90">
                    {deviceBadge(s.device)}
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-semibold text-white">
                    {s.title}
                  </h2>
                </div>
                <span className="text-xs text-slate-500">
                  {s.commands.length} comandi
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                {s.blurb}
              </p>

              <ul className="mt-5 space-y-3">
                {s.commands.map((c) => (
                  <li
                    key={c.cmd + (c.synopsis ?? "")}
                    className="rounded-xl border border-slate-700/70 bg-slate-900/55 p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <code className="rounded bg-slate-950 px-2 py-0.5 font-mono text-[13px] font-semibold text-sky-300">
                        {c.cmd}
                      </code>
                      {c.mode && (
                        <span className="text-[11px] text-slate-500">
                          modo: {c.mode}
                        </span>
                      )}
                    </div>
                    {c.synopsis && (
                      <p className="mt-2 font-mono text-[12px] text-slate-400">
                        {c.synopsis}
                      </p>
                    )}
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                          A cosa serve
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-slate-300">
                          {c.does}
                        </p>
                      </div>
                      <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-300/90">
                          Cosa non fa
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-slate-300">
                          {c.doesNot}
                        </p>
                      </div>
                    </div>
                    {c.example && (
                      <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-700 bg-slate-950/80 p-3 font-mono text-[12px] text-slate-300">
                        {c.example}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-14 border-t border-slate-800 pt-6 text-xs text-slate-500">
          Fonte: implementazione in{" "}
          <code className="text-slate-400">src/lib/network/commands.ts</code> ·
          docs in{" "}
          <code className="text-slate-400">src/lib/command-docs.ts</code>. Apri
          il{" "}
          <Link href="/lab" className="text-sky-400 hover:underline">
            laboratorio
          </Link>{" "}
          per provarli.
        </p>
      </div>
    </div>
  );
}

function deviceBadge(d: CmdSection["device"]): string {
  switch (d) {
    case "pc":
      return "End device";
    case "router":
      return "Router IOS-like";
    case "switch":
      return "Switch L2";
    case "server":
      return "Server-PT UI";
    case "ftp":
      return "Sessione FTP";
  }
}
