import { seededIntegrationConnections, seededPosts, seededPublishJobs } from "@/data/seed";
import { getIntegrationAdapter } from "@/lib/integrations/registry";
import { getApprovalForPost } from "@/lib/services/approvals-service";
import {
  mapActivityEventInsert,
  mapActivityEventRow,
  mapPostRow,
  mapPublishJobInsert,
  mapPublishJobRow
} from "@/lib/supabase/mappers";
import type { ActivityEvent, IntegrationConnection, Post, PublishJob } from "@/types";

type PublishSnapshot = {
  jobs: PublishJob[];
};

const publishStore = new Map<string, PublishSnapshot>();

function getClientSnapshot(clientId: string) {
  const existing = publishStore.get(clientId);

  if (existing) {
    return existing;
  }

  const seededSnapshot: PublishSnapshot = {
    jobs: seededPublishJobs.filter((job) => job.clientId === clientId).map((job) => ({ ...job }))
  };

  publishStore.set(clientId, seededSnapshot);

  return seededSnapshot;
}

function toProvider(platform: Post["platform"]): PublishJob["provider"] | null {
  if (platform === "Instagram") {
    return "instagram";
  }

  if (platform === "Facebook") {
    return "facebook";
  }

  if (platform === "TikTok") {
    return "tiktok";
  }

  return null;
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

  return "ws-neighborhood";
}

async function recordPublishEvent(event: ActivityEvent) {
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
    console.error("Failed to record publish event.", error);
    return event;
  }
}

async function getPostForPublishing(clientId: string, postId: string) {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("id", postId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    const { data: links, error: linkError } = await supabase
      .from("post_assets")
      .select("*")
      .eq("post_id", postId);

    if (linkError) {
      throw linkError;
    }

    return mapPostRow(data as Parameters<typeof mapPostRow>[0], (links ?? []).map((row: { asset_id: string }) => row.asset_id));
  }

  return seededPosts.find((post) => post.id === postId && post.clientId === clientId) ?? null;
}

async function getConnection(clientId: string, provider: PublishJob["provider"]) {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("integration_connections")
        .select("*")
        .eq("client_id", clientId)
        .eq("provider", provider)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return (data ?? null) as IntegrationConnection | null;
    } catch (error) {
      console.error("Failed to load integration connection for publishing.", error);
      return null;
    }
  }

  return (
    seededIntegrationConnections.find(
      (connection) => connection.clientId === clientId && connection.provider === provider
    ) ?? null
  );
}

async function canUsePublishTable() {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (!supabase) {
    return false;
  }

  try {
    const { error } = await supabase.from("publish_jobs").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}

export async function listPublishJobs(clientId: string) {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase && (await canUsePublishTable())) {
    const { data, error } = await supabase
      .from("publish_jobs")
      .select("*")
      .eq("client_id", clientId)
      .order("scheduled_for", { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []).map((row: Parameters<typeof mapPublishJobRow>[0]) =>
      mapPublishJobRow(row)
    );
  }

  return getClientSnapshot(clientId).jobs;
}

export async function queuePublishJobForPost(post: Post) {
  const provider = toProvider(post.platform);

  if (!provider || post.status !== "Scheduled") {
    return null;
  }

  const workspaceId = await getWorkspaceId(post.clientId);
  const job: PublishJob = {
    id: `pub-${Date.now()}`,
    clientId: post.clientId,
    postId: post.id,
    provider,
    scheduledFor: `${post.publishDate}T15:00:00.000Z`,
    status: "Queued",
    detail: `${post.platform} publish queued for ${post.publishDate}.`,
    createdAt: new Date().toISOString()
  };

  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase && (await canUsePublishTable())) {
    const { data, error } = await supabase
      .from("publish_jobs")
      .insert(mapPublishJobInsert(job))
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const event = await recordPublishEvent({
      id: `evt-${Date.now()}`,
      workspaceId,
      clientId: post.clientId,
      actorName: "Workspace operator",
      actionLabel: "queued",
      subjectType: "content",
      subjectName: post.goal,
      detail: `${post.platform} publish queued for ${post.publishDate}.`,
      createdAt: new Date().toISOString()
    });

    return {
      job: mapPublishJobRow(data as Parameters<typeof mapPublishJobRow>[0]),
      event
    };
  }

  const snapshot = getClientSnapshot(post.clientId);
  snapshot.jobs = [...snapshot.jobs, job];

  const event: ActivityEvent = {
    id: `evt-${Date.now()}`,
    workspaceId,
    clientId: post.clientId,
    actorName: "Workspace operator",
    actionLabel: "queued",
    subjectType: "content",
    subjectName: post.goal,
    detail: `${post.platform} publish queued for ${post.publishDate}.`,
    createdAt: new Date().toISOString()
  };

  return {
    job,
    event
  };
}

