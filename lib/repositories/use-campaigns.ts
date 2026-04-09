"use client";

import { useEffect, useState } from "react";

import type { ActivityEvent, Campaign, CampaignStatus } from "@/types";

type CampaignsResponse = {
  campaigns: Campaign[];
};

type CreateCampaignInput = Omit<Campaign, "id">;

export function useCampaigns(clientId: string) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setReady(false);
      setError(null);

      try {
        const response = await fetch(`/api/campaigns?clientId=${encodeURIComponent(clientId)}`, {
          method: "GET",
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("Failed to load campaigns.");
        }

        const payload = (await response.json()) as CampaignsResponse;

        if (active) {
          setCampaigns(payload.campaigns);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load campaigns.");
          setCampaigns([]);
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

  return {
    campaigns,
    ready,
    error,
    async addCampaign(campaign: CreateCampaignInput) {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(campaign)
      });

      if (!response.ok) {
        throw new Error("Failed to create campaign.");
      }

      const payload = (await response.json()) as {
        campaign: Campaign;
        event: ActivityEvent;
      };

      setCampaigns((current) => [...current, payload.campaign]);

      return payload;
    },
    async deleteCampaign(id: string) {
      const response = await fetch(`/api/campaigns/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ clientId })
      });

      if (!response.ok) {
        throw new Error("Failed to archive campaign.");
      }

      setCampaigns((current) => current.filter((campaign) => campaign.id !== id));
    },
    async updateCampaign(nextCampaign: Campaign) {
      const response = await fetch(`/api/campaigns/${nextCampaign.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(nextCampaign)
      });

      if (!response.ok) {
        throw new Error("Failed to update campaign.");
      }

      const payload = (await response.json()) as {
        campaign: Campaign;
      };

      setCampaigns((current) =>
        current.map((campaign) =>
          campaign.id === payload.campaign.id ? payload.campaign : campaign
        )
      );

      return payload;
    },
    updateCampaignStatus(id: string, status: CampaignStatus) {
      setCampaigns((current) =>
        current.map((campaign) => (campaign.id === id ? { ...campaign, status } : campaign))
      );
    }
  };
}
