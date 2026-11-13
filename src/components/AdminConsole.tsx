"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { deleteUserAccount, setUserBanned, setUserRole } from "@/app/admin/actions";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import {
  isRecentlySeen,
  type Profile,
  type ProfileRole,
} from "@/lib/profile";

const ROLE_LABEL: Record<ProfileRole, string> = {
  user: "Utente",
  viewer: "Osservatore",
  admin: "Amministratore",
};

export function AdminConsole({
  initialUsers,
  selfId,
}: {
  initialUsers: Profile[];
  selfId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [onlineIds, setOnlineIds] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const channel = supabase.channel("netlab-online");
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      setOnlineIds(new Set(Object.keys(state)));
    });
    channel.subscribe();
    const changes = supabase
      .channel("profiles-admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          router.refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
      void supabase.removeChannel(changes);
    };
  }, [router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = initialUsers.filter((u) => {
      if (!q) return true;
      return (
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.display_name ?? "").toLowerCase().includes(q)
      );
    });
    return list.sort((a, b) => {
      const ao = onlineIds.has(a.id) || isRecentlySeen(a.last_seen_at) ? 1 : 0;
      const bo = onlineIds.has(b.id) || isRecentlySeen(b.last_seen_at) ? 1 : 0;
      if (ao !== bo) return bo - ao;
      return (a.email ?? "").localeCompare(b.email ?? "");
    });
  }, [initialUsers, query, onlineIds]);

  async function run(id: string, task: () => Promise<{ error?: string; ok?: true }>) {
    setBusyId(id);
    setMessage(null);
    const res = await task();
    setBusyId(null);
    if (res.error) {
      setMessage(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <label className="block max-w-sm space-y-1 text-xs text-slate-400">
        Cerca
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Email o nome"
          className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
        />
      </label>
      {message && (
        <p className="rounded-md border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
          {message}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead className="bg-slate-900/80 text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Utente</th>
              <th className="px-3 py-2 font-medium">Ruolo</th>
              <th className="px-3 py-2 font-medium">Stato</th>
              <th className="px-3 py-2 font-medium">Ultimo accesso</th>
              <th className="px-3 py-2 font-medium">Account</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-slate-500">
                  Nessun utente.
                </td>
              </tr>
            )}
            {filtered.map((user) => {
              const online =
                !user.banned &&
                (onlineIds.has(user.id) || isRecentlySeen(user.last_seen_at));
              return (
                <tr key={user.id} className="border-t border-slate-800">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-100">
                      {user.display_name || "—"}
                      {user.id === selfId && (
                        <span className="ml-2 text-[10px] text-sky-300">tu</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{user.email}</div>
                  </td>
                  <td className="px-3 py-2">
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
                  </td>
                  <td className="px-3 py-2">
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
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyId === user.id || user.id === selfId}
                        onClick={() =>
                          void run(user.id, () =>
                            setUserBanned(user.id, !user.banned),
                          )
                        }
                        className="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                      >
                        {user.banned ? "Riattiva" : "Disattiva"}
                      </button>
                      {pendingDelete === user.id ? (
                        <>
                          <button
                            type="button"
                            disabled={busyId === user.id}
                            onClick={() =>
                              void run(user.id, () => deleteUserAccount(user.id))
                            }
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
                          disabled={user.id === selfId}
                          onClick={() => setPendingDelete(user.id)}
                          className="rounded px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-950 disabled:opacity-40"
                        >
                          Elimina
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">
        Online se il browser è collegato in tempo reale oppure se l&apos;ultimo
        accesso è entro due minuti. Osservatore e utente usano il lab; solo
        l&apos;amministratore apre questa pagina.
      </p>
    </div>
  );
}
