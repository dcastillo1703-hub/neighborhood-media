import { meamaClient, seededCampaigns } from "@/data/seed";
import { archiveCampaignRecord, isArchivedCampaign } from "@/lib/domain/campaign-archive";
import { mapActivityEventInsert, mapActivityEventRow, mapCampaignInsert, mapCampaignRow } from "@/lib/supabase/mappers";
import type { ActivityEvent, Campaign } from "@/types";

type CampaignSnapshot = {
  campaigns: Campaign[];
};

const campaignStore = new Map<string, CampaignSnapshot>();

function getClientSnapshot(clientId: string) {
  const existing = campaignStore.get(clientId);

  if (existing) {
    return existing;
  }

  const seededSnapshot: CampaignSnapshot = {
    campaigns: seededCampaigns
      .filter((campaign) => campaign.clientId === clientId)
      .map((campaign) => ({ ...campaign }))
  };

  campaignStore.set(clientId, seededSnapshot);

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

async function recordCampaignEvent(event: ActivityEvent) {
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
    console.error("Failed to record campaign activity event.", error);
    return event;
  }
}

async function replaceCampaignLinks(campaign: Campaign) {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (!supabase) {
    return;
  }

  await Promise.all([
    supabase.from("campaign_post_links").delete().eq("campaign_id", campaign.id),
    supabase.from("campaign_blog_post_links").delete().eq("campaign_id", campaign.id),
    supabase.from("campaign_asset_links").delete().eq("campaign_id", campaign.id),
    supabase.from("campaign_weekly_metric_links").delete().eq("campaign_id", campaign.id)
  ]);

  const linkInserts = [
    campaign.linkedPostIds.length
      ? supabase.from("campaign_post_links").insert(
          campaign.linkedPostIds.map((postId) => ({
            campaign_id: campaign.id,
            post_id: postId
          }))
        )
      : null,
    campaign.linkedBlogPostIds.length
      ? supabase.from("campaign_blog_post_links").insert(
          campaign.linkedBlogPostIds.map((blogPostId) => ({
            campaign_id: campaign.id,
            blog_post_id: blogPostId
          }))
        )
      : null,
    campaign.linkedAssetIds.length
      ? supabase.from("campaign_asset_links").insert(
          campaign.linkedAssetIds.map((assetId) => ({
            campaign_id: campaign.id,
            asset_id: assetId
          }))
        )
      : null,
    campaign.linkedWeeklyMetricIds.length
      ? supabase.from("campaign_weekly_metric_links").insert(
          campaign.linkedWeeklyMetricIds.map((weeklyMetricId) => ({
            campaign_id: campaign.id,
            weekly_metric_id: weeklyMetricId
          }))
        )
      : null
  ].filter(Boolean);

  const results = await Promise.all(linkInserts);
  const failed = results.find((result) => result?.error);

  if (failed?.error) {
    throw failed.error;
  }
}

export async function listClientCampaigns(clientId: string) {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("client_id", clientId)
      .order("start_date", { ascending: true });

    if (error) {
      throw error;
    }

    const campaignRows = data ?? [];
    const campaignIds = campaignRows.map((campaign: { id: string }) => campaign.id);

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

    const postMap = new Map<string, string[]>();
    const blogMap = new Map<string, string[]>();
    const assetMap = new Map<string, string[]>();
    const metricMap = new Map<string, string[]>();

    (postLinks.data ?? []).forEach((row: { campaign_id: string; post_id: string }) => {
      postMap.set(row.campaign_id, [...(postMap.get(row.campaign_id) ?? []), row.post_id]);
    });
    (blogLinks.data ?? []).forEach((row: { campaign_id: string; blog_post_id: string }) => {
      blogMap.set(row.campaign_id, [...(blogMap.get(row.campaign_id) ?? []), row.blog_post_id]);
    });
    (assetLinks.data ?? []).forEach((row: { campaign_id: string; asset_id: string }) => {
      assetMap.set(row.campaign_id, [...(assetMap.get(row.campaign_id) ?? []), row.asset_id]);
    });
    (metricLinks.data ?? []).forEach((row: { campaign_id: string; weekly_metric_id: string }) => {
      metricMap.set(row.campaign_id, [
        ...(metricMap.get(row.campaign_id) ?? []),
        row.weekly_metric_id
      ]);
    });

    return campaignRows
      .map((campaign: Parameters<typeof mapCampaignRow>[0]) =>
        mapCampaignRow(campaign, {
          linkedPostIds: postMap.get(campaign.id) ?? [],
          linkedBlogPostIds: blogMap.get(campaign.id) ?? [],
          linkedAssetIds: assetMap.get(campaign.id) ?? [],
          linkedWeeklyMetricIds: metricMap.get(campaign.id) ?? []
        })
      )
      .filter((campaign: Campaign) => !isArchivedCampaign(campaign));
  }

  return getClientSnapshot(clientId).campaigns.filter((campaign) => !isArchivedCampaign(campaign));
}

