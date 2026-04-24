"use client";

import { useEffect, useMemo, useState } from "react";

import type { ContentPlanContext, ContentPlanResult } from "@/lib/agents/content-plan";

async function readApiError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function useContentPlan(clientId: string, context: ContentPlanContext | null) {
  const [plan, setPlan] = useState<ContentPlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const contextKey = useMemo(() => (context ? JSON.stringify(context) : null), [context]);

  useEffect(() => {
    setPlan(null);
    setError(null);
  }, [clientId, contextKey]);

  async function generate() {
    if (!context) {
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/content-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        cache: "no-store",
        body: JSON.stringify({
          clientId,
          context
        })
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to generate content plan."));
      }

      const payload = (await response.json()) as { plan: ContentPlanResult };
      setPlan(payload.plan);
      return payload.plan;
    } catch (generateError) {
      setError(
        generateError instanceof Error ? generateError.message : "Failed to generate content plan."
      );
      return null;
    } finally {
      setGenerating(false);
    }
  }

  return {
    plan,
    error,
    generating,
    generate
  };
}
