"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ListCard } from "@/components/dashboard/list-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePill } from "@/components/ui/date-pill";
import { useActiveClient } from "@/lib/client-context";
import { getScheduledPosts } from "@/lib/domain/content";
import { useAssets } from "@/lib/repositories/use-assets";
import { useCampaigns } from "@/lib/repositories/use-campaigns";
import { usePlannerItems } from "@/lib/repositories/use-planner-items";
import { usePosts } from "@/lib/repositories/use-posts";
import { useApprovalsApi } from "@/lib/use-approvals-api";
import { usePublishingApi } from "@/lib/use-publishing-api";
import { number } from "@/lib/utils";

function formatDateKey(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function getMobileAgendaDays() {
  const today = new Date();

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);

    return {
      date,
      dateKey: formatDateKey(date),
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      label: index === 0 ? "Today" : date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      number: date.getDate()
    };
  });
}

export default function ContentPage() {
  const { activeClient } = useActiveClient();
  const { campaigns } = useCampaigns(activeClient.id);
  const { assets } = useAssets(activeClient.id);
  const { items } = usePlannerItems(activeClient.id);
  const { posts, ready, error } = usePosts(activeClient.id);
  const { approvals } = useApprovalsApi(activeClient.id);
  const { jobs } = usePublishingApi(activeClient.id);
  const mobileAgendaDays = useMemo(() => getMobileAgendaDays(), []);
  const [selectedDate, setSelectedDate] = useState(() => mobileAgendaDays[0]?.dateKey ?? formatDateKey(new Date()));
  const [mobileTaskView, setMobileTaskView] = useState<"list" | "calendar">("calendar");

  const scheduledPosts = getScheduledPosts(posts);
  const pendingApprovals = approvals.filter((approval) => approval.status === "Pending");
  const planningBacklog = items.filter((item) => item.status !== "Published");
  const queuedPublishJobs = jobs.filter((job) =>
    ["Queued", "Processing", "Blocked"].includes(job.status)
  );
  const selectedDay = mobileAgendaDays.find((day) => day.dateKey === selectedDate) ?? mobileAgendaDays[0];
  const selectedDayPosts = scheduledPosts.filter((post) => post.publishDate === selectedDate);
  const selectedDayApprovals = pendingApprovals.filter((approval) => {
    const linkedPost = posts.find((post) => post.id === approval.entityId);
    return linkedPost?.publishDate === selectedDate;
  });
  const selectedDayJobs = queuedPublishJobs.filter((job) => job.scheduledFor?.startsWith(selectedDate));
  const selectedDayPlannerItems = planningBacklog.filter((item) =>
    item.dayOfWeek.toLowerCase().startsWith(selectedDay?.day.toLowerCase().slice(0, 3) ?? "")
  );
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
    ...selectedDayPlannerItems.map((item) => ({
      id: `planner-${item.id}`,
      title: item.campaignGoal,
      eyebrow: `${item.platform} planner`,
      detail: item.caption,
      status: item.status,
      campaignId: item.campaignId
    }))
  ];
  const mobileTasks = [
    ...scheduledPosts.map((post) => ({
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
    ...planningBacklog.map((item) => ({
      id: `planner-${item.id}`,
      title: item.campaignGoal,
      eyebrow: `${item.platform} planner`,
      detail: item.caption,
      status: item.status,
      dateKey: undefined,
      campaignId: item.campaignId
    }))
  ].sort((left, right) => (left.dateKey ?? "9999-12-31").localeCompare(right.dateKey ?? "9999-12-31"));
  const todayKey = mobileAgendaDays[0]?.dateKey ?? formatDateKey(new Date());
  const todayTasks = mobileTasks.filter((task) => task.dateKey === todayKey);
  const upcomingTasks = mobileTasks.filter((task) => task.dateKey && task.dateKey > todayKey).slice(0, 8);
  const unscheduledTasks = mobileTasks.filter((task) => !task.dateKey).slice(0, 8);

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
                <p className="text-lg font-semibold">Calendar</p>
                <p className="text-sm text-white/45">{number(scheduledPosts.length + planningBacklog.length)} total</p>
              </div>
              <div className="mt-4 grid grid-cols-7 gap-2">
                {mobileAgendaDays.map((day) => {
                  const selected = day.dateKey === selectedDate;
                  const hasWork =
                    scheduledPosts.some((post) => post.publishDate === day.dateKey) ||
                    queuedPublishJobs.some((job) => job.scheduledFor?.startsWith(day.dateKey));

                  return (
                    <button
                      className={[
                        "rounded-2xl px-1 py-3 text-center transition",
                        selected ? "bg-white text-[#202024]" : "bg-white/[0.04] text-white/62"
                      ].join(" ")}
                      key={day.dateKey}
                      type="button"
                      onClick={() => setSelectedDate(day.dateKey)}
                    >
                      <span className="block text-[0.66rem] font-semibold uppercase">{day.day}</span>
                      <span className="mt-1 block text-lg font-semibold">{day.number}</span>
                      <span className={["mx-auto mt-1 block h-1.5 w-1.5 rounded-full", hasWork ? "bg-current" : "bg-transparent"].join(" ")} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-7">
              <p className="text-sm font-semibold text-[var(--app-accent)]">
                {selectedDay?.label ?? "Today"}
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
        <span><strong className="font-medium text-foreground">{number(scheduledPosts.length)}</strong> scheduled</span>
        <span><strong className="font-medium text-foreground">{number(pendingApprovals.length)}</strong> pending approval</span>
        <span><strong className="font-medium text-foreground">{number(planningBacklog.length)}</strong> planner items</span>
        <span><strong className="font-medium text-foreground">{number(queuedPublishJobs.length)}</strong> publish jobs</span>
        <span><strong className="font-medium text-foreground">{number(assets.filter((asset) => asset.status === "Ready").length)}</strong> ready assets</span>
      </div>

      <div className="hidden gap-5 sm:grid xl:grid-cols-[1.1fr_0.9fr]">
        <Card id="scheduled-content" className="overflow-hidden p-0">
          <CardHeader className="border-b border-border/70 px-4 py-4 sm:px-5">
            <div>
              <CardDescription>Scheduled Content</CardDescription>
              <CardTitle className="mt-2">Next items going live</CardTitle>
            </div>
          </CardHeader>
          <div className="divide-y divide-border/70">
            {scheduledPosts.length ? (
              scheduledPosts.slice(0, 6).map((post) => {
                const linkedCampaign = campaigns.find((campaign) => campaign.id === post.campaignId);
                const approval = approvals.find(
                  (item) => item.entityType === "post" && item.entityId === post.id
                );

                return (
                  <ListCard key={post.id} className="rounded-none border-0 bg-transparent px-4 py-4 hover:bg-primary/5 sm:px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">{post.platform}</p>
                          <DatePill value={post.publishDate} />
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{post.goal}</p>
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                          {post.content}
                        </p>
                      </div>
                      <div className="text-right text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        <p>{post.status}</p>
                        <p className="mt-2 text-primary">
                          {approval?.status ?? "No approval"}
                        </p>
                      </div>
                    </div>
                    {linkedCampaign ? (
                      <p className="mt-3 text-xs uppercase tracking-[0.16em] text-primary">
                        Campaign: {linkedCampaign.name}
                      </p>
                    ) : null}
                  </ListCard>
                );
              })
            ) : (
              <EmptyState
                title="Nothing scheduled"
                description="Use the content workspace to stage the next publish before service gets busy."
              />
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card id="planner-queue" className="overflow-hidden p-0">
            <CardHeader className="border-b border-border/70 px-4 py-4 sm:px-5">
              <div>
                <CardDescription>Planner Queue</CardDescription>
                <CardTitle className="mt-2">Ideas still in motion</CardTitle>
              </div>
            </CardHeader>
            <div className="divide-y divide-border/70">
              {planningBacklog.length ? (
                planningBacklog.slice(0, 5).map((item) => (
                  <ListCard key={item.id} className="rounded-none border-0 bg-transparent px-4 py-4 hover:bg-primary/5 sm:px-5">
                    <p className="font-medium text-foreground">
                      {item.dayOfWeek} · {item.platform}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">{item.campaignGoal}</p>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {item.caption}
                    </p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-primary">
                      {item.status}
                    </p>
                  </ListCard>
                ))
              ) : (
                <EmptyState
                  title="Planner is clear"
                  description="No draft or scheduled planner items are waiting right now."
                />
              )}
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
