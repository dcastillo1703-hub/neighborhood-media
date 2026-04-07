"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListCard } from "@/components/dashboard/list-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatGrid } from "@/components/dashboard/stat-grid";
import { MetricCard } from "@/components/metric-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActiveClient } from "@/lib/client-context";
import { summarizeCampaigns } from "@/lib/domain/campaigns";
import { useAnalyticsSnapshots } from "@/lib/repositories/use-analytics-snapshots";
import { useAssets } from "@/lib/repositories/use-assets";
import { useBlogPosts } from "@/lib/repositories/use-blog-posts";
import { useCampaigns } from "@/lib/repositories/use-campaigns";
import { usePosts } from "@/lib/repositories/use-posts";
import { useWeeklyMetrics } from "@/lib/repositories/use-weekly-metrics";
import { currency, number } from "@/lib/utils";
import { validateCampaign } from "@/lib/validation";
import { Campaign, CampaignStatus } from "@/types";

type CampaignDefaultView = "Overview" | "List" | "Board" | "Calendar" | "Performance";

const defaultViewOptions: Array<{
  label: CampaignDefaultView;
  description: string;
}> = [
  { label: "Overview", description: "Brief, content, and next steps in one calm workspace." },
  { label: "List", description: "A linear execution queue for posts and approvals." },
  { label: "Board", description: "Draft, review, scheduled, and published work lanes." },
  { label: "Calendar", description: "A date-first view for launch timing and posting rhythm." },
  { label: "Performance", description: "Covers, tables, and revenue impact once the work is live." }
];

const createEmptyCampaign = (clientId: string): Campaign => ({
  id: "",
  clientId,
  name: "",
  objective: "",
  startDate: "2026-03-10",
  endDate: "2026-03-31",
  channels: [],
  linkedPostIds: [],
  linkedBlogPostIds: [],
  linkedAssetIds: [],
  linkedWeeklyMetricIds: [],
  notes: "",
  status: "Planning"
});

