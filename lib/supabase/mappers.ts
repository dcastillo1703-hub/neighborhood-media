import type {
  ApprovalRequest,
  ActivityEvent,
  AnalyticsSnapshot,
  Asset,
  BlogPost,
  Campaign,
  CampaignGoal,
  CampaignRoiSnapshot,
  Client,
  ClientHomeCard,
  ClientHomeConfig,
  ClientHomeSection,
  ClientMembership,
  ClientPreferences,
  ClientSettings,
  IntegrationConnection,
  ManualMetaChannelPerformance,
  ManualMetaPerformance,
  OperationalTask,
  PlannerItem,
  Post,
  PublishJob,
  SyncJob,
  WeeklyMetric,
  Workspace,
  WorkspaceMember
} from "@/types";
import type { Database } from "@/lib/supabase/database";
import { composeIntegrationNotes, parseIntegrationNotes } from "@/lib/domain/integration-notes";
import { decodePostContent, decodeTaskDetail, encodePostContent, encodeTaskDetail } from "@/lib/domain/execution-metadata";

type TableRow<Name extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][Name]["Row"];
type TableInsert<Name extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][Name]["Insert"];

export function mapClientRow(row: TableRow<"clients">): Client {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    segment: row.segment,
    location: row.location ?? "",
    status: row.status as Client["status"]
  };
}

export function mapClientInsert(client: Client): TableInsert<"clients"> {
  return {
    id: client.id,
    workspace_id: client.workspaceId ?? "",
    name: client.name,
    segment: client.segment,
    location: client.location,
    status: client.status
  };
}

export function mapWorkspaceRow(row: TableRow<"workspaces">): Workspace {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan: row.plan as Workspace["plan"],
    seatCount: row.seat_count
  };
}

export function mapWorkspaceInsert(workspace: Workspace): TableInsert<"workspaces"> {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    plan: workspace.plan,
    seat_count: workspace.seatCount
  };
}

export function mapWorkspaceMemberRow(
  row: TableRow<"workspace_memberships">
): WorkspaceMember {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id ?? "",
    fullName: row.full_name,
    email: row.email,
    role: row.role as WorkspaceMember["role"],
    status: row.status as WorkspaceMember["status"]
  };
}

export function mapWorkspaceMemberInsert(
  member: WorkspaceMember
): TableInsert<"workspace_memberships"> {
  return {
    id: member.id,
    workspace_id: member.workspaceId,
    user_id: member.userId || null,
    full_name: member.fullName,
    email: member.email,
    role: member.role,
    status: member.status
  };
}

export function mapClientMembershipRow(
  row: TableRow<"client_memberships">
): ClientMembership {
  return {
    id: row.id,
    clientId: row.client_id,
    userId: row.user_id,
    role: row.role as ClientMembership["role"],
    createdAt: row.created_at
  };
}

export function mapClientMembershipInsert(
  membership: ClientMembership
): TableInsert<"client_memberships"> {
  return {
    id: membership.id,
    client_id: membership.clientId,
    user_id: membership.userId,
    role: membership.role,
    created_at: membership.createdAt ?? new Date().toISOString()
  };
}

