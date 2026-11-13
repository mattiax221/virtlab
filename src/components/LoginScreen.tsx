"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { loginErrorMessage, sanitizeAuthError } from "@/lib/profile";

type Mode = "login" | "register" | "reset";

const inputCls =
  "w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500";

export function LoginScreen({
  configured,
  nextPath,
  errorCode,
}: {
  configured: boolean;
  nextPath: string;
  errorCode?: string;
}) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(
    loginErrorMessage(errorCode),
  );
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!configured) {
      setMessage("Gli account non sono attivi su questo server.");
      return;
    }
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setMessage("Gli account non sono attivi su questo server.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "reset") {
        const redirectTo = `${window.location.origin}/auth/callback?next=/auth/reset`;
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo,
        });
        if (error) {
          setMessage(sanitizeAuthError(error.message));
          return;
        }
        setMessage("Se l'indirizzo esiste, riceverai un messaggio per reimpostare la password.");
        return;
      }

      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/lab`,
          },
        });
        if (error) {
          setMessage(sanitizeAuthError(error.message));
          return;
        }
        if (!data.session) {
          setMessage("Controlla la posta e conferma l'account, poi accedi.");
          setMode("login");
          return;
        }
        router.push(nextPath);
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setMessage(sanitizeAuthError(error.message));
        return;
      }
      const userId = data.user?.id;
      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("banned")
          .eq("id", userId)
          .maybeSingle();
        if (profile?.banned) {
          await supabase.auth.signOut();
          setMessage("Questo account è disattivato.");
          return;
        }
      }
      router.push(nextPath);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-[#07111f] text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 50% at 70% 20%, rgba(14,165,233,0.22), transparent 55%), linear-gradient(180deg, #07111f 0%, #0b1a2e 100%)",
        }}
      />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <Link href="/" className="font-display text-sm font-semibold text-sky-300">
          NetLab
        </Link>
        <h1 className="mt-3 font-display text-3xl font-semibold text-white">
          {mode === "login" && "Accedi"}
          {mode === "register" && "Registrati"}
          {mode === "reset" && "Reimposta password"}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Il laboratorio funziona anche senza account.
        </p>

        <div className="mt-6 flex gap-1 rounded-lg border border-slate-700 bg-slate-900/70 p-1 text-xs">
          <Tab active={mode === "login"} onClick={() => setMode("login")}>
            Accedi
          </Tab>
          <Tab active={mode === "register"} onClick={() => setMode("register")}>
            Registrati
          </Tab>
          <Tab active={mode === "reset"} onClick={() => setMode("reset")}>
            Reimposta password
          </Tab>
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          {mode === "register" && (
            <label className="block space-y-1 text-xs text-slate-400">
              Nome visualizzato
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputCls}
                autoComplete="nickname"
              />
            </label>
          )}
          <label className="block space-y-1 text-xs text-slate-400">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              autoComplete="email"
            />
          </label>
          {mode !== "reset" && (
            <label className="block space-y-1 text-xs text-slate-400">
              Password
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
              />
            </label>
          )}
          {message && (
            <p className="rounded-md border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-sky-500 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
          >
            {busy
              ? "Attendere…"
              : mode === "login"
                ? "Accedi"
                : mode === "register"
                  ? "Crea account"
                  : "Invia link"}
          </button>
        </form>

        <Link
          href="/lab"
          className="mt-4 block text-center text-sm text-slate-300 underline-offset-2 hover:text-white hover:underline"
        >
          Continua senza account
        </Link>
      </div>
    </div>
  );
}

function Tab({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md px-2 py-1.5 font-medium ${
        active ? "bg-slate-800 text-sky-200" : "text-slate-500 hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}
