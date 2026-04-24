import { z } from "zod";

const proofSignalSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  detail: z.string().min(1)
});

const campaignSummarySchema = z.object({
  id: z.string().nullable(),
  name: z.string().min(1),
  status: z.string().min(1),
  objective: z.string().min(1),
  revenue: z.number(),
  covers: z.number(),
  tables: z.number(),
  nextMove: z.string().nullable()
});

export const campaignStrategyContextSchema = z.object({
  client: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    segment: z.string().min(1),
    location: z.string().min(1)
  }),
  revenueTrend: z.object({
    currentMonthLabel: z.string().nullable(),
    previousMonthLabel: z.string().nullable(),
    currentMonthRevenue: z.number(),
    previousMonthRevenue: z.number(),
    revenueDelta: z.number(),
    revenueDeltaPercent: z.number(),
    latestWeekRevenue: z.number(),
    latestWeekCovers: z.number(),
    latestWeekDelta: z.number(),
    latestWeekDeltaPercent: z.number()
  }),
  opportunityWindow: proofSignalSchema,
  attributionConfidence: z.object({
    label: z.enum(["High", "Medium", "Low"]),
    detail: z.string().min(1)
  }),
  campaignProof: z.array(campaignSummarySchema),
  contentGaps: z.array(z.string().min(1)),
  schedulingGaps: z.array(z.string().min(1)),
  activeCampaigns: z.array(campaignSummarySchema),
  currentNextActions: z.array(z.string().min(1)),
  supportingSignals: z.array(proofSignalSchema)
});

export const campaignStrategyResultSchema = z.object({
  priorityLabel: z.string().min(1),
  opportunity: z.object({
    title: z.string().min(1),
    evidence: z.string().min(1),
    whyNow: z.string().min(1)
  }),
  campaign: z.object({
    name: z.string().min(1),
    description: z.string().min(1)
  }),
  objective: z.string().min(1),
  expectedImpact: z.object({
    summary: z.string().min(1),
    metricToWatch: z.string().min(1)
  }),
  firstSteps: z.array(z.string().min(1)),
  successSignals: z.array(z.string().min(1)),
  ownerExplanation: z.string().min(1),
  confidenceNote: z.string().min(1)
});

export type CampaignStrategyContext = z.infer<typeof campaignStrategyContextSchema>;
export type CampaignStrategyResult = z.infer<typeof campaignStrategyResultSchema>;

export function buildCampaignStrategyContext(context: CampaignStrategyContext) {
  return campaignStrategyContextSchema.parse(context);
}

export function buildCampaignStrategyPrompt(context: CampaignStrategyContext) {
  const systemPrompt = [
    "You are the AI Campaign Strategist Agent for a restaurant marketing OS.",
    "You turn performance insights into one clear campaign recommendation.",
    "This is a strategy and planning agent only.",
    "Do not claim guaranteed revenue impact.",
    "Do not invent execution details that are not in the context.",
    "Return only valid JSON that matches the requested schema."
  ].join(" ");

  const userPrompt = [
    "Generate one specific, revenue-aware campaign recommendation from the structured context.",
    "Choose the single highest-leverage opportunity only.",
    "Do not output generic labels like Monday, Focused Traffic Campaign, or vague directional language.",
    "Opportunity.title must name the business problem as specifically as the data allows.",
    "If daypart is not available, use the day plus the revenue problem, such as weakest revenue window, softest recurring night, or reservation clicks not turning into covers.",
    "Opportunity.evidence must reference the data used: weak revenue window, period comparison, campaign proof, content gaps, scheduling gaps, or attribution confidence.",
    "Opportunity.whyNow must explain why this is the next move, not just a possible idea.",
    "Campaign.name must sound like a real campaign a restaurant marketer would actually present.",
    "Campaign.description must be one sentence only.",
    "Objective must be measurable or behavior-based.",
    "ExpectedImpact.summary must stay directional but concrete and state what should improve.",
    "ExpectedImpact.metricToWatch must name one primary metric only.",
    "First steps must be 3 to 5 specific execution steps tied to content, scheduling, and tracking.",
    "Success signals must be 3 to 5 measurable indicators.",
    "OwnerExplanation must be plain language a restaurant owner would understand in a live conversation.",
    "ConfidenceNote must be honest about whether this is a test, not a guarantee.",
    "Use restaurant language: covers, dinner traffic, repeat visits, reservations, weekday lift, average check, slow night, revenue window.",
    "Use short lines. No paragraph should run longer than two short sentences.",
    "Do not use jargon like attribution layer, signal quality, or contribution layer.",
    "Frame the idea as a test or hypothesis, not a guarantee.",
    "If the data is weak or incomplete, do not produce a generic campaign. Shift to proof-building recommendations like Tracking Clean-Up Campaign, Reservation Link Test, or Content Proof Sprint.",
    "The output hierarchy must be: priorityLabel, opportunity, campaign, objective, expectedImpact, firstSteps, successSignals, ownerExplanation, confidenceNote.",
    "Top of card should read clearly on mobile and feel client-ready.",
    "Output schema:",
    JSON.stringify(
      {
        priorityLabel: "string",
        opportunity: {
          title: "string",
          evidence: "string",
          whyNow: "string"
        },
        campaign: {
          name: "string",
          description: "string"
        },
        objective: "string",
        expectedImpact: {
          summary: "string",
          metricToWatch: "string"
        },
        firstSteps: ["string"],
        successSignals: ["string"],
        ownerExplanation: "string",
        confidenceNote: "string"
      },
      null,
      2
    ),
    "Context:",
    JSON.stringify(context, null, 2)
  ].join("\n\n");

  return { systemPrompt, userPrompt };
}

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function inferCampaignName(opportunity: string, context: CampaignStrategyContext) {
  const lower = opportunity.toLowerCase();
  const combined = [opportunity, context.opportunityWindow.detail, ...context.currentNextActions].join(" ").toLowerCase();

  if (combined.includes("reservation") || combined.includes("book")) return "Reservation-to-Covers Push";
  if (combined.includes("tracking") || context.attributionConfidence.label === "Low") {
    return "Tracking Clean-Up Campaign";
  }
  if (combined.includes("proof")) return "Content Proof Sprint";
  if (lower.includes("brunch")) return "Brunch Lift Campaign";
  if (lower.includes("lunch")) return "Lunch Visibility Campaign";
  if (lower.includes("dinner")) return "Dinner Recovery Push";
  if (lower.includes("midweek") || lower.includes("wednesday") || lower.includes("tuesday")) {
    return "Midweek Revenue Lift";
  }
  if (lower.includes("weekend")) return "Weekend Revenue Push";

  return `${context.opportunityWindow.label} Revenue Recovery Push`;
}

