"use client";

import { useState } from "react";
import {
  addClassMember,
  createClass,
  deleteClass,
  regenerateJoinCode,
  removeClassMember,
  renameClass,
} from "@/app/admin/actions";
import { classCsv, downloadText } from "@/lib/classroom/csv";
import type { AdminData, ClassRow } from "@/lib/classroom/types";
import { IconClass, IconDownload, IconKey, IconPlus, IconRefresh, IconTrash } from "./Icons";

type Run = (id: string, task: () => Promise<{ error: string } | { ok: true; value?: string }>) => Promise<void>;

const CARD_ACCENTS = ["#2a78d6", "#199e70", "#6250d6", "#d95926", "#e87ba4", "#eda100"];

export function ClassesPanel({ data, run, busyId }: { data: AdminData; run: Run; busyId: string | null }) {
  const [name, setName] = useState("");
  return (
    <div className="space-y-5">
      <form
        className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-sky-500/40 bg-sky-950/20 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name;
          void run("new-class", async () => {
            const r = await createClass(n);
            if ("ok" in r) setName("");
            return r;
          });
        }}
      >
        <label className="block min-w-[14rem] flex-1 space-y-1 text-xs text-slate-300">
          Nuova classe
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Es. 4T Casa di Carità 2026"
            maxLength={80}
            className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </label>
        <button
          type="submit"
          disabled={!name.trim() || busyId === "new-class"}
          className="flex items-center gap-1.5 rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
        >
          <IconPlus className="h-4 w-4" />
          Crea classe
        </button>
        <p className="w-full text-[11px] text-slate-400">
          Ogni classe ha un codice: gli allievi lo inseriscono quando si registrano, oppure dal
          laboratorio in “I miei lab → Classi”.
        </p>
      </form>

      {data.classes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 py-12 text-center text-sm text-slate-400">
          <IconClass className="h-10 w-10 text-slate-600" />
          Nessuna classe ancora. Creane una qui sopra.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.classes.map((c, i) => (
            <ClassCard
              key={c.id}
              cls={c}
              data={data}
              run={run}
              busyId={busyId}
              accent={CARD_ACCENTS[i % CARD_ACCENTS.length]!}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ClassCard({
  cls,
  data,
  run,
  busyId,
  accent,
}: {
  cls: ClassRow;
  data: AdminData;
  run: Run;
  busyId: string | null;
  accent: string;
}) {
  const [email, setEmail] = useState("");
  const [asTeacher, setAsTeacher] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(cls.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const members = data.members.filter((m) => m.class_id === cls.id);
  const people = members
    .map((m) => ({ m, u: data.users.find((u) => u.id === m.user_id) }))
    .sort((a, b) =>
      a.m.member_role !== b.m.member_role
        ? a.m.member_role === "teacher"
          ? -1
          : 1
        : (a.u?.display_name ?? "").localeCompare(b.u?.display_name ?? ""),
    );
  const students = members.filter((m) => m.member_role === "student").length;
  const assignments = data.assignments.filter((a) => a.class_id === cls.id).length;
  const busy = busyId === cls.id;

  return (
    <article className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/60">
      <div className="h-1.5" style={{ background: accent }} />
      <div className="space-y-4 p-4">
        <header className="flex items-start justify-between gap-3">
          {editing ? (
            <form
              className="flex flex-1 gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void run(cls.id, async () => {
                  const r = await renameClass(cls.id, newName);
                  if ("ok" in r) setEditing(false);
                  return r;
                });
              }}
            >
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-sm"
                autoFocus
              />
              <button type="submit" className="rounded bg-sky-600 px-2 text-xs text-white">
                Salva
              </button>
              <button type="button" onClick={() => setEditing(false)} className="text-xs text-slate-400">
                Annulla
              </button>
            </form>
          ) : (
            <div>
              <h3 className="font-display text-lg font-semibold text-white">{cls.name}</h3>
              <p className="text-[11px] text-slate-400">
                {students} allievi · {assignments} consegne
              </p>
            </div>
          )}
          {!editing && (
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => downloadText(`${cls.name.replace(/[^\w-]+/g, "_")}.csv`, classCsv(data, cls.id))}
                title="Esporta per Excel (CSV)"
                className="flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-950/30 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-900/40"
              >
                <IconDownload className="h-3.5 w-3.5" />
                Excel
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-md px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
              >
                Rinomina
              </button>
            </div>
          )}
        </header>

        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-950/70 p-3">
          <IconKey className="h-5 w-5 text-amber-300" />
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Codice classe</div>
            <div className="font-mono text-2xl font-semibold tracking-[0.25em] text-amber-200">
              {cls.join_code}
            </div>
          </div>
          <div className="ml-auto flex gap-1">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(cls.join_code).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                });
              }}
              className="rounded-md bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
            >
              {copied ? "Copiato" : "Copia"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(cls.id, () => regenerateJoinCode(cls.id))}
              title="Genera un nuovo codice: quello vecchio smette di funzionare"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
            >
              <IconRefresh className="h-3.5 w-3.5" />
              Nuovo
            </button>
          </div>
        </div>

        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {people.length === 0 && <li className="text-xs text-slate-500">Nessun membro.</li>}
          {people.map(({ m, u }) => (
            <li
              key={m.user_id}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-slate-800/50"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${m.member_role === "teacher" ? "bg-violet-400" : "bg-sky-400"}`}
              />
              <span className="min-w-0 flex-1 truncate text-slate-200">
                {u?.display_name || u?.email || "Utente"}
                <span className="ml-2 text-[11px] text-slate-500">{u?.email}</span>
              </span>
              {m.member_role === "teacher" && (
                <span className="text-[10px] text-violet-300">docente</span>
              )}
              {m.user_id !== data.me.id && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(cls.id, () => removeClassMember(cls.id, m.user_id))}
                  title="Togli dalla classe"
                  className="rounded p-1 text-slate-500 hover:bg-rose-950 hover:text-rose-300"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>

        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(cls.id, async () => {
              const r = await addClassMember(cls.id, email, asTeacher);
              if ("ok" in r) setEmail("");
              return r;
            });
          }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Aggiungi per email (utente già registrato)"
            className="min-w-[12rem] flex-1 rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs"
          />
          <label className="flex items-center gap-1 text-[11px] text-slate-400">
            <input type="checkbox" checked={asTeacher} onChange={(e) => setAsTeacher(e.target.checked)} />
            come docente
          </label>
          <button
            type="submit"
            disabled={!email.trim() || busy}
            className="rounded-md bg-slate-700 px-3 py-1.5 text-xs text-white hover:bg-slate-600 disabled:opacity-50"
          >
            Aggiungi
          </button>
        </form>

        <div className="flex justify-end border-t border-slate-800 pt-3">
          {confirmDelete ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-rose-200">Elimina classe, consegne e iscrizioni?</span>
              <button
                type="button"
                onClick={() => void run(cls.id, () => deleteClass(cls.id))}
                className="rounded bg-rose-700 px-2 py-1 text-white hover:bg-rose-600"
              >
                Elimina
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="text-slate-400">
                Annulla
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1 text-[11px] text-rose-300/80 hover:text-rose-200"
            >
              <IconTrash className="h-3.5 w-3.5" />
              Elimina classe
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
