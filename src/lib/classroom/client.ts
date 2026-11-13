"use client";

import type { LabState } from "@/lib/network/types";
import { canManage, sanitizeAuthError, type ProfileRole } from "@/lib/profile";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { parseChecks } from "./checks";
import type { AssignmentRow, ClassRow, LabMeta, SubmissionRow } from "./types";

/** Funzioni del laboratorio verso il database (solo per utenti collegati). */

export type Me = { id: string; name: string; role: ProfileRole };

type R<T> = { ok: true; value: T } | { ok: false; error: string };

function err<T>(e: { message?: string } | null | undefined, fallback: string): R<T> {
  const msg = e?.message ?? fallback;
  if (/relation .* does not exist|schema cache/i.test(msg)) {
    return { ok: false, error: "Salvataggio online non attivo: manca la migrazione del database." };
  }
  return { ok: false, error: sanitizeAuthError(msg) };
}

export async function getMe(): Promise<Me | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: p } = await supabase
    .from("profiles")
    .select("display_name,email,role,banned")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!p || p.banned) return null;
  return {
    id: data.user.id,
    name: (p.display_name as string) || (p.email as string) || data.user.email || "Account",
    role: p.role as ProfileRole,
  };
}

export function isTeacher(me: Me | null): boolean {
  return canManage(me?.role);
}

export async function listMyLabs(me: Me): Promise<R<LabMeta[]>> {
  const supabase = getBrowserSupabase()!;
  const { data, error } = await supabase
    .from("labs")
    .select("id,owner_id,name,assignment_id,created_at,updated_at")
    .eq("owner_id", me.id)
    .order("updated_at", { ascending: false });
  if (error) return err(error, "Elenco non disponibile.");
  return { ok: true, value: (data ?? []) as LabMeta[] };
}

export async function loadLab(id: string): Promise<R<{ meta: LabMeta; data: LabState }>> {
  const supabase = getBrowserSupabase()!;
  const { data, error } = await supabase
    .from("labs")
    .select("id,owner_id,name,assignment_id,created_at,updated_at,data")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return err(error, "Lab non trovato.");
  const { data: lab, ...meta } = data as LabMeta & { data: LabState };
  return { ok: true, value: { meta, data: lab } };
}

export async function createLab(
  name: string,
  data: LabState,
  assignmentId: string | null = null,
): Promise<R<LabMeta>> {
  const supabase = getBrowserSupabase()!;
  const { data: row, error } = await supabase
    .from("labs")
    .insert({ name: name.trim().slice(0, 120) || "Lab senza nome", data, assignment_id: assignmentId })
    .select("id,owner_id,name,assignment_id,created_at,updated_at")
    .single();
  if (error || !row) return err(error, "Salvataggio non riuscito.");
  return { ok: true, value: row as LabMeta };
}

export async function saveLab(id: string, data: LabState): Promise<R<string>> {
  const supabase = getBrowserSupabase()!;
  const { data: row, error } = await supabase
    .from("labs")
    .update({ data })
    .eq("id", id)
    .select("updated_at")
    .maybeSingle();
  if (error || !row) return err(error, "Salvataggio non riuscito.");
  return { ok: true, value: row.updated_at as string };
}

export async function renameLab(id: string, name: string): Promise<R<null>> {
  const supabase = getBrowserSupabase()!;
  const { error } = await supabase.from("labs").update({ name: name.trim().slice(0, 120) }).eq("id", id);
  return error ? err(error, "Non riuscito.") : { ok: true, value: null };
}

export async function deleteLab(id: string): Promise<R<null>> {
  const supabase = getBrowserSupabase()!;
  const { error } = await supabase.from("labs").delete().eq("id", id);
  return error ? err(error, "Non riuscito.") : { ok: true, value: null };
}

export type MyClasses = {
  classes: ClassRow[];
  assignments: AssignmentRow[];
  submissions: SubmissionRow[];
};

export async function loadMyClasses(me: Me): Promise<R<MyClasses>> {
  const supabase = getBrowserSupabase()!;
  const { data: mem, error } = await supabase
    .from("class_members")
    .select("class_id")
    .eq("user_id", me.id);
  if (error) return err(error, "Classi non disponibili.");
  const ids = (mem ?? []).map((m) => m.class_id as string);
  if (ids.length === 0) return { ok: true, value: { classes: [], assignments: [], submissions: [] } };
  const [classes, assignments, submissions] = await Promise.all([
    supabase.from("classes").select("id,name,join_code,created_by,created_at").in("id", ids).order("name"),
    supabase
      .from("assignments")
      .select("id,class_id,title,description,checks,due_at,created_by,created_at")
      .in("class_id", ids)
      .order("created_at", { ascending: false }),
    supabase.from("submissions").select("assignment_id,user_id,lab_id,submitted_at").eq("user_id", me.id),
  ]);
  const bad = [classes, assignments, submissions].find((r) => r.error);
  if (bad) return err(bad.error, "Classi non disponibili.");
  return {
    ok: true,
    value: {
      classes: (classes.data ?? []) as ClassRow[],
      assignments: (assignments.data ?? []).map((a) => ({
        ...(a as AssignmentRow),
        checks: parseChecks((a as { checks: unknown }).checks),
      })),
      submissions: (submissions.data ?? []) as SubmissionRow[],
    },
  };
}

export async function joinClass(code: string): Promise<R<string>> {
  const supabase = getBrowserSupabase()!;
  const { data, error } = await supabase.rpc("join_class", { code: code.trim() });
  if (error) return err(error, "Codice non valido.");
  return { ok: true, value: data as string };
}

export async function submitAssignment(me: Me, assignmentId: string, labId: string): Promise<R<null>> {
  const supabase = getBrowserSupabase()!;
  const { error } = await supabase.from("submissions").upsert(
    {
      assignment_id: assignmentId,
      user_id: me.id,
      lab_id: labId,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "assignment_id,user_id" },
  );
  return error ? err(error, "Consegna non riuscita.") : { ok: true, value: null };
}
