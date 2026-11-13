import { LoginScreen } from "@/components/LoginScreen";
import { loginErrorMessage, safeNextPath } from "@/lib/profile";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : undefined);
  const errorCode = typeof sp.error === "string" ? sp.error : undefined;
  return (
    <LoginScreen
      configured={isSupabaseConfigured()}
      nextPath={next}
      errorCode={loginErrorMessage(errorCode) ? errorCode : undefined}
    />
  );
}
