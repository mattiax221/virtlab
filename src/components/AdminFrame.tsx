import Link from "next/link";
import { ROLE_LABEL, type ProfileRole } from "@/lib/profile";
import { SignOutButton } from "./SignOutButton";

export function AdminFrame({
  children,
  role,
}: {
  children: React.ReactNode;
  /** Ruolo dell’utente collegato (assente se non ha accesso) */
  role?: ProfileRole;
}) {
  return (
    <div className="relative min-h-screen bg-[#07111f] text-slate-100">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 60% 70% at 15% 0%, rgba(14,165,233,0.25), transparent 60%), radial-gradient(ellipse 50% 60% at 85% 0%, rgba(98,80,214,0.25), transparent 60%)",
        }}
      />
      <header className="relative flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-violet-600 font-display text-sm font-bold text-white"
          >
            NL
          </Link>
          <div>
            <h1 className="font-display text-xl font-semibold leading-tight text-white">
              {role === "teacher" ? "Area docente" : "Amministrazione"}
            </h1>
            <p className="text-[11px] text-slate-400">NetLab · classi, consegne e utenti</p>
          </div>
          {role && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-200 ring-1 ring-amber-400/30">
              {ROLE_LABEL[role]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link href="/lab" className="rounded-md px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-sky-300">
            Laboratorio
          </Link>
          {role ? (
            <SignOutButton className="rounded-md px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-rose-300" />
          ) : (
            <Link href="/login?next=/admin" className="rounded-md px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-sky-300">
              Accedi
            </Link>
          )}
        </div>
      </header>
      <main className="relative mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
