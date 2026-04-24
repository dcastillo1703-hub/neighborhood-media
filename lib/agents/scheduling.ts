import { z } from "zod";

const proofSignalSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  detail: z.string().min(1)
});

const scheduleGapSchema = z.object({
  dateKey: z.string().min(1),
  label: z.string().min(1),
  detail: z.string().min(1)
});

const scheduledPostSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  platform: z.string().min(1),
  dateKey: z.string().min(1),
  timingIntent: z.string().min(1).nullable().optional(),
  campaignName: z.string().min(1).nullable().optional()
});

const readyContentItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  platform: z.string().min(1),
  format: z.string().min(1),
  cta: z.string().min(1),
  timingIntent: z.string().min(1),
  assetState: z.string().min(1),
  approvalState: z.string().min(1),
  guestBehaviorGoal: z.string().min(1),
  campaignName: z.string().min(1).nullable().optional(),
  campaignId: z.string().min(1).nullable().optional()
});

const schedulingPlacementSchema = z.object({
  contentTitle: z.string().min(1),
  platform: z.string().min(1),
  format: z.string().min(1),
  recommendedDate: z.string().min(1),
  recommendedTimeWindow: z.string().min(1),
  timingReason: z.string().min(1),
  businessGoal: z.string().min(1),
  confidence: z.enum(["Low", "Medium", "High"]),
  reviewBeforePublishing: z.array(z.string().min(1)).min(1)
});

export const schedulingPlanContextSchema = z.object({
  client: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    segment: z.string().min(1),
    location: z.string().min(1)
  }),
  selectedCampaign: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    objective: z.string().min(1),
    status: z.string().min(1)
  }),
  campaignObjective: z.string().min(1),
  readyContentItems: z.array(readyContentItemSchema),
  currentCalendar: z.object({
    label: z.string().min(1),
    openDaysThisMonth: z.number().int().nonnegative(),
    upcomingScheduledPosts: z.array(scheduledPostSummarySchema)
  }),
  openScheduleGaps: z.array(scheduleGapSchema),
  weakRevenueWindow: proofSignalSchema,
  performanceSignals: z.array(proofSignalSchema),
  attributionConfidence: z.object({
    label: z.enum(["High", "Medium", "Low"]),
    detail: z.string().min(1)
  }),
  existingScheduledPosts: z.array(scheduledPostSummarySchema),
  businessHours: z
    .object({
      daysOpenPerWeek: z.number().int().nonnegative(),
      weeksPerMonth: z.number().int().nonnegative()
    })
    .optional()
});

export const schedulingPlanResultSchema = z.object({
  scheduleSummary: z.string().min(1),
  schedulingStrategy: z.string().min(1),
  recommendedPlacements: z.array(schedulingPlacementSchema).max(5),
  scheduleGapsFilled: z.array(z.string().min(1)),
  risksOrWarnings: z.array(z.string().min(1)),
  nextOperatorAction: z.string().min(1)
});

