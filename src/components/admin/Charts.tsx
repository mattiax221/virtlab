"use client";

import { useRef, useState } from "react";

/** Colori validati sullo sfondo scuro #0b1729 (CVD e contrasto). */
export const VIZ = {
  blue: "#3987e5",
  orange: "#d95926",
  aqua: "#199e70",
  grid: "#1e293b",
  track: "#13233a",
  text: "#e2e8f0",
  muted: "#94a3b8",
};

type Tip = { x: number; y: number; text: string } | null;

function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-slate-600 bg-slate-950/95 px-2.5 py-1.5 text-xs text-slate-100 shadow-xl"
      style={{ left: tip.x, top: tip.y - 8 }}
    >
      {tip.text}
    </div>
  );
}

/**
 * Barre orizzontali (una serie): etichetta a sinistra, valore in punta.
 * `max` fissa la scala (per esempio 100 per le percentuali).
 */
export function HBarChart({
  rows,
  color,
  max,
  format = (v) => String(v),
  tooltip,
  empty,
}: {
  rows: { label: string; value: number; note?: string }[];
  color: string;
  max?: number;
  format?: (v: number) => string;
  tooltip?: (row: { label: string; value: number; note?: string }) => string;
  empty: string;
}) {
  const [tip, setTip] = useState<Tip>(null);
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">{empty}</p>;
  }
  const top = Math.max(max ?? 0, ...rows.map((r) => r.value), 1);
  return (
    <div className="relative" onPointerLeave={() => setTip(null)}>
      <Tooltip tip={tip} />
      <ul className="space-y-2.5">
        {rows.map((r) => {
          const pct = (r.value / top) * 100;
          return (
            <li
              key={r.label}
              className="grid grid-cols-[minmax(6rem,14rem)_1fr] items-center gap-3"
              onPointerMove={(e) => {
                const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                setTip({
                  x: e.clientX - box.left,
                  y: e.clientY - box.top,
                  text: tooltip ? tooltip(r) : `${r.label}: ${format(r.value)}`,
                });
              }}
            >
              <span className="truncate text-xs text-slate-300" title={r.label}>
                {r.label}
              </span>
              <span className="flex items-center gap-2">
                <span className="relative h-5 flex-1">
                  <span
                    className="absolute inset-y-0 left-0 rounded-r-[4px]"
                    style={{
                      width: `${Math.max(pct, r.value > 0 ? 1.5 : 0)}%`,
                      background: color,
                      maxHeight: 24,
                    }}
                  />
                </span>
                <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-100">
                  {format(r.value)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Colonne per giorno (una serie) con linea di base e tick essenziali. */
export function ColumnChart({
  points,
  color,
  height = 150,
  label,
}: {
  points: { key: string; short: string; long: string; value: number }[];
  color: string;
  height?: number;
  label: (p: { long: string; value: number }) => string;
}) {
  const [tip, setTip] = useState<Tip>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const max = Math.max(...points.map((p) => p.value), 1);
  const niceMax = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const ticks = [0, niceMax / 2, niceMax];
  return (
    <div ref={rootRef} className="relative" onPointerLeave={() => setTip(null)}>
      <Tooltip tip={tip} />
      <div className="flex gap-2">
        <div
          className="flex flex-col justify-between pb-5 text-right text-[10px] tabular-nums text-slate-500"
          style={{ height }}
        >
          {[...ticks].reverse().map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <div className="flex-1">
          <div
            className="relative flex items-end gap-[2px] border-b"
            style={{ height: height - 20, borderColor: VIZ.grid }}
          >
            {ticks.slice(1).map((t) => (
              <span
                key={t}
                className="pointer-events-none absolute inset-x-0 border-t"
                style={{ bottom: `${(t / niceMax) * 100}%`, borderColor: VIZ.grid }}
              />
            ))}
            {points.map((p) => (
              <span
                key={p.key}
                className="relative flex h-full flex-1 items-end justify-center"
                onPointerMove={(e) => {
                  const box = rootRef.current!.getBoundingClientRect();
                  setTip({ x: e.clientX - box.left, y: e.clientY - box.top, text: label(p) });
                }}
              >
                <span
                  className="w-full max-w-6 rounded-t-[4px]"
                  style={{
                    height: `${(p.value / niceMax) * 100}%`,
                    minHeight: p.value > 0 ? 3 : 0,
                    background: color,
                  }}
                />
              </span>
            ))}
          </div>
          <div className="mt-1 flex gap-[2px] text-[10px] text-slate-500">
            {points.map((p, i) => (
              <span key={p.key} className="flex-1 text-center">
                {i % 2 === 0 || points.length <= 7 ? p.short : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Anello di avanzamento (una percentuale) per le tessere. */
export function Ring({ pct, color, size = 52 }: { pct: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={VIZ.track} strokeWidth={6} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={`${(Math.min(100, Math.max(0, pct)) / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
