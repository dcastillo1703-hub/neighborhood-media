"use client";

import { useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { motion } from "framer-motion";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartShell } from "@/components/charts/chart-shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListCard } from "@/components/dashboard/list-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatGrid } from "@/components/dashboard/stat-grid";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActiveClient } from "@/lib/client-context";
import { useAuth } from "@/lib/auth-context";
import { calculateRevenueModel } from "@/lib/calculations";
import { getCampaignOverview } from "@/lib/domain/campaigns";
import { buildScheduledContent } from "@/lib/domain/content";
import { buildWeeklyPerformance } from "@/lib/domain/performance";
import {
  summarizeChannelContribution,
  summarizeCampaignRecaps,
  summarizeRoi
} from "@/lib/domain/reporting";
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
import { currency, number, percent } from "@/lib/utils";
import { useWorkspaceContext } from "@/lib/workspace-context";
import type { ClientSettings } from "@/types";

const quickLinks: Array<{ href: Route; title: string; detail: string }> = [
  { href: "/campaigns", title: "Live Campaign", detail: "Open the campaign currently shaping the week and review the assets, posts, and targets tied to it." },
  { href: "/performance", title: "Client Story", detail: "Translate this week’s execution into covers, tables, revenue, and a client-ready performance view." },
  { href: "/approvals", title: "Team Queue", detail: "See what is waiting on approval, what is blocked, and what needs a push before launch." },
  { href: "/settings", title: "Channel Health", detail: "Confirm which channels and team permissions are ready before you promise publishing or reporting." },
  { href: "/content", title: "Next Publish", detail: "Draft, review, and schedule the next piece of content without losing campaign context." }
];

type OverviewDraft = {
  averageCheck: string;
  weeklyCovers: string;
  monthlyCovers: string;
  growthTarget: string;
  overviewHeadline: string;
  overviewSummary: string;
  overviewPinnedCampaignId: string;
  overviewFeaturedMetric: ClientSettings["overviewFeaturedMetric"];
  overviewShowSchedule: boolean;
  overviewShowTrafficTrend: boolean;
  overviewShowChannelContribution: boolean;
  overviewShowQuickLinks: boolean;
  overviewShowCampaignRecaps: boolean;
  overviewShowRecentActivity: boolean;
};

