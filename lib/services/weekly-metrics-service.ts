import { meamaClient, seededWeeklyMetrics } from "@/data/seed";
import {
  mapActivityEventInsert,
  mapActivityEventRow,
  mapWeeklyMetricInsert,
  mapWeeklyMetricRow
} from "@/lib/supabase/mappers";
import type { ActivityEvent, WeeklyMetric } from "@/types";

type WeeklyMetricSnapshot = {
  metrics: WeeklyMetric[];
};

const weeklyMetricStore = new Map<string, WeeklyMetricSnapshot>();

function getClientSnapshot(clientId: string) {
  const existing = weeklyMetricStore.get(clientId);

  if (existing) {
    return existing;
  }

  const seededSnapshot: WeeklyMetricSnapshot = {
    metrics: seededWeeklyMetrics
      .filter((metric) => metric.clientId === clientId)
      .map((metric) => ({ ...metric }))
  };

  weeklyMetricStore.set(clientId, seededSnapshot);

  return seededSnapshot;
}

async function getWorkspaceId(clientId: string) {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data, error } = await supabase
      .from("clients")
      .select("workspace_id")
      .eq("id", clientId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data?.workspace_id) {
      return String(data.workspace_id);
    }
  }

  return meamaClient.workspaceId ?? "ws-neighborhood";
}

async function recordMetricEvent(event: ActivityEvent) {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (!supabase) {
    return event;
  }

  try {
    const { data, error } = await supabase
      .from("activity_events")
      .insert(mapActivityEventInsert(event))
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return mapActivityEventRow(data as Parameters<typeof mapActivityEventRow>[0]);
  } catch (error) {
    console.error("Failed to record weekly metric activity event.", error);
    return event;
  }
}

export async function listWeeklyMetrics(clientId: string) {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data, error } = await supabase
      .from("weekly_metrics")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []).map((row: Parameters<typeof mapWeeklyMetricRow>[0]) =>
      mapWeeklyMetricRow(row)
    );
  }

  return getClientSnapshot(clientId).metrics;
}

export async function saveWeeklyMetric(metric: WeeklyMetric) {
  const workspaceId = await getWorkspaceId(metric.clientId);
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data, error } = await supabase
      .from("weekly_metrics")
      .upsert(mapWeeklyMetricInsert(metric), { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const event = await recordMetricEvent({
      id: `evt-${Date.now()}`,
      workspaceId,
      clientId: metric.clientId,
      actorName: "Workspace operator",
      actionLabel: "saved",
      subjectType: "campaign",
      subjectName: metric.weekLabel,
      detail: `Weekly metric saved with ${metric.covers} covers.`,
      createdAt: new Date().toISOString()
    });

    return {
      metric: mapWeeklyMetricRow(data as Parameters<typeof mapWeeklyMetricRow>[0]),
      event
    };
  }

  const snapshot = getClientSnapshot(metric.clientId);
  const existingIndex = snapshot.metrics.findIndex((entry) => entry.id === metric.id);

  if (existingIndex >= 0) {
    snapshot.metrics[existingIndex] = metric;
  } else {
    snapshot.metrics = [...snapshot.metrics, metric];
  }

  const event: ActivityEvent = {
    id: `evt-${Date.now()}`,
    workspaceId,
    clientId: metric.clientId,
    actorName: "Workspace operator",
    actionLabel: "saved",
    subjectType: "campaign",
    subjectName: metric.weekLabel,
    detail: `Weekly metric saved with ${metric.covers} covers.`,
    createdAt: new Date().toISOString()
  };

  return {
    metric,
    event
  };
}

export async function removeWeeklyMetric(clientId: string, metricId: string) {
  const workspaceId = await getWorkspaceId(clientId);
  const metrics = await listWeeklyMetrics(clientId);
  const existing = metrics.find((entry: WeeklyMetric) => entry.id === metricId);

  if (!existing) {
    throw new Error("Weekly metric not found.");
  }

  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { error } = await supabase
      .from("weekly_metrics")
      .delete()
      .eq("id", metricId)
      .eq("client_id", clientId);

    if (error) {
      throw error;
    }

    const event = await recordMetricEvent({
      id: `evt-${Date.now()}`,
      workspaceId,
      clientId,
      actorName: "Workspace operator",
      actionLabel: "deleted",
      subjectType: "campaign",
      subjectName: existing.weekLabel,
      detail: `Weekly metric deleted.`,
      createdAt: new Date().toISOString()
    });

    return { metricId, event };
  }

  const snapshot = getClientSnapshot(clientId);
  snapshot.metrics = snapshot.metrics.filter((entry) => entry.id !== metricId);

  const event: ActivityEvent = {
    id: `evt-${Date.now()}`,
    workspaceId,
    clientId,
    actorName: "Workspace operator",
    actionLabel: "deleted",
    subjectType: "campaign",
    subjectName: existing.weekLabel,
    detail: `Weekly metric deleted.`,
    createdAt: new Date().toISOString()
  };

  return { metricId, event };
}
