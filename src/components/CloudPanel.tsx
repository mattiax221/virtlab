"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  createLab,
  deleteLab,
  isTeacher,
  joinClass,
  listMyLabs,
  loadLab,
  loadMyClasses,
  type Me,
  type MyClasses,
} from "@/lib/classroom/client";
import { describeCheck } from "@/lib/classroom/checks";
import type { AssignmentRow, LabMeta } from "@/lib/classroom/types";
import { createEmptyLab } from "@/lib/network/engine";
import type { LabState } from "@/lib/network/types";

type Tab = "labs" | "assignments" | "classes";

const fmt = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" });

/**
 * “I miei lab”: laboratori salvati sul server, consegne delle classi
 * e iscrizione a una classe con il codice.
 */
export function CloudPanel({
  me,
  current,
  boundLabId,
  initialTab = "labs",
  onClose,
  onOpen,
  onToast,
}: {
  me: Me;
  current: LabState;
  boundLabId: string | null;
  initialTab?: Tab;
  onClose: () => void;
  /** Apre un lab del server nel canvas e lo collega (salvataggio automatico) */
  onOpen: (meta: LabMeta, data: LabState, assignment: AssignmentRow | null) => void;
  onToast: (msg: string) => void;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [labs, setLabs] = useState<LabMeta[] | null>(null);
  const [classes, setClasses] = useState<MyClasses | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // ora di apertura del pannello: basta per segnare le consegne scadute
  const [now] = useState(() => Date.now());

  const reload = useCallback(async () => {
    const [l, c] = await Promise.all([listMyLabs(me), loadMyClasses(me)]);
    if (!l.ok) setError(l.error);
    else setLabs(l.value);
    if (!c.ok) setError(c.error);
    else setClasses(c.value);
  }, [me]);

  useEffect(() => {
    let alive = true;
    void Promise.all([listMyLabs(me), loadMyClasses(me)]).then(([l, c]) => {
      if (!alive) return;
      if (!l.ok) setError(l.error);
      else setLabs(l.value);
      if (!c.ok) setError(c.error);
      else setClasses(c.value);
    });
    return () => {
      alive = false;
    };
  }, [me]);

  async function open(meta: LabMeta) {
    setBusy(true);
    const r = await loadLab(meta.id);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    const assignment = classes?.assignments.find((a) => a.id === r.value.meta.assignment_id) ?? null;
    onOpen(r.value.meta, r.value.data, assignment);
  }

  async function startAssignment(a: AssignmentRow) {
    const existing = labs?.find((l) => l.assignment_id === a.id);
    if (existing) {
      await open(existing);
      return;
    }
    setBusy(true);
    const r = await createLab(a.title, createEmptyLab(), a.id);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onOpen(r.value, createEmptyLab(), a);
    onToast(`Consegna “${a.title}”: lab nuovo, si salva da solo`);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "labs", label: "I miei lab" },
    { id: "assignments", label: "Consegne" },
    { id: "classes", label: "Classi" },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-sky-500/30 bg-[#0b1729] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 bg-gradient-to-r from-sky-700/60 to-violet-700/50 px-4 py-3">
          <CloudIcon />
          <div className="flex-1">
            <div className="font-display text-base font-semibold text-white">I miei lab</div>
            <div className="text-[11px] text-sky-100/80">{me.name} · salvati online, li ritrovi da qualsiasi PC</div>
          </div>
          {isTeacher(me) && (
            <Link href="/admin" className="rounded-md bg-white/15 px-2.5 py-1 text-[11px] text-white hover:bg-white/25">
              Area docente
            </Link>
          )}
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-slate-200 hover:bg-white/10">
            ✕
          </button>
        </header>
        <nav className="flex gap-1 border-b border-slate-800 px-3 pt-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-t-md px-3 py-1.5 text-xs font-medium ${
                tab === t.id ? "bg-slate-800 text-sky-200" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm">
          {error && (
            <p className="rounded-md border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
              {error}
            </p>
          )}

          {tab === "labs" && (
            <>
              <form
                className="flex flex-wrap gap-2 rounded-lg border border-dashed border-sky-500/40 bg-sky-950/20 p-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  const r = await createLab(name || "Il mio lab", current);
                  setBusy(false);
                  if (!r.ok) {
                    setError(r.error);
                    return;
                  }
                  setName("");
                  onOpen(r.value, current, null);
                  onToast(`Salvato online: ${r.value.name}`);
                }}
              >
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome del lab (es. VLAN esercizio 1)"
                  maxLength={120}
                  className="min-w-[12rem] flex-1 rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  disabled={busy || current.devices.length === 0}
                  className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
                  title={current.devices.length === 0 ? "Il canvas è vuoto" : undefined}
                >
                  Salva il lab attuale
                </button>
              </form>
              {labs === null && !error && <p className="text-xs text-slate-500">Caricamento…</p>}
              {labs?.length === 0 && (
                <p className="py-6 text-center text-xs text-slate-500">Nessun lab salvato online.</p>
              )}
              <ul className="space-y-1.5">
                {labs?.map((l) => {
                  const a = classes?.assignments.find((x) => x.id === l.assignment_id);
                  return (
                    <li
                      key={l.id}
                      className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 ${
                        l.id === boundLabId ? "border-sky-500/60 bg-sky-950/30" : "border-slate-800 bg-slate-900/50"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-slate-100">
                          {l.name}
                          {l.id === boundLabId && <span className="ml-2 text-[10px] text-sky-300">aperto</span>}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {fmt.format(new Date(l.updated_at))}
                          {a && <span className="ml-2 rounded bg-violet-500/20 px-1.5 text-violet-200">consegna: {a.title}</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void open(l)}
                        className="rounded-md bg-slate-700 px-2.5 py-1 text-xs text-white hover:bg-slate-600"
                      >
                        Apri
                      </button>
                      {confirmDelete === l.id ? (
                        <>
                          <button
                            type="button"
                            onClick={async () => {
                              const r = await deleteLab(l.id);
                              setConfirmDelete(null);
                              if (!r.ok) setError(r.error);
                              await reload();
                            }}
                            className="rounded-md bg-rose-700 px-2 py-1 text-xs text-white"
                          >
                            Elimina
                          </button>
                          <button type="button" onClick={() => setConfirmDelete(null)} className="text-xs text-slate-400">
                            No
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={l.id === boundLabId}
                          onClick={() => setConfirmDelete(l.id)}
                          className="rounded-md px-2 py-1 text-xs text-rose-300 hover:bg-rose-950 disabled:opacity-40"
                          title={l.id === boundLabId ? "È il lab aperto" : "Elimina"}
                        >
                          Elimina
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {tab === "assignments" && (
            <>
              {classes?.assignments.length === 0 && (
                <p className="py-6 text-center text-xs text-slate-500">
                  Nessuna consegna. Se il docente ti ha dato un codice classe, inseriscilo in “Classi”.
                </p>
              )}
              <ul className="space-y-2">
                {classes?.assignments.map((a) => {
                  const sub = classes.submissions.find((s) => s.assignment_id === a.id);
                  const cls = classes.classes.find((c) => c.id === a.class_id);
                  const overdue = a.due_at && Date.parse(a.due_at) < now;
                  const hasLab = labs?.some((l) => l.assignment_id === a.id);
                  return (
                    <li key={a.id} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                      <div className="flex flex-wrap items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-slate-100">{a.title}</div>
                          <div className="text-[11px] text-slate-500">
                            {cls?.name}
                            {a.due_at && (
                              <span className={overdue ? "text-rose-300" : ""}>
                                {" "}
                                · entro {fmt.format(new Date(a.due_at))}
                              </span>
                            )}
                          </div>
                        </div>
                        {sub ? (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-200">
                            consegnata {fmt.format(new Date(sub.submitted_at))}
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-200">
                            da consegnare
                          </span>
                        )}
                      </div>
                      {a.description && <p className="mt-2 whitespace-pre-wrap text-xs text-slate-300">{a.description}</p>}
                      {a.checks.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-[11px] text-slate-400">
                          {a.checks.map((c, i) => (
                            <li key={i}>• {describeCheck(c)}</li>
                          ))}
                        </ul>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void startAssignment(a)}
                        className="mt-3 rounded-md bg-gradient-to-r from-sky-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                      >
                        {hasLab ? "Riprendi il lab" : "Inizia"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {tab === "classes" && (
            <>
              <form
                className="flex flex-wrap gap-2 rounded-lg border border-dashed border-amber-500/40 bg-amber-950/20 p-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  const r = await joinClass(code);
                  setBusy(false);
                  if (!r.ok) {
                    setError(r.error);
                    return;
                  }
                  setCode("");
                  setError(null);
                  onToast(`Sei entrato in ${r.value}`);
                  await reload();
                }}
              >
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Codice classe"
                  maxLength={12}
                  className="w-40 rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 font-mono text-sm tracking-widest"
                />
                <button
                  type="submit"
                  disabled={busy || code.trim().length < 4}
                  className="rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-50"
                >
                  Entra nella classe
                </button>
              </form>
              <ul className="space-y-1.5">
                {classes?.classes.length === 0 && (
                  <li className="py-4 text-center text-xs text-slate-500">Non sei ancora in nessuna classe.</li>
                )}
                {classes?.classes.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                    <span className="flex-1 text-slate-100">{c.name}</span>
                    <span className="text-[11px] text-slate-500">
                      {classes.assignments.filter((a) => a.class_id === c.id).length} consegne
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function CloudIcon({ className = "h-6 w-6 text-white" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path
        d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.1 4.75 4.75 0 0 0 7 18.5z"
        strokeLinejoin="round"
      />
      <path d="M12 15.5v-5M9.8 12.6 12 10.4l2.2 2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
