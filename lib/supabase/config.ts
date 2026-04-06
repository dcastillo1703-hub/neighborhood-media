const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey
};

export const hasSupabaseCredentials = Boolean(supabaseUrl && supabaseAnonKey);

export function getSupabaseMissingConfigMessage() {
  if (hasSupabaseCredentials) {
    return null;
  }

  return "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable cloud persistence and auth.";
}
