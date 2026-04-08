"use client";

import { useMemo } from "react";

import { seededAnalyticsSnapshots } from "@/data/seed";
import { useScopedCollection } from "@/lib/repositories/client-store";
import { analyticsSnapshotsAdapter } from "@/lib/repositories/supabase-store";
import { AnalyticsSnapshot } from "@/types";

export function useAnalyticsSnapshots(clientId: string) {
  const seed = useMemo(
    () => seededAnalyticsSnapshots.filter((snapshot) => snapshot.clientId === clientId),
    [clientId]
  );
  const [analyticsSnapshots, setAnalyticsSnapshots, ready] = useScopedCollection<AnalyticsSnapshot>(
    "nmos-analytics-snapshots",
    clientId,
    seed,
    analyticsSnapshotsAdapter
  );

  return {
    analyticsSnapshots,
    ready,
    addAnalyticsSnapshot(snapshot: AnalyticsSnapshot) {
      setAnalyticsSnapshots((current) => [...current, snapshot]);
    },
    async refreshAnalyticsSnapshots() {
      if (!analyticsSnapshotsAdapter.isConfigured) {
        return;
      }

      const nextSnapshots = await analyticsSnapshotsAdapter.load(clientId);
      setAnalyticsSnapshots(nextSnapshots);
    }
  };
}
