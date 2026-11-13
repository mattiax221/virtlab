"use server";

import { revalidatePath } from "next/cache";
import { parseChecks } from "@/lib/classroom/checks";
import type { AssignmentCheck } from "@/lib/classroom/types";
import { createServiceRoleClient, hasServiceRole } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { canManage, type ProfileRole, sanitizeAuthError } from "@/lib/profile";

type Result = { error: string } | { ok: true; value?: string };

type Gate =
  | { error: string }
  | {
      supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabase>>>;
      userId: string;
      role: ProfileRole;
    };

async function gate(level: "admin" | "teacher"): Promise<Gate> {
  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Gli account non sono attivi su questo server." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Accesso richiesto." };
  const { data: me } = await supabase
    .from("profiles")
    .select("role,banned")
    .eq("id", user.id)
    .maybeSingle();
  const allowed = level === "admin" ? me?.role === "admin" : canManage(me?.role);
  if (!me || !allowed || me.banned) {
    return {
      error:
        level === "admin"
          ? "Solo un amministratore può farlo."
          : "Solo un docente o un amministratore può farlo.",
    };
  }
  return { supabase, userId: user.id, role: me.role as ProfileRole };
}

function done(value?: string): Result {
  revalidatePath("/admin");
  return { ok: true, value };
}

function fail(message: string | undefined): Result {
  return { error: sanitizeAuthError(message ?? "Operazione non riuscita.") };
}

// ---------------------------------------------------------------------------
// Account (solo amministratore)
// ---------------------------------------------------------------------------

function roleOk(role: string): role is ProfileRole {
  return role === "user" || role === "teacher" || role === "admin";
}

export async function setUserRole(id: string, role: string): Promise<Result> {
  if (!roleOk(role)) return { error: "Ruolo non valido." };
  const g = await gate("admin");
  if ("error" in g) return { error: g.error };
  if (id === g.userId && role !== "admin") {
    return { error: "Non puoi toglierti il ruolo di amministratore." };
  }
  const { error } = await g.supabase.from("profiles").update({ role }).eq("id", id);
  return error ? fail(error.message) : done();
}

export async function setUserBanned(id: string, banned: boolean): Promise<Result> {
  const g = await gate("admin");
  if ("error" in g) return { error: g.error };
  if (id === g.userId) return { error: "Non puoi disattivare il tuo account da qui." };
  const { error } = await g.supabase.from("profiles").update({ banned }).eq("id", id);
  if (error) return fail(error.message);
  if (hasServiceRole()) {
    const admin = createServiceRoleClient();
    if (admin) {
      const ban = await admin.auth.admin.updateUserById(id, {
        ban_duration: banned ? "876000h" : "none",
      });
      if (ban.error) return fail(ban.error.message);
    }
  }
  return done();
}

export async function deleteUserAccount(id: string): Promise<Result> {
  const g = await gate("admin");
  if ("error" in g) return { error: g.error };
  if (id === g.userId) return { error: "Non puoi eliminare il tuo account da qui." };
  const admin = hasServiceRole() ? createServiceRoleClient() : null;
  if (!admin) {
    return { error: "Eliminazione non disponibile: manca la chiave di servizio sul server." };
  }
  const { error } = await admin.auth.admin.deleteUser(id);
  return error ? fail(error.message) : done();
}

// ---------------------------------------------------------------------------
// Classi (docente della classe o amministratore; le regole del database
// impediscono comunque di toccare classi altrui)
// ---------------------------------------------------------------------------

export async function createClass(name: string): Promise<Result> {
  const clean = name.trim();
  if (!clean || clean.length > 80) return { error: "Nome classe tra 1 e 80 caratteri." };
  const g = await gate("teacher");
  if ("error" in g) return { error: g.error };
  const { data, error } = await g.supabase
    .from("classes")
    .insert({ name: clean, created_by: g.userId })
    .select("join_code")
    .single();
  return error ? fail(error.message) : done(data?.join_code as string);
}

