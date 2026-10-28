import Link from "next/link";
import { latestRelease, releases, todos } from "@/lib/changelog";

const statusLabel = {
  todo: "Da fare",
  doing: "In corso",
  done: "Fatto",
} as const;

const statusClass = {
  todo: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  doing: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  done: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
} as const;

export const metadata = {
  title: "Changelog — NetLab",
  description: "Cronologia delle versioni NetLab e elenco cose da fare.",
};

export default function ChangelogPage() {
  const latest = latestRelease();
  const openTodos = todos.filter((t) => t.status !== "done");
  const doneTodos = todos.filter((t) => t.status === "done");

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07111f] text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 50% at 80% 0%, rgba(14,165,233,0.22), transparent 55%), radial-gradient(ellipse 40% 35% at 10% 90%, rgba(15,118,110,0.2), transparent 50%)",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
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
        </div>

        <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Changelog
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-400">
          Storia dal primo commit all’ultimo, in italiano. Ultima release:{" "}
          <span className="font-mono text-sky-300">{latest.sha}</span> —{" "}
          {latest.title} ({formatDateIt(latest.date)}).
        </p>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold text-white">
            Cose da fare
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Roadmap aperta ({openTodos.length} aperte
            {doneTodos.length ? `, ${doneTodos.length} fatte` : ""}). Si
            aggiorna insieme al lab.
          </p>
          <ul className="mt-5 space-y-3">
            {todos.map((t) => (
              <li
                key={t.id}
                className="rounded-lg border border-slate-700/80 bg-slate-900/50 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded border px-2 py-0.5 text-[11px] font-medium ${statusClass[t.status]}`}
                  >
                    {statusLabel[t.status]}
                  </span>
                  <h3 className="text-sm font-semibold text-slate-100">
                    {t.title}
                  </h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {t.detail}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-semibold text-white">
            Cronologia
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Dal più vecchio al più recente ({releases.length} passi).
          </p>

          <ol className="relative mt-8 space-y-0 border-l border-slate-700/80 pl-6">
            {releases.map((r, i) => {
              const isLatest = i === releases.length - 1;
              return (
                <li key={r.sha} className="relative pb-8 last:pb-0">
                  <span
                    className={`absolute -left-[1.55rem] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-[#07111f] ${
                      isLatest ? "bg-sky-400" : "bg-slate-500"
                    }`}
                  />
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <time
                      dateTime={r.date}
                      className="text-xs font-medium text-slate-500"
                    >
                      {formatDateIt(r.date)}
                    </time>
                    <span className="font-mono text-[11px] text-slate-500">
                      {r.sha}
                    </span>
                    {isLatest && (
                      <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
                        attuale
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 text-base font-semibold text-slate-100">
                    {i + 1}. {r.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">
                    {r.detail}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>

        <p className="mt-12 border-t border-slate-800 pt-6 text-xs text-slate-500">
          Per aggiornare questa pagina: modifica{" "}
          <code className="text-slate-400">src/lib/changelog.ts</code> (appendi
          in <code className="text-slate-400">releases</code> e aggiorna{" "}
          <code className="text-slate-400">todos</code>).
        </p>
      </div>
    </div>
  );
}

function formatDateIt(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
