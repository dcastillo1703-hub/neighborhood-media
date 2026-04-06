import { AnalyticsSnapshot, Campaign, Channel, WeeklyMetric } from "@/types";

export function summarizeRoi(analytics: AnalyticsSnapshot[]) {
  const revenue = analytics.reduce((sum, item) => sum + item.attributedRevenue, 0);
  const covers = analytics.reduce((sum, item) => sum + item.attributedCovers, 0);
  const tables = analytics.reduce((sum, item) => sum + item.attributedTables, 0);
  const conversions = analytics.reduce((sum, item) => sum + item.conversions, 0);

  return {
    revenue,
    covers,
    tables,
    conversions
  };
}

export function summarizeChannelContribution(analytics: AnalyticsSnapshot[]) {
  const byChannel = new Map<Channel, { revenue: number; covers: number; tables: number }>();

  analytics.forEach((snapshot) => {
    const current = byChannel.get(snapshot.source) ?? { revenue: 0, covers: 0, tables: 0 };
    current.revenue += snapshot.attributedRevenue;
    current.covers += snapshot.attributedCovers;
    current.tables += snapshot.attributedTables;
    byChannel.set(snapshot.source, current);
  });

  return Array.from(byChannel.entries()).map(([channel, values]) => ({
    channel,
    ...values
  }));
}

export function summarizePeriodComparison(metrics: WeeklyMetric[], averageCheck: number) {
  const midpoint = Math.floor(metrics.length / 2);
  const previous = metrics.slice(0, midpoint);
  const current = metrics.slice(midpoint);

  const previousCovers = previous.reduce((sum, item) => sum + item.covers, 0);
  const currentCovers = current.reduce((sum, item) => sum + item.covers, 0);

  return {
    previousCovers,
    currentCovers,
    previousRevenue: previousCovers * averageCheck,
    currentRevenue: currentCovers * averageCheck,
    coversDelta: currentCovers - previousCovers,
    revenueDelta: (currentCovers - previousCovers) * averageCheck
  };
}

export function summarizeCampaignRecaps(campaigns: Campaign[], analytics: AnalyticsSnapshot[]) {
  return campaigns.map((campaign) => {
    const related = analytics.filter((item) => item.linkedCampaignId === campaign.id);
    return {
      id: campaign.id,
      name: campaign.name,
      revenue: related.reduce((sum, item) => sum + item.attributedRevenue, 0),
      covers: related.reduce((sum, item) => sum + item.attributedCovers, 0),
      tables: related.reduce((sum, item) => sum + item.attributedTables, 0)
    };
  });
}
