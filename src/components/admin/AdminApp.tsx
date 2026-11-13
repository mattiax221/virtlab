"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AdminData } from "@/lib/classroom/types";
import type { Profile } from "@/lib/profile";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { AssignmentsPanel } from "./AssignmentsPanel";
import { ClassesPanel } from "./ClassesPanel";
import { IconChart, IconClass, IconTask, IconUsers } from "./Icons";
import { Overview } from "./Overview";
import { UsersPanel } from "./UsersPanel";

type Tab = "overview" | "classes" | "assignments" | "users";

export function AdminApp({ data }: { data: AdminData }) {
  const router = useRouter();
  const isAdmin = data.me.role === "admin";
  const [tab, setTab] = useState<Tab>(() => (data.missingSchema ? "users" : "overview"));
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(() => new Set());
  /** Solo gli orari di ultimo accesso arrivati in tempo reale */
  const [seen, setSeen] = useState<Record<string, string>>({});
  const refreshTimer = useRef(0);

  // Ricarica i dati dal server, raggruppando gli eventi ravvicinati.
  // Il componente non viene ricreato: ricerca, filtri e moduli restano com’erano.
  const scheduleRefresh = useCallback(() => {
    window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => router.refresh(), 1500);
  }, [router]);

  const usersRef = useRef(data.users);
  useEffect(() => {
    usersRef.current = data.users;
  }, [data.users]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const presence = supabase.channel("netlab-online");
    presence.on("presence", { event: "sync" }, () => {
      setOnlineIds(new Set(Object.keys(presence.presenceState())));
    });
    presence.subscribe();
    const changes = supabase
      .channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
        if (payload.eventType !== "UPDATE") {
          scheduleRefresh();
          return;
        }
        const next = payload.new as Profile;
        const cur = usersRef.current.find((u) => u.id === next.id);
        const onlyHeartbeat =
          cur &&
          cur.role === next.role &&
          cur.banned === next.banned &&
          cur.display_name === next.display_name &&
          cur.email === next.email;
        if (onlyHeartbeat) {
          // il battito ogni 45 s aggiorna solo l’orario: niente ricaricamento
          if (next.last_seen_at) setSeen((s) => ({ ...s, [next.id]: next.last_seen_at! }));
        } else {
          scheduleRefresh();
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, () => {
        scheduleRefresh();
      })
      .subscribe();
    return () => {
      window.clearTimeout(refreshTimer.current);
      void supabase.removeChannel(presence);
      void supabase.removeChannel(changes);
    };
  }, [scheduleRefresh]);

  const users = useMemo(
    () =>
      data.users.map((u) => {
        const t = seen[u.id];
        return t && (!u.last_seen_at || t > u.last_seen_at) ? { ...u, last_seen_at: t } : u;
      }),
    [data.users, seen],
  );
  const liveData = useMemo(() => ({ ...data, users }), [data, users]);

  const run = useCallback(
    async (id: string, task: () => Promise<{ error: string } | { ok: true; value?: string }>) => {
      setBusyId(id);
      setMessage(null);
      try {
        const res = await task();
        if ("error" in res) {
          setMessage({ kind: "error", text: res.error });
          return;
        }
        if (res.value) setMessage({ kind: "ok", text: `Fatto: ${res.value}` });
        router.refresh();
      } finally {
        setBusyId(null);
      }
    },
    [router],
  );

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "overview", label: "Panoramica", icon: <IconChart className="h-4 w-4" /> },
    { id: "classes", label: "Classi", icon: <IconClass className="h-4 w-4" />, count: data.classes.length },
    {
      id: "assignments",
      label: "Consegne",
      icon: <IconTask className="h-4 w-4" />,
      count: data.assignments.length,
    },
    {
      id: "users",
      label: isAdmin ? "Utenti" : "Allievi",
      icon: <IconUsers className="h-4 w-4" />,
      count: users.length,
    },
  ];

  return (
    <div className="space-y-5">
      {data.missingSchema && (
        <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-950/30 p-4 text-sm text-amber-100">
          <p className="font-semibold">Manca la migrazione classi / consegne</p>
          <p className="text-amber-100/80">
            Puoi già gestire gli utenti. Per panoramica, classi e consegne applica{" "}
            <code className="rounded bg-black/30 px-1">
              supabase/migrations/20261113130000_classi_lab_consegne.sql
            </code>{" "}
            dall’SQL editor di Supabase, poi ricarica.
          </p>
        </div>
      )}

      <nav className="flex flex-wrap gap-1 rounded-xl border border-slate-700/80 bg-slate-900/70 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm transition ${
              tab === t.id
                ? "bg-gradient-to-r from-sky-600 to-violet-600 text-white shadow"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            {t.icon}
            {t.label}
            {t.count != null && (
              <span
                className={`rounded-full px-1.5 text-[10px] tabular-nums ${
                  tab === t.id ? "bg-white/20" : "bg-slate-800 text-slate-400"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </nav>

      {message && (
        <p
          role="status"
          className={`rounded-lg border px-3 py-2 text-xs ${
            message.kind === "error"
              ? "border-amber-500/40 bg-amber-950/40 text-amber-100"
              : "border-emerald-500/40 bg-emerald-950/40 text-emerald-100"
          }`}
        >
          {message.text}
        </p>
      )}

      {tab === "overview" && <Overview data={liveData} />}
      {tab === "classes" && <ClassesPanel data={liveData} run={run} busyId={busyId} />}
      {tab === "assignments" && <AssignmentsPanel data={liveData} run={run} busyId={busyId} />}
      {tab === "users" && (
        <UsersPanel data={liveData} users={users} onlineIds={onlineIds} run={run} busyId={busyId} />
      )}
    </div>
  );
}
