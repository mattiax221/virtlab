import Link from "next/link";
import { FeedbackBoard } from "@/components/FeedbackBoard";
import { listFeedback } from "./actions";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { FeedbackItem } from "@/lib/feedback";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bug e idee — NetLab",
  description: "Segnala bug o proponi modifiche a NetLab.",
};

export default async function FeedbackPage() {
  const listed = await listFeedback();
  const initialRemote: FeedbackItem[] = listed.items.map((i) => ({
    ...i,
    status: (i.status as FeedbackItem["status"]) || "open",
  }));

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07111f] text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 50% at 20% 0%, rgba(14,165,233,0.2), transparent 55%), radial-gradient(ellipse 40% 35% at 90% 80%, rgba(244,63,94,0.12), transparent 50%)",
        }}
      />
      <div className="relative z-10 mx-auto w-full max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
          <Link href="/" className="hover:text-sky-300">
            ← NetLab
          </Link>
          <span aria-hidden>·</span>
          <Link href="/lab" className="hover:text-sky-300">
            Laboratorio
          </Link>
          <span aria-hidden>·</span>
          <Link href="/changelog" className="hover:text-sky-300">
            Changelog
          </Link>
        </div>

        <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Bug e idee
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-400">
          Segnala un problema o proponi una modifica. Le segnalazioni restano in
          bacheca così tutti vedono cosa manca o cosa migliorare.
        </p>

        <div className="mt-10">
          <FeedbackBoard
            initialRemote={initialRemote}
            supabaseReady={isSupabaseConfigured()}
          />
        </div>
      </div>
    </div>
  );
}
