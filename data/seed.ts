import {
  ApprovalRequest,
  ActivityItem,
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
  PublishJob,
  RevenueModelInput,
  SyncJob,
  WeeklyMetric,
  Workspace,
  WorkspaceMember
} from "@/types";
import {
  meamaLatestToastSnapshot,
  meamaToastWeeklyMetrics
} from "@/data/toast";

export const neighborhoodWorkspace: Workspace = {
  id: "ws-neighborhood",
  name: "Neighborhood Media",
  slug: "neighborhood-media",
  plan: "Agency",
  seatCount: 12
};

export const seededWorkspaceMembers: WorkspaceMember[] = [
  {
    id: "wmem-1",
    workspaceId: neighborhoodWorkspace.id,
    userId: "user-diego",
    fullName: "Diego Rivera",
    email: "diego@neighborhoodmedia.co",
    role: "owner",
    status: "Active"
  },
  {
    id: "wmem-2",
    workspaceId: neighborhoodWorkspace.id,
    userId: "user-anya",
    fullName: "Anya Cole",
    email: "anya@neighborhoodmedia.co",
    role: "strategist",
    status: "Active"
  },
  {
    id: "wmem-3",
    workspaceId: neighborhoodWorkspace.id,
    userId: "user-marco",
    fullName: "Marco Lin",
    email: "marco@neighborhoodmedia.co",
    role: "operator",
    status: "Active"
  }
];

export const meamaClient: Client = {
  id: "client-meama",
  workspaceId: neighborhoodWorkspace.id,
  name: "Meama",
  segment: "Restaurant",
  location: "Chicago, IL",
  status: "Active"
};

export const seededClients: Client[] = [meamaClient];

export const meamaSettings: ClientSettings = {
  id: "settings-meama",
  clientId: meamaClient.id,
  averageCheck: meamaLatestToastSnapshot.averageCheck,
  monthlyCovers: meamaLatestToastSnapshot.covers,
  weeklyCovers: Number((meamaLatestToastSnapshot.covers / 4.33).toFixed(2)),
  daysOpenPerWeek: 7,
  weeksPerMonth: 4.33,
  guestsPerTable: meamaLatestToastSnapshot.guestsPerTable,
  defaultGrowthTarget: 10,
  overviewHeadline: "Set the weekly restaurant story here.",
  overviewSummary:
    "Use the overview to pin the headline, feature the KPI that matters this week, and decide which sections the client or team sees first.",
  overviewFeaturedMetric: "weekly-covers",
  overviewShowSchedule: true,
  overviewShowTrafficTrend: true,
  overviewShowChannelContribution: true,
  overviewShowQuickLinks: true,
  overviewShowCampaignRecaps: true,
  overviewShowRecentActivity: true
};

export const seededClientSettings: ClientSettings[] = [meamaSettings];

export const defaultRevenueModel: RevenueModelInput = {
  mode: "monthly",
  averageCheck: meamaSettings.averageCheck,
  monthlyCovers: meamaSettings.monthlyCovers,
  weeklyCovers: meamaSettings.weeklyCovers,
  daysOpenPerWeek: meamaSettings.daysOpenPerWeek,
  weeksPerMonth: meamaSettings.weeksPerMonth,
  guestsPerTable: meamaSettings.guestsPerTable,
  growthTarget: meamaSettings.defaultGrowthTarget
};

export const seededCampaigns: Campaign[] = [];

export const seededWeeklyMetrics: WeeklyMetric[] = meamaToastWeeklyMetrics;

export const seededAssets: Asset[] = [];

export const seededBlogPosts: BlogPost[] = [];

export const seededPlannerItems: PlannerItem[] = [];

export const seededPosts: Post[] = [];

export const seededAnalyticsSnapshots: AnalyticsSnapshot[] = [];

export const seededIntegrationConnections: IntegrationConnection[] = [
  {
    id: "ic-1",
    clientId: meamaClient.id,
    provider: "instagram",
    accountLabel: "@meama_chicago",
    status: "Scaffolded",
    lastSyncAt: "2026-03-08T09:00:00.000Z",
    notes: "Ready for insights and publishing credentials."
  },
  {
    id: "ic-2",
    clientId: meamaClient.id,
    provider: "facebook",
    accountLabel: "Meama Chicago Page",
    status: "Scaffolded",
    notes: "Ready for Meta Page connection and publish permissions."
  },
  {
    id: "ic-3",
    clientId: meamaClient.id,
    provider: "tiktok",
    accountLabel: "@meama_chicago",
    status: "Needs Credentials",
    notes: "Awaiting TikTok app approval and account authorization."
  },
  {
    id: "ic-4",
    clientId: meamaClient.id,
    provider: "google-business-profile",
    accountLabel: "Meama Chicago",
    status: "Needs Credentials",
    notes: "Awaiting OAuth client and location access."
  },
  {
    id: "ic-5",
    clientId: meamaClient.id,
    provider: "google-analytics",
    accountLabel: "meama.com / GA4",
    status: "Scaffolded",
    notes: "Reporting adapter ready once property ID and service account are added."
  },
  {
    id: "ic-6",
    clientId: meamaClient.id,
    provider: "reservation-system",
    accountLabel: "Tock/OpenTable Placeholder",
    status: "Scaffolded",
    notes: "Hold until reservation vendor is confirmed."
  }
];

export const seededSyncJobs: SyncJob[] = [
  {
    id: "sj-1",
    clientId: meamaClient.id,
    provider: "instagram",
    jobType: "sync-insights",
    schedule: "Daily at 6:00 AM",
    status: "Ready",
    lastRunAt: "2026-03-08T06:00:00.000Z",
    nextRunAt: "2026-03-10T06:00:00.000Z",
    detail: "Will backfill engagement, clicks, and attributed cover proxies once API credentials exist."
  },
  {
    id: "sj-2",
    clientId: meamaClient.id,
    provider: "facebook",
    jobType: "sync-insights",
    schedule: "Daily at 6:10 AM",
    status: "Ready",
    lastRunAt: "2026-03-08T06:10:00.000Z",
    nextRunAt: "2026-03-10T06:10:00.000Z",
    detail: "Will sync Page reach, clicks, and attributed demand once Meta connection is completed."
  },
  {
    id: "sj-3",
    clientId: meamaClient.id,
    provider: "google-analytics",
    jobType: "sync-insights",
    schedule: "Daily at 6:15 AM",
    status: "Blocked",
    detail: "GA4 sync is scaffolded but blocked until property and credentials are configured."
  },
  {
    id: "sj-4",
    clientId: meamaClient.id,
    provider: "reservation-system",
    jobType: "sync-reservations",
    schedule: "Hourly",
    status: "Blocked",
    detail: "Reservation sync placeholder for covers and booking attribution."
  }
];

export const seededPublishJobs: PublishJob[] = [];

export const seededApprovalRequests: ApprovalRequest[] = [];

export const recentActivity: ActivityItem[] = [];

export const seededOperationalTasks: OperationalTask[] = [];

export const seededActivityEvents: ActivityEvent[] = [];

export const slowNightIdeas = [
  "Neighborhood prix fixe for Tuesdays",
  "Wine pairing spotlight for Wednesdays",
  "Chef table preview for early Thursdays",
  "Local office lunch comeback on Mondays",
  "Resident loyalty night with fixed CTA"
];
