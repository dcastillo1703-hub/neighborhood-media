import { seededWorkspaceMembers } from "@/data/seed";
import {
  mapActivityEventInsert,
  mapActivityEventRow,
  mapWorkspaceMemberInsert,
  mapWorkspaceMemberRow
} from "@/lib/supabase/mappers";
import type { ActivityEvent, WorkspaceMember, WorkspaceRole } from "@/types";

type WorkspaceMemberSnapshot = {
  members: WorkspaceMember[];
};

const workspaceMemberStore = new Map<string, WorkspaceMemberSnapshot>();

function getWorkspaceSnapshot(workspaceId: string) {
  const existing = workspaceMemberStore.get(workspaceId);

  if (existing) {
    return existing;
  }

  const seededSnapshot: WorkspaceMemberSnapshot = {
    members: seededWorkspaceMembers
      .filter((member) => member.workspaceId === workspaceId)
      .map((member) => ({ ...member }))
  };

  workspaceMemberStore.set(workspaceId, seededSnapshot);

  return seededSnapshot;
}

async function recordWorkspaceEvent(event: ActivityEvent) {
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
    console.error("Failed to record workspace membership event.", error);
    return event;
  }
}

export async function listWorkspaceMembers(workspaceId: string) {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data, error } = await supabase
      .from("workspace_memberships")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("email", { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []).map((row: Parameters<typeof mapWorkspaceMemberRow>[0]) =>
      mapWorkspaceMemberRow(row)
    );
  }

  return getWorkspaceSnapshot(workspaceId).members;
}

export async function createWorkspaceMember(input: {
  workspaceId: string;
  fullName: string;
  email: string;
  role: WorkspaceRole;
  status: WorkspaceMember["status"];
}) {
  const member: WorkspaceMember = {
    id: `wmem-${Date.now()}`,
    workspaceId: input.workspaceId,
    userId: "",
    fullName: input.fullName,
    email: input.email.toLowerCase(),
    role: input.role,
    status: input.status
  };

  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data: authUser } = await supabase
      .from("profiles")
      .select("id,email")
      .eq("email", member.email)
      .maybeSingle();

    const insertPayload = mapWorkspaceMemberInsert({
      ...member,
      userId: authUser?.id ?? member.userId
    });

    const { data, error } = await supabase
      .from("workspace_memberships")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const createdMember = mapWorkspaceMemberRow(data as Parameters<typeof mapWorkspaceMemberRow>[0]);
    const event = await recordWorkspaceEvent({
      id: `evt-${Date.now()}`,
      workspaceId: input.workspaceId,
      actorName: "Workspace admin",
      actionLabel: "invited",
      subjectType: "workspace",
      subjectName: createdMember.email,
      detail: `${createdMember.fullName} added to the workspace as ${createdMember.role}.`,
      createdAt: new Date().toISOString()
    });

    return { member: createdMember, event };
  }

  const snapshot = getWorkspaceSnapshot(input.workspaceId);
  snapshot.members = [...snapshot.members, member];

  const event: ActivityEvent = {
    id: `evt-${Date.now()}`,
    workspaceId: input.workspaceId,
    actorName: "Workspace admin",
    actionLabel: "invited",
    subjectType: "workspace",
    subjectName: member.email,
    detail: `${member.fullName} added to the workspace as ${member.role}.`,
    createdAt: new Date().toISOString()
  };

  return { member, event };
}

export async function updateWorkspaceMember(
  workspaceId: string,
  memberId: string,
  update: {
    role?: WorkspaceRole;
    status?: WorkspaceMember["status"];
  }
) {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data, error } = await supabase
      .from("workspace_memberships")
      .update({
        ...(update.role ? { role: update.role } : {}),
        ...(update.status ? { status: update.status } : {})
      })
      .eq("id", memberId)
      .eq("workspace_id", workspaceId)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("Workspace member not found.");
    }

    const member = mapWorkspaceMemberRow(data as Parameters<typeof mapWorkspaceMemberRow>[0]);
    const event = await recordWorkspaceEvent({
      id: `evt-${Date.now()}`,
      workspaceId,
      actorName: "Workspace admin",
      actionLabel: "updated",
      subjectType: "workspace",
      subjectName: member.email,
      detail: `${member.fullName} updated to ${member.role} (${member.status}).`,
      createdAt: new Date().toISOString()
    });

    return { member, event };
  }

  const snapshot = getWorkspaceSnapshot(workspaceId);
  const existing = snapshot.members.find((member) => member.id === memberId);

  if (!existing) {
    throw new Error("Workspace member not found.");
  }

  existing.role = update.role ?? existing.role;
  existing.status = update.status ?? existing.status;

  const event: ActivityEvent = {
    id: `evt-${Date.now()}`,
    workspaceId,
    actorName: "Workspace admin",
    actionLabel: "updated",
    subjectType: "workspace",
    subjectName: existing.email,
    detail: `${existing.fullName} updated to ${existing.role} (${existing.status}).`,
    createdAt: new Date().toISOString()
  };

  return { member: existing, event };
}
