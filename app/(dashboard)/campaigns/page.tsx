"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LayoutList, Plus, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListCard } from "@/components/dashboard/list-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePill } from "@/components/ui/date-pill";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const statusOptions: CampaignStatus[] = ["Planning", "Active", "Completed"];

function formatDateKey(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function addDays(date: Date, amount: number) {
  const nextDate = new Date(date);
  nextDate.setDate(date.getDate() + amount);

  return nextDate;
}

const createEmptyCampaign = (clientId: string): Campaign => ({
  id: "",
  clientId,
  name: "",
  objective: "",
  startDate: formatDateKey(new Date()),
  endDate: formatDateKey(addDays(new Date(), 21)),
  channels: [],
  linkedPostIds: [],
  linkedBlogPostIds: [],
  linkedAssetIds: [],
  linkedWeeklyMetricIds: [],
  notes: "",
  status: "Planning"
});

export default function CampaignsPage() {
  const router = useRouter();
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
  const [mobileProjectTab, setMobileProjectTab] = useState<"Recents" | "Starred" | "Member of">("Member of");
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const campaignOverviews = useMemo(
    () => summarizeCampaigns(campaigns, posts, blogPosts, assets, metrics, analyticsSnapshots),
    [campaigns, posts, blogPosts, assets, metrics, analyticsSnapshots]
  );

  const resetCreateState = () => {
    setDraft(createEmptyCampaign(activeClient.id));
    setDefaultView("Overview");
    setChannelDraft("");
    setErrors({});
  };

  const closeCreate = () => {
    setCreateOpen(false);
    resetCreateState();
  };

  const saveCampaign = async () => {
    const result = validateCampaign(draft);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }

    setSaving(true);

    try {
      const payload = await addCampaign({
        clientId: activeClient.id,
        name: result.data.name,
        objective: result.data.objective,
        startDate: result.data.startDate,
        endDate: result.data.endDate,
        channels: result.data.channels,
        linkedPostIds: [],
        linkedBlogPostIds: [],
        linkedAssetIds: [],
        linkedWeeklyMetricIds: [],
        notes: result.data.notes
          ? `${result.data.notes}\n\nDefault workspace view: ${defaultView}`
          : `Default workspace view: ${defaultView}`,
        status: result.data.status
      });

      resetCreateState();
      setCreateOpen(false);
      router.push(`/campaigns/${payload.campaign.id}` as never);
    } catch (saveError) {
      setErrors({
        form: saveError instanceof Error ? saveError.message : "Campaign could not be saved."
      });
    } finally {
      setSaving(false);
    }
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
    <div className="space-y-6">
      <PageHeader
        className="hidden sm:flex"
        eyebrow="Campaign management"
        title="Campaigns"
        description="Create a simple campaign shell first, then run content, approvals, calendar, and performance from inside that campaign."
        actions={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/calendar">
              Calendar
            </Link>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Campaign
            </Button>
          </div>
        }
      />

      <div className="-mx-3 -mt-3 min-h-[calc(100vh-4rem)] bg-[#202024] px-4 pb-28 pt-7 text-white sm:hidden">
        <div className="relative flex items-center justify-center">
          <p className="text-center text-xl font-semibold tracking-[-0.03em]">Projects</p>
          <button className="absolute right-0 rounded-full bg-white/5 p-2 text-white/70" type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-7 grid grid-cols-3 border-b border-white/12 text-center text-base font-semibold text-white/45">
          {(["Recents", "Starred", "Member of"] as const).map((tab) => (
            <button
              className={[
                "pb-3 transition",
                mobileProjectTab === tab ? "border-b-2 border-white text-white" : "text-white/45"
              ].join(" ")}
              key={tab}
              type="button"
              onClick={() => setMobileProjectTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="mx-auto mt-6 max-w-sm space-y-1">
          {campaignOverviews.length ? (
            campaignOverviews.map((overview, index) => (
              <div
                className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-2xl px-3 py-2 transition hover:bg-white/5"
                key={`${overview.campaign.id}-mobile`}
              >
                <Link
                  className="flex min-w-0 items-center gap-3 py-1"
                  href={`/campaigns/${overview.campaign.id}` as never}
                >
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[#202024]"
                    style={{ backgroundColor: ["#b8c4a0", "#c7a25b", "#92a7d9", "#f06b4f"][index % 4] }}
                  >
                    <LayoutList className="h-6 w-6" />
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-xl font-medium text-white">{overview.campaign.name}</p>
                    <p className="mt-1 truncate text-sm text-white/45">{overview.campaign.objective}</p>
                  </div>
                </Link>
                <button
                  aria-label={`Delete ${overview.campaign.name}`}
                  className="rounded-full border border-white/10 p-2 text-white/45 transition hover:border-white/25 hover:text-white"
                  type="button"
                  onClick={() => removeCampaign(overview.campaign.id, overview.campaign.name)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          ) : (
            <div className="rounded-[2rem] border border-white/12 p-6 text-white/65">
              <p className="text-xl text-white">No campaigns yet</p>
              <p className="mt-2 text-sm">Start with one campaign shell, then add posts and approvals inside it.</p>
            </div>
          )}
        </div>
        <Button
          className="fixed bottom-[6rem] right-4 z-40 h-[3.25rem] rounded-[1.25rem] bg-[#f06b4f] px-5 text-sm text-white shadow-[0_18px_50px_rgba(0,0,0,0.3)]"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-2 h-5 w-5" />
          New campaign
        </Button>
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/20 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-10">
          <Card id="new-campaign" className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-[1.25rem] p-4 sm:max-h-none sm:rounded-[1.5rem] sm:p-6">
            <CardHeader className="px-0 pt-0 sm:px-0">
              <div>
                <CardDescription>New Campaign</CardDescription>
                <CardTitle className="mt-3">Create a campaign shell</CardTitle>
                <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                  Name the campaign, choose the work style, and open the workspace. Add content after that.
                </p>
              </div>
              <button
                aria-label="Close create campaign"
                className="rounded-full border border-border bg-card/80 p-2 text-muted-foreground transition hover:text-foreground"
                type="button"
                onClick={closeCreate}
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <div className="grid gap-4">
              <div className="grid gap-3 rounded-[1.15rem] border border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground sm:grid-cols-3">
                <div>
                  <p className="font-medium text-foreground">1. Create shell</p>
                  <p className="mt-1">Keep the setup light.</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">2. Add tasks</p>
                  <p className="mt-1">Content, meetings, or ops work.</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">3. Track ROI</p>
                  <p className="mt-1">Connect effort to covers and revenue.</p>
                </div>
              </div>
              <div>
                <Label>Campaign Name</Label>
                <Input
                  value={draft.name}
                  placeholder="Ex. Brunch rollout"
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                />
                {errors.name ? <p className="mt-2 text-xs text-primary">{errors.name}</p> : null}
              </div>
              <div>
                <Label>Objective</Label>
                <Input
                  value={draft.objective}
                  placeholder="Ex. Grow weekend brunch covers"
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, objective: event.target.value }))
                  }
                />
                {errors.objective ? <p className="mt-2 text-xs text-primary">{errors.objective}</p> : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Start Date</Label>
                  <Input
                    className="h-10 px-3 text-[0.84rem] [color-scheme:light] [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left"
                    type="date"
                    value={draft.startDate}
                    onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))}
                  />
                  {errors.startDate ? <p className="mt-2 text-xs text-primary">{errors.startDate}</p> : null}
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input
                    className="h-10 px-3 text-[0.84rem] [color-scheme:light] [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left"
                    type="date"
                    value={draft.endDate}
                    onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))}
                  />
                  {errors.endDate ? <p className="mt-2 text-xs text-primary">{errors.endDate}</p> : null}
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {statusOptions.map((status) => {
                    const selected = draft.status === status;

                    return (
                      <button
                        key={status}
                        className={[
                          "rounded-full border px-4 py-2 text-sm transition",
                          selected
                            ? "border-primary/45 bg-primary/10 text-foreground"
                            : "border-border bg-card/70 text-muted-foreground hover:border-primary/25 hover:text-foreground"
                        ].join(" ")}
                        type="button"
                        onClick={() => setDraft((current) => ({ ...current, status }))}
                      >
                        {status}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label>Channels</Label>
                <div className="mt-2 rounded-3xl border border-border bg-card/70 p-4">
                  <div className="flex flex-col gap-3 md:flex-row">
                    <Input
                      value={channelDraft}
                      placeholder="Ex. Instagram, TikTok, email"
                      onChange={(event) => setChannelDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addChannel();
                        }
                      }}
                    />
                    <Button className="w-full md:w-auto" type="button" variant="outline" onClick={addChannel}>
                      Add
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
                      <p className="text-sm text-muted-foreground">Add the channels this campaign will use.</p>
                    )}
                  </div>
                </div>
                {errors.channels ? <p className="mt-2 text-xs text-primary">{errors.channels}</p> : null}
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
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={draft.notes}
                  placeholder="Optional internal context"
                  onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                />
              </div>
              {errors.form ? <p className="text-xs text-primary">{errors.form}</p> : null}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={closeCreate}>
                  Cancel
                </Button>
                <Button disabled={saving} onClick={saveCampaign}>
                  {saving ? "Creating..." : "Create Campaign"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      <Card id="campaign-overview" className="hidden overflow-hidden p-0 sm:block">
        <CardHeader className="items-center border-b border-border/70 px-5 py-4">
          <div>
            <CardDescription>Campaigns</CardDescription>
            <CardTitle className="mt-2">Project list</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">{number(campaigns.length)} total</p>
        </CardHeader>
        <div className="hidden border-b border-border/70 bg-muted/30 px-5 py-2 text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground lg:grid lg:grid-cols-[minmax(0,1.2fr)_8rem_10rem_6rem_8rem_7rem]">
          <span>Name</span>
          <span>Status</span>
          <span>Dates</span>
          <span>Posts</span>
          <span>Revenue</span>
          <span />
        </div>
        <div className="divide-y divide-border/70">
          {campaignOverviews.length ? (
            campaignOverviews.map((overview) => (
              <ListCard key={overview.campaign.id} className="rounded-none border-0 bg-transparent px-5 py-4 hover:bg-primary/5">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_9rem_10rem_8rem_8rem_8rem] lg:items-center">
                  <div className="min-w-0">
                    <Link
                      className="text-balance font-display text-xl text-foreground transition hover:text-primary"
                      href={`/campaigns/${overview.campaign.id}` as never}
                    >
                      {overview.campaign.name}
                    </Link>
                    <p className="mt-2 text-sm text-foreground">{overview.campaign.objective}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
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
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground lg:hidden">Status</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-primary lg:mt-0">
                      {overview.campaign.status}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground lg:hidden">Dates</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 lg:mt-0">
                      <DatePill value={overview.campaign.startDate} />
                      <span className="text-xs text-muted-foreground">to</span>
                      <DatePill value={overview.campaign.endDate} />
                    </div>
                  </div>
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground lg:hidden">Posts</p>
                    <p className="mt-1 text-sm text-muted-foreground lg:mt-0">{number(overview.linkedPosts.length)}</p>
                  </div>
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground lg:hidden">Revenue</p>
                    <p className="mt-1 text-sm text-muted-foreground lg:mt-0">{currency(overview.attributedRevenue)}</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                    <Link
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                      href={`/campaigns/${overview.campaign.id}` as never}
                    >
                      Open
                    </Link>
                    <Button
                      className="w-full sm:w-auto"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        removeCampaign(overview.campaign.id, overview.campaign.name)
                      }
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Archive
                    </Button>
                  </div>
                </div>
              </ListCard>
            ))
          ) : (
            <EmptyState
              title="No campaigns yet"
              description="Create a campaign shell first. Then open it to plan content, approvals, calendar timing, and performance."
              action={
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Campaign
                </Button>
              }
            />
          )}
        </div>
      </Card>
    </div>
  );
}
