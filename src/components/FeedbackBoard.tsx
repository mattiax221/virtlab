"use client";

import { useMemo, useState, useTransition } from "react";
import { listFeedback, submitFeedback } from "@/app/feedback/actions";
import {
  FEEDBACK_KIND_LABEL,
  loadLocalFeedback,
  saveLocalFeedback,
  type FeedbackItem,
  type FeedbackKind,
} from "@/lib/feedback";

type Props = {
  initialRemote: FeedbackItem[];
  supabaseReady: boolean;
};

export function FeedbackBoard({ initialRemote, supabaseReady }: Props) {
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [contact, setContact] = useState("");
  const [filter, setFilter] = useState<"" | FeedbackKind>("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [local, setLocal] = useState<FeedbackItem[]>(() => loadLocalFeedback());
  const [remote, setRemote] = useState<FeedbackItem[]>(initialRemote);
  const [pending, startTransition] = useTransition();

  const items = useMemo(() => {
    const map = new Map<string, FeedbackItem>();
    for (const it of [...remote, ...local]) map.set(it.id, it);
    const list = [...map.values()].sort((a, b) =>
      (b.created_at || "").localeCompare(a.created_at || ""),
    );
    return filter ? list.filter((i) => i.kind === filter) : list;
  }, [remote, local, filter]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await submitFeedback({
        kind,
        title,
        body,
        authorName,
        contact,
      });
      if ("error" in res) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      const item: FeedbackItem = {
        id: res.id,
        kind,
        title: title.trim(),
        body: body.trim(),
        author_name: authorName.trim(),
        contact: contact.trim() || undefined,
        status: "open",
        created_at: new Date().toISOString(),
      };
      const nextLocal = [item, ...loadLocalFeedback()].slice(0, 80);
      saveLocalFeedback(nextLocal);
      setLocal(nextLocal);
      setTitle("");
      setBody("");
      setMessage({
        ok: true,
        text: res.remote
          ? "Inviato. Grazie — compare nella bacheca."
          : "Salvato su questo browser. Per la bacheca condivisa applica la migrazione feedback su Supabase.",
      });
      if (res.remote) {
        const listed = await listFeedback();
        if (listed.remote) {
          setRemote(
            listed.items.map((i) => ({
              ...i,
              status: (i.status as FeedbackItem["status"]) || "open",
            })),
          );
        }
      }
    });
  }

  const fmt = new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-10">
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-slate-700/80 bg-slate-900/50 p-5"
      >
        <div className="flex flex-wrap gap-2">
          {(["bug", "idea"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                kind === k
                  ? k === "bug"
                    ? "bg-rose-600 text-white"
                    : "bg-sky-600 text-white"
                  : "border border-slate-600 text-slate-300 hover:bg-slate-800"
              }`}
            >
              {FEEDBACK_KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <label className="block space-y-1 text-xs text-slate-400">
          Titolo
          <input
            required
            minLength={3}
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === "bug" ? "Es. Il ping non torna con due router" : "Es. Annotazioni colorate per le VLAN"}
            className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </label>
        <label className="block space-y-1 text-xs text-slate-400">
          Descrizione
          <textarea
            required
            minLength={3}
            maxLength={4000}
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Cosa succede, cosa ti aspetti, o l’idea in due righe…"
            className="w-full resize-y rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-xs text-slate-400">
            Nome (facoltativo)
            <input
              maxLength={80}
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
            />
          </label>
          <label className="block space-y-1 text-xs text-slate-400">
            Contatto (facoltativo, non in bacheca pubblica)
            <input
              maxLength={120}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="email o Discord"
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
          >
            {pending ? "Invio…" : "Invia"}
          </button>
          {!supabaseReady && (
            <span className="text-[11px] text-slate-500">
              Account/server senza Supabase: resta salvato su questo browser.
            </span>
          )}
        </div>
        {message && (
          <p
            role="status"
            className={`rounded-md border px-3 py-2 text-xs ${
              message.ok
                ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-100"
                : "border-amber-500/40 bg-amber-950/40 text-amber-100"
            }`}
          >
            {message.text}
          </p>
        )}
      </form>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-white">Bacheca</h2>
            <p className="text-sm text-slate-400">
              {items.length} segnalazioni
              {remote.length > 0 ? " · condivise" : ""}
            </p>
          </div>
          <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-900/70 p-1 text-xs">
            {(["", "bug", "idea"] as const).map((k) => (
              <button
                key={k || "all"}
                type="button"
                onClick={() => setFilter(k)}
                className={`rounded-md px-2.5 py-1 ${
                  filter === k ? "bg-sky-600 text-white" : "text-slate-400 hover:text-slate-100"
                }`}
              >
                {k ? FEEDBACK_KIND_LABEL[k] : "Tutti"}
              </button>
            ))}
          </div>
        </div>

        {items.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">
            Ancora niente — sii il primo a segnalare un bug o un’idea.
          </p>
        )}

        <ul className="space-y-3">
          {items.map((it) => (
            <li
              key={it.id}
              className="rounded-lg border border-slate-700/80 bg-slate-900/40 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded border px-2 py-0.5 text-[11px] font-medium ${
                    it.kind === "bug"
                      ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                      : "border-sky-500/40 bg-sky-500/10 text-sky-200"
                  }`}
                >
                  {FEEDBACK_KIND_LABEL[it.kind]}
                </span>
                <h3 className="text-sm font-semibold text-slate-100">{it.title}</h3>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-400">
                {it.body}
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                {it.author_name ? `${it.author_name} · ` : ""}
                {it.created_at ? fmt.format(new Date(it.created_at)) : ""}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
