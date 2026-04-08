"use client";

import { useEffect, useState } from "react";

import { clientHomeConfigAdapter } from "@/lib/repositories/supabase-store";
import type { ClientHomeCard, ClientHomeConfig, ClientHomeSection } from "@/types";

const storageKey = "nmos-client-home-config";

export const defaultClientHomeSections: ClientHomeSection[] = [
  { id: "attention", label: "Today / needs attention", visible: true },
  { id: "review", label: "Client review", visible: true },
  { id: "active-campaign", label: "Active campaign", visible: true },
  { id: "upcoming-content", label: "Upcoming content", visible: true },
  { id: "recent-activity", label: "Recent updates", visible: false }
];

export function createDefaultClientHomeConfig(
  clientId: string,
  input: {
    headline: string;
    note: string;
    cards: ClientHomeCard[];
    sections?: ClientHomeSection[];
  }
): ClientHomeConfig {
  return {
    id: `client-home-${clientId}`,
    clientId,
    headline: input.headline,
    note: input.note,
    cards: input.cards,
    sections: input.sections ?? defaultClientHomeSections
  };
}

function readStore() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    return JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as Record<string, ClientHomeConfig>;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, ClientHomeConfig>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(store));
}

function normalizeConfig(config: ClientHomeConfig, fallback: ClientHomeConfig): ClientHomeConfig {
  const sectionsById = new Map(config.sections.map((section) => [section.id, section]));

  return {
    ...fallback,
    ...config,
    headline: config.headline ?? fallback.headline,
    note: config.note ?? fallback.note,
    cards: config.cards.length ? config.cards.slice(0, 3) : fallback.cards,
    sections: defaultClientHomeSections.map((section) => ({
      ...section,
      ...sectionsById.get(section.id),
      label: sectionsById.get(section.id)?.label || section.label
    }))
  };
}

export function useClientHomeConfig(clientId: string, fallback: ClientHomeConfig) {
  const [config, setConfig] = useState<ClientHomeConfig>(() => {
    const stored = readStore()[clientId];

    return stored ? normalizeConfig(stored, fallback) : fallback;
  });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const stored = readStore()[clientId];
    const localConfig = stored ? normalizeConfig(stored, fallback) : fallback;

    const load = async () => {
      setReady(false);
      setError(null);

      if (!clientHomeConfigAdapter.isConfigured) {
        if (active) {
          setConfig(localConfig);
          setReady(true);
        }

        return;
      }

      try {
        const cloudConfig = await clientHomeConfigAdapter.load(clientId);
        const resolvedConfig = normalizeConfig(cloudConfig ?? localConfig, fallback);

        writeStore({ ...readStore(), [clientId]: resolvedConfig });

        if (active) {
          setConfig(resolvedConfig);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load client home config.");
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
  }, [clientId, fallback]);

  const saveConfig = (nextConfig: ClientHomeConfig) => {
    const normalizedConfig = normalizeConfig(
      {
        ...nextConfig,
        id: nextConfig.id || `client-home-${clientId}`,
        clientId,
        updatedAt: new Date().toISOString()
      },
      fallback
    );

    writeStore({
      ...readStore(),
      [clientId]: normalizedConfig
    });
    setConfig(normalizedConfig);

    if (clientHomeConfigAdapter.isConfigured) {
      void clientHomeConfigAdapter.save(clientId, normalizedConfig).catch((saveError) => {
        setError(saveError instanceof Error ? saveError.message : "Failed to save client home config.");
      });
    }
  };

  return {
    config,
    error,
    ready,
    saveConfig
  };
}
