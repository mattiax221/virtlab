import Link from "next/link";
import { AdminConsole } from "@/components/AdminConsole";
import { AdminFrame } from "@/components/AdminFrame";
import { PROFILE_COLUMNS, type Profile } from "@/lib/profile";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isSupabaseConfigured()) {
    return (
      <AdminFrame>
        <p className="max-w-lg text-sm leading-relaxed text-slate-300">
          Gli account non sono attivi su questo server. Il laboratorio resta
          utilizzabile senza account.
        </p>
        <Link
          href="/lab"
          className="mt-4 inline-block rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950"
        >
          Continua senza account
        </Link>
      </AdminFrame>
    );
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase!.auth.getUser();

  if (!user) {
    return (
      <AdminFrame>
        <p className="max-w-lg text-sm text-slate-300">
          Questa pagina è riservata agli amministratori. Accedi con un account
          che ha il ruolo di amministratore.
        </p>
        <Link
          href="/login?next=/admin"
          className="mt-4 inline-block rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950"
        >
          Accedi
        </Link>
      </AdminFrame>
    );
  }

  const { data: me, error: meError } = await supabase!
    .from("profiles")
    .select("role,banned")
    .eq("id", user.id)
    .maybeSingle();

  if (meError) {
    return (
      <AdminFrame>
        <p className="max-w-lg text-sm text-slate-300">
          Impossibile leggere i profili. Applica la migrazione SQL del progetto
          nel database, poi ricarica la pagina.
        </p>
      </AdminFrame>
    );
  }

  if (!me || me.role !== "admin" || me.banned) {
    return (
      <AdminFrame>
        <p className="max-w-lg text-sm text-slate-300">
          Solo gli amministratori possono aprire questa pagina.
        </p>
        <Link href="/lab" className="mt-4 inline-block text-sm text-sky-300">
          Torna al laboratorio
        </Link>
      </AdminFrame>
    );
  }

  const { data, error } = await supabase!
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <AdminFrame>
        <p className="text-sm text-slate-300">
          Elenco utenti non disponibile. Controlla le policy della tabella
          profili.
        </p>
      </AdminFrame>
    );
  }

  const users = (data ?? []) as Profile[];
  return (
    <AdminFrame>
      <AdminConsole
        key={users.map((u) => `${u.id}:${u.role}:${u.banned}:${u.last_seen_at}`).join("|")}
        initialUsers={users}
        selfId={user.id}
      />
    </AdminFrame>
  );
}
