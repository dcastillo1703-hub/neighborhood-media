import { meamaClient, seededApprovalRequests } from "@/data/seed";
import {
  mapActivityEventInsert,
  mapActivityEventRow,
  mapApprovalRequestInsert,
  mapApprovalRequestRow
} from "@/lib/supabase/mappers";
import type { ActivityEvent, ApprovalRequest, Post } from "@/types";

type ApprovalSnapshot = {
  approvals: ApprovalRequest[];
};

const approvalStore = new Map<string, ApprovalSnapshot>();

function getClientSnapshot(clientId: string) {
  const existing = approvalStore.get(clientId);

  if (existing) {
    return existing;
  }

  const seededSnapshot: ApprovalSnapshot = {
    approvals: seededApprovalRequests
      .filter((approval) => approval.clientId === clientId)
      .map((approval) => ({ ...approval }))
  };

  approvalStore.set(clientId, seededSnapshot);

  return seededSnapshot;
}

async function canUseApprovalTable() {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (!supabase) {
    return false;
  }

  try {
    const { error } = await supabase.from("approval_requests").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
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

async function recordApprovalEvent(event: ActivityEvent) {
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
    console.error("Failed to record approval event.", error);
    return event;
  }
}

export async function listApprovalRequests(clientId: string) {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase && (await canUseApprovalTable())) {
    const { data, error } = await supabase
      .from("approval_requests")
      .select("*")
      .eq("client_id", clientId)
      .order("requested_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []).map((row: Parameters<typeof mapApprovalRequestRow>[0]) =>
      mapApprovalRequestRow(row)
    );
  }

  return getClientSnapshot(clientId).approvals;
}

export async function getApprovalForPost(clientId: string, postId: string) {
  const approvals = await listApprovalRequests(clientId);
  return (
    approvals.find(
      (approval: ApprovalRequest) =>
        approval.entityType === "post" && approval.entityId === postId
    ) ?? null
  );
}

export async function requestPostApproval(post: Post) {
  if (post.status !== "Scheduled") {
    return null;
  }

  const existing = await getApprovalForPost(post.clientId, post.id);
  if (existing) {
    return { approval: existing, event: null };
  }

  const workspaceId = await getWorkspaceId(post.clientId);
  const approval: ApprovalRequest = {
    id: `apr-${Date.now()}`,
    workspaceId,
    clientId: post.clientId,
    entityType: "post",
    entityId: post.id,
    summary: `${post.platform} post for ${post.publishDate}`,
    requesterName: "Workspace operator",
    status: "Pending",
    note: "Awaiting approval before publishing.",
    requestedAt: new Date().toISOString()
  };

  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase && (await canUseApprovalTable())) {
    const { data, error } = await supabase
      .from("approval_requests")
      .insert(mapApprovalRequestInsert(approval))
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const savedApproval = mapApprovalRequestRow(data as Parameters<typeof mapApprovalRequestRow>[0]);
    const event = await recordApprovalEvent({
      id: `evt-${Date.now()}`,
      workspaceId,
      clientId: post.clientId,
      actorName: "Workspace operator",
      actionLabel: "requested",
      subjectType: "content",
      subjectName: post.goal,
      detail: `Approval requested for scheduled ${post.platform.toLowerCase()} post.`,
      createdAt: approval.requestedAt
    });

    return { approval: savedApproval, event };
  }

  const snapshot = getClientSnapshot(post.clientId);
  snapshot.approvals = [approval, ...snapshot.approvals];

  return {
    approval,
    event: {
      id: `evt-${Date.now()}`,
      workspaceId,
      clientId: post.clientId,
      actorName: "Workspace operator",
      actionLabel: "requested",
      subjectType: "content",
      subjectName: post.goal,
      detail: `Approval requested for scheduled ${post.platform.toLowerCase()} post.`,
      createdAt: approval.requestedAt
    } satisfies ActivityEvent
  };
}

export async function reviewApprovalRequest(input: {
  clientId: string;
  approvalId: string;
  status: Extract<ApprovalRequest["status"], "Approved" | "Changes Requested">;
  note?: string;
  approverName: string;
  approverUserId?: string;
}) {
  const workspaceId = await getWorkspaceId(input.clientId);
  const approvals = await listApprovalRequests(input.clientId);
  const existing = approvals.find(
    (approval: ApprovalRequest) => approval.id === input.approvalId
  );

  if (!existing) {
    throw new Error("Approval request not found.");
  }

  const reviewedAt = new Date().toISOString();
  const nextApproval: ApprovalRequest = {
    ...existing,
    status: input.status,
    note: input.note ?? existing.note,
    approverName: input.approverName,
    approverUserId: input.approverUserId,
    reviewedAt
  };

  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase && (await canUseApprovalTable())) {
    const { data, error } = await supabase
      .from("approval_requests")
      .update(mapApprovalRequestInsert(nextApproval))
      .eq("id", input.approvalId)
      .eq("client_id", input.clientId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const savedApproval = mapApprovalRequestRow(data as Parameters<typeof mapApprovalRequestRow>[0]);
    const event = await recordApprovalEvent({
      id: `evt-${Date.now()}`,
      workspaceId,
      clientId: input.clientId,
      actorName: input.approverName,
      actionLabel: input.status === "Approved" ? "approved" : "requested changes",
      subjectType: "content",
      subjectName: savedApproval.summary,
      detail:
        input.status === "Approved"
          ? "Scheduled post approved for publishing."
          : "Scheduled post sent back for changes.",
      createdAt: reviewedAt
    });

    return { approval: savedApproval, event };
  }

  const snapshot = getClientSnapshot(input.clientId);
  snapshot.approvals = snapshot.approvals.map((approval) =>
    approval.id === input.approvalId ? nextApproval : approval
  );

  return {
    approval: nextApproval,
    event: {
      id: `evt-${Date.now()}`,
      workspaceId,
      clientId: input.clientId,
      actorName: input.approverName,
      actionLabel: input.status === "Approved" ? "approved" : "requested changes",
      subjectType: "content",
      subjectName: nextApproval.summary,
      detail:
        input.status === "Approved"
          ? "Scheduled post approved for publishing."
          : "Scheduled post sent back for changes.",
      createdAt: reviewedAt
    } satisfies ActivityEvent
  };
}
