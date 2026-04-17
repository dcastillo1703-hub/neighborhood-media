"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { ChartShell } from "@/components/charts/chart-shell";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListCard } from "@/components/dashboard/list-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateRevenueModel } from "@/lib/calculations";
import { useActiveClient } from "@/lib/client-context";
import {
  buildMonthlyPerformance,
  buildToastOpportunitySummary,
  getLatestWeekSummary
} from "@/lib/domain/performance";
import {
  summarizeCampaignRecaps,
  summarizeChannelContribution,
  summarizePeriodComparison,
  summarizeRoi
} from "@/lib/domain/reporting";
import { useAnalyticsSnapshots } from "@/lib/repositories/use-analytics-snapshots";
import { useCampaigns } from "@/lib/repositories/use-campaigns";
import { useClientSettings } from "@/lib/repositories/use-client-settings";
import { useWeeklyMetrics } from "@/lib/repositories/use-weekly-metrics";
import { useGoogleAnalytics } from "@/lib/use-google-analytics";
import { useManualMetaPerformance } from "@/lib/use-manual-meta-performance";
import { useMetaBusinessSuite } from "@/lib/use-meta-business-suite";
import { currency, number, percent } from "@/lib/utils";

type AssumptionDraft = {
  averageCheck: number;
  guestsPerTable: number;
  growthTarget: number;
};

