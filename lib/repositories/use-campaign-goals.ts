"use client";

import { useEffect, useState } from "react";

import {
  campaignGoalsAdapter,
  clientCampaignGoalsAdapter
} from "@/lib/repositories/supabase-store";
import type { CampaignGoal } from "@/types";

const storageKey = "nmos-campaign-goals";

function readStore() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    return JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as Record<string, CampaignGoal[]>;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, CampaignGoal[]>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(store));
}

function normalizeGoals(goals: CampaignGoal[], clientId: string, campaignId: string): CampaignGoal[] {
  return goals
    .filter((goal) => goal.label.trim())
    .map((goal) => ({
      ...goal,
      clientId,
      campaignId,
      done: Boolean(goal.done),
      dueDate: goal.dueDate || undefined,
      assigneeName: goal.assigneeName || undefined
    }));
}

export function useCampaignGoals(clientId: string, campaignId: string) {
  const [goals, setGoals] = useState<CampaignGoal[]>(() =>
    normalizeGoals(readStore()[campaignId] ?? [], clientId, campaignId)
  );
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const localGoals = normalizeGoals(readStore()[campaignId] ?? [], clientId, campaignId);

    const load = async () => {
      setReady(false);
      setError(null);

      if (!campaignGoalsAdapter.isConfigured) {
        if (active) {
          setGoals(localGoals);
          setReady(true);
        }

        return;
      }

      try {
        const cloudGoals = await campaignGoalsAdapter.load(campaignId);
        const resolvedGoals = normalizeGoals(cloudGoals.length ? cloudGoals : localGoals, clientId, campaignId);

        writeStore({ ...readStore(), [campaignId]: resolvedGoals });

        if (active) {
          setGoals(resolvedGoals);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load campaign goals.");
          setGoals(localGoals);
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

  const saveGoals = (nextGoals: CampaignGoal[]) => {
    const normalizedGoals = normalizeGoals(nextGoals, clientId, campaignId);

    writeStore({ ...readStore(), [campaignId]: normalizedGoals });
    setGoals(normalizedGoals);

    if (campaignGoalsAdapter.isConfigured) {
      void campaignGoalsAdapter.save(campaignId, normalizedGoals).catch((saveError) => {
        setError(saveError instanceof Error ? saveError.message : "Failed to save campaign goals.");
      });
    }
  };

  return {
    error,
    goals,
    ready,
    saveGoals
  };
}

export function useClientCampaignGoals(clientId: string) {
  const [goals, setGoals] = useState<CampaignGoal[]>(() =>
    Object.values(readStore()).flat().filter((goal) => goal.clientId === clientId)
  );
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const localGoals = Object.values(readStore()).flat().filter((goal) => goal.clientId === clientId);

    const load = async () => {
      setReady(false);
      setError(null);

      if (!clientCampaignGoalsAdapter.isConfigured) {
        if (active) {
          setGoals(localGoals);
          setReady(true);
        }

        return;
      }

      try {
        const cloudGoals = await clientCampaignGoalsAdapter.load(clientId);
        const resolvedGoals = cloudGoals.length ? cloudGoals : localGoals;
        const groupedGoals = resolvedGoals.reduce<Record<string, CampaignGoal[]>>((store, goal) => {
          if (!store[goal.campaignId]) {
            store[goal.campaignId] = [];
          }

          store[goal.campaignId].push(goal);
          return store;
        }, {});

        writeStore({ ...readStore(), ...groupedGoals });

        if (active) {
          setGoals(resolvedGoals);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load campaign goals.");
          setGoals(localGoals);
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
    error,
    goals,
    ready
  };
}
