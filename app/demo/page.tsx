"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  LayoutDashboard,
  Target,
  TrendingUp
} from "lucide-react";

import { ListCard } from "@/components/dashboard/list-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePill } from "@/components/ui/date-pill";
import { demoWorkspace, type DemoApproval, type DemoContent, type DemoTask } from "@/data/demo";
import { cn, currency, number } from "@/lib/utils";

type DemoView = "home" | "campaigns" | "calendar" | "analytics";
type PipelineStage = "goal" | "tasks" | "content" | "approvals" | "scheduled" | "results";

const demoViews: Array<{ id: DemoView; label: string; icon: typeof LayoutDashboard }> = [
  { id: "home", label: "Home", icon: LayoutDashboard },
  { id: "campaigns", label: "Campaigns", icon: Target },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "analytics", label: "Analytics", icon: TrendingUp }
];

function campaignTasks(tasks: DemoTask[], campaignId: string) {
  return tasks.filter((task) => task.campaignId === campaignId);
}

function campaignContent(content: DemoContent[], campaignId: string) {
  return content.filter((item) => item.campaignId === campaignId);
}

function campaignApprovals(approvals: DemoApproval[], campaignId: string) {
  return approvals.filter((approval) => approval.campaignId === campaignId);
}

function getCampaignHealth(
  tasks: DemoTask[],
  content: DemoContent[],
  approvals: DemoApproval[]
): { label: "At Risk" | "On Track" | "Needs Attention"; detail: string; tone: string } {
  const overdueTasks = tasks.filter(
    (task) => task.status !== "Done" && task.dueDate && new Date(task.dueDate) < new Date("2026-04-13")
  ).length;
  const pendingApprovals = approvals.filter((approval) => approval.status === "Pending").length;
  const unscheduledReady = content.filter(
    (item) => item.approvalState === "Approved" && item.publishState === "Ready"
  ).length;
  const missingContent = content.filter((item) => !item.caption.trim() || item.assetState !== "Ready").length;

  if (overdueTasks || pendingApprovals) {
    return {
      label: "At Risk",
      detail: `${number(overdueTasks + pendingApprovals)} blocker${overdueTasks + pendingApprovals === 1 ? "" : "s"} need attention.`,
      tone: "border-rose-500/30 bg-rose-500/10 text-rose-700"
    };
  }

  if (unscheduledReady || missingContent) {
    return {
      label: "Needs Attention",
      detail: `${number(unscheduledReady + missingContent)} execution gap${unscheduledReady + missingContent === 1 ? "" : "s"} are still open.`,
      tone: "border-amber-500/30 bg-amber-500/10 text-amber-700"
    };
  }

  return {
    label: "On Track",
    detail: "Current work is moving cleanly through the pipeline.",
    tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
  };
}

function getNextAction(tasks: DemoTask[], content: DemoContent[], approvals: DemoApproval[]) {
  const overdueTask = tasks.find(
    (task) => task.status !== "Done" && task.dueDate && new Date(task.dueDate) < new Date("2026-04-13")
  );
  if (overdueTask) {
    return {
      title: "Resolve overdue work",
      detail: `${overdueTask.title} is overdue and blocking the campaign.`,
      action: "Open tasks"
    };
  }

  const pendingApproval = approvals.find((approval) => approval.status === "Pending");
  if (pendingApproval) {
    return {
      title: "Review pending approval",
      detail: pendingApproval.comment,
      action: "Approve or request changes"
    };
  }

  const readyItem = content.find((item) => item.approvalState === "Approved" && item.publishState === "Ready");
  if (readyItem) {
    return {
      title: "Schedule ready content",
      detail: `${readyItem.title} is approved and ready to place on the calendar.`,
      action: "Schedule"
    };
  }

  return {
    title: "Capture results",
    detail: "Execution is moving. Review website and revenue response next.",
    action: "Open analytics"
  };
}

