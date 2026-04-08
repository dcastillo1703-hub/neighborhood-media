import type { IntegrationConnection, MetaBusinessSuiteConfigStatus } from "@/types";
import { integrationEnv, isIntegrationConfigured } from "@/lib/integrations/config";

export const metaProviderScopes = {
  facebook: ["pages_show_list", "pages_read_engagement"],
  instagram: [
    "instagram_basic",
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

export function getMetaBusinessSuiteConfigStatus(): MetaBusinessSuiteConfigStatus {
  const checks = [
    {
      key: "app-id" as const,
      label: "Meta App ID",
      ready: isIntegrationConfigured(integrationEnv.metaAppId),
      detail: "NEXT_PUBLIC_META_APP_ID"
    },
    {
      key: "app-secret" as const,
      label: "Meta App Secret",
      ready: isIntegrationConfigured(integrationEnv.metaAppSecret),
      detail: "META_APP_SECRET"
    },
    {
      key: "redirect-uri" as const,
      label: "OAuth Redirect URI",
      ready: isIntegrationConfigured(integrationEnv.metaRedirectUri),
      detail: "NEXT_PUBLIC_META_REDIRECT_URI"
    }
  ];
  const missingLabels = checks.filter((check) => !check.ready).map((check) => check.label);
  const ready = missingLabels.length === 0;

  return {
    ready,
    checks,
    missingLabels,
    redirectUri: integrationEnv.metaRedirectUri || undefined,
    nextAction: ready
      ? "Meta login can start. Use Prepare, then Open Meta login."
      : `Add ${missingLabels.join(", ")} before starting Meta login.`
  };
}

export function hasMetaBusinessSuiteConfig() {
  return getMetaBusinessSuiteConfigStatus().ready;
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
  const configStatus = getMetaBusinessSuiteConfigStatus();

  return {
    authorizationUrl: buildMetaAuthorizationUrl(provider, clientId, connection?.id) ?? undefined,
    scopeSummary: getMetaScopeSummary(provider),
    tokenStatus: connection?.setup?.tokenStatus ?? "missing",
    authStatus:
      connection?.setup?.authStatus === "connected"
        ? "connected"
        : configStatus.ready
          ? "preparing"
          : "unconfigured",
    nextAction: configStatus.ready
      ? `Open Meta login, approve ${provider} permissions, and complete the callback wiring.`
      : configStatus.nextAction,
    capabilities: [...metaProviderCapabilities[provider]],
    connectionMode: "meta-business-suite"
  };
}
