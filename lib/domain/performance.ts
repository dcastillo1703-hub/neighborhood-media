import { WeeklyMetric } from "@/types";

const MEAMA_SPREADSHEET_MONTHS = [
  {
    monthKey: "2025-07",
    monthLabel: "Jul 2025",
    covers: 1166,
    weeks: 4
  }
];

export function calculateWeeklyRevenue(covers: number, averageCheck: number) {
  return covers * averageCheck;
}

export function buildWeeklyPerformance(metrics: WeeklyMetric[], averageCheck: number) {
  return metrics.map((metric, index) => {
    const previous = metrics[index - 1];
    const revenue = calculateWeeklyRevenue(metric.covers, averageCheck);
    const change = previous ? metric.covers - previous.covers : 0;

    return {
      ...metric,
      revenue,
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
  const spreadsheetDates = MEAMA_SPREADSHEET_MONTHS.map(
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

  MEAMA_SPREADSHEET_MONTHS.forEach((entry) => {
    const existing = combined.get(entry.monthKey);
    combined.set(entry.monthKey, {
      monthKey: entry.monthKey,
      monthLabel: entry.monthLabel,
      covers: existing ? existing.covers : entry.covers,
      weeks: existing ? existing.weeks : entry.weeks
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

    return {
      ...entry,
      revenue: calculateWeeklyRevenue(entry.covers, averageCheck),
      averageTables: guestsPerTable > 0 ? entry.covers / guestsPerTable : 0
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
