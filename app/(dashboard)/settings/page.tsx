"use client";

import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ListCard } from "@/components/dashboard/list-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatGrid } from "@/components/dashboard/stat-grid";
import { MetricCard } from "@/components/metric-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { useActiveClient } from "@/lib/client-context";
import { useClientMemberships } from "@/lib/repositories/use-client-memberships";
import { useIntegrations } from "@/lib/repositories/use-integrations";
import { useMetaBusinessSuite } from "@/lib/use-meta-business-suite";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { currency, number } from "@/lib/utils";

export default function SettingsPage() {
  const { activeClient } = useActiveClient();
  const { mode, profile } = useAuth();
  const { workspace, members, ready: workspaceReady, error: workspaceError } = useWorkspaceContext();
  const {
    memberships,
    ready: membershipsReady,
    error: membershipError
  } = useClientMemberships(activeClient.id);
  const {
    connections,
    syncJobs,
    ready: integrationsReady,
    error: integrationsError
  } = useIntegrations(activeClient.id);
  const {
    summary: metaSummary,
    ready: metaReady,
    error: metaError,
    beginConnection
  } = useMetaBusinessSuite(activeClient.id);
  const [connectingProvider, setConnectingProvider] = useState<"facebook" | "instagram" | null>(
    null
  );

  const readyConnections = connections.filter((connection) => connection.status === "Ready");

  const prepareMetaConnection = async (provider: "facebook" | "instagram") => {
    setConnectingProvider(provider);

    try {
      await beginConnection(provider);
    } finally {
      setConnectingProvider(null);
    }
  };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Settings"
        title="Manage connections, access, and workspace health"
        description="Keep the operational setup out of the main workflow, but close enough that you can verify who has access and which channels are ready."
      />

      <StatGrid>
        <MetricCard href="/settings#workspace-access" label="Auth Mode" value={mode === "local" ? "Local" : "Supabase"} detail="Current platform mode for access control and persistence." />
        <MetricCard href="/settings#workspace-access" label="Workspace Members" value={number(members.length)} detail="People currently visible inside the workspace." />
        <MetricCard href="/settings#workspace-access" label="Client Access" value={number(memberships.length)} detail="People assigned directly to this client account." />
        <MetricCard href="/settings#channel-readiness" label="Ready Connections" value={number(readyConnections.length)} detail="Integrations that are in a usable state today." />
        <MetricCard href="/settings#meta-business-suite" label="Meta Channels Connected" value={number(metaSummary?.connectedChannels ?? 0)} detail="Facebook and Instagram channels connected through Meta Business Suite." />
        <MetricCard href="/settings#channel-readiness" label="Sync Jobs" value={number(syncJobs.length)} detail="Background sync definitions attached to this client." tone="olive" />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card id="meta-business-suite">
          <CardHeader>
            <div>
              <CardDescription>Meta Business Suite</CardDescription>
              <CardTitle className="mt-3">Facebook and Instagram connection</CardTitle>
            </div>
          </CardHeader>
          {!metaReady ? (
            <p className="text-sm text-muted-foreground">Loading Meta setup...</p>
          ) : metaError || !metaSummary ? (
            <p className="text-sm text-primary">{metaError ?? "Unable to load Meta setup."}</p>
          ) : (
            <div className="space-y-4">
              <ListCard>
                <p className="font-medium text-foreground">
                  {metaSummary.readyToConnect
                    ? "Meta app is configured"
                    : "Meta app still needs configuration"}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {metaSummary.highlights[0]}
                </p>
                <p className="mt-3 text-xs uppercase tracking-[0.16em] text-primary">
                  {metaSummary.connectedChannels} of {metaSummary.channels.length} channels connected
                </p>
              </ListCard>
              {metaSummary.channels.map((channel) => (
                <ListCard key={channel.provider}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium capitalize text-foreground">{channel.provider}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{channel.accountLabel}</p>
                    </div>
                    <p className="text-xs uppercase tracking-[0.16em] text-primary">
                      {channel.authStatus}
                    </p>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <p className="text-sm text-muted-foreground">
                      Token: <span className="text-foreground">{channel.tokenStatus}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Scope: <span className="text-foreground">{channel.scopeSummary ?? "pending"}</span>
                    </p>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {channel.nextAction ?? "Complete Meta connection setup."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      disabled={connectingProvider === channel.provider}
                      onClick={() => void prepareMetaConnection(channel.provider)}
                      size="sm"
                      variant="outline"
                    >
                      {connectingProvider === channel.provider
                        ? "Preparing..."
                        : `Prepare ${channel.provider}`}
                    </Button>
                    {channel.authorizationUrl ? (
                      <a
                        className={buttonVariants({ size: "sm" })}
                        href={channel.authorizationUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open Meta login
                      </a>
                    ) : null}
                  </div>
                </ListCard>
              ))}
            </div>
          )}
        </Card>

        <Card id="workspace-access">
          <CardHeader>
            <div>
              <CardDescription>Workspace Access</CardDescription>
              <CardTitle className="mt-3">Team and client visibility</CardTitle>
            </div>
          </CardHeader>
          {!workspaceReady || !membershipsReady ? (
            <p className="text-sm text-muted-foreground">Loading access settings...</p>
          ) : workspaceError || membershipError ? (
            <p className="text-sm text-primary">{workspaceError ?? membershipError}</p>
          ) : (
            <div className="space-y-3">
              <ListCard>
                <p className="font-medium text-foreground">{workspace.name}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Signed in as {profile?.fullName ?? profile?.email ?? "Workspace operator"}
                </p>
                <p className="mt-3 text-xs uppercase tracking-[0.16em] text-primary">
                  {workspace.plan} plan · {workspace.seatCount} seats
                </p>
              </ListCard>
              {members.slice(0, 5).map((member) => (
                <ListCard key={member.id}>
                  <p className="font-medium text-foreground">{member.fullName}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{member.email}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-primary">
                    {member.role} · {member.status}
                  </p>
                </ListCard>
              ))}
              {!members.length ? (
                <EmptyState
                  title="No workspace members"
                  description="Connect auth and invite teammates to manage access here."
                />
              ) : null}
            </div>
          )}
        </Card>

        <Card id="channel-readiness">
          <CardHeader>
            <div>
              <CardDescription>Channel Readiness</CardDescription>
              <CardTitle className="mt-3">Integration health</CardTitle>
            </div>
          </CardHeader>
          {!integrationsReady ? (
            <p className="text-sm text-muted-foreground">Loading integrations...</p>
          ) : integrationsError ? (
            <p className="text-sm text-primary">{integrationsError}</p>
          ) : (
            <div className="space-y-3">
              {connections.map((connection) => (
                <ListCard key={connection.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">{connection.accountLabel}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{connection.provider}</p>
                    </div>
                    <p className="text-xs uppercase tracking-[0.16em] text-primary">
                      {connection.status}
                    </p>
                  </div>
                  {connection.setup?.nextAction ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Next action: {connection.setup.nextAction}
                    </p>
                  ) : null}
                </ListCard>
              ))}
              {!connections.length ? (
                <EmptyState
                  title="No integrations yet"
                  description="Channel readiness will appear here once setup records exist."
                />
              ) : null}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardDescription>Meta Reporting Digest</CardDescription>
            <CardTitle className="mt-3">What Business Suite is contributing</CardTitle>
          </div>
        </CardHeader>
        {!metaReady ? (
          <p className="text-sm text-muted-foreground">Loading Meta digest...</p>
        ) : metaError || !metaSummary ? (
          <p className="text-sm text-primary">{metaError ?? "Unable to load Meta digest."}</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ListCard>
              <p className="text-sm text-muted-foreground">Meta Impressions</p>
              <p className="mt-2 text-2xl text-foreground">{number(metaSummary.totalImpressions)}</p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Meta Clicks</p>
              <p className="mt-2 text-2xl text-foreground">{number(metaSummary.totalClicks)}</p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Meta Covers</p>
              <p className="mt-2 text-2xl text-foreground">{number(metaSummary.totalAttributedCovers)}</p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Meta Revenue</p>
              <p className="mt-2 text-2xl text-foreground">{currency(metaSummary.totalAttributedRevenue)}</p>
            </ListCard>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardDescription>Deep Workspaces</CardDescription>
            <CardTitle className="mt-3">Open the full admin surfaces</CardTitle>
          </div>
        </CardHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <Link className={buttonVariants({ variant: "outline" })} href="/integrations">
            Open integrations
          </Link>
          <Link className={buttonVariants({ variant: "outline" })} href="/admin">
            Open admin
          </Link>
        </div>
      </Card>
    </div>
  );
}
