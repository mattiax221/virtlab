"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./env";

let browser: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient | null {
  const cfg = getSupabasePublicConfig();
  if (!cfg) return null;
  if (!browser) {
    browser = createBrowserClient(cfg.url, cfg.anonKey);
  }
  return browser;
}
