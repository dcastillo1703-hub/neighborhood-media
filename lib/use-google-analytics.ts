"use client";

import { useEffect, useState } from "react";

import type { GoogleAnalyticsSummary } from "@/types";

async function readApiError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function useGoogleAnalytics(clientId: string) {
  const [summary, setSummary] = useState<GoogleAnalyticsSummary | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setReady(false);
      setError(null);

      try {
        const response = await fetch(
          `/api/google-analytics?clientId=${encodeURIComponent(clientId)}`,
          {
            method: "GET",
            cache: "no-store"
          }
        );

        if (!response.ok) {
          throw new Error("Failed to load Google Analytics summary.");
        }

        const payload = (await response.json()) as { summary: GoogleAnalyticsSummary };

        if (active) {
          setSummary(payload.summary);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load Google Analytics summary."
          );
          setSummary(null);
        }
      } finally {
        if (active) {
          setReady(true);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [clientId]);

  async function sync() {
    const response = await fetch("/api/google-analytics/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ clientId })
    });

    if (!response.ok) {
      throw new Error(await readApiError(response, "Failed to sync Google Analytics."));
    }

    const payload = (await response.json()) as {
      sync: {
        syncedAt: string;
        propertyId: string;
        topSources: GoogleAnalyticsSummary["topSources"];
        topPages: GoogleAnalyticsSummary["topPages"];
      };
      summary: GoogleAnalyticsSummary;
    };

    setSummary(payload.summary);
    return payload;
  }

  return {
    summary,
    ready,
    error,
    sync
  };
}