export async function processPublishJob(clientId: string, jobId: string) {
  const jobs = await listPublishJobs(clientId);
  const job = jobs.find((entry: PublishJob) => entry.id === jobId);

  if (!job) {
    throw new Error("Publish job not found.");
  }

  const post = await getPostForPublishing(clientId, job.postId);

  if (!post) {
    throw new Error("Linked post not found.");
  }

  const approval = await getApprovalForPost(clientId, job.postId);
  if (!approval || approval.status !== "Approved") {
    const attemptedAt = new Date().toISOString();
    const workspaceId = await getWorkspaceId(clientId);
    const blockedMessage = approval?.status === "Changes Requested"
      ? "Publishing blocked until requested changes are resolved and approval is granted."
      : "Publishing blocked until the scheduled post is approved.";
    const update = {
      status: "Blocked" as PublishJob["status"],
      detail: blockedMessage,
      error_message: blockedMessage,
      last_attempt_at: attemptedAt
    };

    const serverModule = await import("@/lib/supabase/server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await serverModule.getSupabaseServerClient()) as any;

    if (supabase && (await canUsePublishTable())) {
      const { data, error } = await supabase
        .from("publish_jobs")
        .update(update)
        .eq("id", jobId)
        .eq("client_id", clientId)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const event = await recordPublishEvent({
        id: `evt-${Date.now()}`,
        workspaceId,
        clientId,
        actorName: "Workspace operator",
        actionLabel: "blocked",
        subjectType: "content",
        subjectName: post.goal,
        detail: blockedMessage,
        createdAt: attemptedAt
      });

      return {
        job: mapPublishJobRow(data as Parameters<typeof mapPublishJobRow>[0]),
        event
      };
    }

    const snapshot = getClientSnapshot(clientId);
    snapshot.jobs = snapshot.jobs.map((entry) =>
      entry.id === jobId
        ? {
            ...entry,
            status: "Blocked",
            detail: blockedMessage,
            errorMessage: blockedMessage,
            lastAttemptAt: attemptedAt
          }
        : entry
    );

    const updated = snapshot.jobs.find((entry) => entry.id === jobId)!;

    return {
      job: updated,
      event: {
        id: `evt-${Date.now()}`,
        workspaceId,
        clientId,
        actorName: "Workspace operator",
        actionLabel: "blocked",
        subjectType: "content",
        subjectName: post.goal,
        detail: blockedMessage,
        createdAt: attemptedAt
      } satisfies ActivityEvent
    };
  }

  const adapter = getIntegrationAdapter(job.provider);
  const connection = await getConnection(clientId, job.provider);
  const result = await adapter.publish?.(post, connection ?? undefined);
  const attemptedAt = new Date().toISOString();
  const workspaceId = await getWorkspaceId(clientId);

  const nextStatus: PublishJob["status"] =
    result?.status === "success"
      ? "Published"
      : result?.status === "blocked"
        ? "Blocked"
        : "Failed";

  const update = {
    status: nextStatus,
    detail: result?.message ?? job.detail,
    external_id: result?.externalId ?? null,
    error_message: result?.status === "blocked" ? result.message : null,
    last_attempt_at: attemptedAt,
    published_at: result?.status === "success" ? attemptedAt : null
  };

  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase && (await canUsePublishTable())) {
    const { data, error } = await supabase
      .from("publish_jobs")
      .update(update)
      .eq("id", jobId)
      .eq("client_id", clientId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const event = await recordPublishEvent({
      id: `evt-${Date.now()}`,
      workspaceId,
      clientId,
      actorName: "Workspace operator",
      actionLabel: nextStatus === "Published" ? "published" : "attempted",
      subjectType: "content",
      subjectName: post.goal,
      detail: result?.message ?? `Publish status changed to ${nextStatus}.`,
      createdAt: attemptedAt
    });

    return {
      job: mapPublishJobRow(data as Parameters<typeof mapPublishJobRow>[0]),
      event
    };
  }

  const snapshot = getClientSnapshot(clientId);
  snapshot.jobs = snapshot.jobs.map((entry) =>
    entry.id === jobId
      ? {
          ...entry,
          status: nextStatus,
          detail: result?.message ?? entry.detail,
          externalId: result?.externalId,
          errorMessage: result?.status === "blocked" ? result.message : undefined,
          lastAttemptAt: attemptedAt,
          publishedAt: result?.status === "success" ? attemptedAt : undefined
        }
      : entry
  );

  const updated = snapshot.jobs.find((entry) => entry.id === jobId)!;
  const event: ActivityEvent = {
    id: `evt-${Date.now()}`,
    workspaceId,
    clientId,
    actorName: "Workspace operator",
    actionLabel: nextStatus === "Published" ? "published" : "attempted",
    subjectType: "content",
    subjectName: post.goal,
    detail: result?.message ?? `Publish status changed to ${nextStatus}.`,
    createdAt: attemptedAt
  };

  return {
    job: updated,
    event
  };
}
