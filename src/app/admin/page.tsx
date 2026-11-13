import Link from "next/link";
import { AdminApp } from "@/components/admin/AdminApp";
import { AdminFrame } from "@/components/AdminFrame";
import { loadAdminData } from "@/lib/classroom/load";
import { canManage, type ProfileRole } from "@/lib/profile";
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
          Questa pagina è per docenti e amministratori. Accedi con un account
          che ha uno di questi ruoli.
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
          Impossibile leggere i profili. Applica le migrazioni SQL del progetto
          nel database, poi ricarica la pagina.
        </p>
      </AdminFrame>
    );
  }

  if (!me || !canManage(me.role) || me.banned) {
    return (
      <AdminFrame>
        <p className="max-w-lg text-sm text-slate-300">
          Questa pagina è per docenti e amministratori.
        </p>
        <Link href="/lab" className="mt-4 inline-block text-sm text-sky-300">
          Torna al laboratorio
        </Link>
      </AdminFrame>
    );
  }

  const loaded = await loadAdminData(supabase!, {
    id: user.id,
    role: me.role as ProfileRole,
  });

  if (loaded.missingSchema) {
    return (
      <AdminFrame>
        <div className="max-w-xl space-y-3 rounded-xl border border-amber-500/40 bg-amber-950/30 p-5 text-sm text-amber-100">
          <p className="font-semibold">Manca una parte del database</p>
          <p className="text-amber-100/80">
            Classi, laboratori salvati e consegne hanno bisogno della migrazione{" "}
            <code className="rounded bg-black/30 px-1">
              supabase/migrations/20261113130000_classi_lab_consegne.sql
            </code>
            . Applicala dall’SQL editor di Supabase, poi ricarica la pagina.
          </p>
        </div>
      </AdminFrame>
    );
  }
  if (!loaded.data) {
    return (
      <AdminFrame>
        <p className="text-sm text-slate-300">{loaded.error ?? "Dati non disponibili."}</p>
      </AdminFrame>
    );
  }

  return (
    <AdminFrame role={me.role as ProfileRole}>
      <AdminApp data={loaded.data} />
    </AdminFrame>
  );
}
