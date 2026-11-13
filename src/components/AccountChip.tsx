"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type Chip = {
  label: string;
  admin: boolean;
};

export function AccountChip() {
  const [chip, setChip] = useState<Chip | null>(null);
  const configured = isSupabaseConfigured();
  const router = useRouter();

  useEffect(() => {
    if (!configured) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled || !data.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name,email,role")
        .eq("id", data.user.id)
        .maybeSingle();
      if (cancelled) return;
      const label =
        profile?.display_name ||
        profile?.email ||
        data.user.email ||
        "Account";
      setChip({ label, admin: profile?.role === "admin" });
    })();
    return () => {
      cancelled = true;
    };
  }, [configured]);

  async function signOut() {
    const supabase = getBrowserSupabase();
    if (supabase) await supabase.auth.signOut();
    router.push("/lab");
    router.refresh();
  }

  if (!configured || !chip) {
    return (
      <Link
        href="/login"
        className="rounded px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 hover:text-sky-300"
      >
        Accedi
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {chip.admin && (
        <Link
          href="/admin"
          className="rounded px-2 py-1 text-[11px] text-amber-200 hover:bg-slate-800"
        >
          Amministrazione
        </Link>
      )}
      <span className="hidden max-w-[8rem] truncate text-[11px] text-slate-400 sm:inline">
        {chip.label}
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        className="rounded px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 hover:text-sky-300"
      >
        Esci
      </button>
    </div>
  );
}
