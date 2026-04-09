import { WeeklyMetric } from "@/types";
import { meamaToastMonthlySnapshots, meamaToastWeekdayBaseline } from "@/data/toast";

export type OpportunityFlagTone = "positive" | "warning" | "neutral";

export type OpportunityFlag = {
  id: string;
  title: string;
  value: string;
  detail: string;
  tone: OpportunityFlagTone;
};

export type ToastOpportunitySummary = {
  latestWeekRevenue: number;
  latestWeekCovers: number;
  weekOverWeekRevenueChange: number;
  weekOverWeekCoversChange: number;
  weekOverWeekRevenuePercent: number;
  monthOverMonthRevenueChange: number;
  monthOverMonthRevenuePercent: number;
  monthOverMonthCoverChange: number;
  weakestDay: (typeof meamaToastWeekdayBaseline)[number];
  strongestDay: (typeof meamaToastWeekdayBaseline)[number];
  recommendation: string;
  flags: OpportunityFlag[];
};

export function calculateWeeklyRevenue(covers: number, averageCheck: number) {
  return covers * averageCheck;
}

export function buildWeeklyPerformance(metrics: WeeklyMetric[], averageCheck: number) {
  return metrics.map((metric, index) => {
    const previous = metrics[index - 1];
    const revenue = calculateWeeklyRevenue(metric.covers, averageCheck);
    const resolvedRevenue = metric.netSales ?? revenue;
    const change = previous ? metric.covers - previous.covers : 0;

    return {
      ...metric,
      revenue: resolvedRevenue,
      wowChange: change,
      wowChangePercent: previous ? (change / previous.covers) * 100 : 0
    };
  });
}

function resolveMetricDate(metric: WeeklyMetric) {
  if (metric.createdAt) {
    return new Date(metric.createdAt);
  }

  const parsed = new Date(`${metric.weekLabel}, 2026`);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  return new Date();
}

export function buildMonthlyPerformance(
  metrics: WeeklyMetric[],
  averageCheck: number,
  guestsPerTable: number,
  monthsToShow = 8,
  includeEmptyMonths = true
) {
  const grouped = new Map<string, { monthKey: string; monthLabel: string; covers: number; weeks: number }>();
  const metricDates = metrics.map(resolveMetricDate);
  const spreadsheetDates = meamaToastMonthlySnapshots.map(
    (entry) => new Date(`${entry.monthKey}-01T00:00:00`)
  );
  const allDates = [...metricDates, ...spreadsheetDates];
  const latestDate = allDates.length
    ? new Date(Math.max(...allDates.map((date) => date.getTime())))
    : new Date();

  metrics.forEach((metric) => {
    const date = resolveMetricDate(metric);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = date.toLocaleString("en-US", {
      month: "short",
      year: "numeric"
    });
    const current = grouped.get(monthKey) ?? {
      monthKey,
      monthLabel,
      covers: 0,
      weeks: 0
    };

    grouped.set(monthKey, {
      monthKey,
      monthLabel,
      covers: current.covers + metric.covers,
      weeks: current.weeks + 1
    });
  });

  const combined = new Map(grouped);

  meamaToastMonthlySnapshots.forEach((entry) => {
    const existing = combined.get(entry.monthKey);
    combined.set(entry.monthKey, {
      monthKey: entry.monthKey,
      monthLabel: entry.monthLabel,
      covers: existing ? existing.covers : entry.covers,
      weeks: existing ? existing.weeks : 4
    });
  });

  const timeline = Array.from({ length: monthsToShow }, (_, index) => {
    const date = new Date(
      latestDate.getFullYear(),
      latestDate.getMonth() - (monthsToShow - 1 - index),
      1
    );
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = date.toLocaleString("en-US", {
      month: "short",
      year: "numeric"
    });
    const entry = combined.get(monthKey) ?? {
      monthKey,
      monthLabel,
      covers: 0,
      weeks: 0
    };
    const toastSnapshot = meamaToastMonthlySnapshots.find((snapshot) => snapshot.monthKey === monthKey);

    return {
      ...entry,
      revenue: toastSnapshot?.revenue ?? calculateWeeklyRevenue(entry.covers, averageCheck),
      averageTables:
        toastSnapshot?.orders ??
        (guestsPerTable > 0 ? entry.covers / guestsPerTable : 0)
    };
  });

  return includeEmptyMonths ? timeline : timeline.filter((entry) => entry.covers > 0);
}

export function rollingAverage(metrics: WeeklyMetric[]) {
  if (!metrics.length) return 0;
  const total = metrics.reduce((sum, item) => sum + item.covers, 0);
  return total / metrics.length;
}

