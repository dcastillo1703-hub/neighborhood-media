"use client";

import { useEffect, useMemo, useState } from "react";

import { campaignRoiSnapshotAdapter } from "@/lib/repositories/supabase-store";
import type { CampaignRoiSnapshot } from "@/types";

const storageKey = "nmos-campaign-roi-snapshots";

export function createDefaultCampaignRoi(
  clientId: string,
  campaignId: string
): CampaignRoiSnapshot {
  return {
    id: `campaign-roi-${campaignId}`,
    clientId,
    campaignId,
    adSpend: 0,
    productionCost: 0,
    agencyHours: 0,
    hourlyRate: 0,
    otherCost: 0,
    attributedRevenue: 0,
    attributedCovers: 0,
    attributedBookings: 0,
    reach: 0,
    engagement: 0,
    clicks: 0,
    topPerformer: "",
    resultSummary: "",
    nextRecommendation: ""
  };
}

function readStore() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    return JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as Record<
      string,
      CampaignRoiSnapshot
    >;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, CampaignRoiSnapshot>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(store));
}

export function calculateCampaignRoi(snapshot: CampaignRoiSnapshot) {
  const totalInvestment =
    snapshot.adSpend +
    snapshot.productionCost +
    snapshot.otherCost +
    snapshot.hourlyRate;
  const netReturn = snapshot.attributedRevenue - totalInvestment;
  const roiMultiple = totalInvestment > 0 ? snapshot.attributedRevenue / totalInvestment : 0;
  const costPerCover =
    snapshot.attributedCovers > 0 ? totalInvestment / snapshot.attributedCovers : 0;

  let status: "Needs more data" | "Underperforming" | "On track" | "Strong return" =
    "Needs more data";

  if (totalInvestment > 0 && snapshot.attributedRevenue > 0) {
    if (roiMultiple >= 3) {
      status = "Strong return";
    } else if (roiMultiple >= 1) {
      status = "On track";
    } else {
      status = "Underperforming";
    }
  }

  return {
    costPerCover,
    netReturn,
    roiMultiple,
    status,
    totalInvestment
  };
}

export function useCampaignRoi(clientId: string, campaignId: string) {
  const [snapshot, setSnapshot] = useState<CampaignRoiSnapshot>(() =>
    createDefaultCampaignRoi(clientId, campaignId)
  );
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const store = readStore();
    const localSnapshot = store[campaignId] ?? createDefaultCampaignRoi(clientId, campaignId);

    const load = async () => {
      setReady(false);
      setError(null);

      if (!campaignRoiSnapshotAdapter.isConfigured) {
        if (active) {
          setSnapshot(localSnapshot);
          setReady(true);
        }

        return;
      }

      try {
        const cloudSnapshot = await campaignRoiSnapshotAdapter.load(campaignId);
        const resolvedSnapshot = cloudSnapshot ?? localSnapshot;
        writeStore({ ...readStore(), [campaignId]: resolvedSnapshot });

        if (active) {
          setSnapshot(resolvedSnapshot);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load campaign ROI.");
          setSnapshot(localSnapshot);
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
  }, [campaignId, clientId]);

  const summary = useMemo(() => calculateCampaignRoi(snapshot), [snapshot]);

  const saveSnapshot = (nextSnapshot: CampaignRoiSnapshot) => {
    const normalizedSnapshot = {
      ...nextSnapshot,
      id: nextSnapshot.id || `campaign-roi-${campaignId}`,
      clientId,
      campaignId,
      updatedAt: new Date().toISOString()
    };

    writeStore({ ...readStore(), [campaignId]: normalizedSnapshot });
    setSnapshot(normalizedSnapshot);

    if (campaignRoiSnapshotAdapter.isConfigured) {
      void campaignRoiSnapshotAdapter.save(campaignId, normalizedSnapshot).catch((saveError) => {
        setError(saveError instanceof Error ? saveError.message : "Failed to save campaign ROI.");
      });
    }
  };

  return {
    error,
    ready,
    saveSnapshot,
    snapshot,
    summary
  };
}
