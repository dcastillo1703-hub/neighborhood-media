"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabaseCredentials } from "@/lib/supabase/config";
import {
  mapActivityEventInsert,
  mapActivityEventRow,
  mapAnalyticsSnapshotInsert,
  mapAnalyticsSnapshotRow,
  mapAssetInsert,
  mapAssetRow,
  mapBlogPostInsert,
  mapBlogPostRow,
  mapCampaignInsert,
  mapCampaignRow,
  mapClientInsert,
  mapClientRow,
  mapClientSettingsInsert,
  mapClientSettingsRow,
  mapIntegrationConnectionInsert,
  mapIntegrationConnectionRow,
  mapOperationalTaskInsert,
  mapOperationalTaskRow,
  mapPlannerItemInsert,
  mapPlannerItemRow,
  mapPostInsert,
  mapPostRow,
  mapSyncJobInsert,
  mapSyncJobRow,
  mapWeeklyMetricInsert,
  mapWeeklyMetricRow,
  mapWorkspaceInsert,
  mapWorkspaceMemberInsert,
  mapWorkspaceMemberRow,
  mapWorkspaceRow
} from "@/lib/supabase/mappers";
import type {
  ActivityEvent,
  AnalyticsSnapshot,
  Asset,
  BlogPost,
  Campaign,
  Client,
  ClientSettings,
  IntegrationConnection,
  OperationalTask,
  PlannerItem,
  Post,
  SyncJob,
  WeeklyMetric,
  Workspace,
  WorkspaceMember
} from "@/types";

type CollectionAdapter<T> = {
  isConfigured: boolean;
  load: (clientId: string) => Promise<T[]>;
  save: (clientId: string, items: T[]) => Promise<void>;
};

type EntityAdapter<T> = {
  isConfigured: boolean;
  load: (clientId: string) => Promise<T | null>;
  save: (clientId: string, item: T) => Promise<void>;
};

// Dynamic table sync uses a narrow untyped escape hatch because Supabase's generated
// table-name inference does not compose with these generic replace/delete helpers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabaseOrThrow(): any {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

async function deleteMissingRows(
  table: string,
  scopeColumn: string,
  scopeId: string,
  nextIds: string[]
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabaseOrThrow() as any;
  const { data, error } = await supabase.from(table).select("id").eq(scopeColumn, scopeId);

  if (error) {
    throw error;
  }

  const idsToDelete = (data ?? [])
    .map((row: { id: string }) => String(row.id))
    .filter((id: string) => !nextIds.includes(id));

  if (!idsToDelete.length) {
    return;
  }

  const { error: deleteError } = await supabase.from(table).delete().in("id", idsToDelete);

  if (deleteError) {
    throw deleteError;
  }
}

async function replaceLinks(
  table: string,
  sourceColumn: string,
  sourceIds: string[],
  rows: Record<string, string>[]
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabaseOrThrow() as any;

  if (sourceIds.length) {
    const { error: deleteError } = await supabase.from(table).delete().in(sourceColumn, sourceIds);

    if (deleteError) {
      throw deleteError;
    }
  }

  if (!rows.length) {
    return;
  }

  const { error: insertError } = await supabase.from(table).insert(rows);

  if (insertError) {
    throw insertError;
  }
}

function groupLinks(
  rows: Array<Record<string, string>> | null,
  sourceColumn: string,
  targetColumn: string
) {
  return (rows ?? []).reduce<Record<string, string[]>>((accumulator, row) => {
    const sourceId = row[sourceColumn];
    const targetId = row[targetColumn];

    if (!accumulator[sourceId]) {
      accumulator[sourceId] = [];
    }

    accumulator[sourceId].push(targetId);

    return accumulator;
  }, {});
}

