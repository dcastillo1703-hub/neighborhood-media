"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ListCard } from "@/components/dashboard/list-card";
import { OperatorQueueCard } from "@/components/dashboard/operator-queue-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePill } from "@/components/ui/date-pill";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActiveClient } from "@/lib/client-context";
import { getScheduledPosts } from "@/lib/domain/content";
import { buildOperatorQueue } from "@/lib/domain/operator-queue";
import type { OperatorQueueItem } from "@/lib/domain/operator-queue";
import {
  getQueuePrimaryActionLabel,
  getQueueSecondaryActionLabel,
  getQueueToneLabel,
  isQueueUndoable,
} from "@/lib/domain/operator-queue-actions";
import { useAssets } from "@/lib/repositories/use-assets";
import { useClientCampaignGoals } from "@/lib/repositories/use-campaign-goals";
import { useCampaigns } from "@/lib/repositories/use-campaigns";
import { usePosts } from "@/lib/repositories/use-posts";
import { useApprovalsApi } from "@/lib/use-approvals-api";
import { useOperationsApi } from "@/lib/use-operations-api";
import { usePersistentDraft } from "@/lib/use-persistent-draft";
import { usePublishingApi } from "@/lib/use-publishing-api";
import { number } from "@/lib/utils";
import { useWorkspaceContext } from "@/lib/workspace-context";
import type { Platform, PostStatus } from "@/types";

type ContentDraft = {
  platform: Platform;
  content: string;
  cta: string;
  publishDate: string;
  goal: string;
  status: PostStatus;
  campaignId?: string;
};

const platformOptions: Array<{ label: string; value: Platform }> = [
  { label: "Instagram", value: "Instagram" },
  { label: "Facebook", value: "Facebook" },
  { label: "Stories", value: "Stories" },
  { label: "TikTok", value: "TikTok" },
  { label: "Email", value: "Email" }
];

const statusOptions: Array<{ label: string; value: PostStatus }> = [
  { label: "Draft", value: "Draft" },
  { label: "Scheduled", value: "Scheduled" },
  { label: "Published", value: "Published" }
];

function formatDateKey(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function createContentDraft(date = new Date()): ContentDraft {
  return {
    platform: "Instagram",
    content: "",
    cta: "",
    publishDate: formatDateKey(date),
    goal: "",
    status: "Draft",
    campaignId: undefined
  };
}

function getMonthDays(anchorDate: Date) {
  const firstOfMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    return {
      date,
      dateKey: formatDateKey(date),
      isCurrentMonth: date.getMonth() === anchorDate.getMonth()
    };
  });
}

