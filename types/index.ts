export type Client = {
  id: string;
  workspaceId?: string;
  name: string;
  segment: string;
  location: string;
  status: "Active" | "Pipeline";
};

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  plan: "Agency" | "Starter" | "Enterprise";
  seatCount: number;
};

export type WorkspaceRole = "owner" | "admin" | "strategist" | "operator" | "client-viewer";

export type WorkspaceMember = {
  id: string;
  workspaceId: string;
  userId: string;
  fullName: string;
  email: string;
  role: WorkspaceRole;
  status: "Active" | "Invited";
};

export type ClientMembership = {
  id: string;
  clientId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt?: string;
};

export type ClientSettings = {
  id: string;
  clientId: string;
  averageCheck: number;
  monthlyCovers: number;
  weeklyCovers: number;
  daysOpenPerWeek: number;
  weeksPerMonth: number;
  guestsPerTable: number;
  defaultGrowthTarget: number;
  overviewHeadline: string;
  overviewSummary: string;
  overviewPinnedCampaignId?: string;
  overviewFeaturedMetric: "weekly-covers" | "weekly-revenue" | "tracked-revenue" | "open-tasks";
  overviewShowSchedule: boolean;
  overviewShowTrafficTrend: boolean;
  overviewShowChannelContribution: boolean;
  overviewShowQuickLinks: boolean;
  overviewShowCampaignRecaps: boolean;
  overviewShowRecentActivity: boolean;
};

export type ManualMetaProvider = "facebook" | "instagram";

export type ManualMetaChannelPerformance = {
  provider: ManualMetaProvider;
  enabled: boolean;
  accountLabel: string;
  handle: string;
  periodLabel: string;
  impressions: number;
  reach: number;
  clicks: number;
  engagement: number;
  attributedCovers: number;
  attributedRevenue: number;
  topPost: string;
  nextAction: string;
};

export type ManualMetaPerformance = {
  id: string;
  clientId: string;
  channels: ManualMetaChannelPerformance[];
  updatedAt?: string;
};

export type CampaignRoiSnapshot = {
  id: string;
  clientId: string;
  campaignId: string;
  adSpend: number;
  productionCost: number;
  agencyHours: number;
  hourlyRate: number;
  otherCost: number;
  attributedRevenue: number;
  attributedCovers: number;
  attributedBookings: number;
  reach: number;
  engagement: number;
  clicks: number;
  topPerformer: string;
  resultSummary: string;
  nextRecommendation: string;
  updatedAt?: string;
};

export type RevenueModelInput = {
  mode: "monthly" | "weekly";
  averageCheck: number;
  monthlyCovers: number;
  weeklyCovers: number;
  daysOpenPerWeek: number;
  weeksPerMonth: number;
  guestsPerTable: number;
  growthTarget: number;
};

export type RevenueModelOutput = {
  monthlyCovers: number;
  weeklyCovers: number;
  dailyCovers: number;
  monthlyRevenue: number;
  weeklyRevenue: number;
  dailyRevenue: number;
  addedMonthlyCovers: number;
  addedWeeklyCovers: number;
  addedMonthlyRevenue: number;
  addedWeeklyRevenue: number;
  annualUpside: number;
  tablesPerNight: number;
  busiestDay: WeekdayProjection;
  slowestDay: WeekdayProjection;
  weekdayBreakdown: WeekdayProjection[];
};

export type WeekdayProjection = {
  day: DayOfWeek;
  shareOfWeek: number;
  currentCovers: number;
  projectedCovers: number;
  addedCovers: number;
  currentRevenue: number;
  projectedRevenue: number;
  currentTables: number;
  projectedTables: number;
};

export type DayOfWeek =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export type Platform = "Instagram" | "Facebook" | "Stories" | "TikTok" | "Email";
export type Channel =
  | Platform
  | "Google Business Profile"
  | "Google Analytics"
  | "Website Blog"
  | "Reservation System";

export type PlannerStatus = "Draft" | "Scheduled" | "Published";
export type PostStatus = "Draft" | "Scheduled" | "Published";
export type BlogStatus = "Draft" | "Ready" | "Published";
export type AssetStatus = "Ready" | "Needs Review" | "Archived";
export type CampaignStatus = "Planning" | "Active" | "Completed";
export type CampaignObjective = string;
export type CampaignChannel = string;

export type WeeklyMetric = {
  id: string;
  clientId: string;
  weekLabel: string;
  covers: number;
  notes?: string;
  campaignAttribution?: string;
  campaignId?: string;
  createdAt?: string;
};

export type PlannerItem = {
  id: string;
  clientId: string;
  dayOfWeek: DayOfWeek;
  platform: Platform;
  contentType: string;
  campaignGoal: string;
  status: PlannerStatus;
  caption: string;
  linkedPostId?: string;
  campaignId?: string;
  createdAt?: string;
};

export type Post = {
  id: string;
  clientId: string;
  platform: Platform;
  content: string;
  cta: string;
  publishDate: string;
  goal: string;
  status: PostStatus;
  plannerItemId?: string;
  campaignId?: string;
  assetIds: string[];
  createdAt?: string;
};

export type BlogPost = {
  id: string;
  clientId: string;
  title: string;
  slug: string;
  summary: string;
  publishDate?: string;
  status: BlogStatus;
  campaignId?: string;
  assetIds: string[];
  createdAt?: string;
};

