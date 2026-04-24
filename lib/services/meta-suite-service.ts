import { seededAnalyticsSnapshots, seededPosts } from "@/data/seed";
import {
  buildMetaSetupState,
  getMetaBusinessSuiteConfigStatus
} from "@/lib/integrations/meta";
import { updateIntegrationConnection, listIntegrations } from "@/lib/services/integrations-service";
import { getStoredMetaCredentialSecret } from "@/lib/services/meta-auth-service";
import { listPublishJobs } from "@/lib/services/publishing-service";
import {
  mapAnalyticsSnapshotRow,
  mapAnalyticsSnapshotInsert,
  mapIntegrationConnectionInsert,
  mapIntegrationConnectionRow,
  mapPostRow
} from "@/lib/supabase/mappers";
import type {
  AnalyticsSnapshot,
  IntegrationConnection,
  MetaBusinessChannelSummary,
  MetaBusinessSuiteSummary,
  Post,
  PublishJob
} from "@/types";

type FacebookPostInsight = {
  id: string;
  message?: string;
  permalink_url?: string;
  created_time?: string;
  insights?: {
    data?: Array<{
      name?: string;
      values?: Array<{
        value?: unknown;
      }>;
    }>;
  };
};

type FacebookPageInsight = {
  name?: string;
  period?: string;
  values?: Array<{
    value?: unknown;
  }>;
};

type FacebookPageProfile = {
  id: string;
  name?: string;
  followers_count?: number;
  fan_count?: number;
};

async function getSupabaseServerClient() {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await serverModule.getSupabaseServerClient()) as any;
}

async function listClientAnalyticsSnapshots(clientId: string) {
  const supabase = await getSupabaseServerClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("analytics_snapshots")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []).map((row: Parameters<typeof mapAnalyticsSnapshotRow>[0]) =>
      mapAnalyticsSnapshotRow(row)
    );
  }

  return seededAnalyticsSnapshots.filter((snapshot) => snapshot.clientId === clientId);
}

async function listClientPosts(clientId: string) {
  const supabase = await getSupabaseServerClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("posts")
      .select("*, post_assets(asset_id)")
      .eq("client_id", clientId)
      .order("publish_date", { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []).map(
      (
        row: Parameters<typeof mapPostRow>[0] & {
          post_assets?: Array<{ asset_id: string }>;
        }
      ) => mapPostRow(row, (row.post_assets ?? []).map((asset) => asset.asset_id))
    );
  }

  return seededPosts.filter((post) => post.clientId === clientId);
}

async function ensureMetaConnection(
  clientId: string,
  provider: "facebook" | "instagram"
): Promise<IntegrationConnection> {
  const supabase = await getSupabaseServerClient();
  const scaffold: IntegrationConnection = {
    id: `ic-${clientId}-${provider}`,
    clientId,
    provider,
    accountLabel: provider === "facebook" ? "Meta Facebook Page" : "Meta Instagram account",
    status: "Scaffolded",
    notes:
      provider === "facebook"
        ? "Ready for Meta Page connection and publish permissions."
        : "Ready for Instagram business account connection.",
    setup: {
      authStatus: "unconfigured",
      ...buildMetaSetupState(provider, clientId)
    }
  };

  if (!supabase) {
    return scaffold;
  }

  const { data, error } = await supabase
    .from("integration_connections")
    .upsert(mapIntegrationConnectionInsert(scaffold), { onConflict: "id" })
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("Unable to create Meta connection scaffold.");
  }

  return mapIntegrationConnectionRow(data as Parameters<typeof mapIntegrationConnectionRow>[0]);
}

