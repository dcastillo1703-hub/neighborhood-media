import { z } from "zod";

const attributionConfidenceLevelSchema = z.enum(["High", "Medium", "Low"]);

const proofSignalSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  detail: z.string().min(1)
});

export const performanceReadContextSchema = z.object({
  client: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    segment: z.string().min(1),
    location: z.string().min(1)
  }),
  currentPerformanceSummary: z.object({
    headline: z.string().min(1),
    narrative: z.string().min(1),
    currentMonthLabel: z.string().nullable(),
    currentMonthRevenue: z.number(),
    previousMonthLabel: z.string().nullable(),
    previousMonthRevenue: z.number(),
    monthRevenueDelta: z.number(),
    monthRevenueDeltaPercent: z.number(),
    latestWeekRevenue: z.number(),
    latestWeekCovers: z.number(),
    latestWeekWowChange: z.number(),
    latestWeekWowChangePercent: z.number(),
    attributedRevenue: z.number(),
    attributedCovers: z.number()
  }),
  priorPeriodComparison: z.object({
    previousRevenue: z.number(),
    currentRevenue: z.number(),
    revenueDelta: z.number(),
    revenueDeltaPercent: z.number(),
    previousCovers: z.number(),
    currentCovers: z.number(),
    coversDelta: z.number()
  }),
  revenueModelAssumptions: z.object({
    averageCheck: z.number(),
    guestsPerTable: z.number(),
    growthTarget: z.number(),
    weeklyRevenue: z.number(),
    monthlyRevenue: z.number(),
    addedMonthlyRevenue: z.number(),
    annualUpside: z.number()
  }),
  attributionConfidence: z.object({
    label: attributionConfidenceLevelSchema,
    detail: z.string().min(1),
    support: z.array(z.string().min(1))
  }),
  toastPosTruth: z.object({
    latestWeekRevenue: z.number(),
    latestWeekCovers: z.number(),
    monthRevenueDelta: z.number(),
    monthRevenueDeltaPercent: z.number(),
    recommendation: z.string().min(1)
  }),
  ga4Summary: z.object({
    ready: z.boolean(),
    periodLabel: z.string().nullable(),
    sessions: z.number(),
    users: z.number(),
    views: z.number(),
    events: z.number(),
    topSource: proofSignalSchema.nullable(),
    topLandingPage: proofSignalSchema.nullable(),
    topIntentSignal: proofSignalSchema.nullable(),
    sourceQuality: z.object({
      topSourceLabel: z.string().nullable(),
      topSourceSessions: z.number().nullable(),
      hasNotSetTraffic: z.boolean(),
      notSetSessions: z.number(),
      notSetShare: z.number()
    }),
    nextAction: z.string().min(1),
    actionItems: z.array(z.string().min(1))
  }),
  metaSummary: z.object({
    ready: z.boolean(),
    connectedChannels: z.number(),
    totalImpressions: z.number(),
    totalClicks: z.number(),
    totalConversions: z.number(),
    totalAttributedRevenue: z.number(),
    totalAttributedCovers: z.number(),
    totalAttributedTables: z.number(),
    highlights: z.array(z.string().min(1)),
    facebookRead: z
      .object({
        source: z.enum(["live", "manual"]),
        label: z.string().min(1),
        impressions: z.number(),
        clicks: z.number(),
        engagement: z.number(),
        periodLabel: z.string().nullable(),
        syncedAt: z.string().nullable()
      })
      .nullable()
  }),
  topCampaignProof: z.object({
    id: z.string().nullable(),
    name: z.string().min(1),
    revenue: z.number(),
    covers: z.number(),
    tables: z.number(),
    detail: z.string().min(1)
  }),
  topContentProof: z.object({
    postId: z.string().nullable(),
    title: z.string().min(1),
    platform: z.string().min(1),
    format: z.string().nullable(),
    campaignName: z.string().nullable(),
    revenue: z.number(),
    covers: z.number(),
    tables: z.number(),
    conversions: z.number(),
    goal: z.string().nullable(),
    cta: z.string().nullable(),
    detail: z.string().min(1)
  }),
  currentNextActions: z.array(
    z.object({
      title: z.string().min(1),
      detail: z.string().min(1)
    })
  )
});

export const performanceReadResultSchema = z.object({
  hero: z.object({
    result: z.string().min(1),
    direction: z.enum(["up", "down", "flat"]),
    summary: z.string().min(1)
  }),
  keyNumbers: z.array(
    z.object({
      label: z.string().min(1),
      value: z.string().min(1)
    })
  ),
  topInsight: z.string().min(1),
  nextMove: z.object({
    title: z.string().min(1),
    whyItMatters: z.string().min(1),
    expectedResult: z.string().min(1)
  }),
  ownerTalkingPoints: z.array(z.string().min(1)),
  caveats: z.array(z.string().min(1))
});

export type PerformanceReadContext = z.infer<typeof performanceReadContextSchema>;
export type PerformanceReadResult = z.infer<typeof performanceReadResultSchema>;

export function buildPerformanceReadContext(context: PerformanceReadContext) {
  return performanceReadContextSchema.parse(context);
}

