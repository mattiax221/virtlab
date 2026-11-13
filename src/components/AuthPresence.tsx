"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const HEARTBEAT_MS = 45_000;

/** Updates last_seen_at and Realtime presence. Signs out disabled accounts. */
export function AuthPresence() {
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    let cancelled = false;
    let timer = 0;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function beat(userId: string) {
      await supabase!
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", userId);
    }

    async function start() {
      const { data } = await supabase!.auth.getUser();
      const user = data.user;
      if (cancelled || !user) return;
      const { data: profile } = await supabase!
        .from("profiles")
        .select("banned")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.banned) {
        await supabase!.auth.signOut();
        if (!window.location.pathname.startsWith("/login")) {
          router.push("/login?error=banned");
          router.refresh();
        }
        return;
      }
      await beat(user.id);
      timer = window.setInterval(() => {
        void beat(user.id);
      }, HEARTBEAT_MS);

      channel = supabase!.channel("netlab-online", {
        config: { presence: { key: user.id } },
      });
      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel?.track({ at: new Date().toISOString() });
        }
      });
    }

    void start();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      if (channel) void supabase!.removeChannel(channel);
    };
  }, [router]);

  return null;
}
