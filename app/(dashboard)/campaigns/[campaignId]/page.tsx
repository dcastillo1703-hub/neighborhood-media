"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronUp,
  ClipboardList,
  LayoutList,
  Megaphone,
  MoreHorizontal,
  Plus,
  Target,
  Trash2,
  X
} from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ListCard } from "@/components/dashboard/list-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePill } from "@/components/ui/date-pill";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { useActiveClient } from "@/lib/client-context";
import {
  composeCampaignMetadata,
  getCampaignWebsiteMetadata,
  parseCampaignMetadata,
  slugifyCampaignName
} from "@/lib/domain/campaign-metadata";
import { getCampaignOverview } from "@/lib/domain/campaigns";
import { useAnalyticsSnapshots } from "@/lib/repositories/use-analytics-snapshots";
import { useAssets } from "@/lib/repositories/use-assets";
import { useBlogPosts } from "@/lib/repositories/use-blog-posts";
import { useCampaignGoals } from "@/lib/repositories/use-campaign-goals";
import { useCampaigns } from "@/lib/repositories/use-campaigns";
import { usePosts } from "@/lib/repositories/use-posts";
import { useWeeklyMetrics } from "@/lib/repositories/use-weekly-metrics";
import { useTheme } from "@/lib/theme-context";
import { useApprovalsApi } from "@/lib/use-approvals-api";
import { useCampaignRoi } from "@/lib/use-campaign-roi";
import { useGoogleAnalytics } from "@/lib/use-google-analytics";
import { useOperationsApi } from "@/lib/use-operations-api";
import { usePublishingApi } from "@/lib/use-publishing-api";
import { currency, formatShortDate, number } from "@/lib/utils";
import { validatePost } from "@/lib/validation";
import { useWorkspaceContext } from "@/lib/workspace-context";
import {
  CampaignRoiSnapshot,
  OperationalTask,
  Platform,
  Post,
  PostStatus,
  TaskPriority,
  TaskStatus
} from "@/types";

type CampaignWorkspaceView = "overview" | "list" | "board" | "calendar" | "performance";
type CampaignBoardLane = "Draft" | "Review" | "Scheduled" | "Published";
type CampaignTaskKind = "content" | "meeting" | "task";
type CampaignPipelineStageId = "goal" | "tasks" | "content" | "approvals" | "scheduled" | "results";
type CampaignOverviewSection =
  | "content"
  | "tasks"
  | "approvals"
  | "publishing"
  | "metrics";
type MobileComposerStep = 1 | 2 | 3 | 4;
type SelectedCampaignItem =
  | { type: "post"; item: Post }
  | { type: "task"; item: OperationalTask };
type CampaignRoiNumberField =
  | "adSpend"
  | "productionCost"
  | "agencyHours"
  | "hourlyRate"
  | "otherCost"
  | "attributedRevenue"
  | "attributedCovers"
  | "attributedBookings"
  | "reach"
  | "engagement"
  | "clicks";

type CampaignRoiNumberDraft = Record<CampaignRoiNumberField, string>;

const campaignViews: Array<{
  id: CampaignWorkspaceView;
  label: string;
  description: string;
}> = [
  { id: "overview", label: "Overview", description: "Brief and new content" },
  { id: "list", label: "List", description: "Every work item" },
  { id: "board", label: "Board", description: "Status lanes" },
  { id: "calendar", label: "Calendar", description: "Scheduled dates" },
  { id: "performance", label: "Performance", description: "Covers and revenue" }
];

const boardLanes: CampaignBoardLane[] = ["Draft", "Review", "Scheduled", "Published"];
const taskKindOptions: Array<{
  id: CampaignTaskKind;
  label: string;
  description: string;
  icon: typeof Megaphone;
}> = [
  { id: "content", label: "Content", description: "Instagram, Facebook, TikTok, email, or story post.", icon: Megaphone },
  { id: "meeting", label: "Meeting", description: "Client call, shoot planning, review session, or check-in.", icon: CalendarClock },
  { id: "task", label: "General task", description: "Anything that needs to happen for this campaign.", icon: ClipboardList }
];
const taskPriorities: TaskPriority[] = ["Low", "Medium", "High"];
const postStatuses: PostStatus[] = ["Draft", "Scheduled", "Published"];
const taskStatuses: TaskStatus[] = ["Backlog", "In Progress", "Waiting", "Done"];
const platformOptions: Platform[] = ["Instagram", "Facebook", "Stories", "TikTok", "Email"];
const contentComposerId = "content-composer";
const utmSourcePresets = [
  { label: "Facebook", source: "facebook", medium: "social" },
  { label: "Instagram", source: "instagram", medium: "social" },
  { label: "Email", source: "email", medium: "email" },
  { label: "SMS", source: "sms", medium: "text" },
  { label: "QR Code", source: "qr", medium: "offline" }
] as const;

const contentFormatOptions: NonNullable<Post["format"]>[] = [
  "Static",
  "Carousel",
  "Reel",
  "Story",
  "Email",
  "Offer"
];

function getTaskStateLabel(task: OperationalTask) {
  if (task.status === "Waiting" && task.blockedByTaskIds?.length) {
    return "Blocked";
  }

  if (task.status !== "Done" && task.dueDate && new Date(task.dueDate) < new Date()) {
    return "Overdue";
  }

  if (task.isMilestone) {
    return "Milestone";
  }

  return task.status;
}

function getTaskVisualState(task: OperationalTask) {
  const state = getTaskStateLabel(task);

  if (state === "Blocked") {
    return {
      label: "Blocked",
      tone: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
    };
  }

  if (state === "Overdue") {
    return {
      label: "Overdue",
      tone: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
    };
  }

  if (state === "Milestone") {
    return {
      label: "Milestone",
      tone: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
    };
  }

  return {
    label: task.status,
    tone: "border-border bg-muted/40 text-muted-foreground"
  };
}

function getPostNextStep(post: Post, approvalStatus?: string, publishStatus?: string) {
  if (!post.content.trim()) {
    return "Add copy";
  }
  if ((post.assetState ?? "Missing") !== "Ready") {
    return "Finish assets";
  }
  if (approvalStatus === "Changes Requested") {
    return "Revise for approval";
  }
  if (approvalStatus !== "Approved") {
    return "Send for approval";
  }
  if (!post.publishDate) {
    return "Pick publish time";
  }
  if (post.status !== "Scheduled") {
    return "Schedule";
  }
  if (publishStatus && publishStatus !== "Published") {
    return "Ready to publish";
  }
  return "Complete";
}

function getPostReadiness(post: Post, approvalStatus?: string, publishStatus?: string) {
  const nextStep = getPostNextStep(post, approvalStatus, publishStatus);

  if (nextStep === "Complete") {
    return {
      label: "Ready",
      tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      nextStep
    };
  }

  if (nextStep === "Revise for approval") {
    return {
      label: "Blocked",
      tone: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      nextStep
    };
  }

  return {
    label: "In progress",
    tone: "border-border bg-muted/40 text-muted-foreground",
    nextStep
  };
}

function normalizeCampaignView(value: string | null | undefined): CampaignWorkspaceView {
  const normalizedValue = value?.toLowerCase();
  return campaignViews.some((view) => view.id === normalizedValue)
    ? (normalizedValue as CampaignWorkspaceView)
    : "overview";
}

function getDefaultViewFromCampaignNotes(notes: string | null | undefined): CampaignWorkspaceView {
  const parsed = parseCampaignMetadata(notes);
  return normalizeCampaignView(parsed.defaultView);
}

function createCampaignPost(clientId: string, campaignId: string): Post {
  return {
    id: "",
    clientId,
    campaignId,
    platform: "Instagram",
    format: "Static",
    content: "",
    cta: "",
    destinationUrl: "",
    publishDate: "",
    goal: "",
    status: "Draft",
    assetState: "Missing",
    assetIds: []
  };
}

function createCampaignTask(workspaceId: string, clientId: string, campaignId: string): OperationalTask {
  return {
    id: "",
    workspaceId,
    clientId,
    title: "",
    detail: "",
    taskType: "General",
    status: "Backlog",
    priority: "Medium",
    startDate: "",
    dueDate: "",
    isMilestone: false,
    blockedByTaskIds: [],
    notes: [],
    linkedEntityType: "campaign",
    linkedEntityId: campaignId
  };
}

function toNumberDraft(snapshot: CampaignRoiSnapshot): CampaignRoiNumberDraft {
  return {
    adSpend: snapshot.adSpend ? String(snapshot.adSpend) : "",
    productionCost: snapshot.productionCost ? String(snapshot.productionCost) : "",
    agencyHours: snapshot.agencyHours ? String(snapshot.agencyHours) : "",
    hourlyRate: snapshot.hourlyRate ? String(snapshot.hourlyRate) : "",
    otherCost: snapshot.otherCost ? String(snapshot.otherCost) : "",
    attributedRevenue: snapshot.attributedRevenue ? String(snapshot.attributedRevenue) : "",
    attributedCovers: snapshot.attributedCovers ? String(snapshot.attributedCovers) : "",
    attributedBookings: snapshot.attributedBookings ? String(snapshot.attributedBookings) : "",
    reach: snapshot.reach ? String(snapshot.reach) : "",
    engagement: snapshot.engagement ? String(snapshot.engagement) : "",
    clicks: snapshot.clicks ? String(snapshot.clicks) : ""
  };
}

