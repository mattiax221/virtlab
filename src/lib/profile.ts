export type ProfileRole = "user" | "viewer" | "admin";

export type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: ProfileRole;
  last_seen_at: string | null;
  banned: boolean;
  created_at: string;
};

export const PROFILE_COLUMNS =
  "id,email,display_name,role,last_seen_at,banned,created_at";

export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export function isRecentlySeen(iso: string | null, now = Date.now()): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && now - t <= ONLINE_WINDOW_MS;
}

export function safeNextPath(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/lab";
  return next;
}

const KNOWN_ERRORS: Record<string, string> = {
  auth: "Accesso non riuscito. Riprova.",
  banned: "Questo account è disattivato.",
};

export function loginErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return KNOWN_ERRORS[code] ?? null;
}

/** Drop URLs so a provider error cannot print a project address. */
export function sanitizeAuthError(message: string): string {
  const cleaned = message
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[a-z0-9-]+\.supabase\.co/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Operazione non riuscita.";
}
