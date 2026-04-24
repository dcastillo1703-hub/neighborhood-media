import { createPrivateKey, createSign } from "crypto";

import { composeIntegrationNotes, parseIntegrationNotes } from "@/lib/domain/integration-notes";
import { integrationEnv } from "@/lib/integrations/config";
import { getIntegrationRuntimeContext } from "@/lib/integrations/config-status";
import { computeNextSyncRun, isSyncDue } from "@/lib/integrations/schedule";
import {
  mapAnalyticsSnapshotInsert,
  mapAnalyticsSnapshotRow,
  mapIntegrationConnectionInsert,
  mapIntegrationConnectionRow
} from "@/lib/supabase/mappers";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AnalyticsSnapshot,
  GoogleAnalyticsCampaignImpact,
  GoogleAnalyticsSummary,
  IntegrationConnection,
  SyncJob
} from "@/types";

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
  keyEvents: GoogleAnalyticsSummary["keyEvents"];
};

const candidateKeyEvents = [
  "reservation_click",
  "order_click",
  "call_click",
  "menu_view"
] as const;

function normalizeSourceLabel(value?: string) {
  const raw = value?.trim();

  if (!raw) {
    return "Direct / unknown";
  }

  if (raw.toLowerCase() === "(not set)") {
    return "Unattributed traffic";
  }

  return raw;
}

function buildSourceQuality(topSources: GoogleAnalyticsSummary["topSources"], sessions: number) {
  const unattributed = topSources.find((source) => source.label === "Unattributed traffic");
  const notSetSessions = unattributed?.sessions ?? 0;
  const notSetShare = sessions > 0 ? notSetSessions / sessions : 0;
  const rankedSource = topSources.find((source) => source.label !== "Unattributed traffic") ?? topSources[0];

  return {
    topSourceLabel: rankedSource?.label,
    topSourceSessions: rankedSource?.sessions,
    hasNotSetTraffic: notSetSessions > 0,
    notSetSessions,
    notSetShare
  };
}

function buildActionItems(input: {
  sessions: number;
  topSources: GoogleAnalyticsSummary["topSources"];
  topPages: GoogleAnalyticsSummary["topPages"];
  keyEvents: GoogleAnalyticsSummary["keyEvents"];
}) {
  const actions: string[] = [];
  const sourceQuality = buildSourceQuality(input.topSources, input.sessions);
  const reservationClicks =
    input.keyEvents.find((event) => event.label === "Reservation clicks")?.count ?? 0;
  const orderClicks = input.keyEvents.find((event) => event.label === "Order clicks")?.count ?? 0;
  const callClicks = input.keyEvents.find((event) => event.label === "Call clicks")?.count ?? 0;
  const menuViews = input.keyEvents.find((event) => event.label === "Menu views")?.count ?? 0;

  if (sourceQuality.hasNotSetTraffic && sourceQuality.notSetShare >= 0.2) {
    actions.push(
      "A meaningful share of traffic is unattributed. Tighten UTM use on campaign links so the next traffic read is easier to trust."
    );
  }

  if (sourceQuality.topSourceLabel && sourceQuality.topSourceLabel !== "Unattributed traffic") {
    actions.push(
      `${sourceQuality.topSourceLabel} is your clearest website source right now. Mirror that source's message and offer in the next campaign push.`
    );
  }

  if (input.topPages[0]?.path) {
    actions.push(
      `${input.topPages[0].path} is getting the most attention. Point campaigns there first, or make sure it has a stronger reservation or order call-to-action.`
    );
  }

  if (menuViews > 0 && reservationClicks === 0 && orderClicks === 0 && callClicks === 0) {
    actions.push(
      "People are browsing the menu without taking the next step yet. Strengthen reservation, call, or order prompts on the menu path."
    );
  }

  if (reservationClicks > 0) {
    actions.push(
      `Reservations are generating direct intent (${reservationClicks} clicks). Compare that traffic window to Toast covers to see whether the website push is converting.`
    );
  }

  return actions.slice(0, 4);
}

