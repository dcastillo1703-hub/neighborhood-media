"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ListCard } from "@/components/dashboard/list-card";
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
import { useAssets } from "@/lib/repositories/use-assets";
import { useClientCampaignGoals } from "@/lib/repositories/use-campaign-goals";
import { useCampaigns } from "@/lib/repositories/use-campaigns";
import { usePosts } from "@/lib/repositories/use-posts";
import { useApprovalsApi } from "@/lib/use-approvals-api";
import { useOperationsApi } from "@/lib/use-operations-api";
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
  const { posts, ready, error, addPost, deletePost } = usePosts(activeClient.id);
  const { tasks } = useOperationsApi(workspace.id, activeClient.id);
  const { approvals, prependApproval } = useApprovalsApi(activeClient.id);
  const { jobs, prependJob } = usePublishingApi(activeClient.id);
  const todayKey = formatDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(() => todayKey);
  const [mobileTaskView, setMobileTaskView] = useState<"list" | "calendar">("calendar");
  const [contentView, setContentView] = useState<"list" | "calendar">("list");
  const [draft, setDraft] = useState<ContentDraft>(() => createContentDraft());
  const [isCreating, setIsCreating] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const monthDays = useMemo(() => getMonthDays(new Date(selectedDate)), [selectedDate]);
  const monthLabel = new Date(selectedDate).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });

  const campaignPosts = posts.filter((post) => Boolean(post.campaignId));
  const scheduledPosts = getScheduledPosts(campaignPosts);
  const contentPosts = [...posts].sort((left, right) => left.publishDate.localeCompare(right.publishDate));
  const campaignPostIds = new Set(campaignPosts.map((post) => post.id));
  const campaignTasks = tasks.filter(
    (task) => task.linkedEntityType === "campaign" && task.linkedEntityId && task.status !== "Done"
  );
  const pendingApprovals = approvals.filter(
    (approval) => approval.status === "Pending" && campaignPostIds.has(approval.entityId)
  );
  const queuedPublishJobs = jobs.filter((job) =>
    ["Queued", "Processing", "Blocked"].includes(job.status) && campaignPostIds.has(job.postId)
  );
  const selectedDayLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric"
  });
  const selectedDayPosts = campaignPosts.filter((post) => post.publishDate === selectedDate);
  const selectedDayApprovals = pendingApprovals.filter((approval) => {
    const linkedPost = posts.find((post) => post.id === approval.entityId);
    return linkedPost?.publishDate === selectedDate;
  });
  const selectedDayJobs = queuedPublishJobs.filter((job) => job.scheduledFor?.startsWith(selectedDate));
  const selectedDayCampaignTasks = campaignTasks.filter((task) => task.dueDate === selectedDate);
  const selectedDayGoals = campaignGoals.filter((goal) => !goal.done && goal.dueDate === selectedDate);
  const selectedDayTasks = [
    ...selectedDayPosts.map((post) => ({
      id: `post-${post.id}`,
      title: post.goal,
      eyebrow: `${post.platform} content`,
      detail: post.content || "Scheduled content item.",
      status: post.status,
      campaignId: post.campaignId
    })),
    ...selectedDayApprovals.map((approval) => ({
      id: `approval-${approval.id}`,
      title: approval.summary,
      eyebrow: "Approval",
      detail: approval.note ?? "Needs review.",
      status: approval.status,
      campaignId: posts.find((post) => post.id === approval.entityId)?.campaignId
    })),
    ...selectedDayJobs.map((job) => ({
      id: `job-${job.id}`,
      title: `${job.provider} publish job`,
      eyebrow: "Publishing",
      detail: job.detail,
      status: job.status,
      campaignId: posts.find((post) => post.id === job.postId)?.campaignId
    })),
    ...selectedDayCampaignTasks.map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      eyebrow: "Campaign task",
      detail: task.detail || "Campaign-linked task.",
      status: task.status,
      campaignId: task.linkedEntityId
    })),
    ...selectedDayGoals.map((goal) => ({
      id: `goal-${goal.id}`,
      title: goal.label,
      eyebrow: "Campaign goal",
      detail: goal.assigneeName ? `Assigned to ${goal.assigneeName}` : "Campaign checkpoint.",
      status: "Open",
      campaignId: goal.campaignId
    }))
  ];
  const mobileTasks = [
    ...campaignPosts.map((post) => ({
      id: `post-${post.id}`,
      title: post.goal,
      eyebrow: `${post.platform} content`,
      detail: post.content || "Scheduled content item.",
      status: post.status,
      dateKey: post.publishDate,
      campaignId: post.campaignId
    })),
    ...pendingApprovals.map((approval) => {
      const linkedPost = posts.find((post) => post.id === approval.entityId);

      return {
        id: `approval-${approval.id}`,
        title: approval.summary,
        eyebrow: "Approval",
        detail: approval.note ?? "Needs review.",
        status: approval.status,
        dateKey: linkedPost?.publishDate,
        campaignId: linkedPost?.campaignId
      };
    }),
    ...queuedPublishJobs.map((job) => {
      const linkedPost = posts.find((post) => post.id === job.postId);

      return {
        id: `job-${job.id}`,
        title: `${job.provider} publish job`,
        eyebrow: "Publishing",
        detail: job.detail,
        status: job.status,
        dateKey: job.scheduledFor?.split("T")[0],
        campaignId: linkedPost?.campaignId
      };
    }),
    ...campaignTasks.map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      eyebrow: "Campaign task",
      detail: task.detail || "Campaign-linked task.",
      status: task.status,
      dateKey: task.dueDate,
      campaignId: task.linkedEntityId
    })),
    ...campaignGoals.filter((goal) => !goal.done).map((goal) => ({
      id: `goal-${goal.id}`,
      title: goal.label,
      eyebrow: "Campaign goal",
      detail: goal.assigneeName ? `Assigned to ${goal.assigneeName}` : "Campaign checkpoint.",
      status: "Open",
      dateKey: goal.dueDate,
      campaignId: goal.campaignId
    }))
  ].sort((left, right) => (left.dateKey ?? "9999-12-31").localeCompare(right.dateKey ?? "9999-12-31"));
  const todayTasks = mobileTasks.filter((task) => task.dateKey === todayKey);
  const waitingTasks = mobileTasks.filter(
    (task) =>
      task.eyebrow === "Approval" ||
      task.eyebrow === "Publishing" ||
      task.status === "Waiting" ||
      task.status === "Pending" ||
      task.status === "Blocked" ||
      task.status === "Processing"
  ).slice(0, 8);
  const waitingTaskIds = new Set(waitingTasks.map((task) => task.id));
  const upcomingTasks = mobileTasks
    .filter((task) => task.dateKey && task.dateKey > todayKey && !waitingTaskIds.has(task.id))
    .slice(0, 8);
  const unscheduledTasks = mobileTasks.filter((task) => !task.dateKey).slice(0, 8);

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

      setDraft(createContentDraft(new Date(draft.publishDate)));
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
                    const linkedCampaign = campaigns.find((campaign) => campaign.id === task.campaignId);

                    return (
                      <div className="rounded-[1.35rem] border border-white/12 bg-white/[0.035] p-4" key={task.id}>
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/45 text-white/65">
                            ✓
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs uppercase tracking-[0.18em] text-white/38">{task.eyebrow}</p>
                            <p className="mt-1 text-lg font-semibold text-white">{task.title}</p>
                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/52">{task.detail}</p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/48">
                              <span className="rounded-full bg-white/[0.06] px-2.5 py-1">{task.status}</span>
                              {linkedCampaign ? (
                                <span className="rounded-full bg-white/[0.06] px-2.5 py-1">{linkedCampaign.name}</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
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
                      const linkedCampaign = campaigns.find((campaign) => campaign.id === task.campaignId);

                      return (
                        <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.035] px-4 py-3" key={task.id}>
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/42 text-xs text-white/62">
                              ✓
                            </span>
                          <div className="min-w-0 flex-1">
                              <p className="truncate text-base font-semibold text-white">{task.title}</p>
                              <p className="mt-1 line-clamp-2 text-sm text-white/55">{task.detail}</p>
                              <div className="mt-1 flex flex-wrap gap-2 text-xs text-white/45">
                                <span>{task.eyebrow}</span>
                                {task.dateKey ? <DatePill className="border-white/12 bg-white/[0.06] text-white/58" value={task.dateKey} /> : null}
                                {linkedCampaign ? <span>{linkedCampaign.name}</span> : null}
                              </div>
                            </div>
                            <span className="text-xs text-white/38">{task.status}</span>
                          </div>
                        </div>
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
