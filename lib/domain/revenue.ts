import { DayOfWeek, RevenueModelInput, RevenueModelOutput, WeekdayProjection } from "@/types";

const MEAMA_WEEKDAY_BASELINE: Array<{ day: DayOfWeek; averageCovers: number }> = [
  { day: "Monday", averageCovers: 8.375 },
  { day: "Tuesday", averageCovers: 5.125 },
  { day: "Wednesday", averageCovers: 14.875 },
  { day: "Thursday", averageCovers: 10.75 },
  { day: "Friday", averageCovers: 51 },
  { day: "Saturday", averageCovers: 54.625 },
  { day: "Sunday", averageCovers: 6.875 }
];

function buildWeekdayBreakdown(input: RevenueModelInput, weeklyCovers: number): WeekdayProjection[] {
  const totalBaselineCovers = MEAMA_WEEKDAY_BASELINE.reduce((sum, day) => sum + day.averageCovers, 0);
  const growthMultiplier = 1 + input.growthTarget / 100;

  return MEAMA_WEEKDAY_BASELINE.map((entry) => {
    const shareOfWeek = entry.averageCovers / totalBaselineCovers;
    const currentCovers = weeklyCovers * shareOfWeek;
    const projectedCovers = currentCovers * growthMultiplier;
    const currentRevenue = currentCovers * input.averageCheck;
    const projectedRevenue = projectedCovers * input.averageCheck;
    const currentTables = currentCovers / input.guestsPerTable;
    const projectedTables = projectedCovers / input.guestsPerTable;

    return {
      day: entry.day,
      shareOfWeek,
      currentCovers,
      projectedCovers,
      addedCovers: projectedCovers - currentCovers,
      currentRevenue,
      projectedRevenue,
      currentTables,
      projectedTables
    };
  });
}

export function calculateRevenueModel(input: RevenueModelInput): RevenueModelOutput {
  const weeklyCovers =
    input.mode === "monthly" ? input.monthlyCovers / input.weeksPerMonth : input.weeklyCovers;

  const monthlyCovers =
    input.mode === "weekly" ? input.weeklyCovers * input.weeksPerMonth : input.monthlyCovers;

  const dailyCovers = weeklyCovers / input.daysOpenPerWeek;
  const weeklyRevenue = weeklyCovers * input.averageCheck;
  const monthlyRevenue = monthlyCovers * input.averageCheck;
  const dailyRevenue = dailyCovers * input.averageCheck;
  const growthMultiplier = input.growthTarget / 100;
  const addedMonthlyCovers = monthlyCovers * growthMultiplier;
  const addedWeeklyCovers = weeklyCovers * growthMultiplier;
  const addedMonthlyRevenue = monthlyRevenue * growthMultiplier;
  const addedWeeklyRevenue = weeklyRevenue * growthMultiplier;
  const annualUpside = addedMonthlyRevenue * 12;
  const tablesPerNight = dailyCovers / input.guestsPerTable;
  const weekdayBreakdown = buildWeekdayBreakdown(input, weeklyCovers);
  const busiestDay = weekdayBreakdown.reduce((highest, current) =>
    current.projectedCovers > highest.projectedCovers ? current : highest
  );
  const slowestDay = weekdayBreakdown.reduce((lowest, current) =>
    current.projectedCovers < lowest.projectedCovers ? current : lowest
  );

  return {
    monthlyCovers,
    weeklyCovers,
    dailyCovers,
    monthlyRevenue,
    weeklyRevenue,
    dailyRevenue,
    addedMonthlyCovers,
    addedWeeklyCovers,
    addedMonthlyRevenue,
    addedWeeklyRevenue,
    annualUpside,
    tablesPerNight,
    busiestDay,
    slowestDay,
    weekdayBreakdown
  };
}

export function buildGrowthScenarios(input: RevenueModelInput) {
  const scenarios = [0, 25, 50, 75, 100];
  const base = calculateRevenueModel(input);

  return scenarios.map((growth) => ({
    growth,
    revenue: base.monthlyRevenue * (1 + growth / 100),
    covers: base.monthlyCovers * (1 + growth / 100)
  }));
}

export function buildImpactSentence(clientName: string, input: RevenueModelInput) {
  const model = calculateRevenueModel(input);

  return `A ${input.growthTarget}% lift means roughly ${Math.round(model.addedMonthlyCovers)} extra monthly covers and $${Math.round(model.addedMonthlyRevenue).toLocaleString()} in added monthly revenue for ${clientName}.`;
}
