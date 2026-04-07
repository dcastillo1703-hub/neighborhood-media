"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { getSupabaseMissingConfigMessage, hasSupabaseCredentials } from "@/lib/supabase/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthProfile = {
  id: string;
  email: string;
  fullName?: string | null;
  role: string;
};

type AuthContextValue = {
  ready: boolean;
  mode: "local" | "supabase";
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  isAdmin: boolean;
  errorMessage: string | null;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  ready: false,
  mode: "local",
  session: null,
  user: null,
  profile: null,
  isAdmin: true,
  errorMessage: getSupabaseMissingConfigMessage(),
  signInWithPassword: async () => ({ error: null }),
  signOut: async () => undefined
});

async function loadProfile(userId: string) {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const profileRow = data as {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
  };

  return {
    id: profileRow.id,
    email: profileRow.email,
    fullName: profileRow.full_name,
    role: profileRow.role
  } satisfies AuthProfile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!hasSupabaseCredentials);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [mode, setMode] = useState<"local" | "supabase">(
    hasSupabaseCredentials ? "supabase" : "local"
  );

  useEffect(() => {
    if (!hasSupabaseCredentials) {
      setMode("local");
      setReady(true);
      return;
    }

    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setMode("local");
      setReady(true);
      return;
    }

    let active = true;
    const finishUnauthenticated = () => {
      if (!active) {
        return;
      }

      setMode("supabase");
      setSession(null);
      setProfile(null);
      setReady(true);
    };

    const syncSession = async (nextSession: Session | null) => {
      if (!active) {
        return;
      }

      setSession(nextSession);

      if (!nextSession?.user) {
        setMode("supabase");
        setProfile(null);
        setReady(true);
        return;
      }

      const nextProfile = await loadProfile(nextSession.user.id);

      if (!active) {
        return;
      }

      setProfile(nextProfile);
      setMode("supabase");
      setReady(true);
    };

    const bootstrapTimeout = window.setTimeout(() => {
      finishUnauthenticated();
    }, 4000);

    void supabase.auth
      .getSession()
      .then(({ data }) => syncSession(data.session))
      .catch(finishUnauthenticated)
      .finally(() => {
        window.clearTimeout(bootstrapTimeout);
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setReady(false);
      void syncSession(nextSession);
    });

    return () => {
      active = false;
      window.clearTimeout(bootstrapTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null;

    return {
      ready,
      mode,
      session,
      user,
      profile,
      isAdmin: mode === "supabase" ? profile?.role === "admin" : true,
      errorMessage: mode === "supabase" ? getSupabaseMissingConfigMessage() : null,
      async signInWithPassword(email, password) {
        if (mode === "local") {
          return {
            error:
              "Supabase auth is currently unavailable. The app is running in local mode so you can keep working."
          };
        }

        const supabase = getSupabaseBrowserClient();

        if (!supabase) {
          return { error: getSupabaseMissingConfigMessage() };
        }

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        return { error: error?.message ?? null };
      },
      async signOut() {
        const supabase = getSupabaseBrowserClient();

        if (!supabase) {
          return;
        }

        await supabase.auth.signOut();
      }
    };
  }, [mode, profile, ready, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
