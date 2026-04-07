"use client";

import { useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  TrendingUp
} from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePill } from "@/components/ui/date-pill";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { useActiveClient } from "@/lib/client-context";
import { calculateRevenueModel } from "@/lib/calculations";
import { getCampaignOverview } from "@/lib/domain/campaigns";
import { buildScheduledContent } from "@/lib/domain/content";
import { buildImpactSentence } from "@/lib/domain/revenue";
import { useAnalyticsSnapshots } from "@/lib/repositories/use-analytics-snapshots";
import { useAssets } from "@/lib/repositories/use-assets";
import { useBlogPosts } from "@/lib/repositories/use-blog-posts";
import { useCampaigns } from "@/lib/repositories/use-campaigns";
import { useClientSettings } from "@/lib/repositories/use-client-settings";
import { usePlannerItems } from "@/lib/repositories/use-planner-items";
import { usePosts } from "@/lib/repositories/use-posts";
import { useActivityEvents } from "@/lib/repositories/use-activity-events";
import { useOperationalTasks } from "@/lib/repositories/use-operational-tasks";
import { useWeeklyMetrics } from "@/lib/repositories/use-weekly-metrics";
import { useApprovalsApi } from "@/lib/use-approvals-api";
import { cn, currency, number } from "@/lib/utils";
import { useWorkspaceContext } from "@/lib/workspace-context";
import type { ClientSettings } from "@/types";

type OverviewDraft = {
  averageCheck: string;
  weeklyCovers: string;
  monthlyCovers: string;
  growthTarget: string;
  overviewHeadline: string;
  overviewSummary: string;
  overviewPinnedCampaignId: string;
  overviewFeaturedMetric: ClientSettings["overviewFeaturedMetric"];
  overviewCards: OverviewCardDraft[];
};

type OverviewCardDraft = {
  id: "primary" | "review" | "publish";
  label: string;
  value: string;
  detail: string;
  href: Route;
};

type ClientAction = {
  id: string;
  title: string;
  detail: string;
  href: Route;
  tone: "review" | "schedule" | "task";
  date?: string;
};

const overviewStatePrefix = "__client_home_v1__";

function decodeOverviewSummary(value: string): {
  summary: string;
  cards?: OverviewCardDraft[];
} {
  if (!value.startsWith(overviewStatePrefix)) {
    return { summary: value };
  }

  try {
    const parsed = JSON.parse(value.slice(overviewStatePrefix.length)) as {
      summary?: unknown;
      cards?: unknown;
    };

    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      cards: Array.isArray(parsed.cards)
        ? parsed.cards
            .filter((card): card is OverviewCardDraft => {
              if (!card || typeof card !== "object") return false;
              const item = card as Partial<OverviewCardDraft>;
              return (
                (item.id === "primary" || item.id === "review" || item.id === "publish") &&
                typeof item.label === "string" &&
                typeof item.value === "string" &&
                typeof item.detail === "string" &&
                typeof item.href === "string"
              );
            })
            .slice(0, 3)
        : undefined
    };
  } catch {
    return { summary: value.replace(overviewStatePrefix, "") };
  }
}

function encodeOverviewSummary(summary: string, cards: OverviewCardDraft[]) {
  return `${overviewStatePrefix}${JSON.stringify({ summary, cards })}`;
}

function toOverviewDraft(settings: ClientSettings, fallbackCards: OverviewCardDraft[] = []): OverviewDraft {
  const decodedOverview = decodeOverviewSummary(settings.overviewSummary);

  return {
    averageCheck: String(settings.averageCheck),
    weeklyCovers: String(settings.weeklyCovers),
    monthlyCovers: String(settings.monthlyCovers),
    growthTarget: String(settings.defaultGrowthTarget),
    overviewHeadline: settings.overviewHeadline,
    overviewSummary: decodedOverview.summary,
    overviewPinnedCampaignId: settings.overviewPinnedCampaignId ?? "",
    overviewFeaturedMetric: settings.overviewFeaturedMetric,
    overviewCards: decodedOverview.cards?.length === 3 ? decodedOverview.cards : fallbackCards
  };
}