export default function CampaignsPage() {
  const { activeClient } = useActiveClient();
  const { campaigns, addCampaign, deleteCampaign, ready, error } = useCampaigns(activeClient.id);
  const { posts } = usePosts(activeClient.id);
  const { blogPosts } = useBlogPosts(activeClient.id);
  const { assets } = useAssets(activeClient.id);
  const { metrics } = useWeeklyMetrics(activeClient.id);
  const { analyticsSnapshots } = useAnalyticsSnapshots(activeClient.id);
  const [draft, setDraft] = useState<Campaign>(createEmptyCampaign(activeClient.id));
  const [channelDraft, setChannelDraft] = useState("");
  const [defaultView, setDefaultView] = useState<CampaignDefaultView>("Overview");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const campaignOverviews = useMemo(
    () => summarizeCampaigns(campaigns, posts, blogPosts, assets, metrics, analyticsSnapshots),
    [campaigns, posts, blogPosts, assets, metrics, analyticsSnapshots]
  );

  const saveCampaign = () => {
    const result = validateCampaign(draft);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }

    void addCampaign({
        ...draft,
        ...result.data,
        notes: result.data.notes
          ? `${result.data.notes}\n\nDefault workspace view: ${defaultView}`
          : `Default workspace view: ${defaultView}`,
        clientId: activeClient.id
      })
      .then(() => {
        setErrors({});
        setDraft(createEmptyCampaign(activeClient.id));
        setDefaultView("Overview");
        setChannelDraft("");
      })
      .catch(() => {
        setErrors({
          form: "Campaign could not be saved. Check permissions and backend connectivity."
        });
      });
  };

  const addChannel = () => {
    const trimmedChannel = channelDraft.trim();

    if (!trimmedChannel) {
      return;
    }

    setDraft((current) => ({
      ...current,
      channels: current.channels.includes(trimmedChannel)
        ? current.channels
        : [...current.channels, trimmedChannel]
    }));
    setChannelDraft("");
    setErrors((current) => {
      if (!current.channels) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors.channels;
      return nextErrors;
    });
  };

  const removeChannel = (channelToRemove: string) => {
    setDraft((current) => ({
      ...current,
      channels: current.channels.filter((channel) => channel !== channelToRemove)
    }));
  };

  const removeCampaign = (campaignId: string, campaignName: string) => {
    const confirmed = window.confirm(
      `Archive "${campaignName}"? Linked content records will remain, and the campaign will be removed from active views.`
    );

    if (!confirmed) {
      return;
    }

    deleteCampaign(campaignId);
  };

  if (!ready) {
    return <div className="text-sm text-muted-foreground">Loading campaigns...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive">{error}</div>;
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Campaign management"
        title="Campaigns"
        description="Start with a simple campaign shell, then run content, approvals, calendar, and performance from the campaign workspace."
        actions={
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/calendar">
            Open campaign calendar
          </Link>
        }
      />

      <StatGrid>
        <MetricCard href="/campaigns#campaign-overview" label="Active Campaigns" value={number(campaigns.filter((campaign) => campaign.status === "Active").length)} detail="Live initiatives influencing current dining demand." />
        <MetricCard href="/content#scheduled-content" label="Linked Posts" value={number(posts.filter((post) => post.campaignId).length)} detail="Posts connected to a named campaign." />
        <MetricCard href="/performance#business-snapshot" label="Linked Metrics" value={number(metrics.filter((metric) => metric.campaignId).length)} detail="Weekly records tied back to campaign performance." />
        <MetricCard href="/performance#campaign-impact" label="Attributed Revenue" value={currency(analyticsSnapshots.reduce((sum, item) => sum + item.attributedRevenue, 0))} detail="Revenue currently attributed to campaign-linked analytics." tone="olive" />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card id="new-campaign">
          <CardHeader>
            <div>
              <CardDescription>New Campaign</CardDescription>
              <CardTitle className="mt-3">Create a campaign shell</CardTitle>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                Keep this first step light. Add content, approvals, and performance once the campaign workspace exists.
              </p>
            </div>
          </CardHeader>
          <div className="grid gap-4">
            <div>
              <Label>Campaign Name</Label>
              <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
              {errors.name ? <p className="mt-2 text-xs text-primary">{errors.name}</p> : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Objective</Label>
                <Input
                  value={draft.objective}
                  placeholder="Ex. Fill Tuesday dinner seats"
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, objective: event.target.value }))
                  }
                />
                {errors.objective ? <p className="mt-2 text-xs text-primary">{errors.objective}</p> : null}
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={draft.status}
                  onChange={(value) => setDraft((current) => ({ ...current, status: value as CampaignStatus }))}
                  options={["Planning", "Active", "Completed"].map((value) => ({ label: value, value }))}
                />
              </div>
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={draft.startDate} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))} />
                {errors.startDate ? <p className="mt-2 text-xs text-primary">{errors.startDate}</p> : null}
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={draft.endDate} onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))} />
                {errors.endDate ? <p className="mt-2 text-xs text-primary">{errors.endDate}</p> : null}
              </div>
            </div>
            <div>
              <Label>Channels</Label>
              <div className="rounded-2xl border border-border bg-card/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
                <div className="flex flex-col gap-3 md:flex-row">
                  <Input
                    value={channelDraft}
                    placeholder="Ex. Instagram Reels, SMS, OpenTable, Door signage"
                    onChange={(event) => setChannelDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addChannel();
                      }
                    }}
                  />
                  <Button className="w-full md:w-auto" type="button" variant="outline" onClick={addChannel}>
                    Add Channel
                  </Button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {draft.channels.length ? (
                    draft.channels.map((channel) => (
                      <button
                        key={channel}
                        type="button"
                        className="inline-flex items-center rounded-full"
                        onClick={() => removeChannel(channel)}
                      >
                        <Badge className="cursor-pointer normal-case tracking-[0.12em]">
                          {channel} ×
                        </Badge>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Add the exact channels this campaign will use. Nothing is pre-defined.
                    </p>
                  )}
                </div>
              </div>
              {errors.channels ? <p className="mt-2 text-xs text-primary">{errors.channels}</p> : null}
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
            </div>
            <div>
              <Label>Default Workspace View</Label>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {defaultViewOptions.map((option) => {
                  const selected = option.label === defaultView;

                  return (
                    <button
                      key={option.label}
                      className={[
                        "rounded-3xl border px-4 py-4 text-left transition",
                        selected
                          ? "border-primary/45 bg-primary/10 shadow-[0_14px_35px_rgba(149,114,46,0.12)]"
                          : "border-border bg-card/70 hover:border-primary/25 hover:bg-primary/5"
                      ].join(" ")}
                      type="button"
                      onClick={() => setDefaultView(option.label)}
                    >
                      <span className="block text-sm font-medium text-foreground">{option.label}</span>
                      <span className="mt-2 block text-xs leading-5 text-muted-foreground">{option.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {errors.form ? <p className="text-xs text-primary">{errors.form}</p> : null}
            <Button className="w-full sm:w-auto" onClick={saveCampaign}>Create Campaign</Button>
          </div>
        </Card>

        <Card id="campaign-overview">
          <CardHeader>
            <div>
              <CardDescription>Campaign Overview</CardDescription>
              <CardTitle className="mt-3">Current operating campaigns</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-4">
            {campaignOverviews.length ? (
              campaignOverviews.map((overview) => (
                <ListCard key={overview.campaign.id}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.16em] text-primary">{overview.campaign.status}</p>
                      <Link
                        className="mt-2 inline-block text-balance font-display text-2xl text-foreground transition hover:text-primary"
                        href={`/campaigns/${overview.campaign.id}`}
                      >
                        {overview.campaign.name}
                      </Link>
                      <p className="mt-2 text-sm text-foreground">{overview.campaign.objective}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{overview.campaign.notes}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
                      {overview.campaign.channels.map((channel) => (
                        <Badge
                          key={`${overview.campaign.id}-${channel}`}
                          className="normal-case tracking-[0.12em]"
                        >
                          {channel}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    <p className="text-sm text-muted-foreground">Posts: {overview.linkedPosts.length}</p>
                    <p className="text-sm text-muted-foreground">Blogs: {overview.linkedBlogs.length}</p>
                    <p className="text-sm text-muted-foreground">Assets: {overview.linkedAssets.length}</p>
                    <p className="text-sm text-muted-foreground">Metrics: {overview.linkedMetrics.length}</p>
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-3">
                    <div className="rounded-2xl border border-border/60 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Revenue</p>
                      <p className="mt-2 text-lg text-foreground">{currency(overview.attributedRevenue)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Covers</p>
                      <p className="mt-2 text-lg text-foreground">{number(overview.attributedCovers)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tables</p>
                      <p className="mt-2 text-lg text-foreground">{number(overview.attributedTables, 1)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Link
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                      href={`/campaigns/${overview.campaign.id}`}
                    >
                      Open Campaign
                    </Link>
                    <div className="flex sm:justify-end">
                      <Button
                        className="w-full sm:w-auto"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          removeCampaign(overview.campaign.id, overview.campaign.name)
                        }
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Archive Campaign
                      </Button>
                    </div>
                  </div>
                </ListCard>
              ))
            ) : (
              <EmptyState title="No campaigns yet" description="Create the first campaign to unify posts, blogs, assets, and metrics around a business objective." />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