export async function renameClass(id: string, name: string): Promise<Result> {
  const clean = name.trim();
  if (!clean || clean.length > 80) return { error: "Nome classe tra 1 e 80 caratteri." };
  const g = await gate("teacher");
  if ("error" in g) return { error: g.error };
  const { data, error } = await g.supabase
    .from("classes")
    .update({ name: clean })
    .eq("id", id)
    .select("id");
  if (error) return fail(error.message);
  if (!data?.length) return { error: "Non puoi modificare questa classe." };
  return done();
}

export async function deleteClass(id: string): Promise<Result> {
  const g = await gate("teacher");
  if ("error" in g) return { error: g.error };
  const { data, error } = await g.supabase.from("classes").delete().eq("id", id).select("id");
  if (error) return fail(error.message);
  if (!data?.length) return { error: "Non puoi eliminare questa classe." };
  return done();
}

export async function regenerateJoinCode(id: string): Promise<Result> {
  const g = await gate("teacher");
  if ("error" in g) return { error: g.error };
  const { data, error } = await g.supabase.rpc("regenerate_join_code", { cid: id });
  return error ? fail(error.message) : done(data as string);
}

export async function addClassMember(
  classId: string,
  email: string,
  asTeacher: boolean,
): Promise<Result> {
  if (!email.trim()) return { error: "Scrivi l’email dell’utente." };
  const g = await gate("teacher");
  if ("error" in g) return { error: g.error };
  const { error } = await g.supabase.rpc("add_class_member", {
    cid: classId,
    member_email: email.trim(),
    as_teacher: asTeacher,
  });
  return error ? fail(error.message) : done();
}

export async function removeClassMember(classId: string, userId: string): Promise<Result> {
  const g = await gate("teacher");
  if ("error" in g) return { error: g.error };
  const { data, error } = await g.supabase
    .from("class_members")
    .delete()
    .eq("class_id", classId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) return fail(error.message);
  if (!data?.length) return { error: "Non puoi togliere questo utente." };
  return done();
}

// ---------------------------------------------------------------------------
// Consegne
// ---------------------------------------------------------------------------

export type AssignmentInput = {
  classId: string;
  title: string;
  description: string;
  checks: AssignmentCheck[];
  dueAt: string | null;
};

function cleanAssignment(input: AssignmentInput) {
  const title = input.title.trim();
  if (!title || title.length > 120) return { error: "Titolo tra 1 e 120 caratteri." } as const;
  const checks = parseChecks(input.checks).filter(
    (c) => c.from.trim() && (c.kind === "dhcp-ok" || (c.target ?? "").trim()),
  );
  const due = input.dueAt ? new Date(input.dueAt) : null;
  if (due && Number.isNaN(due.getTime())) return { error: "Scadenza non valida." } as const;
  return {
    row: {
      class_id: input.classId,
      title,
      description: input.description.trim().slice(0, 4000),
      checks,
      due_at: due ? due.toISOString() : null,
    },
  } as const;
}

export async function createAssignment(input: AssignmentInput): Promise<Result> {
  const clean = cleanAssignment(input);
  if ("error" in clean) return { error: clean.error! };
  const g = await gate("teacher");
  if ("error" in g) return { error: g.error };
  const { error } = await g.supabase
    .from("assignments")
    .insert({ ...clean.row, created_by: g.userId });
  return error ? fail(error.message) : done();
}

export async function updateAssignment(id: string, input: AssignmentInput): Promise<Result> {
  const clean = cleanAssignment(input);
  if ("error" in clean) return { error: clean.error! };
  const g = await gate("teacher");
  if ("error" in g) return { error: g.error };
  const { data, error } = await g.supabase
    .from("assignments")
    .update(clean.row)
    .eq("id", id)
    .select("id");
  if (error) return fail(error.message);
  if (!data?.length) return { error: "Non puoi modificare questa consegna." };
  return done();
}

export async function deleteAssignment(id: string): Promise<Result> {
  const g = await gate("teacher");
  if ("error" in g) return { error: g.error };
  const { data, error } = await g.supabase.from("assignments").delete().eq("id", id).select("id");
  if (error) return fail(error.message);
  if (!data?.length) return { error: "Non puoi eliminare questa consegna." };
  return done();
}
