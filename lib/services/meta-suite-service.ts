import { seededAnalyticsSnapshots, seededPosts } from "@/data/seed";
import {
  buildMetaSetupState,
  getMetaBusinessSuiteConfigStatus
} from "@/lib/integrations/meta";
import { updateIntegrationConnection, listIntegrations } from "@/lib/services/integrations-service";
import { listPublishJobs } from "@/lib/services/publishing-service";
import { mapAnalyticsSnapshotRow, mapPostRow } from "@/lib/supabase/mappers";
import type {
  AnalyticsSnapshot,
  IntegrationConnection,
  MetaBusinessChannelSummary,
  MetaBusinessSuiteSummary,
  Post,
  PublishJob
} from "@/types";

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

function summarizeMetaChannel(
  provider: "facebook" | "instagram",
  connection: IntegrationConnection | undefined,
  analyticsSnapshots: AnalyticsSnapshot[],
  posts: Post[],
  publishJobs: PublishJob[]
): MetaBusinessChannelSummary {
  const source = provider === "facebook" ? "Facebook" : "Instagram";
  const channelSnapshots = analyticsSnapshots.filter((snapshot) => snapshot.source === source);
  const channelPosts = posts.filter((post) => post.platform === source);
  const channelJobs = publishJobs.filter((job: PublishJob) => job.provider === provider);
  const latestSnapshot = channelSnapshots[0];
  const fallbackSetup = buildMetaSetupState(provider, connection?.clientId ?? "", connection);

  return {
    provider,
    accountLabel:
      connection?.setup?.connectedAssetLabel ?? connection?.accountLabel ?? `Meta ${source}`,
    status: connection?.status ?? "Needs Credentials",
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

export async function getMetaBusinessSuiteSummary(
  clientId: string
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
      "facebook",
      typedConnections.find(
        (connection: IntegrationConnection) => connection.provider === "facebook"
      ),
      analyticsSnapshots,
      posts,
      publishJobs
    ),
    summarizeMetaChannel(
      "instagram",
      typedConnections.find(
        (connection: IntegrationConnection) => connection.provider === "instagram"
      ),
      analyticsSnapshots,
      posts,
      publishJobs
    )
  ];
  const configStatus = getMetaBusinessSuiteConfigStatus();
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
  provider: "facebook" | "instagram"
) {
  const { connections } = await listIntegrations(clientId);
  const typedConnections = connections as IntegrationConnection[];
  const connection = typedConnections.find(
    (entry: IntegrationConnection) => entry.provider === provider
  );

  if (!connection) {
    throw new Error("Meta connection not found for this client.");
  }

  const setup = buildMetaSetupState(provider, clientId, connection);
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