function inferPriorityLabel(context: CampaignStrategyContext) {
  if (context.attributionConfidence.label === "Low" || context.campaignProof.length === 0) {
    return "Best proof-building move";
  }

  if (context.revenueTrend.revenueDelta < 0 || context.revenueTrend.latestWeekDelta < 0) {
    return "Top revenue opportunity";
  }

  return "Best next test";
}

function inferOpportunityTitle(context: CampaignStrategyContext) {
  const day = clean(context.opportunityWindow.label);
  const detail = `${context.opportunityWindow.detail} ${context.supportingSignals.map((signal) => signal.detail).join(" ")}`.toLowerCase();

  if (detail.includes("reservation")) {
    return `${day} reservation clicks are not turning into enough covers`;
  }

  if (detail.includes("traffic")) {
    return `${day} traffic is the weakest revenue window`;
  }

  if (detail.includes("covers")) {
    return `${day} covers are the weakest recurring revenue window`;
  }

  if (detail.includes("revenue")) {
    return `${day} is the weakest recurring revenue window`;
  }

  return `${day} is the weakest recurring revenue window`;
}

function inferExpectedMetric(opportunityTitle: string, context: CampaignStrategyContext) {
  const lower = opportunityTitle.toLowerCase();

  if (lower.includes("reservation")) return "reservation clicks";
  if (lower.includes("traffic")) return "menu or reservation page sessions";
  if (lower.includes("covers")) return "covers";
  if (context.attributionConfidence.label === "Low") return "attribution confidence";

  return "covers";
}

function buildFirstSteps(context: CampaignStrategyContext, opportunityTitle: string) {
  const day = clean(context.opportunityWindow.label);
  const lower = opportunityTitle.toLowerCase();
  const contentFocus =
    lower.includes("reservation")
      ? "one tagged reservation link"
      : lower.includes("traffic")
        ? "three content items around the menu and the slow night"
        : lower.includes("covers")
          ? "one offer and three content touchpoints"
          : "one clear message and three supporting posts";

  return [
    `Create ${contentFocus} tied to ${day}.`,
    context.contentGaps[0] ?? "Fill the clearest content gap so the campaign has a real message to push.",
    context.schedulingGaps[0] ?? "Schedule the posts before the guest decision window for that day.",
    context.currentNextActions[0] ?? "Use one tagged link so traffic can be tied back to the campaign.",
    `Compare ${day} covers against the prior 4 ${day}s.`
  ]
    .filter(Boolean)
    .map(clean)
    .slice(0, 5);
}