function summarizeMetaChannel(
  clientId: string,
  provider: "facebook" | "instagram",
  connection: IntegrationConnection | undefined,
  analyticsSnapshots: AnalyticsSnapshot[],
  posts: Post[],
  publishJobs: PublishJob[],
  appUrl?: string
): MetaBusinessChannelSummary {
  const source = provider === "facebook" ? "Facebook" : "Instagram";
  const channelSnapshots = analyticsSnapshots.filter((snapshot) => snapshot.source === source);
  const channelPosts = posts.filter((post) => post.platform === source);
  const channelJobs = publishJobs.filter((job: PublishJob) => job.provider === provider);
  const latestSnapshot = channelSnapshots[0];
  const fallbackSetup = buildMetaSetupState(provider, clientId, connection, appUrl);

  return {
    provider,
    accountLabel:
      connection?.setup?.connectedAssetLabel ?? connection?.accountLabel ?? `Meta ${source}`,
    status: connection?.status ?? "Needs Credentials",
    lastSyncAt: connection?.lastSyncAt,
    authStatus: connection?.setup?.authStatus ?? fallbackSetup.authStatus ?? "unconfigured",
    tokenStatus: connection?.setup?.tokenStatus ?? fallbackSetup.tokenStatus ?? "missing",
    authorizationUrl:
      connection?.setup?.authorizationUrl ?? fallbackSetup.authorizationUrl,
    externalAccountId: connection?.setup?.externalAccountId,
    connectedAssetLabel: connection?.setup?.connectedAssetLabel,
    nextAction: connection?.setup?.nextAction ?? fallbackSetup.nextAction,
    scopeSummary: connection?.setup?.scopeSummary ?? fallbackSetup.scopeSummary,
    capabilities:
      connection?.setup?.capabilities ?? fallbackSetup.capabilities ?? [],
    availableAssets: connection?.setup?.availableAssets,
    scheduledPosts: channelPosts.filter((post) => post.status === "Scheduled").length,
    queuedPublishJobs: channelJobs.filter((job: PublishJob) =>
      ["Queued", "Processing", "Blocked"].includes(job.status)
    ).length,
    publishedJobs: channelJobs.filter((job: PublishJob) => job.status === "Published").length,
    impressions: channelSnapshots.reduce((sum, snapshot) => sum + snapshot.impressions, 0),
    clicks: channelSnapshots.reduce((sum, snapshot) => sum + snapshot.clicks, 0),
    conversions: channelSnapshots.reduce((sum, snapshot) => sum + snapshot.conversions, 0),
    attributedRevenue: channelSnapshots.reduce(
      (sum, snapshot) => sum + snapshot.attributedRevenue,
      0
    ),
    attributedCovers: channelSnapshots.reduce(
      (sum, snapshot) => sum + snapshot.attributedCovers,
      0
    ),
    attributedTables: channelSnapshots.reduce(
      (sum, snapshot) => sum + snapshot.attributedTables,
      0
    ),
    latestPeriodLabel: latestSnapshot?.periodLabel
  };
}

function parseGraphApiError(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }

  return fallback;
}

async function fetchFacebookPagePostCollection(
  pageId: string,
  accessToken: string,
  collection: "published_posts" | "posts" | "feed"
) {
  const params = new URLSearchParams({
    fields:
      "id,message,permalink_url,created_time,insights.metric(post_impressions,post_engaged_users,post_clicks_by_type_unique)",
    limit: "10",
    access_token: accessToken
  });
  const response = await fetch(
    `https://graph.facebook.com/v23.0/${pageId}/${collection}?${params.toString()}`,
    {
      method: "GET",
      cache: "no-store"
    }
  );
  const payload = (await response.json()) as { data?: FacebookPostInsight[]; error?: unknown };

  if (!response.ok) {
    throw new Error(parseGraphApiError(payload, "Facebook post sync failed."));
  }

  return payload.data ?? [];
}

async function fetchFacebookPagePosts(pageId: string, accessToken: string) {
  const collections: Array<"published_posts" | "posts" | "feed"> = [
    "published_posts",
    "posts",
    "feed"
  ];
  const responses = await Promise.all(
    collections.map((collection) =>
      fetchFacebookPagePostCollection(pageId, accessToken, collection).catch(() => [])
    )
  );

  const uniquePosts = new Map<string, FacebookPostInsight>();

  for (const post of responses.flat()) {
    if (!uniquePosts.has(post.id)) {
      uniquePosts.set(post.id, post);
    }
  }

  return [...uniquePosts.values()].sort((left, right) => {
    const leftTime = left.created_time ? new Date(left.created_time).getTime() : 0;
    const rightTime = right.created_time ? new Date(right.created_time).getTime() : 0;
    return rightTime - leftTime;
  });
}

