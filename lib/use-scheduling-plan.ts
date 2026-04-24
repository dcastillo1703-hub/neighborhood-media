"use client";

import { useEffect, useMemo, useState } from "react";

import type { SchedulingPlanContext, SchedulingPlanResult } from "@/lib/agents/scheduling";

async function readApiError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function useSchedulingPlan(clientId: string, context: SchedulingPlanContext | null) {
  const [plan, setPlan] = useState<SchedulingPlanResult | null>(null);
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
      const response = await fetch("/api/scheduling", {
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
        throw new Error(await readApiError(response, "Failed to generate scheduling plan."));
      }

      const payload = (await response.json()) as { plan: SchedulingPlanResult };
      setPlan(payload.plan);
      return payload.plan;
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Failed to generate scheduling plan."
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
