import { seededIntegrationConnections, seededSyncJobs } from "@/data/seed";
import { composeIntegrationNotes, parseIntegrationNotes } from "@/lib/domain/integration-notes";
import {
  mapActivityEventInsert,
  mapActivityEventRow,
  mapIntegrationConnectionInsert,
  mapIntegrationConnectionRow,
  mapSyncJobInsert,
  mapSyncJobRow
} from "@/lib/supabase/mappers";
import { getIntegrationAdapter } from "@/lib/integrations/registry";
import type { ActivityEvent, IntegrationConnection, SyncJob } from "@/types";

type IntegrationSnapshot = {
  connections: IntegrationConnection[];
  syncJobs: SyncJob[];
};

const integrationStore = new Map<string, IntegrationSnapshot>();

function getClientSnapshot(clientId: string) {
  const existing = integrationStore.get(clientId);

  if (existing) {
    return existing;
  }

  const seededSnapshot: IntegrationSnapshot = {
    connections: seededIntegrationConnections
      .filter((connection) => connection.clientId === clientId)
      .map((connection) => ({ ...connection })),
    syncJobs: seededSyncJobs
      .filter((job) => job.clientId === clientId)
      .map((job) => ({ ...job }))
  };

  integrationStore.set(clientId, seededSnapshot);

  return seededSnapshot;
}

async function getClientWorkspace(clientId: string) {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data, error } = await supabase
      .from("clients")
      .select("workspace_id,name")
      .eq("id", clientId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return {
        workspaceId: String(data.workspace_id),
        clientName: String(data.name)
      };
    }
  }

  return {
    workspaceId: "ws-neighborhood",
    clientName: "Meama"
  };
}

async function recordIntegrationEvent(event: ActivityEvent) {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (!supabase) {
    return event;
  }

  try {
    const { data, error } = await supabase
      .from("activity_events")
      .insert(mapActivityEventInsert(event))
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return mapActivityEventRow(data as Parameters<typeof mapActivityEventRow>[0]);
  } catch (error) {
    console.error("Failed to record integration activity event.", error);
    return event;
  }
}

export async function listIntegrations(clientId: string) {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const [{ data: connections, error: connectionError }, { data: jobs, error: jobError }] =
      await Promise.all([
        supabase
          .from("integration_connections")
          .select("*")
          .eq("client_id", clientId)
          .order("provider"),
        supabase.from("sync_jobs").select("*").eq("client_id", clientId).order("provider")
      ]);

    if (connectionError || jobError) {
      throw connectionError ?? jobError;
    }

    return {
      connections: (connections ?? []).map(
        (row: Parameters<typeof mapIntegrationConnectionRow>[0]) =>
          mapIntegrationConnectionRow(row)
      ),
      syncJobs: (jobs ?? []).map((row: Parameters<typeof mapSyncJobRow>[0]) => mapSyncJobRow(row))
    };
  }

  return getClientSnapshot(clientId);
}

