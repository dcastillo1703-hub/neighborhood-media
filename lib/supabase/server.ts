import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { hasSupabaseCredentials, supabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database";

type CookieMutation = {
  name: string;
  value: string;
  options?: {
    domain?: string;
    expires?: Date;
    httpOnly?: boolean;
    maxAge?: number;
    path?: string;
    sameSite?: "lax" | "strict" | "none";
    secure?: boolean;
  };
};

export async function getSupabaseServerClient() {
  if (!hasSupabaseCredentials) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseConfig.url, supabaseConfig.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieMutation[]) {
        cookiesToSet.forEach(({ name, value, options }: CookieMutation) => {
          cookieStore.set(name, value, options);
        });
      }
    }
  });
}
