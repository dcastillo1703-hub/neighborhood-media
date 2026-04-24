import { z } from "zod";

import { campaignStrategyResultSchema, type CampaignStrategyResult } from "@/lib/agents/campaign-strategy";

const proofSignalSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  detail: z.string().min(1)
});

const assetSummarySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: z.string().min(1),
  assetType: z.string().min(1)
});

const selectedCampaignSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  objective: z.string().min(1),
  status: z.string().min(1)
});

const contentPlanItemSchema = z.object({
  title: z.string().min(1),
  goal: z.string().min(1),
  message: z.string().min(1),
  platform: z.string().min(1),
  format: z.string().min(1),
  cta: z.string().min(1),
  timingIntent: z.string().min(1),
  assetStatus: z.string().min(1),
  nextAction: z.string().min(1)
});

export const contentPlanContextSchema = z.object({
  client: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    segment: z.string().min(1),
    location: z.string().min(1)
  }),
  selectedCampaign: selectedCampaignSchema,
  selectedCampaignStrategy: campaignStrategyResultSchema,
  opportunityContext: z.object({
    title: z.string().min(1),
    evidence: z.string().min(1),
    whyNow: z.string().min(1)
  }),
  performanceSignals: z.array(proofSignalSchema),
  currentContentGaps: z.array(z.string().min(1)),
  currentScheduleGaps: z.array(z.string().min(1)),
  availableAssets: z.array(assetSummarySchema)
});

export const contentPlanResultSchema = z.object({
  contentPlan: z.array(contentPlanItemSchema).min(3).max(5),
  planSummary: z.string().min(1),
  executionFocus: z.string().min(1)
});

export type ContentPlanContext = z.infer<typeof contentPlanContextSchema>;
export type ContentPlanResult = z.infer<typeof contentPlanResultSchema>;
export type ContentPlanContextInput = {
  client: ContentPlanContext["client"];
  selectedCampaign: ContentPlanContext["selectedCampaign"];
  selectedCampaignStrategy?: CampaignStrategyResult | null;
  opportunityContext: ContentPlanContext["opportunityContext"];
  performanceSignals?: ContentPlanContext["performanceSignals"];
  currentContentGaps?: ContentPlanContext["currentContentGaps"];
  currentScheduleGaps?: ContentPlanContext["currentScheduleGaps"];
  availableAssets?: ContentPlanContext["availableAssets"];
};

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function hasProofBuildSignals(context: ContentPlanContext) {
  const strategyConfidence = context.selectedCampaignStrategy.confidenceNote.toLowerCase();
  const opportunityText = `${context.opportunityContext.title} ${context.opportunityContext.evidence} ${context.opportunityContext.whyNow}`.toLowerCase();
  const gapText = [...context.currentContentGaps, ...context.currentScheduleGaps].join(" ").toLowerCase();

  return (
    strategyConfidence.includes("low") ||
    strategyConfidence.includes("proof") ||
    opportunityText.includes("tracking") ||
    opportunityText.includes("reservation link") ||
    gapText.includes("tracking") ||
    gapText.includes("proof")
  );
}

function findReadyAsset(context: ContentPlanContext, assetType?: string) {
  return context.availableAssets.find((asset) => {
    if (asset.status.toLowerCase() !== "ready") {
      return false;
    }

    if (!assetType) {
      return true;
    }

    return asset.assetType.toLowerCase() === assetType.toLowerCase();
  });
}

function inferTheme(context: ContentPlanContext) {
  const title = `${context.selectedCampaignStrategy.opportunity.title} ${context.selectedCampaign.name}`.toLowerCase();
  const objective = context.selectedCampaign.objective.toLowerCase();
  const proofBuild = hasProofBuildSignals(context);

  if (title.includes("reservation")) {
    return {
      topic: "reservation",
      goal: "increase reservation clicks",
      cta: "Reserve tonight",
      timing: "Before dinner decision window",
      subject: "the reservation decision",
      proofBuild
    };
  }

  if (title.includes("lunch")) {
    return {
      topic: "lunch",
      goal: "drive weekday lunch visits",
      cta: "Walk in today",
      timing: "Midday decision window",
      subject: "the lunch menu",
      proofBuild
    };
  }

  if (title.includes("brunch")) {
    return {
      topic: "brunch",
      goal: "drive weekend brunch visits",
      cta: "Book brunch",
      timing: "Weekend planning window",
      subject: "the brunch table",
      proofBuild
    };
  }

  if (title.includes("dinner") || objective.includes("dinner")) {
    return {
      topic: "dinner",
      goal: "drive dinner covers",
      cta: "Reserve tonight",
      timing: "Before dinner decision window",
      subject: "the dinner seat",
      proofBuild
    };
  }

  if (objective.includes("repeat") || objective.includes("return")) {
    return {
      topic: "repeat visits",
      goal: "reinforce repeat visits",
      cta: "Come back this week",
      timing: "Early week awareness",
      subject: "the repeat guest",
      proofBuild
    };
  }

  return {
    topic: "traffic",
    goal: proofBuild ? "build trackable proof" : "drive more guest traffic",
    cta: proofBuild ? "Tap the tagged link" : "Save for later",
    timing: proofBuild ? "Before the next report window" : "Early week awareness",
    subject: proofBuild ? "the tracked action" : "the next visit",
    proofBuild
  };
}