export default function ContentPage() {
  const { activeClient } = useActiveClient();
  const { workspace } = useWorkspaceContext();
  const { campaigns } = useCampaigns(activeClient.id);
  const { goals: campaignGoals } = useClientCampaignGoals(activeClient.id);
  const { assets } = useAssets(activeClient.id);
  const { posts, ready, error, addPost, updatePost, deletePost } = usePosts(activeClient.id);
  const { tasks, updateTaskStatus } = useOperationsApi(workspace.id, activeClient.id);
  const { approvals, prependApproval, reviewApproval } = useApprovalsApi(activeClient.id);
  const { jobs, prependJob } = usePublishingApi(activeClient.id);
  const todayKey = formatDateKey(new Date());
  const contentDraftNamespace = `content:${activeClient.id}`;
  const { value: selectedDate, setValue: setSelectedDate } = usePersistentDraft<string>(
    `${contentDraftNamespace}:selected-date`,
    todayKey
  );
  const { value: mobileTaskView, setValue: setMobileTaskView } = usePersistentDraft<"list" | "calendar">(
    `${contentDraftNamespace}:mobile-task-view`,
    "calendar"
  );
  const { value: contentView, setValue: setContentView } = usePersistentDraft<"list" | "calendar">(
    `${contentDraftNamespace}:content-view`,
    "list"
  );
  const {
    value: draft,
    setValue: setDraft,
    reset: resetDraft
  } = usePersistentDraft<ContentDraft>(`${contentDraftNamespace}:draft`, () => createContentDraft());
  const [isCreating, setIsCreating] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [queueActioningId, setQueueActioningId] = useState<string | null>(null);
  const [reviewingApprovalId, setReviewingApprovalId] = useState<string | null>(null);
  const [queueConfirmingId, setQueueConfirmingId] = useState<string | null>(null);
  const [lastQueueUndo, setLastQueueUndo] = useState<null | { label: string; undo: () => Promise<void> }>(null);
  const monthDays = useMemo(() => getMonthDays(new Date(selectedDate)), [selectedDate]);
  const monthLabel = new Date(selectedDate).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });

  const campaignPosts = useMemo(
    () => posts.filter((post) => Boolean(post.campaignId)),
    [posts]
  );
  const scheduledPosts = useMemo(
    () => getScheduledPosts(campaignPosts),
    [campaignPosts]
  );
  const contentPosts = useMemo(
    () => [...posts].sort((left, right) => left.publishDate.localeCompare(right.publishDate)),
    [posts]
  );
  const campaignPostIds = useMemo(
    () => new Set(campaignPosts.map((post) => post.id)),
    [campaignPosts]
  );
  const campaignTasks = useMemo(
    () =>
      tasks.filter(
        (task) => task.linkedEntityType === "campaign" && task.linkedEntityId && task.status !== "Done"
      ),
    [tasks]
  );
  const pendingApprovals = useMemo(
    () => approvals.filter((approval) => approval.status === "Pending" && campaignPostIds.has(approval.entityId)),
    [approvals, campaignPostIds]
  );
  const queuedPublishJobs = useMemo(
    () =>
      jobs.filter(
        (job) => ["Queued", "Processing", "Blocked"].includes(job.status) && campaignPostIds.has(job.postId)
      ),
    [campaignPostIds, jobs]
  );
  const selectedDayLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric"
  });
  const operatorQueue = useMemo(
    () =>
      buildOperatorQueue({
        campaigns,
        posts: campaignPosts,
        approvals,
        jobs,
        tasks: campaignTasks,
        goals: campaignGoals.filter((goal) => !goal.done),
        todayKey
      }),
    [approvals, campaignGoals, campaignPosts, campaignTasks, campaigns, jobs, todayKey]
  );
  const selectedDayTasks = useMemo(
    () => operatorQueue.items.filter((item) => item.dateKey === selectedDate),
    [operatorQueue.items, selectedDate]
  );
  const mobileTasks = operatorQueue.items;
  const todayTasks = operatorQueue.today.slice(0, 8);
  const waitingTasks = operatorQueue.waiting.slice(0, 8);
  const upcomingTasks = operatorQueue.upcoming.slice(0, 8);
  const unscheduledTasks = operatorQueue.unscheduled.slice(0, 8);

  const handleCreateContent = async () => {
    if (!draft.goal.trim() || !draft.content.trim() || !draft.cta.trim()) {
      return;
    }

    setIsCreating(true);

    try {
      const payload = await addPost({
        clientId: activeClient.id,
        platform: draft.platform,
        content: draft.content.trim(),
        cta: draft.cta.trim(),
        publishDate: draft.publishDate,
        goal: draft.goal.trim(),
        status: draft.status,
        campaignId: draft.campaignId,
        assetIds: []
      });

      if (payload.approval) {
        prependApproval(payload.approval);
      }

      if (payload.publishJob) {
        prependJob(payload.publishJob);
      }

      resetDraft(() => createContentDraft(new Date(draft.publishDate)));
      setContentView("list");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    setDeletingPostId(postId);

    try {
      await deletePost(postId);
    } finally {
      setDeletingPostId(null);
    }
  };

  const handleQueuePrimaryAction = async (task: OperatorQueueItem) => {
    setQueueActioningId(task.id);

    try {
      if (task.entityType === "task") {
        const linkedTask = tasks.find((entry) => entry.id === task.entityId);
        await updateTaskStatus(task.entityId, "Done");
        if (linkedTask && isQueueUndoable(task)) {
          setLastQueueUndo({
            label: `${task.title} marked done.`,
            undo: async () => {
              await updateTaskStatus(task.entityId, linkedTask.status);
            }
          });
        }
        return;
      }

      if (task.entityType === "post" && task.tone === "schedule") {
        const linkedPost = posts.find((post) => post.id === task.entityId);

        if (!linkedPost) {
          return;
        }

        await updatePost(task.entityId, {
          ...linkedPost,
          publishDate: linkedPost.publishDate || selectedDate || todayKey,
          status: "Scheduled",
          approvalState: linkedPost.approvalState ?? "Approved"
        });
        if (isQueueUndoable(task)) {
          setLastQueueUndo({
            label: `${task.title} scheduled.`,
            undo: async () => {
              await updatePost(task.entityId, {
                ...linkedPost
              });
            }
          });
        }
      }
    } finally {
      setQueueActioningId(null);
    }
  };

  const handleQueueReview = async (approvalId: string, status: "Approved" | "Changes Requested") => {
    setReviewingApprovalId(approvalId);

    try {
      await reviewApproval(approvalId, {
        status,
        note:
          status === "Approved"
            ? "Approved from the operator queue."
            : "Changes requested from the operator queue.",
        approverName: "Operator"
      });
    } finally {
      setReviewingApprovalId(null);
    }
  };

  const handleQueueSecondaryAction = async (task: OperatorQueueItem) => {
    if (task.entityType !== "approval") {
      return;
    }

    if (queueConfirmingId !== task.id) {
      setQueueConfirmingId(task.id);
      return;
    }

    setQueueConfirmingId(null);
    await handleQueueReview(task.entityId, "Changes Requested");
  };

  const handleUndoLastQueueAction = async () => {
    if (!lastQueueUndo) {
      return;
    }

    const undoAction = lastQueueUndo;
    setLastQueueUndo(null);
    await undoAction.undo();
  };

  if (!ready) {
    return <div className="text-sm text-muted-foreground">Loading content workspace...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        className="hidden sm:flex"
        eyebrow="Content"
        title="Plan, review, and schedule content"
        description="Keep the restaurant content pipeline in one place: what is drafted, what is scheduled, and what is still waiting on approval."
      />

      <div className="-mx-3 -mt-3 min-h-[calc(100vh-4rem)] bg-[#202024] px-4 pb-28 pt-7 text-white sm:hidden">
        <div>
          <p className="text-sm font-semibold text-white/55">
            {new Date().toLocaleDateString("en-US", { weekday: "short", month: "long", day: "2-digit" })}
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.06em]">My tasks</h1>
        </div>

        <div className="mt-6 inline-flex rounded-[1.15rem] border border-white/12 bg-white/[0.04] p-1">
          {(["list", "calendar"] as const).map((view) => (
            <button
              className={[
                "rounded-[0.9rem] px-5 py-2 text-sm font-semibold capitalize transition",
                mobileTaskView === view ? "bg-white text-[#202024]" : "text-white/55"
              ].join(" ")}
              key={view}
              type="button"
              onClick={() => setMobileTaskView(view)}
            >
              {view}
            </button>
          ))}
        </div>

        {lastQueueUndo ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-sm text-white/72">{lastQueueUndo.label}</p>
            <button
              className="shrink-0 rounded-full border border-white/12 px-3 py-1.5 text-xs font-semibold text-white"
              type="button"
              onClick={() => void handleUndoLastQueueAction()}
            >
              Undo
            </button>
          </div>
        ) : null}

        {mobileTaskView === "calendar" ? (
          <>
            <div className="mt-6 rounded-[1.65rem] border border-white/12 bg-white/[0.035] p-4">
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold">{monthLabel}</p>
                <p className="text-sm text-white/45">{number(mobileTasks.length)} total</p>
              </div>
              <div className="mt-4 grid grid-cols-7 text-center text-[0.68rem] font-semibold uppercase text-white/35">
                {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                  <span key={`${day}-${index}`}>{day}</span>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-7 gap-2">
                {monthDays.map((day) => {
                  const selected = day.dateKey === selectedDate;
                  const hasWork = mobileTasks.some((task) => task.dateKey === day.dateKey);

                  return (
                    <button
                      className={[
                        "rounded-2xl px-1 py-2.5 text-center transition",
                        selected ? "bg-white text-[#202024]" : "bg-white/[0.04]",
                        day.isCurrentMonth ? "text-white/70" : "text-white/28"
                      ].join(" ")}
                      key={day.dateKey}
                      type="button"
                      onClick={() => setSelectedDate(day.dateKey)}
                    >
                      <span className="block text-lg font-semibold">{day.date.getDate()}</span>
                      <span className={["mx-auto mt-1 block h-1.5 w-1.5 rounded-full", hasWork ? "bg-current" : "bg-transparent"].join(" ")} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-7">
              <p className="text-sm font-semibold text-[var(--app-accent)]">
                {selectedDate === todayKey ? "Today" : selectedDayLabel}
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                {selectedDayTasks.length ? "Scheduled for this day" : "Nothing due here"}
              </h2>
              <div className="mt-5 space-y-3">
                {selectedDayTasks.length ? (
                  selectedDayTasks.map((task) => {
                    return (
                      <OperatorQueueCard
                        eyebrow={getQueueToneLabel(task)}
                        item={task}
                        key={task.id}
                        primaryAction={
                          task.entityType === "approval"
                            ? {
                                label: getQueuePrimaryActionLabel(task),
                                disabled: reviewingApprovalId === task.entityId,
                                onClick: () => void handleQueueReview(task.entityId, "Approved"),
                              }
                            : task.entityType === "task" || (task.entityType === "post" && task.tone === "schedule")
                              ? {
                                  label: getQueuePrimaryActionLabel(task),
                                  disabled: queueActioningId === task.id,
                                  onClick: () => void handleQueuePrimaryAction(task),
                                }
                              : null
                        }
                        secondaryAction={
                          task.entityType === "approval"
                            ? {
                                label: queueConfirmingId === task.id ? "Confirm" : (getQueueSecondaryActionLabel(task) ?? "Request changes"),
                                disabled: reviewingApprovalId === task.entityId,
                                emphasis: queueConfirmingId === task.id ? "default" : "subtle",
                                onClick: () => void handleQueueSecondaryAction(task),
                              }
                            : null
                        }
                        theme="dark"
                      />
                    );
                  })
                ) : (
                  <div className="rounded-[1.65rem] border border-white/12 p-6 text-white/58">
                    <p className="text-lg text-white">No tasks for this date</p>
                    <p className="mt-2 text-sm leading-6">Pick another day above, or add content inside a campaign.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="mt-7 space-y-7">
            {[
              ["Today", todayTasks],
              ["Waiting on", waitingTasks],
              ["Upcoming", upcomingTasks],
              ["Unscheduled", unscheduledTasks]
            ].map(([section, sectionTasks]) => (
              <section key={String(section)}>
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold tracking-[-0.04em]">{String(section)}</h2>
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-white/48">
                    {Array.isArray(sectionTasks) ? number(sectionTasks.length) : 0}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {Array.isArray(sectionTasks) && sectionTasks.length ? (
                    sectionTasks.map((task) => {
                      return (
                        <OperatorQueueCard
                          className="px-4 py-3"
                          compact
                          eyebrow={getQueueToneLabel(task)}
                          item={task}
                          key={task.id}
                          primaryAction={
                            task.entityType === "approval"
                              ? {
                                  label: getQueuePrimaryActionLabel(task),
                                  disabled: reviewingApprovalId === task.entityId,
                                  onClick: () => void handleQueueReview(task.entityId, "Approved"),
                                }
                              : task.entityType === "task" || (task.entityType === "post" && task.tone === "schedule")
                                ? {
                                    label: getQueuePrimaryActionLabel(task),
                                    disabled: queueActioningId === task.id,
                                    onClick: () => void handleQueuePrimaryAction(task),
                                  }
                                : null
                          }
                          secondaryAction={
                            task.entityType === "approval"
                              ? {
                                  label: queueConfirmingId === task.id ? "Confirm" : (getQueueSecondaryActionLabel(task) ?? "Request changes"),
                                  disabled: reviewingApprovalId === task.entityId,
                                  emphasis: queueConfirmingId === task.id ? "default" : "subtle",
                                  onClick: () => void handleQueueSecondaryAction(task),
                                }
                              : null
                          }
                          theme="dark"
                        />
                      );
                    })
                  ) : (
                    <p className="rounded-[1.2rem] border border-white/10 px-4 py-3 text-sm text-white/45">
                      Nothing here.
                    </p>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="hidden flex-wrap gap-x-5 gap-y-2 rounded-[1rem] border border-border/70 bg-card/70 px-4 py-3 text-sm text-muted-foreground sm:flex">
        <span><strong className="font-medium text-foreground">{number(posts.length)}</strong> content items</span>
        <span><strong className="font-medium text-foreground">{number(scheduledPosts.length)}</strong> scheduled</span>
        <span><strong className="font-medium text-foreground">{number(pendingApprovals.length)}</strong> pending approval</span>
        <span><strong className="font-medium text-foreground">{number(queuedPublishJobs.length)}</strong> publish jobs</span>
        <span><strong className="font-medium text-foreground">{number(assets.filter((asset) => asset.status === "Ready").length)}</strong> ready assets</span>
      </div>

      {lastQueueUndo ? (
        <Card className="hidden sm:block">
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <p className="text-sm text-muted-foreground">{lastQueueUndo.label}</p>
            <Button size="sm" variant="outline" onClick={() => void handleUndoLastQueueAction()}>
              Undo
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="hidden gap-5 sm:grid xl:grid-cols-[0.82fr_1.18fr]">
        <Card id="create-content" className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardDescription>Create Content</CardDescription>
              <CardTitle className="mt-2">Draft and schedule from here</CardTitle>
            </div>
            <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
              Operator
            </span>
          </div>

          <div className="mt-5 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="content-platform">Platform</Label>
                <Select
                  value={draft.platform}
                  onChange={(value) => setDraft((current) => ({ ...current, platform: value as Platform }))}
                  options={platformOptions}
                />
              </div>
              <div>
                <Label htmlFor="content-date">Publish date</Label>
                <Input
                  id="content-date"
                  type="date"
                  value={draft.publishDate}
                  onChange={(event) => setDraft((current) => ({ ...current, publishDate: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Campaign</Label>
                <Select
                  value={draft.campaignId ?? "none"}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      campaignId: value === "none" ? undefined : value
                    }))
                  }
                  options={[
                    { label: "No campaign", value: "none" },
                    ...campaigns.map((campaign) => ({ label: campaign.name, value: campaign.id }))
                  ]}
                />
              </div>
              <div>
                <Label>Status</Label>
                <div className="flex rounded-[1rem] border border-border bg-card/70 p-1">
                  {statusOptions.map((option) => (
                    <button
                      className={[
                        "flex-1 rounded-[0.75rem] px-3 py-2 text-xs font-semibold transition",
                        draft.status === option.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/40"
                      ].join(" ")}
                      key={option.value}
                      type="button"
                      onClick={() => setDraft((current) => ({ ...current, status: option.value }))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="content-goal">Goal</Label>
              <Input
                id="content-goal"
                placeholder="Example: Drive Thursday dinner reservations"
                value={draft.goal}
                onChange={(event) => setDraft((current) => ({ ...current, goal: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="content-cta">Call to action</Label>
              <Input
                id="content-cta"
                placeholder="Example: Reserve a table"
                value={draft.cta}
                onChange={(event) => setDraft((current) => ({ ...current, cta: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="content-body">Post content</Label>
              <Textarea
                id="content-body"
                placeholder="Write the caption, email, or post copy here."
                value={draft.content}
                onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
              />
            </div>

            <Button
              disabled={isCreating || !draft.goal.trim() || !draft.content.trim() || !draft.cta.trim()}
              onClick={() => void handleCreateContent()}
              type="button"
            >
              {isCreating ? "Creating..." : "Create content"}
            </Button>
          </div>
        </Card>

        <Card id="content-workspace" className="overflow-hidden p-0">
          <CardHeader className="border-b border-border/70 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardDescription>Content Workspace</CardDescription>
                <CardTitle className="mt-2">List and calendar</CardTitle>
              </div>
              <div className="inline-flex rounded-full border border-border bg-card/80 p-1">
                {(["list", "calendar"] as const).map((view) => (
                  <button
                    className={[
                      "rounded-full px-4 py-2 text-xs font-semibold capitalize transition",
                      contentView === view ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/40"
                    ].join(" ")}
                    key={view}
                    type="button"
                    onClick={() => setContentView(view)}
                  >
                    {view}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>

          {contentView === "list" ? (
            <div className="divide-y divide-border/70">
              {contentPosts.length ? (
                contentPosts.map((post) => {
                  const linkedCampaign = campaigns.find((campaign) => campaign.id === post.campaignId);
                  const approval = approvals.find(
                    (item) => item.entityType === "post" && item.entityId === post.id
                  );

                  return (
                    <ListCard key={post.id} className="rounded-none border-0 bg-transparent px-4 py-4 hover:bg-primary/5 sm:px-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-foreground">{post.platform}</p>
                            <DatePill value={post.publishDate} />
                            <span className="rounded-full bg-accent px-2.5 py-1 text-xs text-muted-foreground">
                              {post.status}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-medium text-foreground">{post.goal}</p>
                          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{post.content}</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {linkedCampaign ? <span>Campaign: {linkedCampaign.name}</span> : null}
                            <span>CTA: {post.cta}</span>
                            <span>{approval?.status ?? "No approval"}</span>
                          </div>
                        </div>
                        <Button
                          disabled={deletingPostId === post.id}
                          onClick={() => void handleDeletePost(post.id)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Delete
                        </Button>
                      </div>
                    </ListCard>
                  );
                })
              ) : (
                <EmptyState
                  title="No content yet"
                  description="Create the first content item on the left, then schedule it here."
                />
              )}
            </div>
          ) : (
            <div className="p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{monthLabel}</p>
                <p className="text-xs text-muted-foreground">Posts are shown on publish date.</p>
              </div>
              <div className="grid grid-cols-7 border-l border-t border-border/70 text-xs text-muted-foreground">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div className="border-b border-r border-border/70 px-2 py-2 font-medium" key={day}>
                    {day}
                  </div>
                ))}
                {monthDays.map((day) => {
                  const dayPosts = contentPosts.filter((post) => post.publishDate === day.dateKey);

                  return (
                    <button
                      className={[
                        "min-h-28 border-b border-r border-border/70 p-2 text-left transition hover:bg-accent/30",
                        day.isCurrentMonth ? "bg-card/40" : "bg-muted/20 text-muted-foreground/50"
                      ].join(" ")}
                      key={day.dateKey}
                      type="button"
                      onClick={() => setDraft((current) => ({ ...current, publishDate: day.dateKey }))}
                    >
                      <span className="font-medium">{day.date.getDate()}</span>
                      <div className="mt-2 space-y-1">
                        {dayPosts.slice(0, 3).map((post) => (
                          <span
                            className="block truncate rounded-md bg-primary/12 px-2 py-1 text-[0.68rem] text-primary"
                            key={post.id}
                          >
                            {post.platform}: {post.goal}
                          </span>
                        ))}
                        {dayPosts.length > 3 ? (
                          <span className="block text-[0.68rem] text-muted-foreground">+{dayPosts.length - 3} more</span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
