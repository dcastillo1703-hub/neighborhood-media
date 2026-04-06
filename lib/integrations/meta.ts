import type { IntegrationConnection } from "@/types";
import { integrationEnv, isIntegrationConfigured } from "@/lib/integrations/config";

export const metaProviderScopes = {
  facebook: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],
  instagram: [
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_insights",
    "pages_show_list"
  ]
} as const;

export const metaProviderCapabilities = {
  facebook: [
    "Schedule Page posts",
    "Read page-level reach and engagement",
    "Sync Page publishing status"
  ],
  instagram: [
    "Schedule Instagram business posts",
    "Read Instagram insights",
    "Sync publish status and performance"
  ]
} as const;

export function hasMetaBusinessSuiteConfig() {
  return (
    isIntegrationConfigured(integrationEnv.metaAppId) &&
    isIntegrationConfigured(integrationEnv.metaRedirectUri)
  );
}

export function getMetaScopeSummary(provider: "facebook" | "instagram") {
  return metaProviderScopes[provider].join(", ");
}

export function getMetaConnectLabel(provider: "facebook" | "instagram") {
  return provider === "facebook"
    ? "Connect Facebook via Meta"
    : "Connect Instagram via Meta";
}

export function buildMetaAuthorizationUrl(
  provider: "facebook" | "instagram",
  clientId: string,
  connectionId?: string
) {
  if (!hasMetaBusinessSuiteConfig()) {
    return null;
  }

  const rawState = JSON.stringify({
    provider,
    clientId,
    connectionId
  });
  const state =
    typeof Buffer !== "undefined"
      ? Buffer.from(rawState).toString("base64url")
      : btoa(rawState).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

  const params = new URLSearchParams({
    client_id: integrationEnv.metaAppId,
    redirect_uri: integrationEnv.metaRedirectUri,
    response_type: "code",
    scope: metaProviderScopes[provider].join(","),
    state
  });

  return `https://www.facebook.com/v23.0/dialog/oauth?${params.toString()}`;
}

export function buildMetaSetupState(
  provider: "facebook" | "instagram",
  clientId: string,
  connection?: IntegrationConnection
): Partial<NonNullable<IntegrationConnection["setup"]>> {
  return {
    authorizationUrl: buildMetaAuthorizationUrl(provider, clientId, connection?.id) ?? undefined,
    scopeSummary: getMetaScopeSummary(provider),
    tokenStatus: connection?.setup?.tokenStatus ?? "missing",
    authStatus:
      connection?.setup?.authStatus === "connected"
        ? "connected"
        : hasMetaBusinessSuiteConfig()
          ? "preparing"
          : "unconfigured",
    nextAction: hasMetaBusinessSuiteConfig()
      ? `Open Meta login, approve ${provider} permissions, and complete the callback wiring.`
      : "Add NEXT_PUBLIC_META_APP_ID and NEXT_PUBLIC_META_REDIRECT_URI before starting Meta connection.",
    capabilities: [...metaProviderCapabilities[provider]],
    connectionMode: "meta-business-suite"
  };
}
