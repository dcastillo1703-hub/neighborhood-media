"use client";

import { useEffect, useMemo, useState } from "react";

import { ListCard } from "@/components/dashboard/list-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatGrid } from "@/components/dashboard/stat-grid";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useActiveClient } from "@/lib/client-context";
import { getIntegrationAdapter } from "@/lib/integrations/registry";
import { getIntegrationRequirements } from "@/lib/integrations/requirements";
import { useIntegrations } from "@/lib/repositories/use-integrations";
import { usePublishingApi } from "@/lib/use-publishing-api";
import type { IntegrationConnection, SyncJob } from "@/types";

export default function IntegrationsPage() {
  const { activeClient } = useActiveClient();
  const {
    checkConnection,
    connections,
    error,
    prepareConnection,
    runSyncJob,
    syncJobs,
    ready,
    updateConnection,
    updateSyncJob
  } =
    useIntegrations(activeClient.id);
  const { jobs: publishJobs, ready: publishReady } = usePublishingApi(activeClient.id);
  const [connectionDrafts, setConnectionDrafts] = useState<
    Record<
      string,
      Pick<IntegrationConnection, "accountLabel" | "status" | "notes" | "setup">
    >
  >({});
  const [syncDrafts, setSyncDrafts] = useState<
    Record<string, Pick<SyncJob, "schedule" | "status" | "detail">>
  >({});
  const [saveState, setSaveState] = useState<Record<string, string>>({});

  const serviceOverview = useMemo(
    () =>
      connections.map((connection) => ({
        connection,
        adapter: getIntegrationAdapter(connection.provider),
        status: getIntegrationAdapter(connection.provider).getConnectionStatus(connection)
      })),
    [connections]
  );

  useEffect(() => {
    setConnectionDrafts(
      Object.fromEntries(
        connections.map((connection) => [
          connection.id,
          {
            accountLabel: connection.accountLabel,
            status: connection.status,
            notes: connection.notes,
            setup: connection.setup
          }
        ])
      )
    );
  }, [connections]);

  useEffect(() => {
    setSyncDrafts(
      Object.fromEntries(
        syncJobs.map((job) => [
          job.id,
          {
            schedule: job.schedule,
            status: job.status,
            detail: job.detail
          }
        ])
      )
    );
  }, [syncJobs]);

  if (!ready) {
    return <div className="text-sm text-muted-foreground">Loading integrations...</div>;
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Integrations"
        title="Integrations"
        description="Review provider readiness, credential setup state, and sync job behavior."
      />

      <StatGrid>
        <MetricCard label="Scaffolded Providers" value={String(connections.length)} detail="Core provider adapters added for the most relevant restaurant marketing systems." />
        <MetricCard label="Ready Connections" value={String(connections.filter((connection) => connection.status === "Ready").length)} detail="Connections that have enough setup to begin real API wiring." />
        <MetricCard label="Sync Jobs" value={String(syncJobs.length)} detail="Scheduled sync placeholders ready to become background jobs or cron tasks." />
        <MetricCard label="Publish Jobs" value={publishReady ? String(publishJobs.length) : "..."} detail="Queued or attempted social publishing jobs tied to scheduled posts." />
        <MetricCard label="Blocked Jobs" value={String(syncJobs.filter((job) => job.status === "Blocked").length)} detail="Expected blockers until credentials or vendors are finalized." tone="olive" />
      </StatGrid>

      {error ? <p className="text-sm text-primary">{error}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardDescription>Connection Setup</CardDescription>
              <CardTitle className="mt-3">Provider readiness</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            {serviceOverview.map(({ connection, adapter, status }) => (
              <ListCard key={connection.id}>
                {(() => {
                  const guide = adapter.getConnectionGuide(connection);

                  return (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">{connection.accountLabel}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{adapter.description}</p>
                    </div>
                    <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                      {connection.status}
                    </span>
                  </div>

                  <p className="text-sm text-primary">{status.message}</p>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Provider: {connection.provider}
                  </p>
                  <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                    <p className="text-sm font-medium text-foreground">{guide.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{guide.summary}</p>
                    <div className="mt-3 space-y-2">
                      {guide.steps.map((step) => (
                        <p key={step} className="text-sm text-muted-foreground">
                          {step}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    {getIntegrationRequirements(connection.provider).map((requirement) => (
                      <div
                        key={requirement.label}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground">{requirement.label}</span>
                        <span className={requirement.satisfied ? "text-primary" : "text-muted-foreground"}>
                          {requirement.satisfied ? "Ready" : "Missing"}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3">
                    <Input
                      value={connectionDrafts[connection.id]?.accountLabel ?? connection.accountLabel}
                      onChange={(event) =>
                        setConnectionDrafts((current) => ({
                          ...current,
                          [connection.id]: {
                            ...(current[connection.id] ?? {
                              accountLabel: connection.accountLabel,
                              status: connection.status,
                              notes: connection.notes,
                              setup: connection.setup
                            }),
                            accountLabel: event.target.value
                          }
                        }))
                      }
                    />
                    <select
                      className="flex h-11 w-full rounded-xl border border-border bg-card/70 px-4 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                      value={connectionDrafts[connection.id]?.status ?? connection.status}
                      onChange={(event) =>
                        setConnectionDrafts((current) => ({
                          ...current,
                          [connection.id]: {
                            ...(current[connection.id] ?? {
                              accountLabel: connection.accountLabel,
                              status: connection.status,
                              notes: connection.notes,
                              setup: connection.setup
                            }),
                            status: event.target.value as IntegrationConnection["status"]
                          }
                        }))
                      }
                    >
                      <option value="Needs Credentials">Needs Credentials</option>
                      <option value="Scaffolded">Scaffolded</option>
                      <option value="Ready">Ready</option>
                    </select>
                    <Textarea
                      value={connectionDrafts[connection.id]?.notes ?? connection.notes}
                      onChange={(event) =>
                        setConnectionDrafts((current) => ({
                          ...current,
                          [connection.id]: {
                            ...(current[connection.id] ?? {
                              accountLabel: connection.accountLabel,
                              status: connection.status,
                              notes: connection.notes,
                              setup: connection.setup
                            }),
                            notes: event.target.value
                          }
                        }))
                      }
                      placeholder="Document tokens, account IDs, or setup blockers."
                    />
                    <Input
                      value={
                        connectionDrafts[connection.id]?.setup?.externalAccountId ??
                        connection.setup?.externalAccountId ??
                        ""
                      }
                      onChange={(event) =>
                        setConnectionDrafts((current) => ({
                          ...current,
                          [connection.id]: {
                            ...(current[connection.id] ?? {
                              accountLabel: connection.accountLabel,
                              status: connection.status,
                              notes: connection.notes,
                              setup: connection.setup
                            }),
                            setup: {
                              ...(current[connection.id]?.setup ?? connection.setup ?? {
                                authStatus: "unconfigured"
                              }),
                              externalAccountId: event.target.value
                            }
                          }
                        }))
                      }
                      placeholder="External account ID"
                    />
                    <Input
                      value={
                        connectionDrafts[connection.id]?.setup?.scopeSummary ??
                        connection.setup?.scopeSummary ??
                        ""
                      }
                      onChange={(event) =>
                        setConnectionDrafts((current) => ({
                          ...current,
                          [connection.id]: {
                            ...(current[connection.id] ?? {
                              accountLabel: connection.accountLabel,
                              status: connection.status,
                              notes: connection.notes,
                              setup: connection.setup
                            }),
                            setup: {
                              ...(current[connection.id]?.setup ?? connection.setup ?? {
                                authStatus: "unconfigured"
                              }),
                              scopeSummary: event.target.value
                            }
                          }
                        }))
                      }
                      placeholder="Scope summary"
                    />
                    <Input
                      value={
                        connectionDrafts[connection.id]?.setup?.nextAction ??
                        connection.setup?.nextAction ??
                        ""
                      }
                      onChange={(event) =>
                        setConnectionDrafts((current) => ({
                          ...current,
                          [connection.id]: {
                            ...(current[connection.id] ?? {
                              accountLabel: connection.accountLabel,
                              status: connection.status,
                              notes: connection.notes,
                              setup: connection.setup
                            }),
                            setup: {
                              ...(current[connection.id]?.setup ?? connection.setup ?? {
                                authStatus: "unconfigured"
                              }),
                              nextAction: event.target.value
                            }
                          }
                        }))
                      }
                      placeholder="Next action"
                    />
                    <div className="grid gap-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Auth status</span>
                        <span className="text-foreground">
                          {connectionDrafts[connection.id]?.setup?.authStatus ??
                            connection.setup?.authStatus ??
                            "unconfigured"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Last checked</span>
                        <span className="text-foreground">
                          {connectionDrafts[connection.id]?.setup?.lastCheckedAt ??
                            connection.setup?.lastCheckedAt ??
                            "Not checked"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSaveState((current) => ({
                              ...current,
                              [`prepare-${connection.id}`]: "Preparing..."
                            }));

                            void prepareConnection(connection.id)
                              .then(() => {
                                setSaveState((current) => ({
                                  ...current,
                                  [`prepare-${connection.id}`]: "Prepared"
                                }));
                              })
                              .catch(() => {
                                setSaveState((current) => ({
                                  ...current,
                                  [`prepare-${connection.id}`]: "Prepare failed"
                                }));
                              });
                          }}
                        >
                          {guide.connectLabel}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSaveState((current) => ({
                              ...current,
                              [`check-${connection.id}`]: "Checking..."
                            }));

                            void checkConnection(connection.id)
                              .then(() => {
                                setSaveState((current) => ({
                                  ...current,
                                  [`check-${connection.id}`]: "Checked"
                                }));
                              })
                              .catch(() => {
                                setSaveState((current) => ({
                                  ...current,
                                  [`check-${connection.id}`]: "Check failed"
                                }));
                              });
                          }}
                        >
                          Run check
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                          const draft = connectionDrafts[connection.id];

                          if (!draft) {
                            return;
                          }

                          setSaveState((current) => ({ ...current, [connection.id]: "Saving..." }));

                          void updateConnection(connection.id, draft)
                            .then(() => {
                              setSaveState((current) => ({
                                ...current,
                                [connection.id]: "Saved"
                              }));
                            })
                            .catch(() => {
                              setSaveState((current) => ({
                                ...current,
                                [connection.id]: "Save failed"
                              }));
                            });
                          }}
                        >
                          Save connection
                        </Button>
                      </div>
                      {saveState[connection.id] || saveState[`check-${connection.id}`] ? (
                        <span className="text-xs text-muted-foreground">
                          {saveState[`prepare-${connection.id}`] ??
                            saveState[`check-${connection.id}`] ??
                            saveState[connection.id]}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                  );
                })()}
              </ListCard>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardDescription>Sync Architecture</CardDescription>
              <CardTitle className="mt-3">Job controls</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            {syncJobs.map((job) => (
              <ListCard key={job.id}>
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">{job.jobType}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{job.detail}</p>
                    </div>
                    <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                      {job.status}
                    </span>
                  </div>

                  <div className="grid gap-3">
                    <Input
                      value={syncDrafts[job.id]?.schedule ?? job.schedule}
                      onChange={(event) =>
                        setSyncDrafts((current) => ({
                          ...current,
                          [job.id]: {
                            ...(current[job.id] ?? {
                              schedule: job.schedule,
                              status: job.status,
                              detail: job.detail
                            }),
                            schedule: event.target.value
                          }
                        }))
                      }
                    />
                    <select
                      className="flex h-11 w-full rounded-xl border border-border bg-card/70 px-4 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                      value={syncDrafts[job.id]?.status ?? job.status}
                      onChange={(event) =>
                        setSyncDrafts((current) => ({
                          ...current,
                          [job.id]: {
                            ...(current[job.id] ?? {
                              schedule: job.schedule,
                              status: job.status,
                              detail: job.detail
                            }),
                            status: event.target.value as SyncJob["status"]
                          }
                        }))
                      }
                    >
                      <option value="Idle">Idle</option>
                      <option value="Ready">Ready</option>
                      <option value="Blocked">Blocked</option>
                    </select>
                    <Textarea
                      value={syncDrafts[job.id]?.detail ?? job.detail}
                      onChange={(event) =>
                        setSyncDrafts((current) => ({
                          ...current,
                          [job.id]: {
                            ...(current[job.id] ?? {
                              schedule: job.schedule,
                              status: job.status,
                              detail: job.detail
                            }),
                            detail: event.target.value
                          }
                        }))
                      }
                    />
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          onClick={() => {
                          const draft = syncDrafts[job.id];

                          if (!draft) {
                            return;
                          }

                          setSaveState((current) => ({ ...current, [job.id]: "Saving..." }));

                          void updateSyncJob(job.id, draft)
                            .then(() => {
                              setSaveState((current) => ({
                                ...current,
                                [job.id]: "Saved"
                              }));
                            })
                            .catch(() => {
                              setSaveState((current) => ({
                                ...current,
                                [job.id]: "Save failed"
                              }));
                            });
                          }}
                        >
                          Save job
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSaveState((current) => ({
                              ...current,
                              [`run-${job.id}`]: "Running..."
                            }));

                            void runSyncJob(job.id)
                              .then(() => {
                                setSaveState((current) => ({
                                  ...current,
                                  [`run-${job.id}`]: "Ran"
                                }));
                              })
                              .catch(() => {
                                setSaveState((current) => ({
                                  ...current,
                                  [`run-${job.id}`]: "Run failed"
                                }));
                              });
                          }}
                        >
                          Run now
                        </Button>
                      </div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {saveState[`run-${job.id}`] ?? `Next run: ${job.nextRunAt ?? "TBD"}`}
                      </p>
                    </div>
                  </div>
                </div>
              </ListCard>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardDescription>Publishing Queue</CardDescription>
            <CardTitle className="mt-3">Scheduled publish jobs</CardTitle>
          </div>
        </CardHeader>
        <div className="space-y-3">
          {publishReady && publishJobs.length ? (
            publishJobs.map((job) => (
              <ListCard key={job.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">{job.provider}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{job.detail}</p>
                  </div>
                  <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                    {job.status}
                  </span>
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.16em] text-primary">
                  Scheduled: {job.scheduledFor}
                </p>
              </ListCard>
            ))
          ) : (
            <ListCard>
              <p className="text-sm text-muted-foreground">
                Scheduled Instagram, Facebook, and TikTok posts will create publish jobs here.
              </p>
            </ListCard>
          )}
        </div>
      </Card>
    </div>
  );
}