export default function DemoPage() {
  const [activeView, setActiveView] = useState<DemoView>("home");
  const [selectedCampaignId, setSelectedCampaignId] = useState(demoWorkspace.campaigns[0]?.id ?? "");
  const [contentItems, setContentItems] = useState<DemoContent[]>(demoWorkspace.content);
  const [approvals, setApprovals] = useState<DemoApproval[]>(demoWorkspace.approvals);

  const selectedCampaign = useMemo(
    () => demoWorkspace.campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? demoWorkspace.campaigns[0],
    [selectedCampaignId]
  );
  const selectedTasks = useMemo(() => campaignTasks(demoWorkspace.tasks, selectedCampaign.id), [selectedCampaign.id]);
  const selectedContent = useMemo(() => campaignContent(contentItems, selectedCampaign.id), [contentItems, selectedCampaign.id]);
  const selectedApprovals = useMemo(() => campaignApprovals(approvals, selectedCampaign.id), [approvals, selectedCampaign.id]);
  const selectedHealth = useMemo(
    () => getCampaignHealth(selectedTasks, selectedContent, selectedApprovals),
    [selectedApprovals, selectedContent, selectedTasks]
  );
  const nextAction = useMemo(
    () => getNextAction(selectedTasks, selectedContent, selectedApprovals),
    [selectedApprovals, selectedContent, selectedTasks]
  );
  const readyToSchedule = selectedContent.filter(
    (item) => item.approvalState === "Approved" && item.publishState === "Ready"
  );
  const pipeline = [
    { id: "goal" as PipelineStage, label: "Goal", count: 1, state: selectedCampaign.goal ? "complete" : "blocked" },
    { id: "tasks" as PipelineStage, label: "Tasks", count: selectedTasks.length, state: selectedTasks.some((task) => task.status !== "Done") ? "active" : "complete" },
    { id: "content" as PipelineStage, label: "Content", count: selectedContent.length, state: selectedContent.length ? "active" : "blocked" },
    { id: "approvals" as PipelineStage, label: "Approvals", count: selectedApprovals.length, state: selectedApprovals.some((item) => item.status === "Pending") ? "blocked" : selectedApprovals.length ? "complete" : "active" },
    { id: "scheduled" as PipelineStage, label: "Scheduled", count: selectedContent.filter((item) => item.publishState === "Scheduled").length, state: readyToSchedule.length ? "active" : selectedContent.some((item) => item.publishState === "Scheduled") ? "complete" : "blocked" },
    { id: "results" as PipelineStage, label: "Results", count: selectedCampaign.attributedCovers, state: selectedCampaign.attributedRevenue > 0 ? "complete" : "blocked" }
  ];
  const calendarItems = useMemo(
    () =>
      [
        ...demoWorkspace.tasks
          .filter((task) => task.startDate || task.dueDate)
          .map((task) => ({
            id: task.id,
            kind: task.milestone ? "Milestone" : "Task",
            title: task.title,
            date: task.dueDate ?? task.startDate ?? "",
            detail: task.status
          })),
        ...contentItems
          .filter((item) => item.publishDate)
          .map((item) => ({
            id: item.id,
            kind: "Content",
            title: item.title,
            date: item.publishDate ?? "",
            detail: `${item.platform} · ${item.publishState}`
          }))
      ].sort((left, right) => left.date.localeCompare(right.date)),
    [contentItems]
  );

  const handleSendToApproval = (contentId: string) => {
    setContentItems((current) =>
      current.map((item) =>
        item.id === contentId
          ? { ...item, approvalState: "Pending", publishState: "Ready", publishDate: item.publishDate ?? "2026-04-16" }
          : item
      )
    );
    setApprovals((current) =>
      current.some((approval) => approval.contentId === contentId)
        ? current
        : [
            {
              id: `demo-approval-${contentId}`,
              contentId,
              campaignId: selectedCampaign.id,
              status: "Pending",
              requester: "Diego",
              waitingOn: "Client",
              comment: "Awaiting client sign-off before scheduling."
            },
            ...current
          ]
    );
  };

  const handleApproval = (contentId: string, status: "Approved" | "Changes Requested") => {
    setApprovals((current) =>
      current.map((approval) =>
        approval.contentId === contentId ? { ...approval, status } : approval
      )
    );
    setContentItems((current) =>
      current.map((item) =>
        item.id === contentId
          ? {
              ...item,
              approvalState: status,
              publishState: status === "Approved" ? "Ready" : "Draft"
            }
          : item
      )
    );
  };

  const handleSchedule = (contentId: string) => {
    setContentItems((current) =>
      current.map((item) =>
        item.id === contentId
          ? {
              ...item,
              publishState: "Scheduled",
              publishDate: item.publishDate ?? "2026-04-17"
            }
          : item
      )
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 -z-10 bg-olive-glow opacity-80" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-[linear-gradient(180deg,rgba(185,151,83,0.08),transparent)]" />
      <main className="mx-auto max-w-7xl px-3 py-3 pb-28 sm:px-6 sm:py-6 lg:px-10">
        <div className="rounded-[1.5rem] border border-[rgba(146,124,73,0.14)] bg-[rgba(253,251,247,0.92)] p-4 shadow-[0_18px_40px_rgba(91,72,42,0.08)] sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <Badge>{demoWorkspace.label}</Badge>
              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-foreground sm:text-4xl">
                {demoWorkspace.restaurantName}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{demoWorkspace.summary}</p>
            </div>
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-primary">
              Back to app <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {demoWorkspace.topMetrics.map((metric) => (
              <Card className="p-4" key={metric.id}>
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">{metric.value}</p>
                <p className="mt-2 text-sm text-muted-foreground">{metric.detail}</p>
              </Card>
            ))}
          </div>
        </div>

        <div className="sticky top-3 z-20 mt-4 flex gap-2 overflow-x-auto rounded-[1.25rem] border border-[rgba(146,124,73,0.14)] bg-[rgba(253,251,247,0.88)] p-2 shadow-[0_10px_24px_rgba(91,72,42,0.05)] backdrop-blur">
          {demoViews.map((view) => {
            const Icon = view.icon;
            return (
              <button
                key={view.id}
                className={cn(
                  "inline-flex items-center gap-2 rounded-[1rem] px-4 py-2 text-sm font-medium transition",
                  activeView === view.id ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-primary/5 hover:text-foreground"
                )}
                type="button"
                onClick={() => setActiveView(view.id)}
              >
                <Icon className="h-4 w-4" />
                {view.label}
              </button>
            );
          })}
        </div>

        {activeView === "home" ? (
          <div className="mt-4 grid gap-4">
            <Card>
              <CardHeader>
                <div>
                  <CardDescription>Next Action</CardDescription>
                  <CardTitle className="mt-3">{demoWorkspace.nextAction}</CardTitle>
                </div>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <div>
                  <CardDescription>Active Campaigns</CardDescription>
                  <CardTitle className="mt-3">What is moving the business now</CardTitle>
                </div>
              </CardHeader>
              <div className="grid gap-3">
                {demoWorkspace.campaigns.map((campaign) => {
                  const campaignTasksForRow = campaignTasks(demoWorkspace.tasks, campaign.id);
                  const campaignContentForRow = campaignContent(contentItems, campaign.id);
                  const campaignApprovalsForRow = campaignApprovals(approvals, campaign.id);
                  const health = getCampaignHealth(campaignTasksForRow, campaignContentForRow, campaignApprovalsForRow);

                  return (
                    <button
                      className="text-left"
                      key={campaign.id}
                      type="button"
                      onClick={() => {
                        setSelectedCampaignId(campaign.id);
                        setActiveView("campaigns");
                      }}
                    >
                      <ListCard>
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">{campaign.name}</p>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">{campaign.objective}</p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span className="rounded-full bg-muted/60 px-2.5 py-1">{campaign.status}</span>
                              <span className={cn("rounded-full border px-2.5 py-1", health.tone)}>{health.label}</span>
                              <span className="rounded-full bg-muted/60 px-2.5 py-1">{currency(campaign.attributedRevenue)}</span>
                            </div>
                          </div>
                          <span className="text-sm font-medium text-primary">Open</span>
                        </div>
                      </ListCard>
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        ) : null}

        {activeView === "campaigns" ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
            <Card>
              <CardHeader>
                <div>
                  <CardDescription>Campaigns</CardDescription>
                  <CardTitle className="mt-3">Demo workspace</CardTitle>
                </div>
              </CardHeader>
              <div className="space-y-3">
                {demoWorkspace.campaigns.map((campaign) => (
                  <button
                    className={cn(
                      "block w-full rounded-[1rem] border p-4 text-left transition",
                      selectedCampaignId === campaign.id ? "border-primary/35 bg-primary/5" : "border-border/70 bg-card/50"
                    )}
                    key={campaign.id}
                    type="button"
                    onClick={() => setSelectedCampaignId(campaign.id)}
                  >
                    <p className="font-medium text-foreground">{campaign.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{campaign.objective}</p>
                  </button>
                ))}
              </div>
            </Card>

            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <div>
                    <CardDescription>Execution pipeline</CardDescription>
                    <CardTitle className="mt-3">{selectedCampaign.name}</CardTitle>
                  </div>
                  <span className={cn("inline-flex rounded-full border px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.24em]", selectedHealth.tone)}>
                    {selectedHealth.label}
                  </span>
                </CardHeader>
                <div className="flex gap-3 overflow-x-auto">
                  {pipeline.map((stage) => (
                    <button
                      key={stage.id}
                      className={cn(
                        "min-w-[8rem] rounded-[1rem] border px-3 py-3 text-left",
                        stage.state === "complete"
                          ? "border-emerald-500/30 bg-emerald-500/10"
                          : stage.state === "active"
                            ? "border-primary/25 bg-primary/5"
                            : "border-amber-500/25 bg-amber-500/10"
                      )}
                      type="button"
                    >
                      <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">{stage.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">{number(stage.count)}</p>
                      <p className="mt-2 text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">{stage.state}</p>
                    </button>
                  ))}
                </div>
              </Card>

              <Card>
                <CardHeader>
                  <div>
                    <CardDescription>Next Action</CardDescription>
                    <CardTitle className="mt-3">{nextAction.title}</CardTitle>
                  </div>
                </CardHeader>
                <p className="text-sm leading-6 text-muted-foreground">{nextAction.detail}</p>
              </Card>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <div>
                      <CardDescription>Tasks</CardDescription>
                      <CardTitle className="mt-3">Execution queue</CardTitle>
                    </div>
                  </CardHeader>
                  <div className="space-y-3">
                    {selectedTasks.map((task) => (
                      <ListCard key={task.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">{task.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span className="rounded-full bg-muted/60 px-2.5 py-1">{task.type}</span>
                              <span className="rounded-full bg-muted/60 px-2.5 py-1">{task.priority}</span>
                              {task.dueDate ? <DatePill value={task.dueDate} /> : null}
                            </div>
                          </div>
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{task.status}</span>
                        </div>
                      </ListCard>
                    ))}
                  </div>
                </Card>

                <Card>
                  <CardHeader>
                    <div>
                      <CardDescription>Content</CardDescription>
                      <CardTitle className="mt-3">Draft to schedule</CardTitle>
                    </div>
                  </CardHeader>
                  <div className="space-y-3">
                    {selectedContent.map((item) => (
                      <ListCard key={item.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">{item.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{item.platform} · {item.format}</p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                              {item.caption || "No copy yet."}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span className="rounded-full bg-muted/60 px-2.5 py-1">Assets {item.assetState}</span>
                              <span className="rounded-full bg-muted/60 px-2.5 py-1">Approval {item.approvalState}</span>
                              <span className="rounded-full bg-muted/60 px-2.5 py-1">Publish {item.publishState}</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {item.approvalState === "None" ? (
                            <Button size="sm" variant="outline" onClick={() => handleSendToApproval(item.id)}>
                              Send to approval
                            </Button>
                          ) : null}
                          {item.approvalState === "Pending" ? (
                            <>
                              <Button size="sm" onClick={() => handleApproval(item.id, "Approved")}>Approve</Button>
                              <Button size="sm" variant="outline" onClick={() => handleApproval(item.id, "Changes Requested")}>
                                Request changes
                              </Button>
                            </>
                          ) : null}
                          {item.approvalState === "Approved" && item.publishState !== "Scheduled" ? (
                            <Button size="sm" onClick={() => handleSchedule(item.id)}>Schedule</Button>
                          ) : null}
                        </div>
                      </ListCard>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        ) : null}

        {activeView === "calendar" ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
            <Card>
              <CardHeader>
                <div>
                  <CardDescription>Ready to schedule</CardDescription>
                  <CardTitle className="mt-3">Items waiting for a slot</CardTitle>
                </div>
              </CardHeader>
              <div className="space-y-3">
                {contentItems.filter((item) => item.approvalState === "Approved" && item.publishState === "Ready").length ? (
                  contentItems
                    .filter((item) => item.approvalState === "Approved" && item.publishState === "Ready")
                    .map((item) => (
                      <ListCard key={item.id}>
                        <p className="font-medium text-foreground">{item.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.platform} · {item.format}</p>
                        <Button className="mt-4" size="sm" onClick={() => handleSchedule(item.id)}>
                          Schedule next
                        </Button>
                      </ListCard>
                    ))
                ) : (
                  <ListCard>
                    <p className="text-sm text-muted-foreground">All approved content is already scheduled.</p>
                  </ListCard>
                )}
              </div>
            </Card>
            <Card>
              <CardHeader>
                <div>
                  <CardDescription>Calendar</CardDescription>
                  <CardTitle className="mt-3">Tasks, content, and milestones</CardTitle>
                </div>
              </CardHeader>
              <div className="space-y-3">
                {calendarItems.map((item) => (
                  <ListCard key={item.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-foreground">{item.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.kind}</p>
                        <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
                      </div>
                      <DatePill value={item.date} />
                    </div>
                  </ListCard>
                ))}
              </div>
            </Card>
          </div>
        ) : null}

        {activeView === "analytics" ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <Card>
              <CardHeader>
                <div>
                  <CardDescription>Web analytics</CardDescription>
                  <CardTitle className="mt-3">Traffic and intent</CardTitle>
                </div>
              </CardHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <ListCard>
                  <p className="text-sm text-muted-foreground">Sessions</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{number(demoWorkspace.analytics.sessions)}</p>
                </ListCard>
                <ListCard>
                  <p className="text-sm text-muted-foreground">Users</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{number(demoWorkspace.analytics.users)}</p>
                </ListCard>
                <ListCard>
                  <p className="text-sm text-muted-foreground">Reservation clicks</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{number(demoWorkspace.analytics.reservationClicks)}</p>
                </ListCard>
                <ListCard>
                  <p className="text-sm text-muted-foreground">Menu views</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{number(demoWorkspace.analytics.menuViews)}</p>
                </ListCard>
              </div>
              <div className="mt-4 rounded-[1rem] border border-border/70 bg-card/60 p-4">
                <p className="text-sm font-medium text-foreground">Top source</p>
                <p className="mt-2 text-sm text-muted-foreground">{demoWorkspace.analytics.topSource}</p>
                <p className="mt-3 text-sm font-medium text-foreground">Top landing page</p>
                <p className="mt-2 text-sm text-muted-foreground">{demoWorkspace.analytics.topLandingPage}</p>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardDescription>Revenue model</CardDescription>
                  <CardTitle className="mt-3">Business result snapshot</CardTitle>
                </div>
              </CardHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <ListCard>
                  <p className="text-sm text-muted-foreground">Weekly revenue</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{currency(demoWorkspace.revenueModel.weeklyRevenue)}</p>
                </ListCard>
                <ListCard>
                  <p className="text-sm text-muted-foreground">Monthly revenue</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{currency(demoWorkspace.revenueModel.monthlyRevenue)}</p>
                </ListCard>
                <ListCard>
                  <p className="text-sm text-muted-foreground">Weekly covers</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{number(demoWorkspace.revenueModel.weeklyCovers)}</p>
                </ListCard>
                <ListCard>
                  <p className="text-sm text-muted-foreground">Growth target</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{demoWorkspace.revenueModel.growthTarget}%</p>
                </ListCard>
              </div>
              <div className="mt-4 rounded-[1rem] border border-border/70 bg-card/60 p-4">
                <p className="text-sm font-medium text-foreground">What the business needs next</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Tuesday dinner is still the softest window, while Saturday brunch remains the strongest performer. Use the active campaign mix to push Tuesday without cannibalizing brunch demand.
                </p>
              </div>
            </Card>
          </div>
        ) : null}
      </main>
    </div>
  );
}
