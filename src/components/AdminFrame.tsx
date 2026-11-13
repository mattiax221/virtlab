import Link from "next/link";

export function AdminFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#07111f] text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <Link href="/" className="block font-display text-sm font-semibold text-sky-300">
            NetLab
          </Link>
          <h1 className="mt-1 font-display text-xl font-semibold leading-tight text-white">
            Amministrazione
          </h1>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/lab" className="text-slate-400 hover:text-sky-300">
            Laboratorio
          </Link>
          <Link href="/login" className="text-slate-400 hover:text-sky-300">
            Accedi
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