function getGreeting(name: string) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return `${greeting}, ${name}`;
}

function formatToday() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "long",
    day: "2-digit"
  }).format(new Date());
}

export default function DashboardPage() {
  const { activeClient } = useActiveClient();
  const { profile } = useAuth();
  const { workspace } = useWorkspaceContext();
  const { settings, setSettings, revenueModelDefaults } = useClientSettings(activeClient.id);
  const { metrics } = useWeeklyMetrics(activeClient.id);
  const { items } = usePlannerItems(activeClient.id);
  const { posts } = usePosts(activeClient.id);
  const { campaigns } = useCampaigns(activeClient.id);
  const { blogPosts } = useBlogPosts(activeClient.id);
  const { assets } = useAssets(activeClient.id);
  const { analyticsSnapshots } = useAnalyticsSnapshots(activeClient.id);
  const { tasks } = useOperationalTasks(workspace.id);
  const { events } = useActivityEvents(workspace.id);
  const { approvals, ready: approvalsReady, reviewApproval } = useApprovalsApi(activeClient.id);
  const [isEditingOverview, setIsEditingOverview] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [overviewDraft, setOverviewDraft] = useState<OverviewDraft>(() => toOverviewDraft(settings));

  const model = calculateRevenueModel(revenueModelDefaults);
  const scheduledContent = buildScheduledContent(posts, items).slice(0, 5);
  const workspaceTasks = tasks.filter((task) => !task.clientId || task.clientId === activeClient.id);
  const openTasks = workspaceTasks
    .filter((task) => task.status !== "Done")
    .sort((left, right) => {
      if (!left.dueDate) return 1;
      if (!right.dueDate) return -1;
      return new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
    });
  const recentActivity = events.filter((item) => !item.clientId || item.clientId === activeClient.id).slice(0, 3);
  const pendingApprovals = approvals.filter((approval) => approval.status === "Pending");
  const nextScheduledItem = scheduledContent[0] ?? null;
  const nextTask = openTasks[0] ?? null;
  const decodedOverview = useMemo(() => decodeOverviewSummary(settings.overviewSummary), [settings.overviewSummary]);
  const clientFirstName =
    profile?.fullName?.split(" ")[0] ??
    profile?.email?.split("@")[0] ??
    "there";
  const pinnedCampaign =
    campaigns.find((campaign) => campaign.id === settings.overviewPinnedCampaignId) ??
    campaigns.find((campaign) => campaign.status === "Active") ??
    campaigns[0] ??
    null;
  const leadCampaign = pinnedCampaign
    ? getCampaignOverview(pinnedCampaign, posts, blogPosts, assets, metrics, analyticsSnapshots)
    : null;

  const clientActions = useMemo<ClientAction[]>(() => {
    const actions: ClientAction[] = [];

    if (pendingApprovals[0]) {
      actions.push({
        id: pendingApprovals[0].id,
        title: pendingApprovals[0].summary,
        detail: pendingApprovals[0].note ?? "Waiting on approval before this can move forward.",
        href: "/approvals",
        tone: "review"
      });
    }

    if (nextScheduledItem) {
      actions.push({
        id: nextScheduledItem.id,
        title: nextScheduledItem.content,
        detail: nextScheduledItem.platform,
        href: "/calendar",
        tone: "schedule",
        date: nextScheduledItem.date
      });
    }

    if (nextTask) {
      actions.push({
        id: nextTask.id,
        title: nextTask.title,
        detail: nextTask.status,
        href: "/approvals#open-tasks",
        tone: "task",
        date: nextTask.dueDate
      });
    }

    return actions.slice(0, 4);
  }, [nextScheduledItem, nextTask, pendingApprovals]);

  const featuredMetric = useMemo(() => {
    switch (settings.overviewFeaturedMetric) {
      case "weekly-revenue":
        return {
          label: "Weekly Revenue",
          value: currency(model.weeklyRevenue),
          href: "/performance#business-snapshot" as Route
        };
      case "tracked-revenue":
        return {
          label: "Tracked Revenue",
          value: currency(analyticsSnapshots.reduce((total, snapshot) => total + snapshot.attributedRevenue, 0)),
          href: "/performance#campaign-impact" as Route
        };
      case "open-tasks":
        return {
          label: "Open Items",
          value: number(openTasks.length),
          href: "/approvals#open-tasks" as Route
        };
      case "weekly-covers":
      default:
        return {
          label: "Weekly Covers",
          value: number(model.weeklyCovers),
          href: "/performance#business-snapshot" as Route
        };
    }
  }, [analyticsSnapshots, model.weeklyCovers, model.weeklyRevenue, openTasks.length, settings.overviewFeaturedMetric]);

  const defaultHomeCards = useMemo<OverviewCardDraft[]>(() => [
    {
      id: "primary",
      label: featuredMetric.label,
      value: featuredMetric.value,
      detail: "The one number to keep in view this week.",
      href: featuredMetric.href
    },
    {
      id: "review",
      label: "Waiting on Review",
      value: approvalsReady ? number(pendingApprovals.length) : "...",
      detail: "Content or requests that need a client decision.",
      href: "/approvals" as Route
    },
    {
      id: "publish",
      label: "Next Publish",
      value: nextScheduledItem ? nextScheduledItem.platform : "None",
      detail: nextScheduledItem?.content ?? "No scheduled content is on the calendar yet.",
      href: "/calendar" as Route
    }
  ], [approvalsReady, featuredMetric, nextScheduledItem, pendingApprovals.length]);

  const clientHomeCards =
    decodedOverview.cards?.length === 3 ? decodedOverview.cards : defaultHomeCards;

  const performancePulse: Array<{ label: string; value: string; href: Route }> = clientHomeCards.map((card) => ({
    label: card.label,
    value: card.value,
    href: card.href
  }));

  useEffect(() => {
    setOverviewDraft(toOverviewDraft(settings, defaultHomeCards));
  }, [defaultHomeCards, settings]);

  const saveOverview = () => {
    setSettings((current) => ({
      ...current,
      averageCheck: Number(overviewDraft.averageCheck) || 0,
      weeklyCovers: Number(overviewDraft.weeklyCovers) || 0,
      monthlyCovers: Number(overviewDraft.monthlyCovers) || 0,
      defaultGrowthTarget: Number(overviewDraft.growthTarget) || 0,
      overviewHeadline: overviewDraft.overviewHeadline.trim(),
      overviewSummary: encodeOverviewSummary(overviewDraft.overviewSummary.trim(), overviewDraft.overviewCards),
      overviewPinnedCampaignId: overviewDraft.overviewPinnedCampaignId || undefined,
      overviewFeaturedMetric: overviewDraft.overviewFeaturedMetric
    }));
    setIsEditingOverview(false);
  };

  const handleReview = async (approvalId: string, status: "Approved" | "Changes Requested") => {
    setReviewingId(approvalId);

    try {
      await reviewApproval(approvalId, {
        status,
        note: status === "Approved" ? "Approved from the client home dashboard." : "Requested changes from the client home dashboard.",
        approverName: profile?.fullName ?? profile?.email ?? "Client"
      });
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="-mx-4 -mt-4 rounded-b-[2rem] bg-[#202124] px-4 pb-6 pt-7 text-white shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:hidden">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-white/70">{formatToday()}</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em]">{getGreeting(clientFirstName)}</h1>
          </div>
          <button
            className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white/70"
            type="button"
            onClick={() => setIsEditingOverview((current) => !current)}
            aria-label="Customize client home"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-8 rounded-[1.75rem] border border-white/10 bg-[#1b1c1f] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold tracking-[-0.04em]">Needs attention</h2>
            <Link className="text-sm font-medium text-white/60" href="/approvals">
              View all
            </Link>
          </div>
          <div className="mt-5 space-y-5">
            {clientActions.length ? (
              clientActions.map((action) => (
                <Link className="flex items-start gap-4" href={action.href} key={action.id}>
                  <span
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
                      action.tone === "review" ? "border-[var(--app-accent-bg)] text-[var(--app-accent-bg)]" : "border-white/25 text-white/60"
                    )}
                  >
                    {action.tone === "review" ? <MessageSquare className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-lg font-semibold">{action.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-sm leading-5 text-white/55">
                      <span>{action.detail}</span>
                      {action.date ? (
                        <DatePill className="border-white/15 bg-white/10 text-white/75" value={action.date} />
                      ) : null}
                    </span>
                  </span>
                </Link>
              ))
            ) : (
              <div className="flex items-center gap-4 text-white/65">
                <CheckCircle2 className="h-9 w-9 text-[var(--app-accent-bg)]" />
                <p className="text-base">Nothing needs approval right now.</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {clientHomeCards.map((card) => (
            <Link className="rounded-[1.45rem] border border-white/10 bg-[#1b1c1f] p-4" href={card.href} key={card.id}>
              <p className="text-sm text-white/50">{card.label}</p>
              <p className="mt-2 truncate text-3xl font-semibold tracking-[-0.04em] text-white">{card.value}</p>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/50">{card.detail}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="hidden items-start justify-between gap-6 sm:flex">
        <PageHeader
          eyebrow="Client Home"
          title={`${activeClient.name} home`}
          description={
            decodedOverview.summary ||
            "A calmer client-facing view of what needs review, what is going out next, and how the restaurant is tracking."
          }
        />
        <Button className="shrink-0" variant="outline" onClick={() => setIsEditingOverview((current) => !current)}>
          <Pencil className="mr-2 h-4 w-4" />
          {isEditingOverview ? "Close" : "Customize"}
        </Button>
      </div>

      {isEditingOverview ? (
        <Card>
          <CardHeader>
            <div>
              <CardDescription>Client Home Settings</CardDescription>
              <CardTitle className="mt-3">Tune the story the client sees first</CardTitle>
            </div>
          </CardHeader>
          <div className="grid gap-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <Label>Average Check</Label>
                <Input value={overviewDraft.averageCheck} type="number" step="0.01" onChange={(event) => setOverviewDraft((current) => ({ ...current, averageCheck: event.target.value }))} />
              </div>
              <div>
                <Label>Weekly Covers</Label>
                <Input value={overviewDraft.weeklyCovers} type="number" step="0.01" onChange={(event) => setOverviewDraft((current) => ({ ...current, weeklyCovers: event.target.value }))} />
              </div>
              <div>
                <Label>Monthly Covers</Label>
                <Input value={overviewDraft.monthlyCovers} type="number" step="0.01" onChange={(event) => setOverviewDraft((current) => ({ ...current, monthlyCovers: event.target.value }))} />
              </div>
              <div>
                <Label>Growth Target %</Label>
                <Input value={overviewDraft.growthTarget} type="number" step="0.01" onChange={(event) => setOverviewDraft((current) => ({ ...current, growthTarget: event.target.value }))} />
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4">
                <div>
                  <Label>Headline</Label>
                  <Input value={overviewDraft.overviewHeadline} onChange={(event) => setOverviewDraft((current) => ({ ...current, overviewHeadline: event.target.value }))} placeholder="Set the headline you want at the top of the client home." />
                </div>
                <div>
                  <Label>Client Note</Label>
                  <Textarea value={overviewDraft.overviewSummary} onChange={(event) => setOverviewDraft((current) => ({ ...current, overviewSummary: event.target.value }))} placeholder="Add the context you want the client to see first." />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Featured Metric</Label>
                  <Select
                    value={overviewDraft.overviewFeaturedMetric}
                    onChange={(value) =>
                      setOverviewDraft((current) => ({
                        ...current,
                        overviewFeaturedMetric: value as OverviewDraft["overviewFeaturedMetric"]
                      }))
                    }
                    options={[
                      { label: "Weekly Covers", value: "weekly-covers" },
                      { label: "Weekly Revenue", value: "weekly-revenue" },
                      { label: "Tracked Revenue", value: "tracked-revenue" },
                      { label: "Open Items", value: "open-tasks" }
                    ]}
                  />
                </div>
                <div>
                  <Label>Pinned Campaign</Label>
                  <Select
                    value={overviewDraft.overviewPinnedCampaignId}
                    onChange={(value) => setOverviewDraft((current) => ({ ...current, overviewPinnedCampaignId: value }))}
                    options={[
                      { label: "No pinned campaign", value: "" },
                      ...campaigns.map((campaign) => ({ label: campaign.name, value: campaign.id }))
                    ]}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-border/70 bg-card/55 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Top overview cards</p>
                  <p className="mt-1 text-sm text-muted-foreground">Customize the three rounded cards shown first on desktop and mobile.</p>
                </div>
                <Button
                  onClick={() =>
                    setOverviewDraft((current) => ({
                      ...current,
                      overviewCards: defaultHomeCards
                    }))
                  }
                  type="button"
                  variant="outline"
                >
                  Use live defaults
                </Button>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                {overviewDraft.overviewCards.map((card, index) => (
                  <div className="rounded-[1rem] border border-border/70 bg-background/60 p-4" key={card.id}>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Card {index + 1}</p>
                    <div className="mt-4 space-y-3">
                      <div>
                        <Label>Label</Label>
                        <Input
                          value={card.label}
                          onChange={(event) =>
                            setOverviewDraft((current) => ({
                              ...current,
                              overviewCards: current.overviewCards.map((item) =>
                                item.id === card.id ? { ...item, label: event.target.value } : item
                              )
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label>Value</Label>
                        <Input
                          value={card.value}
                          onChange={(event) =>
                            setOverviewDraft((current) => ({
                              ...current,
                              overviewCards: current.overviewCards.map((item) =>
                                item.id === card.id ? { ...item, value: event.target.value } : item
                              )
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label>Detail</Label>
                        <Textarea
                          className="min-h-24"
                          value={card.detail}
                          onChange={(event) =>
                            setOverviewDraft((current) => ({
                              ...current,
                              overviewCards: current.overviewCards.map((item) =>
                                item.id === card.id ? { ...item, detail: event.target.value } : item
                              )
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setOverviewDraft(toOverviewDraft(settings, defaultHomeCards))}>
                Reset
              </Button>
              <Button onClick={saveOverview}>Save Client Home</Button>
            </div>
          </div>
        </Card>
      ) : null}

      <motion.div animate={{ opacity: 1, y: 0 }} className="grid gap-4 md:grid-cols-3" initial={{ opacity: 0, y: 12 }}>
        {clientHomeCards.map((card) => (
          <Link href={card.href} key={card.id}>
            <Card className="h-full p-5">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="mt-3 truncate font-display text-4xl text-foreground">{card.value}</p>
              <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">{card.detail}</p>
            </Card>
          </Link>
        ))}
      </motion.div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card id="client-review">
          <CardHeader>
            <div>
              <CardDescription>Client Review</CardDescription>
              <CardTitle className="mt-3">What needs a decision</CardTitle>
            </div>
            <Link className="hidden items-center gap-1 text-sm font-medium text-primary sm:flex" href="/approvals">
              Open inbox <ChevronRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <div className="space-y-3">
            {pendingApprovals.length ? (
              pendingApprovals.slice(0, 3).map((approval) => (
                <div className="rounded-3xl border border-border/70 bg-card/60 p-4" key={approval.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">{approval.summary}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{approval.note ?? `Requested by ${approval.requesterName}`}</p>
                    </div>
                    <p className="shrink-0 rounded-full bg-[var(--app-accent-soft)] px-3 py-1 text-xs font-medium text-[var(--app-accent-bg)]">
                      Review
                    </p>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button
                      className="sm:w-auto"
                      disabled={reviewingId === approval.id}
                      onClick={() => void handleReview(approval.id, "Approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      className="sm:w-auto"
                      disabled={reviewingId === approval.id}
                      variant="outline"
                      onClick={() => void handleReview(approval.id, "Changes Requested")}
                    >
                      Request changes
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title={approvalsReady ? "Nothing waiting on you" : "Loading reviews"}
                description={approvalsReady ? "Approvals and requested changes will show up here when content needs a decision." : "Checking the client review inbox."}
              />
            )}
          </div>
        </Card>

        <Card id="active-campaign">
          <CardHeader>
            <div>
              <CardDescription>Active Campaign</CardDescription>
              <CardTitle className="mt-3">{pinnedCampaign ? pinnedCampaign.name : "No campaign pinned yet"}</CardTitle>
            </div>
          </CardHeader>
          {leadCampaign && pinnedCampaign ? (
            <div className="space-y-5">
              <p className="text-sm leading-6 text-muted-foreground">
                {pinnedCampaign.objective || settings.overviewHeadline || decodedOverview.summary || buildImpactSentence(activeClient.name, revenueModelDefaults)}
              </p>
              <div className="grid gap-3 text-sm">
                <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium text-foreground">{pinnedCampaign.status}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
                  <span className="text-muted-foreground">Campaign content</span>
                  <span className="font-medium text-foreground">{number(leadCampaign.linkedPosts.length)} posts</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
                  <span className="text-muted-foreground">Attributed revenue</span>
                  <span className="font-medium text-foreground">{currency(leadCampaign.attributedRevenue)}</span>
                </div>
              </div>
              <Link
                className="inline-flex h-10 w-full items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-[0_10px_24px_rgba(149,114,46,0.18)] transition-colors hover:bg-primary/92"
                href={`/campaigns/${pinnedCampaign.id}` as Route}
              >
                Open campaign
              </Link>
            </div>
          ) : (
            <EmptyState title="No campaign yet" description="Create or pin a campaign to give clients a clean current-focus area." />
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card id="performance-pulse">
          <CardHeader>
            <div>
              <CardDescription>Restaurant Pulse</CardDescription>
              <CardTitle className="mt-3">Covers, revenue, and target</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-4">
            {performancePulse.map(({ label, value, href }) => (
              <Link className="flex items-center justify-between rounded-3xl border border-border/70 bg-card/65 px-4 py-4 transition hover:border-primary/40" href={href} key={label}>
                <span className="flex items-center gap-3 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  {label}
                </span>
                <span className="font-display text-2xl text-foreground">{value}</span>
              </Link>
            ))}
          </div>
        </Card>

        <Card id="upcoming-content">
          <CardHeader>
            <div>
              <CardDescription>This Week</CardDescription>
              <CardTitle className="mt-3">Upcoming content</CardTitle>
            </div>
            <Link className="hidden items-center gap-1 text-sm font-medium text-primary sm:flex" href="/calendar">
              Calendar <ChevronRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <div className="space-y-3">
            {scheduledContent.length ? (
              scheduledContent.slice(0, 4).map((item) => (
                <Link
                  className="grid gap-3 rounded-3xl border border-border/70 bg-card/60 p-4 transition hover:border-primary/40 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                  href="/content"
                  key={item.id}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--app-accent-soft)] text-[var(--app-accent-bg)]">
                    <CalendarDays className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{item.content}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{item.platform} · {item.cta}</span>
                  </span>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock3 className="h-4 w-4" />
                    <DatePill value={item.date} />
                  </span>
                </Link>
              ))
            ) : (
              <EmptyState title="No content scheduled" description="Scheduled posts will show up here once the campaign calendar is populated." />
            )}
          </div>
        </Card>
      </div>

      {recentActivity.length ? (
        <Card className="hidden sm:block">
          <CardHeader>
            <div>
              <CardDescription>Recent Updates</CardDescription>
              <CardTitle className="mt-3">Small changes since the last check-in</CardTitle>
            </div>
          </CardHeader>
          <div className="grid gap-3 md:grid-cols-3">
            {recentActivity.map((item) => (
              <div className="rounded-3xl border border-border/70 bg-card/60 p-4" key={item.id}>
                <p className="font-medium text-foreground">{item.subjectName}</p>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.detail}</p>
                <p className="mt-4 text-xs uppercase tracking-[0.16em] text-primary">
                  {item.actorName} {item.actionLabel}
                </p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