export function bestWeek(metrics: WeeklyMetric[]) {
  return metrics.reduce<WeeklyMetric | null>((best, current) => {
    if (!best || current.covers > best.covers) return current;
    return best;
  }, null);
}

export function getLatestWeekSummary(metrics: WeeklyMetric[], averageCheck: number) {
  const performance = buildWeeklyPerformance(metrics, averageCheck);
  const latest = performance[performance.length - 1];

  return {
    performance,
    latestRevenue: latest?.revenue ?? 0,
    latestWowChange: latest?.wowChange ?? 0,
    average: rollingAverage(metrics),
    best: bestWeek(metrics)
  };
}

export function buildToastOpportunitySummary(
  metrics: WeeklyMetric[],
  averageCheck: number
): ToastOpportunitySummary {
  const performance = buildWeeklyPerformance(metrics, averageCheck);
  const latestWeek = performance[performance.length - 1];
  const previousWeek = performance[performance.length - 2];
  const latestMonth = meamaToastMonthlySnapshots[meamaToastMonthlySnapshots.length - 1];
  const previousMonth = meamaToastMonthlySnapshots[meamaToastMonthlySnapshots.length - 2];
  const weakestDay = [...meamaToastWeekdayBaseline].sort(
    (left, right) => left.averageRevenue - right.averageRevenue
  )[0];
  const strongestDay = [...meamaToastWeekdayBaseline].sort(
    (left, right) => right.averageRevenue - left.averageRevenue
  )[0];
  const latestWeekRevenue = latestWeek?.revenue ?? 0;
  const latestWeekCovers = latestWeek?.covers ?? 0;
  const previousWeekRevenue = previousWeek?.revenue ?? 0;
  const weekOverWeekRevenueChange = latestWeekRevenue - previousWeekRevenue;
  const weekOverWeekCoversChange = latestWeekCovers - (previousWeek?.covers ?? 0);
  const weekOverWeekRevenuePercent =
    previousWeekRevenue > 0 ? (weekOverWeekRevenueChange / previousWeekRevenue) * 100 : 0;
  const monthOverMonthRevenueChange = latestMonth.revenue - previousMonth.revenue;
  const monthOverMonthRevenuePercent =
    previousMonth.revenue > 0
      ? (monthOverMonthRevenueChange / previousMonth.revenue) * 100
      : 0;
  const monthOverMonthCoverChange = latestMonth.covers - previousMonth.covers;

  const flags: OpportunityFlag[] = [
    {
      id: "month-trend",
      title: monthOverMonthRevenueChange >= 0 ? "Monthly revenue lift" : "Monthly revenue dip",
      value: `${monthOverMonthRevenueChange >= 0 ? "+" : ""}$${Math.round(
        monthOverMonthRevenueChange
      ).toLocaleString()}`,
      detail: `${latestMonth.monthLabel} vs ${previousMonth.monthLabel} in Toast net sales.`,
      tone: monthOverMonthRevenueChange >= 0 ? "positive" : "warning"
    },
    {
      id: "soft-night",
      title: "Biggest opportunity night",
      value: weakestDay.day,
      detail: `This is the softest recurring night at about $${Math.round(
        weakestDay.averageRevenue
      ).toLocaleString()} and ${Math.round(weakestDay.averageCovers)} covers.`,
      tone: "warning"
    },
    {
      id: "anchor-night",
      title: "Strongest recurring night",
      value: strongestDay.day,
      detail: `This is the anchor night to protect and learn from at about $${Math.round(
        strongestDay.averageRevenue
      ).toLocaleString()} and ${Math.round(strongestDay.averageCovers)} covers.`,
      tone: "positive"
    }
  ];

  const recommendation =
    monthOverMonthRevenueChange >= 0
      ? `${latestMonth.monthLabel} outperformed ${previousMonth.monthLabel} by $${Math.round(
          monthOverMonthRevenueChange
        ).toLocaleString()}. Keep pressure on ${weakestDay.day.toLowerCase()} with a focused campaign while protecting ${strongestDay.day.toLowerCase()} as the dependable revenue anchor.`
      : `${latestMonth.monthLabel} fell behind ${previousMonth.monthLabel} by $${Math.round(
          Math.abs(monthOverMonthRevenueChange)
        ).toLocaleString()}. The clearest recovery opportunity is ${weakestDay.day.toLowerCase()}, while ${strongestDay.day.toLowerCase()} remains the baseline to measure against.`;

  return {
    latestWeekRevenue,
    latestWeekCovers,
    weekOverWeekRevenueChange,
    weekOverWeekCoversChange,
    weekOverWeekRevenuePercent,
    monthOverMonthRevenueChange,
    monthOverMonthRevenuePercent,
    monthOverMonthCoverChange,
    weakestDay,
    strongestDay,
    recommendation,
    flags
  };
}