export function buildPerformanceReadPrompt(context: PerformanceReadContext) {
  const systemPrompt = [
    "You are the AI Performance Analyst Agent for a restaurant marketing OS.",
    "Your job is to produce a polished, client-ready performance summary that feels like a premium SaaS insight layer, not an internal memo.",
    "Do not claim direct causality unless the context explicitly confirms it.",
    "Treat Toast/POS as the source of truth for confirmed business results.",
    "Keep confirmed and estimated values distinct at all times.",
    "Return only valid JSON that matches the requested schema."
  ].join(" ");

  const userPrompt = [
    "Generate a client-ready performance summary from the structured context.",
    "Use only the provided data.",
    "Keep it premium, mobile-first, and easy to scan in under 10 seconds.",
    "Do not use internal phrases like attribution snapshots, contribution layer, or platform signals.",
    "Prefer simple language such as linked campaigns, traffic data, and tracked activity.",
    "Keep each line short. No paragraph should run longer than two lines.",
    "The output hierarchy must be: hero, keyNumbers, topInsight, nextMove, ownerTalkingPoints, caveats.",
    "The hero result must include direction and a number when possible.",
    "The nextMove must be the most dominant actionable item.",
    "Output schema:",
    JSON.stringify(
      {
        hero: {
          result: "string",
          direction: "up | down | flat",
          summary: "string"
        },
        keyNumbers: [
          {
            label: "string",
            value: "string"
          }
        ],
        topInsight: "string",
        nextMove: {
          title: "string",
          whyItMatters: "string",
          expectedResult: "string"
        },
        ownerTalkingPoints: ["string"],
        caveats: ["string"]
      },
      null,
      2
    ),
    "Context:",
    JSON.stringify(context, null, 2)
  ].join("\n\n");

  return { systemPrompt, userPrompt };
}

function sentenceCase(label: string) {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function cleanListItem(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function buildFallbackPerformanceRead(context: PerformanceReadContext): PerformanceReadResult {
  const confidenceLabel = context.attributionConfidence.label;
  const topCampaign = context.topCampaignProof.id ? context.topCampaignProof.name : null;
  const topContent = context.topContentProof.postId ? context.topContentProof.title : null;
  const direction = context.currentPerformanceSummary.monthRevenueDelta > 0 ? "up" : context.currentPerformanceSummary.monthRevenueDelta < 0 ? "down" : "flat";
  const keyNumbers = [
    {
      label: "Confirmed POS revenue",
      value: context.currentPerformanceSummary.currentMonthRevenue.toLocaleString()
    },
    {
      label: "Estimated marketing impact",
      value: context.currentPerformanceSummary.attributedRevenue.toLocaleString()
    },
    {
      label: "Attribution confidence",
      value: confidenceLabel
    },
    {
      label: "Supporting signal",
      value: context.ga4Summary.ready
        ? `${context.ga4Summary.sessions.toLocaleString()} sessions`
        : `${context.currentPerformanceSummary.latestWeekCovers.toLocaleString()} covers`
    }
  ];

  return {
    hero: {
      result: `${context.currentPerformanceSummary.currentMonthLabel ?? "Latest month"} revenue ${direction === "up" ? "rose" : direction === "down" ? "fell" : "held flat"} ${Math.abs(
        context.currentPerformanceSummary.monthRevenueDelta
      ).toLocaleString()} vs last month`,
      direction,
      summary: `Confirmed POS revenue is ${context.currentPerformanceSummary.currentMonthRevenue.toLocaleString()}; estimated marketing impact is ${context.currentPerformanceSummary.attributedRevenue.toLocaleString()}.`
    },
    keyNumbers,
    topInsight: topCampaign
      ? `${topCampaign} is the clearest linked-campaign proof point, with ${context.topCampaignProof.revenue.toLocaleString()} in estimated impact.`
      : "The read is positive for the business, but linked-campaign proof is still thin.",
    nextMove: {
      title: sentenceCase(cleanListItem(context.currentNextActions[0]?.title ?? "Push the softest night")),
      whyItMatters: cleanListItem(context.currentNextActions[0]?.detail ?? "The next move should protect momentum where the business is weakest."),
      expectedResult: "A cleaner test and a more confident next client update."
    },
    ownerTalkingPoints: [
      `${context.currentPerformanceSummary.currentMonthLabel ?? "This month"} was ${direction === "up" ? "up" : direction === "down" ? "down" : "flat"} in confirmed POS revenue versus last month.`,
      `${confidenceLabel} confidence means we can use this read in the room, but we should still keep it directional.`,
      topContent
        ? `${topContent} is the best content example to mention when explaining what seems to be working.`
        : "We still need more linked content before calling out a clear creative winner."
    ].map(cleanListItem),
    caveats: [
      context.ga4Summary.sourceQuality.hasNotSetTraffic
        ? `${context.ga4Summary.sourceQuality.notSetSessions.toLocaleString()} sessions are still unattributed.`
        : "Traffic data is usable for this read.",
      context.metaSummary.connectedChannels > 0
        ? "Meta evidence supports the story, but it is still supporting evidence."
        : "Meta evidence is limited, so keep the channel story conservative."
    ]
  };
}

export function formatPerformanceReadForClipboard(
  read: PerformanceReadResult,
  clientName?: string
) {
  const lines = [
    `${clientName ? `${clientName} - ` : ""}AI Performance Summary`,
    "",
    `Hero: ${read.hero.result}`,
    read.hero.summary,
    "",
    "Key numbers:",
    ...read.keyNumbers.map((item) => `- ${item.label}: ${item.value}`),
    "",
    `Top insight: ${read.topInsight}`,
    "",
    `Next move: ${read.nextMove.title}`,
    `- Why it matters: ${read.nextMove.whyItMatters}`,
    `- Expected result: ${read.nextMove.expectedResult}`,
    "",
    "Talking points:",
    ...read.ownerTalkingPoints.map((item) => `- ${item}`),
    "",
    "Caveats:",
    ...read.caveats.map((item) => `- ${item}`)
  ];

  return lines.join("\n");
}
