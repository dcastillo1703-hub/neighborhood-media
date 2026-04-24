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
import { usePosts } from "@/lib/repositories/use-posts";
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
  const { posts } = usePosts(activeClient.id);
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
  const postsById = useMemo(
    () => new Map(posts.map((post) => [post.id, post])),
    [posts]
  );
  const topContentProof = useMemo(() => {
    const grouped = new Map<
      string,
      {
        revenue: number;
        covers: number;
        tables: number;
        conversions: number;
      }
    >();

    analyticsSnapshots.forEach((snapshot) => {
      if (!snapshot.linkedPostId) {
        return;
      }

      const current = grouped.get(snapshot.linkedPostId) ?? {
        revenue: 0,
        covers: 0,
        tables: 0,
        conversions: 0
      };
      current.revenue += snapshot.attributedRevenue;
      current.covers += snapshot.attributedCovers;
      current.tables += snapshot.attributedTables;
      current.conversions += snapshot.conversions;
      grouped.set(snapshot.linkedPostId, current);
    });

    return Array.from(grouped.entries())
      .map(([postId, totals]) => {
        const post = postsById.get(postId);
        const campaign = post?.campaignId
          ? campaigns.find((entry) => entry.id === post.campaignId)
          : undefined;

        return {
          postId,
          post,
          campaign,
          ...totals
        };
      })
      .filter((item) => item.post)
      .sort((left, right) => right.revenue - left.revenue)
      .slice(0, 3);
  }, [analyticsSnapshots, campaigns, postsById]);
  const topContentItem = topContentProof[0] ?? null;
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
  const reservationClicks =
    googleAnalyticsSummary?.keyEvents.find((event) => event.label === "Reservation clicks")?.count ?? 0;
  const orderClicks =
    googleAnalyticsSummary?.keyEvents.find((event) => event.label === "Order clicks")?.count ?? 0;
  const callClicks =
    googleAnalyticsSummary?.keyEvents.find((event) => event.label === "Call clicks")?.count ?? 0;
  const menuViews =
    googleAnalyticsSummary?.keyEvents.find((event) => event.label === "Menu views")?.count ?? 0;
  const intentActions = reservationClicks + orderClicks + callClicks;
  const unattributedSessions = googleAnalyticsSummary?.sourceQuality.notSetSessions ?? 0;
  const supportedSnapshotCount = analyticsSnapshots.filter(
    (snapshot) => snapshot.linkedCampaignId || snapshot.linkedPostId
  ).length;
  const attributionConfidence = !googleAnalyticsSummary || !supportedSnapshotCount
    ? {
        label: "Low",
        detail: "Toast is solid, but the attribution layer is still thin.",
        tone: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300"
      }
    : unattributedSessions > (googleAnalyticsSummary.sessions || 0) * 0.35
      ? {
          label: "Medium",
          detail: "There is enough evidence to report directionally, but UTMs still need cleanup.",
          tone: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        }
      : {
          label: "High",
          detail: "Tracked traffic, linked work, and POS movement are aligned well enough to defend the read.",
          tone: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        };
  const confidenceSupport = [
    `${number(supportedSnapshotCount)} linked snapshot${supportedSnapshotCount === 1 ? "" : "s"} tie work to outcomes.`,
    googleAnalyticsSummary
      ? `${number(unattributedSessions)} unattributed session${unattributedSessions === 1 ? "" : "s"} still dilute precision.`
      : "GA4 is not connected yet, so website support is still incomplete.",
    connectedFacebook
      ? "Facebook is supplying live platform evidence."
      : manualFacebook
        ? "Facebook is still running on manual fallback evidence."
        : "No Facebook evidence is supporting the read yet."
  ];
  const attributedSessionsEstimate = supportedSnapshotCount
    ? Math.round((googleAnalyticsSummary?.sessions ?? 0) * Math.max(0.12, Math.min(0.6, supportedSnapshotCount / Math.max(1, analyticsSnapshots.length))))
    : 0;
  const estimatedVisitRate = googleAnalyticsSummary?.sessions
    ? intentActions / googleAnalyticsSummary.sessions
    : 0;
  const proofPointTitle = topContentItem?.post
    ? `${topContentItem.post.platform} ${topContentItem.post.format?.toLowerCase() ?? "post"} tied to ${topContentItem.campaign?.name ?? "a campaign"}`
    : topCampaign?.name ?? "Build the first proof point";
  const summaryHeadline =
    currentMonth && previousMonth
      ? `${currentMonth.monthLabel} ${monthRevenueDelta >= 0 ? "outpaced" : "trailed"} ${previousMonth.monthLabel} by ${currency(Math.abs(monthRevenueDelta))}`
      : "Performance story is ready to review";
  const summaryNarrative =
    roiSummary.revenue > 0
      ? `${activeClient.name} currently shows ${currency(roiSummary.revenue)} in attributed revenue across ${number(roiSummary.covers)} covers. ${topCampaign ? `${topCampaign.name} is the clearest campaign proof point right now.` : "The contribution story is directional, but usable."}`
      : `Toast is giving the operating picture, but campaign contribution still needs more attributed snapshots. This page now shows the business read, the assumptions behind it, and the evidence we have so far.`;
  const websiteEvidenceNote = googleAnalyticsSummary
    ? !googleAnalyticsSummary.configStatus.ready
      ? googleAnalyticsSummary.configStatus.issues[0]?.detail ??
        googleAnalyticsSummary.configStatus.nextAction
      : topSource
        ? `${topSource.label} is currently the strongest traffic source with ${number(topSource.sessions)} sessions.`
        : "GA4 is connected, but the current sync is still too thin to call a strongest source."
    : "GA4 is not connected yet, so website evidence is still incomplete.";
  const metaConfigurationNote = connectedFacebook
    ? metaSummary?.configStatus.ready
      ? "Facebook is connected and the broader Meta setup is ready."
      : `Facebook is connected and reporting live. ${metaSummary?.configStatus.issues[0]?.detail ?? metaSummary?.configStatus.nextAction ?? "Broader Meta app configuration still needs attention."}`
    : manualFacebook
      ? "Facebook is still using manual fallback reporting."
      : "Connect Facebook to pull live page-level Meta reporting.";
  const decisionTitle = topCampaign
    ? `Use ${topCampaign.name} as the proof point, then push ${toastOpportunities.weakestDay.day.toLowerCase()} next`
    : `Push ${toastOpportunities.weakestDay.day.toLowerCase()} next and build cleaner proof`;
  const clientHeadline = currentMonth && previousMonth
    ? `${activeClient.name} ${monthRevenueDelta >= 0 ? "grew" : "dipped"} by ${currency(Math.abs(monthRevenueDelta))} compared with ${previousMonth.monthLabel}`
    : `${activeClient.name} performance is ready to review`;
  const clientHeadlineDetail = currentMonth && previousMonth
    ? `${currentMonth.monthLabel} landed at ${currency(currentMonth.revenue)} in confirmed POS revenue.`
    : "Confirmed POS performance is loaded, but the longer comparison window is still limited.";
  const clientMovementTitle = topIntentSignal
    ? `${topIntentSignal.label} became the clearest guest-action signal`
    : topSource
      ? `${topSource.label} was the clearest traffic move`
      : "Guest response is starting to take shape";
  const clientMovementDetail = googleAnalyticsSummary
    ? topIntentSignal
      ? `${number(topIntentSignal.count)} tracked guest actions were recorded in the current reporting window, alongside ${number(googleAnalyticsSummary.sessions)} website sessions.`
      : `${number(googleAnalyticsSummary.sessions)} website sessions were recorded, with ${topSource ? `${topSource.label} leading the traffic mix.` : "traffic beginning to form a usable pattern."}`
    : "Website tracking is still incomplete, so this read leans more heavily on campaign snapshots and POS movement.";
  const clientDriverTitle = topCampaign
    ? `${topCampaign.name} is the clearest driver right now`
    : "The work is active, but proof is still early";
  const clientDriverDetail = topContentItem?.post
    ? `${topContentItem.post.platform} content tied to ${topContentItem.campaign?.name ?? "the active campaign"} is the strongest supporting proof point so far.`
    : topCampaign
      ? `${topCampaign.name} currently has the strongest link between campaign work and business movement.`
      : "We still need more linked campaign and content evidence before the story becomes stronger.";
  const clientWorthTitle = `${currency(roiSummary.revenue)} in estimated contribution`;
  const clientWorthDetail = roiSummary.revenue > 0
    ? `This is an estimate, not confirmed POS revenue. Confidence is ${attributionConfidence.label.toLowerCase()} because ${attributionConfidence.detail.toLowerCase()}`
    : `Confirmed revenue comes from Toast. Estimated contribution will become more useful once more work is linked cleanly to traffic and outcomes.`;
  const clientNextActions = [
    {
      title: `Push ${toastOpportunities.weakestDay.day}`,
      detail: `That is still the softest recurring revenue window at about ${currency(toastOpportunities.weakestDay.averageRevenue)}.`
    },
    {
      title: topCampaign ? `Repeat what worked in ${topCampaign.name}` : "Keep building a stronger proof point",
      detail: topCampaign
        ? `${topCampaign.name} is the easiest campaign to defend in the next client conversation.`
        : "We need one more cleanly linked campaign proof point to make the revenue story stronger."
    },
    {
      title: googleAnalyticsSummary ? "Tighten tracking quality" : "Finish website tracking",
      detail: googleAnalyticsSummary
        ? `Reducing unattributed traffic will make the next report more credible.`
        : "Connecting GA4 fully will make the contribution story easier to trust."
    }
  ];
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
      value: attributionConfidence.label,
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

      <Card className="overflow-hidden border-border/70 bg-card/95">
        <div className="border-b border-border/70 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">Client summary</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                The simplest version of what changed and why it matters
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                This is the presentation layer for a live client conversation: clear outcome, clearest driver, estimated value, and next move.
              </p>
            </div>
            <span className={["inline-flex w-fit rounded-full border px-3 py-1.5 text-sm font-medium", attributionConfidence.tone].join(" ")}>
              Confidence: {attributionConfidence.label}
            </span>
          </div>
        </div>

        <div className="grid gap-4 px-5 py-5 sm:px-6 xl:grid-cols-2">
          <div className="rounded-[1.2rem] border border-border/70 bg-background/60 p-4">
            <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">1. Headline result</p>
            <p className="mt-2 text-xl font-semibold text-foreground">{clientHeadline}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{clientHeadlineDetail}</p>
          </div>

          <div className="rounded-[1.2rem] border border-border/70 bg-background/60 p-4">
            <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">2. What moved</p>
            <p className="mt-2 text-xl font-semibold text-foreground">{clientMovementTitle}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{clientMovementDetail}</p>
          </div>

          <div className="rounded-[1.2rem] border border-border/70 bg-background/60 p-4">
            <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">3. What drove it</p>
            <p className="mt-2 text-xl font-semibold text-foreground">{clientDriverTitle}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{clientDriverDetail}</p>
            {topCampaign ? (
              <Link className="mt-3 inline-flex text-sm font-medium text-primary hover:underline" href={`/campaigns/${topCampaign.id}`}>
                View the campaign proof
              </Link>
            ) : null}
          </div>

          <div className="rounded-[1.2rem] border border-border/70 bg-background/60 p-4">
            <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">4. What it’s worth</p>
            <p className="mt-2 text-xl font-semibold text-foreground">{clientWorthTitle}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{clientWorthDetail}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1rem] border border-border/70 bg-card/60 px-3 py-3">
                <p className="text-xs text-muted-foreground">Confirmed POS revenue</p>
                <p className="mt-2 text-lg font-medium text-foreground">{currency(currentMonth?.revenue ?? 0)}</p>
              </div>
              <div className="rounded-[1rem] border border-border/70 bg-card/60 px-3 py-3">
                <p className="text-xs text-muted-foreground">Estimated contribution</p>
                <p className="mt-2 text-lg font-medium text-foreground">{currency(roiSummary.revenue)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border/70 px-5 py-5 sm:px-6">
          <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">5. What we’re doing next</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {clientNextActions.map((item) => (
              <div className="rounded-[1.1rem] border border-border/70 bg-background/60 p-4" key={item.title}>
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Why this estimate is believable: Toast confirms the business result, and the contribution estimate is based on linked campaign activity, tracked content proof, and current traffic signals.
          </p>
        </div>
      </Card>

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
                <p className="text-sm text-muted-foreground">Estimated contribution</p>
                <p className="mt-2 text-2xl text-foreground">{currency(roiSummary.revenue)}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Directional revenue estimate backed by tracked work and platform signals.
                </p>
              </ListCard>
              <ListCard>
                <p className="text-sm text-muted-foreground">Confirmed POS revenue</p>
                <p className="mt-2 text-2xl text-foreground">{currency(currentMonth?.revenue ?? 0)}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Toast remains the source of truth for the business result.
                </p>
              </ListCard>
              <ListCard>
                <p className="text-sm text-muted-foreground">Attribution confidence</p>
                <p className="mt-2 text-2xl text-foreground">{attributionConfidence.label}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {attributionConfidence.detail}
                </p>
              </ListCard>
            </div>
            <div className="grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
              <ListCard>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-foreground">Trust layer</p>
                  <span className={["rounded-full border px-2.5 py-1 text-xs font-medium", attributionConfidence.tone].join(" ")}>
                    {attributionConfidence.label}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Keep the business result and the attribution read separate: Toast confirms the revenue, while linked campaigns, posts, and platform data explain likely contribution.
                </p>
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {confidenceSupport.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </ListCard>
              <ListCard>
                <p className="font-medium text-foreground">Revenue translation</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  This is the visible chain from attention to estimated value. It is intentionally simple so the story stays believable.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">Sessions</p>
                    <p className="mt-2 text-xl text-foreground">{number(attributedSessionsEstimate || googleAnalyticsSummary?.sessions || 0)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Tracked website attention tied to this reporting window.</p>
                  </div>
                  <div>
                    <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">Intent</p>
                    <p className="mt-2 text-xl text-foreground">{number(intentActions || menuViews)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {intentActions ? "Reservation, order, and call actions." : "Menu views or other tracked actions."}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">Covers</p>
                    <p className="mt-2 text-xl text-foreground">{number(roiSummary.covers)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Attributed covers tied back to campaign evidence.</p>
                  </div>
                  <div>
                    <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">Revenue</p>
                    <p className="mt-2 text-xl text-foreground">{currency(roiSummary.revenue)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Using the current {currency(assumptions.averageCheck)} average-check assumption.
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Current intent-to-session rate: {googleAnalyticsSummary?.sessions ? percent(estimatedVisitRate) : "Not enough GA4 data yet"}.
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
            <div className="grid gap-3 lg:grid-cols-2">
              <ListCard>
                <p className="font-medium text-foreground">Strongest campaign proof</p>
                <p className="mt-2 text-lg text-foreground">{topCampaign?.name ?? "No campaign proof yet"}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {topCampaign
                    ? `${topCampaign.name} currently carries ${currency(topCampaign.revenue)} in estimated contribution across ${number(topCampaign.covers)} covers.`
                    : "Add more linked snapshots so campaign-level proof becomes easier to defend."}
                </p>
                {topCampaign ? (
                  <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">Best current campaign proof point</span>
                    <Link className="font-medium text-primary hover:underline" href={`/campaigns/${topCampaign.id}`}>
                      Open campaign
                    </Link>
                  </div>
                ) : null}
              </ListCard>
              <ListCard>
                <p className="font-medium text-foreground">Top content proof point</p>
                <p className="mt-2 text-lg text-foreground">{proofPointTitle}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {topContentItem?.post
                    ? `${currency(topContentItem.revenue)} in estimated contribution, ${number(topContentItem.covers)} covers, and ${number(topContentItem.conversions)} tracked actions tied back to one content item.`
                    : "No content-level proof point is strong enough yet. Keep linking content, campaigns, and snapshots."}
                </p>
                {topContentItem?.post ? (
                  <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                    <p>Objective: <span className="text-foreground">{topContentItem.post.goal}</span></p>
                    <p>CTA: <span className="text-foreground">{topContentItem.post.cta}</span></p>
                  </div>
                ) : null}
              </ListCard>
            </div>
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
              <CardTitle className="mt-3">Which work is easiest to explain to the client</CardTitle>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                This is the simplest answer to “what did you actually do, what changed, and what is that worth?”
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
                      {topContentItem?.campaign?.id === campaign.id && topContentItem.post ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Strongest supporting content: {topContentItem.post.platform} · {topContentItem.post.goal}
                        </p>
                      ) : null}
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
