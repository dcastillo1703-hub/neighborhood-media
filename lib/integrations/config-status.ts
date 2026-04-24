export type IntegrationRuntimeContext = {
  appUrl?: string;
  appOrigin?: string;
  appHost?: string;
  environment: "local" | "deployed";
};

function normalizeHost(host: string) {
  return host.trim().toLowerCase().replace(/:\d+$/, "");
}

export function isLocalHost(host?: string | null) {
  if (!host) {
    return false;
  }

  const normalized = normalizeHost(host);

  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized.endsWith(".local")
  );
}

export function getIntegrationRuntimeContext(appUrl?: string): IntegrationRuntimeContext {
  if (!appUrl) {
    return {
      appUrl,
      environment: process.env.NODE_ENV === "development" ? "local" : "deployed"
    };
  }

  try {
    const parsed = new URL(appUrl);

    return {
      appUrl,
      appOrigin: parsed.origin,
      appHost: parsed.host,
      environment: isLocalHost(parsed.hostname) ? "local" : "deployed"
    };
  } catch {
    return {
      appUrl,
      environment: process.env.NODE_ENV === "development" ? "local" : "deployed"
    };
  }
}