export function mapClientSettingsRow(row: TableRow<"client_settings">): ClientSettings {
  return {
    id: row.id,
    clientId: row.client_id,
    averageCheck: row.average_check,
    monthlyCovers: row.monthly_covers,
    weeklyCovers: row.weekly_covers,
    daysOpenPerWeek: row.days_open_per_week,
    weeksPerMonth: row.weeks_per_month,
    guestsPerTable: row.guests_per_table,
    defaultGrowthTarget: row.default_growth_target,
    overviewHeadline: "overview_headline" in row ? row.overview_headline ?? "" : "",
    overviewSummary: "overview_summary" in row ? row.overview_summary ?? "" : "",
    overviewPinnedCampaignId:
      "overview_pinned_campaign_id" in row ? row.overview_pinned_campaign_id ?? undefined : undefined,
    overviewFeaturedMetric:
      ("overview_featured_metric" in row
        ? row.overview_featured_metric ?? "weekly-covers"
        : "weekly-covers") as ClientSettings["overviewFeaturedMetric"],
    overviewShowSchedule: "overview_show_schedule" in row ? row.overview_show_schedule ?? true : true,
    overviewShowTrafficTrend:
      "overview_show_traffic_trend" in row ? row.overview_show_traffic_trend ?? true : true,
    overviewShowChannelContribution:
      "overview_show_channel_contribution" in row
        ? row.overview_show_channel_contribution ?? true
        : true,
    overviewShowQuickLinks:
      "overview_show_quick_links" in row ? row.overview_show_quick_links ?? true : true,
    overviewShowCampaignRecaps:
      "overview_show_campaign_recaps" in row ? row.overview_show_campaign_recaps ?? true : true,
    overviewShowRecentActivity:
      "overview_show_recent_activity" in row ? row.overview_show_recent_activity ?? true : true
  };
}

export function mapClientSettingsInsert(settings: ClientSettings): TableInsert<"client_settings"> {
  return {
    id: settings.id,
    client_id: settings.clientId,
    average_check: settings.averageCheck,
    monthly_covers: Math.round(settings.monthlyCovers),
    weekly_covers: Math.round(settings.weeklyCovers),
    days_open_per_week: settings.daysOpenPerWeek,
    weeks_per_month: settings.weeksPerMonth,
    guests_per_table: settings.guestsPerTable,
    default_growth_target: settings.defaultGrowthTarget
  };
}

const clientHomeCardIds = new Set(["traffic", "covers", "growth", "attention"]);
const clientHomeSectionIds = new Set([
  "attention",
  "active-campaign",
  "business-read"
]);

function normalizeClientHomeCards(value: unknown): ClientHomeCard[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
    .filter((entry) => typeof entry.id === "string" && clientHomeCardIds.has(entry.id))
    .map((entry) => ({
      id: entry.id as ClientHomeCard["id"],
      label: typeof entry.label === "string" ? entry.label : "",
      value: typeof entry.value === "string" ? entry.value : "",
      detail: typeof entry.detail === "string" ? entry.detail : "",
      href: typeof entry.href === "string" ? entry.href : "/"
    }))
    .slice(0, 4);
}

function normalizeClientHomeSections(value: unknown): ClientHomeSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
    .filter((entry) => typeof entry.id === "string" && clientHomeSectionIds.has(entry.id))
    .map((entry) => ({
      id: entry.id as ClientHomeSection["id"],
      label: typeof entry.label === "string" ? entry.label : "",
      visible: typeof entry.visible === "boolean" ? entry.visible : true
    }));
}

export function mapClientHomeConfigRow(row: TableRow<"client_home_configs">): ClientHomeConfig {
  return {
    id: row.id,
    clientId: row.client_id,
    headline: row.headline ?? "",
    note: row.note ?? "",
    cards: normalizeClientHomeCards(row.cards),
    sections: normalizeClientHomeSections(row.sections),
    updatedAt: row.updated_at ?? undefined
  };
}