async function fetchFacebookPageInsightMetric(
  pageId: string,
  accessToken: string,
  metricName: string
) {
  const params = new URLSearchParams({
    metric: metricName,
    access_token: accessToken
  });
  const response = await fetch(
    `https://graph.facebook.com/v23.0/${pageId}/insights?${params.toString()}`,
    {
      method: "GET",
      cache: "no-store"
    }
  );
  const payload = (await response.json()) as { data?: FacebookPageInsight[]; error?: unknown };

  if (!response.ok) {
    return [];
  }

  return payload.data ?? [];
}

async function fetchFacebookPageInsights(pageId: string, accessToken: string) {
  const metricCandidates = [
    "views",
    "page_views_total",
    "page_impressions",
    "page_consumptions",
    "page_cta_clicks_logged_in_unique",
    "page_cta_clicks_total",
    "page_post_engagements",
    "page_engaged_users"
  ];

  const responses = await Promise.all(
    metricCandidates.map((metricName) =>
      fetchFacebookPageInsightMetric(pageId, accessToken, metricName)
    )
  );

  return responses.flat();
}

async function fetchFacebookPageProfile(pageId: string, accessToken: string) {
  const params = new URLSearchParams({
    fields: "id,name,followers_count,fan_count",
    access_token: accessToken
  });
  const response = await fetch(
    `https://graph.facebook.com/v23.0/${pageId}?${params.toString()}`,
    {
      method: "GET",
      cache: "no-store"
    }
  );
  const payload = (await response.json()) as FacebookPageProfile & { error?: unknown };

  if (!response.ok) {
    throw new Error(parseGraphApiError(payload, "Facebook page profile sync failed."));
  }

  return payload;
}

function readInsightMetric(post: FacebookPostInsight, metricName: string) {
  const insight = post.insights?.data?.find((item) => item.name === metricName);
  const value = insight?.values?.[0]?.value;

  if (typeof value === "number") {
    return value;
  }

  if (value && typeof value === "object") {
    return Object.values(value).reduce(
      (sum, entry) => sum + (typeof entry === "number" ? entry : 0),
      0
    );
  }

  return 0;
}

function readPageInsightMetric(insights: FacebookPageInsight[], metricName: string) {
  const insight = insights.find((item) => item.name === metricName);

  if (!insight?.values?.length) {
    return 0;
  }

  return insight.values.reduce((sum, entry) => {
    const value = entry.value;

    if (typeof value === "number") {
      return sum + value;
    }

    if (value && typeof value === "object") {
      return (
        sum +
        Object.values(value).reduce(
          (nestedSum, nestedValue) =>
            nestedSum + (typeof nestedValue === "number" ? nestedValue : 0),
          0
        )
      );
    }

    return sum;
  }, 0);
}

function readFirstAvailablePageInsightMetric(
  insights: FacebookPageInsight[],
  metricNames: string[]
) {
  for (const metricName of metricNames) {
    const value = readPageInsightMetric(insights, metricName);

    if (value > 0) {
      return value;
    }
  }

  return 0;
}

function inferPageInsightsLabel(insights: FacebookPageInsight[]) {
  const periods = Array.from(
    new Set(insights.map((insight) => insight.period).filter((period): period is string => Boolean(period)))
  );

  if (!periods.length) {
    return "Facebook Page insights";
  }

  return `Facebook Page insights · ${periods.join(", ")}`;
}

function sumPostMetric(posts: FacebookPostInsight[], metricName: string) {
  return posts.reduce((sum, post) => sum + readInsightMetric(post, metricName), 0);
}

