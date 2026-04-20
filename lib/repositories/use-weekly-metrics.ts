"use client";

import { useEffect, useState } from "react";

import type { ActivityEvent, WeeklyMetric } from "@/types";

type WeeklyMetricsResponse = {
  metrics: WeeklyMetric[];
};

export function useWeeklyMetrics(clientId: string) {
  const [metrics, setMetrics] = useState<WeeklyMetric[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setReady(false);
      setError(null);

      try {
        const response = await fetch(`/api/weekly-metrics?clientId=${encodeURIComponent(clientId)}`, {
          method: "GET",
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("Failed to load weekly metrics.");
        }

        const payload = (await response.json()) as WeeklyMetricsResponse;

        if (active) {
          setMetrics(payload.metrics);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error ? loadError.message : "Failed to load weekly metrics."
          );
          setMetrics([]);
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
    metrics,
    ready,
    error,
    async saveMetric(metric: WeeklyMetric, editingId?: string | null) {
      const method = editingId ? "PATCH" : "POST";
      const path = editingId ? `/api/weekly-metrics/${editingId}` : "/api/weekly-metrics";
      const response = await fetch(path, {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(metric)
      });

      if (!response.ok) {
        throw new Error("Failed to save weekly metric.");
      }

      const payload = (await response.json()) as {
        metric: WeeklyMetric;
        event: ActivityEvent;
      };

      setMetrics((current) => {
        if (editingId) {
          return current.map((entry) => (entry.id === editingId ? payload.metric : entry));
        }

        return [...current, payload.metric];
      });

      return payload;
    },
    async deleteMetric(id: string) {
      const response = await fetch(`/api/weekly-metrics/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ clientId })
      });

      if (!response.ok) {
        throw new Error("Failed to delete weekly metric.");
      }

      setMetrics((current) => current.filter((item) => item.id !== id));
    },
    async replaceMetrics(nextMetrics: WeeklyMetric[], importLabel?: string) {
      const response = await fetch("/api/weekly-metrics/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          clientId,
          metrics: nextMetrics,
          importLabel
        })
      });

      if (!response.ok) {
        throw new Error("Failed to apply imported weekly metrics.");
      }

      const payload = (await response.json()) as {
        metrics: WeeklyMetric[];
        event: ActivityEvent;
      };

      setMetrics(payload.metrics);
      return payload;
    }
  };
}