function assetStatusFor(type: string, asset: ReturnType<typeof findReadyAsset> | undefined) {
  if (asset) {
    return "Ready";
  }

  if (type === "video") {
    return "Needs video";
  }

  if (type === "photo") {
    return "Needs photo";
  }

  return "Needs copy";
}

function basePlanTitle(context: ContentPlanContext) {
  return clean(context.selectedCampaignStrategy.campaign.name || context.selectedCampaign.name);
}

function buildStrategySeed(input: ContentPlanContextInput): CampaignStrategyResult {
  const lowData = (input.performanceSignals ?? []).length === 0 || input.availableAssets?.length === 0;
  const metricToWatch = input.opportunityContext.title.toLowerCase().includes("reservation")
    ? "reservation clicks"
    : input.opportunityContext.title.toLowerCase().includes("traffic")
      ? "menu or reservation page sessions"
      : "covers";

  return {
    priorityLabel: lowData ? "Best proof-building move" : "Execution-first content plan",
    opportunity: {
      title: input.opportunityContext.title,
      evidence: input.opportunityContext.evidence,
      whyNow: input.opportunityContext.whyNow
    },
    campaign: {
      name: input.selectedCampaign.name,
      description: input.selectedCampaign.objective
    },
    objective: input.selectedCampaign.objective,
    expectedImpact: {
      summary: lowData
        ? "This plan should create cleaner content proof and a clearer read on what is driving guest response."
        : "This plan should turn the campaign into a trackable set of posts tied to the target behavior.",
      metricToWatch
    },
    firstSteps: [],
    successSignals: [],
    ownerExplanation: lowData
      ? "Treat this as a proof-building content test first so the next report has cleaner evidence."
      : "This is the next operational step after the campaign strategy is chosen.",
    confidenceNote: lowData
      ? "Confidence stays low until content and tracking get cleaner."
      : "Confidence is directional because the plan follows the chosen campaign strategy."
  };
}

function buildPlanItems(context: ContentPlanContext): ContentPlanResult["contentPlan"] {
  const theme = inferTheme(context);
  const titleBase = basePlanTitle(context);
  const photoAsset = findReadyAsset(context, "photo");
  const videoAsset = findReadyAsset(context, "video");
  const graphicAsset = findReadyAsset(context, "graphic") ?? findReadyAsset(context);
  const proofBuild = theme.proofBuild;

  const items: ContentPlanResult["contentPlan"] = [
    {
      title: `${titleBase} Reel`,
      goal: proofBuild ? "Create a trackable guest action" : theme.goal,
      message: clean(
        proofBuild
          ? `Use one clear hook to prove ${theme.subject} is driving action, then send guests to one tagged link.`
          : `Show the clearest reason to try ${titleBase} right now and make the offer easy to act on.`
      ),
      platform: "Instagram",
      format: "Reel",
      cta: theme.cta,
      timingIntent: theme.timing,
      assetStatus: assetStatusFor("video", videoAsset),
      nextAction: videoAsset
        ? "Turn the ready clip into a short reel."
        : `Shoot a ${theme.topic} close-up for the opening frame.`
    },
    {
      title: `${titleBase} Carousel`,
      goal: proofBuild ? "Build cleaner campaign proof" : `Reinforce ${theme.goal}`,
      message: clean(
        proofBuild
          ? "Show the menu proof, the guest action, and the tagged path so the next report is easier to trust."
          : `Show the food, the reason to visit, and the one action that should move ${theme.goal}.`
      ),
      platform: "Instagram",
      format: "Carousel",
      cta: proofBuild ? "Save for later" : "Reserve tonight",
      timingIntent: "Early week awareness",
      assetStatus: assetStatusFor("photo", photoAsset),
      nextAction: photoAsset
        ? "Select the strongest ready photos and map the slide order."
        : "Choose the photos that best support the campaign story."
    },
    {
      title: `${titleBase} Story`,
      goal: proofBuild ? "Track the day-of response" : "Turn interest into a visit",
      message: clean(
        proofBuild
          ? "Push one tagged reminder so clicks can be tied back to the campaign."
          : `Give guests one simple reminder before the ${theme.timing.toLowerCase()} closes.`
      ),
      platform: "Instagram",
      format: "Story",
      cta: proofBuild ? "Tap the link" : "Walk in tonight",
      timingIntent: "Day-of reminder",
      assetStatus: "Needs copy",
      nextAction: "Upload to approvals with the strongest CTA."
    }
  ];

  if (!proofBuild && graphicAsset) {
    items.push({
      title: `${titleBase} Google Business Post`,
      goal: "Capture high-intent local traffic",
      message: clean(
        `Keep the campaign visible where guests look for a quick decision and reinforce the main offer with a local search touchpoint.`
      ),
      platform: "Google Business Profile",
      format: "Post",
      cta: "Get directions",
      timingIntent: "Local search window",
      assetStatus: "Ready",
      nextAction: "Reuse the ready graphic and publish it into Google Business."
    });
  }

  return items.slice(0, 5);
}

