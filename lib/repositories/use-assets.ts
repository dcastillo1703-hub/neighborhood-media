"use client";

import { useEffect, useState } from "react";

import type { Asset } from "@/types";

type AssetsResponse = {
  assets: Asset[];
};

export function useAssets(clientId: string) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setReady(false);
      setError(null);

      try {
        const response = await fetch(`/api/assets?clientId=${encodeURIComponent(clientId)}`, {
          method: "GET",
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("Failed to load assets.");
        }

        const payload = (await response.json()) as AssetsResponse;

        if (active) {
          setAssets(payload.assets);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load assets.");
          setAssets([]);
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

  return { assets, ready, error };
}
