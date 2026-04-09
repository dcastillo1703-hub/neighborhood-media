import type { Campaign } from "@/types";

export type CampaignWebsiteMetadata = {
  landingPath: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
};

export type CampaignMetadata = {
  plainNotes: string;
  defaultView?: string;
  website: CampaignWebsiteMetadata;
};

const metadataLabels = {
  defaultView: "Default workspace view",
  landingPath: "Website landing path",
  utmSource: "Website UTM source",
  utmMedium: "Website UTM medium",
  utmCampaign: "Website UTM campaign"
} as const;

const metadataPrefixes = Object.values(metadataLabels).map((label) => `${label}:`);

function normalizeValue(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function slugifyCampaignName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "campaign";
}

export function parseCampaignMetadata(notes: string | null | undefined): CampaignMetadata {
  const source = notes ?? "";
  const lines = source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const plainNotes: string[] = [];
  let defaultView: string | undefined;
  let landingPath = "";
  let utmSource = "";
  let utmMedium = "";
  let utmCampaign = "";

  lines.forEach((line) => {
    if (line.toLowerCase().startsWith(`${metadataLabels.defaultView.toLowerCase()}:`)) {
      defaultView = normalizeValue(line.split(":").slice(1).join(":"));
      return;
    }

    if (line.toLowerCase().startsWith(`${metadataLabels.landingPath.toLowerCase()}:`)) {
      landingPath = normalizeValue(line.split(":").slice(1).join(":"));
      return;
    }

    if (line.toLowerCase().startsWith(`${metadataLabels.utmSource.toLowerCase()}:`)) {
      utmSource = normalizeValue(line.split(":").slice(1).join(":"));
      return;
    }

    if (line.toLowerCase().startsWith(`${metadataLabels.utmMedium.toLowerCase()}:`)) {
      utmMedium = normalizeValue(line.split(":").slice(1).join(":"));
      return;
    }

    if (line.toLowerCase().startsWith(`${metadataLabels.utmCampaign.toLowerCase()}:`)) {
      utmCampaign = normalizeValue(line.split(":").slice(1).join(":"));
      return;
    }

    if (!metadataPrefixes.some((prefix) => line.startsWith(prefix))) {
      plainNotes.push(line);
    }
  });

  return {
    plainNotes: plainNotes.join("\n\n"),
    defaultView,
    website: {
      landingPath,
      utmSource,
      utmMedium,
      utmCampaign
    }
  };
}

export function composeCampaignMetadata(input: {
  plainNotes?: string;
  defaultView?: string;
  website?: Partial<CampaignWebsiteMetadata>;
}) {
  const lines: string[] = [];

  if (normalizeValue(input.plainNotes)) {
    lines.push(normalizeValue(input.plainNotes));
  }

  if (normalizeValue(input.defaultView)) {
    lines.push(`${metadataLabels.defaultView}: ${normalizeValue(input.defaultView)}`);
  }

  if (normalizeValue(input.website?.landingPath)) {
    lines.push(`${metadataLabels.landingPath}: ${normalizeValue(input.website?.landingPath)}`);
  }

  if (normalizeValue(input.website?.utmSource)) {
    lines.push(`${metadataLabels.utmSource}: ${normalizeValue(input.website?.utmSource)}`);
  }

  if (normalizeValue(input.website?.utmMedium)) {
    lines.push(`${metadataLabels.utmMedium}: ${normalizeValue(input.website?.utmMedium)}`);
  }

  if (normalizeValue(input.website?.utmCampaign)) {
    lines.push(`${metadataLabels.utmCampaign}: ${normalizeValue(input.website?.utmCampaign)}`);
  }

  return lines.join("\n\n").trim();
}

export function getCampaignWebsiteMetadata(campaign: Campaign): CampaignWebsiteMetadata {
  const parsed = parseCampaignMetadata(campaign.notes);

  return {
    landingPath: parsed.website.landingPath,
    utmSource: parsed.website.utmSource || "facebook",
    utmMedium: parsed.website.utmMedium || "social",
    utmCampaign: parsed.website.utmCampaign || slugifyCampaignName(campaign.name)
  };
}