function toOverviewDraft(settings: ClientSettings): OverviewDraft {
  return {
    averageCheck: String(settings.averageCheck),
    weeklyCovers: String(settings.weeklyCovers),
    monthlyCovers: String(settings.monthlyCovers),
    growthTarget: String(settings.defaultGrowthTarget),
    overviewHeadline: settings.overviewHeadline,
    overviewSummary: settings.overviewSummary,
    overviewPinnedCampaignId: settings.overviewPinnedCampaignId ?? "",
    overviewFeaturedMetric: settings.overviewFeaturedMetric,
    overviewShowSchedule: settings.overviewShowSchedule,
    overviewShowTrafficTrend: settings.overviewShowTrafficTrend,
    overviewShowChannelContribution: settings.overviewShowChannelContribution,
    overviewShowQuickLinks: settings.overviewShowQuickLinks,
    overviewShowCampaignRecaps: settings.overviewShowCampaignRecaps,
    overviewShowRecentActivity: settings.overviewShowRecentActivity
  };
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
  const [isEditingOverview, setIsEditingOverview] = useState(false);
  const [overviewDraft, setOverviewDraft] = useState<OverviewDraft>(() => toOverviewDraft(settings));

  const model = calculateRevenueModel(revenueModelDefaults);
  const weeklyData = buildWeeklyPerformance(metrics, revenueModelDefaults.averageCheck);
  const scheduledContent = buildScheduledContent(posts, items).slice(0, 4);
  const workspaceTasks = tasks.filter((task) => !task.clientId || task.clientId === activeClient.id);
  const activity = events.filter((item) => !item.clientId || item.clientId === activeClient.id).slice(0, 4);
  const roiSummary = summarizeRoi(analyticsSnapshots);
  const channelContribution = summarizeChannelContribution(analyticsSnapshots);
  const campaignRecaps = summarizeCampaignRecaps(campaigns, analyticsSnapshots);
  const nextScheduledItem = scheduledContent[0] ?? null;
  const nextTask = workspaceTasks
    .filter((task) => task.status !== "Done")
    .sort((left, right) => {
      if (!left.dueDate) {
        return 1;
      }

      if (!right.dueDate) {
        return -1;
      }

      return new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
    })[0] ?? null;
  const operatorName = profile?.fullName ?? profile?.email?.split("@")[0] ?? "there";
  const pinnedCampaign =
    campaigns.find((campaign) => campaign.id === settings.overviewPinnedCampaignId) ??
    campaigns.find((campaign) => campaign.status === "Active") ??
    campaigns[0] ??
    null;
  const leadCampaign = pinnedCampaign
    ? getCampaignOverview(pinnedCampaign, posts, blogPosts, assets, metrics, analyticsSnapshots)
    : null;

  useEffect(() => {
    setOverviewDraft(toOverviewDraft(settings));
  }, [settings]);

  const featuredMetric = useMemo(() => {
    switch (settings.overviewFeaturedMetric) {
      case "weekly-revenue":
        return {
          label: "Featured KPI · Weekly Revenue",
          value: currency(model.weeklyRevenue),
          detail: "Live weekly revenue pace based on the current average check and cover assumptions.",
          href: "/performance#business-snapshot"
        };
      case "tracked-revenue":
        return {
          label: "Featured KPI · Tracked Revenue",
          value: currency(roiSummary.revenue),
          detail: "Revenue currently tied back to campaign and content activity.",
          href: "/performance#campaign-impact"
        };
      case "open-tasks":
        return {
          label: "Featured KPI · Open Tasks",
          value: number(workspaceTasks.filter((task) => task.status !== "Done").length),
          detail: "Execution items still in motion for this client.",
          href: "/approvals#open-tasks"
        };
      case "weekly-covers":
      default:
        return {
          label: "Featured KPI · Weekly Covers",
          value: number(model.weeklyCovers),
          detail: "Current weekly dining volume tied to this account.",
          href: "/performance#business-snapshot"
        };
    }
  }, [model.weeklyCovers, model.weeklyRevenue, roiSummary.revenue, settings.overviewFeaturedMetric, workspaceTasks]);

  const saveOverview = () => {
    setSettings((current) => ({
      ...current,
      averageCheck: Number(overviewDraft.averageCheck) || 0,
      weeklyCovers: Number(overviewDraft.weeklyCovers) || 0,
      monthlyCovers: Number(overviewDraft.monthlyCovers) || 0,
      defaultGrowthTarget: Number(overviewDraft.growthTarget) || 0,
      overviewHeadline: overviewDraft.overviewHeadline.trim(),
      overviewSummary: overviewDraft.overviewSummary.trim(),
      overviewPinnedCampaignId: overviewDraft.overviewPinnedCampaignId || undefined,
      overviewFeaturedMetric: overviewDraft.overviewFeaturedMetric,
      overviewShowSchedule: overviewDraft.overviewShowSchedule,
      overviewShowTrafficTrend: overviewDraft.overviewShowTrafficTrend,
      overviewShowChannelContribution: overviewDraft.overviewShowChannelContribution,
      overviewShowQuickLinks: overviewDraft.overviewShowQuickLinks,
      overviewShowCampaignRecaps: overviewDraft.overviewShowCampaignRecaps,
      overviewShowRecentActivity: overviewDraft.overviewShowRecentActivity
    }));
    setIsEditingOverview(false);
  };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Overview"
        title={`${activeClient.name} at a glance`}
        description={`Welcome back, ${operatorName}. This is the working view for ${activeClient.name}: current performance, active work, and the scheduled week.`}
      />

      <div className="flex justify-end">
        <Button variant={isEditingOverview ? "outline" : "default"} onClick={() => setIsEditingOverview((current) => !current)}>
          {isEditingOverview ? "Close Editor" : "Edit Overview"}
        </Button>
      </div>

      {isEditingOverview ? (
        <Card>
          <CardHeader>
            <div>
              <CardDescription>Overview Editor</CardDescription>
              <CardTitle className="mt-3">Change the overview without touching code</CardTitle>
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

            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4">
                <div>
                  <Label>Headline</Label>
                  <Input value={overviewDraft.overviewHeadline} onChange={(event) => setOverviewDraft((current) => ({ ...current, overviewHeadline: event.target.value }))} placeholder="Set the headline you want at the top of the overview." />
                </div>
                <div>
                  <Label>Summary</Label>
                  <Textarea value={overviewDraft.overviewSummary} onChange={(event) => setOverviewDraft((current) => ({ ...current, overviewSummary: event.target.value }))} placeholder="Add the note or context you want the team to see first." />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Featured KPI</Label>
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
                      { label: "Open Tasks", value: "open-tasks" }
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

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[
                ["overviewShowSchedule", "Show live schedule"],
                ["overviewShowTrafficTrend", "Show traffic trend chart"],
                ["overviewShowChannelContribution", "Show channel contribution chart"],
                ["overviewShowQuickLinks", "Show quick links"],
                ["overviewShowCampaignRecaps", "Show campaign recaps"],
                ["overviewShowRecentActivity", "Show recent activity"]
              ].map(([field, label]) => (
                <label
                  key={field}
                  className="flex items-center justify-between rounded-2xl border border-border/70 bg-card/65 px-4 py-3 text-sm text-foreground"
                >
                  <span>{label}</span>
                  <input
                    checked={overviewDraft[field as keyof Pick<
                      OverviewDraft,
                      | "overviewShowSchedule"
                      | "overviewShowTrafficTrend"
                      | "overviewShowChannelContribution"
                      | "overviewShowQuickLinks"
                      | "overviewShowCampaignRecaps"
                      | "overviewShowRecentActivity"
                    >] as boolean}
                    onChange={(event) =>
                      setOverviewDraft((current) => ({
                        ...current,
                        [field]: event.target.checked
                      }))
                    }
                    type="checkbox"
                  />
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setOverviewDraft(toOverviewDraft(settings))}>
                Reset
              </Button>
              <Button onClick={saveOverview}>Save Overview</Button>
            </div>
          </div>
        </Card>
      ) : null}

      <motion.div animate={{ opacity: 1, y: 0 }} className="space-y-10" initial={{ opacity: 0, y: 16 }}>
        <StatGrid>
          <MetricCard href={featuredMetric.href} label={featuredMetric.label} value={featuredMetric.value} detail={featuredMetric.detail} />
          <MetricCard href="/performance#business-snapshot" label="Weekly Covers" value={number(model.weeklyCovers)} detail="Current weekly dining volume tied to this account." />
          <MetricCard href="/performance#business-snapshot" label="Weekly Revenue" value={currency(model.weeklyRevenue)} detail="Current weekly revenue pace based on check average and cover volume." />
          <MetricCard href="/revenue-modeling#growth-target" label="Growth Target" value={percent(revenueModelDefaults.growthTarget)} detail="Lift goal you are modeling against right now." />
          <MetricCard href="/performance#campaign-impact" label="Tracked Revenue" value={currency(roiSummary.revenue)} detail="Revenue currently tied back to campaign and content activity." tone="olive" />
          <MetricCard href="/approvals#open-tasks" label="Open Tasks" value={number(workspaceTasks.filter((task) => task.status !== "Done").length)} detail="Execution items still in motion for this client." />
        </StatGrid>
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden">
          <CardHeader className="items-end">
            <div>
              <CardDescription>Pinned Narrative</CardDescription>
              <CardTitle className="mt-3 text-3xl leading-tight">
                {settings.overviewHeadline || buildImpactSentence(activeClient.name, revenueModelDefaults)}
              </CardTitle>
              <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
                {settings.overviewSummary || "Use the overview editor to pin a custom narrative, choose the KPI to feature, and control which sections show up on this page."}
              </p>
              {pinnedCampaign ? (
                <p className="mt-4 text-sm text-foreground">
                  <span className="text-muted-foreground">Pinned campaign:</span> {pinnedCampaign.name} · {pinnedCampaign.status}
                </p>
              ) : null}
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardDescription>Next On Deck</CardDescription>
              <CardTitle className="mt-3">What needs your attention first</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            <ListCard>
              <p className="text-sm text-muted-foreground">Next Scheduled Publish</p>
              <p className="mt-2 font-display text-2xl text-foreground">
                {nextScheduledItem ? nextScheduledItem.platform : "Nothing scheduled yet"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {nextScheduledItem ? `${nextScheduledItem.date} · ${nextScheduledItem.content}` : "Populate the planner to surface the next live publish here."}
              </p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Next Task Due</p>
              <p className="mt-2 font-display text-2xl text-foreground">{nextTask ? nextTask.title : "Queue is clear"}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {nextTask
                  ? `${nextTask.status} · ${nextTask.assigneeName ?? "Unassigned"}${nextTask.dueDate ? ` · due ${nextTask.dueDate}` : ""}`
                  : "No outstanding operational blockers are scheduled right now."}
              </p>
            </ListCard>
          </div>
        </Card>
      </div>

      {settings.overviewShowTrafficTrend || settings.overviewShowChannelContribution ? (
        <div className={`grid gap-6 ${settings.overviewShowTrafficTrend && settings.overviewShowChannelContribution ? "xl:grid-cols-[1.1fr_0.9fr]" : ""}`}>
          {settings.overviewShowTrafficTrend ? (
            <Card>
              <CardHeader>
                <div>
                  <CardDescription>Traffic Trend</CardDescription>
                  <CardTitle className="mt-3">Weekly cover trend</CardTitle>
                </div>
              </CardHeader>
              <ChartShell>
                <AreaChart data={weeklyData}>
                  <defs>
                    <linearGradient id="coversFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#b89a5a" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#b89a5a" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(139,120,83,0.14)" vertical={false} />
                  <XAxis dataKey="weekLabel" stroke="#8f8268" tickLine={false} axisLine={false} />
                  <YAxis stroke="#8f8268" tickLine={false} axisLine={false} />
                  <Area dataKey="covers" stroke="#d4b26a" fill="url(#coversFill)" strokeWidth={3} />
                </AreaChart>
              </ChartShell>
            </Card>
          ) : null}

          {settings.overviewShowChannelContribution ? (
            <Card>
              <CardHeader>
                <div>
                  <CardDescription>What&apos;s Pulling Weight</CardDescription>
                  <CardTitle className="mt-3">Revenue contribution by channel</CardTitle>
                </div>
              </CardHeader>
              <ChartShell>
                <BarChart data={channelContribution}>
                  <CartesianGrid stroke="rgba(139,120,83,0.14)" vertical={false} />
                  <XAxis dataKey="channel" stroke="#8f8268" tickLine={false} axisLine={false} />
                  <YAxis stroke="#8f8268" tickLine={false} axisLine={false} tickFormatter={(value) => `$${Math.round(value / 1000)}k`} />
                  <Bar dataKey="revenue" fill="#7f8a57" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ChartShell>
            </Card>
          ) : null}
        </div>
      ) : null}

      {settings.overviewShowQuickLinks || settings.overviewShowCampaignRecaps ? (
        <div className={`grid gap-6 ${settings.overviewShowQuickLinks && settings.overviewShowCampaignRecaps ? "xl:grid-cols-[0.85fr_1.15fr]" : ""}`}>
          {settings.overviewShowQuickLinks ? (
            <Card>
              <CardHeader>
                <div>
                  <CardDescription>Next Moves</CardDescription>
                  <CardTitle className="mt-3">Go straight to the work</CardTitle>
                </div>
              </CardHeader>
              <div className="grid gap-3">
                {quickLinks.map(({ href, title, detail }) => (
                  <Link className="rounded-2xl border border-border/70 bg-card/65 p-4 transition hover:border-primary/40 hover:bg-accent/25 sm:p-5" href={href} key={href}>
                    <p className="font-medium text-foreground">{title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
                  </Link>
                ))}
              </div>
            </Card>
          ) : null}

          {settings.overviewShowCampaignRecaps ? (
            <Card>
              <CardHeader>
                <div>
                  <CardDescription>Campaign Recaps</CardDescription>
                  <CardTitle className="mt-3">Campaign performance</CardTitle>
                </div>
              </CardHeader>
              <div className="grid gap-3 md:grid-cols-2">
                {campaignRecaps.length ? (
                  campaignRecaps.map((campaign) => (
                    <ListCard key={campaign.id}>
                      <p className="font-medium text-foreground">{campaign.name}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{number(campaign.covers)} attributed covers</p>
                      <p className="mt-1 text-sm text-muted-foreground">{number(campaign.tables, 1)} attributed tables</p>
                      <p className="mt-3 text-sm text-foreground">{currency(campaign.revenue)} attributed revenue</p>
                    </ListCard>
                  ))
                ) : (
                  <EmptyState title="No campaigns yet" description="Create a campaign to start organizing performance around a business objective." />
                )}
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

      <div className={`grid gap-6 ${settings.overviewShowRecentActivity && settings.overviewShowSchedule ? "xl:grid-cols-3" : ""}`}>
        {settings.overviewShowRecentActivity ? (
          <Card className={settings.overviewShowSchedule ? "xl:col-span-1" : ""}>
            <CardHeader>
              <div>
                <CardDescription>Recent Activity</CardDescription>
                <CardTitle className="mt-3">What changed since you last checked</CardTitle>
              </div>
            </CardHeader>
            <div className="space-y-4">
              {activity.length ? (
                activity.map((item) => (
                  <ListCard key={item.id}>
                    <p className="font-medium text-foreground">{item.subjectName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-primary">
                      {item.actorName} {item.actionLabel}
                    </p>
                  </ListCard>
                ))
              ) : (
                <EmptyState title="No activity yet" description="Recent client changes, strategy updates, and content actions will surface here." />
              )}
            </div>
          </Card>
        ) : null}

        {settings.overviewShowSchedule ? (
          <Card className={settings.overviewShowRecentActivity ? "xl:col-span-2" : ""}>
          <CardHeader>
            <div>
              <CardDescription>Live Schedule</CardDescription>
              <CardTitle className="mt-3">Upcoming content and the campaign driving the week</CardTitle>
            </div>
          </CardHeader>
          <div className="grid gap-4 md:grid-cols-2">
            {scheduledContent.length ? (
              scheduledContent.slice(0, 2).map((item) => (
                <ListCard key={item.id}>
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium text-foreground">{item.platform}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-primary">{item.status}</p>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{item.content}</p>
                  <p className="mt-3 text-sm text-foreground">{item.cta}</p>
                  <p className="mt-4 text-xs uppercase tracking-[0.16em] text-muted-foreground">{item.date}</p>
                </ListCard>
              ))
            ) : (
              <EmptyState title="No scheduled content" description="Scheduled posts and planner items will appear here as soon as the calendar is populated." />
            )}
            {leadCampaign ? (
              <ListCard className="md:col-span-1">
                <p className="text-sm uppercase tracking-[0.16em] text-primary">{leadCampaign.campaign.status}</p>
                <p className="mt-2 font-display text-2xl text-foreground">{leadCampaign.campaign.name}</p>
                <p className="mt-2 text-sm text-muted-foreground">{leadCampaign.campaign.notes}</p>
                <div className="mt-4 grid gap-2 text-sm">
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Posts</span><span>{leadCampaign.linkedPosts.length}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Blogs</span><span>{leadCampaign.linkedBlogs.length}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Assets</span><span>{leadCampaign.linkedAssets.length}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Attributed Revenue</span><span>{currency(leadCampaign.attributedRevenue)}</span></div>
                </div>
              </ListCard>
            ) : null}
          </div>
        </Card>
        ) : null}
      </div>
    </div>
  );
}
