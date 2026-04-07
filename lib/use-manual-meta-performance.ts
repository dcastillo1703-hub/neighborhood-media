"use client";

import { useEffect, useMemo, useState } from "react";

import { manualMetaPerformanceAdapter } from "@/lib/repositories/supabase-store";
import type {
  ManualMetaChannelPerformance,
  ManualMetaPerformance,
  ManualMetaProvider
} from "@/types";

const storageKey = "nmos-manual-meta-performance";

function createDefaultChannel(provider: ManualMetaProvider): ManualMetaChannelPerformance {
  return {
    provider,
    enabled: false,
    accountLabel: provider === "instagram" ? "Instagram" : "Facebook",
    handle: "",
    periodLabel: "This week",
    impressions: 0,
    reach: 0,
    clicks: 0,
    engagement: 0,
    attributedCovers: 0,
    attributedRevenue: 0,
    topPost: "",
    nextAction: ""
  };
}

function createDefaultConfig(clientId: string): ManualMetaPerformance {
  return {
    id: `manual-meta-${clientId}`,
    clientId,
    channels: [createDefaultChannel("instagram"), createDefaultChannel("facebook")]
  };
}

function readStore() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    return JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as Record<
      string,
      ManualMetaPerformance
    >;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, ManualMetaPerformance>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(store));
}

export function useManualMetaPerformance(clientId: string) {
  const [config, setConfig] = useState<ManualMetaPerformance>(() => createDefaultConfig(clientId));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const store = readStore();
    const localConfig = store[clientId] ?? createDefaultConfig(clientId);

    const load = async () => {
      setReady(false);
      setError(null);

      if (!manualMetaPerformanceAdapter.isConfigured) {
        if (active) {
          setConfig(localConfig);
          setReady(true);
        }

        return;
      }

      try {
        const cloudConfig = await manualMetaPerformanceAdapter.load(clientId);
        const resolvedConfig = cloudConfig ?? localConfig;
        writeStore({ ...readStore(), [clientId]: resolvedConfig });

        if (active) {
          setConfig(resolvedConfig);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load manual Meta performance.");
          setConfig(localConfig);
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

  const enabledChannels = useMemo(
    () => config.channels.filter((channel) => channel.enabled),
    [config.channels]
  );

  const totals = useMemo(
    () => ({
      impressions: enabledChannels.reduce((sum, channel) => sum + channel.impressions, 0),
      reach: enabledChannels.reduce((sum, channel) => sum + channel.reach, 0),
      clicks: enabledChannels.reduce((sum, channel) => sum + channel.clicks, 0),
      engagement: enabledChannels.reduce((sum, channel) => sum + channel.engagement, 0),
      attributedCovers: enabledChannels.reduce((sum, channel) => sum + channel.attributedCovers, 0),
      attributedRevenue: enabledChannels.reduce((sum, channel) => sum + channel.attributedRevenue, 0)
    }),
    [enabledChannels]
  );

  const saveConfig = (nextConfig: ManualMetaPerformance) => {
    const nextStore = {
      ...readStore(),
      [clientId]: nextConfig
    };

    writeStore(nextStore);
    setConfig(nextConfig);

    if (manualMetaPerformanceAdapter.isConfigured) {
      void manualMetaPerformanceAdapter.save(clientId, nextConfig).catch((saveError) => {
        setError(saveError instanceof Error ? saveError.message : "Failed to save manual Meta performance.");
      });
    }
  };

  return {
    config,
    enabledChannels,
    error,
    hasManualMeta: enabledChannels.length > 0,
    ready,
    totals,
    updateChannel(provider: ManualMetaProvider, input: Partial<ManualMetaChannelPerformance>) {
      saveConfig({
        ...config,
        id: config.id || `manual-meta-${clientId}`,
        clientId,
        updatedAt: new Date().toISOString(),
        channels: config.channels.map((channel) =>
          channel.provider === provider ? { ...channel, ...input } : channel
        )
      });
    },
    reset() {
      saveConfig(createDefaultConfig(clientId));
    }
  };
}
