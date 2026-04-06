"use client";

import { useEffect, useState } from "react";

import type { ActivityEvent, PlannerItem, PlannerStatus } from "@/types";

type PlannerItemsResponse = {
  items: PlannerItem[];
};

export function usePlannerItems(clientId: string) {
  const [items, setItems] = useState<PlannerItem[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setReady(false);
      setError(null);

      try {
        const response = await fetch(`/api/planner-items?clientId=${encodeURIComponent(clientId)}`, {
          method: "GET",
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("Failed to load planner items.");
        }

        const payload = (await response.json()) as PlannerItemsResponse;

        if (active) {
          setItems(payload.items);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load planner items.");
          setItems([]);
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
    items,
    ready,
    error,
    async addItem(item: Omit<PlannerItem, "id" | "createdAt">) {
      const response = await fetch("/api/planner-items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(item)
      });

      if (!response.ok) {
        throw new Error("Failed to create planner item.");
      }

      const payload = (await response.json()) as {
        item: PlannerItem;
        event: ActivityEvent;
      };

      setItems((current) => [...current, payload.item]);

      return payload;
    },
    async updateStatus(id: string, status: PlannerStatus) {
      const response = await fetch(`/api/planner-items/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ clientId, status })
      });

      if (!response.ok) {
        throw new Error("Failed to update planner item.");
      }

      const payload = (await response.json()) as {
        item: PlannerItem;
        event: ActivityEvent;
      };

      setItems((current) =>
        current.map((item) => (item.id === payload.item.id ? payload.item : item))
      );

      return payload;
    }
  };
}