export async function createCampaign(campaign: Campaign) {
  const { workspaceId, clientName } = await getClientWorkspace(campaign.clientId);
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data, error } = await supabase
      .from("campaigns")
      .upsert(mapCampaignInsert(campaign), { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    await replaceCampaignLinks(campaign);

    const event = await recordCampaignEvent({
      id: `evt-${Date.now()}`,
      workspaceId,
      clientId: campaign.clientId,
      actorName: "Workspace operator",
      actionLabel: "created",
      subjectType: "campaign",
      subjectName: campaign.name,
      detail: `${campaign.name} created for ${clientName}.`,
      createdAt: new Date().toISOString()
    });

    return {
      campaign: mapCampaignRow(data as Parameters<typeof mapCampaignRow>[0], {
        linkedPostIds: campaign.linkedPostIds,
        linkedBlogPostIds: campaign.linkedBlogPostIds,
        linkedAssetIds: campaign.linkedAssetIds,
        linkedWeeklyMetricIds: campaign.linkedWeeklyMetricIds
      }),
      event
    };
  }

  const snapshot = getClientSnapshot(campaign.clientId);
  snapshot.campaigns = [...snapshot.campaigns, campaign];

  const event: ActivityEvent = {
    id: `evt-${Date.now()}`,
    workspaceId,
    clientId: campaign.clientId,
    actorName: "Workspace operator",
    actionLabel: "created",
    subjectType: "campaign",
    subjectName: campaign.name,
    detail: `${campaign.name} created for ${clientName}.`,
    createdAt: new Date().toISOString()
  };

  return {
    campaign,
    event
  };
}

export async function archiveCampaign(clientId: string, campaignId: string) {
  const campaigns = await listClientCampaigns(clientId);
  const existing = campaigns.find((campaign: Campaign) => campaign.id === campaignId);

  if (!existing) {
    throw new Error("Campaign not found.");
  }

  const archived = archiveCampaignRecord(existing);
  const { workspaceId, clientName } = await getClientWorkspace(clientId);
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { error } = await supabase
      .from("campaigns")
      .update({
        status: archived.status,
        notes: archived.notes
      })
      .eq("id", campaignId)
      .eq("client_id", clientId);

    if (error) {
      throw error;
    }

    const event = await recordCampaignEvent({
      id: `evt-${Date.now()}`,
      workspaceId,
      clientId,
      actorName: "Workspace operator",
      actionLabel: "archived",
      subjectType: "campaign",
      subjectName: existing.name,
      detail: `${existing.name} archived for ${clientName}.`,
      createdAt: new Date().toISOString()
    });

    return {
      campaignId,
      event
    };
  }

  const snapshot = getClientSnapshot(clientId);
  snapshot.campaigns = snapshot.campaigns.map((campaign) =>
    campaign.id === campaignId ? archived : campaign
  );

  const event: ActivityEvent = {
    id: `evt-${Date.now()}`,
    workspaceId,
    clientId,
    actorName: "Workspace operator",
    actionLabel: "archived",
    subjectType: "campaign",
    subjectName: existing.name,
    detail: `${existing.name} archived for ${clientName}.`,
    createdAt: new Date().toISOString()
  };

  return {
    campaignId,
    event
  };
}
