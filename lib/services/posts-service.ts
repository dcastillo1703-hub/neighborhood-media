import { meamaClient, seededPosts } from "@/data/seed";
import { mapActivityEventInsert, mapActivityEventRow, mapPostInsert, mapPostRow } from "@/lib/supabase/mappers";
import { requestPostApproval } from "@/lib/services/approvals-service";
import { queuePublishJobForPost } from "@/lib/services/publishing-service";
import type { ActivityEvent, Post } from "@/types";

type PostSnapshot = {
  posts: Post[];
};

const postStore = new Map<string, PostSnapshot>();

function getClientSnapshot(clientId: string) {
  const existing = postStore.get(clientId);

  if (existing) {
    return existing;
  }

  const seededSnapshot: PostSnapshot = {
    posts: seededPosts.filter((post) => post.clientId === clientId).map((post) => ({ ...post }))
  };

  postStore.set(clientId, seededSnapshot);

  return seededSnapshot;
}

async function getClientWorkspace(clientId: string) {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data, error } = await supabase
      .from("clients")
      .select("workspace_id,name")
      .eq("id", clientId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return {
        workspaceId: String(data.workspace_id),
        clientName: String(data.name)
      };
    }
  }

  return {
    workspaceId: meamaClient.workspaceId ?? "ws-neighborhood",
    clientName: meamaClient.name
  };
}

async function recordContentEvent(event: ActivityEvent) {
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
    console.error("Failed to record content activity event.", error);
    return event;
  }
}

export async function listClientPosts(clientId: string) {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("client_id", clientId)
      .order("publish_date", { ascending: true });

    if (error) {
      throw error;
    }

    const postRows = data ?? [];
    const postIds = postRows.map((post: { id: string }) => post.id);

    if (!postIds.length) {
      return [];
    }

    const { data: links, error: linkError } = await supabase
      .from("post_assets")
      .select("*")
      .in("post_id", postIds);

    if (linkError) {
      throw linkError;
    }

    const assetMap = new Map<string, string[]>();

    (links ?? []).forEach((row: { post_id: string; asset_id: string }) => {
      assetMap.set(row.post_id, [...(assetMap.get(row.post_id) ?? []), row.asset_id]);
    });

    return postRows.map((post: Parameters<typeof mapPostRow>[0]) =>
      mapPostRow(post, assetMap.get(post.id) ?? [])
    );
  }

  return getClientSnapshot(clientId).posts;
}

export async function createPost(post: Post) {
  const { workspaceId, clientName } = await getClientWorkspace(post.clientId);
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data, error } = await supabase
      .from("posts")
      .insert(mapPostInsert(post))
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    if (post.assetIds.length) {
      const { error: assetLinkError } = await supabase.from("post_assets").insert(
        post.assetIds.map((assetId) => ({
          post_id: post.id,
          asset_id: assetId
        }))
      );

      if (assetLinkError) {
        throw assetLinkError;
      }
    }

    if (post.plannerItemId) {
      const { error: plannerError } = await supabase
        .from("planner_items")
        .update({ linked_post_id: post.id })
        .eq("id", post.plannerItemId)
        .eq("client_id", post.clientId);

      if (plannerError) {
        throw plannerError;
      }
    }

    const event = await recordContentEvent({
      id: `evt-${Date.now()}`,
      workspaceId,
      clientId: post.clientId,
      actorName: "Workspace operator",
      actionLabel: post.status === "Scheduled" ? "scheduled" : "drafted",
      subjectType: "content",
      subjectName: post.goal,
      detail: `${post.platform} ${post.status.toLowerCase()} post created for ${clientName}.`,
      createdAt: new Date().toISOString()
    });
    const approvalPayload = await requestPostApproval(post);
    const publishPayload = await queuePublishJobForPost(post);

    return {
      post: mapPostRow(data as Parameters<typeof mapPostRow>[0], post.assetIds),
      event,
      approval: approvalPayload?.approval ?? null,
      publishJob: publishPayload?.job ?? null
    };
  }

  const snapshot = getClientSnapshot(post.clientId);
  snapshot.posts = [...snapshot.posts, post];

  const event: ActivityEvent = {
    id: `evt-${Date.now()}`,
    workspaceId,
    clientId: post.clientId,
    actorName: "Workspace operator",
    actionLabel: post.status === "Scheduled" ? "scheduled" : "drafted",
    subjectType: "content",
    subjectName: post.goal,
    detail: `${post.platform} ${post.status.toLowerCase()} post created for ${clientName}.`,
    createdAt: new Date().toISOString()
  };

  return {
    post,
    event,
    approval: (await requestPostApproval(post))?.approval ?? null,
    publishJob: (await queuePublishJobForPost(post))?.job ?? null
  };
}

export async function updatePost(
  clientId: string,
  postId: string,
  updates: Partial<Omit<Post, "id" | "clientId" | "createdAt">>
) {
  const { workspaceId, clientName } = await getClientWorkspace(clientId);
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data: existingRow, error: existingError } = await supabase
      .from("posts")
      .select("*")
      .eq("id", postId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (!existingRow) {
      throw new Error("Post not found.");
    }

    const existingPost = mapPostRow(existingRow as Parameters<typeof mapPostRow>[0]);
    const nextPost: Post = {
      ...existingPost,
      ...updates,
      id: postId,
      clientId,
      createdAt: existingPost.createdAt
    };

    const { data: updatedRow, error: updateError } = await supabase
      .from("posts")
      .update(mapPostInsert(nextPost))
      .eq("id", postId)
      .eq("client_id", clientId)
      .select("*")
      .single();

    if (updateError) {
      throw updateError;
    }

    if (updates.assetIds) {
      const { error: deleteLinksError } = await supabase
        .from("post_assets")
        .delete()
        .eq("post_id", postId);

      if (deleteLinksError) {
        throw deleteLinksError;
      }

      if (updates.assetIds.length) {
        const { error: assetLinkError } = await supabase.from("post_assets").insert(
          updates.assetIds.map((assetId) => ({
            post_id: postId,
            asset_id: assetId
          }))
        );

        if (assetLinkError) {
          throw assetLinkError;
        }
      }
    }

    const event = await recordContentEvent({
      id: `evt-${Date.now()}`,
      workspaceId,
      clientId,
      actorName: "Workspace operator",
      actionLabel: "updated",
      subjectType: "content",
      subjectName: nextPost.goal,
      detail: `${nextPost.platform} post updated for ${clientName}.`,
      createdAt: new Date().toISOString()
    });
    const approvalPayload = await requestPostApproval(nextPost);

    return {
      post: mapPostRow(
        updatedRow as Parameters<typeof mapPostRow>[0],
        nextPost.assetIds
      ),
      event,
      approval: approvalPayload?.approval ?? null
    };
  }

  const snapshot = getClientSnapshot(clientId);
  const post = snapshot.posts.find((entry) => entry.id === postId);

  if (!post) {
    throw new Error("Post not found.");
  }

  Object.assign(post, updates);

  const event: ActivityEvent = {
    id: `evt-${Date.now()}`,
    workspaceId,
    clientId,
    actorName: "Workspace operator",
    actionLabel: "updated",
    subjectType: "content",
    subjectName: post.goal,
    detail: `${post.platform} post updated for ${clientName}.`,
    createdAt: new Date().toISOString()
  };

  return {
    post,
    event,
    approval: (await requestPostApproval(post))?.approval ?? null
  };
}