function getGoogleAnalyticsConfig() {
  const propertyId = integrationEnv.googleAnalyticsPropertyId;
  const clientEmail = process.env.GOOGLE_ANALYTICS_CLIENT_EMAIL ?? "";
  const rawPrivateKey = process.env.GOOGLE_ANALYTICS_PRIVATE_KEY ?? "";
  const privateKey = rawPrivateKey.replace(/\\n/g, "\n");

  return {
    propertyId,
    clientEmail,
    privateKey
  };
}

function buildGoogleAnalyticsConfigStatus(appUrl?: string): GoogleAnalyticsSummary["configStatus"] {
  const config = getGoogleAnalyticsConfig();
  const runtime = getIntegrationRuntimeContext(appUrl);
  const checks: GoogleAnalyticsSummary["checks"] = [
    {
      key: "property-id",
      label: "GA4 Property ID",
      ready: Boolean(config.propertyId.trim()),
      status: config.propertyId.trim() ? "ready" : "missing",
      envVar: "GOOGLE_ANALYTICS_PROPERTY_ID or NEXT_PUBLIC_GA4_PROPERTY_ID",
      detail: config.propertyId.trim()
        ? "GA4 Property ID is available to the server."
        : "GOOGLE_ANALYTICS_PROPERTY_ID is missing from the deployed server environment."
    },
    {
      key: "client-email",
      label: "Service account email",
      ready: Boolean(config.clientEmail.trim()),
      status: config.clientEmail.trim() ? "ready" : "missing",
      envVar: "GOOGLE_ANALYTICS_CLIENT_EMAIL",
      detail: config.clientEmail.trim()
        ? "Service account email is available to the server."
        : "GOOGLE_ANALYTICS_CLIENT_EMAIL is missing from the deployed server environment."
    },
    {
      key: "private-key",
      label: "Service account private key",
      ready: false,
      status: "missing",
      envVar: "GOOGLE_ANALYTICS_PRIVATE_KEY",
      detail: "GOOGLE_ANALYTICS_PRIVATE_KEY is missing."
    }
  ];
  const issues: GoogleAnalyticsSummary["configStatus"]["issues"] = [];
  const trimmedPropertyId = config.propertyId.trim();

  if (!trimmedPropertyId) {
    issues.push({
      code: "missing-env-var",
      label: "GA4 Property ID is missing",
      detail:
        "GOOGLE_ANALYTICS_PROPERTY_ID is not present in this server environment, so the deployed app cannot query GA4.",
      severity: "error"
    });
  }

  if (!config.clientEmail.trim()) {
    issues.push({
      code: "missing-env-var",
      label: "Service account email is missing",
      detail:
        "GOOGLE_ANALYTICS_CLIENT_EMAIL is not present in this server environment, so the deployed app cannot authenticate with GA4.",
      severity: "error"
    });
  }

  if (trimmedPropertyId && !/^\d+$/.test(trimmedPropertyId)) {
    checks[0] = {
      ...checks[0],
      ready: false,
      status: "invalid",
      detail: "Property ID is present but not in the expected numeric GA4 format."
    };
    issues.push({
      code: "invalid-property-id",
      label: "GA4 Property ID looks invalid",
      detail:
        "GOOGLE_ANALYTICS_PROPERTY_ID should be the numeric GA4 property ID used in the Google Analytics Data API.",
      severity: "error"
    });
  }

  if (!config.privateKey.trim()) {
    issues.push({
      code: "missing-env-var",
      label: "Service account private key is missing",
      detail:
        "GOOGLE_ANALYTICS_PRIVATE_KEY is not present in this server environment, so deployed sync cannot authenticate.",
      severity: "error"
    });
  } else {
    try {
      createPrivateKey({ key: config.privateKey, format: "pem" });
      checks[2] = {
        ...checks[2],
        ready: true,
        status: "ready",
        detail: "Service account private key is available and parses correctly."
      };
    } catch {
      checks[2] = {
        ...checks[2],
        ready: false,
        status: "invalid",
        detail: "Private key is present but cannot be parsed as a PEM private key."
      };
      issues.push({
        code: "malformed-private-key",
        label: "Service account private key is malformed",
        detail:
          "GOOGLE_ANALYTICS_PRIVATE_KEY is present, but it is not a valid PEM block. Re-save the full private key, including BEGIN/END lines and real line breaks.",
        severity: "error"
      });
    }
  }

  const missingRequiredFields = checks
    .filter((check) => check.status === "missing")
    .map((check) => check.label);
  const ready = checks.every((check) => check.ready);

  return {
    ready,
    environment: runtime.environment,
    checks,
    issues,
    summary: ready
      ? "GA4 server credentials are complete for this environment."
      : "GA4 server credentials need attention before website sync can run reliably.",
    nextAction:
      issues[0]?.detail ??
      (missingRequiredFields.length
        ? `Add ${missingRequiredFields.join(", ")} to the deployed server environment before syncing.`
        : "GA4 credentials are complete. Run a sync to refresh the website read.")
  };
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

async function getOrCreateGoogleAnalyticsSyncJob(clientId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await getSupabaseServerClient()) as any;

  if (!supabase) {
    throw new Error("Supabase is required to manage Google Analytics sync jobs.");
  }

  const { data: existingRow, error: existingError } = await supabase
    .from("sync_jobs")
    .select("*")
    .eq("client_id", clientId)
    .eq("provider", "google-analytics")
    .eq("job_type", "sync-insights")
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingRow) {
    return {
      id: String(existingRow.id),
      clientId: String(existingRow.client_id),
      provider: "google-analytics" as const,
      jobType: "sync-insights" as const,
      schedule: String(existingRow.schedule),
      status: existingRow.status as SyncJob["status"],
      lastRunAt: existingRow.last_run_at ?? undefined,
      nextRunAt: existingRow.next_run_at ?? undefined,
      detail: String(existingRow.detail)
    };
  }

  const job: SyncJob = {
    id: `sj-ga-${clientId}`,
    clientId,
    provider: "google-analytics",
    jobType: "sync-insights",
    schedule: "Every 6 hours",
    status: "Ready",
    nextRunAt: computeNextSyncRun("Every 6 hours"),
    detail: "Runs Google Analytics sync on a predictable cadence."
  };

  const { data, error } = await supabase
    .from("sync_jobs")
    .upsert(
      {
        id: job.id,
        client_id: job.clientId,
        provider: job.provider,
        job_type: job.jobType,
        schedule: job.schedule,
        status: job.status,
        last_run_at: job.lastRunAt ?? null,
        next_run_at: job.nextRunAt ?? null,
        detail: job.detail
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return {
    id: String(data.id),
    clientId: String(data.client_id),
    provider: "google-analytics" as const,
    jobType: "sync-insights" as const,
    schedule: String(data.schedule),
    status: data.status as SyncJob["status"],
    lastRunAt: data.last_run_at ?? undefined,
    nextRunAt: data.next_run_at ?? undefined,
    detail: String(data.detail)
  };
}

function buildSummaryFromConnection(
  clientId: string,
  connection: IntegrationConnection,
  syncJob?: SyncJob,
  appUrl?: string
): GoogleAnalyticsSummary {
  const configStatus = buildGoogleAnalyticsConfigStatus(appUrl);
  const checks = configStatus.checks;
  const readyToSync = configStatus.ready;
  const totals = connection.setup?.syncedTotals;

  return {
    clientId,
    readyToSync,
    configStatus,
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
    keyEvents: connection.setup?.keyEvents ?? [],
    sourceQuality:
      connection.setup?.sourceQuality ?? {
        hasNotSetTraffic: false,
        notSetSessions: 0,
        notSetShare: 0
      },
    actionItems: connection.setup?.actionItems ?? [],
    syncJob: syncJob
      ? {
          id: syncJob.id,
          schedule: syncJob.schedule,
          lastRunAt: syncJob.lastRunAt,
          nextRunAt: syncJob.nextRunAt,
          due: isSyncDue(syncJob.nextRunAt),
          status: syncJob.status
        }
      : undefined,
    nextAction: readyToSync
      ? connection.lastSyncAt
        ? "Google Analytics is connected. Sync again any time to refresh the website read."
        : "Everything is configured. Run the first sync to pull website traffic into the app."
      : configStatus.nextAction
  };
}

export async function getGoogleAnalyticsSummary(clientId: string, appUrl?: string) {
  const [connection, syncJob] = await Promise.all([
    getOrCreateGoogleAnalyticsConnection(clientId),
    getOrCreateGoogleAnalyticsSyncJob(clientId)
  ]);
  return buildSummaryFromConnection(clientId, connection, syncJob, appUrl);
}

export async function getGoogleAnalyticsCampaignImpact(input: {
  clientId: string;
  landingPath?: string;
  utmCampaign?: string;
}): Promise<GoogleAnalyticsCampaignImpact> {
  const connection = await getOrCreateGoogleAnalyticsConnection(input.clientId);
  const summary = buildSummaryFromConnection(input.clientId, connection);

  if (!summary.readyToSync) {
    return {
      ready: false,
      periodLabel: summary.periodLabel,
      landingPath: input.landingPath,
      utmCampaign: input.utmCampaign,
      sessions: 0,
      users: 0,
      views: 0,
      events: 0,
      topSources: [],
      topPages: [],
      summary: "Finish Google Analytics setup first so campaign traffic can be read here."
    };
  }

  const accessToken = await fetchGoogleAnalyticsAccessToken();
  const dateRanges = [{ startDate: "30daysAgo", endDate: "today" }];
  const filters: Record<string, unknown>[] = [];
  const normalizedLandingPath = input.landingPath?.trim();
  const normalizedCampaign = input.utmCampaign?.trim();

  if (normalizedLandingPath) {
    filters.push({
      filter: {
        fieldName: "landingPagePlusQueryString",
        stringFilter: {
          matchType: "BEGINS_WITH",
          value: normalizedLandingPath
        }
      }
    });
  }

  if (normalizedCampaign) {
    filters.push({
      filter: {
        fieldName: "sessionCampaignName",
        stringFilter: {
          matchType: "EXACT",
          value: normalizedCampaign
        }
      }
    });
  }

  const dimensionFilter =
    filters.length > 1
      ? {
          andGroup: {
            expressions: filters
          }
        }
      : filters[0] ?? undefined;

  const baseBody = {
    dateRanges,
    dimensionFilter
  };

  const totalsResponse = await runGoogleAnalyticsReport(accessToken, {
    ...baseBody,
    metrics: [
      { name: "sessions" },
      { name: "totalUsers" },
      { name: "screenPageViews" },
      { name: "eventCount" }
    ]
  });
  const topSourcesResponse = await runGoogleAnalyticsReport(accessToken, {
    ...baseBody,
    dimensions: [{ name: "sessionSourceMedium" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 3
  });
  const topPagesResponse = await runGoogleAnalyticsReport(accessToken, {
    ...baseBody,
    dimensions: [{ name: "landingPagePlusQueryString" }],
    metrics: [{ name: "screenPageViews" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 3
  });
  const keyEventsResponse = await runGoogleAnalyticsReport(accessToken, {
    ...baseBody,
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          ...(dimensionFilter ? [dimensionFilter] : []),
          {
            filter: {
              fieldName: "eventName",
              inListFilter: {
                values: [...candidateKeyEvents]
              }
            }
          }
        ]
      }
    },
    orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    limit: candidateKeyEvents.length
  });

  const totalsRow = totalsResponse.rows?.[0];
  const sessions = Number(totalsRow?.metricValues?.[0]?.value ?? 0);
  const users = Number(totalsRow?.metricValues?.[1]?.value ?? 0);
  const views = Number(totalsRow?.metricValues?.[2]?.value ?? 0);
  const events = Number(totalsRow?.metricValues?.[3]?.value ?? 0);
  const topSources = (topSourcesResponse.rows ?? []).map((row) => ({
    label: normalizeSourceLabel(row.dimensionValues?.[0]?.value),
    sessions: Number(row.metricValues?.[0]?.value ?? 0)
  }));
  const topPages = (topPagesResponse.rows ?? []).map((row) => ({
    path: row.dimensionValues?.[0]?.value || "/",
    views: Number(row.metricValues?.[0]?.value ?? 0)
  }));
  void keyEventsResponse;

  const summaryText =
    sessions > 0
      ? `${normalizedCampaign || "This campaign"} brought in ${sessions} sessions and ${views} views in the last 30 days${topSources[0] ? `, led by ${topSources[0].label}` : ""}.`
      : "No campaign-specific website traffic has shown up yet for this landing path and UTM combination.";

  return {
    ready: true,
    periodLabel: "Last 30 days",
    landingPath: normalizedLandingPath,
    utmCampaign: normalizedCampaign,
    sessions,
    users,
    views,
    events,
    topSources,
    topPages,
    summary: summaryText
  };
}

export async function syncGoogleAnalytics(clientId: string): Promise<GoogleAnalyticsSyncResult> {
  const configStatus = buildGoogleAnalyticsConfigStatus();

  if (!configStatus.ready) {
    throw new Error(configStatus.nextAction);
  }

  const [connection, syncJob] = await Promise.all([
    getOrCreateGoogleAnalyticsConnection(clientId),
    getOrCreateGoogleAnalyticsSyncJob(clientId)
  ]);
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
  const keyEventsResponse = await runGoogleAnalyticsReport(accessToken, {
    dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        inListFilter: {
          values: [...candidateKeyEvents]
        }
      }
    },
    orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    limit: candidateKeyEvents.length
  });

  const totalsRow = totalsResponse.rows?.[0];
  const sessions = Number(totalsRow?.metricValues?.[0]?.value ?? 0);
  const users = Number(totalsRow?.metricValues?.[1]?.value ?? 0);
  const views = Number(totalsRow?.metricValues?.[2]?.value ?? 0);
  const events = Number(totalsRow?.metricValues?.[3]?.value ?? 0);
  const topSources = (topSourcesResponse.rows ?? []).map((row) => ({
    label: normalizeSourceLabel(row.dimensionValues?.[0]?.value),
    sessions: Number(row.metricValues?.[0]?.value ?? 0)
  }));
  const topPages = (topPagesResponse.rows ?? []).map((row) => ({
    path: row.dimensionValues?.[0]?.value || "/",
    views: Number(row.metricValues?.[0]?.value ?? 0)
  }));
  const keyEvents = (keyEventsResponse.rows ?? []).map((row) => ({
    label:
      {
        reservation_click: "Reservation clicks",
        order_click: "Order clicks",
        call_click: "Call clicks",
        menu_view: "Menu views"
      }[row.dimensionValues?.[0]?.value ?? ""] ?? (row.dimensionValues?.[0]?.value || "Event"),
    count: Number(row.metricValues?.[0]?.value ?? 0)
  }));
  const sourceQuality = buildSourceQuality(topSources, sessions);
  const actionItems = buildActionItems({
    sessions,
    topSources,
    topPages,
    keyEvents
  });
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
      keyEvents,
      sourceQuality,
      actionItems,
      lastCheckedAt: syncedAt,
      nextAction:
        topPages[0]?.path && topSources[0]?.label
          ? `Top page is ${topPages[0].path}. Strongest source is ${topSources[0].label}.`
          : "Google Analytics synced successfully.",
      connectionMode: "direct"
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await getSupabaseServerClient()) as any;

  if (supabase && syncJob) {
    await supabase
      .from("sync_jobs")
      .upsert(
        {
          id: syncJob.id,
          client_id: syncJob.clientId,
          provider: syncJob.provider,
          job_type: syncJob.jobType,
          schedule: syncJob.schedule,
          status: "Ready",
          last_run_at: syncedAt,
          next_run_at: computeNextSyncRun(syncJob.schedule, new Date(syncedAt)),
          detail: `GA4 sync completed successfully at ${syncedAt}.`
        },
        { onConflict: "id" }
      );
  }

  return {
    syncedAt,
    propertyId: getGoogleAnalyticsConfig().propertyId,
    snapshot,
    topSources,
    topPages,
    keyEvents
  };
}
