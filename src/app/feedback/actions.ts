"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { FeedbackKind } from "@/lib/feedback";

export type SubmitFeedbackResult =
  | { ok: true; id: string; remote: boolean }
  | { error: string };

export async function submitFeedback(input: {
  kind: string;
  title: string;
  body: string;
  authorName: string;
  contact: string;
}): Promise<SubmitFeedbackResult> {
  const kind = input.kind === "idea" ? "idea" : input.kind === "bug" ? "bug" : null;
  if (!kind) return { error: "Tipo non valido (bug o idea)." };
  const title = input.title.trim();
  const body = input.body.trim();
  const authorName = input.authorName.trim().slice(0, 80);
  const contact = input.contact.trim().slice(0, 120);
  if (title.length < 3 || title.length > 120) {
    return { error: "Titolo tra 3 e 120 caratteri." };
  }
  if (body.length < 3 || body.length > 4000) {
    return { error: "Descrizione tra 3 e 4000 caratteri." };
  }

  if (!isSupabaseConfigured()) {
    return { ok: true, id: `local-${Date.now()}`, remote: false };
  }

  const supabase = await createServerSupabase();
  if (!supabase) return { ok: true, id: `local-${Date.now()}`, remote: false };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("feedback")
    .insert({
      kind: kind as FeedbackKind,
      title,
      body,
      author_name: authorName,
      contact,
      user_id: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // Tabella assente o RLS: il client salva comunque in locale
    if (/relation .*feedback.* does not exist|schema cache/i.test(error.message)) {
      return { ok: true, id: `local-${Date.now()}`, remote: false };
    }
    return { error: "Invio non riuscito. Riprova tra poco." };
  }
  return { ok: true, id: data.id as string, remote: true };
}

export async function listFeedback(): Promise<{
  items: {
    id: string;
    kind: FeedbackKind;
    title: string;
    body: string;
    author_name: string;
    status: string;
    created_at: string;
  }[];
  remote: boolean;
}> {
  if (!isSupabaseConfigured()) return { items: [], remote: false };
  const supabase = await createServerSupabase();
  if (!supabase) return { items: [], remote: false };
  const { data, error } = await supabase
    .from("feedback")
    .select("id,kind,title,body,author_name,status,created_at")
    .order("created_at", { ascending: false })
    .limit(60);
  if (error || !data) return { items: [], remote: false };
  return {
    items: data as {
      id: string;
      kind: FeedbackKind;
      title: string;
      body: string;
      author_name: string;
      status: string;
      created_at: string;
    }[],
    remote: true,
  };
}