export const clientsAdapter: CollectionAdapter<Client> = {
  isConfigured: hasSupabaseCredentials,
  async load() {
    const supabase = getSupabaseOrThrow();
    const { data, error } = await supabase.from("clients").select("*").order("name");

    if (error) {
      throw error;
    }

    return (data ?? []).map(mapClientRow);
  },
  async save(_, clients) {
    const supabase = getSupabaseOrThrow();
    const nextIds = clients.map((client) => client.id);
    const { data, error } = await supabase.from("clients").select("id");

    if (error) {
      throw error;
    }

    const idsToDelete = (data ?? [])
      .map((row: { id: string }) => String(row.id))
      .filter((id: string) => !nextIds.includes(id));

    if (idsToDelete.length) {
      const { error: deleteError } = await supabase.from("clients").delete().in("id", idsToDelete);

      if (deleteError) {
        throw deleteError;
      }
    }

    if (!clients.length) {
      return;
    }

    const { error: upsertError } = await supabase
      .from("clients")
      .upsert(clients.map(mapClientInsert), { onConflict: "id" });

    if (upsertError) {
      throw upsertError;
    }
  }
};

export const workspaceAdapter: EntityAdapter<Workspace> = {
  isConfigured: hasSupabaseCredentials,
  async load(workspaceId) {
    const supabase = getSupabaseOrThrow();
    const { data, error } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", workspaceId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapWorkspaceRow(data as Parameters<typeof mapWorkspaceRow>[0]) : null;
  },
  async save(_, workspace) {
    const supabase = getSupabaseOrThrow();
    const { error } = await supabase
      .from("workspaces")
      .upsert(mapWorkspaceInsert(workspace), { onConflict: "id" });

    if (error) {
      throw error;
    }
  }
};

export const workspaceMembersAdapter: CollectionAdapter<WorkspaceMember> = {
  isConfigured: hasSupabaseCredentials,
  async load(workspaceId) {
    const supabase = getSupabaseOrThrow();
    const { data, error } = await supabase
      .from("workspace_memberships")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("full_name");

    if (error) {
      throw error;
    }

    return ((data ?? []) as Array<Parameters<typeof mapWorkspaceMemberRow>[0]>).map(mapWorkspaceMemberRow);
  },
  async save(workspaceId, members) {
    const supabase = getSupabaseOrThrow();
    await deleteMissingRows(
      "workspace_memberships",
      "workspace_id",
      workspaceId,
      members.map((member) => member.id)
    );

    if (!members.length) {
      return;
    }

    const { error } = await supabase
      .from("workspace_memberships")
      .upsert(members.map(mapWorkspaceMemberInsert), { onConflict: "id" });

    if (error) {
      throw error;
    }
  }
};

export const clientSettingsAdapter: EntityAdapter<ClientSettings> = {
  isConfigured: hasSupabaseCredentials,
  async load(clientId) {
    const supabase = getSupabaseOrThrow();
    const { data, error } = await supabase
      .from("client_settings")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapClientSettingsRow(data) : null;
  },
  async save(_, settings) {
    const supabase = getSupabaseOrThrow();
    const { error } = await supabase
      .from("client_settings")
      .upsert(mapClientSettingsInsert(settings), { onConflict: "id" });

    if (error) {
      throw error;
    }
  }
};

export const weeklyMetricsAdapter: CollectionAdapter<WeeklyMetric> = {
  isConfigured: hasSupabaseCredentials,
  async load(clientId) {
    const supabase = getSupabaseOrThrow();
    const { data, error } = await supabase
      .from("weekly_metrics")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []).map(mapWeeklyMetricRow);
  },
  async save(clientId, metrics) {
    const supabase = getSupabaseOrThrow();
    await deleteMissingRows("weekly_metrics", "client_id", clientId, metrics.map((metric) => metric.id));

    if (!metrics.length) {
      return;
    }

    const { error } = await supabase
      .from("weekly_metrics")
      .upsert(metrics.map(mapWeeklyMetricInsert), { onConflict: "id" });

    if (error) {
      throw error;
    }
  }
};

