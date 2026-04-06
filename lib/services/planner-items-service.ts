import { meamaClient, seededPlannerItems } from "@/data/seed";
import {
  mapActivityEventInsert,
  mapActivityEventRow,
  mapPlannerItemInsert,
  mapPlannerItemRow
} from "@/lib/supabase/mappers";
import type { ActivityEvent, PlannerItem } from "@/types";

type PlannerSnapshot = {
  items: PlannerItem[];
};

const plannerStore = new Map<string, PlannerSnapshot>();

function getClientSnapshot(clientId: string) {
  const existing = plannerStore.get(clientId);

  if (existing) {
    return existing;
  }

  const seededSnapshot: PlannerSnapshot = {
    items: seededPlannerItems
      .filter((item) => item.clientId === clientId)
      .map((item) => ({ ...item }))
  };

  plannerStore.set(clientId, seededSnapshot);

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

async function recordPlannerEvent(event: ActivityEvent) {
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
    console.error("Failed to record planner activity event.", error);
    return event;
  }
}

export async function listPlannerItems(clientId: string) {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data, error } = await supabase
      .from("planner_items")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []).map((row: Parameters<typeof mapPlannerItemRow>[0]) =>
      mapPlannerItemRow(row)
    );
  }

  return getClientSnapshot(clientId).items;
}

export async function createPlannerItem(item: PlannerItem) {
  const workspaceId = await getWorkspaceId(item.clientId);
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data, error } = await supabase
      .from("planner_items")
      .insert(mapPlannerItemInsert(item))
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const event = await recordPlannerEvent({
      id: `evt-${Date.now()}`,
      workspaceId,
      clientId: item.clientId,
      actorName: "Workspace operator",
      actionLabel: "created",
      subjectType: "content",
      subjectName: item.campaignGoal,
      detail: `${item.dayOfWeek} ${item.platform} planner item created.`,
      createdAt: new Date().toISOString()
    });

    return {
      item: mapPlannerItemRow(data as Parameters<typeof mapPlannerItemRow>[0]),
      event
    };
  }

  const snapshot = getClientSnapshot(item.clientId);
  snapshot.items = [...snapshot.items, item];

  const event: ActivityEvent = {
    id: `evt-${Date.now()}`,
    workspaceId,
    clientId: item.clientId,
    actorName: "Workspace operator",
    actionLabel: "created",
    subjectType: "content",
    subjectName: item.campaignGoal,
    detail: `${item.dayOfWeek} ${item.platform} planner item created.`,
    createdAt: new Date().toISOString()
  };

  return {
    item,
    event
  };
}

export async function updatePlannerItemStatus(
  clientId: string,
  itemId: string,
  status: PlannerItem["status"]
) {
  const workspaceId = await getWorkspaceId(clientId);
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data, error } = await supabase
      .from("planner_items")
      .update({ status })
      .eq("id", itemId)
      .eq("client_id", clientId)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("Planner item not found.");
    }

    const item = mapPlannerItemRow(data as Parameters<typeof mapPlannerItemRow>[0]);
    const event = await recordPlannerEvent({
      id: `evt-${Date.now()}`,
      workspaceId,
      clientId,
      actorName: "Workspace operator",
      actionLabel: "updated",
      subjectType: "content",
      subjectName: item.campaignGoal,
      detail: `Planner item moved to ${status}.`,
      createdAt: new Date().toISOString()
    });

    return { item, event };
  }

  const snapshot = getClientSnapshot(clientId);
  const existing = snapshot.items.find((entry) => entry.id === itemId);

  if (!existing) {
    throw new Error("Planner item not found.");
  }

  existing.status = status;

  const event: ActivityEvent = {
    id: `evt-${Date.now()}`,
    workspaceId,
    clientId,
    actorName: "Workspace operator",
    actionLabel: "updated",
    subjectType: "content",
    subjectName: existing.campaignGoal,
    detail: `Planner item moved to ${status}.`,
    createdAt: new Date().toISOString()
  };

  return { item: existing, event };
}
