"use client";

import { useEffect, useMemo, useState } from "react";

import type { CampaignStrategyContext, CampaignStrategyResult } from "@/lib/agents/campaign-strategy";

async function readApiError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function useCampaignStrategy(clientId: string, context: CampaignStrategyContext | null) {
  const [strategy, setStrategy] = useState<CampaignStrategyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const contextKey = useMemo(() => (context ? JSON.stringify(context) : null), [context]);

  useEffect(() => {
    setStrategy(null);
    setError(null);
  }, [clientId, contextKey]);

  async function generate() {
    if (!context) {
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/campaign-strategy", {
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
        throw new Error(await readApiError(response, "Failed to generate campaign strategy."));
      }

      const payload = (await response.json()) as { strategy: CampaignStrategyResult };
      setStrategy(payload.strategy);
      return payload.strategy;
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Failed to generate campaign strategy."
      );
      return null;
    } finally {
      setGenerating(false);
    }
  }

  return {
    strategy,
    error,
    generating,
    generate
  };
}
