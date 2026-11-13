"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { sanitizeAuthError } from "@/lib/profile";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const configured = isSupabaseConfigured();
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) {
      setMessage("Gli account non sono attivi su questo server.");
      return;
    }
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage(sanitizeAuthError(error.message));
      return;
    }
    router.push("/lab");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#07111f] px-4 text-slate-100">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-3">
        <h1 className="font-display text-2xl font-semibold">Nuova password</h1>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500"
        />
        {message && <p className="text-xs text-amber-200">{message}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-sky-500 py-2 text-sm font-semibold text-slate-950"
        >
          Salva password
        </button>
      </form>
    </div>
  );
}
