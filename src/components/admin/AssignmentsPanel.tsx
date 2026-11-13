"use client";

import Link from "next/link";
import { useState } from "react";
import {
  createAssignment,
  deleteAssignment,
  updateAssignment,
  type AssignmentInput,
} from "@/app/admin/actions";
import { CHECK_KIND_LABEL, CHECK_TEMPLATES, describeCheck } from "@/lib/classroom/checks";
import { assignmentProgress, studentsOf } from "@/lib/classroom/stats";
import type { AdminData, AssignmentCheck, AssignmentRow, CheckKind } from "@/lib/classroom/types";
import { VIZ } from "./Charts";
import { IconCheck, IconEye, IconPlus, IconTask, IconTrash, IconWarn } from "./Icons";

type Run = (id: string, task: () => Promise<{ error: string } | { ok: true; value?: string }>) => Promise<void>;

const fmtDate = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" });

/** Valore per <input type="datetime-local"> nell’ora locale. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AssignmentsPanel({ data, run, busyId }: { data: AdminData; run: Run; busyId: string | null }) {
  const [editing, setEditing] = useState<AssignmentRow | "new" | null>(null);
  const [classFilter, setClassFilter] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const list = data.assignments.filter((a) => !classFilter || a.class_id === classFilter);

  if (data.classes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 py-12 text-center text-sm text-slate-400">
        <IconTask className="h-10 w-10 text-slate-600" />
        Per creare una consegna serve prima una classe (scheda Classi).
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex items-center gap-1.5 rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400"
        >
          <IconPlus className="h-4 w-4" />
          Nuova consegna
        </button>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-xs"
        >
          <option value="">Tutte le classi</option>
          {data.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {editing && (
        <AssignmentEditor
          data={data}
          initial={editing === "new" ? null : editing}
          defaultClass={classFilter || data.classes[0]!.id}
          busy={busyId === "assignment-edit"}
          onCancel={() => setEditing(null)}
          onSave={(input) =>
            run("assignment-edit", async () => {
              const r =
                editing === "new"
                  ? await createAssignment(input)
                  : await updateAssignment(editing.id, input);
              if ("ok" in r) setEditing(null);
              return r;
            })
          }
        />
      )}

      {list.length === 0 && !editing && (
        <p className="rounded-xl border border-slate-800 bg-slate-900/40 py-10 text-center text-sm text-slate-400">
          Nessuna consegna. Creane una: puoi partire da un modello.
        </p>
      )}

      <div className="space-y-3">
        {list.map((a) => (
          <AssignmentCard
            key={a.id}
            a={a}
            data={data}
            open={openId === a.id}
            onToggle={() => setOpenId(openId === a.id ? null : a.id)}
            onEdit={() => setEditing(a)}
            onDelete={() => run(a.id, () => deleteAssignment(a.id))}
            busy={busyId === a.id}
          />
        ))}
      </div>
    </div>
  );
}

function AssignmentCard({
  a,
  data,
  open,
  onToggle,
  onEdit,
  onDelete,
  busy,
}: {
  a: AssignmentRow;
  data: AdminData;
  open: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  busy: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  const p = assignmentProgress(data, a);
  const cls = data.classes.find((c) => c.id === a.class_id);
  const pctDone = p.students ? (p.completed / p.students) * 100 : 0;
  const pctSub = p.students ? ((p.submitted - p.completed) / p.students) * 100 : 0;

  return (
    <article className="rounded-xl border border-slate-700/80 bg-slate-900/60">
      <button type="button" onClick={onToggle} className="flex w-full flex-wrap items-center gap-3 p-4 text-left">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-emerald-500 text-white">
          <IconTask className="h-5 w-5" />
        </span>
        <div className="min-w-[12rem] flex-1">
          <div className="font-medium text-slate-100">{a.title}</div>
          <div className="text-[11px] text-slate-400">
            {cls?.name ?? "Classe"} · {a.checks.length} verifiche
            {a.due_at && (
              <span className={p.overdue ? " text-rose-300" : ""}>
                {" "}
                · scadenza {fmtDate.format(new Date(a.due_at))}
                {p.overdue ? " (scaduta)" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="w-full sm:w-80">
          <div className="flex h-2.5 overflow-hidden rounded-full" style={{ background: VIZ.track }}>
            <span style={{ width: `${pctDone}%`, background: VIZ.aqua }} />
            {pctSub > 0 && <span className="ml-[2px]" style={{ width: `${pctSub}%`, background: VIZ.blue }} />}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 whitespace-nowrap text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: VIZ.aqua }} />
              {p.completed} completate
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: VIZ.blue }} />
              {p.submitted - p.completed} da correggere
            </span>
            <span>{p.students - p.submitted} mancanti</span>
          </div>
        </div>
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-800 p-4">
          {a.description && <p className="whitespace-pre-wrap text-sm text-slate-300">{a.description}</p>}
          <ul className="flex flex-wrap gap-2">
            {a.checks.map((c, i) => (
              <li key={i} className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] text-slate-300">
                {describeCheck(c)}
              </li>
            ))}
          </ul>

          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-slate-900 text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Allievo</th>
                  <th className="px-3 py-2 font-medium">Esito</th>
                  <th className="px-3 py-2 font-medium">Cosa non va</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {studentsOf(data, a.class_id).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-xs text-slate-500">
                      Nessun allievo nella classe.
                    </td>
                  </tr>
                )}
                {studentsOf(data, a.class_id)
                  .map((uid) => ({ uid, u: data.users.find((x) => x.id === uid) }))
                  .sort((x, y) => (x.u?.display_name ?? "").localeCompare(y.u?.display_name ?? ""))
                  .map(({ uid, u }) => {
                    const key = `${a.id}:${uid}`;
                    const sub = data.submissions.find((s) => s.assignment_id === a.id && s.user_id === uid);
                    const rep = data.reports[key];
                    const labId = data.submissionLabs[key];
                    const complete = rep && rep.total > 0 && rep.passed === rep.total;
                    return (
                      <tr key={uid} className="border-t border-slate-800 align-top">
                        <td className="px-3 py-2">
                          <div className="text-slate-100">{u?.display_name || u?.email || "Allievo"}</div>
                          {sub && (
                            <div className="text-[10px] text-slate-500">
                              consegnato {fmtDate.format(new Date(sub.submitted_at))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {!sub ? (
                            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
                              non consegnato
                            </span>
                          ) : complete ? (
                            <span className="flex items-center gap-1 text-[12px] text-emerald-300">
                              <IconCheck className="h-4 w-4" />
                              {rep.passed}/{rep.total}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[12px] text-amber-300">
                              <IconWarn className="h-4 w-4" />
                              {rep ? `${rep.passed}/${rep.total}` : "da verificare"}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-slate-400">
                          {rep?.results
                            .filter((r) => !r.ok)
                            .map((r, i) => (
                              <div key={i}>
                                <span className="text-slate-200">{describeCheck(r.check)}:</span> {r.detail}
                              </div>
                            ))}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {labId && (
                            <Link
                              href={`/lab/vedi/${labId}`}
                              className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[11px] text-sky-200 hover:bg-slate-700"
                            >
                              <IconEye className="h-3.5 w-3.5" />
                              Apri lab
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-700"
            >
              Modifica
            </button>
            {confirm ? (
              <>
                <span className="self-center text-xs text-rose-200">Eliminare la consegna?</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onDelete()}
                  className="rounded-md bg-rose-700 px-3 py-1.5 text-xs text-white hover:bg-rose-600"
                >
                  Elimina
                </button>
                <button type="button" onClick={() => setConfirm(false)} className="text-xs text-slate-400">
                  Annulla
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirm(true)}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-950"
              >
                <IconTrash className="h-3.5 w-3.5" />
                Elimina
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function AssignmentEditor({
  data,
  initial,
  defaultClass,
  busy,
  onCancel,
  onSave,
}: {
  data: AdminData;
  initial: AssignmentRow | null;
  defaultClass: string;
  busy: boolean;
  onCancel: () => void;
  onSave: (input: AssignmentInput) => Promise<void>;
}) {
  const [classId, setClassId] = useState(initial?.class_id ?? defaultClass);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [due, setDue] = useState(toLocalInput(initial?.due_at ?? null));
  const [checks, setChecks] = useState<AssignmentCheck[]>(
    initial?.checks.length ? initial.checks : [{ kind: "ping-ok", from: "PC0", target: "" }],
  );

  const patch = (i: number, p: Partial<AssignmentCheck>) =>
    setChecks((list) => list.map((c, k) => (k === i ? { ...c, ...p } : c)));

  return (
    <form
      className="space-y-4 rounded-xl border border-sky-500/40 bg-slate-900/80 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({
          classId,
          title,
          description,
          checks,
          dueAt: due ? new Date(due).toISOString() : null,
        });
      }}
    >
      <h3 className="font-display text-lg font-semibold text-white">
        {initial ? "Modifica consegna" : "Nuova consegna"}
      </h3>

      {!initial && (
        <div>
          <div className="mb-1.5 text-xs text-slate-400">Parti da un modello (poi adatta nomi e IP)</div>
          <div className="flex flex-wrap gap-2">
            {CHECK_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTitle(t.title);
                  setDescription(t.description);
                  setChecks(t.checks.map((c) => ({ ...c })));
                }}
                className="rounded-full border border-slate-600 px-3 py-1 text-[11px] text-slate-200 hover:border-sky-400 hover:bg-sky-950/40"
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-slate-400">
          Classe
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            disabled={Boolean(initial)}
            className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
          >
            {data.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-slate-400">
          Scadenza (facoltativa)
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
          />
        </label>
      </div>
      <label className="block space-y-1 text-xs text-slate-400">
        Titolo
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          required
          className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        />
      </label>
      <label className="block space-y-1 text-xs text-slate-400">
        Testo per gli allievi
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        />
      </label>

      <div className="space-y-2">
        <div className="text-xs text-slate-400">
          Verifiche automatiche: i nomi dei dispositivi devono coincidere con quelli del lab
          dell’allievo (es. PC0, Server0).
        </div>
        {checks.map((c, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-950/70 p-2">
            <select
              value={c.kind}
              onChange={(e) => patch(i, { kind: e.target.value as CheckKind })}
              className="rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs"
            >
              {(Object.keys(CHECK_KIND_LABEL) as CheckKind[]).map((k) => (
                <option key={k} value={k}>
                  {CHECK_KIND_LABEL[k]}
                </option>
              ))}
            </select>
            <input
              value={c.from}
              onChange={(e) => patch(i, { from: e.target.value })}
              placeholder="da (es. PC0)"
              className="w-28 rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs"
            />
            {c.kind !== "dhcp-ok" && (
              <input
                value={c.target ?? ""}
                onChange={(e) => patch(i, { target: e.target.value })}
                placeholder={c.kind === "http-ok" ? "server (IP o nome)" : "verso (IP o nome)"}
                className="w-40 rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs"
              />
            )}
            <span className="text-[11px] text-slate-500">{describeCheck(c)}</span>
            <button
              type="button"
              onClick={() => setChecks((list) => list.filter((_, k) => k !== i))}
              className="ml-auto rounded p-1 text-slate-500 hover:bg-rose-950 hover:text-rose-300"
              title="Togli verifica"
            >
              <IconTrash className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setChecks((list) => [...list, { kind: "ping-ok", from: "PC0", target: "" }])}
          className="flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200"
        >
          <IconPlus className="h-3.5 w-3.5" />
          Aggiungi verifica
        </button>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">
          Annulla
        </button>
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
        >
          {initial ? "Salva modifiche" : "Crea consegna"}
        </button>
      </div>
    </form>
  );
}
