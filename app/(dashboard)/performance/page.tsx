"use client";

import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ListCard } from "@/components/dashboard/list-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatGrid } from "@/components/dashboard/stat-grid";
import { MetricCard } from "@/components/metric-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const {
    enabledChannels: manualMetaChannels,
    totals: manualMetaTotals
  } = useManualMetaPerformance(activeClient.id);
  const [syncingFacebook, setSyncingFacebook] = useState(false);
  const [facebookSyncMessage, setFacebookSyncMessage] = useState<string | null>(null);
  const [syncingGoogleAnalytics, setSyncingGoogleAnalytics] = useState(false);
  const [googleAnalyticsMessage, setGoogleAnalyticsMessage] = useState<string | null>(null);

  const revenueModel = calculateRevenueModel(revenueModelDefaults);
  const latestWeek = getLatestWeekSummary(metrics, settings.averageCheck);
  const toastOpportunities = buildToastOpportunitySummary(metrics, settings.averageCheck);
  const monthlyPerformance = buildMonthlyPerformance(
    metrics,
    settings.averageCheck,
    settings.guestsPerTable,
    6,
    false
  );
  const roiSummary = summarizeRoi(analyticsSnapshots);
  const channelContribution = summarizeChannelContribution(analyticsSnapshots);
  const campaignRecaps = summarizeCampaignRecaps(campaigns, analyticsSnapshots);
  const currentMonth = monthlyPerformance[monthlyPerformance.length - 1] ?? null;
  const topCampaign = [...campaignRecaps].sort((left, right) => right.revenue - left.revenue)[0] ?? null;
  const connectedMetaProviders = new Set(
    (metaSummary?.channels ?? [])
      .filter((channel) => channel.authStatus === "connected")
      .map((channel) => channel.provider)
  );
  const fallbackManualChannels = manualMetaChannels.filter(
    (channel) => !connectedMetaProviders.has(channel.provider)
  );
  const fallbackManualTotals = fallbackManualChannels.reduce(
    (totals, channel) => ({
      impressions: totals.impressions + channel.impressions,
      clicks: totals.clicks + channel.clicks,
      reach: totals.reach + channel.reach,
      attributedRevenue: totals.attributedRevenue + channel.attributedRevenue,
      attributedCovers: totals.attributedCovers + channel.attributedCovers
    }),
    { impressions: 0, clicks: 0, reach: 0, attributedRevenue: 0, attributedCovers: 0 }
  );
  const displayedMetaRevenue =
    (metaSummary?.totalAttributedRevenue ?? 0) + fallbackManualTotals.attributedRevenue;
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
        nextAction: connectedFacebook.nextAction,
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
          nextAction: manualFacebook.nextAction,
          source: "manual" as const
        }
      : null;
  const performanceStory =
    roiSummary.revenue > 0
      ? `${activeClient.name} has ${currency(roiSummary.revenue)} in attributed campaign revenue across ${number(roiSummary.covers)} covers. ${topCampaign?.revenue ? `${topCampaign.name} is currently the strongest performer.` : "Keep tying posts and campaigns to weekly metrics to sharpen the picture."}`
      : `No campaign revenue is attributed yet. Start by adding ROI snapshots inside campaigns, then use this page to see which growth efforts are actually moving covers and revenue.`;

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
    <div className="space-y-10">
      <PageHeader
        eyebrow="Performance"
        title="Track covers, tables, and revenue impact"
        description="Keep the restaurant growth story in one place: weekly movement, monthly volume, modeled upside, and which campaigns are actually pulling weight."
      />

      <Card className="p-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <CardDescription>Growth Read</CardDescription>
            <CardTitle className="mt-3">What the numbers are saying</CardTitle>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{performanceStory}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[28rem]">
            <div className="rounded-2xl bg-muted/50 px-4 py-3">
              <p className="text-xs text-muted-foreground">Attributed revenue</p>
              <p className="mt-2 text-xl font-medium text-foreground">{currency(roiSummary.revenue)}</p>
            </div>
            <div className="rounded-2xl bg-muted/50 px-4 py-3">
              <p className="text-xs text-muted-foreground">Attributed covers</p>
              <p className="mt-2 text-xl font-medium text-foreground">{number(roiSummary.covers)}</p>
            </div>
            <div className="rounded-2xl bg-muted/50 px-4 py-3">
              <p className="text-xs text-muted-foreground">Biggest opportunity</p>
              <p className="mt-2 truncate text-xl font-medium text-foreground">
                {toastOpportunities.weakestDay.day}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <StatGrid>
        <MetricCard href="/performance#business-snapshot" label="Weekly Covers" value={number(revenueModel.weeklyCovers)} detail="Current weekly demand baseline for the account." />
        <MetricCard href="/revenue-modeling#model-outputs" label="Monthly Revenue Run Rate" value={currency(revenueModel.monthlyRevenue)} detail="Current run rate based on covers and average check." />
        <MetricCard href="/revenue-modeling#growth-target" label="Growth Target" value={percent(revenueModelDefaults.growthTarget)} detail="Lift target currently being modeled against the business." />
        <MetricCard href="/performance#campaign-impact" label="Attributed Revenue" value={currency(roiSummary.revenue)} detail="Revenue tied back to campaign and content activity." />
        <MetricCard
          href="/performance#meta-business-suite"
          label="Meta Revenue"
          value={currency(displayedMetaRevenue)}
          detail={
            fallbackManualChannels.length
              ? "Live Facebook plus manual fallback for channels that are not connected yet."
              : "Facebook and Instagram revenue tied back to Meta reporting."
          }
        />
        <MetricCard
          href="/performance#website-analytics"
          label="Website Sessions"
          value={number(googleAnalyticsSummary?.sessions ?? 0)}
          detail="Latest synced Google Analytics sessions."
        />
        <MetricCard href="/performance#business-snapshot" label="Latest Weekly Change" value={`${latestWeek.latestWowChange > 0 ? "+" : ""}${number(latestWeek.latestWowChange)} covers`} detail="Most recent week-over-week movement." tone="olive" />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card id="business-snapshot">
          <CardHeader>
            <div>
              <CardDescription>Weekly and Monthly Read</CardDescription>
              <CardTitle className="mt-3">Current business snapshot</CardTitle>
            </div>
          </CardHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <ListCard>
              <p className="text-sm text-muted-foreground">Latest Revenue</p>
              <p className="mt-2 text-2xl text-foreground">
                {currency(latestWeek.latestRevenue)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {toastOpportunities.weekOverWeekRevenueChange >= 0 ? "+" : ""}
                {currency(toastOpportunities.weekOverWeekRevenueChange)} vs the prior week.
              </p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Current Month</p>
              <p className="mt-2 text-2xl text-foreground">
                {currentMonth ? currentMonth.monthLabel : "No month yet"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {currentMonth
                  ? `${number(currentMonth.covers)} covers · ${number(currentMonth.averageTables, 1)} average tables`
                  : "Add more weekly records to build the monthly timeline."}
              </p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Month-over-Month Revenue</p>
              <p className="mt-2 text-2xl text-foreground">
                {toastOpportunities.monthOverMonthRevenueChange >= 0 ? "+" : ""}
                {currency(toastOpportunities.monthOverMonthRevenueChange)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {currentMonth
                  ? `${currentMonth.monthLabel} compared with the previous Toast month.`
                  : "Add more weekly records to build the monthly timeline."}
              </p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Biggest Opportunity Night</p>
              <p className="mt-2 text-2xl text-foreground">{toastOpportunities.weakestDay.day}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Baseline is about {number(toastOpportunities.weakestDay.averageCovers, 1)} covers and{" "}
                {currency(toastOpportunities.weakestDay.averageRevenue)} in Toast revenue.
              </p>
            </ListCard>
          </div>
        </Card>

        <Card id="opportunity-flags">
          <CardHeader>
            <div>
              <CardDescription>Opportunity Flags</CardDescription>
              <CardTitle className="mt-3">Where the next growth move should go</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            <ListCard>
              <p className="text-sm leading-6 text-muted-foreground">{toastOpportunities.recommendation}</p>
            </ListCard>
            {toastOpportunities.flags.map((flag) => (
              <ListCard key={flag.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">{flag.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{flag.detail}</p>
                  </div>
                  <p
                    className={
                      flag.tone === "positive"
                        ? "text-sm text-emerald-600"
                        : flag.tone === "warning"
                          ? "text-sm text-amber-600"
                          : "text-sm text-foreground"
                    }
                  >
                    {flag.value}
                  </p>
                </div>
              </ListCard>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card id="source-mix">
          <CardHeader>
            <div>
              <CardDescription>Source Mix</CardDescription>
              <CardTitle className="mt-3">What is contributing revenue</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            {channelContribution.length ? (
              channelContribution.map((item) => (
                <ListCard key={item.channel}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">{item.channel}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {number(item.covers)} covers · {number(item.tables, 1)} tables
                      </p>
                    </div>
                    <p className="text-sm text-foreground">{currency(item.revenue)}</p>
                  </div>
                </ListCard>
              ))
            ) : (
              <EmptyState
                title="No attributed sources yet"
                description="Connect analytics and posting data to build the channel mix."
              />
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card id="website-analytics">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardDescription>Website Analytics</CardDescription>
                <CardTitle className="mt-3">What the website is doing</CardTitle>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  This is the website traffic layer from GA4. It tells you whether campaigns are creating attention before we tie that traffic back to covers and revenue.
                </p>
              </div>
              <Button
                disabled={!googleAnalyticsSummary?.readyToSync || syncingGoogleAnalytics}
                onClick={() => void syncWebsiteAnalytics()}
                size="sm"
                variant="outline"
              >
                {syncingGoogleAnalytics ? "Syncing website..." : "Sync Google Analytics"}
              </Button>
            </div>
          </CardHeader>
          {googleAnalyticsMessage ? (
            <div className="rounded-2xl border border-border/70 bg-card/65 p-4 text-sm text-muted-foreground">
              {googleAnalyticsMessage}
            </div>
          ) : null}
          {googleAnalyticsSummary ? (
            <div className="space-y-3">
              <ListCard>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Live GA4 website snapshot</p>
                    <p className="mt-2 text-xl font-medium text-foreground">
                      {googleAnalyticsSummary.accountLabel}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {googleAnalyticsSummary.periodLabel || "Last 30 days"}
                    </p>
                  </div>
                  {googleAnalyticsSummary.lastSyncAt ? (
                    <p className="text-xs uppercase tracking-[0.16em] text-primary">
                      Synced {new Date(googleAnalyticsSummary.lastSyncAt).toLocaleDateString()}
                    </p>
                  ) : (
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Waiting on first sync</p>
                  )}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl bg-muted/50 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Sessions</p>
                    <p className="mt-2 text-xl font-medium text-foreground">{number(googleAnalyticsSummary.sessions)}</p>
                  </div>
                  <div className="rounded-2xl bg-muted/50 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Users</p>
                    <p className="mt-2 text-xl font-medium text-foreground">{number(googleAnalyticsSummary.users)}</p>
                  </div>
                  <div className="rounded-2xl bg-muted/50 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Views</p>
                    <p className="mt-2 text-xl font-medium text-foreground">{number(googleAnalyticsSummary.views)}</p>
                  </div>
                  <div className="rounded-2xl bg-muted/50 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Events</p>
                    <p className="mt-2 text-xl font-medium text-foreground">{number(googleAnalyticsSummary.events)}</p>
                  </div>
                </div>
              </ListCard>
              <div className="grid gap-3 lg:grid-cols-2">
                <ListCard>
                  <p className="font-medium text-foreground">Top traffic sources</p>
                  <div className="mt-3 space-y-2">
                    {googleAnalyticsSummary.topSources.length ? (
                      googleAnalyticsSummary.topSources.map((source) => (
                        <div className="flex items-center justify-between gap-4 text-sm" key={source.label}>
                          <span className="text-muted-foreground">{source.label}</span>
                          <span className="text-foreground">{number(source.sessions)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Run the first sync to see where the strongest sessions are coming from.
                      </p>
                    )}
                  </div>
                </ListCard>
                <ListCard>
                  <p className="font-medium text-foreground">Top landing pages</p>
                  <div className="mt-3 space-y-2">
                    {googleAnalyticsSummary.topPages.length ? (
                      googleAnalyticsSummary.topPages.map((page) => (
                        <div className="flex items-center justify-between gap-4 text-sm" key={page.path}>
                          <span className="truncate text-muted-foreground">{page.path}</span>
                          <span className="shrink-0 text-foreground">{number(page.views)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Run the first sync to see which pages are doing the work.
                      </p>
                    )}
                  </div>
                </ListCard>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <ListCard>
                  <p className="font-medium text-foreground">Website intent signals</p>
                  <div className="mt-3 space-y-2">
                    {googleAnalyticsSummary.keyEvents.length ? (
                      googleAnalyticsSummary.keyEvents.map((event) => (
                        <div
                          className="flex items-center justify-between gap-4 text-sm"
                          key={event.label}
                        >
                          <span className="text-muted-foreground">{event.label}</span>
                          <span className="text-foreground">{number(event.count)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No tracked reservation, order, call, or menu actions yet.
                      </p>
                    )}
                  </div>
                </ListCard>
                <ListCard>
                  <p className="font-medium text-foreground">Traffic quality</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <p className="text-muted-foreground">
                      Strongest usable source:{" "}
                      <span className="text-foreground">
                        {googleAnalyticsSummary.sourceQuality.topSourceLabel ?? "None yet"}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      Unattributed traffic:{" "}
                      <span className="text-foreground">
                        {number(googleAnalyticsSummary.sourceQuality.notSetSessions)} sessions
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      If you see `not set`, Google Analytics did not get a reliable traffic-source label for those visits.
                    </p>
                  </div>
                </ListCard>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Website analytics not ready"
              description="Add the GA4 property and service account credentials, then run the first sync."
            />
          )}
        </Card>

        <Card id="meta-business-suite">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardDescription>Meta Business Suite</CardDescription>
                <CardTitle className="mt-3">Digestible Meta performance</CardTitle>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Facebook is the first live source here. Instagram can continue as manual fallback until that connection is ready.
                </p>
              </div>
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
                {syncingFacebook ? "Syncing Facebook..." : "Sync Facebook insights"}
              </Button>
            </div>
          </CardHeader>
          {facebookSyncMessage ? (
            <div className="rounded-2xl border border-border/70 bg-card/65 p-4 text-sm text-muted-foreground">
              {facebookSyncMessage}
            </div>
          ) : null}
          {facebookRead ? (
            <div className="space-y-3">
              <ListCard>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {facebookRead.source === "live" ? "Live Facebook snapshot" : "Manual Facebook snapshot"}
                    </p>
                    <p className="mt-2 text-xl font-medium text-foreground">{facebookRead.label}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {facebookRead.periodLabel || "Current Facebook reporting window"}
                    </p>
                  </div>
                  {facebookRead.syncedAt ? (
                    <p className="text-xs uppercase tracking-[0.16em] text-primary">
                      Synced {new Date(facebookRead.syncedAt).toLocaleDateString()}
                    </p>
                  ) : (
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Manual</p>
                  )}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-muted/50 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Impressions</p>
                    <p className="mt-2 text-xl font-medium text-foreground">{number(facebookRead.impressions)}</p>
                  </div>
                  <div className="rounded-2xl bg-muted/50 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Clicks</p>
                    <p className="mt-2 text-xl font-medium text-foreground">{number(facebookRead.clicks)}</p>
                  </div>
                  <div className="rounded-2xl bg-muted/50 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Engagement</p>
                    <p className="mt-2 text-xl font-medium text-foreground">{number(facebookRead.engagement)}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  {facebookRead.nextAction ||
                    (facebookRead.impressions > 0
                      ? "Facebook is connected and reporting live page-level performance."
                      : "Facebook is connected, but Meta is still returning a thin performance payload for this Page.")}
                </p>
              </ListCard>
            </div>
          ) : null}
          {!metaSummary && !manualMetaChannels.length ? (
            <EmptyState
              title="Meta digest not ready"
              description="Connect Meta Business Suite and sync Facebook analytics to populate this summary."
            />
          ) : manualMetaChannels.length > 0 &&
            !(metaSummary?.channels.some((channel) => channel.authStatus === "connected")) ? (
            <div className="space-y-3">
              <ListCard>
                <p className="text-sm text-muted-foreground">Manual Meta Performance</p>
                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  <p className="text-sm text-muted-foreground">
                    Impressions: <span className="text-foreground">{number(manualMetaTotals.impressions)}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Reach: <span className="text-foreground">{number(manualMetaTotals.reach)}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Clicks: <span className="text-foreground">{number(manualMetaTotals.clicks)}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Revenue: <span className="text-foreground">{currency(manualMetaTotals.attributedRevenue)}</span>
                  </p>
                </div>
              </ListCard>
              {manualMetaChannels.map((channel) => (
                <ListCard key={channel.provider}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium capitalize text-foreground">{channel.provider}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {channel.accountLabel}{channel.handle ? ` · ${channel.handle}` : ""}
                      </p>
                    </div>
                    <p className="text-xs uppercase tracking-[0.16em] text-primary">
                      {channel.periodLabel}
                    </p>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-4">
                    <p className="text-sm text-muted-foreground">
                      Impressions: <span className="text-foreground">{number(channel.impressions)}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Reach: <span className="text-foreground">{number(channel.reach)}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Clicks: <span className="text-foreground">{number(channel.clicks)}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Covers: <span className="text-foreground">{number(channel.attributedCovers)}</span>
                    </p>
                  </div>
                  {channel.topPost || channel.nextAction ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {channel.topPost ? (
                        <p className="text-sm text-muted-foreground">
                          Top post: <span className="text-foreground">{channel.topPost}</span>
                        </p>
                      ) : null}
                      {channel.nextAction ? (
                        <p className="text-sm text-muted-foreground">
                          Next action: <span className="text-foreground">{channel.nextAction}</span>
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </ListCard>
              ))}
            </div>
          ) : metaSummary ? (
            <div className="space-y-3">
              <ListCard>
                <p className="text-sm text-muted-foreground">Combined Meta Performance</p>
                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  <p className="text-sm text-muted-foreground">
                    Impressions: <span className="text-foreground">{number(metaSummary.totalImpressions + fallbackManualTotals.impressions)}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Clicks: <span className="text-foreground">{number(metaSummary.totalClicks + fallbackManualTotals.clicks)}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Reach: <span className="text-foreground">{number(fallbackManualTotals.reach)}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Revenue: <span className="text-foreground">{currency(displayedMetaRevenue)}</span>
                  </p>
                </div>
              </ListCard>
              {metaSummary.channels
                .filter((channel) => channel.authStatus === "connected")
                .map((channel) => (
                <ListCard key={channel.provider}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium capitalize text-foreground">{channel.provider}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{channel.accountLabel}</p>
                    </div>
                    <p className="text-xs uppercase tracking-[0.16em] text-primary">
                      {channel.lastSyncAt
                        ? `Synced ${new Date(channel.lastSyncAt).toLocaleDateString()}`
                        : channel.authStatus}
                    </p>
                  </div>
                  {channel.latestPeriodLabel ? (
                    <p className="mt-2 text-sm text-muted-foreground">{channel.latestPeriodLabel}</p>
                  ) : null}
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <p className="text-sm text-muted-foreground">
                      Impressions: <span className="text-foreground">{number(channel.impressions)}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Clicks: <span className="text-foreground">{number(channel.clicks)}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Covers: <span className="text-foreground">{number(channel.attributedCovers)}</span>
                    </p>
                  </div>
                  {channel.nextAction ? (
                    <p className="mt-3 text-sm text-muted-foreground">{channel.nextAction}</p>
                  ) : null}
                </ListCard>
              ))}
              {fallbackManualChannels.map((channel) => (
                <ListCard key={`manual-${channel.provider}`}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium capitalize text-foreground">{channel.provider}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Manual fallback · {channel.accountLabel}
                        {channel.handle ? ` · ${channel.handle}` : ""}
                      </p>
                    </div>
                    <p className="text-xs uppercase tracking-[0.16em] text-primary">
                      {channel.periodLabel}
                    </p>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-4">
                    <p className="text-sm text-muted-foreground">
                      Impressions: <span className="text-foreground">{number(channel.impressions)}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Reach: <span className="text-foreground">{number(channel.reach)}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Clicks: <span className="text-foreground">{number(channel.clicks)}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Covers: <span className="text-foreground">{number(channel.attributedCovers)}</span>
                    </p>
                  </div>
                </ListCard>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Meta digest not ready"
              description="Connect Meta Business Suite and sync Facebook or Instagram analytics to populate this summary."
            />
          )}
        </Card>

        <Card id="campaign-impact">
          <CardHeader>
            <div>
              <CardDescription>Campaign Impact</CardDescription>
              <CardTitle className="mt-3">What the active initiatives are producing</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            {campaignRecaps.length ? (
              campaignRecaps.map((campaign) => (
                <ListCard key={campaign.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">{campaign.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Track whether campaign work created traffic, then compare it to covers and revenue movement.
                      </p>
                    </div>
                    <Link className="text-sm font-medium text-primary" href={`/campaigns/${campaign.id}`}>
                      Open
                    </Link>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <p className="text-sm text-muted-foreground">
                      Revenue: <span className="text-foreground">{currency(campaign.revenue)}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Covers: <span className="text-foreground">{number(campaign.covers)}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Tables: <span className="text-foreground">{number(campaign.tables, 1)}</span>
                    </p>
                  </div>
                </ListCard>
              ))
            ) : (
              <EmptyState
                title="No campaign impact yet"
                description="Campaign-linked analytics will surface here once activity is connected."
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardDescription>Deep Workspaces</CardDescription>
              <CardTitle className="mt-3">Open the detailed analysis tools</CardTitle>
            </div>
          </CardHeader>
          <div className="grid gap-3">
            <Link className={buttonVariants({ variant: "outline" })} href="/weekly-performance">
              Open weekly covers
            </Link>
            <Link className={buttonVariants({ variant: "outline" })} href="/revenue-modeling">
              Open revenue model
            </Link>
            <Link className={buttonVariants({ variant: "outline" })} href="/reporting">
              Open reporting
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