export default function PerformancePage() {
  const { activeClient } = useActiveClient();
  const { settings, revenueModelDefaults } = useClientSettings(activeClient.id);
  const { metrics } = useWeeklyMetrics(activeClient.id);
  const { campaigns } = useCampaigns(activeClient.id);
  const { analyticsSnapshots, refreshAnalyticsSnapshots } = useAnalyticsSnapshots(activeClient.id);
  const {
    summary: googleAnalyticsSummary,
    sync: syncGoogleAnalytics
  } = useGoogleAnalytics(activeClient.id);
  const { summary: metaSummary, syncInsights } = useMetaBusinessSuite(activeClient.id);
  const { enabledChannels: manualMetaChannels } = useManualMetaPerformance(activeClient.id);
  const [syncingFacebook, setSyncingFacebook] = useState(false);
  const [facebookSyncMessage, setFacebookSyncMessage] = useState<string | null>(null);
  const [syncingGoogleAnalytics, setSyncingGoogleAnalytics] = useState(false);
  const [googleAnalyticsMessage, setGoogleAnalyticsMessage] = useState<string | null>(null);
  const defaultAssumptions = useMemo<AssumptionDraft>(
    () => ({
      averageCheck: settings.averageCheck,
      guestsPerTable: settings.guestsPerTable,
      growthTarget: revenueModelDefaults.growthTarget
    }),
    [revenueModelDefaults.growthTarget, settings.averageCheck, settings.guestsPerTable]
  );
  const [assumptions, setAssumptions] = useState<AssumptionDraft>(defaultAssumptions);

  useEffect(() => {
    setAssumptions(defaultAssumptions);
  }, [defaultAssumptions]);

  const revenueModel = useMemo(
    () =>
      calculateRevenueModel({
        ...revenueModelDefaults,
        averageCheck: assumptions.averageCheck,
        guestsPerTable: assumptions.guestsPerTable,
        growthTarget: assumptions.growthTarget
      }),
    [assumptions, revenueModelDefaults]
  );
  const latestWeek = useMemo(
    () => getLatestWeekSummary(metrics, assumptions.averageCheck),
    [assumptions.averageCheck, metrics]
  );
  const toastOpportunities = useMemo(
    () => buildToastOpportunitySummary(metrics, assumptions.averageCheck),
    [assumptions.averageCheck, metrics]
  );
  const monthlyPerformance = useMemo(
    () =>
      buildMonthlyPerformance(
        metrics,
        assumptions.averageCheck,
        assumptions.guestsPerTable,
        6,
        false
      ),
    [assumptions.averageCheck, assumptions.guestsPerTable, metrics]
  );
  const roiSummary = useMemo(
    () => summarizeRoi(analyticsSnapshots),
    [analyticsSnapshots]
  );
  const channelContribution = useMemo(
    () => summarizeChannelContribution(analyticsSnapshots),
    [analyticsSnapshots]
  );
  const campaignRecaps = useMemo(
    () => summarizeCampaignRecaps(campaigns, analyticsSnapshots),
    [analyticsSnapshots, campaigns]
  );
  const periodComparison = useMemo(
    () => summarizePeriodComparison(metrics, assumptions.averageCheck),
    [assumptions.averageCheck, metrics]
  );
  const currentMonth = monthlyPerformance[monthlyPerformance.length - 1] ?? null;
  const previousMonth = monthlyPerformance[monthlyPerformance.length - 2] ?? null;
  const monthRevenueDelta =
    currentMonth && previousMonth ? currentMonth.revenue - previousMonth.revenue : 0;
  const monthRevenueDeltaPercent =
    previousMonth?.revenue
      ? (monthRevenueDelta / previousMonth.revenue) * 100
      : 0;
  const attributedRevenueShare =
    currentMonth?.revenue ? (roiSummary.revenue / currentMonth.revenue) * 100 : 0;
  const topCampaigns = [...campaignRecaps]
    .filter((campaign) => campaign.revenue > 0 || campaign.covers > 0)
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, 4);
  const topCampaign = topCampaigns[0] ?? null;
  const topChannels = [...channelContribution]
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, 4);
  const trendData = monthlyPerformance.map((entry) => ({
    month: entry.monthLabel,
    revenue: Math.round(entry.revenue),
    covers: entry.covers
  }));
  const comparisonCards = [
    {
      label: "Recent period revenue",
      value: currency(periodComparison.currentRevenue),
      detail: "Recent half of the available weekly history."
    },
    {
      label: "Prior period revenue",
      value: currency(periodComparison.previousRevenue),
      detail: "Baseline read from the earlier half of the same history."
    },
    {
      label: "Revenue delta",
      value: `${periodComparison.revenueDelta >= 0 ? "+" : ""}${currency(periodComparison.revenueDelta)}`,
      detail: "Current interpretation using the average check assumption above."
    },
    {
      label: "Cover delta",
      value: `${periodComparison.coversDelta >= 0 ? "+" : ""}${number(periodComparison.coversDelta)}`,
      detail: "Cover movement between the same two periods."
    }
  ];
  const connectedMetaProviders = useMemo(
    () =>
      new Set(
        (metaSummary?.channels ?? [])
          .filter((channel) => channel.authStatus === "connected")
          .map((channel) => channel.provider)
      ),
    [metaSummary?.channels]
  );
  const fallbackManualChannels = useMemo(
    () => manualMetaChannels.filter((channel) => !connectedMetaProviders.has(channel.provider)),
    [connectedMetaProviders, manualMetaChannels]
  );
  const connectedFacebook = metaSummary?.channels.find(
    (channel) => channel.provider === "facebook" && channel.authStatus === "connected"
  );
  const manualFacebook = fallbackManualChannels.find((channel) => channel.provider === "facebook");
  const facebookRead = connectedFacebook
    ? {
        label: connectedFacebook.accountLabel,
        impressions: connectedFacebook.impressions,
        clicks: connectedFacebook.clicks,
        engagement: connectedFacebook.conversions,
        periodLabel: connectedFacebook.latestPeriodLabel,
        syncedAt: connectedFacebook.lastSyncAt,
        source: "live" as const
      }
    : manualFacebook
      ? {
          label: manualFacebook.accountLabel,
          impressions: manualFacebook.impressions,
          clicks: manualFacebook.clicks,
          engagement: manualFacebook.engagement,
          periodLabel: manualFacebook.periodLabel,
          syncedAt: undefined,
          source: "manual" as const
        }
      : null;
  const topSource = googleAnalyticsSummary?.topSources[0] ?? null;
  const topLandingPage = googleAnalyticsSummary?.topPages[0] ?? null;
  const topIntentSignal = googleAnalyticsSummary?.keyEvents[0] ?? null;
  const unattributedSessions = googleAnalyticsSummary?.sourceQuality.notSetSessions ?? 0;
  const attributionConfidenceLabel = !googleAnalyticsSummary
    ? "Partial"
    : unattributedSessions > (googleAnalyticsSummary.sessions || 0) * 0.35
      ? "Needs tagging cleanup"
      : connectedFacebook
        ? "Reportable"
        : "Directional";
  const summaryHeadline =
    currentMonth && previousMonth
      ? `${currentMonth.monthLabel} ${monthRevenueDelta >= 0 ? "outpaced" : "trailed"} ${previousMonth.monthLabel} by ${currency(Math.abs(monthRevenueDelta))}`
      : "Performance story is ready to review";
  const summaryNarrative =
    roiSummary.revenue > 0
      ? `${activeClient.name} currently shows ${currency(roiSummary.revenue)} in attributed revenue across ${number(roiSummary.covers)} covers. ${topCampaign ? `${topCampaign.name} is the clearest campaign proof point right now.` : "The contribution story is directional, but usable."}`
      : `Toast is giving the operating picture, but campaign contribution still needs more attributed snapshots. This page now shows the business read, the assumptions behind it, and the evidence we have so far.`;
  const websiteEvidenceNote = googleAnalyticsSummary
    ? topSource
      ? `${topSource.label} is currently the strongest traffic source with ${number(topSource.sessions)} sessions.`
      : "GA4 is connected, but the current sync is still too thin to call a strongest source."
    : "GA4 is not connected yet, so website evidence is still incomplete.";
  const metaConfigurationNote = connectedFacebook
    ? metaSummary?.configStatus.ready
      ? "Facebook is connected and the broader Meta setup is ready."
      : `Facebook is connected and reporting live. ${metaSummary?.configStatus.missingLabels.length ? `Still missing: ${metaSummary.configStatus.missingLabels.join(", ")}.` : "Broader Meta app configuration is still incomplete."}`
    : manualFacebook
      ? "Facebook is still using manual fallback reporting."
      : "Connect Facebook to pull live page-level Meta reporting.";
  const decisionTitle = topCampaign
    ? `Use ${topCampaign.name} as the proof point, then push ${toastOpportunities.weakestDay.day.toLowerCase()} next`
    : `Push ${toastOpportunities.weakestDay.day.toLowerCase()} next and build cleaner proof`;
  const decisionItems = [
    {
      label: "Where to push",
      value: toastOpportunities.weakestDay.day,
      detail: `Baseline is about ${number(toastOpportunities.weakestDay.averageCovers, 1)} covers and ${currency(toastOpportunities.weakestDay.averageRevenue)} in revenue.`
    },
    {
      label: "What to repeat",
      value: topCampaign?.name ?? "Build the first proof point",
      detail: topCampaign
        ? `${topCampaign.name} is tied to ${currency(topCampaign.revenue)} and ${number(topCampaign.covers)} covers so far.`
        : "No campaign has enough attributed proof yet, so keep tracking traffic and ROI snapshots tightly."
    },
    {
      label: "What to tighten",
      value: attributionConfidenceLabel,
      detail: googleAnalyticsSummary
        ? `Unattributed traffic is ${number(unattributedSessions)} sessions. Cleaner UTMs will make the next reporting cycle more credible.`
        : "Connect and sync GA4 so website traffic can support the business story."
    }
  ];
  const syncFacebookInsights = async () => {
    setSyncingFacebook(true);
    setFacebookSyncMessage(null);

    try {
      const payload = await syncInsights("facebook");
      await refreshAnalyticsSnapshots();
      setFacebookSyncMessage(
        payload.sync.topPost
          ? `Facebook synced from ${payload.sync.pageName}. Impressions: ${number(payload.sync.snapshot.impressions)}, clicks: ${number(payload.sync.snapshot.clicks)}, engagement: ${number(payload.sync.snapshot.conversions)}. Top content: ${payload.sync.topPost}`
          : `Facebook synced from ${payload.sync.pageName}. Impressions: ${number(payload.sync.snapshot.impressions)}, clicks: ${number(payload.sync.snapshot.clicks)}, engagement: ${number(payload.sync.snapshot.conversions)}. Accessible posts: ${number(payload.sync.postCount)}.`
      );
    } catch (error) {
      setFacebookSyncMessage(
        error instanceof Error ? error.message : "Facebook sync failed."
      );
    } finally {
      setSyncingFacebook(false);
    }
  };

  const syncWebsiteAnalytics = async () => {
    setSyncingGoogleAnalytics(true);
    setGoogleAnalyticsMessage(null);

    try {
      const payload = await syncGoogleAnalytics();
      setGoogleAnalyticsMessage(
        `Google Analytics synced. Sessions: ${number(payload.summary.sessions)}, users: ${number(
          payload.summary.users
        )}, views: ${number(payload.summary.views)}.`
      );
    } catch (error) {
      setGoogleAnalyticsMessage(
        error instanceof Error ? error.message : "Google Analytics sync failed."
      );
    } finally {
      setSyncingGoogleAnalytics(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Performance"
        title="Understand what changed, what likely caused it, and what to do next"
        description="This page turns Toast, campaign activity, Google Analytics, and Meta into one performance story you can use internally or in a client conversation."
      />

      <Card className="p-5 sm:p-6">
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-start">
          <div>
            <CardDescription>Summary</CardDescription>
            <CardTitle className="mt-3 text-2xl">{summaryHeadline}</CardTitle>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              {summaryNarrative}
            </p>
            <div className="mt-4 rounded-[1.25rem] border border-border/70 bg-card/55 p-4">
              <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                Client-ready read
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {currentMonth && previousMonth
                  ? `${currentMonth.monthLabel} is ${monthRevenueDelta >= 0 ? "up" : "down"} ${currency(Math.abs(monthRevenueDelta))} compared with ${previousMonth.monthLabel}. Our currently attributed work accounts for about ${percent(attributedRevenueShare)} of the current monthly revenue read, and the clearest next push is ${toastOpportunities.weakestDay.day.toLowerCase()}.`
                  : "The historical business data is present, but the page still needs a fuller month-over-month timeline before the lead summary becomes stronger."}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.25rem] border border-border/70 bg-card/60 p-4">
              <p className="text-xs text-muted-foreground">Month-over-month revenue</p>
              <p className="mt-2 text-2xl font-medium text-foreground">
                {monthRevenueDelta >= 0 ? "+" : ""}
                {currency(monthRevenueDelta)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {monthRevenueDeltaPercent >= 0 ? "+" : ""}
                {percent(monthRevenueDeltaPercent)} vs the prior Toast month.
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-border/70 bg-card/60 p-4">
              <p className="text-xs text-muted-foreground">Attributed contribution</p>
              <p className="mt-2 text-2xl font-medium text-foreground">
                {currency(roiSummary.revenue)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {number(roiSummary.covers)} covers tied back to current reporting.
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-border/70 bg-card/60 p-4">
              <p className="text-xs text-muted-foreground">Latest weekly movement</p>
              <p className="mt-2 text-2xl font-medium text-foreground">
                {latestWeek.latestWowChange >= 0 ? "+" : ""}
                {number(latestWeek.latestWowChange)} covers
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {currency(latestWeek.latestRevenue)} in the latest week.
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-border/70 bg-card/60 p-4">
              <p className="text-xs text-muted-foreground">Biggest opportunity</p>
              <p className="mt-2 text-2xl font-medium text-foreground">
                {toastOpportunities.weakestDay.day}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Soft recurring night at {currency(toastOpportunities.weakestDay.averageRevenue)}.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card id="contribution">
          <CardHeader>
            <div>
              <CardDescription>Contribution</CardDescription>
              <CardTitle className="mt-3">What our efforts likely contributed</CardTitle>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                This is the directional read of what campaign activity and tracked channels likely added to the business.
              </p>
            </div>
          </CardHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <ListCard>
                <p className="text-sm text-muted-foreground">Attributed revenue</p>
                <p className="mt-2 text-2xl text-foreground">{currency(roiSummary.revenue)}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  About {percent(attributedRevenueShare)} of the current monthly run-rate read.
                </p>
              </ListCard>
              <ListCard>
                <p className="text-sm text-muted-foreground">Attributed covers</p>
                <p className="mt-2 text-2xl text-foreground">{number(roiSummary.covers)}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {number(roiSummary.tables, 1)} tables attached to tracked activity.
                </p>
              </ListCard>
              <ListCard>
                <p className="text-sm text-muted-foreground">Strongest proof point</p>
                <p className="mt-2 text-2xl text-foreground">{topCampaign?.name ?? "No proof yet"}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {topCampaign
                    ? `${currency(topCampaign.revenue)} across ${number(topCampaign.covers)} covers.`
                    : "Start tying more campaign activity to revenue snapshots."}
                </p>
              </ListCard>
            </div>
            <ListCard>
              <p className="font-medium text-foreground">Channel mix</p>
              <p className="mt-2 text-sm text-muted-foreground">
                The channel list below is the cleanest current view of where attributed revenue is coming from.
              </p>
              <div className="mt-4 space-y-3">
                {topChannels.length ? (
                  topChannels.map((item) => (
                    <div
                      className="flex items-center justify-between gap-4 border-b border-border/60 pb-3 last:border-b-0 last:pb-0"
                      key={item.channel}
                    >
                      <div>
                        <p className="font-medium text-foreground">{item.channel}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {number(item.covers)} covers · {number(item.tables, 1)} tables
                        </p>
                      </div>
                      <p className="text-sm font-medium text-foreground">{currency(item.revenue)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No attributed channels yet. Keep linking campaigns and snapshots so this becomes clearer.
                  </p>
                )}
              </div>
            </ListCard>
          </div>
        </Card>

        <Card id="assumptions">
          <CardHeader>
            <div>
              <CardDescription>Assumptions</CardDescription>
              <CardTitle className="mt-3">Adjust the numbers driving this read</CardTitle>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                These inputs update the interpretation on this page only, so you can pressure-test the story without changing account defaults.
              </p>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="average-check">Average check</Label>
                <Input
                  id="average-check"
                  min="0"
                  step="0.01"
                  type="number"
                  value={assumptions.averageCheck}
                  onChange={(event) =>
                    setAssumptions((current) => ({
                      ...current,
                      averageCheck: Number.parseFloat(event.target.value) || 0
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guests-per-table">Guests per table</Label>
                <Input
                  id="guests-per-table"
                  min="0"
                  step="0.1"
                  type="number"
                  value={assumptions.guestsPerTable}
                  onChange={(event) =>
                    setAssumptions((current) => ({
                      ...current,
                      guestsPerTable: Number.parseFloat(event.target.value) || 0
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="growth-target">Growth target</Label>
                <Input
                  id="growth-target"
                  min="0"
                  step="1"
                  type="number"
                  value={assumptions.growthTarget}
                  onChange={(event) =>
                    setAssumptions((current) => ({
                      ...current,
                      growthTarget: Number.parseFloat(event.target.value) || 0
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="sm" variant="outline" onClick={() => setAssumptions(defaultAssumptions)}>
                Use saved defaults
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ListCard>
                <p className="text-sm text-muted-foreground">Weekly baseline revenue</p>
                <p className="mt-2 text-2xl text-foreground">{currency(revenueModel.weeklyRevenue)}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Based on {number(revenueModel.weeklyCovers)} weekly covers and the current average check.
                </p>
              </ListCard>
              <ListCard>
                <p className="text-sm text-muted-foreground">Target upside</p>
                <p className="mt-2 text-2xl text-foreground">{currency(revenueModel.addedMonthlyRevenue)}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Added monthly revenue implied by a {percent(assumptions.growthTarget)} growth target.
                </p>
              </ListCard>
            </div>
            <div className="rounded-[1.1rem] border border-border/70 bg-card/55 p-4">
              <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                Credibility note
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Toast remains the source of truth for covers, tables, and revenue. Attribution is directional and depends on campaign snapshots, tracked traffic, and channel data quality.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card id="comparison">
          <CardHeader>
            <div>
              <CardDescription>Comparison</CardDescription>
              <CardTitle className="mt-3">How current performance compares to baseline</CardTitle>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                This is the cleanest current comparison between recent business performance, prior period baseline, and the local assumptions above.
              </p>
            </div>
          </CardHeader>
          <ChartShell>
            <LineChart data={trendData}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="month" stroke="#b9b2a0" tickLine={false} axisLine={false} />
              <YAxis
                stroke="#b9b2a0"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${Math.round(value / 1000)}k`}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    formatter={(value, name) =>
                      name === "revenue" ? currency(value) : number(value)
                    }
                  />
                }
              />
              <Line
                dataKey="revenue"
                name="revenue"
                stroke="#b89a5a"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ChartShell>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {comparisonCards.map((card) => (
              <ListCard key={card.label}>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="mt-2 text-2xl text-foreground">{card.value}</p>
                <p className="mt-2 text-sm text-muted-foreground">{card.detail}</p>
              </ListCard>
            ))}
          </div>
        </Card>

        <Card id="decision">
          <CardHeader>
            <div>
              <CardDescription>Decision</CardDescription>
              <CardTitle className="mt-3">What we should do next</CardTitle>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                This takes the business read, campaign proof, and measurement quality and turns it into the next move.
              </p>
            </div>
          </CardHeader>
          <div className="space-y-3">
            <div className="rounded-[1.25rem] border border-border/70 bg-card/55 p-4">
              <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                Decision read
              </p>
              <p className="mt-2 text-lg font-medium text-foreground">{decisionTitle}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {toastOpportunities.recommendation}
              </p>
            </div>
            {decisionItems.map((item) => (
              <ListCard key={item.label}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">{item.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                  </div>
                  <p className="text-sm font-medium text-foreground">{item.value}</p>
                </div>
              </ListCard>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card id="evidence">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardDescription>Evidence</CardDescription>
                <CardTitle className="mt-3">Traffic and platform signals behind the story</CardTitle>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  These signals do not replace Toast, but they make the contribution story more credible in internal review and client conversations.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!googleAnalyticsSummary?.readyToSync || syncingGoogleAnalytics}
                  onClick={() => void syncWebsiteAnalytics()}
                  size="sm"
                  variant="outline"
                >
                  {syncingGoogleAnalytics ? "Syncing website..." : "Sync Google Analytics"}
                </Button>
                <Button
                  disabled={
                    syncingFacebook ||
                    !metaSummary?.channels.find(
                      (channel) =>
                        channel.provider === "facebook" && channel.authStatus === "connected"
                    )
                  }
                  onClick={() => void syncFacebookInsights()}
                  size="sm"
                  variant="outline"
                >
                  {syncingFacebook ? "Syncing Facebook..." : "Sync Facebook"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <div className="space-y-3">
            {googleAnalyticsMessage ? (
              <div className="rounded-[1rem] border border-border/70 bg-card/55 p-4 text-sm text-muted-foreground">
                {googleAnalyticsMessage}
              </div>
            ) : null}
            {facebookSyncMessage ? (
              <div className="rounded-[1rem] border border-border/70 bg-card/55 p-4 text-sm text-muted-foreground">
                {facebookSyncMessage}
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <ListCard>
                <p className="font-medium text-foreground">Website evidence</p>
                <p className="mt-2 text-sm text-muted-foreground">{websiteEvidenceNote}</p>
                {googleAnalyticsSummary ? (
                  <div className="mt-4 space-y-2 text-sm">
                    <p className="text-muted-foreground">
                      Sessions: <span className="text-foreground">{number(googleAnalyticsSummary.sessions)}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Top landing page: <span className="text-foreground">{topLandingPage?.path ?? "None yet"}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Strongest intent signal: <span className="text-foreground">{topIntentSignal ? `${topIntentSignal.label} (${number(topIntentSignal.count)})` : "No tracked intent event yet"}</span>
                    </p>
                  </div>
                ) : null}
              </ListCard>
              <ListCard>
                <p className="font-medium text-foreground">Meta evidence</p>
                <p className="mt-2 text-sm text-muted-foreground">{metaConfigurationNote}</p>
                {facebookRead ? (
                  <div className="mt-4 space-y-2 text-sm">
                    <p className="text-muted-foreground">
                      Source: <span className="text-foreground">{facebookRead.source === "live" ? "Live Facebook" : "Manual fallback"}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Impressions: <span className="text-foreground">{number(facebookRead.impressions)}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Clicks: <span className="text-foreground">{number(facebookRead.clicks)}</span>
                    </p>
                  </div>
                ) : null}
              </ListCard>
            </div>
          </div>
        </Card>

        <Card id="campaign-proof">
          <CardHeader>
            <div>
              <CardDescription>Campaign proof</CardDescription>
              <CardTitle className="mt-3">Which initiatives are easiest to explain</CardTitle>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                These are the strongest campaign-level proof points to use in a restaurant conversation right now.
              </p>
            </div>
          </CardHeader>
          <div className="space-y-3">
            {topCampaigns.length ? (
              topCampaigns.map((campaign) => (
                <ListCard key={campaign.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Link className="font-medium text-foreground hover:text-primary" href={`/campaigns/${campaign.id}`}>
                        {campaign.name}
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {currency(campaign.revenue)} · {number(campaign.covers)} covers · {number(campaign.tables, 1)} tables
                      </p>
                    </div>
                    <p className="text-xs uppercase tracking-[0.16em] text-primary">
                      {campaign.revenue > 0 ? "Usable proof" : "Early"}
                    </p>
                  </div>
                </ListCard>
              ))
            ) : (
              <EmptyState
                title="No campaign proof yet"
                description="Keep adding ROI snapshots and tied performance data so the initiative-level proof becomes easier to present."
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
