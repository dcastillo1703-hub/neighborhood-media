"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";

export function SignInPanel() {
  const { errorMessage, signInWithPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    const result = await signInWithPassword(email, password);
    setFormError(result.error);
    setSubmitting(false);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader>
        <div>
          <CardDescription>Secure workspace access</CardDescription>
          <CardTitle className="mt-3 text-3xl">Sign in to Neighborhood Media OS</CardTitle>
        </div>
      </CardHeader>
      <form className="grid gap-5" onSubmit={handleSubmit}>
        <div>
          <Label>Email</Label>
          <Input
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@agency.com"
            inputMode="email"
            spellCheck={false}
            type="email"
            value={email}
          />
        </div>
        <div>
          <Label>Password</Label>
          <Input
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            spellCheck={false}
            type="password"
            value={password}
          />
        </div>
        {formError || errorMessage ? (
          <p className="text-sm text-primary">{formError ?? errorMessage}</p>
        ) : null}
        <div className="flex gap-3">
          <Button disabled={submitting || !email || !password} type="submit">
            {submitting ? "Signing in..." : "Sign In"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
