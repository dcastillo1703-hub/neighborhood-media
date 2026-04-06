import type { Campaign } from "@/types";

export const ARCHIVED_CAMPAIGN_MARKER = "[[ARCHIVED_CAMPAIGN]]";

export function isArchivedCampaign(campaign: Campaign) {
  return campaign.notes.includes(ARCHIVED_CAMPAIGN_MARKER);
}

export function archiveCampaignRecord(campaign: Campaign) {
  const marker = `${ARCHIVED_CAMPAIGN_MARKER} ${new Date().toISOString()}`;
  const nextNotes = campaign.notes.includes(ARCHIVED_CAMPAIGN_MARKER)
    ? campaign.notes
    : [campaign.notes.trim(), marker].filter(Boolean).join("\n\n");

  return {
    ...campaign,
    status: "Completed" as const,
    notes: nextNotes
  };
}
