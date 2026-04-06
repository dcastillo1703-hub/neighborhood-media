import { facebookAdapter } from "@/lib/integrations/providers/facebook";
import { googleAnalyticsAdapter } from "@/lib/integrations/providers/google-analytics";
import { googleBusinessProfileAdapter } from "@/lib/integrations/providers/google-business-profile";
import { instagramAdapter } from "@/lib/integrations/providers/instagram";
import { reservationSystemAdapter } from "@/lib/integrations/providers/reservation-system";
import { tikTokAdapter } from "@/lib/integrations/providers/tiktok";
import { IntegrationAdapter } from "@/lib/integrations/types";
import { IntegrationProvider } from "@/types";

export const integrationAdapters: Record<IntegrationProvider, IntegrationAdapter> = {
  instagram: instagramAdapter,
  facebook: facebookAdapter,
  "google-business-profile": googleBusinessProfileAdapter,
  "google-analytics": googleAnalyticsAdapter,
  tiktok: tikTokAdapter,
  "reservation-system": reservationSystemAdapter
};

export function getIntegrationAdapter(provider: IntegrationProvider) {
  return integrationAdapters[provider];
}
