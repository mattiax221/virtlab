import Link from "next/link";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#07111f] text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 70% 40%, rgba(14,165,233,0.28), transparent 55%), radial-gradient(ellipse 50% 40% at 15% 80%, rgba(15,118,110,0.25), transparent 50%), linear-gradient(180deg, #07111f 0%, #0b1a2e 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.35) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16">
        <p className="font-display text-5xl font-bold tracking-tight text-white sm:text-7xl animate-[fadeUp_0.7s_ease_both]">
          NetLab
        </p>
        <h1 className="mt-4 max-w-2xl font-display text-2xl font-medium leading-snug text-sky-100/90 sm:text-3xl animate-[fadeUp_0.7s_ease_0.12s_both]">
          Impara le reti come si fanno davvero: topologia, cavi, e il prompt dei
          comandi.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-400 animate-[fadeUp_0.7s_ease_0.2s_both]">
          Come Packet Tracer per lo schema, ma quando apri un PC entri in un
          desktop Windows simulato e digiti{" "}
          <span className="text-sky-300">ipconfig</span>,{" "}
          <span className="text-sky-300">ping</span>,{" "}
          <span className="text-sky-300">arp</span> — non clicchi un form
          “Assegna IP”.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 animate-[fadeUp_0.7s_ease_0.28s_both]">
          <Link
            href="/lab"
            className="rounded-md bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            Apri il laboratorio
          </Link>
          <a
            href="#limiti"
            className="rounded-md border border-slate-600 px-5 py-3 text-sm text-slate-300 transition hover:border-slate-400"
          >
            Cosa è reale e cosa no
          </a>
        </div>

        <div
          id="limiti"
          className="mt-16 max-w-2xl border-t border-slate-700/80 pt-6 text-sm leading-relaxed text-slate-400 animate-[fadeUp_0.7s_ease_0.35s_both]"
        >
          <p className="font-medium text-slate-200">Trasparenza</p>
          <p className="mt-2">
            Una VM Windows vera (QEMU/Hyper-V + licenza Microsoft) si può
            collegare in un secondo passo, ma pesa giga di immagini e richiede
            infrastruttura. Qui la rete L2/L3 è simulata in modo coerente e
            l’interazione sul PC è un desktop/CMD fedeli ai comandi reali — così
            impari il funzionamento, non l’interfaccia a bottoni.
          </p>
        </div>
      </div>
    </div>
  );
}