export default function CampaignDetailPage() {
  const params = useParams<{ campaignId: string }>();
  const campaignId = params.campaignId;
  const { activeClient } = useActiveClient();
  const { profile } = useAuth();
  const { workspace } = useWorkspaceContext();
  const { accent } = useTheme();
  const {
    campaigns,
    ready: campaignsReady,
    error: campaignsError,
    updateCampaign
  } = useCampaigns(activeClient.id);
  const { posts, addPost, updatePost, deletePost, ready: postsReady, error: postsError } = usePosts(activeClient.id);
  const { blogPosts } = useBlogPosts(activeClient.id);
  const { assets } = useAssets(activeClient.id);
  const { metrics } = useWeeklyMetrics(activeClient.id);
  const { analyticsSnapshots } = useAnalyticsSnapshots(activeClient.id);
  const [websiteDraft, setWebsiteDraft] = useState({
    landingPath: "",
    utmSource: "facebook",
    utmMedium: "social",
    utmCampaign: ""
  });
  const {
    summary: googleAnalyticsSummary,
    campaignImpact: googleAnalyticsCampaignImpact
  } = useGoogleAnalytics(activeClient.id, {
    landingPath: websiteDraft.landingPath.startsWith("/")
      ? websiteDraft.landingPath
      : websiteDraft.landingPath
        ? `/${websiteDraft.landingPath}`
        : "/",
    utmCampaign: websiteDraft.utmCampaign || slugifyCampaignName(campaignId)
  });
  const { approvals, ready: approvalsReady, reviewApproval, prependApproval } = useApprovalsApi(activeClient.id);
  const { jobs, ready: jobsReady, processJob } = usePublishingApi(activeClient.id);
  const {
    snapshot: roiSnapshot,
    summary: roiSummary,
    ready: roiReady,
    error: roiError,
    saveSnapshot: saveRoiSnapshot
  } = useCampaignRoi(activeClient.id, campaignId);
  const { tasks, ready: tasksReady, error: tasksError, createTask, updateTask, deleteTask } = useOperationsApi(
    workspace.id,
    activeClient.id
  );
  const {
    goals: campaignGoals,
    ready: campaignGoalsReady,
    error: campaignGoalsError,
    saveGoals: saveCampaignGoals
  } = useCampaignGoals(activeClient.id, campaignId);
  const [draft, setDraft] = useState<Post>(() => createCampaignPost(activeClient.id, campaignId));
  const [taskDraft, setTaskDraft] = useState<OperationalTask>(() =>
    createCampaignTask(workspace.id, activeClient.id, campaignId)
  );
  const [taskKind, setTaskKind] = useState<CampaignTaskKind | null>(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [mobileComposerStep, setMobileComposerStep] = useState<MobileComposerStep>(1);
  const [composerTitleDraft, setComposerTitleDraft] = useState("");
  const [mobilePostStatus, setMobilePostStatus] = useState<PostStatus>("Draft");
  const [roiDraft, setRoiDraft] = useState(roiSnapshot);
  const [roiNumberDraft, setRoiNumberDraft] = useState<CampaignRoiNumberDraft>(() =>
    toNumberDraft(roiSnapshot)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [savingSelectedTask, setSavingSelectedTask] = useState(false);
  const [deletingSelectedItem, setDeletingSelectedItem] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<CampaignWorkspaceView>(() =>
    typeof window === "undefined"
      ? "overview"
      : normalizeCampaignView(new URLSearchParams(window.location.search).get("view"))
  );
  const [selectedItem, setSelectedItem] = useState<SelectedCampaignItem | null>(null);
  const [mobileViewMenuOpen, setMobileViewMenuOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [openOverviewSections, setOpenOverviewSections] = useState<CampaignOverviewSection[]>([]);
  const [selectedPostDraft, setSelectedPostDraft] = useState<Post | null>(null);
  const [selectedTaskDraft, setSelectedTaskDraft] = useState<OperationalTask | null>(null);
  const [selectedNote, setSelectedNote] = useState("");
  const [selectedSaveError, setSelectedSaveError] = useState<string | null>(null);
  const [goalDraft, setGoalDraft] = useState("");
  const [goalDueDateDraft, setGoalDueDateDraft] = useState("");
  const [goalAssigneeDraft, setGoalAssigneeDraft] = useState("");
  const [savingWebsite, setSavingWebsite] = useState(false);
  const [websiteError, setWebsiteError] = useState<string | null>(null);
  const [websiteNotice, setWebsiteNotice] = useState<string | null>(null);
  const [draggedReadyPostId, setDraggedReadyPostId] = useState<string | null>(null);

  useEffect(() => {
    setRoiDraft(roiSnapshot);
    setRoiNumberDraft(toNumberDraft(roiSnapshot));
  }, [roiSnapshot]);

  useEffect(() => {
    setSelectedPostDraft(selectedItem?.type === "post" ? { ...selectedItem.item } : null);
    setSelectedTaskDraft(selectedItem?.type === "task" ? { ...selectedItem.item } : null);
    setSelectedNote("");
    setSelectedSaveError(null);
  }, [selectedItem]);

  const campaign = campaigns.find((item) => item.id === campaignId) ?? null;
  const routeView =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("view");
  const campaignDefaultView = campaign
    ? getDefaultViewFromCampaignNotes(campaign.notes)
    : null;
  const campaignMetadata = campaign ? parseCampaignMetadata(campaign.notes) : null;
  const overview = useMemo(
    () =>
      campaign
        ? getCampaignOverview(campaign, posts, blogPosts, assets, metrics, analyticsSnapshots)
        : null,
    [analyticsSnapshots, assets, blogPosts, campaign, metrics, posts]
  );

  useEffect(() => {
    if (routeView) {
      setActiveView(normalizeCampaignView(routeView));
      return;
    }

    if (campaignDefaultView) {
      setActiveView(campaignDefaultView);
    }
  }, [campaignDefaultView, routeView]);

  useEffect(() => {
    if (!campaign) {
      return;
    }

    setWebsiteDraft(getCampaignWebsiteMetadata(campaign));
  }, [campaign]);

  const linkedPostIds = useMemo(
    () => new Set(overview?.linkedPosts.map((post) => post.id) ?? []),
    [overview]
  );

  const campaignApprovals = useMemo(
    () => approvals.filter((approval) => linkedPostIds.has(approval.entityId)),
    [approvals, linkedPostIds]
  );
  const campaignPublishJobs = useMemo(
    () => jobs.filter((job) => linkedPostIds.has(job.postId)),
    [jobs, linkedPostIds]
  );
  const getPostApproval = (postId: string) =>
    campaignApprovals.find((item) => item.entityId === postId);
  const getPostPublishJob = (postId: string) =>
    campaignPublishJobs.find((item) => item.postId === postId);
  const scheduledPosts = useMemo(
    () =>
      (overview?.linkedPosts ?? [])
        .filter((post) => post.publishDate)
        .sort((left, right) => left.publishDate.localeCompare(right.publishDate)),
    [overview]
  );
  const linkedPosts = overview?.linkedPosts ?? [];
  const campaignTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.linkedEntityType === "campaign" &&
          task.linkedEntityId === campaignId &&
          (!task.clientId || task.clientId === activeClient.id)
      ),
    [activeClient.id, campaignId, tasks]
  );
  const pendingReviews = campaignApprovals.filter((approval) => approval.status === "Pending").length;
  const queuedPublishJobs = campaignPublishJobs.filter((job) =>
    ["Queued", "Processing", "Blocked"].includes(job.status)
  ).length;
  const openCampaignTasks = campaignTasks.filter((task) => task.status !== "Done").length;
  const completedCampaignGoals = campaignGoals.filter((goal) => goal.done).length;
  const openCampaignGoals = campaignGoals.filter((goal) => !goal.done).length;
  const nextScheduledPost = scheduledPosts[0] ?? null;
  const readyToSchedulePosts = linkedPosts.filter(
    (post) =>
      post.status === "Draft" &&
      (getPostApproval(post.id)?.status === "Approved" || post.approvalState === "Approved")
  );
  const unifiedCalendarItems = [
    ...campaignTasks
      .filter((task) => task.startDate || task.dueDate)
      .map((task) => ({
        id: `task-${task.id}`,
        kind: task.isMilestone ? "milestone" : "task",
        title: task.title,
        date: task.dueDate || task.startDate || "",
        status: getTaskStateLabel(task),
        detail: task.detail,
        item: task
      })),
    ...scheduledPosts.map((post) => ({
      id: `post-${post.id}`,
      kind: "content" as const,
      title: post.goal,
      date: post.publishDate,
      status: getPostApproval(post.id)?.status ?? post.status,
      detail: `${post.platform} · ${post.format ?? "Content"}`,
      item: post
    })),
    ...campaignGoals
      .filter((goal) => goal.dueDate)
      .map((goal) => ({
        id: `goal-${goal.id}`,
        kind: "milestone" as const,
        title: goal.label,
        date: goal.dueDate ?? "",
        status: goal.done ? "Complete" : "Open",
        detail: goal.assigneeName ?? "Campaign goal",
        item: goal
      }))
  ].sort((left, right) => left.date.localeCompare(right.date));
  const schedulingDays = Array.from({ length: 7 }, (_, index) => {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + index);
    const isoDate = nextDate.toISOString().slice(0, 10);
    const itemCount = scheduledPosts.filter((post) => post.publishDate === isoDate).length;

    return {
      date: isoDate,
      label: formatShortDate(isoDate),
      itemCount
    };
  });
  const scheduleGaps = schedulingDays.filter((day) => day.itemCount === 0);
  const websitePreviewPath = websiteDraft.landingPath.startsWith("/")
    ? websiteDraft.landingPath
    : websiteDraft.landingPath
      ? `/${websiteDraft.landingPath}`
      : "/";
  const websiteQuery = new URLSearchParams(
    Object.entries({
      utm_source: websiteDraft.utmSource.trim(),
      utm_medium: websiteDraft.utmMedium.trim(),
      utm_campaign: websiteDraft.utmCampaign.trim() || (campaign ? slugifyCampaignName(campaign.name) : "")
    }).filter(([, value]) => value)
  ).toString();
  const websiteHandoff = `${websitePreviewPath}${websiteQuery ? `?${websiteQuery}` : ""}`;
  const websiteReady =
    Boolean(websiteDraft.landingPath.trim()) &&
    Boolean(websiteDraft.utmSource.trim()) &&
    Boolean(websiteDraft.utmMedium.trim()) &&
    Boolean((websiteDraft.utmCampaign || (campaign ? slugifyCampaignName(campaign.name) : "")).trim());
  const websiteActionMessage = websiteReady
    ? "This campaign has a tagged link ready to copy into posts, ads, stories, or QR codes."
    : "Finish the landing path and UTM fields so this campaign stops feeding unattributed traffic into GA.";
  const pipelineRead = googleAnalyticsCampaignImpact?.ready
    ? googleAnalyticsCampaignImpact.summary
    : websiteReady
      ? "The tagged link is ready. Sync Google Analytics to see whether this campaign is creating traffic and intent."
      : "Set up the tagged link first so the website response can be tied back to this campaign.";
  const campaignNextMoves = [
    pendingReviews
      ? `${pendingReviews} approval${pendingReviews === 1 ? "" : "s"} still need a decision.`
      : null,
    nextScheduledPost
      ? `Next publish is ${nextScheduledPost.platform} on ${formatShortDate(nextScheduledPost.publishDate)}.`
      : null,
    openCampaignTasks
      ? `${openCampaignTasks} campaign task${openCampaignTasks === 1 ? "" : "s"} are still open.`
      : null,
    openCampaignGoals
      ? `${openCampaignGoals} goal${openCampaignGoals === 1 ? "" : "s"} still need to be completed.`
      : null
  ].filter(Boolean) as string[];
  const overdueTaskCount = campaignTasks.filter(
    (task) => task.status !== "Done" && task.dueDate && new Date(task.dueDate) < new Date()
  ).length;
  const blockedTaskCount = campaignTasks.filter((task) => task.blockedByTaskIds?.length).length;
  const missingContentCount = linkedPosts.filter((post) => !post.content.trim() || (post.assetState ?? "Missing") !== "Ready").length;
  const unscheduledReadyCount = readyToSchedulePosts.length;
  const campaignHealth: {
    label: "At Risk" | "On Track" | "Needs Attention";
    detail: string;
    tone: string;
  } =
    overdueTaskCount || pendingReviews > 1
      ? {
          label: "At Risk",
          detail: `${number(overdueTaskCount + pendingReviews)} blocker${overdueTaskCount + pendingReviews === 1 ? "" : "s"} need attention.`,
          tone: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
        }
      : missingContentCount || unscheduledReadyCount || blockedTaskCount
        ? {
            label: "Needs Attention",
            detail: `${number(missingContentCount + unscheduledReadyCount + blockedTaskCount)} execution gaps are still open.`,
            tone: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          }
        : {
            label: "On Track",
            detail: "Current work is moving through the pipeline cleanly.",
            tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          };
  const nextAction = overdueTaskCount
    ? {
        label: "Resolve overdue work",
        detail: `${number(overdueTaskCount)} task${overdueTaskCount === 1 ? "" : "s"} are overdue and blocking the campaign.`,
        actionLabel: "Open tasks",
        onClick: () => setActiveView("list")
      }
    : pendingReviews
      ? {
          label: "Review pending approvals",
          detail: `${number(pendingReviews)} content item${pendingReviews === 1 ? "" : "s"} are waiting on approval before they can move forward.`,
          actionLabel: "Review approvals",
          onClick: () => setActiveView("list")
        }
      : unscheduledReadyCount
        ? {
            label: "Schedule ready content",
            detail: `${number(unscheduledReadyCount)} approved item${unscheduledReadyCount === 1 ? "" : "s"} are ready to place on the calendar.`,
            actionLabel: "Open calendar",
            onClick: () => setActiveView("calendar")
          }
        : missingContentCount
          ? {
              label: "Finish campaign content",
              detail: `${number(missingContentCount)} content item${missingContentCount === 1 ? "" : "s"} still need copy or assets.`,
              actionLabel: "Open content",
              onClick: () => setActiveView("overview")
            }
          : {
              label: "Capture results",
              detail: "Execution is moving. The next step is keeping website and revenue signals updated.",
              actionLabel: "Open results",
              onClick: () => setActiveView("performance")
            };
  const pipelineStages: Array<{
    id: CampaignPipelineStageId;
    label: string;
    value: string;
    state: "blocked" | "in-progress" | "ready" | "complete";
    onClick: () => void;
  }> = [
    {
      id: "goal",
      label: "Goal",
      value: `${completedCampaignGoals}/${number(campaignGoals.length || 0)}`,
      state: campaignGoals.length && openCampaignGoals === 0 ? "complete" : campaignGoals.length ? "in-progress" : "blocked",
      onClick: () => {
        setActiveView("overview");
        window.setTimeout(() => document.getElementById("campaign-goals")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
      }
    },
    {
      id: "tasks",
      label: "Tasks",
      value: number(campaignTasks.length),
      state: campaignTasks.length ? (openCampaignTasks ? "in-progress" : "complete") : "blocked",
      onClick: () => setActiveView("list")
    },
    {
      id: "content",
      label: "Content",
      value: number(linkedPosts.length),
      state: linkedPosts.length ? "in-progress" : "blocked",
      onClick: () => {
        setActiveView("overview");
        window.setTimeout(() => document.getElementById(contentComposerId)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
      }
    },
    {
      id: "approvals",
      label: "Approvals",
      value: number(campaignApprovals.length),
      state: pendingReviews ? "blocked" : campaignApprovals.length ? "complete" : "ready",
      onClick: () => setActiveView("list")
    },
    {
      id: "scheduled",
      label: "Scheduled",
      value: number(scheduledPosts.length),
      state: scheduledPosts.length ? "ready" : readyToSchedulePosts.length ? "in-progress" : "blocked",
      onClick: () => setActiveView("calendar")
    },
    {
      id: "results",
      label: "Results",
      value: currency(roiDraft.attributedRevenue || overview?.attributedRevenue || 0),
      state:
        (roiDraft.attributedRevenue || overview?.attributedRevenue || 0) > 0
          ? "complete"
          : googleAnalyticsCampaignImpact?.sessions
            ? "in-progress"
            : "blocked",
      onClick: () => setActiveView("performance")
    }
  ];

  const scrollToComposer = () => {
    window.setTimeout(() => {
      document.getElementById(contentComposerId)?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 80);
  };

  const resetComposer = () => {
    setTaskKind(null);
    setMobileComposerStep(1);
    setComposerTitleDraft("");
    setMobilePostStatus("Draft");
    setDraft(createCampaignPost(activeClient.id, campaignId));
    setTaskDraft(createCampaignTask(workspace.id, activeClient.id, campaignId));
    setErrors({});
    setTaskError(null);
  };

  const closeAddTaskFlow = () => {
    setAddTaskOpen(false);
    resetComposer();
  };

  const addCampaignGoal = () => {
    const trimmedGoal = goalDraft.trim();

    if (!trimmedGoal) {
      return;
    }

    saveCampaignGoals([
      ...campaignGoals,
      {
        id: `goal-${Date.now()}`,
        clientId: activeClient.id,
        campaignId,
        label: trimmedGoal,
        done: false,
        dueDate: goalDueDateDraft || undefined,
        assigneeName: goalAssigneeDraft.trim() || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]);
    setGoalDraft("");
    setGoalDueDateDraft("");
    setGoalAssigneeDraft("");
  };

  const toggleCampaignGoal = (goalId: string) => {
    saveCampaignGoals(
      campaignGoals.map((goal) =>
        goal.id === goalId ? { ...goal, done: !goal.done, updatedAt: new Date().toISOString() } : goal
      )
    );
  };

  const deleteCampaignGoal = (goalId: string) => {
    saveCampaignGoals(campaignGoals.filter((goal) => goal.id !== goalId));
  };

  const shareCampaign = () => {
    if (typeof window === "undefined") {
      return;
    }

    void navigator.clipboard?.writeText(window.location.href);
    setMobileMoreOpen(false);
  };

  const getBoardLanePosts = (lane: CampaignBoardLane) =>
    linkedPosts.filter((post) => {
      const approval = getPostApproval(post.id);

      if (lane === "Review") {
        return approval?.status === "Pending" || approval?.status === "Changes Requested";
      }

      return post.status === lane;
    });

  const savePost = async (status: PostStatus) => {
    const result = validatePost({ ...draft, status });

    if (!result.success) {
      setErrors(result.errors);
      return;
    }

    setSaving(true);

    try {
      await addPost({
        ...draft,
        ...result.data,
        clientId: activeClient.id,
        campaignId,
        status
      });
      resetComposer();
      setAddTaskOpen(false);
    } catch (error) {
      setErrors({
        form: error instanceof Error ? error.message : "Unable to create post for campaign."
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async (
    approvalId: string,
    status: "Approved" | "Changes Requested"
  ) => {
    setReviewingId(approvalId);

    try {
      await reviewApproval(approvalId, {
        status,
        approverName: profile?.fullName ?? profile?.email ?? "Workspace reviewer",
        approverUserId: profile?.id,
        note:
          status === "Approved"
            ? "Approved from the campaign workspace."
            : "Requested revisions from the campaign workspace."
      });
    } finally {
      setReviewingId(null);
    }
  };

  const runPublishJob = async (jobId: string) => {
    setProcessingJobId(jobId);

    try {
      await processJob(jobId);
    } finally {
      setProcessingJobId(null);
    }
  };

  const saveSelectedPostDetails = async () => {
    if (!selectedPostDraft) {
      return;
    }

    const result = validatePost(selectedPostDraft);

    if (!result.success) {
      setSelectedSaveError(Object.values(result.errors)[0] ?? "Review the post details.");
      return;
    }

    setSavingSelectedTask(true);
    setSelectedSaveError(null);

    try {
      const payload = await updatePost(selectedPostDraft.id, {
        platform: result.data.platform,
        content: result.data.content,
        format: selectedPostDraft.format,
        cta: result.data.cta,
        destinationUrl: selectedPostDraft.destinationUrl,
        publishDate: result.data.publishDate,
        goal: result.data.goal,
        status: result.data.status,
        assetState: selectedPostDraft.assetState,
        linkedTaskId: selectedPostDraft.linkedTaskId,
        plannerItemId: selectedPostDraft.plannerItemId,
        campaignId,
        assetIds: selectedPostDraft.assetIds
      });

      if (payload.approval && !getPostApproval(payload.approval.entityId)) {
        prependApproval(payload.approval);
      }

      setSelectedItem(null);
      setSelectedPostDraft(null);
    } catch (error) {
      setSelectedSaveError(error instanceof Error ? error.message : "Unable to update post.");
    } finally {
      setSavingSelectedTask(false);
    }
  };

  const sendSelectedPostToApproval = async () => {
    if (!selectedPostDraft) {
      return;
    }

    const scheduledDate = selectedPostDraft.publishDate || new Date().toISOString().slice(0, 10);
    setSelectedPostDraft((current) =>
      current
        ? {
            ...current,
            publishDate: scheduledDate,
            status: "Scheduled"
          }
        : current
    );

    const result = validatePost({
      ...selectedPostDraft,
      publishDate: scheduledDate,
      status: "Scheduled"
    });

    if (!result.success) {
      setSelectedSaveError(Object.values(result.errors)[0] ?? "Review the content details before requesting approval.");
      return;
    }

    setSavingSelectedTask(true);
    setSelectedSaveError(null);

    try {
      const payload = await updatePost(selectedPostDraft.id, {
        platform: result.data.platform,
        content: result.data.content,
        format: selectedPostDraft.format,
        cta: result.data.cta,
        destinationUrl: selectedPostDraft.destinationUrl,
        publishDate: scheduledDate,
        goal: result.data.goal,
        status: "Scheduled",
        assetState: selectedPostDraft.assetState,
        linkedTaskId: selectedPostDraft.linkedTaskId,
        plannerItemId: selectedPostDraft.plannerItemId,
        campaignId,
        assetIds: selectedPostDraft.assetIds
      });

      if (payload.approval && !getPostApproval(payload.approval.entityId)) {
        prependApproval(payload.approval);
      }
    } catch (error) {
      setSelectedSaveError(error instanceof Error ? error.message : "Unable to send content to approval.");
    } finally {
      setSavingSelectedTask(false);
    }
  };

  const reviewSelectedPost = async (
    status: "Approved" | "Changes Requested"
  ) => {
    if (selectedItem?.type !== "post") {
      return;
    }

    const approval = getPostApproval(selectedItem.item.id);

    if (!approval) {
      setSelectedSaveError("Schedule the post first so an approval request can be created.");
      return;
    }

    setSavingSelectedTask(true);
    setSelectedSaveError(null);

    try {
      await reviewApproval(approval.id, {
        status,
        approverName: profile?.fullName ?? profile?.email ?? "Workspace reviewer",
        approverUserId: profile?.id,
        note: selectedNote.trim() || (status === "Approved" ? "Approved from task details." : "Requested changes from task details.")
      });
      setSelectedNote("");
    } catch (error) {
      setSelectedSaveError(error instanceof Error ? error.message : "Unable to review post.");
    } finally {
      setSavingSelectedTask(false);
    }
  };

  const saveSelectedTaskDetails = async () => {
    if (!selectedTaskDraft) {
      return;
    }

    if (!selectedTaskDraft.title.trim()) {
      setSelectedSaveError("Task title is required.");
      return;
    }

    setSavingSelectedTask(true);
    setSelectedSaveError(null);

    try {
      const nextNotes = selectedNote.trim()
        ? [...(selectedTaskDraft.notes ?? []), selectedNote.trim()]
        : selectedTaskDraft.notes;
      await updateTask(selectedTaskDraft.id, {
        clientId: activeClient.id,
        title: selectedTaskDraft.title,
        detail: selectedTaskDraft.detail,
        taskType: selectedTaskDraft.taskType,
        status: selectedTaskDraft.status,
        priority: selectedTaskDraft.priority,
        startDate: selectedTaskDraft.startDate || undefined,
        dueDate: selectedTaskDraft.dueDate || undefined,
        isMilestone: selectedTaskDraft.isMilestone,
        blockedByTaskIds: selectedTaskDraft.blockedByTaskIds,
        linkedPostId: selectedTaskDraft.linkedPostId,
        notes: nextNotes,
        assigneeUserId: selectedTaskDraft.assigneeUserId,
        assigneeName: selectedTaskDraft.assigneeName,
        linkedEntityType: "campaign",
        linkedEntityId: campaignId
      });

      setSelectedItem(null);
      setSelectedTaskDraft(null);
      setSelectedNote("");
    } catch (error) {
      setSelectedSaveError(error instanceof Error ? error.message : "Unable to update task.");
    } finally {
      setSavingSelectedTask(false);
    }
  };

  const deleteSelectedPost = async () => {
    if (!selectedPostDraft) {
      return;
    }

    const confirmed = window.confirm(`Delete "${selectedPostDraft.goal || "this content task"}"?`);

    if (!confirmed) {
      return;
    }

    setDeletingSelectedItem(true);
    setSelectedSaveError(null);

    try {
      await deletePost(selectedPostDraft.id);
      setSelectedItem(null);
      setSelectedPostDraft(null);
    } catch (error) {
      setSelectedSaveError(error instanceof Error ? error.message : "Unable to delete content task.");
    } finally {
      setDeletingSelectedItem(false);
    }
  };

  const deleteSelectedTask = async () => {
    if (!selectedTaskDraft) {
      return;
    }

    const confirmed = window.confirm(`Delete "${selectedTaskDraft.title || "this task"}"?`);

    if (!confirmed) {
      return;
    }

    setDeletingSelectedItem(true);
    setSelectedSaveError(null);

    try {
      await deleteTask(selectedTaskDraft.id);
      setSelectedItem(null);
      setSelectedTaskDraft(null);
    } catch (error) {
      setSelectedSaveError(error instanceof Error ? error.message : "Unable to delete task.");
    } finally {
      setDeletingSelectedItem(false);
    }
  };

  const chooseTaskKind = (kind: CampaignTaskKind) => {
    setTaskKind(kind);
    setAddTaskOpen(false);
    setActiveView("overview");
    setMobileViewMenuOpen(false);
    setMobileMoreOpen(false);
    setErrors({});
    setTaskError(null);

    if (kind === "meeting") {
      setTaskDraft((current) => ({
        ...current,
        taskType: "Meeting",
        title: composerTitleDraft || current.title || "Schedule campaign check-in",
        detail: current.detail || "Meeting for this campaign."
      }));
    }

    if (kind === "task") {
      setTaskDraft((current) => ({
        ...current,
        taskType: "General",
        title: composerTitleDraft || current.title
      }));
    }

    if (kind === "content") {
      setDraft((current) => ({
        ...current,
        goal: composerTitleDraft || current.goal
      }));
    }

    scrollToComposer();
  };

  const chooseMobileTaskKind = (kind: CampaignTaskKind) => {
    setTaskKind(kind);
    if (kind === "content") {
      setDraft((current) => ({
        ...current,
        goal: composerTitleDraft || current.goal
      }));
    } else {
      setTaskDraft((current) => ({
        ...current,
        taskType: kind === "meeting" ? "Meeting" : "General",
        title: composerTitleDraft || current.title,
        detail: kind === "meeting" && !current.detail ? "Meeting for this campaign." : current.detail
      }));
    }
    setMobileComposerStep(3);
  };

  const canAdvanceComposerTitle = composerTitleDraft.trim().length > 0;
  const canAdvanceComposerDetails =
    taskKind === "content" ? draft.content.trim().length > 0 : taskDraft.detail.trim().length > 0;

  const saveOperationalTask = async () => {
    if (!taskDraft.title.trim()) {
      setTaskError("Task title is required.");
      return;
    }

    if (!taskDraft.detail.trim()) {
      setTaskError("Add a short detail so the task is useful later.");
      return;
    }

    setSavingTask(true);
    setTaskError(null);

    try {
      await createTask({
        ...taskDraft,
        workspaceId: workspace.id,
        clientId: activeClient.id,
        taskType:
          taskDraft.taskType ??
          (taskKind === "meeting" ? "Meeting" : taskKind === "content" ? "Content" : "General"),
        linkedEntityType: "campaign",
        linkedEntityId: campaignId,
        assigneeName: taskDraft.assigneeName || profile?.fullName || profile?.email || undefined,
        dueDate: taskDraft.dueDate || undefined
      });
      resetComposer();
      setAddTaskOpen(false);
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : "Unable to create campaign task.");
    } finally {
      setSavingTask(false);
    }
  };

  if (!campaignsReady || !postsReady || !approvalsReady || !jobsReady || !tasksReady || !roiReady || !campaignGoalsReady) {
    return <div className="text-sm text-muted-foreground">Loading campaign workspace...</div>;
  }

  if (campaignsError || postsError || tasksError || campaignGoalsError) {
    return <div className="text-sm text-destructive">{campaignsError ?? postsError ?? tasksError ?? campaignGoalsError}</div>;
  }

  if (!campaign || !overview) {
    return (
      <div className="space-y-10">
        <PageHeader
          eyebrow="Campaign"
          title="Campaign not found"
          description="This campaign could not be found for the active client."
          actions={
            <Link className={buttonVariants({ variant: "outline" })} href="/campaigns">
              Back to campaigns
            </Link>
          }
        />
        <EmptyState
          title="Campaign unavailable"
          description="Go back to campaigns and open a campaign that exists in the current client workspace."
        />
      </div>
    );
  }

  const activeViewLabel = campaignViews.find((view) => view.id === activeView)?.label ?? "Overview";
  const toggleOverviewSection = (section: CampaignOverviewSection) => {
    setOpenOverviewSections((current) =>
      current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section]
    );
  };
  const updateRoiNumber = (field: CampaignRoiNumberField, value: string) => {
    setRoiNumberDraft((current) => ({
      ...current,
      [field]: value
    }));
    setRoiDraft((current) => ({
      ...current,
      [field]: Number(value) || 0
    }));
  };
  const saveRoi = () => {
    saveRoiSnapshot({
      ...roiDraft,
      ...Object.fromEntries(
        Object.entries(roiNumberDraft).map(([field, value]) => [field, Number(value) || 0])
      )
    });
  };
  const roiNarrative =
    roiSummary.totalInvestment > 0 || roiDraft.attributedRevenue > 0
      ? `${campaign.name} has ${currency(roiDraft.attributedRevenue)} in tracked revenue against ${currency(roiSummary.totalInvestment)} in estimated investment, for a ${number(roiSummary.roiMultiple, 1)}x return.`
      : "Add investment and outcome data to turn this campaign into a clear ROI story.";
  const saveWebsiteAttribution = async () => {
    if (!campaign) {
      return;
    }

    if (!websiteDraft.landingPath.trim()) {
      setWebsiteError("Add a landing path so the campaign has a real destination.");
      return;
    }

    if (!websiteDraft.utmSource.trim() || !websiteDraft.utmMedium.trim()) {
      setWebsiteError("Choose a source and medium so Google Analytics can label this traffic correctly.");
      return;
    }

    setSavingWebsite(true);
    setWebsiteError(null);
    setWebsiteNotice(null);

    try {
      await updateCampaign({
        ...campaign,
        notes: composeCampaignMetadata({
          plainNotes: campaignMetadata?.plainNotes ?? "",
          defaultView: campaignDefaultView ?? "overview",
          website: {
            landingPath: websitePreviewPath,
            utmSource: websiteDraft.utmSource,
            utmMedium: websiteDraft.utmMedium,
            utmCampaign: websiteDraft.utmCampaign || slugifyCampaignName(campaign.name)
          }
        })
      });
      setWebsiteDraft((current) => ({
        ...current,
        landingPath: websitePreviewPath,
        utmCampaign: current.utmCampaign || slugifyCampaignName(campaign.name)
      }));
      setWebsiteNotice("Website handoff saved. Use the tagged link below when you share this campaign.");
    } catch (error) {
      setWebsiteError(
        error instanceof Error ? error.message : "Unable to save website attribution."
      );
    } finally {
      setSavingWebsite(false);
    }
  };

  const copyWebsiteHandoff = async () => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      await navigator.clipboard.writeText(websiteHandoff);
      setWebsiteNotice("Tagged campaign link copied.");
      setWebsiteError(null);
    } catch {
      setWebsiteError("Unable to copy the campaign link.");
    }
  };

  const schedulePostFromQueue = async (postId: string, publishDate: string) => {
    const post = linkedPosts.find((entry) => entry.id === postId);

    if (!post) {
      return;
    }

    try {
      const payload = await updatePost(postId, {
        platform: post.platform,
        content: post.content,
        format: post.format,
        cta: post.cta,
        destinationUrl: post.destinationUrl,
        publishDate,
        goal: post.goal,
        status: "Scheduled",
        assetState: post.assetState,
        linkedTaskId: post.linkedTaskId,
        plannerItemId: post.plannerItemId,
        campaignId,
        assetIds: post.assetIds
      });

      if (payload.approval && !getPostApproval(payload.approval.entityId)) {
        prependApproval(payload.approval);
      }
    } catch (error) {
      setSelectedSaveError(error instanceof Error ? error.message : "Unable to schedule content.");
    }
  };

  return (
    <div className="space-y-6 pb-28 sm:space-y-7 sm:pb-0">
      <div
        className="-mx-3 -mt-3 px-4 pb-6 pt-7 sm:hidden"
        style={{ backgroundColor: accent.bg, color: accent.text }}
      >
        <div className="flex items-center justify-between gap-4">
          <Link className="inline-flex items-center gap-2 text-lg" href="/campaigns">
            <ChevronLeft className="h-5 w-5" />
            Projects
          </Link>
          <div className="flex items-center gap-3">
            <button
              className="inline-flex h-9 items-center rounded-full px-2.5"
              style={{ backgroundColor: accent.panel }}
              type="button"
              onClick={() => {
                resetComposer();
                setAddTaskOpen(true);
              }}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold" style={{ backgroundColor: accent.soft }}>
                DC
              </span>
              <Plus className="ml-1 h-4 w-4" />
            </button>
            <div className="relative">
              <button
                aria-expanded={mobileMoreOpen}
                aria-label="Open project actions"
                className="rounded-full p-1.5"
                type="button"
                onClick={() => setMobileMoreOpen((current) => !current)}
              >
                <MoreHorizontal className="h-6 w-6" />
              </button>
              {mobileMoreOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.75rem)] z-[70] w-[16rem] rounded-[1.15rem] border border-black/10 bg-white p-2 text-[#202024] shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
                  <p className="px-3 pb-2 pt-1 text-xs uppercase tracking-[0.18em] text-black/45">
                    Project actions
                  </p>
                  <button
                    className="flex w-full items-center gap-3 rounded-[0.9rem] px-3 py-2.5 text-left text-sm font-medium transition hover:bg-black/[0.04]"
                    type="button"
                    onClick={() => chooseTaskKind("content")}
                  >
                    <Megaphone className="h-4 w-4" />
                    Add content
                  </button>
                  <button
                    className="flex w-full items-center gap-3 rounded-[0.9rem] px-3 py-2.5 text-left text-sm font-medium transition hover:bg-black/[0.04]"
                    type="button"
                    onClick={() => {
                      setActiveView("overview");
                      setMobileMoreOpen(false);
                      window.setTimeout(() => {
                        document.getElementById("campaign-goals")?.scrollIntoView({
                          behavior: "smooth",
                          block: "start"
                        });
                      }, 80);
                    }}
                  >
                    <Target className="h-4 w-4" />
                    Edit goals
                  </button>
                  <button
                    className="flex w-full items-center gap-3 rounded-[0.9rem] px-3 py-2.5 text-left text-sm font-medium transition hover:bg-black/[0.04]"
                    type="button"
                    onClick={() => {
                      setActiveView("calendar");
                      setMobileMoreOpen(false);
                    }}
                  >
                    <CalendarDays className="h-4 w-4" />
                    View calendar
                  </button>
                  <button
                    className="flex w-full items-center gap-3 rounded-[0.9rem] px-3 py-2.5 text-left text-sm font-medium transition hover:bg-black/[0.04]"
                    type="button"
                    onClick={shareCampaign}
                  >
                    <ArrowRight className="h-4 w-4" />
                    Copy project link
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="mt-7 flex items-center gap-3">
          <LayoutList className="h-7 w-7 shrink-0" />
          <h1 className="min-w-0 text-4xl font-semibold leading-[0.95] tracking-[-0.055em]">{campaign.name}</h1>
        </div>
      </div>

      <PageHeader
        className="hidden sm:flex"
        eyebrow="Campaign workspace"
        title={campaign.name}
        description={`${campaign.objective} · ${formatShortDate(campaign.startDate)} to ${formatShortDate(campaign.endDate)}`}
        actions={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link className={buttonVariants({ variant: "outline" })} href="/campaigns">
              Back to campaigns
            </Link>
            <Link className={buttonVariants({ variant: "outline" })} href="/calendar">
              View calendar
            </Link>
          </div>
        }
      />

      <Card id="campaign-workspace" className="relative z-20 hidden overflow-visible rounded-[1rem] p-0 shadow-none sm:block">
        <div className="border-b border-border/70 px-5 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="normal-case tracking-[0.1em]">{campaign.status}</Badge>
                <span className={["inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", campaignHealth.tone].join(" ")}>
                  {campaignHealth.label}
                </span>
                <DatePill value={campaign.startDate} />
                <span className="text-xs text-muted-foreground">to</span>
                <DatePill value={campaign.endDate} />
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{campaign.objective}</p>
            </div>
            <div className="relative">
            <Button className="w-full shrink-0 sm:w-auto" size="sm" onClick={() => setAddTaskOpen((current) => !current)}>
              Add task
            </Button>
            {addTaskOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.75rem)] z-[80] w-[28rem] max-w-[calc(100vw-3rem)] rounded-[1rem] border border-border bg-card p-2 shadow-[0_24px_80px_rgba(78,59,31,0.18)]">
                <p className="px-3 pb-2 pt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Add to campaign
                </p>
                <div className="grid gap-2">
                  {taskKindOptions.map((option) => {
                    const Icon = option.icon;

                    return (
                      <button
                        key={option.id}
                        className="grid grid-cols-[2.5rem_1fr] gap-3 rounded-[0.9rem] px-3 py-3 text-left transition hover:bg-primary/5"
                        type="button"
                        onClick={() => chooseTaskKind(option.id)}
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block text-sm font-medium text-foreground">{option.label}</span>
                          <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span><strong className="font-medium text-foreground">{number(linkedPosts.length + campaignTasks.length)}</strong> tasks</span>
            <span><strong className="font-medium text-foreground">{number(linkedPosts.length)}</strong> content</span>
            <span><strong className="font-medium text-foreground">{number(pendingReviews)}</strong> reviews</span>
            <span><strong className="font-medium text-foreground">{number(queuedPublishJobs)}</strong> publish jobs</span>
            <span><strong className="font-medium text-foreground">{number(openCampaignTasks)}</strong> open ops</span>
            <span><strong className="font-medium text-foreground">{currency(overview.attributedRevenue)}</strong> revenue</span>
          </div>
        </div>

        <div className="flex gap-5 overflow-x-auto px-5">
          {campaignViews.map((view) => {
            const selected = activeView === view.id;

            return (
              <button
                key={view.id}
                className={[
                  "border-b-2 px-0 py-3 text-sm font-medium transition",
                  selected
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                ].join(" ")}
                type="button"
                onClick={() => setActiveView(view.id)}
              >
                {view.label}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border/70 px-4 py-4 sm:px-5">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Campaign pipeline</p>
            <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-foreground">Goal to result</p>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 py-4 sm:grid sm:grid-cols-6 sm:px-5">
            {pipelineStages.map((stage) => (
              <button
                key={stage.id}
                className={[
                  "min-w-[8rem] rounded-[1rem] border px-3 py-3 text-left transition sm:min-w-0",
                  stage.state === "complete"
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : stage.state === "ready"
                      ? "border-[var(--app-accent-bg)]/30 bg-[var(--app-accent-soft)]"
                      : stage.state === "in-progress"
                        ? "border-border bg-card/70"
                        : "border-amber-500/25 bg-amber-500/10"
                ].join(" ")}
                type="button"
                onClick={stage.onClick}
              >
                <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">{stage.label}</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{stage.value}</p>
                <p className="mt-2 text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
                  {stage.state === "complete"
                    ? "Complete"
                    : stage.state === "ready"
                      ? "Ready"
                      : stage.state === "in-progress"
                        ? "Active"
                        : "Blocked"}
                </p>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-0">
          <div className="border-b border-border/70 px-4 py-4 sm:px-5">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Next action</p>
            <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-foreground">{nextAction.label}</p>
          </div>
          <div className="space-y-4 px-4 py-4 sm:px-5">
            <p className="text-sm leading-6 text-muted-foreground">{nextAction.detail}</p>
            <div className="flex items-center justify-between gap-3">
              <span className={["inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", campaignHealth.tone].join(" ")}>
                {campaignHealth.label}
              </span>
              <Button size="sm" type="button" onClick={nextAction.onClick}>
                {nextAction.actionLabel}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {activeView === "overview" ? (
      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <Card className="hidden xl:col-span-2 sm:block">
          <CardHeader>
            <div>
              <CardDescription>Effort to revenue pipeline</CardDescription>
              <CardTitle className="mt-3">How this campaign moves the business forward</CardTitle>
            </div>
          </CardHeader>
          <div className="grid gap-3 md:grid-cols-4">
            <ListCard>
              <p className="text-sm text-muted-foreground">Goals</p>
              <p className="mt-2 text-2xl text-foreground">
                {completedCampaignGoals}/{number(campaignGoals.length)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {openCampaignGoals ? `${openCampaignGoals} still open` : "All current goals are complete."}
              </p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Execution</p>
              <p className="mt-2 text-2xl text-foreground">{number(linkedPosts.length + campaignTasks.length)}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {pendingReviews} reviews · {openCampaignTasks} open tasks
              </p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Website response</p>
              <p className="mt-2 text-2xl text-foreground">{number(googleAnalyticsCampaignImpact?.sessions ?? 0)}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {websiteReady ? "Campaign sessions from tagged traffic." : "Save the tagged link to start reading website impact."}
              </p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Revenue result</p>
              <p className="mt-2 text-2xl text-foreground">
                {currency(roiDraft.attributedRevenue || overview.attributedRevenue)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {number(roiDraft.attributedCovers || overview.attributedCovers)} covers tracked so far.
              </p>
            </ListCard>
          </div>
        </Card>

        <Card className="border-[#3a3a40]/70 bg-[#202024] text-white shadow-none sm:hidden">
          <div className="rounded-[1.5rem] border border-white/15 p-5">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-white/35" />
                <span className="text-xl font-semibold">No status</span>
              </div>
              <button
                aria-label="Open project actions"
                className="rounded-full p-2 text-white/60"
                type="button"
                onClick={() => setMobileMoreOpen((current) => !current)}
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/5 px-5 py-4 text-center">
                <p className="text-sm text-white/50">Reviews</p>
                <p className="mt-3 text-4xl text-white/45">{number(pendingReviews)}</p>
              </div>
              <div className="rounded-2xl bg-white/5 px-5 py-4 text-center">
                <p className="text-sm text-white/50">Due</p>
                <p className="mt-3 text-4xl text-white/45">{number(queuedPublishJobs + openCampaignTasks)}</p>
              </div>
            </div>
            <div className="mt-5 h-2 rounded-full bg-white/5">
              <div
                className="h-2 rounded-full"
                style={{ backgroundColor: accent.bg, width: linkedPosts.length ? `${Math.round((linkedPosts.filter((post) => post.status === "Published").length / linkedPosts.length) * 100)}%` : "0%" }}
              />
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-white/55">
              <span>{linkedPosts.length ? Math.round((linkedPosts.filter((post) => post.status === "Published").length / linkedPosts.length) * 100) : 0}% complete</span>
              <span>{number(linkedPosts.length + campaignTasks.length)} total tasks</span>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-6">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold" style={{ backgroundColor: accent.bg, color: accent.text }}>
                DC
              </span>
              <div>
                <p className="text-sm text-white/45">Project Owner</p>
                <p className="text-lg text-white">Diego Castillo</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-white/35 text-white/65">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm text-white/45">Due date</p>
                <DatePill className="border-white/15 bg-white/10 text-white/75" value={campaign.endDate} />
              </div>
            </div>
          </div>

          <div className="mt-10 divide-y divide-white/10 overflow-hidden rounded-[1.35rem] border border-white/10 text-white">
            <div className="px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-white/45">Next action</p>
                  <p className="mt-1 text-lg font-semibold text-white">{nextAction.label}</p>
                  <p className="mt-2 text-sm leading-6 text-white/58">{nextAction.detail}</p>
                </div>
                <button
                  className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.14em] text-white/70"
                  type="button"
                  onClick={nextAction.onClick}
                >
                  {nextAction.actionLabel}
                </button>
              </div>
            </div>
            {[
              { id: "content" as const, label: "Connected content", value: linkedPosts.length },
              { id: "tasks" as const, label: "Campaign tasks", value: campaignTasks.length },
              { id: "approvals" as const, label: "Approvals", value: campaignApprovals.length },
              { id: "publishing" as const, label: "Publishing jobs", value: campaignPublishJobs.length },
              { id: "metrics" as const, label: "Weekly metrics", value: overview.linkedMetrics.length }
            ].map((section) => {
              const open = openOverviewSections.includes(section.id);

              return (
                <div key={section.id}>
                  <button
                    className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-white/[0.03]"
                    type="button"
                    onClick={() => toggleOverviewSection(section.id)}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <ChevronUp
                        className={[
                          "h-4 w-4 shrink-0 text-white/50 transition",
                          open ? "rotate-180" : "rotate-90"
                        ].join(" ")}
                      />
                      <span className="truncate text-lg">{section.label}</span>
                    </div>
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-sm text-white/60">
                      {section.value}
                    </span>
                  </button>
                  {open ? (
                    <div className="space-y-2 px-4 pb-4 text-sm text-white/58">
                      {section.id === "content" ? (
                        linkedPosts.length ? (
                          linkedPosts.slice(0, 4).map((post) => (
                            <button
                              className="block w-full rounded-[1rem] bg-white/[0.035] px-3 py-3 text-left"
                              key={post.id}
                              type="button"
                              onClick={() => setSelectedItem({ type: "post", item: post })}
                            >
                              <span className="block truncate font-medium text-white/86">{post.goal}</span>
                              <span className="mt-1 flex items-center gap-2 text-white/48">
                                {post.platform}
                                <DatePill value={post.publishDate} fallback="No date" />
                              </span>
                            </button>
                          ))
                        ) : (
                          <p className="rounded-[1rem] bg-white/[0.035] px-3 py-3">No connected content yet.</p>
                        )
                      ) : null}
                      {section.id === "tasks" ? (
                        campaignTasks.length ? (
                          campaignTasks.slice(0, 4).map((task) => (
                            <button
                              className="block w-full rounded-[1rem] bg-white/[0.035] px-3 py-3 text-left"
                              key={task.id}
                              type="button"
                              onClick={() => setSelectedItem({ type: "task", item: task })}
                            >
                              <span className="block truncate font-medium text-white/86">{task.title}</span>
                              <span className="mt-1 block text-white/48">{task.status} · {task.priority}</span>
                            </button>
                          ))
                        ) : (
                          <p className="rounded-[1rem] bg-white/[0.035] px-3 py-3">No campaign tasks yet.</p>
                        )
                      ) : null}
                      {section.id === "approvals" ? (
                        campaignApprovals.length ? (
                          campaignApprovals.slice(0, 4).map((approval) => (
                            <div className="rounded-[1rem] bg-white/[0.035] px-3 py-3" key={approval.id}>
                              <p className="truncate font-medium text-white/86">{approval.summary}</p>
                              <p className="mt-1 text-white/48">{approval.status}</p>
                            </div>
                          ))
                        ) : (
                          <p className="rounded-[1rem] bg-white/[0.035] px-3 py-3">No approvals yet.</p>
                        )
                      ) : null}
                      {section.id === "publishing" ? (
                        campaignPublishJobs.length ? (
                          campaignPublishJobs.slice(0, 4).map((job) => (
                            <div className="rounded-[1rem] bg-white/[0.035] px-3 py-3" key={job.id}>
                              <p className="truncate font-medium capitalize text-white/86">{job.provider}</p>
                              <p className="mt-1 text-white/48">{job.status}</p>
                            </div>
                          ))
                        ) : (
                          <p className="rounded-[1rem] bg-white/[0.035] px-3 py-3">No publishing jobs yet.</p>
                        )
                      ) : null}
                      {section.id === "metrics" ? (
                        overview.linkedMetrics.length ? (
                          overview.linkedMetrics.slice(0, 4).map((metric) => (
                            <div className="rounded-[1rem] bg-white/[0.035] px-3 py-3" key={metric.id}>
                              <p className="truncate font-medium text-white/86">{metric.weekLabel}</p>
                              <p className="mt-1 text-white/48">{number(metric.covers)} covers</p>
                            </div>
                          ))
                        ) : (
                          <p className="rounded-[1rem] bg-white/[0.035] px-3 py-3">No weekly metrics linked yet.</p>
                        )
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>

        <Card id="campaign-brief">
          <CardHeader>
            <div>
              <CardDescription>Campaign Plan</CardDescription>
              <CardTitle className="mt-3">What this campaign is trying to change</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <ListCard>
              <p className="text-sm text-muted-foreground">Objective</p>
              <p className="mt-2 text-lg text-foreground">{campaign.objective}</p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Launch window</p>
              <p className="mt-2 text-lg text-foreground">
                <DatePill value={campaign.startDate} /> <span className="text-sm text-muted-foreground">to</span> <DatePill value={campaign.endDate} />
              </p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Channels</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {campaign.channels.length ? (
                  campaign.channels.map((channel) => (
                    <span
                      className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                      key={channel}
                    >
                      {channel}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No channels added yet.</span>
                )}
              </div>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Notes</p>
              <p className="mt-2 text-sm text-foreground">
                {campaignMetadata?.plainNotes || "No campaign notes yet."}
              </p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Next moves</p>
              <div className="mt-3 space-y-2">
                {campaignNextMoves.length ? (
                  campaignNextMoves.map((item) => (
                    <p className="text-sm text-foreground" key={item}>
                      {item}
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    The campaign is clear of current blockers. Add the next task or publish step when you are ready.
                  </p>
                )}
              </div>
            </ListCard>
          </div>
        </Card>

        <Card id="campaign-goals">
          <CardHeader>
            <div>
              <CardDescription>Goals</CardDescription>
              <CardTitle className="mt-3">What needs to be true when this campaign is done</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-[1fr_10rem_12rem_auto]">
              <Input
                className="min-w-0"
                value={goalDraft}
                placeholder="Ex. Get owner approval on brunch creative"
                onChange={(event) => setGoalDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCampaignGoal();
                  }
                }}
              />
              <Input
                aria-label="Goal due date"
                className="h-10 min-w-0 px-3 text-[0.84rem] [color-scheme:light] [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left"
                type="date"
                value={goalDueDateDraft}
                onChange={(event) => setGoalDueDateDraft(event.target.value)}
              />
              <Input
                value={goalAssigneeDraft}
                placeholder={profile?.fullName ?? "Assignee"}
                onChange={(event) => setGoalAssigneeDraft(event.target.value)}
              />
              <Button className="shrink-0" type="button" variant="outline" onClick={addCampaignGoal}>
                Add goal
              </Button>
            </div>
            <div className="divide-y divide-border/70 overflow-hidden rounded-[1rem] border border-border/70">
              {campaignGoals.length ? (
                campaignGoals.map((goal) => (
                  <div className="flex items-center gap-3 bg-card px-3 py-3" key={goal.id}>
                    <button
                      aria-label={goal.done ? "Mark goal incomplete" : "Mark goal complete"}
                      className={[
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition",
                        goal.done
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:border-primary/45 hover:text-primary"
                      ].join(" ")}
                      type="button"
                      onClick={() => toggleCampaignGoal(goal.id)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <p
                      className={[
                        "min-w-0 flex-1 text-sm",
                        goal.done ? "text-muted-foreground line-through" : "text-foreground"
                      ].join(" ")}
                    >
                      {goal.label}
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground no-underline">
                        <DatePill value={goal.dueDate} fallback="No due date" />
                        {goal.assigneeName ? <span>{goal.assigneeName}</span> : null}
                      </span>
                    </p>
                    <button
                      aria-label="Delete goal"
                      className="rounded-full p-2 text-muted-foreground transition hover:bg-primary/5 hover:text-primary"
                      type="button"
                      onClick={() => deleteCampaignGoal(goal.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="bg-card px-4 py-5 text-sm text-muted-foreground">
                  Add the checkpoints that keep this campaign moving: approvals, creative, shoot prep, publish readiness, or ROI follow-up.
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card id={contentComposerId} className="hidden sm:block">
          <CardHeader>
            <div>
              <CardDescription>Add Task</CardDescription>
              <CardTitle className="mt-3">Choose what this campaign needs next</CardTitle>
            </div>
          </CardHeader>
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {taskKindOptions.map((option) => {
                const Icon = option.icon;
                const selected = taskKind === option.id;

                return (
                  <button
                    key={option.id}
                    className={[
                      "rounded-[1rem] border px-4 py-4 text-left transition",
                      selected
                        ? "border-primary/45 bg-primary/10"
                        : "border-border bg-card/70 hover:border-primary/30 hover:bg-primary/5"
                    ].join(" ")}
                    type="button"
                    onClick={() => chooseTaskKind(option.id)}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="mt-3 block font-medium text-foreground">{option.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span>
                  </button>
                );
              })}
            </div>

            {taskKind === "content" ? (
              <div className="grid gap-4 rounded-[1rem] border border-border/70 bg-muted/25 p-3 sm:p-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <Label>Platform</Label>
                    <Select
                      value={draft.platform}
                      onChange={(value) =>
                        setDraft((current) => ({ ...current, platform: value as Post["platform"] }))
                      }
                      options={["Instagram", "Facebook", "TikTok", "Email", "Stories"].map((value) => ({
                        label: value,
                        value
                      }))}
                    />
                  </div>
                  <div>
                    <Label>Format</Label>
                    <Select
                      value={draft.format ?? "Static"}
                      onChange={(value) =>
                        setDraft((current) => ({ ...current, format: value as NonNullable<Post["format"]> }))
                      }
                      options={contentFormatOptions.map((value) => ({
                        label: value,
                        value
                      }))}
                    />
                  </div>
                  <div>
                    <Label>Publish Date</Label>
                    <Input
                      className="h-10 min-w-0 px-3 text-[0.84rem] [color-scheme:light] [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left"
                      type="date"
                      value={draft.publishDate}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, publishDate: event.target.value }))
                      }
                    />
                    {errors.publishDate ? <p className="mt-2 text-xs text-primary">{errors.publishDate}</p> : null}
                  </div>
                  <div>
                    <Label>Asset state</Label>
                    <Select
                      value={draft.assetState ?? "Missing"}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          assetState: value as NonNullable<Post["assetState"]>
                        }))
                      }
                      options={["Missing", "In Progress", "Ready"].map((value) => ({
                        label: value,
                        value
                      }))}
                    />
                  </div>
                </div>
                <div>
                  <Label>Goal</Label>
                  <Input
                    value={draft.goal}
                    onChange={(event) => setDraft((current) => ({ ...current, goal: event.target.value }))}
                    placeholder="Push Thursday reservations"
                  />
                  {errors.goal ? <p className="mt-2 text-xs text-primary">{errors.goal}</p> : null}
                </div>
                <div>
                  <Label>Call To Action</Label>
                  <Input
                    value={draft.cta}
                    onChange={(event) => setDraft((current) => ({ ...current, cta: event.target.value }))}
                    placeholder="Reserve tonight"
                  />
                  {errors.cta ? <p className="mt-2 text-xs text-primary">{errors.cta}</p> : null}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Destination URL</Label>
                    <Input
                      value={draft.destinationUrl ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, destinationUrl: event.target.value }))
                      }
                      placeholder="/reserve"
                    />
                  </div>
                  <div>
                    <Label>Linked task</Label>
                    <Select
                      value={draft.linkedTaskId ?? ""}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          linkedTaskId: value || undefined
                        }))
                      }
                      options={[
                        { label: "No linked task", value: "" },
                        ...campaignTasks.map((task) => ({
                          label: task.title,
                          value: task.id
                        }))
                      ]}
                    />
                  </div>
                </div>
                <div>
                  <Label>Post Content</Label>
                  <Textarea
                    value={draft.content}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, content: event.target.value }))
                    }
                    placeholder="Write the caption, offer, or email copy for this campaign."
                  />
                  {errors.content ? <p className="mt-2 text-xs text-primary">{errors.content}</p> : null}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button disabled={saving} onClick={() => void savePost("Draft")} variant="outline">
                    Save Draft
                  </Button>
                  <Button disabled={saving} onClick={() => void savePost("Scheduled")}>
                    Save Scheduled
                  </Button>
                </div>
                {errors.form ? <p className="text-xs text-primary">{errors.form}</p> : null}
              </div>
            ) : null}

            {taskKind === "meeting" || taskKind === "task" ? (
              <div className="grid gap-4 rounded-[1rem] border border-border/70 bg-muted/25 p-3 sm:p-4">
                <div>
                  <Label>{taskKind === "meeting" ? "Meeting Name" : "Task Name"}</Label>
                  <Input
                    value={taskDraft.title}
                    onChange={(event) => setTaskDraft((current) => ({ ...current, title: event.target.value }))}
                    placeholder={taskKind === "meeting" ? "Ex. Campaign check-in with owner" : "Ex. Confirm brunch photo shot list"}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <Label>Task type</Label>
                    <Select
                      value={taskDraft.taskType ?? (taskKind === "meeting" ? "Meeting" : "General")}
                      onChange={(value) =>
                        setTaskDraft((current) => ({
                          ...current,
                          taskType: value as NonNullable<OperationalTask["taskType"]>
                        }))
                      }
                      options={[
                        { label: "Content", value: "Content" },
                        { label: "Meeting", value: "Meeting" },
                        { label: "General", value: "General" }
                      ]}
                    />
                  </div>
                  <div>
                    <Label>Start Date</Label>
                    <Input
                      className="h-10 min-w-0 px-3 text-[0.84rem] [color-scheme:light] [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left"
                      type="date"
                      value={taskDraft.startDate ?? ""}
                      onChange={(event) => setTaskDraft((current) => ({ ...current, startDate: event.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Due Date</Label>
                    <Input
                      className="h-10 min-w-0 px-3 text-[0.84rem] [color-scheme:light] [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left"
                      type="date"
                      value={taskDraft.dueDate ?? ""}
                      onChange={(event) => setTaskDraft((current) => ({ ...current, dueDate: event.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Assignee</Label>
                    <Input
                      value={taskDraft.assigneeName ?? ""}
                      onChange={(event) => setTaskDraft((current) => ({ ...current, assigneeName: event.target.value }))}
                      placeholder={profile?.fullName ?? "Name"}
                    />
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {taskPriorities.map((priority) => (
                        <button
                          key={priority}
                          className={[
                            "rounded-full border px-3 py-2 text-sm transition",
                            taskDraft.priority === priority
                              ? "border-primary/45 bg-primary/10 text-foreground"
                              : "border-border bg-card/70 text-muted-foreground hover:border-primary/25 hover:text-foreground"
                          ].join(" ")}
                          type="button"
                          onClick={() => setTaskDraft((current) => ({ ...current, priority }))}
                        >
                          {priority}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Dependency</Label>
                    <Select
                      value={taskDraft.blockedByTaskIds?.[0] ?? ""}
                      onChange={(value) =>
                        setTaskDraft((current) => ({
                          ...current,
                          blockedByTaskIds: value ? [value] : []
                        }))
                      }
                      options={[
                        { label: "No dependency", value: "" },
                        ...campaignTasks
                          .filter((task) => task.id !== taskDraft.id)
                          .map((task) => ({
                            label: task.title,
                            value: task.id
                          }))
                      ]}
                    />
                  </div>
                  <div>
                    <Label>Linked content</Label>
                    <Select
                      value={taskDraft.linkedPostId ?? ""}
                      onChange={(value) =>
                        setTaskDraft((current) => ({
                          ...current,
                          linkedPostId: value || undefined
                        }))
                      }
                      options={[
                        { label: "No linked content", value: "" },
                        ...linkedPosts.map((post) => ({
                          label: post.goal,
                          value: post.id
                        }))
                      ]}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-3 rounded-[0.95rem] border border-border/70 bg-card/70 px-4 py-3 text-sm text-foreground">
                  <input
                    checked={Boolean(taskDraft.isMilestone)}
                    className="h-4 w-4"
                    type="checkbox"
                    onChange={(event) =>
                      setTaskDraft((current) => ({ ...current, isMilestone: event.target.checked }))
                    }
                  />
                  Treat this as a campaign milestone
                </label>
                <div>
                  <Label>Details</Label>
                  <Textarea
                    value={taskDraft.detail}
                    onChange={(event) => setTaskDraft((current) => ({ ...current, detail: event.target.value }))}
                    placeholder={taskKind === "meeting" ? "What should this meeting cover?" : "What needs to happen?"}
                  />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button disabled={savingTask} onClick={() => void saveOperationalTask()}>
                    {savingTask ? "Saving..." : taskKind === "meeting" ? "Add Meeting" : "Add Task"}
                  </Button>
                  <Button disabled={savingTask} variant="outline" onClick={() => setTaskKind(null)}>
                    Cancel
                  </Button>
                </div>
                {taskError ? <p className="text-xs text-primary">{taskError}</p> : null}
              </div>
            ) : null}
          </div>
        </Card>
      </div>
      ) : null}

      {activeView === "list" ? (
      <Card id="campaign-list" className="overflow-hidden p-0">
        <CardHeader className="border-b border-border/70 px-4 py-4 sm:px-5">
          <div>
            <CardDescription>Campaign List</CardDescription>
            <CardTitle className="mt-2">Every task and content item in this campaign</CardTitle>
          </div>
        </CardHeader>
        <div className="hidden border-b border-border/70 bg-muted/30 px-4 py-2 text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_8rem_9rem_9rem_9rem] sm:px-5">
          <span>Task</span>
          <span>Status</span>
          <span>Approval</span>
          <span>Publish</span>
          <span>CTA</span>
        </div>
        <div className="divide-y divide-border/70">
          {linkedPosts.length || campaignTasks.length ? (
            <>
            {linkedPosts.map((post) => {
              const approval = getPostApproval(post.id);
              const publishJob = getPostPublishJob(post.id);
              const readiness = getPostReadiness(post, approval?.status, publishJob?.status);

              return (
                <div key={post.id}>
                  <button className="block w-full text-left" type="button" onClick={() => setSelectedItem({ type: "post", item: post })}>
                  <ListCard className="m-3 bg-[#202024] text-white sm:hidden">
                    <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3">
                      <CheckCircle2 className="h-6 w-6 text-white/55" />
                      <div className="min-w-0">
                        <p className="truncate text-lg font-medium text-white">{post.goal}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/55">
                          <span>{post.platform}</span>
                          <span>{post.format ?? "Content"}</span>
                          <DatePill value={post.publishDate} fallback="No date" />
                        </div>
                        <p className="mt-2 text-xs text-white/45">{readiness.nextStep}</p>
                      </div>
                      <MoreHorizontal className="h-5 w-5 text-white/55" />
                    </div>
                  </ListCard>
                  </button>
                  <button className="hidden w-full text-left sm:block" type="button" onClick={() => setSelectedItem({ type: "post", item: post })}>
                  <ListCard className="hidden rounded-none border-0 bg-transparent px-4 py-3 hover:bg-primary/5 sm:block sm:px-5">
                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem_9rem_9rem_9rem] sm:items-center">
                      <div>
                        <p className="font-medium text-foreground">{post.goal}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span>{post.platform}</span>
                          <span>{post.format ?? "Content"}</span>
                          <DatePill value={post.publishDate} fallback="No date" />
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{post.content}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                          Next step · {readiness.nextStep}
                        </p>
                      </div>
                      <div>
                        <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground lg:hidden">Status</p>
                        <span className={["mt-1 inline-flex rounded-full border px-2 py-1 text-[0.65rem] uppercase tracking-[0.16em] lg:mt-0", readiness.tone].join(" ")}>
                          {readiness.label}
                        </span>
                      </div>
                      <div>
                        <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground lg:hidden">Approval</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-primary lg:mt-0">{approval?.status ?? "No approval"}</p>
                      </div>
                      <div>
                        <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground lg:hidden">Publish</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground lg:mt-0">{publishJob?.status ?? "No publish job"}</p>
                      </div>
                      <div>
                        <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground lg:hidden">CTA</p>
                        <p className="mt-1 text-sm text-muted-foreground lg:mt-0">{post.cta || "No CTA"}</p>
                      </div>
                    </div>
                  </ListCard>
                  </button>
                </div>
              );
            })}
            {campaignTasks.map((task) => (
              <div key={task.id}>
                {(() => {
                  const taskState = getTaskVisualState(task);
                  return (
                    <>
                      <button className="block w-full text-left" type="button" onClick={() => setSelectedItem({ type: "task", item: task })}>
                        <ListCard className="m-3 bg-[#202024] text-white sm:hidden">
                          <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3">
                            <CheckCircle2 className="h-6 w-6 text-white/55" />
                            <div className="min-w-0">
                              <p className="truncate text-lg font-medium text-white">{task.title}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/55">
                                <span>{task.taskType ?? "General"}</span>
                                <span>{task.priority}</span>
                                <DatePill value={task.dueDate} fallback="No date" />
                              </div>
                              <p className="mt-2 text-xs text-white/45">{taskState.label}</p>
                            </div>
                            <MoreHorizontal className="h-5 w-5 text-white/55" />
                          </div>
                        </ListCard>
                      </button>
                      <button className="hidden w-full text-left sm:block" type="button" onClick={() => setSelectedItem({ type: "task", item: task })}>
                        <ListCard className="hidden rounded-none border-0 bg-transparent px-4 py-3 hover:bg-primary/5 sm:block sm:px-5">
                          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem_9rem_9rem_9rem] sm:items-center">
                            <div>
                              <p className="font-medium text-foreground">{task.title}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                <span>{task.taskType ?? "General"}</span>
                                <span>{task.priority}</span>
                                <DatePill value={task.dueDate} fallback="No date" />
                              </div>
                              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{task.detail}</p>
                              <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                {task.blockedByTaskIds?.length ? "Waiting on dependency" : "Ready to move"}
                              </p>
                            </div>
                            <span className={["inline-flex rounded-full border px-2 py-1 text-[0.65rem] uppercase tracking-[0.16em]", taskState.tone].join(" ")}>
                              {taskState.label}
                            </span>
                            <p className="text-xs uppercase tracking-[0.16em] text-primary">{task.taskType ?? "Task"}</p>
                            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">No publish job</p>
                            <p className="text-sm text-muted-foreground">{task.assigneeName || "Unassigned"}</p>
                          </div>
                        </ListCard>
                      </button>
                    </>
                  );
                })()}
              </div>
            ))}
            </>
          ) : (
            <EmptyState title="No campaign tasks yet" description="Use Overview to add content, meetings, or general tasks for this campaign." />
          )}
        </div>
      </Card>
      ) : null}

      {activeView === "board" ? (
      <Card id="campaign-board" className="overflow-hidden p-0">
        <CardHeader className="border-b border-border/70 px-4 py-4 sm:px-5">
          <div>
            <CardDescription>Campaign Board</CardDescription>
            <CardTitle className="mt-2">Pipeline from idea to published</CardTitle>
          </div>
        </CardHeader>
        <div className="overflow-x-auto p-3 sm:p-4">
          <div className="flex min-w-[58rem] items-start gap-3 rounded-[1.25rem] border border-border/70 bg-[radial-gradient(circle_at_20%_10%,rgba(189,156,87,0.08),transparent_26%),rgba(247,242,235,0.42)] p-3">
          {boardLanes.map((lane, laneIndex) => {
            const lanePosts = getBoardLanePosts(lane);
            const laneTasks =
              lane === "Draft"
                ? campaignTasks.filter((task) => task.status !== "Done")
                : lane === "Published"
                  ? campaignTasks.filter((task) => task.status === "Done")
                  : [];
            const laneItemCount = lanePosts.length + laneTasks.length;

            return (
              <div className="contents" key={lane}>
              <div className="min-h-[30rem] w-[18rem] shrink-0 rounded-[1rem] border border-border bg-card/82 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{lane}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {laneIndex === 0 ? "Start here" : laneIndex === boardLanes.length - 1 ? "Live or complete" : "Next step"}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{laneItemCount}</span>
                </div>
                <div className="mt-4 space-y-3">
                  {laneItemCount ? (
                    <>
                    {lanePosts.map((post) => {
                      const approval = getPostApproval(post.id);
                      const publishJob = getPostPublishJob(post.id);
                      const readiness = getPostReadiness(post, approval?.status, publishJob?.status);

                      return (
                        <button className="block w-full text-left" key={post.id} type="button" onClick={() => setSelectedItem({ type: "post", item: post })}>
                        <ListCard className="bg-card">
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-medium text-foreground">{post.goal}</p>
                            <span className="rounded-full bg-primary/10 px-2 py-1 text-[0.65rem] uppercase tracking-[0.12em] text-primary">
                              {post.platform}
                            </span>
                          </div>
                          <div className="mt-2">
                            <DatePill value={post.publishDate} fallback="No date" />
                          </div>
                          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{post.content}</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
                            <span>{post.format ?? "Content"}</span>
                            <span>{approval?.status ?? "No approval"}</span>
                            <span>{publishJob?.status ?? "No publish job"}</span>
                            <span>{readiness.nextStep}</span>
                          </div>
                        </ListCard>
                        </button>
                      );
                    })}
                    {laneTasks.map((task) => (
                      (() => {
                        const taskState = getTaskVisualState(task);
                        return (
                      <button className="block w-full text-left" key={task.id} type="button" onClick={() => setSelectedItem({ type: "task", item: task })}>
                      <ListCard className="bg-card">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-medium text-foreground">{task.title}</p>
                          <span className="rounded-full bg-primary/10 px-2 py-1 text-[0.65rem] uppercase tracking-[0.12em] text-primary">
                            {task.taskType ?? "Task"}
                          </span>
                        </div>
                        <div className="mt-2">
                          <DatePill value={task.dueDate} fallback="No date" />
                        </div>
                        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{task.detail}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
                          <span>{taskState.label}</span>
                          <span>{task.priority}</span>
                          {task.blockedByTaskIds?.length ? <span>Dependency</span> : null}
                        </div>
                      </ListCard>
                      </button>
                        );
                      })()
                    ))}
                    </>
                  ) : (
                    <button
                      className="w-full rounded-[0.9rem] border border-dashed border-border px-4 py-6 text-left text-sm text-muted-foreground transition hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
                      type="button"
                      onClick={() => setAddTaskOpen(true)}
                    >
                      + Add task here
                    </button>
                  )}
                </div>
              </div>
              {laneIndex < boardLanes.length - 1 ? (
                <div className="flex h-[30rem] shrink-0 items-center px-1 text-muted-foreground">
                  <ArrowRight className="h-5 w-5" />
                </div>
              ) : null}
              </div>
            );
          })}
          </div>
        </div>
      </Card>
      ) : null}

      {activeView === "calendar" ? (
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card id="scheduled-timeline">
          <CardHeader>
            <div>
              <CardDescription>Scheduled Timeline</CardDescription>
              <CardTitle className="mt-3">Every scheduled and dated item in one place</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {schedulingDays.map((day) => (
                <div
                  key={day.date}
                  className={[
                    "rounded-[1rem] border p-4 transition",
                    draggedReadyPostId ? "border-primary/30 bg-primary/5" : "border-border/70 bg-card/70"
                  ].join(" ")}
                  onDragOver={(event) => {
                    if (draggedReadyPostId) {
                      event.preventDefault();
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const postId = event.dataTransfer.getData("text/plain") || draggedReadyPostId;
                    if (postId) {
                      void schedulePostFromQueue(postId, day.date);
                    }
                    setDraggedReadyPostId(null);
                  }}
                >
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{day.label}</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {day.itemCount ? `${day.itemCount} scheduled` : "Gap"}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {day.itemCount ? "Content is already planned for this day." : "Drop a ready item here to schedule it."}
                  </p>
                </div>
              ))}
            </div>
            {scheduleGaps.length ? (
              <div className="rounded-[1rem] border border-amber-500/25 bg-amber-500/10 p-4">
                <p className="text-sm font-medium text-foreground">Schedule gaps</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Nothing is scheduled for {scheduleGaps.map((day) => day.label).join(", ")}. Use the ready queue to fill those gaps.
                </p>
              </div>
            ) : null}
            {unifiedCalendarItems.length ? (
              unifiedCalendarItems.map((entry) => (
                <ListCard key={entry.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={[
                            "inline-flex rounded-full border px-2 py-1 text-[0.65rem] uppercase tracking-[0.14em]",
                            entry.kind === "content"
                              ? "border-primary/25 bg-primary/10 text-primary"
                              : entry.kind === "milestone"
                                ? "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                                : "border-border bg-muted/30 text-muted-foreground"
                          ].join(" ")}
                        >
                          {entry.kind}
                        </span>
                        <DatePill value={entry.date} fallback="No date" />
                      </div>
                      <p className="mt-2 font-medium text-foreground">{entry.title}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{entry.detail}</p>
                    </div>
                    <p className="text-right text-xs uppercase tracking-[0.16em] text-muted-foreground">{entry.status}</p>
                  </div>
                </ListCard>
              ))
            ) : (
              <EmptyState
                title="Nothing scheduled yet"
                description="Add a scheduled post in this campaign and it will appear in the timeline and on the calendar."
              />
            )}
          </div>
        </Card>
        <Card id="ready-to-schedule">
          <CardHeader>
            <div>
              <CardDescription>Ready queue</CardDescription>
              <CardTitle className="mt-3">Ready but still unscheduled</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            {readyToSchedulePosts.length ? (
              readyToSchedulePosts.map((post) => (
                <button
                  className="block w-full text-left"
                  key={post.id}
                  type="button"
                  onClick={() => setSelectedItem({ type: "post", item: post })}
                >
                  <div
                    draggable
                    onDragStart={(event: DragEvent<HTMLDivElement>) => {
                      event.dataTransfer.setData("text/plain", post.id);
                      setDraggedReadyPostId(post.id);
                    }}
                    onDragEnd={() => setDraggedReadyPostId(null)}
                  >
                  <ListCard>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-foreground">{post.goal}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {post.platform} · {post.format ?? "Content"} · assets {post.assetState ?? "Missing"}
                        </p>
                      </div>
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[0.65rem] uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                        Ready
                      </span>
                    </div>
                  </ListCard>
                  </div>
                </button>
              ))
            ) : (
              <EmptyState
                title="No ready items"
                description="Approved content without a publish time will show up here so it can be scheduled quickly."
              />
            )}
          </div>
        </Card>
      </div>
      ) : null}

      {activeView === "performance" ? (
      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardDescription>Pipeline read</CardDescription>
              <CardTitle className="mt-3">From campaign work to business result</CardTitle>
            </div>
          </CardHeader>
          <div className="grid gap-3 md:grid-cols-4">
            <ListCard>
              <p className="text-sm text-muted-foreground">Work in motion</p>
              <p className="mt-2 text-2xl text-foreground">{number(linkedPosts.length + campaignTasks.length)}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {pendingReviews} reviews and {queuedPublishJobs} publish jobs are still in flight.
              </p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Website traffic</p>
              <p className="mt-2 text-2xl text-foreground">{number(googleAnalyticsCampaignImpact?.sessions ?? 0)}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {googleAnalyticsCampaignImpact?.topSources[0]?.label
                  ? `${googleAnalyticsCampaignImpact.topSources[0].label} is the strongest source.`
                  : "No campaign-attributed source yet."}
              </p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Intent</p>
              <p className="mt-2 text-2xl text-foreground">{number(googleAnalyticsCampaignImpact?.events ?? 0)}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Website actions tied to this campaign window and tagged path.
              </p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="mt-2 text-2xl text-foreground">{currency(roiDraft.attributedRevenue || overview.attributedRevenue)}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {number(roiDraft.attributedCovers || overview.attributedCovers)} covers and {number(overview.attributedTables, 1)} tables linked so far.
              </p>
            </ListCard>
          </div>
          <div className="mt-4 rounded-[1rem] border border-border/70 bg-muted/25 p-4">
            <p className="text-sm leading-6 text-muted-foreground">{pipelineRead}</p>
          </div>
        </Card>

        <Card id="roi-story" className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardDescription>Campaign ROI</CardDescription>
              <CardTitle className="mt-3">Turn the work into a business result</CardTitle>
            </div>
          </CardHeader>
          <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
            <div className="rounded-[1rem] border border-border/70 bg-muted/25 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="normal-case tracking-[0.1em]">{roiSummary.status}</Badge>
                {roiError ? <span className="text-xs text-primary">{roiError}</span> : null}
              </div>
              <p className="mt-4 text-balance text-xl font-medium leading-8 text-foreground">
                {roiNarrative}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <ListCard>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Investment</p>
                  <p className="mt-2 text-2xl text-foreground">{currency(roiSummary.totalInvestment)}</p>
                </ListCard>
                <ListCard>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tracked revenue</p>
                  <p className="mt-2 text-2xl text-foreground">{currency(roiDraft.attributedRevenue)}</p>
                </ListCard>
                <ListCard>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Net lift</p>
                  <p className="mt-2 text-2xl text-foreground">{currency(roiSummary.netReturn)}</p>
                </ListCard>
                <ListCard>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">ROI multiple</p>
                  <p className="mt-2 text-2xl text-foreground">{number(roiSummary.roiMultiple, 1)}x</p>
                </ListCard>
              </div>
              <div className="mt-4 rounded-[1rem] border border-border/70 bg-card/80 p-4">
                <p className="text-sm font-medium text-foreground">Next recommendation</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {roiDraft.nextRecommendation || "Add the next action once you know whether to scale, adjust, or pause the campaign."}
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Ad spend", "adSpend"],
                  ["Production cost", "productionCost"],
                  ["Agency hours", "agencyHours"],
                  ["Monthly rate", "hourlyRate"],
                  ["Other cost", "otherCost"],
                  ["Revenue", "attributedRevenue"],
                  ["Covers", "attributedCovers"],
                  ["Bookings", "attributedBookings"]
                ].map(([label, field]) => (
                  <div key={field}>
                    <Label>{label}</Label>
                    <Input
                      inputMode="decimal"
                      type="number"
                      value={roiNumberDraft[field as CampaignRoiNumberField]}
                      onChange={(event) => updateRoiNumber(field as CampaignRoiNumberField, event.target.value)}
                    />
                  </div>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Reach", "reach"],
                  ["Engagement", "engagement"],
                  ["Clicks", "clicks"]
                ].map(([label, field]) => (
                  <div key={field}>
                    <Label>{label}</Label>
                    <Input
                      inputMode="numeric"
                      type="number"
                      value={roiNumberDraft[field as CampaignRoiNumberField]}
                      onChange={(event) => updateRoiNumber(field as CampaignRoiNumberField, event.target.value)}
                    />
                  </div>
                ))}
              </div>
              <div>
                <Label>Top performer</Label>
                <Input
                  value={roiDraft.topPerformer}
                  placeholder="Ex. Friday brunch reel"
                  onChange={(event) => setRoiDraft((current) => ({ ...current, topPerformer: event.target.value }))}
                />
              </div>
              <div>
                <Label>Result summary</Label>
                <Textarea
                  value={roiDraft.resultSummary}
                  placeholder="What changed after this campaign ran?"
                  onChange={(event) => setRoiDraft((current) => ({ ...current, resultSummary: event.target.value }))}
                />
              </div>
              <div>
                <Label>Next recommendation</Label>
                <Textarea
                  value={roiDraft.nextRecommendation}
                  placeholder="What should the restaurant do next?"
                  onChange={(event) => setRoiDraft((current) => ({ ...current, nextRecommendation: event.target.value }))}
                />
              </div>
              <Button onClick={saveRoi}>Save ROI Snapshot</Button>
            </div>
          </div>
        </Card>

        <Card id="performance-snapshot">
          <CardHeader>
            <div>
              <CardDescription>Linked Data</CardDescription>
              <CardTitle className="mt-3">Signals already attached to this campaign</CardTitle>
            </div>
          </CardHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <ListCard>
              <p className="text-sm text-muted-foreground">Analytics revenue</p>
              <p className="mt-2 text-2xl text-foreground">{currency(overview.attributedRevenue)}</p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Analytics covers</p>
              <p className="mt-2 text-2xl text-foreground">{number(overview.attributedCovers)}</p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Analytics tables</p>
              <p className="mt-2 text-2xl text-foreground">{number(overview.attributedTables, 1)}</p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Linked weekly metrics</p>
              <p className="mt-2 text-2xl text-foreground">{number(overview.linkedMetrics.length)}</p>
            </ListCard>
          </div>
        </Card>

        <Card id="website-attribution">
          <CardHeader>
            <div>
              <CardDescription>Website handoff</CardDescription>
              <CardTitle className="mt-3">Give this campaign a website path you can track</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <ListCard>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Attribution readiness</p>
                  <p className="mt-2 text-sm text-foreground">{websiteActionMessage}</p>
                </div>
                <Badge
                  className={
                    websiteReady
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {websiteReady ? "Ready to track" : "Needs tagged link"}
                </Badge>
              </div>
            </ListCard>

            <div className="flex flex-wrap gap-2">
              {utmSourcePresets.map((preset) => (
                <Button
                  key={preset.label}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setWebsiteDraft((current) => ({
                      ...current,
                      utmSource: preset.source,
                      utmMedium: preset.medium,
                      utmCampaign: current.utmCampaign || slugifyCampaignName(campaign.name)
                    }))
                  }
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Landing path</Label>
                <Input
                  value={websiteDraft.landingPath}
                  placeholder="/menu/wine"
                  onChange={(event) =>
                    setWebsiteDraft((current) => ({
                      ...current,
                      landingPath: event.target.value
                    }))
                  }
                />
              </div>
              <div>
                <Label>UTM campaign</Label>
                <Input
                  value={websiteDraft.utmCampaign}
                  placeholder={slugifyCampaignName(campaign.name)}
                  onChange={(event) =>
                    setWebsiteDraft((current) => ({
                      ...current,
                      utmCampaign: event.target.value
                    }))
                  }
                />
              </div>
              <div>
                <Label>UTM source</Label>
                <Input
                  value={websiteDraft.utmSource}
                  placeholder="facebook"
                  onChange={(event) =>
                    setWebsiteDraft((current) => ({
                      ...current,
                      utmSource: event.target.value
                    }))
                  }
                />
              </div>
              <div>
                <Label>UTM medium</Label>
                <Input
                  value={websiteDraft.utmMedium}
                  placeholder="social"
                  onChange={(event) =>
                    setWebsiteDraft((current) => ({
                      ...current,
                      utmMedium: event.target.value
                    }))
                  }
                />
              </div>
            </div>

            <ListCard>
              <p className="text-sm text-muted-foreground">Campaign link preview</p>
              <p className="mt-2 break-all text-sm text-foreground">{websiteHandoff}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Use this handoff when you link from ads, posts, stories, or QR codes so the traffic read stays cleaner in web analytics.
              </p>
            </ListCard>

            <ListCard>
              <p className="text-sm text-muted-foreground">Current website read</p>
              <p className="mt-2 text-sm text-foreground">
                {googleAnalyticsCampaignImpact?.ready
                  ? googleAnalyticsCampaignImpact.summary
                  : googleAnalyticsSummary?.topPages[0]
                    ? `${googleAnalyticsSummary.topPages[0].path} is the strongest landing page right now, and ${googleAnalyticsSummary.topSources[0]?.label ?? "Direct / unknown"} is the strongest traffic source.`
                    : "Sync Google Analytics from the Web Analytics page to compare campaign handoff choices against live website behavior."}
              </p>
            </ListCard>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button onClick={() => void saveWebsiteAttribution()} disabled={savingWebsite}>
                {savingWebsite ? "Saving..." : "Save website handoff"}
              </Button>
              <Button onClick={() => void copyWebsiteHandoff()} size="sm" variant="outline">
                Copy tagged link
              </Button>
              <Link className={buttonVariants({ variant: "outline" })} href="/web-analytics">
                Open web analytics
              </Link>
            </div>
            {websiteNotice ? <p className="text-xs text-emerald-700 dark:text-emerald-300">{websiteNotice}</p> : null}
            {websiteError ? <p className="text-xs text-primary">{websiteError}</p> : null}
          </div>
        </Card>

        <Card id="website-impact">
          <CardHeader>
            <div>
              <CardDescription>Website impact</CardDescription>
              <CardTitle className="mt-3">What this campaign is doing on the site</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <ListCard>
              <p className="text-sm leading-6 text-muted-foreground">
                {googleAnalyticsCampaignImpact?.summary ??
                  "Save the website handoff and sync Google Analytics so this campaign can show its own website read here."}
              </p>
            </ListCard>
            <div className="grid gap-3 md:grid-cols-2">
              <ListCard>
                <p className="text-sm text-muted-foreground">Campaign sessions</p>
                <p className="mt-2 text-2xl text-foreground">
                  {number(googleAnalyticsCampaignImpact?.sessions ?? 0)}
                </p>
              </ListCard>
              <ListCard>
                <p className="text-sm text-muted-foreground">Campaign views</p>
                <p className="mt-2 text-2xl text-foreground">
                  {number(googleAnalyticsCampaignImpact?.views ?? 0)}
                </p>
              </ListCard>
              <ListCard>
                <p className="text-sm text-muted-foreground">Strongest source</p>
                <p className="mt-2 text-lg text-foreground">
                  {googleAnalyticsCampaignImpact?.topSources[0]?.label ?? "No source yet"}
                </p>
              </ListCard>
              <ListCard>
                <p className="text-sm text-muted-foreground">Top campaign page</p>
                <p className="mt-2 text-lg text-foreground">
                  {googleAnalyticsCampaignImpact?.topPages[0]?.path ?? websitePreviewPath}
                </p>
              </ListCard>
            </div>
          </div>
        </Card>

        <Card id="publishing-queue">
          <CardHeader>
            <div>
              <CardDescription>Publishing Queue</CardDescription>
              <CardTitle className="mt-3">Publishing status for campaign content</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            {campaignPublishJobs.length ? (
              campaignPublishJobs.map((job) => {
                const linkedPost = overview.linkedPosts.find((post) => post.id === job.postId);

                return (
                  <ListCard key={job.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium capitalize text-foreground">{job.provider}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {linkedPost ? linkedPost.goal : "Scheduled publish"}
                          <span className="mt-2 block">
                            <DatePill value={job.scheduledFor} />
                          </span>
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">{job.detail}</p>
                      </div>
                      <p className="text-xs uppercase tracking-[0.16em] text-primary">{job.status}</p>
                    </div>
                    {job.errorMessage ? (
                      <p className="mt-3 text-sm text-primary">{job.errorMessage}</p>
                    ) : null}
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <Button
                        disabled={processingJobId === job.id}
                        onClick={() => void runPublishJob(job.id)}
                        size="sm"
                        variant="outline"
                      >
                        {processingJobId === job.id ? "Running..." : "Run Publish"}
                      </Button>
                    </div>
                  </ListCard>
                );
              })
            ) : (
              <EmptyState
                title="No publish jobs yet"
                description="Scheduled social posts inside this campaign will create publish jobs automatically."
              />
            )}
          </div>
        </Card>
      </div>
      ) : null}

      {activeView === "list" ? (
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card id="approval-queue">
          <CardHeader>
            <div>
              <CardDescription>Approval Queue</CardDescription>
              <CardTitle className="mt-3">Review what is still blocking launch</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            {campaignApprovals.length ? (
              campaignApprovals.map((approval) => (
                <ListCard key={approval.id}>
                  <p className="font-medium text-foreground">{approval.summary}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>Waiting on {approval.requesterName}</span>
                    <DatePill value={approval.requestedAt} />
                  </div>
                  {approval.note ? <p className="mt-2 text-sm text-muted-foreground">{approval.note}</p> : null}
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {approval.status === "Pending"
                      ? "Decision required"
                      : approval.status === "Changes Requested"
                        ? "Changes requested"
                        : "Approved"}
                  </p>
                  {approval.status === "Pending" ? (
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <Button
                        disabled={reviewingId === approval.id}
                        onClick={() => void handleReview(approval.id, "Approved")}
                        size="sm"
                      >
                        Approve
                      </Button>
                      <Button
                        disabled={reviewingId === approval.id}
                        onClick={() => void handleReview(approval.id, "Changes Requested")}
                        size="sm"
                        variant="outline"
                      >
                        Request Changes
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-4 text-xs uppercase tracking-[0.16em] text-primary">
                      {approval.status}
                    </p>
                  )}
                </ListCard>
              ))
            ) : (
              <EmptyState
                title="No campaign approvals"
                description="Approvals for posts created in this campaign will appear here automatically."
              />
            )}
          </div>
        </Card>
      </div>
      ) : null}

      {addTaskOpen ? (
        <div className="fixed inset-0 z-50 bg-black/35 sm:hidden" onClick={closeAddTaskFlow}>
          <div
            className="absolute inset-x-3 bottom-[5.25rem] flex max-h-[78vh] flex-col overflow-hidden rounded-[1.5rem] border border-white/12 bg-[#202024] text-white shadow-[0_24px_80px_rgba(0,0,0,0.36)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 border-b border-white/10 bg-[#202024] px-4 pb-3 pt-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                    Add to campaign · Step {mobileComposerStep} of 4
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {mobileComposerStep === 1
                      ? "Start with the title"
                      : mobileComposerStep === 2
                        ? "Choose the work type"
                        : mobileComposerStep === 3
                          ? "Add details"
                          : "Set timing and status"}
                  </p>
                </div>
                <button
                  aria-label="Close add task"
                  className="rounded-full border border-white/12 p-2 text-white/60"
                  type="button"
                  onClick={closeAddTaskFlow}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 [-webkit-overflow-scrolling:touch]">
              {mobileComposerStep === 1 ? (
                <div className="space-y-4">
                  <div className="rounded-[1.15rem] bg-white/[0.04] p-4">
                    <Label className="text-white">Title</Label>
                    <Input
                      className="mt-3 border-white/10 bg-white/[0.04] text-white placeholder:text-white/35"
                      value={composerTitleDraft}
                      placeholder="Ex. Push Thursday reservations"
                      onChange={(event) => setComposerTitleDraft(event.target.value)}
                    />
                    <p className="mt-3 text-sm leading-6 text-white/50">
                      Name the work first so the rest of the setup stays focused.
                    </p>
                  </div>
                </div>
              ) : null}

              {mobileComposerStep === 2 ? (
                <div className="space-y-4">
                  <div className="rounded-[1.15rem] bg-white/[0.04] p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/45">Campaign</p>
                    <p className="mt-2 text-lg font-semibold text-white">{campaign.name}</p>
                    <p className="mt-1 text-sm text-white/55">{campaign.objective}</p>
                  </div>
                  <div className="grid gap-2">
                    {taskKindOptions.map((option) => {
                      const Icon = option.icon;
                      const selected = taskKind === option.id;

                      return (
                        <button
                          key={option.id}
                          className={[
                            "grid grid-cols-[2.75rem_1fr] gap-3 rounded-[1.15rem] px-3 py-3 text-left transition",
                            selected ? "bg-white/[0.12]" : "bg-white/[0.04] hover:bg-white/[0.08]"
                          ].join(" ")}
                          type="button"
                          onClick={() => chooseMobileTaskKind(option.id)}
                        >
                          <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: accent.soft, color: accent.bg }}>
                            <Icon className="h-5 w-5" />
                          </span>
                          <span>
                            <span className="block text-base font-semibold text-white">{option.label}</span>
                            <span className="mt-1 block text-sm leading-5 text-white/55">{option.description}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {mobileComposerStep === 3 && taskKind === "content" ? (
                <div className="space-y-4">
                  <div className="rounded-[1.15rem] bg-white/[0.04] p-4">
                    <Label className="text-white">Content</Label>
                    <Textarea
                      className="mt-3 border-white/10 bg-white/[0.04] text-white placeholder:text-white/35"
                      value={draft.content}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, content: event.target.value }))
                      }
                      placeholder="Write the caption, offer, or message."
                    />
                  </div>
                  <div className="rounded-[1.15rem] bg-white/[0.04] p-4">
                    <Label className="text-white">Format</Label>
                    <Select
                      value={draft.format ?? "Static"}
                      onChange={(value) =>
                        setDraft((current) => ({ ...current, format: value as NonNullable<Post["format"]> }))
                      }
                      options={contentFormatOptions.map((value) => ({ label: value, value }))}
                    />
                  </div>
                  <div className="rounded-[1.15rem] bg-white/[0.04] p-4">
                    <Label className="text-white">Call to action</Label>
                    <Input
                      className="mt-3 border-white/10 bg-white/[0.04] text-white placeholder:text-white/35"
                      value={draft.cta}
                      onChange={(event) => setDraft((current) => ({ ...current, cta: event.target.value }))}
                      placeholder="Reserve tonight"
                    />
                  </div>
                  <div className="rounded-[1.15rem] bg-white/[0.04] p-4">
                    <Label className="text-white">Destination URL</Label>
                    <Input
                      className="mt-3 border-white/10 bg-white/[0.04] text-white placeholder:text-white/35"
                      value={draft.destinationUrl ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, destinationUrl: event.target.value }))
                      }
                      placeholder="/reserve"
                    />
                  </div>
                </div>
              ) : null}

              {mobileComposerStep === 3 && (taskKind === "meeting" || taskKind === "task") ? (
                <div className="space-y-4">
                  <div className="rounded-[1.15rem] bg-white/[0.04] p-4">
                    <Label className="text-white">Details</Label>
                    <Textarea
                      className="mt-3 border-white/10 bg-white/[0.04] text-white placeholder:text-white/35"
                      value={taskDraft.detail}
                      onChange={(event) => setTaskDraft((current) => ({ ...current, detail: event.target.value }))}
                      placeholder={taskKind === "meeting" ? "What should this meeting cover?" : "What needs to happen?"}
                    />
                  </div>
                  <div className="rounded-[1.15rem] bg-white/[0.04] p-4">
                    <Label className="text-white">Assignee</Label>
                    <Input
                      className="mt-3 border-white/10 bg-white/[0.04] text-white placeholder:text-white/35"
                      value={taskDraft.assigneeName ?? ""}
                      onChange={(event) => setTaskDraft((current) => ({ ...current, assigneeName: event.target.value }))}
                      placeholder={profile?.fullName ?? "Name"}
                    />
                  </div>
                  <label className="flex items-center gap-3 rounded-[1.15rem] bg-white/[0.04] p-4 text-sm text-white">
                    <input
                      checked={Boolean(taskDraft.isMilestone)}
                      className="h-4 w-4"
                      type="checkbox"
                      onChange={(event) =>
                        setTaskDraft((current) => ({ ...current, isMilestone: event.target.checked }))
                      }
                    />
                    Mark this as a milestone
                  </label>
                </div>
              ) : null}

              {mobileComposerStep === 4 && taskKind === "content" ? (
                <div className="space-y-4">
                  <div className="rounded-[1.15rem] bg-white/[0.04] p-4">
                    <Label className="text-white">Platform</Label>
                    <Select
                      value={draft.platform}
                      onChange={(value) =>
                        setDraft((current) => ({ ...current, platform: value as Post["platform"] }))
                      }
                      options={platformOptions.map((value) => ({ label: value, value }))}
                    />
                  </div>
                  <div className="rounded-[1.15rem] bg-white/[0.04] p-4">
                    <Label className="text-white">Asset state</Label>
                    <Select
                      value={draft.assetState ?? "Missing"}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          assetState: value as NonNullable<Post["assetState"]>
                        }))
                      }
                      options={["Missing", "In Progress", "Ready"].map((value) => ({ label: value, value }))}
                    />
                  </div>
                  <div className="rounded-[1.15rem] bg-white/[0.04] p-4">
                    <Label className="text-white">Publish date</Label>
                    <Input
                      className="mt-3 h-10 min-w-0 border-white/10 bg-white/[0.04] px-3 text-[0.84rem] text-white [color-scheme:dark] [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left"
                      type="date"
                      value={draft.publishDate}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, publishDate: event.target.value }))
                      }
                    />
                  </div>
                  <div className="rounded-[1.15rem] bg-white/[0.04] p-4">
                    <Label className="text-white">Status</Label>
                    <div className="mt-3 flex gap-2">
                      {postStatuses.map((status) => (
                        <button
                          key={status}
                          className={[
                            "rounded-full border px-3 py-2 text-sm transition",
                            mobilePostStatus === status
                              ? "border-white/20 bg-white text-[#202024]"
                              : "border-white/12 bg-white/[0.04] text-white/70"
                          ].join(" ")}
                          type="button"
                          onClick={() => setMobilePostStatus(status)}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {mobileComposerStep === 4 && (taskKind === "meeting" || taskKind === "task") ? (
                <div className="space-y-4">
                  <div className="rounded-[1.15rem] bg-white/[0.04] p-4">
                    <Label className="text-white">Start date</Label>
                    <Input
                      className="mt-3 h-10 min-w-0 border-white/10 bg-white/[0.04] px-3 text-[0.84rem] text-white [color-scheme:dark] [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left"
                      type="date"
                      value={taskDraft.startDate ?? ""}
                      onChange={(event) => setTaskDraft((current) => ({ ...current, startDate: event.target.value }))}
                    />
                  </div>
                  <div className="rounded-[1.15rem] bg-white/[0.04] p-4">
                    <Label className="text-white">Due date</Label>
                    <Input
                      className="mt-3 h-10 min-w-0 border-white/10 bg-white/[0.04] px-3 text-[0.84rem] text-white [color-scheme:dark] [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left"
                      type="date"
                      value={taskDraft.dueDate ?? ""}
                      onChange={(event) => setTaskDraft((current) => ({ ...current, dueDate: event.target.value }))}
                    />
                  </div>
                  <div className="rounded-[1.15rem] bg-white/[0.04] p-4">
                    <Label className="text-white">Status</Label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {taskStatuses.map((status) => (
                        <button
                          key={status}
                          className={[
                            "rounded-full border px-3 py-2 text-sm transition",
                            taskDraft.status === status
                              ? "border-white/20 bg-white text-[#202024]"
                              : "border-white/12 bg-white/[0.04] text-white/70"
                          ].join(" ")}
                          type="button"
                          onClick={() => setTaskDraft((current) => ({ ...current, status }))}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-[1.15rem] bg-white/[0.04] p-4">
                    <Label className="text-white">Priority</Label>
                    <div className="mt-3 flex gap-2">
                      {taskPriorities.map((priority) => (
                        <button
                          key={priority}
                          className={[
                            "rounded-full border px-3 py-2 text-sm transition",
                            taskDraft.priority === priority
                              ? "border-white/20 bg-white text-[#202024]"
                              : "border-white/12 bg-white/[0.04] text-white/70"
                          ].join(" ")}
                          type="button"
                          onClick={() => setTaskDraft((current) => ({ ...current, priority }))}
                        >
                          {priority}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-[1.15rem] bg-white/[0.04] p-4">
                    <Label className="text-white">Dependency</Label>
                    <Select
                      value={taskDraft.blockedByTaskIds?.[0] ?? ""}
                      onChange={(value) =>
                        setTaskDraft((current) => ({
                          ...current,
                          blockedByTaskIds: value ? [value] : []
                        }))
                      }
                      options={[
                        { label: "No dependency", value: "" },
                        ...campaignTasks
                          .filter((task) => task.id !== taskDraft.id)
                          .map((task) => ({
                            label: task.title,
                            value: task.id
                          }))
                      ]}
                    />
                  </div>
                </div>
              ) : null}

              {errors.form ? <p className="mt-3 text-xs text-[#ffb4aa]">{errors.form}</p> : null}
              {taskError ? <p className="mt-3 text-xs text-[#ffb4aa]">{taskError}</p> : null}
            </div>
            <div className="sticky bottom-0 z-10 grid grid-cols-[auto_1fr] gap-2 border-t border-white/10 bg-[#202024] px-4 py-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (mobileComposerStep === 1) {
                    closeAddTaskFlow();
                    return;
                  }
                  if (mobileComposerStep === 2) {
                    setMobileComposerStep(1);
                    return;
                  }
                  if (mobileComposerStep === 3) {
                    setMobileComposerStep(2);
                    return;
                  }
                  setMobileComposerStep(3);
                }}
              >
                Back
              </Button>
              {mobileComposerStep < 4 ? (
                <Button
                  className="w-full"
                  type="button"
                  disabled={
                    (mobileComposerStep === 1 && !canAdvanceComposerTitle) ||
                    (mobileComposerStep === 2 && !taskKind) ||
                    (mobileComposerStep === 3 && !canAdvanceComposerDetails)
                  }
                  onClick={() => {
                    if (mobileComposerStep === 1) {
                      setMobileComposerStep(2);
                      return;
                    }
                    if (mobileComposerStep === 2 && taskKind) {
                      setMobileComposerStep(3);
                      return;
                    }
                    setMobileComposerStep(4);
                  }}
                >
                  Continue
                </Button>
              ) : taskKind === "content" ? (
                <Button className="w-full" disabled={saving} onClick={() => void savePost(mobilePostStatus)}>
                  {saving ? "Saving..." : mobilePostStatus === "Scheduled" ? "Save scheduled content" : "Save content task"}
                </Button>
              ) : (
                <Button className="w-full" disabled={savingTask} onClick={() => void saveOperationalTask()}>
                  {savingTask ? "Saving..." : taskKind === "meeting" ? "Add meeting" : "Add task"}
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {selectedItem ? (
        <div className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px]" onClick={() => setSelectedItem(null)}>
          <aside
            className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto overscroll-contain rounded-t-[1.5rem] border border-border bg-card p-4 shadow-[0_-24px_80px_rgba(0,0,0,0.24)] [-webkit-overflow-scrolling:touch] sm:inset-y-4 sm:left-auto sm:right-4 sm:w-[28rem] sm:max-h-none sm:rounded-[1.25rem] sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/70 pb-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {selectedItem.type === "post" ? "Content task" : "Campaign task"}
                </p>
                <h2 className="mt-2 text-balance text-2xl font-semibold tracking-[-0.04em] text-foreground">
                  {selectedItem.type === "post" ? selectedItem.item.goal : selectedItem.item.title}
                </h2>
              </div>
              <button
                aria-label="Close task details"
                className="rounded-full border border-border bg-background/70 p-2 text-muted-foreground transition hover:text-foreground"
                type="button"
                onClick={() => setSelectedItem(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {selectedItem.type === "post" && selectedPostDraft ? (
              <div className="mt-5 space-y-5">
                <div>
                  <Label>Task name / goal</Label>
                  <Input
                    value={selectedPostDraft.goal}
                    onChange={(event) =>
                      setSelectedPostDraft((current) =>
                        current ? { ...current, goal: event.target.value } : current
                      )
                    }
                    placeholder="What is this content trying to do?"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Platform</Label>
                    <Select
                      value={selectedPostDraft.platform}
                      onChange={(value) =>
                        setSelectedPostDraft((current) =>
                          current ? { ...current, platform: value as Platform } : current
                        )
                      }
                      options={platformOptions.map((platform) => ({ label: platform, value: platform }))}
                    />
                  </div>
                  <div>
                    <Label>Format</Label>
                    <Select
                      value={selectedPostDraft.format ?? "Static"}
                      onChange={(value) =>
                        setSelectedPostDraft((current) =>
                          current ? { ...current, format: value as NonNullable<Post["format"]> } : current
                        )
                      }
                      options={contentFormatOptions.map((format) => ({ label: format, value: format }))}
                    />
                  </div>
                  <div>
                    <Label>Publish date</Label>
                    <Input
                      className="h-10 min-w-0 px-3 text-[0.84rem] [color-scheme:light] [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left"
                      value={selectedPostDraft.publishDate}
                      onChange={(event) =>
                        setSelectedPostDraft((current) =>
                          current ? { ...current, publishDate: event.target.value } : current
                        )
                      }
                      type="date"
                    />
                  </div>
                  <div>
                    <Label>Asset state</Label>
                    <Select
                      value={selectedPostDraft.assetState ?? "Missing"}
                      onChange={(value) =>
                        setSelectedPostDraft((current) =>
                          current ? { ...current, assetState: value as NonNullable<Post["assetState"]> } : current
                        )
                      }
                      options={["Missing", "In Progress", "Ready"].map((value) => ({ label: value, value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label>Status</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {postStatuses.map((status) => (
                      <button
                        key={status}
                        className={[
                          "rounded-full border px-3 py-2 text-sm transition",
                          selectedPostDraft.status === status
                            ? "border-primary/45 bg-primary/10 text-foreground"
                            : "border-border bg-card/70 text-muted-foreground hover:border-primary/25 hover:text-foreground"
                        ].join(" ")}
                        type="button"
                        onClick={() =>
                          setSelectedPostDraft((current) =>
                            current ? { ...current, status } : current
                          )
                        }
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Caption / content</Label>
                  <Textarea
                    value={selectedPostDraft.content}
                    onChange={(event) =>
                      setSelectedPostDraft((current) =>
                        current ? { ...current, content: event.target.value } : current
                      )
                    }
                    placeholder="Write the post caption, notes, or creative direction."
                  />
                </div>
                <div>
                  <Label>Call to action</Label>
                  <Input
                    value={selectedPostDraft.cta}
                    onChange={(event) =>
                      setSelectedPostDraft((current) =>
                        current ? { ...current, cta: event.target.value } : current
                      )
                    }
                    placeholder="Reserve, order, call, DM, book now..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Destination URL</Label>
                    <Input
                      value={selectedPostDraft.destinationUrl ?? ""}
                      onChange={(event) =>
                        setSelectedPostDraft((current) =>
                          current ? { ...current, destinationUrl: event.target.value } : current
                        )
                      }
                      placeholder="/reserve"
                    />
                  </div>
                  <div>
                    <Label>Linked task</Label>
                    <Select
                      value={selectedPostDraft.linkedTaskId ?? ""}
                      onChange={(value) =>
                        setSelectedPostDraft((current) =>
                          current ? { ...current, linkedTaskId: value || undefined } : current
                        )
                      }
                      options={[
                        { label: "No linked task", value: "" },
                        ...campaignTasks.map((task) => ({ label: task.title, value: task.id }))
                      ]}
                    />
                  </div>
                </div>
                <div className="rounded-[1rem] border border-border bg-muted/25 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Approval</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {getPostApproval(selectedPostDraft.id)?.status ?? "No approval yet"}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Next step · {getPostReadiness(selectedPostDraft, getPostApproval(selectedPostDraft.id)?.status, getPostPublishJob(selectedPostDraft.id)?.status).nextStep}
                      </p>
                    </div>
                    <DatePill value={selectedPostDraft.publishDate} fallback="No date" />
                  </div>
                  <Textarea
                    className="mt-4"
                    value={selectedNote}
                    onChange={(event) => setSelectedNote(event.target.value)}
                    placeholder="Add an approval note or request-change comment..."
                  />
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Button
                      disabled={savingSelectedTask}
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => void sendSelectedPostToApproval()}
                    >
                      Send to approval
                    </Button>
                    <Button
                      disabled={savingSelectedTask}
                      size="sm"
                      type="button"
                      onClick={() => void reviewSelectedPost("Approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      disabled={savingSelectedTask}
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => void reviewSelectedPost("Changes Requested")}
                    >
                      Request changes
                    </Button>
                  </div>
                </div>
                {selectedSaveError ? <p className="text-sm text-primary">{selectedSaveError}</p> : null}
                <div className="sticky bottom-0 -mx-4 grid grid-cols-[auto_1fr] gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5">
                  <Button
                    aria-label="Delete content task"
                    disabled={savingSelectedTask || deletingSelectedItem}
                    type="button"
                    variant="outline"
                    onClick={() => void deleteSelectedPost()}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button className="w-full" disabled={savingSelectedTask || deletingSelectedItem} onClick={() => void saveSelectedPostDetails()}>
                    {savingSelectedTask ? "Saving..." : "Save content task"}
                  </Button>
                </div>
              </div>
            ) : selectedItem.type === "task" && selectedTaskDraft ? (
              <div className="mt-5 space-y-5">
                <div>
                  <Label>Task name</Label>
                  <Input
                    value={selectedTaskDraft.title}
                    onChange={(event) =>
                      setSelectedTaskDraft((current) =>
                        current ? { ...current, title: event.target.value } : current
                      )
                    }
                    placeholder="What needs to happen?"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start date</Label>
                    <Input
                      className="h-10 min-w-0 px-3 text-[0.84rem] [color-scheme:light] [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left"
                      value={selectedTaskDraft.startDate ?? ""}
                      onChange={(event) =>
                        setSelectedTaskDraft((current) =>
                          current ? { ...current, startDate: event.target.value } : current
                        )
                      }
                      type="date"
                    />
                  </div>
                  <div>
                    <Label>Due date</Label>
                    <Input
                      className="h-10 min-w-0 px-3 text-[0.84rem] [color-scheme:light] [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left"
                      value={selectedTaskDraft.dueDate ?? ""}
                      onChange={(event) =>
                        setSelectedTaskDraft((current) =>
                          current ? { ...current, dueDate: event.target.value } : current
                        )
                      }
                      type="date"
                    />
                  </div>
                  <div>
                    <Label>Assignee</Label>
                    <Input
                      value={selectedTaskDraft.assigneeName ?? ""}
                      onChange={(event) =>
                        setSelectedTaskDraft((current) =>
                          current ? { ...current, assigneeName: event.target.value } : current
                        )
                      }
                      placeholder="Name"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Task type</Label>
                    <Select
                      value={selectedTaskDraft.taskType ?? "General"}
                      onChange={(value) =>
                        setSelectedTaskDraft((current) =>
                          current ? { ...current, taskType: value as NonNullable<OperationalTask["taskType"]> } : current
                        )
                      }
                      options={[
                        { label: "Content", value: "Content" },
                        { label: "Meeting", value: "Meeting" },
                        { label: "General", value: "General" }
                      ]}
                    />
                  </div>
                  <div>
                    <Label>Dependency</Label>
                    <Select
                      value={selectedTaskDraft.blockedByTaskIds?.[0] ?? ""}
                      onChange={(value) =>
                        setSelectedTaskDraft((current) =>
                          current ? { ...current, blockedByTaskIds: value ? [value] : [] } : current
                        )
                      }
                      options={[
                        { label: "No dependency", value: "" },
                        ...campaignTasks
                          .filter((task) => task.id !== selectedTaskDraft.id)
                          .map((task) => ({ label: task.title, value: task.id }))
                      ]}
                    />
                  </div>
                </div>
                <div>
                  <Label>Status</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {taskStatuses.map((status) => (
                      <button
                        key={status}
                        className={[
                          "rounded-full border px-3 py-2 text-sm transition",
                          selectedTaskDraft.status === status
                            ? "border-primary/45 bg-primary/10 text-foreground"
                            : "border-border bg-card/70 text-muted-foreground hover:border-primary/25 hover:text-foreground"
                        ].join(" ")}
                        disabled={savingSelectedTask}
                        type="button"
                        onClick={() =>
                          setSelectedTaskDraft((current) =>
                            current ? { ...current, status } : current
                          )
                        }
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Priority</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {taskPriorities.map((priority) => (
                      <button
                        key={priority}
                        className={[
                          "rounded-full border px-3 py-2 text-sm transition",
                          selectedTaskDraft.priority === priority
                            ? "border-primary/45 bg-primary/10 text-foreground"
                            : "border-border bg-card/70 text-muted-foreground hover:border-primary/25 hover:text-foreground"
                        ].join(" ")}
                        type="button"
                        onClick={() =>
                          setSelectedTaskDraft((current) =>
                            current ? { ...current, priority } : current
                          )
                        }
                      >
                        {priority}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Linked content</Label>
                    <Select
                      value={selectedTaskDraft.linkedPostId ?? ""}
                      onChange={(value) =>
                        setSelectedTaskDraft((current) =>
                          current ? { ...current, linkedPostId: value || undefined } : current
                        )
                      }
                      options={[
                        { label: "No linked content", value: "" },
                        ...linkedPosts.map((post) => ({ label: post.goal, value: post.id }))
                      ]}
                    />
                  </div>
                  <label className="flex items-center gap-3 rounded-[0.95rem] border border-border bg-muted/20 px-3 py-2 text-sm text-foreground">
                    <input
                      checked={Boolean(selectedTaskDraft.isMilestone)}
                      className="h-4 w-4"
                      type="checkbox"
                      onChange={(event) =>
                        setSelectedTaskDraft((current) =>
                          current ? { ...current, isMilestone: event.target.checked } : current
                        )
                      }
                    />
                    Milestone
                  </label>
                </div>
                <div>
                  <Label>Details</Label>
                  <Textarea
                    value={selectedTaskDraft.detail}
                    onChange={(event) =>
                      setSelectedTaskDraft((current) =>
                        current ? { ...current, detail: event.target.value } : current
                      )
                    }
                    placeholder="Add useful context, links, or next steps."
                  />
                </div>
                <div className="rounded-[1rem] border border-dashed border-border p-4">
                  <p className="text-sm font-medium text-foreground">Add note</p>
                  <Textarea
                    className="mt-3"
                    value={selectedNote}
                    onChange={(event) => setSelectedNote(event.target.value)}
                    placeholder="Add a quick note or handoff comment."
                  />
                </div>
                {selectedTaskDraft.notes?.length ? (
                  <div className="rounded-[1rem] border border-border bg-muted/20 p-4">
                    <p className="text-sm font-medium text-foreground">Notes</p>
                    <div className="mt-3 space-y-2">
                      {selectedTaskDraft.notes.map((note, index) => (
                        <p className="text-sm text-muted-foreground" key={`${selectedTaskDraft.id}-note-${index}`}>
                          {note}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
                {selectedSaveError ? <p className="text-sm text-primary">{selectedSaveError}</p> : null}
                <div className="sticky bottom-0 -mx-4 grid grid-cols-[auto_1fr] gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5">
                  <Button
                    aria-label="Delete task"
                    disabled={savingSelectedTask || deletingSelectedItem}
                    type="button"
                    variant="outline"
                    onClick={() => void deleteSelectedTask()}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button className="w-full" disabled={savingSelectedTask || deletingSelectedItem} onClick={() => void saveSelectedTaskDetails()}>
                    {savingSelectedTask ? "Saving..." : "Save task"}
                  </Button>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}

      {mobileViewMenuOpen ? (
        <div
          className="fixed inset-0 z-40 bg-transparent sm:hidden"
          onClick={() => setMobileViewMenuOpen(false)}
        />
      ) : null}

      <div className="fixed inset-x-0 bottom-[6.75rem] z-40 flex justify-center px-3 sm:hidden">
        <div className="relative flex max-w-[calc(100vw-1.5rem)] items-center gap-1.5 rounded-[1.35rem] border border-white/15 bg-[#202024]/95 p-1.5 text-white shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur">
          {mobileViewMenuOpen ? (
            <div className="absolute bottom-[calc(100%+0.65rem)] left-1/2 w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-[1.25rem] border border-white/12 bg-[#202024] p-2 text-white shadow-[0_20px_60px_rgba(0,0,0,0.36)]">
              <p className="px-3 pb-2 pt-1 text-xs uppercase tracking-[0.18em] text-white/45">
                Switch view
              </p>
              <div className="grid gap-1">
                {campaignViews.map((view) => (
                  <button
                    key={view.id}
                    className={[
                      "rounded-[0.95rem] px-3 py-2.5 text-left transition",
                      activeView === view.id
                        ? "bg-white/[0.08] text-white"
                        : "text-white/62 hover:bg-white/[0.05] hover:text-white"
                    ].join(" ")}
                    type="button"
                    onClick={() => {
                      setActiveView(view.id);
                      setMobileViewMenuOpen(false);
                    }}
                  >
                    <span className="block text-sm font-semibold">{view.label}</span>
                    <span className="mt-0.5 block text-xs text-white/45">{view.description}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <button
            aria-label="Board view"
            className="rounded-[1rem] border p-2.5"
            style={{ backgroundColor: accent.soft, borderColor: accent.bg, color: accent.bg }}
            type="button"
            onClick={() => setActiveView("board")}
          >
            <LayoutList className="h-5 w-5" />
          </button>
          <button
            className="flex min-w-[7.25rem] items-center justify-center gap-2 rounded-[1rem] border border-white/15 px-4 py-2.5 text-base font-medium"
            type="button"
            onClick={() => setMobileViewMenuOpen((current) => !current)}
          >
            {activeViewLabel}
            <ChevronUp className={["h-4 w-4 transition", mobileViewMenuOpen ? "rotate-180" : ""].join(" ")} />
          </button>
          <button
            aria-label="Add content"
            className="rounded-[1rem] p-3"
            style={{ backgroundColor: accent.bg, color: accent.text }}
            type="button"
            onClick={() => {
              resetComposer();
              setAddTaskOpen(true);
            }}
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
