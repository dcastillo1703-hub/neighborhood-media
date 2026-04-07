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
import { DatePill } from "@/components/ui/date-pill";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { useActiveClient } from "@/lib/client-context";
import { useClientMemberships } from "@/lib/repositories/use-client-memberships";
import { useIntegrations } from "@/lib/repositories/use-integrations";
import { appAccents, useTheme } from "@/lib/theme-context";
import { useManualMetaPerformance } from "@/lib/use-manual-meta-performance";
import { useMetaBusinessSuite } from "@/lib/use-meta-business-suite";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { currency, number } from "@/lib/utils";

export default function SettingsPage() {
  const { activeClient } = useActiveClient();
  const { mode, profile } = useAuth();
  const { accent, accentKey, setAccentKey } = useTheme();
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
  const {
    config: manualMeta,
    enabledChannels: manualMetaChannels,
    totals: manualMetaTotals,
    updateChannel: updateManualMetaChannel,
    reset: resetManualMeta
  } = useManualMetaPerformance(activeClient.id);
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

      <Card id="account-appearance">
        <CardHeader>
          <div>
            <CardDescription>Account Appearance</CardDescription>
            <CardTitle className="mt-3">Customize the workspace accent</CardTitle>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              This updates the app&apos;s actual CSS variables, so buttons, highlights, campaign headers, and mobile controls inherit the selected accent.
            </p>
          </div>
        </CardHeader>
        <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[1.75rem] border border-border bg-card/65 p-5">
            <p className="text-sm font-medium text-foreground">Current accent</p>
            <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-border">
              <div className="px-5 py-6" style={{ backgroundColor: accent.bg, color: accent.text }}>
                <p className="text-xs uppercase tracking-[0.18em] opacity-70">Preview</p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{accent.label} workspace</p>
              </div>
              <div className="space-y-3 bg-[#202024] p-5 text-white">
                <div className="rounded-2xl bg-white/5 px-4 py-3">
                  Campaign controls use this accent.
                </div>
                <div className="flex gap-2">
                  <span className="rounded-full px-3 py-1 text-xs" style={{ backgroundColor: accent.soft, color: accent.bg }}>
                    Status
                  </span>
                  <span className="rounded-full px-3 py-1 text-xs" style={{ backgroundColor: accent.bg, color: accent.text }}>
                    Action
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {appAccents.map((option) => {
              const selected = option.key === accentKey;

              return (
                <button
                  className={[
                    "rounded-[1.5rem] border p-4 text-left transition",
                    selected
                      ? "border-primary/50 bg-primary/10 shadow-[0_16px_40px_rgba(149,114,46,0.12)]"
                      : "border-border bg-card/70 hover:border-primary/25 hover:bg-accent/25"
                  ].join(" ")}
                  key={option.key}
                  type="button"
                  onClick={() => setAccentKey(option.key)}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className="h-9 w-9 rounded-full border border-black/10"
                      style={{ backgroundColor: option.bg }}
                    />
                    <span>
                      <span className="block text-sm font-medium text-foreground">{option.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

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

      <Card id="manual-meta-performance">
        <CardHeader>
          <div>
            <CardDescription>Manual Meta Performance</CardDescription>
            <CardTitle className="mt-3">Configure the digest before live API sync</CardTitle>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              Use this as the temporary source of truth for Facebook and Instagram. Once OAuth/API sync is stable,
              these same fields can be filled automatically by Meta.
            </p>
          </div>
          <Button variant="outline" onClick={resetManualMeta}>
            Reset manual Meta
          </Button>
        </CardHeader>
        <div className="grid gap-4 xl:grid-cols-2">
          {manualMeta.channels.map((channel) => (
            <div className="rounded-[1.75rem] border border-border bg-card/65 p-5" key={channel.provider}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold capitalize text-foreground">{channel.provider}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {channel.enabled ? "Included in the digest" : "Hidden from the digest"}
                  </p>
                </div>
                <button
                  className={[
                    "rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] transition",
                    channel.enabled
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card/70 text-muted-foreground"
                  ].join(" ")}
                  type="button"
                  onClick={() => updateManualMetaChannel(channel.provider, { enabled: !channel.enabled })}
                >
                  {channel.enabled ? "Enabled" : "Enable"}
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Account name</Label>
                  <Input
                    value={channel.accountLabel}
                    onChange={(event) =>
                      updateManualMetaChannel(channel.provider, { accountLabel: event.target.value })
                    }
                    placeholder="Meama Instagram"
                  />
                </div>
                <div>
                  <Label>Handle or page</Label>
                  <Input
                    value={channel.handle}
                    onChange={(event) =>
                      updateManualMetaChannel(channel.provider, { handle: event.target.value })
                    }
                    placeholder="@restaurant"
                  />
                </div>
                <div>
                  <Label>Period</Label>
                  <Input
                    value={channel.periodLabel}
                    onChange={(event) =>
                      updateManualMetaChannel(channel.provider, { periodLabel: event.target.value })
                    }
                    placeholder="This week"
                  />
                </div>
                <div>
                  <Label>Impressions</Label>
                  <Input
                    min={0}
                    type="number"
                    value={channel.impressions}
                    onChange={(event) =>
                      updateManualMetaChannel(channel.provider, { impressions: Number(event.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <Label>Reach</Label>
                  <Input
                    min={0}
                    type="number"
                    value={channel.reach}
                    onChange={(event) =>
                      updateManualMetaChannel(channel.provider, { reach: Number(event.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <Label>Clicks</Label>
                  <Input
                    min={0}
                    type="number"
                    value={channel.clicks}
                    onChange={(event) =>
                      updateManualMetaChannel(channel.provider, { clicks: Number(event.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <Label>Engagement</Label>
                  <Input
                    min={0}
                    type="number"
                    value={channel.engagement}
                    onChange={(event) =>
                      updateManualMetaChannel(channel.provider, { engagement: Number(event.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <Label>Attributed covers</Label>
                  <Input
                    min={0}
                    type="number"
                    value={channel.attributedCovers}
                    onChange={(event) =>
                      updateManualMetaChannel(channel.provider, { attributedCovers: Number(event.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <Label>Attributed revenue</Label>
                  <Input
                    min={0}
                    type="number"
                    value={channel.attributedRevenue}
                    onChange={(event) =>
                      updateManualMetaChannel(channel.provider, { attributedRevenue: Number(event.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Top post</Label>
                  <Textarea
                    value={channel.topPost}
                    onChange={(event) =>
                      updateManualMetaChannel(channel.provider, { topPost: event.target.value })
                    }
                    placeholder="Best performing reel, carousel, or post."
                  />
                </div>
                <div>
                  <Label>Next action</Label>
                  <Textarea
                    value={channel.nextAction}
                    onChange={(event) =>
                      updateManualMetaChannel(channel.provider, { nextAction: event.target.value })
                    }
                    placeholder="What should the client understand or do next?"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <ListCard>
            <p className="text-sm text-muted-foreground">Manual channels</p>
            <p className="mt-2 text-2xl text-foreground">{number(manualMetaChannels.length)}</p>
          </ListCard>
          <ListCard>
            <p className="text-sm text-muted-foreground">Manual impressions</p>
            <p className="mt-2 text-2xl text-foreground">{number(manualMetaTotals.impressions)}</p>
          </ListCard>
          <ListCard>
            <p className="text-sm text-muted-foreground">Manual covers</p>
            <p className="mt-2 text-2xl text-foreground">{number(manualMetaTotals.attributedCovers)}</p>
          </ListCard>
          <ListCard>
            <p className="text-sm text-muted-foreground">Last updated</p>
            <p className="mt-2">
              <DatePill value={manualMeta.updatedAt} fallback="Not set" />
            </p>
          </ListCard>
        </div>
      </Card>

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
              <p className="mt-2 text-2xl text-foreground">
                {number(manualMetaChannels.length ? manualMetaTotals.impressions : metaSummary.totalImpressions)}
              </p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Meta Clicks</p>
              <p className="mt-2 text-2xl text-foreground">
                {number(manualMetaChannels.length ? manualMetaTotals.clicks : metaSummary.totalClicks)}
              </p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Meta Covers</p>
              <p className="mt-2 text-2xl text-foreground">
                {number(manualMetaChannels.length ? manualMetaTotals.attributedCovers : metaSummary.totalAttributedCovers)}
              </p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Meta Revenue</p>
              <p className="mt-2 text-2xl text-foreground">
                {currency(manualMetaChannels.length ? manualMetaTotals.attributedRevenue : metaSummary.totalAttributedRevenue)}
              </p>
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
