"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { getCampaignOverview } from "@/lib/domain/campaigns";
import { useAnalyticsSnapshots } from "@/lib/repositories/use-analytics-snapshots";
import { useAssets } from "@/lib/repositories/use-assets";
import { useBlogPosts } from "@/lib/repositories/use-blog-posts";
import { useCampaigns } from "@/lib/repositories/use-campaigns";
import { usePosts } from "@/lib/repositories/use-posts";
import { useWeeklyMetrics } from "@/lib/repositories/use-weekly-metrics";
import { useTheme } from "@/lib/theme-context";
import { useApprovalsApi } from "@/lib/use-approvals-api";
import { useCampaignRoi } from "@/lib/use-campaign-roi";
import { useOperationsApi } from "@/lib/use-operations-api";
import { usePublishingApi } from "@/lib/use-publishing-api";
import { currency, number } from "@/lib/utils";
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

function createCampaignPost(clientId: string, campaignId: string): Post {
  return {
    id: "",
    clientId,
    campaignId,
    platform: "Instagram",
    content: "",
    cta: "",
    publishDate: "",
    goal: "",
    status: "Draft",
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
    status: "Backlog",
    priority: "Medium",
    dueDate: "",
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
  const { campaigns, ready: campaignsReady, error: campaignsError } = useCampaigns(activeClient.id);
  const { posts, addPost, updatePost, ready: postsReady, error: postsError } = usePosts(activeClient.id);
  const { blogPosts } = useBlogPosts(activeClient.id);
  const { assets } = useAssets(activeClient.id);
  const { metrics } = useWeeklyMetrics(activeClient.id);
  const { analyticsSnapshots } = useAnalyticsSnapshots(activeClient.id);
  const { approvals, ready: approvalsReady, reviewApproval, prependApproval } = useApprovalsApi(activeClient.id);
  const { jobs, ready: jobsReady, processJob } = usePublishingApi(activeClient.id);
  const {
    snapshot: roiSnapshot,
    summary: roiSummary,
    ready: roiReady,
    error: roiError,
    saveSnapshot: saveRoiSnapshot
  } = useCampaignRoi(activeClient.id, campaignId);
  const { tasks, ready: tasksReady, error: tasksError, createTask, updateTask } = useOperationsApi(
    workspace.id,
    activeClient.id
  );
  const [draft, setDraft] = useState<Post>(() => createCampaignPost(activeClient.id, campaignId));
  const [taskDraft, setTaskDraft] = useState<OperationalTask>(() =>
    createCampaignTask(workspace.id, activeClient.id, campaignId)
  );
  const [taskKind, setTaskKind] = useState<CampaignTaskKind | null>(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [roiDraft, setRoiDraft] = useState(roiSnapshot);
  const [roiNumberDraft, setRoiNumberDraft] = useState<CampaignRoiNumberDraft>(() =>
    toNumberDraft(roiSnapshot)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [savingSelectedTask, setSavingSelectedTask] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<CampaignWorkspaceView>("overview");
  const [selectedItem, setSelectedItem] = useState<SelectedCampaignItem | null>(null);
  const [mobileViewMenuOpen, setMobileViewMenuOpen] = useState(false);
  const [selectedPostDraft, setSelectedPostDraft] = useState<Post | null>(null);
  const [selectedTaskDraft, setSelectedTaskDraft] = useState<OperationalTask | null>(null);
  const [selectedNote, setSelectedNote] = useState("");
  const [selectedSaveError, setSelectedSaveError] = useState<string | null>(null);

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
  const overview = useMemo(
    () =>
      campaign
        ? getCampaignOverview(campaign, posts, blogPosts, assets, metrics, analyticsSnapshots)
        : null,
    [analyticsSnapshots, assets, blogPosts, campaign, metrics, posts]
  );

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

  const getPostApproval = (postId: string) =>
    campaignApprovals.find((item) => item.entityId === postId);
  const getPostPublishJob = (postId: string) =>
    campaignPublishJobs.find((item) => item.postId === postId);
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
      setDraft(createCampaignPost(activeClient.id, campaignId));
      setTaskKind(null);
      setErrors({});
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
        cta: result.data.cta,
        publishDate: result.data.publishDate,
        goal: result.data.goal,
        status: result.data.status,
        plannerItemId: selectedPostDraft.plannerItemId,
        campaignId,
        assetIds: selectedPostDraft.assetIds
      });

      if (payload.approval && !getPostApproval(payload.approval.entityId)) {
        prependApproval(payload.approval);
      }

      setSelectedItem({ type: "post", item: payload.post });
      setSelectedPostDraft(payload.post);
    } catch (error) {
      setSelectedSaveError(error instanceof Error ? error.message : "Unable to update post.");
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
      const detailWithNote = selectedNote.trim()
        ? `${selectedTaskDraft.detail.trim()}\n\nNote: ${selectedNote.trim()}`.trim()
        : selectedTaskDraft.detail;
      const payload = await updateTask(selectedTaskDraft.id, {
        clientId: activeClient.id,
        title: selectedTaskDraft.title,
        detail: detailWithNote,
        status: selectedTaskDraft.status,
        priority: selectedTaskDraft.priority,
        dueDate: selectedTaskDraft.dueDate || undefined,
        assigneeUserId: selectedTaskDraft.assigneeUserId,
        assigneeName: selectedTaskDraft.assigneeName,
        linkedEntityType: "campaign",
        linkedEntityId: campaignId
      });

      setSelectedItem({ type: "task", item: payload.task });
      setSelectedTaskDraft(payload.task);
      setSelectedNote("");
    } catch (error) {
      setSelectedSaveError(error instanceof Error ? error.message : "Unable to update task.");
    } finally {
      setSavingSelectedTask(false);
    }
  };

  const chooseTaskKind = (kind: CampaignTaskKind) => {
    setTaskKind(kind);
    setAddTaskOpen(false);
    setActiveView("overview");
    setErrors({});
    setTaskError(null);

    if (kind === "meeting") {
      setTaskDraft((current) => ({
        ...current,
        title: current.title || "Schedule campaign check-in",
        detail: current.detail || "Meeting for this campaign."
      }));
    }
  };

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
        linkedEntityType: "campaign",
        linkedEntityId: campaignId,
        assigneeName: taskDraft.assigneeName || profile?.fullName || profile?.email || undefined,
        dueDate: taskDraft.dueDate || undefined
      });
      setTaskDraft(createCampaignTask(workspace.id, activeClient.id, campaignId));
      setTaskKind(null);
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : "Unable to create campaign task.");
    } finally {
      setSavingTask(false);
    }
  };

  if (!campaignsReady || !postsReady || !approvalsReady || !jobsReady || !tasksReady || !roiReady) {
    return <div className="text-sm text-muted-foreground">Loading campaign workspace...</div>;
  }

  if (campaignsError || postsError || tasksError) {
    return <div className="text-sm text-destructive">{campaignsError ?? postsError ?? tasksError}</div>;
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
            <button className="inline-flex h-9 items-center rounded-full px-2.5" style={{ backgroundColor: accent.panel }} type="button" onClick={() => setAddTaskOpen(true)}>
              <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold" style={{ backgroundColor: accent.soft }}>
                DC
              </span>
              <Plus className="ml-1 h-4 w-4" />
            </button>
            <MoreHorizontal className="h-6 w-6" />
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
        description={`${campaign.objective} · ${campaign.startDate} to ${campaign.endDate}`}
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

      {activeView === "overview" ? (
      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <Card className="border-[#3a3a40]/70 bg-[#202024] text-white shadow-none sm:hidden">
          <div className="rounded-[1.5rem] border border-white/15 p-5">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-white/35" />
                <span className="text-xl font-semibold">No status</span>
              </div>
              <MoreHorizontal className="h-5 w-5 text-white/60" />
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
                <p className="text-lg text-white">{campaign.endDate}</p>
              </div>
            </div>
          </div>

          <div className="mt-10 space-y-7 text-xl text-white">
            {[
              ["Connected content", linkedPosts.length],
              ["Campaign tasks", campaignTasks.length],
              ["Approvals", campaignApprovals.length],
              ["Publishing jobs", campaignPublishJobs.length],
              ["Weekly metrics", overview.linkedMetrics.length]
            ].map(([label, value]) => (
              <div className="flex items-center justify-between" key={String(label)}>
                <div className="flex items-center gap-4">
                  <ChevronUp className="h-4 w-4 rotate-90 text-white/50" />
                  <span>{label}</span>
                </div>
                <span className="text-white/55">{value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card id="campaign-brief">
          <CardHeader>
            <div>
              <CardDescription>Campaign Brief</CardDescription>
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
                {campaign.startDate} to {campaign.endDate}
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
              <p className="mt-2 text-sm text-foreground">{campaign.notes || "No campaign notes yet."}</p>
            </ListCard>
          </div>
        </Card>

        <Card id="content-composer">
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
              <div className="grid gap-4 rounded-[1rem] border border-border/70 bg-muted/25 p-4">
                <div className="grid gap-4 md:grid-cols-2">
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
                    <Label>Publish Date</Label>
                    <Input
                      type="date"
                      value={draft.publishDate}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, publishDate: event.target.value }))
                      }
                    />
                    {errors.publishDate ? <p className="mt-2 text-xs text-primary">{errors.publishDate}</p> : null}
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
              <div className="grid gap-4 rounded-[1rem] border border-border/70 bg-muted/25 p-4">
                <div>
                  <Label>{taskKind === "meeting" ? "Meeting Name" : "Task Name"}</Label>
                  <Input
                    value={taskDraft.title}
                    onChange={(event) => setTaskDraft((current) => ({ ...current, title: event.target.value }))}
                    placeholder={taskKind === "meeting" ? "Ex. Campaign check-in with owner" : "Ex. Confirm brunch photo shot list"}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Due Date</Label>
                    <Input
                      type="date"
                      value={taskDraft.dueDate ?? ""}
                      onChange={(event) => setTaskDraft((current) => ({ ...current, dueDate: event.target.value }))}
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
            <CardTitle className="mt-2">Every content item in this campaign</CardTitle>
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
                          <DatePill value={post.publishDate} fallback="No date" />
                        </div>
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
                          <DatePill value={post.publishDate} fallback="No date" />
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{post.content}</p>
                      </div>
                      <div>
                        <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground lg:hidden">Status</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground lg:mt-0">{post.status}</p>
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
                <button className="block w-full text-left" type="button" onClick={() => setSelectedItem({ type: "task", item: task })}>
                <ListCard className="m-3 bg-[#202024] text-white sm:hidden">
                  <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-white/55" />
                    <div className="min-w-0">
                      <p className="truncate text-lg font-medium text-white">{task.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/55">
                        <span>{task.priority}</span>
                        <DatePill value={task.dueDate} fallback="No date" />
                      </div>
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
                        <span>{task.priority}</span>
                        <DatePill value={task.dueDate} fallback="No date" />
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{task.detail}</p>
                    </div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{task.status}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-primary">Task</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">No publish job</p>
                    <p className="text-sm text-muted-foreground">No CTA</p>
                  </div>
                </ListCard>
                </button>
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
                            <span>{approval?.status ?? "No approval"}</span>
                            <span>{publishJob?.status ?? "No publish job"}</span>
                          </div>
                        </ListCard>
                        </button>
                      );
                    })}
                    {laneTasks.map((task) => (
                      <button className="block w-full text-left" key={task.id} type="button" onClick={() => setSelectedItem({ type: "task", item: task })}>
                      <ListCard className="bg-card">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-medium text-foreground">{task.title}</p>
                          <span className="rounded-full bg-primary/10 px-2 py-1 text-[0.65rem] uppercase tracking-[0.12em] text-primary">
                            Task
                          </span>
                        </div>
                        <div className="mt-2">
                          <DatePill value={task.dueDate} fallback="No date" />
                        </div>
                        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{task.detail}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
                          <span>{task.status}</span>
                          <span>{task.priority}</span>
                        </div>
                      </ListCard>
                      </button>
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
              <CardTitle className="mt-3">What is actually going live and when</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            {scheduledPosts.length ? (
              scheduledPosts.map((post) => {
                const approval = getPostApproval(post.id);
                const publishJob = getPostPublishJob(post.id);

                return (
                  <ListCard key={post.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">{post.platform}</p>
                          <DatePill value={post.publishDate} fallback="No date" />
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{post.goal}</p>
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{post.content}</p>
                      </div>
                      <div className="text-right text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        <p>{post.status}</p>
                        <p className="mt-2 text-primary">{approval?.status ?? "No approval"}</p>
                        <p className="mt-2">{publishJob?.status ?? "No publish job"}</p>
                      </div>
                    </div>
                  </ListCard>
                );
              })
            ) : (
              <EmptyState
                title="Nothing scheduled yet"
                description="Add a scheduled post in this campaign and it will appear in the timeline and on the calendar."
              />
            )}
          </div>
        </Card>
      </div>
      ) : null}

      {activeView === "performance" ? (
      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
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
                    <span>Requested by {approval.requesterName}</span>
                    <DatePill value={approval.requestedAt} />
                  </div>
                  {approval.note ? <p className="mt-2 text-sm text-muted-foreground">{approval.note}</p> : null}
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
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] sm:hidden" onClick={() => setAddTaskOpen(false)}>
          <div
            className="absolute inset-x-3 bottom-[5.25rem] rounded-[1.5rem] border border-white/12 bg-[#202024] p-3 text-white shadow-[0_24px_80px_rgba(0,0,0,0.36)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-2 pb-2">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">Add to campaign</p>
                <p className="mt-1 text-xl font-semibold">What kind of task?</p>
              </div>
              <button
                aria-label="Close add task"
                className="rounded-full border border-white/12 p-2 text-white/60"
                type="button"
                onClick={() => setAddTaskOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 grid gap-2">
              {taskKindOptions.map((option) => {
                const Icon = option.icon;

                return (
                  <button
                    key={option.id}
                    className="grid grid-cols-[2.75rem_1fr] gap-3 rounded-[1.15rem] bg-white/[0.04] px-3 py-3 text-left transition hover:bg-white/[0.08]"
                    type="button"
                    onClick={() => chooseTaskKind(option.id)}
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
        </div>
      ) : null}

      {selectedItem ? (
        <div className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px]" onClick={() => setSelectedItem(null)}>
          <aside
            className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[1.5rem] border border-border bg-card p-4 shadow-[0_-24px_80px_rgba(0,0,0,0.24)] sm:inset-y-4 sm:left-auto sm:right-4 sm:w-[28rem] sm:max-h-none sm:rounded-[1.25rem] sm:p-5"
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
                    <Label>Publish date</Label>
                    <Input
                      value={selectedPostDraft.publishDate}
                      onChange={(event) =>
                        setSelectedPostDraft((current) =>
                          current ? { ...current, publishDate: event.target.value } : current
                        )
                      }
                      type="date"
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
                <div className="rounded-[1rem] border border-border bg-muted/25 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Approval</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {getPostApproval(selectedPostDraft.id)?.status ?? "No approval yet"}
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
                <div className="sticky bottom-0 -mx-4 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5">
                  <Button className="w-full" disabled={savingSelectedTask} onClick={() => void saveSelectedPostDetails()}>
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
                    <Label>Due date</Label>
                    <Input
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
                    placeholder="Add a quick note. It will be appended to the task details for now."
                  />
                </div>
                {selectedSaveError ? <p className="text-sm text-primary">{selectedSaveError}</p> : null}
                <div className="sticky bottom-0 -mx-4 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5">
                  <Button className="w-full" disabled={savingSelectedTask} onClick={() => void saveSelectedTaskDetails()}>
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
            onClick={() => setAddTaskOpen(true)}
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
