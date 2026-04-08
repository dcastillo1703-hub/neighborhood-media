"use client";

import { useEffect, useState } from "react";

import {
  defaultMobileNavItemKeys,
  normalizeMobileNavKeys,
  readMobileNavKeys,
  saveMobileNavKeys,
  type MobileNavItemKey
} from "@/lib/mobile-navigation";
import { clientPreferencesAdapter } from "@/lib/repositories/supabase-store";
import type { ClientPreferences } from "@/types";

const storageKey = "nmos-client-preferences";

function createDefaultPreferences(clientId: string): ClientPreferences {
  return {
    id: `client-preferences-${clientId}`,
    clientId,
    mobileNavKeys: defaultMobileNavItemKeys
  };
}

function normalizePreferences(
  preferences: ClientPreferences | null | undefined,
  clientId: string
): ClientPreferences {
  const fallback = createDefaultPreferences(clientId);

  if (!preferences) {
    return fallback;
  }

  return {
    ...fallback,
    ...preferences,
    id: preferences.id || fallback.id,
    clientId,
    mobileNavKeys: normalizeMobileNavKeys(preferences.mobileNavKeys)
  };
}

function readStore() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    return JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as Record<string, ClientPreferences>;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, ClientPreferences>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(store));
}

export function useClientPreferences(clientId: string) {
  const [preferences, setPreferences] = useState<ClientPreferences>(() => {
    const stored = readStore()[clientId];
    const localMobileNavKeys = readMobileNavKeys();

    return normalizePreferences(
      stored ? { ...stored, mobileNavKeys: localMobileNavKeys } : { ...createDefaultPreferences(clientId), mobileNavKeys: localMobileNavKeys },
      clientId
    );
  });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const stored = readStore()[clientId];
    const localPreferences = normalizePreferences(
      stored ? { ...stored, mobileNavKeys: readMobileNavKeys() } : null,
      clientId
    );

    const load = async () => {
      setReady(false);
      setError(null);

      if (!clientPreferencesAdapter.isConfigured) {
        if (active) {
          setPreferences(localPreferences);
          setReady(true);
        }

        return;
      }

      try {
        const cloudPreferences = await clientPreferencesAdapter.load(clientId);
        const resolvedPreferences = normalizePreferences(cloudPreferences ?? localPreferences, clientId);

        writeStore({ ...readStore(), [clientId]: resolvedPreferences });
        saveMobileNavKeys(resolvedPreferences.mobileNavKeys as MobileNavItemKey[]);

        if (active) {
          setPreferences(resolvedPreferences);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load client preferences.");
          setPreferences(localPreferences);
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

  const savePreferences = (nextPreferences: ClientPreferences) => {
    const normalizedPreferences = normalizePreferences(
      {
        ...nextPreferences,
        id: nextPreferences.id || `client-preferences-${clientId}`,
        clientId,
        updatedAt: new Date().toISOString()
      },
      clientId
    );

    writeStore({ ...readStore(), [clientId]: normalizedPreferences });
    saveMobileNavKeys(normalizedPreferences.mobileNavKeys as MobileNavItemKey[]);
    setPreferences(normalizedPreferences);

    if (clientPreferencesAdapter.isConfigured) {
      void clientPreferencesAdapter.save(clientId, normalizedPreferences).catch((saveError) => {
        setError(saveError instanceof Error ? saveError.message : "Failed to save client preferences.");
      });
    }
  };

  return {
    error,
    preferences,
    ready,
    savePreferences
  };
}
