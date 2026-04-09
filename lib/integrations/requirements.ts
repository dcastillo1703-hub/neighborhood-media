import { integrationEnv, isIntegrationConfigured } from "@/lib/integrations/config";
import type { IntegrationProvider } from "@/types";

export type IntegrationRequirement = {
  label: string;
  satisfied: boolean;
};

export function getIntegrationRequirements(provider: IntegrationProvider) {
  switch (provider) {
    case "instagram":
      return [
        {
          label: "Meta app ID configured",
          satisfied: isIntegrationConfigured(
            integrationEnv.metaAppId || integrationEnv.instagramAppId
          )
        },
        {
          label: "Instagram business account linked",
          satisfied: false
        }
      ] satisfies IntegrationRequirement[];
    case "facebook":
      return [
        {
          label: "Meta app ID configured",
          satisfied: isIntegrationConfigured(
            integrationEnv.metaAppId || integrationEnv.instagramAppId
          )
        },
        {
          label: "Facebook page connection confirmed",
          satisfied: false
        }
      ] satisfies IntegrationRequirement[];
    case "google-business-profile":
      return [
        {
          label: "GBP account ID configured",
          satisfied: isIntegrationConfigured(integrationEnv.googleBusinessAccountId)
        },
        {
          label: "Location access mapped",
          satisfied: false
        }
      ] satisfies IntegrationRequirement[];
    case "google-analytics":
      return [
        {
          label: "GA4 property configured",
          satisfied: isIntegrationConfigured(integrationEnv.googleAnalyticsPropertyId)
        },
        {
          label: "First website sync completed",
          satisfied: false
        }
      ] satisfies IntegrationRequirement[];
    case "tiktok":
      return [
        {
          label: "TikTok advertiser ID configured",
          satisfied: isIntegrationConfigured(integrationEnv.tikTokAdvertiserId)
        },
        {
          label: "TikTok posting access approved",
          satisfied: false
        }
      ] satisfies IntegrationRequirement[];
    case "reservation-system":
      return [
        {
          label: "Reservation provider selected",
          satisfied: isIntegrationConfigured(integrationEnv.reservationProvider)
        },
        {
          label: "Reservation feed mapping documented",
          satisfied: false
        }
      ] satisfies IntegrationRequirement[];
    default:
      return [] satisfies IntegrationRequirement[];
  }
}
