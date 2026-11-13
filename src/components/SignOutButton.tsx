"use client";

import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        const supabase = getBrowserSupabase();
        if (supabase) await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      Esci
    </button>
  );
}
