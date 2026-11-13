import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./env";

/** Service role stays on the server. Used only to delete or ban auth users. */
export function hasServiceRole(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export function createServiceRoleClient() {
  const cfg = getSupabasePublicConfig();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!cfg || !serviceKey) return null;
  return createClient(cfg.url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
