"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Brush, Tooltip } from "recharts";

import { ChartShell } from "@/components/charts/chart-shell";
import { ChartHeaderAction, ChartTooltip } from "@/components/charts/chart-tooltip";
import { ListCard } from "@/components/dashboard/list-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatGrid } from "@/components/dashboard/stat-grid";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useActiveClient } from "@/lib/client-context";
import { summarizeCampaignRecaps } from "@/lib/domain/reporting";
import {
  summarizeChannelContribution,
  summarizePeriodComparison,
  summarizeRoi
} from "@/lib/domain/reporting";
import { useAnalyticsSnapshots } from "@/lib/repositories/use-analytics-snapshots";
import { useCampaigns } from "@/lib/repositories/use-campaigns";
import { useClientSettings } from "@/lib/repositories/use-client-settings";
import { useWeeklyMetrics } from "@/lib/repositories/use-weekly-metrics";
import { currency, number } from "@/lib/utils";

export default function ReportingPage() {
  const { activeClient } = useActiveClient();
  const { settings } = useClientSettings(activeClient.id);
  const { metrics } = useWeeklyMetrics(activeClient.id);
  const { campaigns } = useCampaigns(activeClient.id);
  const { analyticsSnapshots } = useAnalyticsSnapshots(activeClient.id);

  const roiSummary = summarizeRoi(analyticsSnapshots);
  const channelContribution = summarizeChannelContribution(analyticsSnapshots);
  const periodComparison = summarizePeriodComparison(metrics, settings.averageCheck);
  const campaignRecaps = summarizeCampaignRecaps(campaigns, analyticsSnapshots);
  const [expandedTrend, setExpandedTrend] = useState(false);
  const comparisonData = [
    { period: "Prior", covers: periodComparison.previousCovers, revenue: periodComparison.previousRevenue },
    { period: "Recent", covers: periodComparison.currentCovers, revenue: periodComparison.currentRevenue }
  ];

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Reporting"
        title="Reporting"
        description="Review attributed revenue, covers, tables, and campaign performance."
      />

      <StatGrid>
        <MetricCard label="Attributed Revenue" value={currency(roiSummary.revenue)} detail="Current revenue tied back to linked analytics snapshots." />
        <MetricCard label="Attributed Covers" value={number(roiSummary.covers)} detail="Covers tied back to linked analytics snapshots." />
        <MetricCard label="Attributed Tables" value={number(roiSummary.tables, 1)} detail="Table demand view derived from linked performance snapshots." />
        <MetricCard label="Period Revenue Delta" value={currency(periodComparison.revenueDelta)} detail="Compares recent versus prior period weekly performance." tone="olive" />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div>
              <CardDescription>Channel Contribution</CardDescription>
              <CardTitle className="mt-3">Revenue by marketing source</CardTitle>
            </div>
          </CardHeader>
          <ChartShell>
            <BarChart data={channelContribution}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="channel" stroke="#b9b2a0" tickLine={false} axisLine={false} />
              <YAxis stroke="#b9b2a0" tickLine={false} axisLine={false} tickFormatter={(value) => `$${Math.round(value / 1000)}k`} />
              <Bar dataKey="revenue" fill="#b89a5a" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ChartShell>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardDescription>Period Comparison</CardDescription>
              <CardTitle className="mt-3">Weekly cover movement</CardTitle>
            </div>
            <ChartHeaderAction>
              <Button
                onClick={() => setExpandedTrend((current) => !current)}
                size="sm"
                variant="outline"
              >
                {expandedTrend ? "Collapse" : "Expand"}
              </Button>
            </ChartHeaderAction>
          </CardHeader>
          <ChartShell heightClassName={expandedTrend ? "h-[28rem]" : "h-72"}>
            <LineChart data={comparisonData}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="period" stroke="#b9b2a0" tickLine={false} axisLine={false} />
              <YAxis stroke="#b9b2a0" tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line dataKey="covers" stroke="#7f8a57" strokeWidth={3} dot={{ r: 4 }} />
              {comparisonData.length > 6 ? (
                <Brush
                  dataKey="period"
                  height={26}
                  stroke="#7f8a57"
                  travellerWidth={8}
                  fill="rgba(255,255,255,0.03)"
                />
              ) : null}
            </LineChart>
          </ChartShell>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardDescription>Growth Summary</CardDescription>
              <CardTitle className="mt-3">Business impact snapshot</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            <ListCard>
              <p className="text-sm text-muted-foreground">Previous Period Revenue</p>
              <p className="mt-2 text-2xl text-foreground">{currency(periodComparison.previousRevenue)}</p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Recent Period Revenue</p>
              <p className="mt-2 text-2xl text-foreground">{currency(periodComparison.currentRevenue)}</p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Cover Delta</p>
              <p className="mt-2 text-2xl text-foreground">
                {periodComparison.coversDelta >= 0 ? "+" : ""}
                {number(periodComparison.coversDelta)}
              </p>
            </ListCard>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardDescription>Campaign Recaps</CardDescription>
              <CardTitle className="mt-3">Attribution by initiative</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            {campaignRecaps.map((campaign) => (
              <ListCard key={campaign.id}>
                <p className="font-medium text-foreground">{campaign.name}</p>
                <div className="mt-3 grid gap-2 md:grid-cols-3 text-sm">
                  <p className="text-muted-foreground">Revenue: <span className="text-foreground">{currency(campaign.revenue)}</span></p>
                  <p className="text-muted-foreground">Covers: <span className="text-foreground">{number(campaign.covers)}</span></p>
                  <p className="text-muted-foreground">Tables: <span className="text-foreground">{number(campaign.tables, 1)}</span></p>
                </div>
              </ListCard>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
