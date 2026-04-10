import { isIntegrationConfigured, integrationEnv } from "@/lib/integrations/config";
import { IntegrationAdapter } from "@/lib/integrations/types";

export const googleAnalyticsAdapter: IntegrationAdapter = {
  provider: "google-analytics",
  description: "GA4 adapter for website traffic, source mix, and landing-page reporting.",
  getConnectionGuide() {
    return {
      provider: "google-analytics",
      title: "GA4 attribution sync",
      summary:
        "Connect the GA4 property through a service account, then pull website sessions, views, and top pages into the app.",
      connectLabel: "Prepare GA4",
      steps: [
        "Set GOOGLE_ANALYTICS_PROPERTY_ID and the service account credentials.",
        "Grant the service account viewer access to the GA4 property.",
        "Sync website traffic and top-page data into the app."
      ],
      reportingViews: ["Sessions", "Users", "Top sources", "Landing pages"]
    };
  },
  getConnectionStatus(connection) {
    const hasProperty = isIntegrationConfigured(integrationEnv.googleAnalyticsPropertyId);
    const isConnected =
      connection?.setup?.authStatus === "connected" &&
      Boolean(connection.setup?.externalAccountId);

    return {
      provider: "google-analytics",
      status: isConnected ? "success" : "blocked",
      message: isConnected
        ? "GA4 is connected and ready to sync website sessions, views, and source mix."
        : hasProperty
          ? "GA4 property is configured. Finish the service-account sync to bring website traffic into the app."
          : "Add the GA4 property ID to begin wiring website reporting."
    };
  },
  async sync(_job, connection) {
    return {
      ...this.getConnectionStatus(connection),
      setup: {
        ...connection?.setup,
        lastCheckedAt: new Date().toISOString()
      }
    };
  }
};
