"use client";

import { useEffect, useState, type ReactNode } from "react";

import { SignInPanel } from "@/components/auth/sign-in-panel";
import { useAuth } from "@/lib/auth-context";

export function AuthGate({ children }: { children: ReactNode }) {
  const { mode, ready, session } = useAuth();
  const [showFallbackSignIn, setShowFallbackSignIn] = useState(false);

  useEffect(() => {
    if (ready || session || mode !== "supabase") {
      setShowFallbackSignIn(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      setShowFallbackSignIn(true);
    }, 2000);

    return () => window.clearTimeout(timeout);
  }, [mode, ready, session]);

  if (!ready && !session && !showFallbackSignIn) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-sm text-muted-foreground">
        Loading workspace...
      </div>
    );
  }

  if (mode === "supabase" && !session) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <SignInPanel />
      </div>
    );
  }

  return <>{children}</>;
}