export async function updateIntegrationConnection(
  clientId: string,
  connectionId: string,
  update: Partial<IntegrationConnection>
) {
  const snapshot = getClientSnapshot(clientId);
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data: existingRow, error: existingError } = await supabase
      .from("integration_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    const existing = existingRow
      ? mapIntegrationConnectionRow(existingRow as Parameters<typeof mapIntegrationConnectionRow>[0])
      : snapshot.connections.find((entry) => entry.id === connectionId);

    const next = existing
      ? { ...existing, ...update }
      : ({
          id: connectionId,
          clientId,
          provider: update.provider,
          accountLabel: update.accountLabel,
          status: update.status,
          notes: update.notes,
          setup: update.setup,
          lastSyncAt: update.lastSyncAt
        } as IntegrationConnection);

    if (!next.provider || !next.accountLabel || !next.status || typeof next.notes !== "string") {
      throw new Error("Integration connection not found.");
    }

    const existingSecretBlob = parseIntegrationNotes(String(existingRow?.notes ?? "")).secretBlob;
    const { data, error } = await supabase
      .from("integration_connections")
      .upsert(
        {
          ...mapIntegrationConnectionInsert(next),
          notes: composeIntegrationNotes(next.notes, next.setup, existingSecretBlob)
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

  const existing = snapshot.connections.find((entry) => entry.id === connectionId);

  if (!existing) {
    throw new Error("Integration connection not found.");
  }

  const next = { ...existing, ...update };

  snapshot.connections = snapshot.connections.map((entry) =>
    entry.id === connectionId ? next : entry
  );

  return next;
}

export async function updateSyncJob(
  clientId: string,
  jobId: string,
  update: Partial<SyncJob>
) {
  const snapshot = getClientSnapshot(clientId);
  const existing = snapshot.syncJobs.find((entry) => entry.id === jobId);

  if (!existing) {
    throw new Error("Sync job not found.");
  }

  const next = { ...existing, ...update };
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data, error } = await supabase
      .from("sync_jobs")
      .upsert(mapSyncJobInsert(next), { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return mapSyncJobRow(data as Parameters<typeof mapSyncJobRow>[0]);
  }

  snapshot.syncJobs = snapshot.syncJobs.map((entry) => (entry.id === jobId ? next : entry));

  return next;
}

export async function performConnectionCheck(clientId: string, connectionId: string) {
  const snapshot = await listIntegrations(clientId);
  const connection = snapshot.connections.find(
    (entry: IntegrationConnection) => entry.id === connectionId
  );

  if (!connection) {
    throw new Error("Integration connection not found.");
  }

  const adapter = getIntegrationAdapter(connection.provider);
  const check = adapter.getConnectionStatus(connection);
  const nextConnection: IntegrationConnection = {
    ...connection,
    status: check.status === "success" ? "Ready" : "Needs Credentials",
    lastSyncAt: new Date().toISOString(),
    notes: `${connection.notes}\n\nConnection check: ${check.message}`.trim(),
    setup: {
      ...connection.setup,
      ...check.setup,
      authStatus: check.status === "success" ? "connected" : check.setup?.authStatus ?? "preparing",
      externalAccountId: check.setup?.externalAccountId ?? connection.setup?.externalAccountId,
      scopeSummary: check.setup?.scopeSummary ?? connection.setup?.scopeSummary,
      lastCheckedAt: new Date().toISOString(),
      nextAction: check.setup?.nextAction ??
        (check.status === "success"
          ? "Connection validated. Ready for live credential wiring."
          : "Resolve missing credentials and rerun connection check.")
    }
  };

  const updatedConnection = await updateIntegrationConnection(
    clientId,
    connectionId,
    nextConnection
  );
  const { workspaceId, clientName } = await getClientWorkspace(clientId);
  const event = await recordIntegrationEvent({
    id: `evt-${Date.now()}`,
    workspaceId,
    clientId,
    actorName: "Workspace operator",
    actionLabel: "checked",
    subjectType: "integration",
    subjectName: updatedConnection.accountLabel,
    detail: `${updatedConnection.provider} connection checked for ${clientName}: ${check.message}`,
    createdAt: new Date().toISOString()
  });

  return {
    connection: updatedConnection,
    check,
    event
  };
}

export async function prepareConnection(clientId: string, connectionId: string) {
  const snapshot = await listIntegrations(clientId);
  const connection = snapshot.connections.find(
    (entry: IntegrationConnection) => entry.id === connectionId
  );

  if (!connection) {
    throw new Error("Integration connection not found.");
  }

  const adapter = getIntegrationAdapter(connection.provider);
  const connectResult = adapter.connect
    ? await adapter.connect(connection)
    : adapter.getConnectionStatus(connection);
  const guide = adapter.getConnectionGuide(connection);
  const nextConnection: IntegrationConnection = {
    ...connection,
    status:
      connectResult.status === "success"
        ? "Ready"
        : connection.status === "Needs Credentials"
          ? "Scaffolded"
          : connection.status,
    notes: `${connection.notes}\n\n${guide.title}: ${guide.steps.join(" ")}`.trim(),
    setup: {
      ...connection.setup,
      ...connectResult.setup,
      authStatus:
        connectResult.status === "success"
          ? "connected"
          : connectResult.setup?.authStatus === "connected" || connection.setup?.authStatus === "connected"
            ? "connected"
            : connectResult.setup?.authStatus ?? "preparing",
      externalAccountId:
        connectResult.setup?.externalAccountId ?? connection.setup?.externalAccountId,
      scopeSummary: connectResult.setup?.scopeSummary ?? connection.setup?.scopeSummary,
      lastCheckedAt: new Date().toISOString(),
      nextAction: connectResult.setup?.nextAction ?? guide.steps[0]
    }
  };

  const updatedConnection = await updateIntegrationConnection(
    clientId,
    connectionId,
    nextConnection
  );
  const { workspaceId, clientName } = await getClientWorkspace(clientId);
  const event = await recordIntegrationEvent({
    id: `evt-${Date.now()}`,
    workspaceId,
    clientId,
    actorName: "Workspace operator",
    actionLabel: "prepared",
    subjectType: "integration",
    subjectName: updatedConnection.accountLabel,
    detail: `${updatedConnection.provider} setup prepared for ${clientName}: ${connectResult.message}`,
    createdAt: new Date().toISOString()
  });

  return {
    connection: updatedConnection,
    guide,
    result: connectResult,
    event
  };
}

export async function runSyncJob(clientId: string, jobId: string) {
  const snapshot = await listIntegrations(clientId);
  const job = snapshot.syncJobs.find((entry: SyncJob) => entry.id === jobId);

  if (!job) {
    throw new Error("Sync job not found.");
  }

  const connection = snapshot.connections.find(
    (entry: IntegrationConnection) => entry.provider === job.provider
  );
  const adapter = getIntegrationAdapter(job.provider);
  const result = await adapter.sync(job, connection);
  const nextJob: SyncJob = {
    ...job,
    status: result.status === "success" ? "Ready" : "Blocked",
    lastRunAt: result.syncedAt ?? new Date().toISOString(),
    detail: result.message
  };

  const updatedJob = await updateSyncJob(clientId, jobId, nextJob);
  const { workspaceId, clientName } = await getClientWorkspace(clientId);
  const event = await recordIntegrationEvent({
    id: `evt-${Date.now()}`,
    workspaceId,
    clientId,
    actorName: "Workspace operator",
    actionLabel: "synced",
    subjectType: "integration",
    subjectName: updatedJob.provider,
    detail: `${updatedJob.jobType} run for ${clientName}: ${result.message}`,
    createdAt: new Date().toISOString()
  });

  return {
    job: updatedJob,
    result,
    event
  };
}
