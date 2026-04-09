import { createSign } from "crypto";

import { composeIntegrationNotes, parseIntegrationNotes } from "@/lib/domain/integration-notes";
import { integrationEnv } from "@/lib/integrations/config";
import {
  mapAnalyticsSnapshotInsert,
  mapAnalyticsSnapshotRow,
  mapIntegrationConnectionInsert,
  mapIntegrationConnectionRow
} from "@/lib/supabase/mappers";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AnalyticsSnapshot, GoogleAnalyticsSummary, IntegrationConnection } from "@/types";

type GoogleAnalyticsTokenResponse = {
  access_token: string;
};

type RunReportRow = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};

type RunReportResponse = {
  rows?: RunReportRow[];
};

type GoogleAnalyticsSyncResult = {
  syncedAt: string;
  propertyId: string;
  snapshot: AnalyticsSnapshot;
  topSources: GoogleAnalyticsSummary["topSources"];
  topPages: GoogleAnalyticsSummary["topPages"];
};

function getGoogleAnalyticsConfig() {
  const propertyId = integrationEnv.googleAnalyticsPropertyId;
  const clientEmail = process.env.GOOGLE_ANALYTICS_CLIENT_EMAIL ?? "";
  const privateKey = process.env.GOOGLE_ANALYTICS_PRIVATE_KEY?.replace(/\\n/g, "\n") ?? "";

  return {
    propertyId,
    clientEmail,
    privateKey
  };
}

function buildGoogleAnalyticsChecks(): GoogleAnalyticsSummary["checks"] {
  const config = getGoogleAnalyticsConfig();

  return [
    {
      key: "property-id",
      label: "GA4 Property ID",
      ready: Boolean(config.propertyId.trim()),
      detail: config.propertyId.trim()
        ? "Property ID is available to the app."
        : "Add GOOGLE_ANALYTICS_PROPERTY_ID or NEXT_PUBLIC_GA4_PROPERTY_ID."
    },
    {
      key: "client-email",
      label: "Service account email",
      ready: Boolean(config.clientEmail.trim()),
      detail: config.clientEmail.trim()
        ? "Service account email is available to the app."
        : "Add GOOGLE_ANALYTICS_CLIENT_EMAIL."
    },
    {
      key: "private-key",
      label: "Service account private key",
      ready: Boolean(config.privateKey.trim()),
      detail: config.privateKey.trim()
        ? "Private key is available to the app."
        : "Add GOOGLE_ANALYTICS_PRIVATE_KEY."
    }
  ];
}

function createJwtAssertion() {
  const { clientEmail, privateKey } = getGoogleAnalyticsConfig();
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT"
  };
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

  const unsignedToken = `${encode(header)}.${encode(payload)}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = signer
    .sign(privateKey, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${unsignedToken}.${signature}`;
}

async function fetchGoogleAnalyticsAccessToken() {
  const assertion = createJwtAssertion();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    }).toString()
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error_description?: string };
    throw new Error(payload.error_description ?? "Unable to authenticate with Google Analytics.");
  }

  const payload = (await response.json()) as GoogleAnalyticsTokenResponse;

  return payload.access_token;
}

async function runGoogleAnalyticsReport(
  accessToken: string,
  body: Record<string, unknown>
) {
  const { propertyId } = getGoogleAnalyticsConfig();
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(payload.error?.message ?? "Google Analytics query failed.");
  }

  return (await response.json()) as RunReportResponse;
}

