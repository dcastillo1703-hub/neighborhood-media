import { isIntegrationConfigured, integrationEnv } from "@/lib/integrations/config";
import {
  buildMetaSetupState,
  getMetaConnectLabel,
  getMetaScopeSummary
} from "@/lib/integrations/meta";
import { IntegrationAdapter } from "@/lib/integrations/types";

export const facebookAdapter: IntegrationAdapter = {
  provider: "facebook",
  description: "Meta Business Suite adapter for Facebook Page publishing and page-level reporting.",
  getConnectionGuide() {
    return {
      provider: "facebook",
      title: "Facebook page publishing",
      summary:
        "Connect the restaurant's Facebook Page through Meta Business Suite, then unlock scheduled posting and page-level reporting.",
      connectLabel: getMetaConnectLabel("facebook"),
      steps: [
        "Set NEXT_PUBLIC_META_APP_ID and NEXT_PUBLIC_META_REDIRECT_URI.",
        "Log into Meta and approve page publishing permissions.",
        "Map the correct Facebook Page before enabling scheduled posting."
      ],
      scopes: getMetaScopeSummary("facebook").split(", "),
      reportingViews: ["Page reach", "Page engagement", "Campaign-attributed revenue"]
    };
  },
  getConnectionStatus(connection) {
    const hasMetaConfig =
      isIntegrationConfigured(integrationEnv.metaAppId) &&
      isIntegrationConfigured(integrationEnv.metaRedirectUri);
    const hasConnectedPage =
      connection?.setup?.authStatus === "connected" &&
      Boolean(connection.setup?.externalAccountId);

    if (hasConnectedPage) {
      return {
        provider: "facebook",
        status: "success",
        message: "Facebook Page is connected through Meta and ready for publishing and sync."
      };
    }

    return {
      provider: "facebook",
      status: "blocked",
      message: hasMetaConfig
        ? "Meta app is configured. Complete Facebook Page login to activate publishing."
        : "Add Meta app credentials and redirect URI to enable Facebook connection."
    };
  },
  async sync(_job, connection) {
    return {
      ...this.getConnectionStatus(connection),
      setup: {
        ...buildMetaSetupState("facebook", connection?.clientId ?? "", connection),
        lastCheckedAt: new Date().toISOString()
      }
    };
  },
  async connect(connection) {
    return {
      ...this.getConnectionStatus(connection),
      setup: buildMetaSetupState("facebook", connection?.clientId ?? "", connection)
    };
  },
  async publish(_post, connection) {
    const hasMetaConfig =
      isIntegrationConfigured(integrationEnv.metaAppId) &&
      isIntegrationConfigured(integrationEnv.metaRedirectUri);
    const isConnected =
      connection?.setup?.authStatus === "connected" &&
      Boolean(connection.setup?.externalAccountId);

    if (isConnected) {
      return {
        provider: "facebook",
        status: "success",
        message:
          "Facebook publish adapter is ready for Graph API Page publishing once live token handling is wired."
      };
    }

    return {
      provider: "facebook",
      status: "blocked",
      message: hasMetaConfig
        ? "Finish Meta Page connection before attempting live Facebook publishing."
        : "Add Meta app credentials and redirect URI before attempting Facebook publishing."
    };
  }
};
