"use client";

import { useMemo, useState } from "react";
import { deleteUserAccount, setUserBanned, setUserRole } from "@/app/admin/actions";
import type { AdminData } from "@/lib/classroom/types";
import { isRecentlySeen, ROLE_LABEL, type Profile, type ProfileRole } from "@/lib/profile";
import { IconTrash } from "./Icons";

const ROLE_STYLE: Record<ProfileRole, string> = {
  user: "bg-sky-500/15 text-sky-200 ring-sky-400/30",
  teacher: "bg-violet-500/15 text-violet-200 ring-violet-400/30",
  admin: "bg-amber-500/15 text-amber-200 ring-amber-400/30",
};

export function UsersPanel({
  data,
  users,
  onlineIds,
  run,
  busyId,
}: {
  data: AdminData;
  users: Profile[];
  onlineIds: Set<string>;
  run: (id: string, task: () => Promise<{ error: string } | { ok: true }>) => Promise<void>;
  busyId: string | null;
}) {
  const isAdmin = data.me.role === "admin";
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | ProfileRole>("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const classesOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const m of data.members) {
      const c = data.classes.find((x) => x.id === m.class_id);
      if (!c) continue;
      map.set(m.user_id, [...(map.get(m.user_id) ?? []), c.name]);
    }
    return map;
  }, [data.members, data.classes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter((u) => (roleFilter ? u.role === roleFilter : true))
      .filter(
        (u) =>
          !q ||
          (u.email ?? "").toLowerCase().includes(q) ||
          (u.display_name ?? "").toLowerCase().includes(q) ||
          (classesOf.get(u.id) ?? []).some((c) => c.toLowerCase().includes(q)),
      )
      .sort((a, b) => {
        const ao = onlineIds.has(a.id) || isRecentlySeen(a.last_seen_at) ? 1 : 0;
        const bo = onlineIds.has(b.id) || isRecentlySeen(b.last_seen_at) ? 1 : 0;
        if (ao !== bo) return bo - ao;
        return (a.display_name ?? a.email ?? "").localeCompare(b.display_name ?? b.email ?? "");
      });
  }, [users, query, roleFilter, onlineIds, classesOf]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block w-full max-w-sm space-y-1 text-xs text-slate-400">
          Cerca
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome, email o classe"
            className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </label>
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-900/70 p-1 text-xs">
          {(["", "user", "teacher", "admin"] as const).map((r) => (
            <button
              key={r || "all"}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`rounded-md px-2.5 py-1 ${
                roleFilter === r ? "bg-sky-600 text-white" : "text-slate-400 hover:text-slate-100"
              }`}
            >
              {r ? ROLE_LABEL[r] : "Tutti"}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500">{filtered.length} utenti</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700/80">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="bg-slate-900/80 text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Utente</th>
              <th className="px-3 py-2 font-medium">Classi</th>
              <th className="px-3 py-2 font-medium">Ruolo</th>
              <th className="px-3 py-2 font-medium">Stato</th>
              <th className="px-3 py-2 font-medium">Ultimo accesso</th>
              {isAdmin && <th className="px-3 py-2 font-medium">Account</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-slate-500">
                  Nessun utente.
                </td>
              </tr>
            )}
            {filtered.map((user) => {
              const self = user.id === data.me.id;
              const online =
                !user.banned && (onlineIds.has(user.id) || isRecentlySeen(user.last_seen_at));
              const initials = (user.display_name || user.email || "?")
                .split(/[\s@.]+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0]!.toUpperCase())
                .join("");
              return (
                <tr key={user.id} className="border-t border-slate-800 hover:bg-slate-900/40">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-violet-600 text-[11px] font-semibold text-white">
                        {initials}
                        {online && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#07111f] bg-emerald-400" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-100">
                          {user.display_name || "—"}
                          {self && <span className="ml-2 text-[10px] text-sky-300">tu</span>}
                        </div>
                        <div className="truncate text-xs text-slate-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(classesOf.get(user.id) ?? []).map((c) => (
                        <span
                          key={c}
                          className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {isAdmin ? (
                      <select
                        value={user.role}
                        disabled={busyId === user.id}
                        onChange={(e) => {
                          const role = e.target.value;
                          void run(user.id, () => setUserRole(user.id, role));
                        }}
                        className="rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs"
                      >
                        {(Object.keys(ROLE_LABEL) as ProfileRole[]).map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABEL[role]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ring-1 ${ROLE_STYLE[user.role] ?? ROLE_STYLE.user}`}
                      >
                        {ROLE_LABEL[user.role] ?? user.role}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {user.banned ? (
                      <span className="text-rose-300">Disattivato</span>
                    ) : online ? (
                      <span className="text-emerald-300">Online</span>
                    ) : (
                      <span className="text-slate-500">Offline</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400">
                    {user.last_seen_at
                      ? new Intl.DateTimeFormat("it-IT", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(user.last_seen_at))
                      : "Mai"}
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={busyId === user.id || self}
                          onClick={() => void run(user.id, () => setUserBanned(user.id, !user.banned))}
                          className="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                        >
                          {user.banned ? "Riattiva" : "Disattiva"}
                        </button>
                        {pendingDelete === user.id ? (
                          <>
                            <button
                              type="button"
                              disabled={busyId === user.id}
                              onClick={() => {
                                setPendingDelete(null);
                                void run(user.id, () => deleteUserAccount(user.id));
                              }}
                              className="rounded bg-rose-700 px-2 py-1 text-[11px] text-white hover:bg-rose-600"
                            >
                              Conferma elimina
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDelete(null)}
                              className="text-[11px] text-slate-400 hover:text-slate-200"
                            >
                              Annulla
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={self || !data.hasServiceRole}
                            title={
                              data.hasServiceRole
                                ? "Elimina l’account"
                                : "Serve la chiave di servizio sul server"
                            }
                            onClick={() => setPendingDelete(user.id)}
                            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-950 disabled:opacity-40"
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                            Elimina
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">
        Online se il browser è collegato in tempo reale oppure se l’ultimo accesso è entro due
        minuti. {isAdmin
          ? "Docente: crea classi e consegne e vede gli allievi delle sue classi. Allievo: usa il laboratorio."
          : "Vedi gli allievi delle tue classi."}
      </p>
    </div>
  );
}
