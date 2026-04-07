"use client";

import { useEffect, useState } from "react";

import type { IntegrationConnection, MetaBusinessSuiteSummary } from "@/types";

export function useMetaBusinessSuite(clientId: string) {
  const [summary, setSummary] = useState<MetaBusinessSuiteSummary | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setReady(false);
      setError(null);

      try {
        const response = await fetch(`/api/meta-suite?clientId=${encodeURIComponent(clientId)}`, {
          method: "GET",
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("Failed to load Meta Business Suite summary.");
        }

        const payload = (await response.json()) as { summary: MetaBusinessSuiteSummary };

        if (active) {
          setSummary(payload.summary);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load Meta Business Suite summary."
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

  return {
    summary,
    ready,
    error,
    async beginConnection(provider: "facebook" | "instagram") {
      const response = await fetch("/api/meta-suite/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ clientId, provider })
      });

      if (!response.ok) {
        throw new Error("Failed to prepare Meta connection.");
      }

      const payload = (await response.json()) as {
        connection: IntegrationConnection;
        authorizationUrl: string | null;
      };

      setSummary((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          channels: current.channels.map((channel) =>
            channel.provider === provider
              ? {
                  ...channel,
                  status: payload.connection.status,
                  authStatus:
                    payload.connection.setup?.authStatus ?? channel.authStatus,
                  tokenStatus:
                    payload.connection.setup?.tokenStatus ?? channel.tokenStatus,
                  authorizationUrl:
                    payload.connection.setup?.authorizationUrl ?? channel.authorizationUrl,
                  nextAction:
                    payload.connection.setup?.nextAction ?? channel.nextAction,
                  scopeSummary:
                    payload.connection.setup?.scopeSummary ?? channel.scopeSummary,
                  capabilities:
                    payload.connection.setup?.capabilities ?? channel.capabilities,
                  availableAssets:
                    payload.connection.setup?.availableAssets ?? channel.availableAssets,
                  accountLabel: payload.connection.accountLabel,
                  externalAccountId:
                    payload.connection.setup?.externalAccountId ?? channel.externalAccountId,
                  connectedAssetLabel:
                    payload.connection.setup?.connectedAssetLabel ?? channel.connectedAssetLabel
                }
              : channel
          )
        };
      });

      return payload;
    },
    async selectAsset(provider: "facebook" | "instagram", assetId: string) {
      const response = await fetch("/api/meta-suite/select", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ clientId, provider, assetId })
      });

      if (!response.ok) {
        throw new Error("Failed to select Meta account.");
      }

      const payload = (await response.json()) as {
        connection: IntegrationConnection;
      };

      setSummary((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          channels: current.channels.map((channel) =>
            channel.provider === provider
              ? {
                  ...channel,
                  accountLabel: payload.connection.accountLabel,
                  status: payload.connection.status,
                  authStatus:
                    payload.connection.setup?.authStatus ?? channel.authStatus,
                  tokenStatus:
                    payload.connection.setup?.tokenStatus ?? channel.tokenStatus,
                  externalAccountId:
                    payload.connection.setup?.externalAccountId ?? channel.externalAccountId,
                  connectedAssetLabel:
                    payload.connection.setup?.connectedAssetLabel ?? channel.connectedAssetLabel,
                  nextAction:
                    payload.connection.setup?.nextAction ?? channel.nextAction,
                  availableAssets:
                    payload.connection.setup?.availableAssets ?? channel.availableAssets
                }
              : channel
          )
        };
      });

      return payload;
    }
  };
}
