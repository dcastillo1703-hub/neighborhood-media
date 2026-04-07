import { seededActivityEvents, seededOperationalTasks } from "@/data/seed";
import {
  mapActivityEventInsert,
  mapActivityEventRow,
  mapOperationalTaskInsert,
  mapOperationalTaskRow
} from "@/lib/supabase/mappers";
import type { ActivityEvent, OperationalTask } from "@/types";

type OperationSnapshot = {
  tasks: OperationalTask[];
  events: ActivityEvent[];
};

const operationStore = new Map<string, OperationSnapshot>();

function getWorkspaceSnapshot(workspaceId: string) {
  const existing = operationStore.get(workspaceId);

  if (existing) {
    return existing;
  }

  const seededSnapshot: OperationSnapshot = {
    tasks: seededOperationalTasks
      .filter((task) => task.workspaceId === workspaceId)
      .map((task) => ({ ...task })),
    events: seededActivityEvents
      .filter((event) => event.workspaceId === workspaceId)
      .map((event) => ({ ...event }))
  };

  operationStore.set(workspaceId, seededSnapshot);

  return seededSnapshot;
}

export async function listWorkspaceOperations(workspaceId: string, clientId?: string) {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    let tasksQuery = supabase
      .from("operational_tasks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    let eventsQuery = supabase
      .from("activity_events")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (clientId) {
      tasksQuery = tasksQuery.or(`client_id.is.null,client_id.eq.${clientId}`);
      eventsQuery = eventsQuery.or(`client_id.is.null,client_id.eq.${clientId}`);
    }

    const [{ data: taskRows, error: tasksError }, { data: eventRows, error: eventsError }] =
      await Promise.all([tasksQuery, eventsQuery]);

    if (tasksError || eventsError) {
      throw tasksError ?? eventsError;
    }

    return {
      tasks: (taskRows ?? []).map((row: Parameters<typeof mapOperationalTaskRow>[0]) =>
        mapOperationalTaskRow(row as Parameters<typeof mapOperationalTaskRow>[0])
      ),
      events: (eventRows ?? []).map((row: Parameters<typeof mapActivityEventRow>[0]) =>
        mapActivityEventRow(row as Parameters<typeof mapActivityEventRow>[0])
      )
    };
  }

  const snapshot = getWorkspaceSnapshot(workspaceId);

  return {
    tasks: snapshot.tasks.filter((task) => !clientId || !task.clientId || task.clientId === clientId),
    events: snapshot.events.filter(
      (event) => !clientId || !event.clientId || event.clientId === clientId
    )
  };
}

export async function createOperationalTask(input: OperationalTask) {
  const event: ActivityEvent = {
    id: `evt-${Date.now()}`,
    workspaceId: input.workspaceId,
    clientId: input.clientId,
    actorName: input.assigneeName ?? "Workspace operator",
    actionLabel: "created",
    subjectType: "task",
    subjectName: input.title,
    detail: `Operational task created in ${input.status} with ${input.priority.toLowerCase()} priority.`,
    createdAt: new Date().toISOString()
  };

  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data: taskRow, error: taskError } = await supabase
      .from("operational_tasks")
      .insert(mapOperationalTaskInsert(input))
      .select("*")
      .single();

    if (taskError) {
      throw taskError;
    }

    const { data: eventRow, error: eventError } = await supabase
      .from("activity_events")
      .insert(mapActivityEventInsert(event))
      .select("*")
      .single();

    if (eventError) {
      throw eventError;
    }

    return {
      task: mapOperationalTaskRow(taskRow as Parameters<typeof mapOperationalTaskRow>[0]),
      event: mapActivityEventRow(eventRow as Parameters<typeof mapActivityEventRow>[0])
    };
  }

  const snapshot = getWorkspaceSnapshot(input.workspaceId);
  snapshot.tasks = [input, ...snapshot.tasks];

  snapshot.events = [event, ...snapshot.events];

  return {
    task: input,
    event
  };
}

export async function updateOperationalTaskStatus(
  workspaceId: string,
  taskId: string,
  status: OperationalTask["status"]
) {
  return updateOperationalTask(workspaceId, taskId, { status }, `Task moved to ${status}.`);
}

export async function updateOperationalTask(
  workspaceId: string,
  taskId: string,
  updates: Partial<Omit<OperationalTask, "id" | "workspaceId" | "createdAt">>,
  eventDetail?: string
) {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const updatePayload: Record<string, string | null | undefined> = {};

    if (updates.clientId !== undefined) {
      updatePayload.client_id = updates.clientId ?? null;
    }

    if (updates.title !== undefined) {
      updatePayload.title = updates.title;
    }

    if (updates.detail !== undefined) {
      updatePayload.detail = updates.detail;
    }

    if (updates.status !== undefined) {
      updatePayload.status = updates.status;
    }

    if (updates.priority !== undefined) {
      updatePayload.priority = updates.priority;
    }

    if (updates.dueDate !== undefined) {
      updatePayload.due_date = updates.dueDate ?? null;
    }

    if (updates.assigneeUserId !== undefined) {
      updatePayload.assignee_user_id = updates.assigneeUserId ?? null;
    }

    if (updates.assigneeName !== undefined) {
      updatePayload.assignee_name = updates.assigneeName ?? null;
    }

    if (updates.linkedEntityType !== undefined) {
      updatePayload.linked_entity_type = updates.linkedEntityType ?? null;
    }

    if (updates.linkedEntityId !== undefined) {
      updatePayload.linked_entity_id = updates.linkedEntityId ?? null;
    }

    const { data: updatedTaskRow, error: updateError } = await supabase
      .from("operational_tasks")
      .update(updatePayload)
      .eq("id", taskId)
      .eq("workspace_id", workspaceId)
      .select("*")
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    if (!updatedTaskRow) {
      throw new Error("Task not found.");
    }

    const updatedTask = mapOperationalTaskRow(
      updatedTaskRow as Parameters<typeof mapOperationalTaskRow>[0]
    );
    const event: ActivityEvent = {
      id: `evt-${Date.now()}`,
      workspaceId,
      clientId: updatedTask.clientId,
      actorName: updatedTask.assigneeName ?? "Workspace operator",
      actionLabel: updates.status ? "moved" : "updated",
      subjectType: "task",
      subjectName: updatedTask.title,
      detail: eventDetail ?? "Task details updated.",
      createdAt: new Date().toISOString()
    };
    const { data: eventRow, error: eventError } = await supabase
      .from("activity_events")
      .insert(mapActivityEventInsert(event))
      .select("*")
      .single();

    if (eventError) {
      throw eventError;
    }

    return {
      task: updatedTask,
      event: mapActivityEventRow(eventRow as Parameters<typeof mapActivityEventRow>[0])
    };
  }

  const snapshot = getWorkspaceSnapshot(workspaceId);
  const task = snapshot.tasks.find((entry) => entry.id === taskId);

  if (!task) {
    throw new Error("Task not found.");
  }

  Object.assign(task, updates);

  const event: ActivityEvent = {
    id: `evt-${Date.now()}`,
    workspaceId,
    clientId: task.clientId,
    actorName: task.assigneeName ?? "Workspace operator",
    actionLabel: updates.status ? "moved" : "updated",
    subjectType: "task",
    subjectName: task.title,
    detail: eventDetail ?? "Task details updated.",
    createdAt: new Date().toISOString()
  };

  snapshot.events = [event, ...snapshot.events];

  return {
    task,
    event
  };
}
