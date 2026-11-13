"use client";

import { useState } from "react";
import { describeCheck, runChecks } from "@/lib/classroom/checks";
import type { AssignmentRow, CheckReport } from "@/lib/classroom/types";
import type { LabState } from "@/lib/network/types";

/** Barra della consegna aperta: verifica automatica e consegna al docente. */
export function AssignmentBar({
  assignment,
  state,
  saveStatus,
  onSubmit,
  onClose,
}: {
  assignment: AssignmentRow;
  state: LabState;
  saveStatus: string;
  onSubmit: () => Promise<string | null>;
  onClose: () => void;
}) {
  const [report, setReport] = useState<CheckReport | null>(null);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const all = report && report.total > 0 && report.passed === report.total;

  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 z-30 w-[min(44rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-xl border border-violet-400/40 bg-slate-950/95 shadow-2xl">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <span className="rounded-md bg-gradient-to-r from-violet-600 to-sky-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          Consegna
        </span>
        <button
          type="button"
          onClick={() => setShowInfo((v) => !v)}
          className="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-100 hover:text-sky-200"
          title="Mostra il testo della consegna"
        >
          {assignment.title}
        </button>
        <span className="text-[10px] text-slate-500">{saveStatus}</span>
        <button
          type="button"
          onClick={() => {
            setSubmitMsg(null);
            setReport(runChecks(state, assignment.checks));
          }}
          className="rounded-md bg-slate-700 px-2.5 py-1 text-xs text-white hover:bg-slate-600"
        >
          Verifica
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = runChecks(state, assignment.checks);
            setReport(r);
            const err = await onSubmit();
            setBusy(false);
            setSubmitMsg(
              err ??
                (r.total > 0 && r.passed === r.total
                  ? "Consegnato: tutte le verifiche superate."
                  : `Consegnato con ${r.passed}/${r.total} verifiche superate. Puoi correggere e riconsegnare.`),
            );
          }}
          className="rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          Consegna
        </button>
        <button type="button" onClick={onClose} className="rounded px-1.5 text-slate-400 hover:text-white" title="Chiudi la barra">
          ✕
        </button>
      </div>
      {showInfo && assignment.description && (
        <p className="whitespace-pre-wrap border-t border-slate-800 px-3 py-2 text-xs text-slate-300">
          {assignment.description}
        </p>
      )}
      {report && (
        <div className="border-t border-slate-800 px-3 py-2">
          <div className={`mb-1 text-xs font-semibold ${all ? "text-emerald-300" : "text-amber-300"}`}>
            {report.total === 0
              ? "Questa consegna non ha verifiche automatiche."
              : `${report.passed}/${report.total} verifiche superate`}
          </div>
          <ul className="space-y-0.5 text-[11px]">
            {report.results.map((r, i) => (
              <li key={i} className={r.ok ? "text-emerald-200" : "text-slate-300"}>
                {r.ok ? "✓" : "✗"} {describeCheck(r.check)}
                {!r.ok && <span className="text-slate-500"> — {r.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {submitMsg && <div className="border-t border-slate-800 px-3 py-2 text-xs text-sky-200">{submitMsg}</div>}
    </div>
  );
}
