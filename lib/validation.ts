import { Campaign, DayOfWeek, PlannerItem, Platform, Post, WeeklyMetric } from "@/types";

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Record<string, string> };

type WeeklyMetricDraft = Pick<WeeklyMetric, "weekLabel" | "covers" | "notes" | "campaignAttribution">;
type PlannerDraft = Pick<
  PlannerItem,
  "dayOfWeek" | "platform" | "contentType" | "campaignGoal" | "status" | "caption" | "campaignId"
>;
type PostDraft = Pick<Post, "platform" | "content" | "cta" | "publishDate" | "goal" | "status"> & {
  format?: Post["format"];
  destinationUrl?: string;
  approvalState?: Post["approvalState"];
  publishState?: Post["publishState"];
  assetState?: Post["assetState"];
  linkedTaskId?: string;
  plannerItemId?: string;
  campaignId?: string;
  assetIds?: string[];
};
type CampaignDraft = Pick<
  Campaign,
  "name" | "objective" | "startDate" | "endDate" | "channels" | "notes" | "status"
>;

const validPlatforms: Platform[] = ["Instagram", "Facebook", "Stories", "TikTok", "Email"];
const validDays: DayOfWeek[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];

export function validateWeeklyMetric(input: WeeklyMetricDraft): ValidationResult<WeeklyMetricDraft> {
  const errors: Record<string, string> = {};
  if (!input.weekLabel.trim()) errors.weekLabel = "Week label is required.";
  if (!Number.isFinite(input.covers) || input.covers <= 0) errors.covers = "Covers must be greater than 0.";

  if (Object.keys(errors).length) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      ...input,
      weekLabel: input.weekLabel.trim(),
      notes: input.notes?.trim() || "",
      campaignAttribution: input.campaignAttribution?.trim() || ""
    }
  };
}

export function validatePlannerItem(input: PlannerDraft): ValidationResult<PlannerDraft> {
  const errors: Record<string, string> = {};
  if (!validDays.includes(input.dayOfWeek)) errors.dayOfWeek = "Select a valid day.";
  if (!validPlatforms.includes(input.platform)) errors.platform = "Select a valid platform.";
  if (!input.contentType.trim()) errors.contentType = "Content type is required.";
  if (!input.campaignGoal.trim()) errors.campaignGoal = "Campaign goal is required.";
  if (!input.caption.trim()) errors.caption = "Caption or idea is required.";

  if (Object.keys(errors).length) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      ...input,
      contentType: input.contentType.trim(),
      campaignGoal: input.campaignGoal.trim(),
      caption: input.caption.trim()
    }
  };
}

export function validatePost(input: PostDraft): ValidationResult<PostDraft> {
  const errors: Record<string, string> = {};
  if (!validPlatforms.includes(input.platform)) errors.platform = "Select a valid platform.";
  if ((input.status === "Scheduled" || input.status === "Published") && !input.publishDate) {
    errors.publishDate = "Publish date is required before scheduling.";
  }
  if (!input.goal.trim()) errors.goal = "Goal is required.";
  if (!input.cta.trim()) errors.cta = "CTA is required.";
  if (!input.content.trim()) errors.content = "Post content is required.";

  if (Object.keys(errors).length) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      ...input,
      goal: input.goal.trim(),
      cta: input.cta.trim(),
      content: input.content.trim(),
      assetIds: input.assetIds ?? []
    }
  };
}

export function validateCampaign(input: CampaignDraft): ValidationResult<CampaignDraft> {
  const errors: Record<string, string> = {};
  if (!input.name.trim()) errors.name = "Campaign name is required.";
  if (!input.objective.trim()) errors.objective = "Campaign objective is required.";
  if (!input.startDate) errors.startDate = "Start date is required.";
  if (!input.endDate) errors.endDate = "End date is required.";
  if (!input.channels.length) errors.channels = "Choose at least one channel.";
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    errors.endDate = "End date must be after start date.";
  }

  if (Object.keys(errors).length) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      ...input,
      name: input.name.trim(),
      objective: input.objective.trim(),
      channels: input.channels
        .map((channel) => channel.trim())
        .filter((channel, index, allChannels) => channel.length && allChannels.indexOf(channel) === index),
      notes: input.notes.trim()
    }
  };
}
