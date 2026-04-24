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
  opportunity: z.string().min(1),
  campaign: z.object({
    name: z.string().min(1),
    description: z.string().min(1)
  }),
  objective: z.string().min(1),
  whyItMatters: z.string().min(1),
  expectedImpact: z.string().min(1),
  firstSteps: z.array(z.string().min(1)),
  successSignals: z.array(z.string().min(1))
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
    "Generate a productized campaign recommendation from the structured context.",
    "Choose one highest-leverage opportunity only.",
    "Keep the language simple and restaurant-friendly.",
    "Use short lines. No paragraph should run longer than two lines.",
    "Do not use jargon like attribution layer or signal quality.",
    "Frame the idea as a test or hypothesis, not a guarantee.",
    "The output hierarchy must be: opportunity, campaign, objective, whyItMatters, expectedImpact, firstSteps, successSignals.",
    "Top of card should read clearly on mobile.",
    "Output schema:",
    JSON.stringify(
      {
        opportunity: "string",
        campaign: {
          name: "string",
          description: "string"
        },
        objective: "string",
        whyItMatters: "string",
        expectedImpact: "string",
        firstSteps: ["string"],
        successSignals: ["string"]
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

function inferCampaignName(opportunity: string) {
  const lower = opportunity.toLowerCase();

  if (lower.includes("brunch")) return "Brunch Lift Campaign";
  if (lower.includes("lunch")) return "Lunch Traffic Push";
  if (lower.includes("dinner")) return "Dinner Cover Push";
  if (lower.includes("midweek") || lower.includes("wednesday") || lower.includes("tuesday")) {
    return "Midweek Lift Campaign";
  }
  if (lower.includes("weekend")) return "Weekend Revenue Push";

  return "Focused Traffic Campaign";
}

export function buildFallbackCampaignStrategy(
  context: CampaignStrategyContext
): CampaignStrategyResult {
  const opportunity = clean(context.opportunityWindow.label);
  const campaignName = inferCampaignName(opportunity);
  const topCampaign = context.campaignProof[0] ?? context.activeCampaigns[0];

  return {
    opportunity,
    campaign: {
      name: campaignName,
      description: `Run a focused test against ${opportunity.toLowerCase()} using linked campaigns, tighter timing, and one clear message.`
    },
    objective: `Lift ${opportunity.toLowerCase()} covers and repeat visits.`,
    whyItMatters:
      topCampaign && topCampaign.revenue > 0
        ? `This is the clearest place to add revenue without changing the whole calendar.`
        : "This is the clearest place to create a measurable lift with the current setup.",
    expectedImpact:
      "A directional improvement in traffic and covers if the test resonates with guests.",
    firstSteps: [
      context.contentGaps[0] ?? "Create one clear message that matches the weak window.",
      context.schedulingGaps[0] ?? "Schedule the posts and reminders where guests are most likely to see them.",
      context.currentNextActions[0] ?? "Tie tracking to the campaign so the result is easy to read."
    ].map(clean),
    successSignals: [
      `${context.revenueTrend.latestWeekCovers.toLocaleString()}+ covers in the target window`,
      "More traffic to the linked campaign pages or posts",
      "A clearer lift versus the prior period in the same daypart"
    ]
  };
}

export function formatCampaignStrategyForClipboard(
  strategy: CampaignStrategyResult,
  clientName?: string
) {
  return [
    `${clientName ? `${clientName} - ` : ""}Campaign Strategy`,
    "",
    `Opportunity: ${strategy.opportunity}`,
    `Campaign: ${strategy.campaign.name}`,
    `Objective: ${strategy.objective}`,
    "",
    `Why it matters: ${strategy.whyItMatters}`,
    `Expected impact: ${strategy.expectedImpact}`,
    "",
    "First steps:",
    ...strategy.firstSteps.map((item) => `- ${item}`),
    "",
    "Success signals:",
    ...strategy.successSignals.map((item) => `- ${item}`)
  ].join("\n");
}
