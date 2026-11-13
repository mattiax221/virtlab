"use client";

import { activityByDay, classProgress, kpis, topErrors } from "@/lib/classroom/stats";
import type { AdminData } from "@/lib/classroom/types";
import { ColumnChart, HBarChart, Ring, VIZ } from "./Charts";
import {
  IconCalendar,
  IconChart,
  IconClass,
  IconOnline,
  IconTask,
  IconUsers,
  IconWarn,
} from "./Icons";

function Tile({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/70 p-4">
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-25 blur-2xl"
        style={{ background: accent }}
      />
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
          style={{ background: accent }}
        >
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-3 font-display text-3xl font-semibold tabular-nums text-white">
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}

function Card({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-4">
      <header className="mb-4 flex items-start gap-2">
        <span className="mt-0.5 text-sky-300">{icon}</span>
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

export function Overview({ data }: { data: AdminData }) {
  const k = kpis(data);
  const progress = classProgress(data);
  const errors = topErrors(data);
  const days = activityByDay(data, 14);
  const fmtShort = new Intl.DateTimeFormat("it-IT", { day: "numeric" });
  const fmtLong = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Utenti"
          value={k.users}
          hint={`${k.students} allievi in classe`}
          icon={<IconUsers className="h-4 w-4" />}
          accent="#2a78d6"
        />
        <Tile
          label="Online ora"
          value={k.online}
          hint={`${k.activeToday} oggi · ${k.active7} negli ultimi 7 giorni`}
          icon={<IconOnline className="h-4 w-4" />}
          accent="#199e70"
        />
        <Tile
          label="Classi"
          value={k.classes}
          hint={`${k.openAssignments} consegne aperte`}
          icon={<IconClass className="h-4 w-4" />}
          accent="#6250d6"
        />
        <div className="relative flex items-center gap-4 overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/70 p-4">
          <Ring pct={k.completion ?? 0} color={VIZ.aqua} size={64} />
          <div>
            <div className="text-xs text-slate-400">Consegne completate</div>
            <div className="font-display text-3xl font-semibold tabular-nums text-white">
              {k.completion === null ? "—" : `${k.completion}%`}
            </div>
            <div className="text-[11px] text-slate-500">tutte le verifiche superate</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Avanzamento per classe"
          subtitle="Percentuale di consegne completate sul totale previsto"
          icon={<IconTask />}
        >
          <HBarChart
            rows={progress.map((p) => ({
              label: p.name,
              value: p.expected > 0 ? Math.round((p.completed / p.expected) * 100) : 0,
              note: `${p.completed} completate, ${p.submitted} consegnate su ${p.expected} previste (${p.students} allievi)`,
            }))}
            color={VIZ.blue}
            max={100}
            format={(v) => `${v}%`}
            tooltip={(r) => `${r.label}: ${r.note}`}
            empty="Ancora nessuna classe con consegne."
          />
        </Card>
        <Card
          title="Errori più frequenti"
          subtitle="Verifiche non superate nelle consegne: cosa ripassare a lezione"
          icon={<IconWarn />}
        >
          <HBarChart
            rows={errors.map((e) => ({ label: e.label, value: e.count }))}
            color={VIZ.orange}
            tooltip={(r) => `${r.label}: ${r.value} verifiche`}
            empty="Nessun errore registrato: ottimo, oppure nessuna consegna ancora."
          />
        </Card>
      </div>

      <Card
        title="Lab salvati negli ultimi 14 giorni"
        subtitle="Quante volte gli allievi hanno salvato un laboratorio, giorno per giorno"
        icon={<IconCalendar />}
      >
        <ColumnChart
          points={days.map((d) => ({
            key: String(d.day),
            short: fmtShort.format(d.day),
            long: fmtLong.format(d.day),
            value: d.count,
          }))}
          color={VIZ.aqua}
          label={(p) => `${p.long}: ${p.value} salvataggi`}
        />
      </Card>

      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <IconChart className="h-3.5 w-3.5" />
        Le verifiche si ricalcolano sul lab consegnato ogni volta che apri questa pagina.
      </p>
    </div>
  );
}