export const campaignsAdapter: CollectionAdapter<Campaign> = {
  isConfigured: hasSupabaseCredentials,
  async load(clientId) {
    const supabase = getSupabaseOrThrow();
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("client_id", clientId)
      .order("start_date", { ascending: true });

    if (error) {
      throw error;
    }

    const campaigns = (data ?? []) as Array<Parameters<typeof mapCampaignRow>[0]>;
    const campaignIds = campaigns.map((campaign: Parameters<typeof mapCampaignRow>[0]) => campaign.id);

    if (!campaignIds.length) {
      return [];
    }

    const [postLinks, blogLinks, assetLinks, metricLinks] = await Promise.all([
      supabase.from("campaign_post_links").select("*").in("campaign_id", campaignIds),
      supabase.from("campaign_blog_post_links").select("*").in("campaign_id", campaignIds),
      supabase.from("campaign_asset_links").select("*").in("campaign_id", campaignIds),
      supabase.from("campaign_weekly_metric_links").select("*").in("campaign_id", campaignIds)
    ]);

    if (postLinks.error || blogLinks.error || assetLinks.error || metricLinks.error) {
      throw postLinks.error ?? blogLinks.error ?? assetLinks.error ?? metricLinks.error;
    }

    const postMap = groupLinks(postLinks.data, "campaign_id", "post_id");
    const blogMap = groupLinks(blogLinks.data, "campaign_id", "blog_post_id");
    const assetMap = groupLinks(assetLinks.data, "campaign_id", "asset_id");
    const metricMap = groupLinks(metricLinks.data, "campaign_id", "weekly_metric_id");

    return campaigns.map((campaign: Parameters<typeof mapCampaignRow>[0]) =>
      mapCampaignRow(campaign, {
        linkedPostIds: postMap[campaign.id] ?? [],
        linkedBlogPostIds: blogMap[campaign.id] ?? [],
        linkedAssetIds: assetMap[campaign.id] ?? [],
        linkedWeeklyMetricIds: metricMap[campaign.id] ?? []
      })
    );
  },
  async save(clientId, campaigns) {
    const supabase = getSupabaseOrThrow();
    const campaignIds = campaigns.map((campaign) => campaign.id);
    await deleteMissingRows("campaigns", "client_id", clientId, campaignIds);

    if (campaigns.length) {
      const { error } = await supabase
        .from("campaigns")
        .upsert(campaigns.map(mapCampaignInsert), { onConflict: "id" });

      if (error) {
        throw error;
      }
    }

    await Promise.all([
      replaceLinks(
        "campaign_post_links",
        "campaign_id",
        campaignIds,
        campaigns.flatMap((campaign) =>
          campaign.linkedPostIds.map((postId) => ({ campaign_id: campaign.id, post_id: postId }))
        )
      ),
      replaceLinks(
        "campaign_blog_post_links",
        "campaign_id",
        campaignIds,
        campaigns.flatMap((campaign) =>
          campaign.linkedBlogPostIds.map((blogPostId) => ({
            campaign_id: campaign.id,
            blog_post_id: blogPostId
          }))
        )
      ),
      replaceLinks(
        "campaign_asset_links",
        "campaign_id",
        campaignIds,
        campaigns.flatMap((campaign) =>
          campaign.linkedAssetIds.map((assetId) => ({ campaign_id: campaign.id, asset_id: assetId }))
        )
      ),
      replaceLinks(
        "campaign_weekly_metric_links",
        "campaign_id",
        campaignIds,
        campaigns.flatMap((campaign) =>
          campaign.linkedWeeklyMetricIds.map((weeklyMetricId) => ({
            campaign_id: campaign.id,
            weekly_metric_id: weeklyMetricId
          }))
        )
      )
    ]);
  }
};

export const assetsAdapter: CollectionAdapter<Asset> = {
  isConfigured: hasSupabaseCredentials,
  async load(clientId) {
    const supabase = getSupabaseOrThrow();
    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    const assets = (data ?? []) as Array<Parameters<typeof mapAssetRow>[0]>;
    const assetIds = assets.map((asset: Parameters<typeof mapAssetRow>[0]) => asset.id);

    if (!assetIds.length) {
      return [];
    }

    const { data: links, error: linkError } = await supabase
      .from("campaign_asset_links")
      .select("*")
      .in("asset_id", assetIds);

    if (linkError) {
      throw linkError;
    }

    const campaignMap = groupLinks(links, "asset_id", "campaign_id");

    return assets.map((asset: Parameters<typeof mapAssetRow>[0]) =>
      mapAssetRow(asset, campaignMap[asset.id] ?? [])
    );
  },
  async save(clientId, assets) {
    const supabase = getSupabaseOrThrow();
    const assetIds = assets.map((asset) => asset.id);
    await deleteMissingRows("assets", "client_id", clientId, assetIds);

    if (assets.length) {
      const { error } = await supabase
        .from("assets")
        .upsert(assets.map(mapAssetInsert), { onConflict: "id" });

      if (error) {
        throw error;
      }
    }

    await replaceLinks(
      "campaign_asset_links",
      "asset_id",
      assetIds,
      assets.flatMap((asset) =>
        asset.linkedCampaignIds.map((campaignId) => ({ asset_id: asset.id, campaign_id: campaignId }))
      )
    );
  }
};