export async function syncMetaInsights(
  clientId: string,
  provider: "facebook" | "instagram"
) {
  if (provider !== "facebook") {
    throw new Error("Only Facebook insights sync is available right now.");
  }

  const [secret, { connections }] = await Promise.all([
    getStoredMetaCredentialSecret(clientId, provider),
    listIntegrations(clientId)
  ]);

  if (!secret?.pageId) {
    throw new Error("Connect Facebook first before syncing insights.");
  }

  const accessToken = secret.pageAccessToken ?? secret.longLivedAccessToken ?? secret.userAccessToken;

  if (!accessToken) {
    throw new Error("No Facebook access token is stored yet. Reconnect Facebook first.");
  }

  const [pageProfile, pageInsights] = await Promise.all([
    fetchFacebookPageProfile(secret.pageId, accessToken),
    fetchFacebookPageInsights(secret.pageId, accessToken)
  ]);
  let posts: FacebookPostInsight[] = [];

  try {
    posts = await fetchFacebookPagePosts(secret.pageId, accessToken);
  } catch {
    posts = [];
  }

  const postImpressions = sumPostMetric(posts, "post_impressions");
  const postClicks = sumPostMetric(posts, "post_clicks_by_type_unique");
  const postEngagements = sumPostMetric(posts, "post_engaged_users");
  const pageFollowers =
    (typeof pageProfile.followers_count === "number" ? pageProfile.followers_count : 0) ||
    (typeof pageProfile.fan_count === "number" ? pageProfile.fan_count : 0);
  const impressions =
    readFirstAvailablePageInsightMetric(pageInsights, [
    "views",
    "page_views_total",
    "page_impressions"
  ]) ||
    postImpressions ||
    pageFollowers;
  const clicks =
    readFirstAvailablePageInsightMetric(pageInsights, [
    "page_consumptions",
    "page_cta_clicks_logged_in_unique",
    "page_cta_clicks_total"
  ]) ||
    postClicks;
  const engagements =
    readFirstAvailablePageInsightMetric(pageInsights, [
    "page_post_engagements",
    "page_engaged_users"
  ]) ||
    postEngagements;
  const topPost = [...posts].sort(
    (left, right) =>
      readInsightMetric(right, "post_impressions") - readInsightMetric(left, "post_impressions")
  )[0];
  const snapshot: AnalyticsSnapshot = {
    id: `meta-facebook-sync-${clientId}`,
    clientId,
    source: "Facebook",
    periodLabel: pageInsights.length
      ? inferPageInsightsLabel(pageInsights)
      : `Facebook Page summary${pageFollowers ? ` · ${pageFollowers} followers` : ""}`,
    impressions,
    clicks,
    conversions: engagements,
    attributedRevenue: 0,
    attributedCovers: 0,
    attributedTables: 0,
    createdAt: new Date().toISOString()
  };

  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase is required for live Facebook sync.");
  }

  const { error: snapshotError } = await supabase
    .from("analytics_snapshots")
    .upsert(mapAnalyticsSnapshotInsert(snapshot), { onConflict: "id" });

  if (snapshotError) {
    throw snapshotError;
  }

  const connection = (connections as IntegrationConnection[]).find(
    (entry) => entry.provider === provider
  );

  if (connection) {
    await updateIntegrationConnection(clientId, connection.id, {
      ...connection,
      status: "Ready",
      accountLabel: secret.pageName ?? pageProfile.name ?? connection.accountLabel,
      lastSyncAt: snapshot.createdAt,
      setup: {
        ...connection.setup,
        authStatus: "connected",
        tokenStatus: "ready",
        nextAction: topPost?.message
          ? `Top Facebook content synced: ${topPost.message.slice(0, 96)}`
          : `Facebook synced successfully. Impressions: ${impressions}, clicks: ${clicks}, engagement: ${engagements}.`,
        lastCheckedAt: snapshot.createdAt
      }
    });
  }

  return {
    provider,
    syncedAt: snapshot.createdAt,
    snapshot,
    postCount: posts.length,
    topPost: topPost?.message ?? topPost?.permalink_url ?? null,
    pageName: secret.pageName ?? pageProfile.name ?? connection?.accountLabel ?? "Facebook Page"
  };
}

