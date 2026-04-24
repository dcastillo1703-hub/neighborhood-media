import type { IntegrationConnection, MetaBusinessSuiteConfigStatus } from "@/types";
import { integrationEnv, isIntegrationConfigured } from "@/lib/integrations/config";
import {
  getIntegrationRuntimeContext,
  isLocalHost
} from "@/lib/integrations/config-status";

export const metaProviderScopes = {
  facebook: ["pages_show_list", "pages_read_engagement", "business_management"],
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

export function getMetaBusinessSuiteConfigStatus(appUrl?: string): MetaBusinessSuiteConfigStatus {
  const runtime = getIntegrationRuntimeContext(appUrl);
  const redirectUri = integrationEnv.metaRedirectUri.trim();
  const checks: MetaBusinessSuiteConfigStatus["checks"] = [
    {
      key: "app-id" as const,
      label: "Meta App ID",
      ready: isIntegrationConfigured(integrationEnv.metaAppId),
      status: isIntegrationConfigured(integrationEnv.metaAppId) ? "ready" : "missing",
      envVar: "NEXT_PUBLIC_META_APP_ID",
      detail: isIntegrationConfigured(integrationEnv.metaAppId)
        ? "Meta App ID is available to the server."
        : "NEXT_PUBLIC_META_APP_ID is missing from the deployed server environment."
    },
    {
      key: "app-secret" as const,
      label: "Meta App Secret",
      ready: isIntegrationConfigured(integrationEnv.metaAppSecret),
      status: isIntegrationConfigured(integrationEnv.metaAppSecret) ? "ready" : "missing",
      envVar: "META_APP_SECRET",
      detail: isIntegrationConfigured(integrationEnv.metaAppSecret)
        ? "Meta App Secret is available to the server."
        : "META_APP_SECRET is missing from the deployed server environment."
    },
    {
      key: "redirect-uri" as const,
      label: "OAuth Redirect URI",
      ready: false,
      status: "missing",
      envVar: "NEXT_PUBLIC_META_REDIRECT_URI or META_REDIRECT_URI",
      detail: "NEXT_PUBLIC_META_REDIRECT_URI or META_REDIRECT_URI is missing."
    }
  ];
  const issues: MetaBusinessSuiteConfigStatus["issues"] = [];
  let configuredOrigin: string | undefined;

  if (!checks[0].ready) {
    issues.push({
      code: "missing-env-var",
      label: "Meta App ID is missing",
      detail:
        "NEXT_PUBLIC_META_APP_ID is not present in this server environment, so Meta login cannot start on the deployed app.",
      severity: "error"
    });
  }

  if (!checks[1].ready) {
    issues.push({
      code: "missing-env-var",
      label: "Meta App Secret is missing",
      detail:
        "META_APP_SECRET is not present in this server environment, so the deployed app cannot complete Meta OAuth securely.",
      severity: "error"
    });
  }

  if (!redirectUri) {
    issues.push({
      code: "missing-env-var",
      label: "OAuth Redirect URI is missing",
      detail:
        "The deployed server does not have NEXT_PUBLIC_META_REDIRECT_URI or META_REDIRECT_URI set.",
      severity: "error"
    });
  } else {
    try {
      const parsedRedirectUri = new URL(redirectUri);
      configuredOrigin = parsedRedirectUri.origin;
      const localRedirect = isLocalHost(parsedRedirectUri.hostname);
      const wrongOrigin =
        Boolean(runtime.appOrigin) && parsedRedirectUri.origin !== runtime.appOrigin;

      if (runtime.environment === "deployed" && localRedirect) {
        checks[2] = {
          ...checks[2],
          ready: false,
          status: "invalid",
          detail: `Configured redirect points to ${parsedRedirectUri.origin}, which is local-only and will not work in production.`
        };
        issues.push({
          code: "local-only-config",
          label: "Redirect URI is local-only",
          detail: `The app is running on ${runtime.appOrigin ?? "a deployed host"}, but Meta is still configured to send users back to ${parsedRedirectUri.origin}.`,
          severity: "error"
        });
      } else if (wrongOrigin) {
        checks[2] = {
          ...checks[2],
          ready: false,
          status: "invalid",
          detail: `Configured redirect uses ${parsedRedirectUri.origin}, but this deployment is serving ${runtime.appOrigin}.`
        };
        issues.push({
          code: "wrong-redirect-uri",
          label: "Redirect URI does not match this deployment",
          detail: `Meta is configured for ${parsedRedirectUri.origin}, but this app is currently serving ${runtime.appOrigin}. Update the redirect URI in the environment and Meta app settings so they match exactly.`,
          severity: "error"
        });
      } else {
        checks[2] = {
          ...checks[2],
          ready: true,
          status: "ready",
          detail: `Redirect URI is configured for ${parsedRedirectUri.origin}.`
        };
      }
    } catch {
      checks[2] = {
        ...checks[2],
        ready: false,
        status: "invalid",
        detail: "Redirect URI is present but not a valid absolute URL."
      };
      issues.push({
        code: "malformed-redirect-uri",
        label: "Redirect URI is malformed",
        detail:
          "NEXT_PUBLIC_META_REDIRECT_URI must be a full URL, such as https://app.example.com/api/meta-suite/callback.",
        severity: "error"
      });
    }
  }

  const missingLabels = checks.filter((check) => !check.ready).map((check) => check.label);
  const ready = checks.every((check) => check.ready);

  const nextAction =
    issues[0]?.detail ??
    (ready
      ? "Meta login can start. Use Prepare, then Open Meta login."
      : `Add ${missingLabels.join(", ")} before starting Meta login.`);

  return {
    ready,
    environment: runtime.environment,
    checks,
    missingLabels,
    issues,
    redirectUri: redirectUri || undefined,
    configuredOrigin,
    appOrigin: runtime.appOrigin,
    summary: ready
      ? "Meta app credentials are complete for this environment."
      : "Meta app credentials need attention before login can start reliably.",
    nextAction
  };
}

export function hasMetaBusinessSuiteConfig(appUrl?: string) {
  return getMetaBusinessSuiteConfigStatus(appUrl).ready;
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
  connectionId?: string,
  appUrl?: string
) {
  if (!hasMetaBusinessSuiteConfig(appUrl)) {
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
  connection?: IntegrationConnection,
  appUrl?: string
): Partial<NonNullable<IntegrationConnection["setup"]>> {
  const configStatus = getMetaBusinessSuiteConfigStatus(appUrl);

  return {
    authorizationUrl:
      buildMetaAuthorizationUrl(provider, clientId, connection?.id, appUrl) ?? undefined,
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