export const blogPostsAdapter: CollectionAdapter<BlogPost> = {
  isConfigured: hasSupabaseCredentials,
  async load(clientId) {
    const supabase = getSupabaseOrThrow();
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    const blogPosts = (data ?? []) as Array<Parameters<typeof mapBlogPostRow>[0]>;
    const blogPostIds = blogPosts.map((post: Parameters<typeof mapBlogPostRow>[0]) => post.id);

    if (!blogPostIds.length) {
      return [];
    }

    const { data: links, error: linkError } = await supabase
      .from("blog_assets")
      .select("*")
      .in("blog_post_id", blogPostIds);

    if (linkError) {
      throw linkError;
    }

    const assetMap = groupLinks(links, "blog_post_id", "asset_id");

    return blogPosts.map((post: Parameters<typeof mapBlogPostRow>[0]) =>
      mapBlogPostRow(post, assetMap[post.id] ?? [])
    );
  },
  async save(clientId, blogPosts) {
    const supabase = getSupabaseOrThrow();
    const blogPostIds = blogPosts.map((post) => post.id);
    await deleteMissingRows("blog_posts", "client_id", clientId, blogPostIds);

    if (blogPosts.length) {
      const { error } = await supabase
        .from("blog_posts")
        .upsert(blogPosts.map(mapBlogPostInsert), { onConflict: "id" });

      if (error) {
        throw error;
      }
    }

    await replaceLinks(
      "blog_assets",
      "blog_post_id",
      blogPostIds,
      blogPosts.flatMap((post) =>
        post.assetIds.map((assetId) => ({ blog_post_id: post.id, asset_id: assetId }))
      )
    );
  }
};

export const plannerItemsAdapter: CollectionAdapter<PlannerItem> = {
  isConfigured: hasSupabaseCredentials,
  async load(clientId) {
    const supabase = getSupabaseOrThrow();
    const { data, error } = await supabase
      .from("planner_items")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []).map(mapPlannerItemRow);
  },
  async save(clientId, items) {
    const supabase = getSupabaseOrThrow();
    await deleteMissingRows("planner_items", "client_id", clientId, items.map((item) => item.id));

    if (!items.length) {
      return;
    }

    const { error } = await supabase
      .from("planner_items")
      .upsert(items.map(mapPlannerItemInsert), { onConflict: "id" });

    if (error) {
      throw error;
    }
  }
};

export const postsAdapter: CollectionAdapter<Post> = {
  isConfigured: hasSupabaseCredentials,
  async load(clientId) {
    const supabase = getSupabaseOrThrow();
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("client_id", clientId)
      .order("publish_date", { ascending: true });

    if (error) {
      throw error;
    }

    const posts = (data ?? []) as Array<Parameters<typeof mapPostRow>[0]>;
    const postIds = posts.map((post: Parameters<typeof mapPostRow>[0]) => post.id);

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

    const assetMap = groupLinks(links, "post_id", "asset_id");

    return posts.map((post: Parameters<typeof mapPostRow>[0]) =>
      mapPostRow(post, assetMap[post.id] ?? [])
    );
  },
  async save(clientId, posts) {
    const supabase = getSupabaseOrThrow();
    const postIds = posts.map((post) => post.id);
    await deleteMissingRows("posts", "client_id", clientId, postIds);

    if (posts.length) {
      const { error } = await supabase
        .from("posts")
        .upsert(posts.map(mapPostInsert), { onConflict: "id" });

      if (error) {
        throw error;
      }
    }

    await replaceLinks(
      "post_assets",
      "post_id",
      postIds,
      posts.flatMap((post) => post.assetIds.map((assetId) => ({ post_id: post.id, asset_id: assetId })))
    );
  }
};

