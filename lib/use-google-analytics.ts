"use client";

import { useEffect, useRef, useState } from "react";

import type { GoogleAnalyticsCampaignImpact, GoogleAnalyticsSummary } from "@/types";

async function readApiError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function useGoogleAnalytics(
  clientId: string,
  options?: { landingPath?: string; utmCampaign?: string; autoRunDueSync?: boolean }
) {
  const [summary, setSummary] = useState<GoogleAnalyticsSummary | null>(null);
  const [campaignImpact, setCampaignImpact] = useState<GoogleAnalyticsCampaignImpact | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoRunKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setReady(false);
      setError(null);

      try {
        const params = new URLSearchParams({
          clientId
        });

        if (options?.landingPath) {
          params.set("landingPath", options.landingPath);
        }

        if (options?.utmCampaign) {
          params.set("utmCampaign", options.utmCampaign);
        }

        const response = await fetch(
          `/api/google-analytics?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store"
          }
        );

        if (!response.ok) {
          throw new Error("Failed to load Google Analytics summary.");
        }

        const payload = (await response.json()) as {
          summary: GoogleAnalyticsSummary;
          campaignImpact?: GoogleAnalyticsCampaignImpact;
        };

        if (active) {
          setSummary(payload.summary);
          setCampaignImpact(payload.campaignImpact ?? null);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load Google Analytics summary."
          );
          setSummary(null);
          setCampaignImpact(null);
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
  }, [clientId, options?.landingPath, options?.utmCampaign]);

  useEffect(() => {
    if (
      options?.autoRunDueSync === false ||
      !summary?.readyToSync ||
      !summary.syncJob?.due ||
      !summary.syncJob.id
    ) {
      return;
    }

    const autoRunKey = `${summary.syncJob.id}:${summary.syncJob.nextRunAt ?? "now"}`;

    if (autoRunKeyRef.current === autoRunKey) {
      return;
    }

    autoRunKeyRef.current = autoRunKey;

    const runDueSync = async () => {
      try {
        await fetch(`/api/integrations/sync-jobs/${summary.syncJob?.id}/run`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ clientId })
        });

        const params = new URLSearchParams({ clientId });

        if (options?.landingPath) {
          params.set("landingPath", options.landingPath);
        }

        if (options?.utmCampaign) {
          params.set("utmCampaign", options.utmCampaign);
        }

        const response = await fetch(`/api/google-analytics?${params.toString()}`, {
          method: "GET",
          cache: "no-store"
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          summary: GoogleAnalyticsSummary;
          campaignImpact?: GoogleAnalyticsCampaignImpact;
        };

        setSummary(payload.summary);
        setCampaignImpact(payload.campaignImpact ?? null);
      } catch {
        // Leave the previous summary in place if the due sync fails quietly.
      }
    };

    void runDueSync();
  }, [
    clientId,
    options?.autoRunDueSync,
    options?.landingPath,
    options?.utmCampaign,
    summary
  ]);

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
    campaignImpact,
    ready,
    error,
    sync
  };
}
