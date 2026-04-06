import { isIntegrationConfigured, integrationEnv } from "@/lib/integrations/config";
import { IntegrationAdapter } from "@/lib/integrations/types";

export const googleAnalyticsAdapter: IntegrationAdapter = {
  provider: "google-analytics",
  description: "Placeholder adapter for GA4 acquisition and conversion sync.",
  getConnectionGuide() {
    return {
      provider: "google-analytics",
      title: "GA4 attribution sync",
      summary: "Set the property ID, confirm measurement sources, and validate attribution queries.",
      connectLabel: "Prepare GA4",
      steps: [
        "Set NEXT_PUBLIC_GA4_PROPERTY_ID.",
        "Confirm campaign and content UTM naming conventions.",
        "Validate traffic and conversion query access."
      ]
    };
  },
  getConnectionStatus(connection) {
    return {
      provider: "google-analytics",
      status: connection && isIntegrationConfigured(integrationEnv.googleAnalyticsPropertyId) ? "success" : "blocked",
      message:
        "Wire GA4 Data API queries here to hydrate campaign and content attribution."
    };
  },
  async sync(_job, connection) {
    return this.getConnectionStatus(connection);
  }
};
