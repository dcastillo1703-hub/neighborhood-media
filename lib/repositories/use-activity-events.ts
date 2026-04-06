"use client";

import { useMemo } from "react";

import { neighborhoodWorkspace, seededActivityEvents } from "@/data/seed";
import { useScopedCollection } from "@/lib/repositories/client-store";
import { activityEventsAdapter } from "@/lib/repositories/supabase-store";
import { ActivityEvent } from "@/types";

export function useActivityEvents(workspaceId = neighborhoodWorkspace.id) {
  const seed = useMemo(
    () => seededActivityEvents.filter((event) => event.workspaceId === workspaceId),
    [workspaceId]
  );
  const [events, setEvents, ready] = useScopedCollection<ActivityEvent>(
    "nmos-activity-events",
    workspaceId,
    seed,
    activityEventsAdapter
  );

  return {
    events,
    ready,
    addEvent(event: ActivityEvent) {
      setEvents((current) => [event, ...current]);
    }
  };
}
