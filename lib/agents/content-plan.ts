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
  roleInCampaign: z.string().min(1),
  guestBehaviorGoal: z.string().min(1),
  creativeDirection: z.string().min(1),
  platform: z.string().min(1),
  format: z.string().min(1),
  cta: z.string().min(1),
  timingIntent: z.string().min(1),
  assetNeeded: z.string().min(1),
  nextAction: z.string().min(1),
  successSignal: z.string().min(1)
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
  campaignObjective: z.string().min(1),
  executionFocus: z.string().min(1),
  recommendedSequence: z.array(z.string().min(1)).min(3).max(5),
  measurementFocus: z.string().min(1)
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

function isLowConfidencePlan(context: ContentPlanContext) {
  const strategyConfidence = context.selectedCampaignStrategy.confidenceNote.toLowerCase();
  const opportunityText = `${context.opportunityContext.title} ${context.opportunityContext.evidence} ${context.opportunityContext.whyNow}`.toLowerCase();
  const gapText = [...context.currentContentGaps, ...context.currentScheduleGaps].join(" ").toLowerCase();

  return (
    strategyConfidence.includes("low") ||
    opportunityText.includes("tracking") ||
    opportunityText.includes("reservation link") ||
    gapText.includes("tracking") ||
    gapText.includes("proof") ||
    context.availableAssets.length === 0
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
  const lowConfidence = isLowConfidencePlan(context);

  if (title.includes("reservation")) {
    return {
      topic: "reservation",
      guestBehaviorGoal: "Reserve for dinner",
      cta: "Reserve tonight",
      timing: "Before dinner decision window",
      angle: "reservation confidence",
      lowConfidence
    };
  }

  if (title.includes("lunch")) {
    return {
      topic: "lunch",
      guestBehaviorGoal: "Book lunch or walk in today",
      cta: "Walk in today",
      timing: "Midday decision window",
      angle: "weekday lunch",
      lowConfidence
    };
  }

  if (title.includes("brunch")) {
    return {
      topic: "brunch",
      guestBehaviorGoal: "Reserve brunch",
      cta: "Book brunch",
      timing: "Weekend planning window",
      angle: "weekend brunch",
      lowConfidence
    };
  }

  if (title.includes("dinner") || objective.includes("dinner")) {
    return {
      topic: "dinner",
      guestBehaviorGoal: "Choose this restaurant for dinner tonight",
      cta: "Reserve tonight",
      timing: "Before dinner decision window",
      angle: "dinner decision",
      lowConfidence
    };
  }

  if (objective.includes("repeat") || objective.includes("return")) {
    return {
      topic: "repeat visits",
      guestBehaviorGoal: "Come back this week",
      cta: "Come back this week",
      timing: "Early week awareness",
      angle: "repeat visits",
      lowConfidence
    };
  }

  return {
    topic: "traffic",
    guestBehaviorGoal: lowConfidence ? "Take the first clear guest action" : "Make it easy to visit",
    cta: "Save for later",
    timing: lowConfidence ? "Before the next guest decision window" : "Early week awareness",
    angle: lowConfidence ? "guest action" : "visit intent",
    lowConfidence
  };
}

function basePlanTitle(context: ContentPlanContext) {
  return clean(context.selectedCampaignStrategy.campaign.name || context.selectedCampaign.name);
}

function deriveCampaignObjectiveText(input: ContentPlanContextInput) {
  const text = `${input.opportunityContext.title} ${input.opportunityContext.evidence} ${input.selectedCampaign.objective} ${input.selectedCampaign.name}`.toLowerCase();

  if (text.includes("reservation")) {
    return "Increase dinner reservations by giving guests a clear reason to choose this restaurant before the dinner decision window.";
  }

  if (text.includes("lunch")) {
    return "Increase weekday lunch visits by making the midday choice feel easy and timely.";
  }

  if (text.includes("brunch")) {
    return "Increase weekend brunch bookings by giving guests a clear weekend plan.";
  }

  if (text.includes("repeat") || text.includes("return")) {
    return "Bring repeat guests back this week with one strong reason to return.";
  }

  if (text.includes("dinner")) {
    return "Increase dinner covers by giving guests a clear reason to come in tonight.";
  }

  return "Drive more guest visits with one clear offer and a simple action.";
}

function buildStrategySeed(input: ContentPlanContextInput): CampaignStrategyResult {
  const lowData = (input.performanceSignals ?? []).length === 0 || input.availableAssets?.length === 0;
  const metricToWatch = input.opportunityContext.title.toLowerCase().includes("reservation")
    ? "reservation clicks"
    : input.opportunityContext.title.toLowerCase().includes("traffic")
      ? "menu or reservation page sessions"
      : "covers";

  return {
    priorityLabel: lowData ? "Best next test" : "Execution-first content plan",
    opportunity: {
      title: input.opportunityContext.title,
      evidence: input.opportunityContext.evidence,
      whyNow: input.opportunityContext.whyNow
    },
    campaign: {
      name: input.selectedCampaign.name,
      description: input.selectedCampaign.objective
    },
    objective: deriveCampaignObjectiveText(input),
    expectedImpact: {
      summary: lowData
        ? "This plan should help the restaurant learn which creative gets guests to take action."
        : "This plan should turn the campaign into a clear set of posts that move guests toward the target behavior.",
      metricToWatch
    },
    firstSteps: [],
    successSignals: [],
    ownerExplanation: lowData
      ? "Use this as a simple test plan so the next round of content has a clearer winner."
      : "This is the execution step that turns campaign strategy into actual guest-facing content.",
    confidenceNote: lowData
      ? "Confidence is lower because the inputs are thin, so the plan should be treated as a test."
      : "Confidence is directional because the plan follows the chosen campaign strategy."
  };
}

function buildPlanItems(context: ContentPlanContext): ContentPlanResult["contentPlan"] {
  const theme = inferTheme(context);
  const photoAsset = findReadyAsset(context, "photo");
  const videoAsset = findReadyAsset(context, "video");
  const graphicAsset = findReadyAsset(context, "graphic") ?? findReadyAsset(context);
  const titleLead = context.selectedCampaignStrategy.opportunity.title.includes(context.selectedCampaign.name)
    ? context.selectedCampaign.name
    : context.selectedCampaignStrategy.opportunity.title;

  const reelCreativeDirection =
    theme.topic === "reservation"
      ? "Open with a close-up food or drink shot, cut to the table setting, and end on a dinner-ready moment."
      : theme.topic === "lunch"
        ? "Show the lunch plate, a quick service moment, and a simple reason to come in during the midday rush."
        : theme.topic === "brunch"
          ? "Open with a brunch pour or plate, then show a relaxed table and a clear weekend plan."
          : theme.topic === "repeat visits"
            ? "Show a familiar favorite, a warm service moment, and a simple cue to come back this week."
            : "Open with the most appetizing moment, then show the dining room and end with an easy visit cue.";

  const carouselCreativeDirection =
    theme.topic === "reservation"
      ? "Use slide one for the food hook, slide two for the dining room, and slide three for the reservation reason."
      : theme.topic === "lunch"
        ? "Show the menu entry point, the easiest lunch plate, and a quick reason to make it a weekday plan."
        : theme.topic === "brunch"
          ? "Show the best brunch dishes, the pour, and the group-friendly table vibe."
          : theme.topic === "repeat visits"
            ? "Show the favorite dish, the hospitality moment, and the reason to come back soon."
            : "Show the food, the atmosphere, and the one guest action that closes the loop.";

  const storyCreativeDirection =
    theme.topic === "reservation"
      ? "Keep it simple: one food frame, one short line, and one tap-to-reserve prompt."
      : theme.topic === "lunch"
        ? "Use a quick midday frame and one line that makes lunch feel easy."
        : theme.topic === "brunch"
          ? "Use one strong brunch shot and one weekend-planning line."
          : theme.topic === "repeat visits"
            ? "Use a familiar favorite and a short return-this-week message."
            : "Use one clear frame and one direct guest action.";

  const items: ContentPlanResult["contentPlan"] = [
    {
      title: `${titleLead} Reel: ${theme.topic === "reservation" ? "Easy dinner entry point" : theme.topic === "lunch" ? "Quick weekday lunch plan" : theme.topic === "brunch" ? "Weekend plan for brunch" : theme.topic === "repeat visits" ? "Come back this week" : "Easy guest decision"}`,
      roleInCampaign: theme.lowConfidence
        ? "Creates the first guest-facing moment for this campaign."
        : "Creates awareness before the guest decision window.",
      guestBehaviorGoal: theme.guestBehaviorGoal,
      creativeDirection: reelCreativeDirection,
      platform: "Instagram",
      format: "Reel",
      cta: theme.cta,
      timingIntent: theme.timing,
      assetNeeded: videoAsset
        ? "Ready vertical video clip"
        : theme.topic === "reservation"
          ? "10-second dinner or cocktail clip"
          : theme.topic === "lunch"
            ? "10-second lunch plate or service clip"
            : theme.topic === "brunch"
              ? "10-second brunch pour or plate clip"
              : "10-second food or dining-room clip",
      nextAction: videoAsset
        ? "Edit the ready clip into a short reel and keep the first frame strong."
        : theme.topic === "reservation"
          ? "Shoot two vertical dinner clips before service."
          : theme.topic === "lunch"
            ? "Shoot two vertical lunch clips before the midday rush."
            : theme.topic === "brunch"
              ? "Shoot two vertical brunch clips before weekend service."
              : "Shoot two vertical clips that show the strongest guest moment.",
      successSignal:
        theme.topic === "reservation"
          ? "Reservation clicks increase from the reel"
          : theme.topic === "lunch"
            ? "Lunch visits or clicks increase after the reel runs"
            : theme.topic === "brunch"
              ? "Brunch reservations or walk-ins increase after the reel runs"
              : "Guest actions increase after the reel runs"
    },
    {
      title: `${titleLead} Carousel: ${theme.topic === "reservation" ? "Why tonight works" : theme.topic === "lunch" ? "Why lunch is easy here" : theme.topic === "brunch" ? "Weekend brunch worth planning" : theme.topic === "repeat visits" ? "Favorite dishes worth coming back for" : "Why this visit feels easy"}`,
      roleInCampaign: theme.lowConfidence
        ? "Gives guests the clearest reason to choose the restaurant."
        : "Reinforces the main offer and keeps the campaign story moving.",
      guestBehaviorGoal:
        theme.topic === "reservation"
          ? "Reserve for dinner"
          : theme.topic === "lunch"
            ? "Plan a weekday lunch visit"
            : theme.topic === "brunch"
              ? "Book brunch"
              : theme.topic === "repeat visits"
                ? "Come back this week"
                : "Visit sooner",
      creativeDirection: carouselCreativeDirection,
      platform: "Instagram",
      format: "Carousel",
      cta:
        theme.topic === "reservation"
          ? "Reserve tonight"
          : theme.topic === "lunch"
            ? "Walk in today"
            : theme.topic === "brunch"
              ? "Book brunch"
              : theme.topic === "repeat visits"
                ? "Come back this week"
                : "Save this for later",
      timingIntent:
        theme.topic === "reservation"
          ? "Early week awareness"
          : theme.topic === "lunch"
            ? "Midweek awareness"
            : theme.topic === "brunch"
              ? "Weekend planning window"
              : theme.topic === "repeat visits"
                ? "Early week awareness"
                : "Early week awareness",
      assetNeeded: photoAsset
        ? "Ready food and dining-room photos"
        : theme.topic === "reservation"
          ? "3 vertical photos of the dish, table, and room"
          : theme.topic === "lunch"
            ? "3 vertical lunch photos"
            : theme.topic === "brunch"
              ? "3 brunch photos"
              : "3 strong food and atmosphere photos",
      nextAction: photoAsset
        ? "Select the strongest photos and map the slide order."
        : "Pick the three photos that best tell the campaign story.",
      successSignal:
        theme.topic === "reservation"
          ? "Reservation clicks rise from the carousel"
          : theme.topic === "lunch"
            ? "Lunch page visits or directions taps rise from the carousel"
            : theme.topic === "brunch"
              ? "Brunch reservation clicks rise from the carousel"
              : "Saves or link taps rise from the carousel"
    },
    {
      title: `${titleLead} Story: ${theme.topic === "reservation" ? "Last call to reserve" : theme.topic === "lunch" ? "Lunch reminder" : theme.topic === "brunch" ? "Weekend plan reminder" : theme.topic === "repeat visits" ? "Come back this week" : "Tonight reminder"}`,
      roleInCampaign: "Creates the final reminder before guests make a decision.",
      guestBehaviorGoal:
        theme.topic === "reservation"
          ? "Reserve tonight"
          : theme.topic === "lunch"
            ? "Walk in for lunch"
            : theme.topic === "brunch"
              ? "Book weekend brunch"
              : theme.topic === "repeat visits"
                ? "Come back this week"
                : "Make the visit now",
      creativeDirection: storyCreativeDirection,
      platform: "Instagram",
      format: "Story",
      cta: theme.cta,
      timingIntent: "Day-of reminder",
      assetNeeded: "Story image or short clip with sticker space",
      nextAction: "Add the story to approvals with the strongest guest-facing line.",
      successSignal:
        theme.topic === "reservation"
          ? "Story taps to reserve increase"
          : theme.topic === "lunch"
            ? "Story taps to directions increase"
            : theme.topic === "brunch"
              ? "Story taps to book increase"
              : "Story taps or replies increase"
    }
  ];

  if (graphicAsset && items.length < 5) {
    items.push({
      title: `${titleLead} Google Post: ${theme.topic === "reservation" ? "Directions and dinner" : theme.topic === "lunch" ? "Lunch and directions" : theme.topic === "brunch" ? "Weekend brunch details" : "Visit details"}`,
      roleInCampaign: "Supports the campaign where guests are already looking for a visit decision.",
      guestBehaviorGoal:
        theme.topic === "reservation"
          ? "Tap for directions or reserve"
          : theme.topic === "lunch"
            ? "Tap for directions"
            : theme.topic === "brunch"
              ? "Plan a brunch visit"
              : "Find the restaurant and come in",
      creativeDirection:
        theme.topic === "reservation"
          ? "Show the strongest dish or drink photo with a short visit-focused line."
          : "Use the strongest ready photo and keep the text simple and local.",
      platform: "Google Business Profile",
      format: "Post",
      cta:
        theme.topic === "reservation"
          ? "Get directions"
          : theme.topic === "lunch"
            ? "Get directions"
            : theme.topic === "brunch"
              ? "Plan a visit"
              : "Get directions",
      timingIntent: "Local search window",
      assetNeeded: graphicAsset ? "Ready graphic or menu photo" : "Menu or dining-room photo",
      nextAction: graphicAsset
        ? "Reuse the ready image and adapt it for Google Business."
        : "Choose a strong photo and prep it for Google Business.",
      successSignal:
        theme.topic === "reservation"
          ? "Direction taps or reservation clicks rise from the Google post"
          : theme.topic === "lunch"
            ? "Direction taps rise during the lunch window"
            : theme.topic === "brunch"
              ? "Weekend visit intent rises from the post"
              : "Direction taps rise from the post"
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
  const lowConfidence = isLowConfidencePlan(context);
  const titleBase = basePlanTitle(context);

  return {
    contentPlan,
    planSummary: clean(
      lowConfidence
        ? `This plan uses ${titleBase} to test one clear guest action and learn which creative drives visits.`
        : `This plan turns ${titleBase} into a set of guest-facing posts tied to the campaign objective.`
    ),
    campaignObjective: clean(
      context.selectedCampaign.objective ||
        `Increase visits and reservations with campaign content that fits the guest decision window.`
    ),
    executionFocus: clean(
      lowConfidence
        ? "Lead with one clear guest action, one clear offer, and one simple link."
        : "Lead with the guest decision, then reinforce it with a reminder and a local search touchpoint."
    ),
    recommendedSequence: [
      "Awareness piece early in the week",
      "Main reel before the dinner or lunch decision window",
      "Day-of story reminder",
      "Google Business post for local search"
    ].slice(0, contentPlan.length),
    measurementFocus: clean(
      lowConfidence
        ? "Compare reservation or direction clicks and covers against the prior 4-week baseline."
        : "Compare reservation or direction clicks, saves, and covers against the prior 4-week baseline."
    )
  };
}

export function buildContentPlanPrompt(context: ContentPlanContext) {
  const systemPrompt = [
    "You are the AI Content Operator Agent for a restaurant marketing OS.",
    "You convert campaign strategy into an execution-first restaurant content plan.",
    "This is a planning and operations agent only.",
    "Do not write long-form captions.",
    "Do not schedule posts.",
    "Do not auto-publish content.",
    "Do not claim guaranteed results.",
    "Return only valid JSON that matches the requested schema."
  ].join(" ");

  const userPrompt = [
    "Generate a structured, execution-first restaurant content plan from the structured context.",
    "Turn the selected campaign strategy into 3 to 5 practical content items.",
    "Do not behave like a generic content idea generator.",
    "Each item must feel like something a senior restaurant marketer would hand to a content operator.",
    "Use restaurant language: covers, reservations, dinner traffic, lunch traffic, repeat guests, walk-ins, average check, menu interest, decision moments.",
    "Do not make tracking or proof the main message.",
    "Tracking is allowed only as support inside successSignal or measurementFocus.",
    "No paragraph should be longer than two short sentences.",
    "Each item must include title, roleInCampaign, guestBehaviorGoal, creativeDirection, platform, format, CTA, timingIntent, assetNeeded, nextAction, and successSignal.",
    "Title must be specific and campaign-aware.",
    "RoleInCampaign must explain why the piece exists in the campaign.",
    "guestBehaviorGoal must say what the guest should do.",
    "creativeDirection must describe what the content should show or say.",
    "CTA must be explicit and guest-facing.",
    "timingIntent must describe the moment relative to guest behavior.",
    "assetNeeded must be concrete and realistic.",
    "nextAction must tell the operator exactly what to do next.",
    "successSignal must be measurable or observable.",
    "If the campaign input is weak, still produce useful guest-facing content.",
    "In low-data situations, focus on one clear guest action, one specific offer or menu hook, one measurable link or action, and one short test window.",
    "The output hierarchy must be planSummary, campaignObjective, executionFocus, contentPlan, recommendedSequence, measurementFocus.",
    "Output schema:",
    JSON.stringify(
      {
        contentPlan: [
          {
            title: "string",
            roleInCampaign: "string",
            guestBehaviorGoal: "string",
            creativeDirection: "string",
            platform: "string",
            format: "string",
            cta: "string",
            timingIntent: "string",
            assetNeeded: "string",
            nextAction: "string",
            successSignal: "string"
          }
        ],
        planSummary: "string",
        campaignObjective: "string",
        executionFocus: "string",
        recommendedSequence: ["string"],
        measurementFocus: "string"
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
    `Campaign objective: ${plan.campaignObjective}`,
    `Execution focus: ${plan.executionFocus}`,
    `Measurement focus: ${plan.measurementFocus}`,
    "",
    "Recommended sequence:",
    ...plan.recommendedSequence.map((item) => `- ${item}`),
    "",
    ...plan.contentPlan.flatMap((item) => [
      `${item.title}`,
      `Role in campaign: ${item.roleInCampaign}`,
      `Guest behavior goal: ${item.guestBehaviorGoal}`,
      `Creative direction: ${item.creativeDirection}`,
      `Platform: ${item.platform}`,
      `Format: ${item.format}`,
      `CTA: ${item.cta}`,
      `Timing: ${item.timingIntent}`,
      `Asset needed: ${item.assetNeeded}`,
      `Next action: ${item.nextAction}`,
      `Success signal: ${item.successSignal}`,
      ""
    ])
  ].join("\n");
}

export type { CampaignStrategyResult };
