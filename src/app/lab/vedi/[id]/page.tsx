import Link from "next/link";
import { LabWorkspace } from "@/components/LabWorkspace";
import type { LabState } from "@/lib/network/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function Message({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#07111f] px-4 text-center text-slate-200">
      <p className="max-w-md text-sm">{text}</p>
      <Link href="/admin" className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950">
        Vai all’area docente
      </Link>
    </div>
  );
}

/** Lab di un allievo in sola lettura (docente della classe, admin o proprietario). */
export default async function ViewLabPage({ params }: PageProps<"/lab/vedi/[id]">) {
  const { id } = await params;
  if (!isSupabaseConfigured()) return <Message text="Gli account non sono attivi su questo server." />;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase!.auth.getUser();
  if (!user) return <Message text="Accedi per vedere questo laboratorio." />;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return <Message text="Laboratorio non trovato." />;

  // Le regole del database mostrano il lab solo al proprietario e ai suoi docenti
  const { data: lab } = await supabase!
    .from("labs")
    .select("id,name,data,owner_id,assignment_id,updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!lab) return <Message text="Laboratorio non trovato o non visibile con il tuo account." />;
  const state = lab.data as LabState;
  if (!state || !Array.isArray(state.devices) || !Array.isArray(state.links)) {
    return <Message text="Questo laboratorio non è leggibile." />;
  }

  const [{ data: owner }, { data: assignment }] = await Promise.all([
    supabase!.from("profiles").select("display_name,email").eq("id", lab.owner_id).maybeSingle(),
    lab.assignment_id
      ? supabase!.from("assignments").select("title").eq("id", lab.assignment_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const who = (owner?.display_name as string) || (owner?.email as string) || "allievo";
  const when = new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(lab.updated_at as string),
  );

  return (
    <LabWorkspace
      viewOnly={{
        state,
        title: `${lab.name as string} — ${who}`,
        subtitle: `${assignment ? `consegna “${assignment.title as string}” · ` : ""}salvato ${when}`,
        backHref: lab.owner_id === user.id ? "/lab" : "/admin",
      }}
    />
  );
}