function buildSuccessSignals(context: CampaignStrategyContext, metricToWatch: string, opportunityTitle: string) {
  const day = clean(context.opportunityWindow.label);
  const lower = opportunityTitle.toLowerCase();
  const metricLabel = metricToWatch.replace(/^\w/, (char) => char.toUpperCase());

  const baseSignals = [
    lower.includes("reservation")
      ? `${day} reservation clicks increase from tagged campaign links`
      : `${day} covers increase vs the prior 4-${day} baseline`,
    lower.includes("traffic")
      ? "Menu or reservation page sessions increase from the campaign"
      : `${metricLabel} moves in the right direction`,
    `The next performance read shows a cleaner link between the campaign and revenue`
  ];

  if (context.attributionConfidence.label !== "Low") {
    baseSignals.push(`Attribution confidence stays ${context.attributionConfidence.label.toLowerCase()} or improves`);
  }

  return baseSignals.slice(0, 5);
}

export function buildFallbackCampaignStrategy(
  context: CampaignStrategyContext
): CampaignStrategyResult {
  const opportunityTitle = inferOpportunityTitle(context);
  const campaignName = inferCampaignName(opportunityTitle, context);
  const topCampaign = context.campaignProof[0] ?? context.activeCampaigns[0];
  const metricToWatch = inferExpectedMetric(opportunityTitle, context);
  const priorityLabel = inferPriorityLabel(context);
  const ownerExplanation =
    context.attributionConfidence.label === "Low"
      ? "We should treat this as a proof-building test first, because the tracking is still too thin to overread the result. The job is to create a cleaner signal next month."
      : `We have one clear place to push for a lift instead of spreading effort across the whole calendar. If this test works, it should be easier to show the guest response and the revenue result.`;

  return {
    priorityLabel,
    opportunity: {
      title: opportunityTitle,
      evidence: clean(
        `Based on ${context.opportunityWindow.label} being the softest recurring revenue window at ${context.opportunityWindow.value}.`
      ),
      whyNow: clean(
        context.attributionConfidence.label === "Low"
          ? "This is the next move because the current proof is thin and the best use of the next campaign is to create cleaner tracking."
          : `This is the next move because it targets the clearest revenue gap without changing the whole calendar.`
      )
    },
    campaign: {
      name: campaignName,
      description: `Run a focused test against ${context.opportunityWindow.label.toLowerCase()} with one message, one tagged link, and a clear timing window.`
    },
    objective: clean(
      topCampaign && topCampaign.revenue > 0
        ? `Increase ${context.opportunityWindow.label} covers by testing one clear offer and three scheduled content touchpoints.`
        : `Turn ${context.opportunityWindow.label.toLowerCase()} traffic into more covers with one focused campaign.`
    ),
    expectedImpact: {
      summary: clean(
        context.attributionConfidence.label === "Low"
          ? `If the test works, we should get a cleaner proof point and a better read on what drives ${context.opportunityWindow.label.toLowerCase()} revenue.`
          : `If the campaign works, we should see stronger ${context.opportunityWindow.label.toLowerCase()} reservation intent and more covers.`
      ),
      metricToWatch
    },
    firstSteps: buildFirstSteps(context, opportunityTitle),
    successSignals: buildSuccessSignals(context, metricToWatch, opportunityTitle),
    ownerExplanation,
    confidenceNote: clean(
      context.attributionConfidence.label === "Low"
        ? "This is a proof-building test, not a revenue guarantee. Confidence stays low until tracking and linked campaign evidence get cleaner."
        : `This is a test, not a guarantee. Confidence is ${context.attributionConfidence.label.toLowerCase().toLowerCase()} because ${context.attributionConfidence.detail.toLowerCase()}`
    )
  };
}

export function formatCampaignStrategyForClipboard(
  strategy: CampaignStrategyResult,
  clientName?: string
) {
  return [
    `${clientName ? `${clientName} - ` : ""}Campaign Strategy`,
    "",
    `Priority: ${strategy.priorityLabel}`,
    `Opportunity: ${strategy.opportunity.title}`,
    `Evidence: ${strategy.opportunity.evidence}`,
    `Why now: ${strategy.opportunity.whyNow}`,
    `Campaign: ${strategy.campaign.name}`,
    `Objective: ${strategy.objective}`,
    "",
    `Expected impact: ${strategy.expectedImpact.summary}`,
    `Metric to watch: ${strategy.expectedImpact.metricToWatch}`,
    `Owner explanation: ${strategy.ownerExplanation}`,
    `Confidence: ${strategy.confidenceNote}`,
    "",
    "First steps:",
    ...strategy.firstSteps.map((item) => `- ${item}`),
    "",
    "Success signals:",
    ...strategy.successSignals.map((item) => `- ${item}`)
  ].join("\n");
}
