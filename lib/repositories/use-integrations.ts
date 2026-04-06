"use client";

import { useEffect, useState } from "react";

import type { IntegrationConnection, SyncJob } from "@/types";

type IntegrationsResponse = {
  connections: IntegrationConnection[];
  syncJobs: SyncJob[];
};

export function useIntegrations(clientId: string) {
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setReady(false);
      setError(null);

      try {
        const response = await fetch(
          `/api/integrations?clientId=${encodeURIComponent(clientId)}`,
          {
            method: "GET",
            cache: "no-store"
          }
        );

        if (!response.ok) {
          throw new Error("Failed to load integrations.");
        }

        const payload = (await response.json()) as IntegrationsResponse;

        if (active) {
          setConnections(payload.connections);
          setSyncJobs(payload.syncJobs);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load integrations.");
          setConnections([]);
          setSyncJobs([]);
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
    connections,
    syncJobs,
    ready,
    error,
    async updateConnection(id: string, update: Partial<IntegrationConnection>) {
      const response = await fetch(`/api/integrations/connections/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ clientId, update })
      });

      if (!response.ok) {
        throw new Error("Failed to update integration connection.");
      }

      const payload = (await response.json()) as { connection: IntegrationConnection };

      setConnections((current) =>
        current.map((connection) => (connection.id === id ? payload.connection : connection))
      );
    },
    async checkConnection(id: string) {
      const response = await fetch(`/api/integrations/connections/${id}/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ clientId })
      });

      if (!response.ok) {
        throw new Error("Failed to check integration connection.");
      }

      const payload = (await response.json()) as {
        connection: IntegrationConnection;
      };

      setConnections((current) =>
        current.map((connection) => (connection.id === id ? payload.connection : connection))
      );

      return payload;
    },
    async prepareConnection(id: string) {
      const response = await fetch(`/api/integrations/connections/${id}/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ clientId, mode: "prepare" })
      });

      if (!response.ok) {
        throw new Error("Failed to prepare integration connection.");
      }

      const payload = (await response.json()) as {
        connection: IntegrationConnection;
      };

      setConnections((current) =>
        current.map((connection) => (connection.id === id ? payload.connection : connection))
      );

      return payload;
    },
    async updateSyncJob(id: string, update: Partial<SyncJob>) {
      const response = await fetch(`/api/integrations/sync-jobs/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ clientId, update })
      });

      if (!response.ok) {
        throw new Error("Failed to update sync job.");
      }

      const payload = (await response.json()) as { job: SyncJob };

      setSyncJobs((current) => current.map((job) => (job.id === id ? payload.job : job)));
    },
    async runSyncJob(id: string) {
      const response = await fetch(`/api/integrations/sync-jobs/${id}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ clientId })
      });

      if (!response.ok) {
        throw new Error("Failed to run sync job.");
      }

      const payload = (await response.json()) as { job: SyncJob };

      setSyncJobs((current) => current.map((job) => (job.id === id ? payload.job : job)));

      return payload;
    }
  };
}
