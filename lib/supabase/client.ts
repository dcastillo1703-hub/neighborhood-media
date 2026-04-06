import { createBrowserClient } from "@supabase/ssr";

import { hasSupabaseCredentials, supabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getSupabaseBrowserClient() {
  if (!hasSupabaseCredentials) {
    return null;
  }

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(supabaseConfig.url, supabaseConfig.anonKey);
  }

  return browserClient;
}