export type Asset = {
  id: string;
  clientId: string;
  name: string;
  assetType: "Photo" | "Video" | "Graphic" | "Menu";
  status: AssetStatus;
  url: string;
  linkedCampaignIds: string[];
  createdAt?: string;
};

export type Campaign = {
  id: string;
  clientId: string;
  name: string;
  objective: CampaignObjective;
  startDate: string;
  endDate: string;
  channels: CampaignChannel[];
  linkedPostIds: string[];
  linkedBlogPostIds: string[];
  linkedAssetIds: string[];
  linkedWeeklyMetricIds: string[];
  notes: string;
  status: CampaignStatus;
};

export type AnalyticsSnapshot = {
  id: string;
  clientId: string;
  source: Channel;
  periodLabel: string;
  linkedPostId?: string;
  linkedCampaignId?: string;
  impressions: number;
  clicks: number;
  conversions: number;
  attributedRevenue: number;
  attributedCovers: number;
  attributedTables: number;
  createdAt?: string;
};

export type IntegrationProvider =
  | "instagram"
  | "facebook"
  | "google-business-profile"
  | "google-analytics"
  | "tiktok"
  | "reservation-system";

export type IntegrationSetup = {
  authStatus: "unconfigured" | "preparing" | "connected";
  externalAccountId?: string;
  scopeSummary?: string;
  lastCheckedAt?: string;
  nextAction?: string;
  authorizationUrl?: string;
  tokenStatus?: "missing" | "ready" | "stale";
  connectedAssetType?: "facebook-page" | "instagram-business-account";
  connectedAssetLabel?: string;
  availableAssets?: Array<{
    id: string;
    label: string;
    type: "facebook-page" | "instagram-business-account";
    connectedPageId?: string;
    username?: string;
  }>;
  capabilities?: string[];
  connectionMode?: "meta-business-suite" | "direct";
};

export type MetaBusinessChannelSummary = {
  provider: "facebook" | "instagram";
  accountLabel: string;
  status: IntegrationConnection["status"];
  authStatus: IntegrationSetup["authStatus"];
  tokenStatus: IntegrationSetup["tokenStatus"];
  authorizationUrl?: string;
  externalAccountId?: string;
  connectedAssetLabel?: string;
  nextAction?: string;
  scopeSummary?: string;
  capabilities: string[];
  availableAssets?: NonNullable<IntegrationSetup["availableAssets"]>;
  scheduledPosts: number;
  queuedPublishJobs: number;
  publishedJobs: number;
  impressions: number;
  clicks: number;
  conversions: number;
  attributedRevenue: number;
  attributedCovers: number;
  attributedTables: number;
  latestPeriodLabel?: string;
};

export type MetaBusinessSuiteSummary = {
  clientId: string;
  readyToConnect: boolean;
  connectedChannels: number;
  channels: MetaBusinessChannelSummary[];
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalAttributedRevenue: number;
  totalAttributedCovers: number;
  totalAttributedTables: number;
  totalScheduledPosts: number;
  totalQueuedPublishJobs: number;
  totalPublishedJobs: number;
  highlights: string[];
};

export type IntegrationConnection = {
  id: string;
  clientId: string;
  provider: IntegrationProvider;
  accountLabel: string;
  status: "Ready" | "Needs Credentials" | "Scaffolded";
  lastSyncAt?: string;
  notes: string;
  setup?: IntegrationSetup;
};

export type SyncJob = {
  id: string;
  clientId: string;
  provider: IntegrationProvider;
  jobType: "sync-insights" | "sync-posts" | "sync-reservations";
  schedule: string;
  status: "Idle" | "Ready" | "Blocked";
  lastRunAt?: string;
  nextRunAt?: string;
  detail: string;
};

export type PublishJobStatus =
  | "Queued"
  | "Processing"
  | "Published"
  | "Failed"
  | "Blocked";

export type PublishJob = {
  id: string;
  clientId: string;
  postId: string;
  provider: Extract<IntegrationProvider, "instagram" | "facebook" | "tiktok">;
  scheduledFor: string;
  status: PublishJobStatus;
  detail: string;
  externalId?: string;
  errorMessage?: string;
  lastAttemptAt?: string;
  publishedAt?: string;
  createdAt?: string;
};

export type ApprovalStatus = "Pending" | "Approved" | "Changes Requested";

export type ApprovalRequest = {
  id: string;
  workspaceId: string;
  clientId: string;
  entityType: "post";
  entityId: string;
  summary: string;
  requesterName: string;
  approverUserId?: string;
  approverName?: string;
  status: ApprovalStatus;
  note?: string;
  requestedAt: string;
  reviewedAt?: string;
};

export type ActivityItem = {
  id: string;
  clientId: string;
  title: string;
  detail: string;
  timestamp: string;
};

export type TaskStatus = "Backlog" | "In Progress" | "Waiting" | "Done";
export type TaskPriority = "Low" | "Medium" | "High";

export type OperationalTask = {
  id: string;
  workspaceId: string;
  clientId?: string;
  title: string;
  detail: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  assigneeUserId?: string;
  assigneeName?: string;
  linkedEntityType?: "campaign" | "post" | "integration" | "metric";
  linkedEntityId?: string;
  createdAt?: string;
};

export type ActivityEvent = {
  id: string;
  workspaceId: string;
  clientId?: string;
  actorName: string;
  actionLabel: string;
  subjectType: "campaign" | "content" | "integration" | "task" | "workspace";
  subjectName: string;
  detail: string;
  createdAt: string;
};