export function buildContentPlanContext(context: ContentPlanContext) {
  return contentPlanContextSchema.parse(context);
}

export function buildContentPlanContextFromInput(input: ContentPlanContextInput) {
  return buildContentPlanContext({
    client: input.client,
    selectedCampaign: input.selectedCampaign,
    selectedCampaignStrategy:
      input.selectedCampaignStrategy ?? buildStrategySeed(input),
    opportunityContext: input.opportunityContext,
    performanceSignals: input.performanceSignals ?? [],
    currentContentGaps: input.currentContentGaps ?? [],
    currentScheduleGaps: input.currentScheduleGaps ?? [],
    availableAssets: input.availableAssets ?? []
  });
}

export function buildFallbackContentPlan(context: ContentPlanContext): ContentPlanResult {
  const contentPlan = buildPlanItems(context);
  const proofBuild = hasProofBuildSignals(context);
  const titleBase = basePlanTitle(context);

  return {
    contentPlan,
    planSummary: clean(
      proofBuild
        ? `This plan focuses on proof building for ${titleBase} so the next report has cleaner links between content, traffic, and revenue.`
        : `This plan turns ${titleBase} into a set of trackable content pieces tied to the campaign objective.`
    ),
    executionFocus: clean(
      proofBuild
        ? "Proof first: one tagged link, one clear message, one asset path."
        : "Execution first: one hero post, one proof post, one reminder post."
    )
  };
}

export function buildContentPlanPrompt(context: ContentPlanContext) {
  const systemPrompt = [
    "You are the AI Content Operator Agent for a restaurant marketing OS.",
    "You convert campaign strategy into an execution-first content plan.",
    "This is a planning and operations agent only.",
    "Do not write long-form captions.",
    "Do not schedule posts.",
    "Do not auto-publish content.",
    "Do not claim guaranteed results.",
    "Return only valid JSON that matches the requested schema."
  ].join(" ");

  const userPrompt = [
    "Generate a structured, execution-first content plan from the structured context.",
    "Turn the selected campaign strategy into 3 to 5 content items.",
    "Do not behave like a generic content idea generator.",
    "Each item must feel like something a marketing manager can execute immediately.",
    "Use restaurant language: covers, reservations, dinner traffic, weekday lift, repeat guests.",
    "No paragraph should be longer than two short sentences.",
    "Each item must include title, goal, message, platform, format, CTA, timing intent, asset status, and next action.",
    "Title must be short, specific, and campaign-aware.",
    "Goal must name the behavior being driven.",
    "Message must connect directly to the campaign objective.",
    "CTA must be explicit and actionable.",
    "Timing intent must describe the moment, not a calendar date.",
    "Asset status must be realistic: Ready, Needs photo, Needs video, or Needs copy.",
    "Next action must tell the operator exactly what to do next.",
    "If the campaign input is weak, shift to content proof building.",
    "In low-data situations, use content to test messaging, create trackable links, and improve attribution.",
    "The output hierarchy must be contentPlan, planSummary, executionFocus.",
    "Output schema:",
    JSON.stringify(
      {
        contentPlan: [
          {
            title: "string",
            goal: "string",
            message: "string",
            platform: "string",
            format: "string",
            cta: "string",
            timingIntent: "string",
            assetStatus: "string",
            nextAction: "string"
          }
        ],
        planSummary: "string",
        executionFocus: "string"
      },
      null,
      2
    ),
    "Context:",
    JSON.stringify(context, null, 2)
  ].join("\n\n");

  return { systemPrompt, userPrompt };
}

export function formatContentPlanForClipboard(plan: ContentPlanResult, clientName?: string) {
  return [
    `${clientName ? `${clientName} - ` : ""}Content Plan`,
    "",
    `Plan summary: ${plan.planSummary}`,
    `Execution focus: ${plan.executionFocus}`,
    "",
    ...plan.contentPlan.flatMap((item) => [
      `${item.title}`,
      `Goal: ${item.goal}`,
      `Message: ${item.message}`,
      `Platform: ${item.platform}`,
      `Format: ${item.format}`,
      `CTA: ${item.cta}`,
      `Timing: ${item.timingIntent}`,
      `Asset status: ${item.assetStatus}`,
      `Next action: ${item.nextAction}`,
      ""
    ])
  ].join("\n");
}

export type { CampaignStrategyResult };
