"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient, hasServiceRole } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  type ProfileRole,
  sanitizeAuthError,
} from "@/lib/profile";

async function requireAdmin() {
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
  if (!me || me.role !== "admin" || me.banned) {
    return { error: "Solo un amministratore può farlo." };
  }
  return { supabase, userId: user.id };
}

function roleOk(role: string): role is ProfileRole {
  return role === "user" || role === "viewer" || role === "admin";
}

export async function setUserRole(id: string, role: string) {
  if (!roleOk(role)) return { error: "Ruolo non valido." };
  const gate = await requireAdmin();
  if ("error" in gate) return gate;
  if (id === gate.userId && role !== "admin") {
    return { error: "Non puoi toglierti il ruolo di amministratore." };
  }
  const { error } = await gate.supabase.from("profiles").update({ role }).eq("id", id);
  if (error) return { error: sanitizeAuthError(error.message) };
  revalidatePath("/admin");
  return { ok: true as const };
}

export async function setUserBanned(id: string, banned: boolean) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate;
  if (id === gate.userId) {
    return { error: "Non puoi disattivare il tuo account da qui." };
  }
  const { error } = await gate.supabase
    .from("profiles")
    .update({ banned })
    .eq("id", id);
  if (error) return { error: sanitizeAuthError(error.message) };

  if (hasServiceRole()) {
    const admin = createServiceRoleClient();
    if (admin) {
      const ban = await admin.auth.admin.updateUserById(id, {
        ban_duration: banned ? "876000h" : "none",
      });
      if (ban.error) return { error: sanitizeAuthError(ban.error.message) };
    }
  }

  revalidatePath("/admin");
  return { ok: true as const };
}

export async function deleteUserAccount(id: string) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate;
  if (id === gate.userId) {
    return { error: "Non puoi eliminare il tuo account da qui." };
  }
  if (!hasServiceRole()) {
    return {
      error:
        "Eliminazione non disponibile: manca la chiave di servizio sul server.",
    };
  }
  const admin = createServiceRoleClient();
  if (!admin) {
    return { error: "Eliminazione non disponibile su questo server." };
  }
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { error: sanitizeAuthError(error.message) };
  revalidatePath("/admin");
  return { ok: true as const };
}