export const analyticsSnapshotsAdapter: CollectionAdapter<AnalyticsSnapshot> = {
  isConfigured: hasSupabaseCredentials,
  async load(clientId) {
    const supabase = getSupabaseOrThrow();
    const { data, error } = await supabase
      .from("analytics_snapshots")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []).map(mapAnalyticsSnapshotRow);
  },
  async save(clientId, snapshots) {
    const supabase = getSupabaseOrThrow();
    await deleteMissingRows(
      "analytics_snapshots",
      "client_id",
      clientId,
      snapshots.map((snapshot) => snapshot.id)
    );

    if (!snapshots.length) {
      return;
    }

    const { error } = await supabase
      .from("analytics_snapshots")
      .upsert(snapshots.map(mapAnalyticsSnapshotInsert), { onConflict: "id" });

    if (error) {
      throw error;
    }
  }
};

export const integrationConnectionsAdapter: CollectionAdapter<IntegrationConnection> = {
  isConfigured: hasSupabaseCredentials,
  async load(clientId) {
    const supabase = getSupabaseOrThrow();
    const { data, error } = await supabase
      .from("integration_connections")
      .select("*")
      .eq("client_id", clientId)
      .order("provider");

    if (error) {
      throw error;
    }

    return (data ?? []).map(mapIntegrationConnectionRow);
  },
  async save(clientId, connections) {
    const supabase = getSupabaseOrThrow();
    await deleteMissingRows(
      "integration_connections",
      "client_id",
      clientId,
      connections.map((connection) => connection.id)
    );

    if (!connections.length) {
      return;
    }

    const { error } = await supabase
      .from("integration_connections")
      .upsert(connections.map(mapIntegrationConnectionInsert), { onConflict: "id" });

    if (error) {
      throw error;
    }
  }
};

export const syncJobsAdapter: CollectionAdapter<SyncJob> = {
  isConfigured: hasSupabaseCredentials,
  async load(clientId) {
    const supabase = getSupabaseOrThrow();
    const { data, error } = await supabase
      .from("sync_jobs")
      .select("*")
      .eq("client_id", clientId)
      .order("provider");

    if (error) {
      throw error;
    }

    return (data ?? []).map(mapSyncJobRow);
  },
  async save(clientId, jobs) {
    const supabase = getSupabaseOrThrow();
    await deleteMissingRows("sync_jobs", "client_id", clientId, jobs.map((job) => job.id));

    if (!jobs.length) {
      return;
    }

    const { error } = await supabase
      .from("sync_jobs")
      .upsert(jobs.map(mapSyncJobInsert), { onConflict: "id" });

    if (error) {
      throw error;
    }
  }
};

export const operationalTasksAdapter: CollectionAdapter<OperationalTask> = {
  isConfigured: hasSupabaseCredentials,
  async load(workspaceId) {
    const supabase = getSupabaseOrThrow();
    const { data, error } = await supabase
      .from("operational_tasks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return ((data ?? []) as Array<Parameters<typeof mapOperationalTaskRow>[0]>).map(
      mapOperationalTaskRow
    );
  },
  async save(workspaceId, tasks) {
    const supabase = getSupabaseOrThrow();
    await deleteMissingRows(
      "operational_tasks",
      "workspace_id",
      workspaceId,
      tasks.map((task) => task.id)
    );

    if (!tasks.length) {
      return;
    }

    const { error } = await supabase
      .from("operational_tasks")
      .upsert(tasks.map(mapOperationalTaskInsert), { onConflict: "id" });

    if (error) {
      throw error;
    }
  }
};

export const activityEventsAdapter: CollectionAdapter<ActivityEvent> = {
  isConfigured: hasSupabaseCredentials,
  async load(workspaceId) {
    const supabase = getSupabaseOrThrow();
    const { data, error } = await supabase
      .from("activity_events")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return ((data ?? []) as Array<Parameters<typeof mapActivityEventRow>[0]>).map(
      mapActivityEventRow
    );
  },
  async save(workspaceId, events) {
    const supabase = getSupabaseOrThrow();
    await deleteMissingRows(
      "activity_events",
      "workspace_id",
      workspaceId,
      events.map((event) => event.id)
    );

    if (!events.length) {
      return;
    }

    const { error } = await supabase
      .from("activity_events")
      .upsert(events.map(mapActivityEventInsert), { onConflict: "id" });

    if (error) {
      throw error;
    }
  }
};
