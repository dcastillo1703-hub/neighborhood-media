import { isIntegrationConfigured, integrationEnv } from "@/lib/integrations/config";
import { IntegrationAdapter } from "@/lib/integrations/types";

export const googleBusinessProfileAdapter: IntegrationAdapter = {
  provider: "google-business-profile",
  description: "Placeholder adapter for location insights and listing update workflows.",
  getConnectionGuide() {
    return {
      provider: "google-business-profile",
      title: "Google Business Profile sync",
      summary: "Connect the GBP account and validate the mapped location before pulling insights.",
      connectLabel: "Prepare GBP",
      steps: [
        "Set NEXT_PUBLIC_GBP_ACCOUNT_ID.",
        "Confirm the correct location is attached to the client account.",
        "Validate location insights and listing sync permissions."
      ]
    };
  },
  getConnectionStatus(connection) {
    return {
      provider: "google-business-profile",
      status: connection && isIntegrationConfigured(integrationEnv.googleBusinessAccountId) ? "success" : "blocked",
      message:
        "Wire Google Business Profile OAuth and location fetch logic here once credentials exist."
    };
  },
  async sync(_job, connection) {
    return this.getConnectionStatus(connection);
  }
};
