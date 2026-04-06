import { isIntegrationConfigured, integrationEnv } from "@/lib/integrations/config";
import {
  buildMetaSetupState,
  getMetaConnectLabel,
  getMetaScopeSummary
} from "@/lib/integrations/meta";
import { IntegrationAdapter } from "@/lib/integrations/types";

export const instagramAdapter: IntegrationAdapter = {
  provider: "instagram",
  description: "Meta Business Suite adapter for Instagram publishing and insights sync.",
  getConnectionGuide() {
    return {
      provider: "instagram",
      title: "Instagram business publishing",
      summary:
        "Connect the restaurant's Instagram business account through Meta, then unlock scheduled posting and insights sync.",
      connectLabel: getMetaConnectLabel("instagram"),
      steps: [
        "Set NEXT_PUBLIC_META_APP_ID and NEXT_PUBLIC_META_REDIRECT_URI.",
        "Confirm the Instagram account is a professional account in Meta Business Suite.",
        "Approve content publishing and insights permissions before scheduling live posts."
      ],
      scopes: getMetaScopeSummary("instagram").split(", "),
      reportingViews: ["Post reach", "Instagram clicks", "Campaign-attributed covers"]
    };
  },
  getConnectionStatus(connection) {
    const hasMetaConfig =
      isIntegrationConfigured(integrationEnv.metaAppId) &&
      isIntegrationConfigured(integrationEnv.metaRedirectUri);
    const hasConnectedAccount =
      connection?.setup?.authStatus === "connected" &&
      Boolean(connection.setup?.externalAccountId);

    if (hasConnectedAccount) {
      return {
        provider: "instagram",
        status: "success",
        message: "Instagram business account is connected through Meta and ready for publishing."
      };
    }

    return {
      provider: "instagram",
      status: "blocked",
      message: hasMetaConfig
        ? "Meta app is configured. Complete Instagram login to activate publishing and insights sync."
        : "Add Meta app credentials and redirect URI to enable Instagram connection."
    };
  },
  async sync(_job, connection) {
    return {
      ...this.getConnectionStatus(connection),
      setup: {
        ...buildMetaSetupState("instagram", connection?.clientId ?? "", connection),
        lastCheckedAt: new Date().toISOString()
      }
    };
  },
  async connect(connection) {
    return {
      ...this.getConnectionStatus(connection),
      setup: buildMetaSetupState("instagram", connection?.clientId ?? "", connection)
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
        provider: "instagram",
        status: "success",
        message:
          "Instagram publish adapter is ready for Graph API media publish calls once live token handling is wired."
      };
    }

    return {
      provider: "instagram",
      status: "blocked",
      message: hasMetaConfig
        ? "Finish Meta Instagram connection before attempting live publishing."
        : "Add Meta app credentials and redirect URI before attempting Instagram publishing."
    };
  }
};