export function mapClientHomeConfigInsert(config: ClientHomeConfig): TableInsert<"client_home_configs"> {
  return {
    id: config.id,
    client_id: config.clientId,
    headline: config.headline,
    note: config.note,
    cards: config.cards,
    sections: config.sections,
    updated_at: config.updatedAt ?? new Date().toISOString()
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

export function mapClientPreferencesRow(row: TableRow<"client_preferences">): ClientPreferences {
  return {
    id: row.id,
    clientId: row.client_id,
    mobileNavKeys: normalizeStringArray(row.mobile_nav_keys),
    updatedAt: row.updated_at ?? undefined
  };
}

export function mapClientPreferencesInsert(
  preferences: ClientPreferences
): TableInsert<"client_preferences"> {
  return {
    id: preferences.id,
    client_id: preferences.clientId,
    mobile_nav_keys: preferences.mobileNavKeys,
    updated_at: preferences.updatedAt ?? new Date().toISOString()
  };
}

const manualMetaProviders = new Set(["facebook", "instagram"]);

function normalizeManualMetaChannels(value: unknown): ManualMetaChannelPerformance[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
    .filter((entry) => typeof entry.provider === "string" && manualMetaProviders.has(entry.provider))
    .map((entry) => ({
      provider: entry.provider as ManualMetaChannelPerformance["provider"],
      enabled: Boolean(entry.enabled),
      accountLabel: typeof entry.accountLabel === "string" ? entry.accountLabel : "",
      handle: typeof entry.handle === "string" ? entry.handle : "",
      periodLabel: typeof entry.periodLabel === "string" ? entry.periodLabel : "This week",
      impressions: typeof entry.impressions === "number" ? entry.impressions : 0,
      reach: typeof entry.reach === "number" ? entry.reach : 0,
      clicks: typeof entry.clicks === "number" ? entry.clicks : 0,
      engagement: typeof entry.engagement === "number" ? entry.engagement : 0,
      attributedCovers: typeof entry.attributedCovers === "number" ? entry.attributedCovers : 0,
      attributedRevenue: typeof entry.attributedRevenue === "number" ? entry.attributedRevenue : 0,
      topPost: typeof entry.topPost === "string" ? entry.topPost : "",
      nextAction: typeof entry.nextAction === "string" ? entry.nextAction : ""
    }));
}

export function mapManualMetaPerformanceRow(
  row: TableRow<"manual_meta_performance">
): ManualMetaPerformance {
  return {
    id: row.id,
    clientId: row.client_id,
    channels: normalizeManualMetaChannels(row.channels),
    updatedAt: row.updated_at ?? undefined
  };
}

export function mapManualMetaPerformanceInsert(
  performance: ManualMetaPerformance
): TableInsert<"manual_meta_performance"> {
  return {
    id: performance.id,
    client_id: performance.clientId,
    channels: performance.channels,
    updated_at: performance.updatedAt ?? new Date().toISOString()
  };
}

export function mapWeeklyMetricRow(row: TableRow<"weekly_metrics">): WeeklyMetric {
  return {
    id: row.id,
    clientId: row.client_id,
    weekLabel: row.week_label,
    covers: row.covers,
    netSales: row.net_sales ?? undefined,
    totalOrders: row.total_orders ?? undefined,
    notes: row.notes ?? undefined,
    campaignAttribution: row.campaign_attribution ?? undefined,
    campaignId: row.campaign_id ?? undefined,
    createdAt: row.created_at ?? undefined
  };
}

export function mapWeeklyMetricInsert(metric: WeeklyMetric): TableInsert<"weekly_metrics"> {
  return {
    id: metric.id,
    client_id: metric.clientId,
    week_label: metric.weekLabel,
    covers: metric.covers,
    net_sales: metric.netSales ?? null,
    total_orders: metric.totalOrders ?? null,
    notes: metric.notes ?? null,
    campaign_attribution: metric.campaignAttribution ?? null,
    campaign_id: metric.campaignId ?? null,
    created_at: metric.createdAt ?? null
  };
}

export function mapCampaignRow(
  row: TableRow<"campaigns">,
  relationships: {
    linkedPostIds?: string[];
    linkedBlogPostIds?: string[];
    linkedAssetIds?: string[];
    linkedWeeklyMetricIds?: string[];
  } = {}
): Campaign {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    objective: row.objective as Campaign["objective"],
    startDate: row.start_date,
    endDate: row.end_date,
    channels: (row.channels ?? []) as Campaign["channels"],
    linkedPostIds: relationships.linkedPostIds ?? [],
    linkedBlogPostIds: relationships.linkedBlogPostIds ?? [],
    linkedAssetIds: relationships.linkedAssetIds ?? [],
    linkedWeeklyMetricIds: relationships.linkedWeeklyMetricIds ?? [],
    notes: row.notes,
    status: row.status as Campaign["status"]
  };
}

export function mapCampaignInsert(campaign: Campaign): TableInsert<"campaigns"> {
  return {
    id: campaign.id,
    client_id: campaign.clientId,
    name: campaign.name,
    objective: campaign.objective,
    start_date: campaign.startDate,
    end_date: campaign.endDate,
    channels: campaign.channels,
    notes: campaign.notes,
    status: campaign.status
  };
}

export function mapCampaignRoiSnapshotRow(
  row: TableRow<"campaign_roi_snapshots">
): CampaignRoiSnapshot {
  return {
    id: row.id,
    clientId: row.client_id,
    campaignId: row.campaign_id,
    adSpend: row.ad_spend,
    productionCost: row.production_cost,
    agencyHours: row.agency_hours,
    hourlyRate: row.hourly_rate,
    otherCost: row.other_cost,
    attributedRevenue: row.attributed_revenue,
    attributedCovers: row.attributed_covers,
    attributedBookings: row.attributed_bookings,
    reach: row.reach,
    engagement: row.engagement,
    clicks: row.clicks,
    topPerformer: row.top_performer,
    resultSummary: row.result_summary,
    nextRecommendation: row.next_recommendation,
    updatedAt: row.updated_at ?? undefined
  };
}

export function mapCampaignRoiSnapshotInsert(
  snapshot: CampaignRoiSnapshot
): TableInsert<"campaign_roi_snapshots"> {
  return {
    id: snapshot.id,
    client_id: snapshot.clientId,
    campaign_id: snapshot.campaignId,
    ad_spend: snapshot.adSpend,
    production_cost: snapshot.productionCost,
    agency_hours: snapshot.agencyHours,
    hourly_rate: snapshot.hourlyRate,
    other_cost: snapshot.otherCost,
    attributed_revenue: snapshot.attributedRevenue,
    attributed_covers: snapshot.attributedCovers,
    attributed_bookings: snapshot.attributedBookings,
    reach: snapshot.reach,
    engagement: snapshot.engagement,
    clicks: snapshot.clicks,
    top_performer: snapshot.topPerformer,
    result_summary: snapshot.resultSummary,
    next_recommendation: snapshot.nextRecommendation,
    updated_at: snapshot.updatedAt ?? new Date().toISOString()
  };
}

export function mapCampaignGoalRow(row: TableRow<"campaign_goals">): CampaignGoal {
  return {
    id: row.id,
    clientId: row.client_id,
    campaignId: row.campaign_id,
    label: row.label,
    done: row.done,
    dueDate: row.due_date ?? undefined,
    assigneeName: row.assignee_name ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

export function mapCampaignGoalInsert(goal: CampaignGoal): TableInsert<"campaign_goals"> {
  return {
    id: goal.id,
    client_id: goal.clientId,
    campaign_id: goal.campaignId,
    label: goal.label,
    done: goal.done,
    due_date: goal.dueDate ?? null,
    assignee_name: goal.assigneeName ?? null,
    created_at: goal.createdAt ?? new Date().toISOString(),
    updated_at: goal.updatedAt ?? new Date().toISOString()
  };
}

export function mapAssetRow(row: TableRow<"assets">, linkedCampaignIds: string[] = []): Asset {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    assetType: row.asset_type as Asset["assetType"],
    status: row.status as Asset["status"],
    url: row.url,
    linkedCampaignIds,
    createdAt: row.created_at ?? undefined
  };
}

export function mapAssetInsert(asset: Asset): TableInsert<"assets"> {
  return {
    id: asset.id,
    client_id: asset.clientId,
    name: asset.name,
    asset_type: asset.assetType,
    status: asset.status,
    url: asset.url,
    created_at: asset.createdAt ?? null
  };
}

export function mapBlogPostRow(row: TableRow<"blog_posts">, assetIds: string[] = []): BlogPost {
  return {
    id: row.id,
    clientId: row.client_id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    publishDate: row.publish_date ?? undefined,
    status: row.status as BlogPost["status"],
    campaignId: row.campaign_id ?? undefined,
    assetIds,
    createdAt: row.created_at ?? undefined
  };
}

export function mapBlogPostInsert(blogPost: BlogPost): TableInsert<"blog_posts"> {
  return {
    id: blogPost.id,
    client_id: blogPost.clientId,
    title: blogPost.title,
    slug: blogPost.slug,
    summary: blogPost.summary,
    publish_date: blogPost.publishDate ?? null,
    status: blogPost.status,
    campaign_id: blogPost.campaignId ?? null,
    created_at: blogPost.createdAt ?? null
  };
}

export function mapPlannerItemRow(row: TableRow<"planner_items">): PlannerItem {
  return {
    id: row.id,
    clientId: row.client_id,
    dayOfWeek: row.day_of_week as PlannerItem["dayOfWeek"],
    platform: row.platform as PlannerItem["platform"],
    contentType: row.content_type,
    campaignGoal: row.campaign_goal,
    status: row.status as PlannerItem["status"],
    caption: row.caption,
    linkedPostId: row.linked_post_id ?? undefined,
    campaignId: row.campaign_id ?? undefined,
    createdAt: row.created_at ?? undefined
  };
}

export function mapPlannerItemInsert(item: PlannerItem): TableInsert<"planner_items"> {
  return {
    id: item.id,
    client_id: item.clientId,
    day_of_week: item.dayOfWeek,
    platform: item.platform,
    content_type: item.contentType,
    campaign_goal: item.campaignGoal,
    status: item.status,
    caption: item.caption,
    linked_post_id: item.linkedPostId ?? null,
    campaign_id: item.campaignId ?? null,
    created_at: item.createdAt ?? null
  };
}

export function mapPostRow(row: TableRow<"posts">, assetIds: string[] = []): Post {
  const decoded = decodePostContent(row.content);
  return {
    id: row.id,
    clientId: row.client_id,
    platform: row.platform as Post["platform"],
    format: decoded.meta.format,
    content: decoded.content,
    cta: row.cta,
    destinationUrl: decoded.meta.destinationUrl,
    publishDate: row.publish_date,
    goal: row.goal,
    status: row.status as Post["status"],
    approvalState: decoded.meta.approvalState,
    publishState: decoded.meta.publishState,
    assetState: decoded.meta.assetState,
    linkedTaskId: decoded.meta.linkedTaskId,
    plannerItemId: row.planner_item_id ?? undefined,
    campaignId: row.campaign_id ?? undefined,
    assetIds,
    createdAt: row.created_at ?? undefined
  };
}

export function mapPostInsert(post: Post): TableInsert<"posts"> {
  return {
    id: post.id,
    client_id: post.clientId,
    platform: post.platform,
    content: encodePostContent(post.content, {
      format: post.format,
      destinationUrl: post.destinationUrl,
      approvalState: post.approvalState,
      publishState: post.publishState,
      assetState: post.assetState,
      linkedTaskId: post.linkedTaskId
    }),
    cta: post.cta,
    publish_date: post.publishDate,
    goal: post.goal,
    status: post.status,
    planner_item_id: post.plannerItemId ?? null,
    campaign_id: post.campaignId ?? null,
    created_at: post.createdAt ?? null
  };
}

export function mapAnalyticsSnapshotRow(row: TableRow<"analytics_snapshots">): AnalyticsSnapshot {
  return {
    id: row.id,
    clientId: row.client_id,
    source: row.source as AnalyticsSnapshot["source"],
    periodLabel: row.period_label,
    linkedPostId: row.linked_post_id ?? undefined,
    linkedCampaignId: row.linked_campaign_id ?? undefined,
    impressions: row.impressions,
    clicks: row.clicks,
    conversions: row.conversions,
    attributedRevenue: row.attributed_revenue,
    attributedCovers: row.attributed_covers,
    attributedTables: row.attributed_tables,
    createdAt: row.created_at ?? undefined
  };
}

export function mapAnalyticsSnapshotInsert(
  snapshot: AnalyticsSnapshot
): TableInsert<"analytics_snapshots"> {
  return {
    id: snapshot.id,
    client_id: snapshot.clientId,
    source: snapshot.source,
    period_label: snapshot.periodLabel,
    linked_post_id: snapshot.linkedPostId ?? null,
    linked_campaign_id: snapshot.linkedCampaignId ?? null,
    impressions: snapshot.impressions,
    clicks: snapshot.clicks,
    conversions: snapshot.conversions,
    attributed_revenue: snapshot.attributedRevenue,
    attributed_covers: snapshot.attributedCovers,
    attributed_tables: snapshot.attributedTables,
    created_at: snapshot.createdAt ?? null
  };
}

export function mapApprovalRequestRow(
  row: TableRow<"approval_requests">
): ApprovalRequest {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    clientId: row.client_id,
    entityType: row.entity_type as ApprovalRequest["entityType"],
    entityId: row.entity_id,
    summary: row.summary,
    requesterName: row.requester_name,
    approverUserId: row.approver_user_id ?? undefined,
    approverName: row.approver_name ?? undefined,
    status: row.status as ApprovalRequest["status"],
    note: row.note ?? undefined,
    requestedAt: row.requested_at,
    reviewedAt: row.reviewed_at ?? undefined
  };
}

export function mapApprovalRequestInsert(
  approval: ApprovalRequest
): TableInsert<"approval_requests"> {
  return {
    id: approval.id,
    workspace_id: approval.workspaceId,
    client_id: approval.clientId,
    entity_type: approval.entityType,
    entity_id: approval.entityId,
    summary: approval.summary,
    requester_name: approval.requesterName,
    approver_user_id: approval.approverUserId ?? null,
    approver_name: approval.approverName ?? null,
    status: approval.status,
    note: approval.note ?? null,
    requested_at: approval.requestedAt,
    reviewed_at: approval.reviewedAt ?? null,
    created_at: approval.requestedAt
  };
}

export function mapIntegrationConnectionRow(
  row: TableRow<"integration_connections">
): IntegrationConnection {
  const parsed = parseIntegrationNotes(row.notes);

  return {
    id: row.id,
    clientId: row.client_id,
    provider: row.provider as IntegrationConnection["provider"],
    accountLabel: row.account_label,
    status: row.status as IntegrationConnection["status"],
    lastSyncAt: row.last_sync_at ?? undefined,
    notes: parsed.plainNotes,
    setup: parsed.setup
  };
}

export function mapIntegrationConnectionInsert(
  connection: IntegrationConnection
): TableInsert<"integration_connections"> {
  return {
    id: connection.id,
    client_id: connection.clientId,
    provider: connection.provider,
    account_label: connection.accountLabel,
    status: connection.status,
    last_sync_at: connection.lastSyncAt ?? null,
    notes: composeIntegrationNotes(connection.notes, connection.setup)
  };
}

export function mapSyncJobRow(row: TableRow<"sync_jobs">): SyncJob {
  return {
    id: row.id,
    clientId: row.client_id,
    provider: row.provider as SyncJob["provider"],
    jobType: row.job_type as SyncJob["jobType"],
    schedule: row.schedule,
    status: row.status as SyncJob["status"],
    lastRunAt: row.last_run_at ?? undefined,
    nextRunAt: row.next_run_at ?? undefined,
    detail: row.detail
  };
}

export function mapSyncJobInsert(job: SyncJob): TableInsert<"sync_jobs"> {
  return {
    id: job.id,
    client_id: job.clientId,
    provider: job.provider,
    job_type: job.jobType,
    schedule: job.schedule,
    status: job.status,
    last_run_at: job.lastRunAt ?? null,
    next_run_at: job.nextRunAt ?? null,
    detail: job.detail
  };
}

export function mapPublishJobRow(row: TableRow<"publish_jobs">): PublishJob {
  return {
    id: row.id,
    clientId: row.client_id,
    postId: row.post_id,
    provider: row.provider as PublishJob["provider"],
    scheduledFor: row.scheduled_for,
    status: row.status as PublishJob["status"],
    detail: row.detail,
    externalId: row.external_id ?? undefined,
    errorMessage: row.error_message ?? undefined,
    lastAttemptAt: row.last_attempt_at ?? undefined,
    publishedAt: row.published_at ?? undefined,
    createdAt: row.created_at ?? undefined
  };
}

export function mapPublishJobInsert(job: PublishJob): TableInsert<"publish_jobs"> {
  return {
    id: job.id,
    client_id: job.clientId,
    post_id: job.postId,
    provider: job.provider,
    scheduled_for: job.scheduledFor,
    status: job.status,
    detail: job.detail,
    external_id: job.externalId ?? null,
    error_message: job.errorMessage ?? null,
    last_attempt_at: job.lastAttemptAt ?? null,
    published_at: job.publishedAt ?? null,
    created_at: job.createdAt ?? null
  };
}

export function mapOperationalTaskRow(row: TableRow<"operational_tasks">): OperationalTask {
  const decoded = decodeTaskDetail(row.detail);
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    clientId: row.client_id ?? undefined,
    title: row.title,
    detail: decoded.detail,
    taskType: decoded.meta.taskType,
    status: row.status as OperationalTask["status"],
    priority: row.priority as OperationalTask["priority"],
    startDate: decoded.meta.startDate,
    dueDate: row.due_date ?? undefined,
    isMilestone: decoded.meta.isMilestone,
    blockedByTaskIds: decoded.meta.blockedByTaskIds,
    linkedPostId: decoded.meta.linkedPostId,
    notes: decoded.meta.notes,
    assigneeUserId: row.assignee_user_id ?? undefined,
    assigneeName: row.assignee_name ?? undefined,
    linkedEntityType: row.linked_entity_type as OperationalTask["linkedEntityType"],
    linkedEntityId: row.linked_entity_id ?? undefined,
    createdAt: row.created_at
  };
}

