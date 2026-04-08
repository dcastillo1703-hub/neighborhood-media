"use client";

import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ListCard } from "@/components/dashboard/list-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatGrid } from "@/components/dashboard/stat-grid";
import { MetricCard } from "@/components/metric-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateRevenueModel } from "@/lib/calculations";
import { useActiveClient } from "@/lib/client-context";
import { buildMonthlyPerformance, getLatestWeekSummary } from "@/lib/domain/performance";
import {
  summarizeCampaignRecaps,
  summarizeChannelContribution,
  summarizeRoi
} from "@/lib/domain/reporting";
import { useAnalyticsSnapshots } from "@/lib/repositories/use-analytics-snapshots";
import { useCampaigns } from "@/lib/repositories/use-campaigns";
import { useClientSettings } from "@/lib/repositories/use-client-settings";
import { useWeeklyMetrics } from "@/lib/repositories/use-weekly-metrics";
import { useManualMetaPerformance } from "@/lib/use-manual-meta-performance";
import { useMetaBusinessSuite } from "@/lib/use-meta-business-suite";
import { currency, number, percent } from "@/lib/utils";

export default function PerformancePage() {
  const { activeClient } = useActiveClient();
  const { settings, revenueModelDefaults } = useClientSettings(activeClient.id);
  const { metrics } = useWeeklyMetrics(activeClient.id);
  const { campaigns } = useCampaigns(activeClient.id);
  const { analyticsSnapshots } = useAnalyticsSnapshots(activeClient.id);
  const { summary: metaSummary } = useMetaBusinessSuite(activeClient.id);
  const {
    enabledChannels: manualMetaChannels,
    hasManualMeta,
    totals: manualMetaTotals
  } = useManualMetaPerformance(activeClient.id);

  const revenueModel = calculateRevenueModel(revenueModelDefaults);
  const latestWeek = getLatestWeekSummary(metrics, settings.averageCheck);
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
  const performanceStory =
    roiSummary.revenue > 0
      ? `${activeClient.name} has ${currency(roiSummary.revenue)} in attributed campaign revenue across ${number(roiSummary.covers)} covers. ${topCampaign?.revenue ? `${topCampaign.name} is currently the strongest performer.` : "Keep tying posts and campaigns to weekly metrics to sharpen the picture."}`
      : `No campaign revenue is attributed yet. Start by adding ROI snapshots inside campaigns, then use this page to see which growth efforts are actually moving covers and revenue.`;

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
              <p className="text-xs text-muted-foreground">Top campaign</p>
              <p className="mt-2 truncate text-xl font-medium text-foreground">{topCampaign?.revenue ? topCampaign.name : "None yet"}</p>
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
          value={currency(hasManualMeta ? manualMetaTotals.attributedRevenue : metaSummary?.totalAttributedRevenue ?? 0)}
          detail={hasManualMeta ? "Manual Facebook and Instagram revenue configured in Settings." : "Facebook and Instagram revenue tied back to Meta reporting."}
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
                Derived from the most recent weekly covers record.
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
              <p className="text-sm text-muted-foreground">Annual Upside</p>
              <p className="mt-2 text-2xl text-foreground">
                {currency(revenueModel.annualUpside)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Value if the current growth target sustains for twelve months.
              </p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Peak Service Night</p>
              <p className="mt-2 text-2xl text-foreground">{revenueModel.busiestDay.day}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {number(revenueModel.busiestDay.projectedTables, 1)} projected tables at target.
              </p>
            </ListCard>
          </div>
        </Card>

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
        <Card id="meta-business-suite">
          <CardHeader>
            <div>
              <CardDescription>Meta Business Suite</CardDescription>
              <CardTitle className="mt-3">Digestible Meta performance</CardTitle>
            </div>
          </CardHeader>
          {hasManualMeta ? (
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
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <p className="text-sm text-muted-foreground">
                    Impressions: <span className="text-foreground">{number(metaSummary.totalImpressions)}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Clicks: <span className="text-foreground">{number(metaSummary.totalClicks)}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Revenue: <span className="text-foreground">{currency(metaSummary.totalAttributedRevenue)}</span>
                  </p>
                </div>
              </ListCard>
              {metaSummary.channels.map((channel) => (
                <ListCard key={channel.provider}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium capitalize text-foreground">{channel.provider}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{channel.accountLabel}</p>
                    </div>
                    <p className="text-xs uppercase tracking-[0.16em] text-primary">
                      {channel.authStatus}
                    </p>
                  </div>
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
                  <p className="font-medium text-foreground">{campaign.name}</p>
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