async function getOrCreateGoogleAnalyticsConnection(clientId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await getSupabaseServerClient()) as any;

  if (!supabase) {
    throw new Error("Supabase is required to sync Google Analytics.");
  }

  const { data: existingRow, error: existingError } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("client_id", clientId)
    .eq("provider", "google-analytics")
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingRow) {
    return mapIntegrationConnectionRow(existingRow as Parameters<typeof mapIntegrationConnectionRow>[0]);
  }

  const connection: IntegrationConnection = {
    id: `ic-ga-${clientId}`,
    clientId,
    provider: "google-analytics",
    accountLabel: "Website / GA4",
    status: "Scaffolded",
    notes: "GA4 sync is ready once credentials are added.",
    setup: {
      authStatus: "preparing",
      tokenStatus: "missing"
    }
  };

  const { data, error } = await supabase
    .from("integration_connections")
    .upsert(mapIntegrationConnectionInsert(connection), { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapIntegrationConnectionRow(data as Parameters<typeof mapIntegrationConnectionRow>[0]);
}

async function persistGoogleAnalyticsConnection(connection: IntegrationConnection) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await getSupabaseServerClient()) as any;

  if (!supabase) {
    throw new Error("Supabase is required to save Google Analytics setup.");
  }

  const { data: existingRow, error: existingError } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("id", connection.id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  const existingSecretBlob = parseIntegrationNotes(String(existingRow?.notes ?? "")).secretBlob;
  const { data, error } = await supabase
    .from("integration_connections")
    .upsert(
      {
        ...mapIntegrationConnectionInsert(connection),
        notes: composeIntegrationNotes(connection.notes, connection.setup, existingSecretBlob)
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapIntegrationConnectionRow(data as Parameters<typeof mapIntegrationConnectionRow>[0]);
}

async function persistGoogleAnalyticsSnapshot(snapshot: AnalyticsSnapshot) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await getSupabaseServerClient()) as any;

  if (!supabase) {
    throw new Error("Supabase is required to save Google Analytics snapshots.");
  }

  const { data, error } = await supabase
    .from("analytics_snapshots")
    .upsert(mapAnalyticsSnapshotInsert(snapshot), { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapAnalyticsSnapshotRow(data as Parameters<typeof mapAnalyticsSnapshotRow>[0]);
}

function buildSummaryFromConnection(
  clientId: string,
  connection: IntegrationConnection
): GoogleAnalyticsSummary {
  const checks = buildGoogleAnalyticsChecks();
  const readyToSync = checks.every((check) => check.ready);
  const totals = connection.setup?.syncedTotals;

  return {
    clientId,
    readyToSync,
    checks,
    propertyId:
      connection.setup?.externalAccountId ??
      getGoogleAnalyticsConfig().propertyId ??
      undefined,
    accountLabel: connection.accountLabel,
    lastSyncAt: connection.lastSyncAt,
    periodLabel: connection.setup?.periodLabel,
    sessions: totals?.sessions ?? 0,
    users: totals?.users ?? 0,
    views: totals?.views ?? 0,
    events: totals?.events ?? 0,
    topSources: connection.setup?.topSources ?? [],
    topPages: connection.setup?.topPages ?? [],
    nextAction: readyToSync
      ? connection.lastSyncAt
        ? "Google Analytics is connected. Sync again any time to refresh the website read."
        : "Everything is configured. Run the first sync to pull website traffic into the app."
      : "Finish the Google Analytics credentials in .env.local before syncing."
  };
}

export async function getGoogleAnalyticsSummary(clientId: string) {
  const connection = await getOrCreateGoogleAnalyticsConnection(clientId);
  return buildSummaryFromConnection(clientId, connection);
}

export async function syncGoogleAnalytics(clientId: string): Promise<GoogleAnalyticsSyncResult> {
  const checks = buildGoogleAnalyticsChecks();

  if (!checks.every((check) => check.ready)) {
    throw new Error("Google Analytics still needs configuration.");
  }

  const connection = await getOrCreateGoogleAnalyticsConnection(clientId);
  const accessToken = await fetchGoogleAnalyticsAccessToken();
  const totalsResponse = await runGoogleAnalyticsReport(accessToken, {
    dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
    metrics: [
      { name: "sessions" },
      { name: "totalUsers" },
      { name: "screenPageViews" },
      { name: "eventCount" }
    ]
  });
  const topSourcesResponse = await runGoogleAnalyticsReport(accessToken, {
    dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
    dimensions: [{ name: "sessionSourceMedium" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 3
  });
  const topPagesResponse = await runGoogleAnalyticsReport(accessToken, {
    dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
    dimensions: [{ name: "landingPagePlusQueryString" }],
    metrics: [{ name: "screenPageViews" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 3
  });

  const totalsRow = totalsResponse.rows?.[0];
  const sessions = Number(totalsRow?.metricValues?.[0]?.value ?? 0);
  const users = Number(totalsRow?.metricValues?.[1]?.value ?? 0);
  const views = Number(totalsRow?.metricValues?.[2]?.value ?? 0);
  const events = Number(totalsRow?.metricValues?.[3]?.value ?? 0);
  const topSources = (topSourcesResponse.rows ?? []).map((row) => ({
    label: row.dimensionValues?.[0]?.value || "Direct / unknown",
    sessions: Number(row.metricValues?.[0]?.value ?? 0)
  }));
  const topPages = (topPagesResponse.rows ?? []).map((row) => ({
    path: row.dimensionValues?.[0]?.value || "/",
    views: Number(row.metricValues?.[0]?.value ?? 0)
  }));
  const syncedAt = new Date().toISOString();

  const snapshot = await persistGoogleAnalyticsSnapshot({
    id: `ga-${clientId}-${new Date().toISOString().slice(0, 10)}`,
    clientId,
    source: "Google Analytics",
    periodLabel: "Last 30 days",
    impressions: sessions,
    clicks: views,
    conversions: events,
    attributedRevenue: 0,
    attributedCovers: 0,
    attributedTables: 0,
    createdAt: syncedAt
  });

  await persistGoogleAnalyticsConnection({
    ...connection,
    accountLabel: connection.accountLabel || "Website / GA4",
    status: "Ready",
    lastSyncAt: syncedAt,
    notes: "GA4 sync is live and pulling website traffic into the app.",
    setup: {
      ...connection.setup,
      authStatus: "connected",
      tokenStatus: "ready",
      externalAccountId: getGoogleAnalyticsConfig().propertyId,
      scopeSummary: "analytics.readonly",
      connectedAssetLabel: connection.accountLabel || "Website / GA4",
      periodLabel: "Last 30 days",
      syncedTotals: {
        sessions,
        users,
        views,
        events
      },
      topSources,
      topPages,
      lastCheckedAt: syncedAt,
      nextAction:
        topPages[0]?.path && topSources[0]?.label
          ? `Top page is ${topPages[0].path}. Strongest source is ${topSources[0].label}.`
          : "Google Analytics synced successfully.",
      connectionMode: "direct"
    }
  });

  return {
    syncedAt,
    propertyId: getGoogleAnalyticsConfig().propertyId,
    snapshot,
    topSources,
    topPages
  };
}