export function mapOperationalTaskInsert(
  task: OperationalTask
): TableInsert<"operational_tasks"> {
  return {
    id: task.id,
    workspace_id: task.workspaceId,
    client_id: task.clientId ?? null,
    title: task.title,
    detail: encodeTaskDetail(task.detail, {
      taskType: task.taskType,
      startDate: task.startDate,
      isMilestone: task.isMilestone,
      blockedByTaskIds: task.blockedByTaskIds,
      linkedPostId: task.linkedPostId,
      notes: task.notes
    }),
    status: task.status,
    priority: task.priority,
    due_date: task.dueDate ?? null,
    assignee_user_id: task.assigneeUserId ?? null,
    assignee_name: task.assigneeName ?? null,
    linked_entity_type: task.linkedEntityType ?? null,
    linked_entity_id: task.linkedEntityId ?? null,
    created_at: task.createdAt
  };
}

export function mapActivityEventRow(row: TableRow<"activity_events">): ActivityEvent {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    clientId: row.client_id ?? undefined,
    actorName: row.actor_name,
    actionLabel: row.action_label,
    subjectType: row.subject_type as ActivityEvent["subjectType"],
    subjectName: row.subject_name,
    detail: row.detail,
    createdAt: row.created_at
  };
}

export function mapActivityEventInsert(
  event: ActivityEvent
): TableInsert<"activity_events"> {
  return {
    id: event.id,
    workspace_id: event.workspaceId,
    client_id: event.clientId ?? null,
    actor_name: event.actorName,
    action_label: event.actionLabel,
    subject_type: event.subjectType,
    subject_name: event.subjectName,
    detail: event.detail,
    created_at: event.createdAt
  };
}