export type SchedulingPlanContext = z.infer<typeof schedulingPlanContextSchema>;
export type SchedulingPlanResult = z.infer<typeof schedulingPlanResultSchema>;
export type SchedulingPlanContextInput = {
  client: SchedulingPlanContext["client"];
  selectedCampaign: SchedulingPlanContext["selectedCampaign"];
  campaignObjective: string;
  readyContentItems?: SchedulingPlanContext["readyContentItems"];
  currentCalendar: SchedulingPlanContext["currentCalendar"];
  openScheduleGaps?: SchedulingPlanContext["openScheduleGaps"];
  weakRevenueWindow: SchedulingPlanContext["weakRevenueWindow"];
  performanceSignals?: SchedulingPlanContext["performanceSignals"];
  attributionConfidence: SchedulingPlanContext["attributionConfidence"];
  existingScheduledPosts?: SchedulingPlanContext["existingScheduledPosts"];
  businessHours?: SchedulingPlanContext["businessHours"];
};

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function formatDateKey(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function nextWeekdayDate(baseDate: Date, targetWeekday: number) {
  const result = new Date(baseDate);
  const current = result.getDay();
  const delta = (targetWeekday - current + 7) % 7 || 7;
  result.setDate(result.getDate() + delta);
  return result;
}

function timeWindowForItem(item: SchedulingPlanContext["readyContentItems"][number]) {
  const text = `${item.title} ${item.guestBehaviorGoal} ${item.timingIntent} ${item.platform} ${item.format}`.toLowerCase();

  if (text.includes("lunch")) return "11:00 AM–1:00 PM lunch decision window";
  if (text.includes("brunch")) return "9:00 AM–11:00 AM weekend planning window";
  if (text.includes("story")) return "3:00 PM–5:00 PM day-of reminder window";
  if (text.includes("google")) return "9:00 AM–11:00 AM local search window";
  if (text.includes("email")) return "8:00 AM–10:00 AM inbox window";
  if (text.includes("dinner") || text.includes("reservation")) {
    return "4:00 PM–6:00 PM dinner decision window";
  }

  return "12:00 PM–2:00 PM awareness window";
}

function businessGoalForItem(item: SchedulingPlanContext["readyContentItems"][number]) {
  const text = `${item.guestBehaviorGoal} ${item.title} ${item.timingIntent}`.toLowerCase();

  if (text.includes("lunch")) return "Drive weekday lunch visits";
  if (text.includes("brunch")) return "Drive weekend brunch bookings";
  if (text.includes("reserve")) return "Drive reservation clicks";
  if (text.includes("dinner")) return "Increase dinner covers";
  if (text.includes("walk in")) return "Increase walk-ins";
  if (text.includes("return")) return "Bring repeat guests back";

  return "Fill a weak revenue window";
}

function timingReasonForItem(
  item: SchedulingPlanContext["readyContentItems"][number],
  dateKey: string,
  calendarGap?: SchedulingPlanContext["openScheduleGaps"][number]
) {
  const text = `${item.guestBehaviorGoal} ${item.timingIntent}`.toLowerCase();

  if (calendarGap) {
    return clean(
      `${calendarGap.label} is open in the calendar, and this placement lands before guests decide whether to visit.`
    );
  }

  if (text.includes("lunch")) {
    return "This lands before the lunch decision window and gives guests an easy midday option.";
  }

  if (text.includes("brunch")) {
    return "This lands in the weekend planning window when guests are deciding brunch plans.";
  }

  if (text.includes("dinner") || text.includes("reserve")) {
    return "This lands before the dinner decision window so guests can still act on it tonight.";
  }

  if (text.includes("walk in")) {
    return "This lands close enough to service to support walk-in decisions.";
  }

  return `This fills the open schedule spot on ${dateKey} and keeps the campaign moving.`;
}

function reviewChecklistForItem(item: SchedulingPlanContext["readyContentItems"][number]) {
  const checklist = [
    "confirm the asset is ready",
    "confirm the CTA works"
  ];

  if (item.cta.toLowerCase().includes("reserve")) {
    checklist.push("confirm the reservation link opens correctly");
  } else if (item.cta.toLowerCase().includes("directions")) {
    checklist.push("confirm the directions link opens correctly");
  }

  checklist.push("confirm owner approval before publishing");

  return checklist;
}

function sortContentItems(
  items: SchedulingPlanContext["readyContentItems"]
): SchedulingPlanContext["readyContentItems"] {
  const rank = (item: SchedulingPlanContext["readyContentItems"][number]) => {
    const text = `${item.guestBehaviorGoal} ${item.title} ${item.timingIntent} ${item.platform}`.toLowerCase();

    if (text.includes("reservation") || text.includes("reserve")) return 0;
    if (text.includes("dinner")) return 1;
    if (text.includes("lunch")) return 2;
    if (text.includes("brunch")) return 3;
    if (text.includes("walk in")) return 4;
    if (text.includes("repeat")) return 5;
    return 6;
  };

  return [...items].sort((left, right) => rank(left) - rank(right));
}

function chooseRecommendedDate(
  item: SchedulingPlanContext["readyContentItems"][number],
  openScheduleGaps: SchedulingPlanContext["openScheduleGaps"],
  index: number
) {
  const gap = openScheduleGaps[index];

  if (gap?.dateKey) {
    return gap.dateKey;
  }

  const today = new Date();
  const text = `${item.guestBehaviorGoal} ${item.timingIntent} ${item.platform} ${item.format}`.toLowerCase();
  let targetWeekday = 1;

  if (text.includes("saturday") || text.includes("weekend") || text.includes("brunch")) {
    targetWeekday = 6;
  } else if (text.includes("friday")) {
    targetWeekday = 5;
  } else if (text.includes("thursday")) {
    targetWeekday = 4;
  } else if (text.includes("wednesday")) {
    targetWeekday = 3;
  } else if (text.includes("tuesday")) {
    targetWeekday = 2;
  } else if (text.includes("monday") || text.includes("early week")) {
    targetWeekday = 1;
  } else if (text.includes("lunch")) {
    targetWeekday = today.getDay() === 0 ? 1 : today.getDay();
  } else if (text.includes("dinner") || text.includes("reserve")) {
    targetWeekday = 4;
  }

  const baseDate = nextWeekdayDate(today, targetWeekday);
  baseDate.setDate(baseDate.getDate() + index);
  return formatDateKey(baseDate);
}

function confidenceForItem(
  item: SchedulingPlanContext["readyContentItems"][number],
  context: SchedulingPlanContext
): "Low" | "Medium" | "High" {
  const ready = item.assetState.toLowerCase() === "ready" && item.approvalState.toLowerCase() === "approved";
  const hasGap = Boolean(context.openScheduleGaps.length);
  const strongConfidence = context.attributionConfidence.label === "High";

  if (ready && hasGap && strongConfidence) {
    return "High";
  }

  if (ready || hasGap) {
    return "Medium";
  }

  return "Low";
}

function buildPlacement(
  item: SchedulingPlanContext["readyContentItems"][number],
  context: SchedulingPlanContext,
  index: number
): z.infer<typeof schedulingPlacementSchema> {
  const gap = context.openScheduleGaps[index];
  return {
    contentTitle: item.title,
    platform: item.platform,
    format: item.format,
    recommendedDate: chooseRecommendedDate(item, context.openScheduleGaps, index),
    recommendedTimeWindow: timeWindowForItem(item),
    timingReason: timingReasonForItem(item, chooseRecommendedDate(item, context.openScheduleGaps, index), gap),
    businessGoal: businessGoalForItem(item),
    confidence: confidenceForItem(item, context),
    reviewBeforePublishing: reviewChecklistForItem(item)
  };
}

function hasLowData(context: SchedulingPlanContext) {
  return (
    context.attributionConfidence.label === "Low" ||
    context.readyContentItems.length === 0 ||
    context.openScheduleGaps.length === 0
  );
}

export function buildSchedulingPlanContext(context: SchedulingPlanContext) {
  return schedulingPlanContextSchema.parse(context);
}

export function buildSchedulingPlanContextFromInput(input: SchedulingPlanContextInput) {
  return buildSchedulingPlanContext({
    client: input.client,
    selectedCampaign: input.selectedCampaign,
    campaignObjective: input.campaignObjective,
    readyContentItems: input.readyContentItems ?? [],
    currentCalendar: input.currentCalendar,
    openScheduleGaps: input.openScheduleGaps ?? [],
    weakRevenueWindow: input.weakRevenueWindow,
    performanceSignals: input.performanceSignals ?? [],
    attributionConfidence: input.attributionConfidence,
    existingScheduledPosts: input.existingScheduledPosts ?? [],
    businessHours: input.businessHours
  });
}

export function buildFallbackSchedulingPlan(context: SchedulingPlanContext): SchedulingPlanResult {
  const sortedItems = sortContentItems(context.readyContentItems);
  const placements = sortedItems.slice(0, Math.min(4, sortedItems.length)).map((item, index) =>
    buildPlacement(item, context, index)
  );
  const lowData = hasLowData(context);
  const blockerMessage =
    context.readyContentItems.length === 0
      ? "Nothing is ready to schedule yet. Approve the next strong post first, then place it before the next dinner or lunch decision window."
      : lowData
        ? "The schedule is directional right now, so keep it simple and place only the strongest approved items."
        : "The schedule can be filled, but it should stay tied to the strongest guest decision windows.";

  return {
    scheduleSummary: clean(
      context.readyContentItems.length === 0
        ? "Nothing is ready to schedule yet."
        : `This schedule puts the strongest ready content in front of guests before the next revenue windows.`
    ),
    schedulingStrategy: clean(
      context.readyContentItems.length === 0
        ? "Approve one strong item first, then place it before the next guest decision window."
        : "Prioritize dinner and lunch decision windows, then use Stories as day-of reminders."
    ),
    recommendedPlacements: placements,
    scheduleGapsFilled: context.openScheduleGaps.slice(0, placements.length).map((gap) => gap.label),
    risksOrWarnings:
      context.readyContentItems.length === 0
        ? ["No approved content is ready, so there is nothing safe to schedule yet.", blockerMessage]
        : [
            blockerMessage,
            lowData
              ? "Attribution confidence is low, so keep the schedule compact and easy to review."
              : "Do not publish until the asset, CTA, and approval checks are complete."
          ],
    nextOperatorAction:
      context.readyContentItems.length === 0
        ? "Approve the next strong content item, then come back to fill the schedule."
        : "Review the draft placements, confirm the checks, and approve the schedule plan."
  };
}

export function buildSchedulingPlanPrompt(context: SchedulingPlanContext) {
  const systemPrompt = [
    "You are the AI Scheduling Agent for a restaurant marketing OS.",
    "You turn approved or ready content into a reviewable posting plan.",
    "This is a schedule recommendation agent only.",
    "Do not auto-publish.",
    "Do not mutate live schedule data.",
    "Do not create a generic calendar filler.",
    "Return only valid JSON that matches the requested schema."
  ].join(" ");

  const userPrompt = [
    "Generate a revenue-aware scheduling recommendation from the structured context.",
    "Use only approved or ready content items.",
    "Recommend 3 to 5 placements maximum, or fewer if data or content readiness is weak.",
    "Do not schedule unapproved or asset-missing content as publish-ready.",
    "Prioritize guest decision moments, weak revenue windows, campaign goals, content readiness, platform fit, and schedule gaps.",
    "Use restaurant language: dinner decision window, lunch traffic, slow night, covers, reservation clicks, walk-ins, repeat guests, guest reminder.",
    "Do not optimize for random frequency.",
    "Do not make the schedule feel like a generic calendar filler.",
    "For each placement, include contentTitle, platform, format, recommendedDate, recommendedTimeWindow, timingReason, businessGoal, confidence, and reviewBeforePublishing.",
    "Use a real ISO date if the context provides an exact gap; otherwise use plain timing language.",
    "Top of output should be a schedule summary and the next operator action.",
    "If no approved or ready content items exist, return a blocker-focused plan instead of a fake schedule.",
    "Keep the schedule compact and reviewable on mobile.",
    "The output hierarchy must be scheduleSummary, schedulingStrategy, recommendedPlacements, scheduleGapsFilled, risksOrWarnings, nextOperatorAction.",
    "Output schema:",
    JSON.stringify(
      {
        scheduleSummary: "string",
        schedulingStrategy: "string",
        recommendedPlacements: [
          {
            contentTitle: "string",
            platform: "string",
            format: "string",
            recommendedDate: "string",
            recommendedTimeWindow: "string",
            timingReason: "string",
            businessGoal: "string",
            confidence: "Low | Medium | High",
            reviewBeforePublishing: ["string"]
          }
        ],
        scheduleGapsFilled: ["string"],
        risksOrWarnings: ["string"],
        nextOperatorAction: "string"
      },
      null,
      2
    ),
    "Context:",
    JSON.stringify(context, null, 2)
  ].join("\n\n");

  return { systemPrompt, userPrompt };
}

export function formatSchedulingPlanForClipboard(plan: SchedulingPlanResult, clientName?: string) {
  return [
    `${clientName ? `${clientName} - ` : ""}Scheduling Plan`,
    "",
    `Schedule summary: ${plan.scheduleSummary}`,
    `Scheduling strategy: ${plan.schedulingStrategy}`,
    `Next operator action: ${plan.nextOperatorAction}`,
    "",
    "Placements:",
    ...plan.recommendedPlacements.flatMap((placement) => [
      `${placement.contentTitle}`,
      `Platform: ${placement.platform}`,
      `Format: ${placement.format}`,
      `Recommended date: ${placement.recommendedDate}`,
      `Time window: ${placement.recommendedTimeWindow}`,
      `Timing reason: ${placement.timingReason}`,
      `Business goal: ${placement.businessGoal}`,
      `Confidence: ${placement.confidence}`,
      `Review: ${placement.reviewBeforePublishing.join(", ")}`,
      ""
    ]),
    `Schedule gaps filled: ${plan.scheduleGapsFilled.join(", ")}`,
    `Risks or warnings: ${plan.risksOrWarnings.join(", ")}`
  ].join("\n");
}
