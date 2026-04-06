import { isIntegrationConfigured, integrationEnv } from "@/lib/integrations/config";
import { IntegrationAdapter } from "@/lib/integrations/types";

export const tikTokAdapter: IntegrationAdapter = {
  provider: "tiktok",
  description: "Placeholder adapter for TikTok content stats and future publishing.",
  getConnectionGuide() {
    return {
      provider: "tiktok",
      title: "TikTok publishing and reporting",
      summary: "Set the advertiser/account reference and confirm posting approval before live use.",
      connectLabel: "Prepare TikTok",
      steps: [
        "Set NEXT_PUBLIC_TIKTOK_ADVERTISER_ID.",
        "Confirm whether this client uses business ads, organic posting, or both.",
        "Validate posting eligibility and reporting access."
      ]
    };
  },
  getConnectionStatus(connection) {
    return {
      provider: "tiktok",
      status: connection && isIntegrationConfigured(integrationEnv.tikTokAdvertiserId) ? "success" : "blocked",
      message: "Wire TikTok Business or organic analytics endpoints here when the account is known."
    };
  },
  async sync(_job, connection) {
    return this.getConnectionStatus(connection);
  },
  async connect(connection) {
    return this.getConnectionStatus(connection);
  },
  async publish(_post, connection) {
    return {
      provider: "tiktok",
      status: connection && isIntegrationConfigured(integrationEnv.tikTokAdvertiserId) ? "success" : "blocked",
      message: "Publish scaffold is in place for a future TikTok adapter implementation."
    };
  }
};
