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
  headline: z.string().min(1),
  whatChanged: z.array(z.string().min(1)),
  likelyDrivers: z.array(z.string().min(1)),
  roiRead: z.object({
    confirmedRevenue: z.string().min(1),
    estimatedContribution: z.string().min(1),
    confirmedVsEstimated: z.string().min(1),
    translation: z.string().min(1)
  }),
  attributionConfidenceExplanation: z.object({
    level: attributionConfidenceLevelSchema,
    explanation: z.string().min(1),
    whyItMatters: z.string().min(1)
  }),
  risksOrCaveats: z.array(z.string().min(1)),
  recommendedNextMoves: z.array(
    z.object({
      title: z.string().min(1),
      whyItMatters: z.string().min(1),
      expectedResult: z.string().min(1)
    })
  ),
  clientTalkingPoints: z.array(z.string().min(1))
});

export type PerformanceReadContext = z.infer<typeof performanceReadContextSchema>;
export type PerformanceReadResult = z.infer<typeof performanceReadResultSchema>;

export function buildPerformanceReadContext(context: PerformanceReadContext) {
  return performanceReadContextSchema.parse(context);
}

export function buildPerformanceReadPrompt(context: PerformanceReadContext) {
  const systemPrompt = [
    "You are the AI Performance Analyst Agent for a restaurant marketing OS.",
    "Your job is to review structured performance context, explain what changed, identify likely drivers, translate results into ROI language, explain attribution confidence, call out caveats, recommend next moves, and produce client-facing talking points.",
    "Do not behave like a chatbot.",
    "Do not claim direct causality unless the context explicitly confirms it.",
    "Treat Toast/POS as the source of truth for confirmed business results.",
    "Keep confirmed and estimated values distinct at all times.",
    "Return only valid JSON that matches the requested schema."
  ].join(" ");

  const userPrompt = [
    "Generate a client-ready performance read from the following structured context.",
    "Use only the provided data.",
    "Keep the tone polished, concise, and analyst-like.",
    "Avoid overclaiming. Prefer directional language such as likely, appears to, suggests, or supported by.",
    "Output schema:",
    JSON.stringify(
      {
        headline: "string",
        whatChanged: ["string"],
        likelyDrivers: ["string"],
        roiRead: {
          confirmedRevenue: "string",
          estimatedContribution: "string",
          confirmedVsEstimated: "string",
          translation: "string"
        },
        attributionConfidenceExplanation: {
          level: "High | Medium | Low",
          explanation: "string",
          whyItMatters: "string"
        },
        risksOrCaveats: ["string"],
        recommendedNextMoves: [
          {
            title: "string",
            whyItMatters: "string",
            expectedResult: "string"
          }
        ],
        clientTalkingPoints: ["string"]
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
  const trendWord = context.currentPerformanceSummary.monthRevenueDelta >= 0 ? "improved" : "softened";
  const confidenceLabel = context.attributionConfidence.label;
  const topCampaign = context.topCampaignProof.id ? context.topCampaignProof.name : null;
  const topContent = context.topContentProof.postId ? context.topContentProof.title : null;

  return {
    headline: `${context.client.name} performance ${trendWord} in the latest comparison window`,
    whatChanged: [
      `${context.currentPerformanceSummary.currentMonthLabel ?? "The latest month"} moved ${context.currentPerformanceSummary.monthRevenueDelta >= 0 ? "up" : "down"} ${Math.abs(
        context.currentPerformanceSummary.monthRevenueDelta
      ).toLocaleString()} in confirmed POS revenue versus the prior month.`,
      `Weekly covers changed by ${context.currentPerformanceSummary.latestWeekWowChange >= 0 ? "+" : ""}${context.currentPerformanceSummary.latestWeekWowChange.toLocaleString()} in the latest week.`,
      context.ga4Summary.ready
        ? `Website traffic shows ${context.ga4Summary.sessions.toLocaleString()} sessions and ${context.ga4Summary.actionItems.length} action item(s) still worth tightening.`
        : "Website tracking is still incomplete, so the story leans more heavily on Toast and campaign proof."
    ],
    likelyDrivers: [
      topCampaign
        ? `${topCampaign} is the clearest campaign-level proof point with ${context.topCampaignProof.revenue.toLocaleString()} in estimated contribution.`
        : "Campaign-level proof is still thin, so the story should stay directional.",
      topContent
        ? `${topContent} is the strongest content signal and is tied to ${context.topContentProof.conversions.toLocaleString()} tracked actions.`
        : "Content proof is still emerging and needs more linked snapshots.",
      context.metaSummary.connectedChannels > 0
        ? `${context.metaSummary.connectedChannels.toLocaleString()} connected Meta channel(s) are contributing platform evidence.`
        : "Meta evidence is limited, which lowers confidence in channel-level causality."
    ],
    roiRead: {
      confirmedRevenue: `${context.currentPerformanceSummary.currentMonthRevenue.toLocaleString()} confirmed POS revenue`,
      estimatedContribution: `${context.currentPerformanceSummary.attributedRevenue.toLocaleString()} in estimated contribution`,
      confirmedVsEstimated:
        "Toast confirms the business result; attribution snapshots and platform signals explain likely contribution, but they do not replace confirmed POS revenue.",
      translation: `At ${context.revenueModelAssumptions.averageCheck.toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
      })} average check, the current contribution read translates into a defendable revenue story for client review.`
    },
    attributionConfidenceExplanation: {
      level: confidenceLabel,
      explanation: context.attributionConfidence.detail,
      whyItMatters:
        context.ga4Summary.sourceQuality.notSetSessions > 0 || context.metaSummary.connectedChannels === 0
          ? "The story is usable, but weaker source quality means the next report should avoid hard causality claims."
          : "The available evidence is strong enough to present directionally and defend with confidence."
    },
    risksOrCaveats: [
      ...context.attributionConfidence.support.map((item) => cleanListItem(item)),
      context.ga4Summary.sourceQuality.hasNotSetTraffic
        ? `${context.ga4Summary.sourceQuality.notSetSessions.toLocaleString()} unattributed session(s) still dilute the website signal.`
        : "Website attribution is reasonably clean for the current window.",
      context.metaSummary.connectedChannels > 0
        ? "Platform signals help, but they still need to be framed as supporting evidence rather than proof of causality."
        : "There is not yet enough platform evidence to make a strong channel-level claim."
    ].filter(Boolean),
    recommendedNextMoves: [
      {
        title: context.currentNextActions[0]?.title ?? "Tighten the next best recurring opportunity",
        whyItMatters: context.currentNextActions[0]?.detail ?? "The next move should preserve momentum where the business story is weakest.",
        expectedResult: "A cleaner next test and a more defensible next client update."
      },
      {
        title: context.currentNextActions[1]?.title ?? "Repeat the clearest proof point",
        whyItMatters: context.currentNextActions[1]?.detail ?? "Repeating the clearest proof point strengthens the story around what is actually working.",
        expectedResult: "Stronger campaign proof and better evidence for the next read."
      },
      {
        title: context.currentNextActions[2]?.title ?? "Improve tracking quality",
        whyItMatters: context.currentNextActions[2]?.detail ?? "Better measurement lifts confidence in the next attribution conversation.",
        expectedResult: "A more credible ROI read with fewer caveats."
      }
    ].map((item) => ({
      title: sentenceCase(cleanListItem(item.title)),
      whyItMatters: cleanListItem(item.whyItMatters),
      expectedResult: cleanListItem(item.expectedResult)
    })),
    clientTalkingPoints: [
      `${context.currentPerformanceSummary.currentMonthLabel ?? "The latest period"} was ${context.currentPerformanceSummary.monthRevenueDelta >= 0 ? "up" : "down"} ${Math.abs(
        context.currentPerformanceSummary.monthRevenueDelta
      ).toLocaleString()} in confirmed Toast revenue versus the prior month.`,
      `${context.attributionConfidence.label} attribution confidence means the read is useful, but still reviewed as directional rather than causal proof.`,
      topCampaign
        ? `${topCampaign} is the best campaign proof point right now and should anchor the story in the client update.`
        : "Campaign proof is still developing, so the update should stay conservative about direct impact.",
      topContent
        ? `${topContent} is the strongest content example and helps explain what kind of creative appears to be supporting the result.`
        : "Content proof should be described as emerging rather than fully proven."
    ].map(cleanListItem)
  };
}

export function formatPerformanceReadForClipboard(
  read: PerformanceReadResult,
  clientName?: string
) {
  const lines = [
    `${clientName ? `${clientName} - ` : ""}AI Performance Read`,
    "",
    `Headline: ${read.headline}`,
    "",
    "What changed:",
    ...read.whatChanged.map((item) => `- ${item}`),
    "",
    "Likely drivers:",
    ...read.likelyDrivers.map((item) => `- ${item}`),
    "",
    "ROI read:",
    `- Confirmed: ${read.roiRead.confirmedRevenue}`,
    `- Estimated: ${read.roiRead.estimatedContribution}`,
    `- Translation: ${read.roiRead.translation}`,
    "",
    `Attribution confidence (${read.attributionConfidenceExplanation.level}): ${read.attributionConfidenceExplanation.explanation}`,
    `- Why it matters: ${read.attributionConfidenceExplanation.whyItMatters}`,
    "",
    "Risks / caveats:",
    ...read.risksOrCaveats.map((item) => `- ${item}`),
    "",
    "Recommended next moves:",
    ...read.recommendedNextMoves.map((item) => `- ${item.title}: ${item.expectedResult}`),
    "",
    "Client talking points:",
    ...read.clientTalkingPoints.map((item) => `- ${item}`)
  ];

  return lines.join("\n");
}