export async function getMetaBusinessSuiteSummary(
  clientId: string,
  appUrl?: string
): Promise<MetaBusinessSuiteSummary> {
  const [{ connections }, analyticsSnapshots, posts, publishJobs] = await Promise.all([
    listIntegrations(clientId),
    listClientAnalyticsSnapshots(clientId),
    listClientPosts(clientId),
    listPublishJobs(clientId)
  ]);
  const typedConnections = connections as IntegrationConnection[];

  const channels = [
    summarizeMetaChannel(
      clientId,
      "facebook",
      typedConnections.find(
        (connection: IntegrationConnection) => connection.provider === "facebook"
      ),
      analyticsSnapshots,
      posts,
      publishJobs,
      appUrl
    ),
    summarizeMetaChannel(
      clientId,
      "instagram",
      typedConnections.find(
        (connection: IntegrationConnection) => connection.provider === "instagram"
      ),
      analyticsSnapshots,
      posts,
      publishJobs,
      appUrl
    )
  ];
  const configStatus = getMetaBusinessSuiteConfigStatus(appUrl);
  const facebookConnected = channels.some(
    (channel) => channel.provider === "facebook" && channel.authStatus === "connected"
  );
  const instagramConnected = channels.some(
    (channel) => channel.provider === "instagram" && channel.authStatus === "connected"
  );

  return {
    clientId,
    readyToConnect: configStatus.ready,
    configStatus,
    connectedChannels: channels.filter((channel) => channel.authStatus === "connected").length,
    channels,
    totalImpressions: channels.reduce((sum, channel) => sum + channel.impressions, 0),
    totalClicks: channels.reduce((sum, channel) => sum + channel.clicks, 0),
    totalConversions: channels.reduce((sum, channel) => sum + channel.conversions, 0),
    totalAttributedRevenue: channels.reduce(
      (sum, channel) => sum + channel.attributedRevenue,
      0
    ),
    totalAttributedCovers: channels.reduce((sum, channel) => sum + channel.attributedCovers, 0),
    totalAttributedTables: channels.reduce((sum, channel) => sum + channel.attributedTables, 0),
    totalScheduledPosts: channels.reduce((sum, channel) => sum + channel.scheduledPosts, 0),
    totalQueuedPublishJobs: channels.reduce(
      (sum, channel) => sum + channel.queuedPublishJobs,
      0
    ),
    totalPublishedJobs: channels.reduce((sum, channel) => sum + channel.publishedJobs, 0),
    highlights: [
      configStatus.ready
        ? facebookConnected
          ? instagramConnected
            ? "Facebook and Instagram are both connected through Meta Business Suite."
            : "Facebook is connected. Instagram can be added later once the professional account and Page connection are ready."
          : "Meta app credentials are configured. Connect Facebook first, then add Instagram later if needed."
        : configStatus.nextAction,
      channels.some((channel) => channel.scheduledPosts > 0)
        ? "Scheduled Meta content is already flowing through the publish queue."
        : "There are no Facebook or Instagram posts scheduled yet.",
      channels.some((channel) => channel.impressions > 0)
        ? "Meta reporting is already landing in the analytics layer and can be expanded into a richer digest."
        : "No Meta analytics snapshots are stored yet, so the digest is waiting on sync."
    ]
  };
}

export async function beginMetaBusinessConnection(
  clientId: string,
  provider: "facebook" | "instagram",
  appUrl?: string
) {
  const { connections } = await listIntegrations(clientId);
  const typedConnections = connections as IntegrationConnection[];
  const existingConnection = typedConnections.find(
    (entry: IntegrationConnection) => entry.provider === provider
  );
  const connection = existingConnection ?? (await ensureMetaConnection(clientId, provider));

  const setup = buildMetaSetupState(provider, clientId, connection, appUrl);
  const updatedConnection = await updateIntegrationConnection(clientId, connection.id, {
    status: setup.authorizationUrl ? "Scaffolded" : "Needs Credentials",
    setup: {
      ...connection.setup,
      ...setup,
      authStatus: setup.authStatus ?? connection.setup?.authStatus ?? "unconfigured",
      lastCheckedAt: new Date().toISOString()
    }
  });

  return {
    connection: updatedConnection,
    authorizationUrl: updatedConnection.setup?.authorizationUrl ?? null
  };
}
