"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronUp, LayoutList, MoreHorizontal, Plus } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ListCard } from "@/components/dashboard/list-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePill } from "@/components/ui/date-pill";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { useActiveClient } from "@/lib/client-context";
import { getCampaignOverview } from "@/lib/domain/campaigns";
import { useAnalyticsSnapshots } from "@/lib/repositories/use-analytics-snapshots";
import { useAssets } from "@/lib/repositories/use-assets";
import { useBlogPosts } from "@/lib/repositories/use-blog-posts";
import { useCampaigns } from "@/lib/repositories/use-campaigns";
import { usePosts } from "@/lib/repositories/use-posts";
import { useWeeklyMetrics } from "@/lib/repositories/use-weekly-metrics";
import { useTheme } from "@/lib/theme-context";
import { useApprovalsApi } from "@/lib/use-approvals-api";
import { usePublishingApi } from "@/lib/use-publishing-api";
import { currency, number } from "@/lib/utils";
import { validatePost } from "@/lib/validation";
import { Post, PostStatus } from "@/types";

type CampaignWorkspaceView = "overview" | "list" | "board" | "calendar" | "performance";
type CampaignBoardLane = "Draft" | "Review" | "Scheduled" | "Published";

const campaignViews: Array<{
  id: CampaignWorkspaceView;
  label: string;
  description: string;
}> = [
  { id: "overview", label: "Overview", description: "Brief and new content" },
  { id: "list", label: "List", description: "Every work item" },
  { id: "board", label: "Board", description: "Status lanes" },
  { id: "calendar", label: "Calendar", description: "Scheduled dates" },
  { id: "performance", label: "Performance", description: "Covers and revenue" }
];

const boardLanes: CampaignBoardLane[] = ["Draft", "Review", "Scheduled", "Published"];

function createCampaignPost(clientId: string, campaignId: string): Post {
  return {
    id: "",
    clientId,
    campaignId,
    platform: "Instagram",
    content: "",
    cta: "",
    publishDate: "",
    goal: "",
    status: "Draft",
    assetIds: []
  };
}

export default function CampaignDetailPage() {
  const params = useParams<{ campaignId: string }>();
  const campaignId = params.campaignId;
  const { activeClient } = useActiveClient();
  const { profile } = useAuth();
  const { accent } = useTheme();
  const { campaigns, ready: campaignsReady, error: campaignsError } = useCampaigns(activeClient.id);
  const { posts, addPost, ready: postsReady, error: postsError } = usePosts(activeClient.id);
  const { blogPosts } = useBlogPosts(activeClient.id);
  const { assets } = useAssets(activeClient.id);
  const { metrics } = useWeeklyMetrics(activeClient.id);
  const { analyticsSnapshots } = useAnalyticsSnapshots(activeClient.id);
  const { approvals, ready: approvalsReady, reviewApproval } = useApprovalsApi(activeClient.id);
  const { jobs, ready: jobsReady, processJob } = usePublishingApi(activeClient.id);
  const [draft, setDraft] = useState<Post>(() => createCampaignPost(activeClient.id, campaignId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<CampaignWorkspaceView>("overview");

  const campaign = campaigns.find((item) => item.id === campaignId) ?? null;
  const overview = useMemo(
    () =>
      campaign
        ? getCampaignOverview(campaign, posts, blogPosts, assets, metrics, analyticsSnapshots)
        : null,
    [analyticsSnapshots, assets, blogPosts, campaign, metrics, posts]
  );

  const linkedPostIds = useMemo(
    () => new Set(overview?.linkedPosts.map((post) => post.id) ?? []),
    [overview]
  );

  const campaignApprovals = useMemo(
    () => approvals.filter((approval) => linkedPostIds.has(approval.entityId)),
    [approvals, linkedPostIds]
  );
  const campaignPublishJobs = useMemo(
    () => jobs.filter((job) => linkedPostIds.has(job.postId)),
    [jobs, linkedPostIds]
  );
  const scheduledPosts = useMemo(
    () =>
      (overview?.linkedPosts ?? [])
        .filter((post) => post.publishDate)
        .sort((left, right) => left.publishDate.localeCompare(right.publishDate)),
    [overview]
  );
  const linkedPosts = overview?.linkedPosts ?? [];
  const pendingReviews = campaignApprovals.filter((approval) => approval.status === "Pending").length;
  const queuedPublishJobs = campaignPublishJobs.filter((job) =>
    ["Queued", "Processing", "Blocked"].includes(job.status)
  ).length;

  const getPostApproval = (postId: string) =>
    campaignApprovals.find((item) => item.entityId === postId);
  const getPostPublishJob = (postId: string) =>
    campaignPublishJobs.find((item) => item.postId === postId);
  const getBoardLanePosts = (lane: CampaignBoardLane) =>
    linkedPosts.filter((post) => {
      const approval = getPostApproval(post.id);

      if (lane === "Review") {
        return approval?.status === "Pending" || approval?.status === "Changes Requested";
      }

      return post.status === lane;
    });

  const savePost = async (status: PostStatus) => {
    const result = validatePost({ ...draft, status });

    if (!result.success) {
      setErrors(result.errors);
      return;
    }

    setSaving(true);

    try {
      await addPost({
        ...draft,
        ...result.data,
        clientId: activeClient.id,
        campaignId,
        status
      });
      setDraft(createCampaignPost(activeClient.id, campaignId));
      setErrors({});
    } catch (error) {
      setErrors({
        form: error instanceof Error ? error.message : "Unable to create post for campaign."
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async (
    approvalId: string,
    status: "Approved" | "Changes Requested"
  ) => {
    setReviewingId(approvalId);

    try {
      await reviewApproval(approvalId, {
        status,
        approverName: profile?.fullName ?? profile?.email ?? "Workspace reviewer",
        approverUserId: profile?.id,
        note:
          status === "Approved"
            ? "Approved from the campaign workspace."
            : "Requested revisions from the campaign workspace."
      });
    } finally {
      setReviewingId(null);
    }
  };

  const runPublishJob = async (jobId: string) => {
    setProcessingJobId(jobId);

    try {
      await processJob(jobId);
    } finally {
      setProcessingJobId(null);
    }
  };

  if (!campaignsReady || !postsReady || !approvalsReady || !jobsReady) {
    return <div className="text-sm text-muted-foreground">Loading campaign workspace...</div>;
  }

  if (campaignsError || postsError) {
    return <div className="text-sm text-destructive">{campaignsError ?? postsError}</div>;
  }

  if (!campaign || !overview) {
    return (
      <div className="space-y-10">
        <PageHeader
          eyebrow="Campaign"
          title="Campaign not found"
          description="This campaign could not be found for the active client."
          actions={
            <Link className={buttonVariants({ variant: "outline" })} href="/campaigns">
              Back to campaigns
            </Link>
          }
        />
        <EmptyState
          title="Campaign unavailable"
          description="Go back to campaigns and open a campaign that exists in the current client workspace."
        />
      </div>
    );
  }

  const activeViewLabel = campaignViews.find((view) => view.id === activeView)?.label ?? "Overview";

  return (
    <div className="space-y-10 pb-28 sm:pb-0">
      <div
        className="-mx-3 -mt-4 px-5 pb-8 pt-8 sm:hidden"
        style={{ backgroundColor: accent.bg, color: accent.text }}
      >
        <div className="flex items-center justify-between gap-4">
          <Link className="inline-flex items-center gap-2 text-lg" href="/campaigns">
            <ChevronLeft className="h-5 w-5" />
            Projects
          </Link>
          <div className="flex items-center gap-3">
            <button className="inline-flex h-9 items-center rounded-full px-2.5" style={{ backgroundColor: accent.panel }} type="button">
              <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold" style={{ backgroundColor: accent.soft }}>
                DC
              </span>
              <Plus className="ml-1 h-4 w-4" />
            </button>
            <MoreHorizontal className="h-6 w-6" />
          </div>
        </div>
        <div className="mt-8 flex items-center gap-4">
          <LayoutList className="h-8 w-8" />
          <h1 className="text-5xl font-semibold tracking-[-0.06em]">{campaign.name}</h1>
        </div>
      </div>

      <PageHeader
        className="hidden sm:flex"
        eyebrow="Campaign workspace"
        title={campaign.name}
        description={`${campaign.objective} · ${campaign.startDate} to ${campaign.endDate}`}
        actions={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link className={buttonVariants({ variant: "outline" })} href="/campaigns">
              Back to campaigns
            </Link>
            <Link className={buttonVariants({ variant: "outline" })} href="/calendar">
              View calendar
            </Link>
          </div>
        }
      />

      <Card id="campaign-workspace" className="hidden overflow-hidden p-0 sm:block">
        <div className="border-b border-border/70 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="normal-case tracking-[0.14em]">{campaign.status}</Badge>
                <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {campaign.startDate} to {campaign.endDate}
                </span>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{campaign.objective}</p>
            </div>
            <Button className="w-full sm:w-auto" onClick={() => setActiveView("overview")}>
              Add Content
            </Button>
          </div>
          <div className="mt-5 grid gap-2 text-sm sm:grid-cols-4">
            <div className="rounded-2xl border border-border/70 bg-card/65 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Posts</p>
              <p className="mt-2 text-lg text-foreground">{number(linkedPosts.length)}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card/65 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Reviews</p>
              <p className="mt-2 text-lg text-foreground">{number(pendingReviews)}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card/65 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Publishing</p>
              <p className="mt-2 text-lg text-foreground">{number(queuedPublishJobs)}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card/65 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Revenue</p>
              <p className="mt-2 text-lg text-foreground">{currency(overview.attributedRevenue)}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto px-3 py-3 sm:px-4">
          {campaignViews.map((view) => {
            const selected = activeView === view.id;

            return (
              <button
                key={view.id}
                className={[
                  "min-w-[9rem] rounded-full border px-4 py-2.5 text-left transition",
                  selected
                    ? "border-primary/45 bg-primary/10 text-foreground shadow-[0_12px_30px_rgba(149,114,46,0.12)]"
                    : "border-border bg-card/60 text-muted-foreground hover:border-primary/25 hover:bg-primary/5 hover:text-foreground"
                ].join(" ")}
                type="button"
                onClick={() => setActiveView(view.id)}
              >
                <span className="block text-sm font-medium">{view.label}</span>
                <span className="mt-1 block text-[0.68rem] leading-4 opacity-80">{view.description}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {activeView === "overview" ? (
      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <Card className="border-[#3a3a40]/70 bg-[#202024] text-white shadow-none sm:hidden">
          <div className="rounded-[1.5rem] border border-white/15 p-5">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-white/35" />
                <span className="text-xl font-semibold">No status</span>
              </div>
              <MoreHorizontal className="h-5 w-5 text-white/60" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/5 px-5 py-4 text-center">
                <p className="text-sm text-white/50">Reviews</p>
                <p className="mt-3 text-4xl text-white/45">{number(pendingReviews)}</p>
              </div>
              <div className="rounded-2xl bg-white/5 px-5 py-4 text-center">
                <p className="text-sm text-white/50">Due</p>
                <p className="mt-3 text-4xl text-white/45">{number(queuedPublishJobs)}</p>
              </div>
            </div>
            <div className="mt-5 h-2 rounded-full bg-white/5">
              <div
                className="h-2 rounded-full"
                style={{ backgroundColor: accent.bg, width: linkedPosts.length ? `${Math.round((linkedPosts.filter((post) => post.status === "Published").length / linkedPosts.length) * 100)}%` : "0%" }}
              />
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-white/55">
              <span>{linkedPosts.length ? Math.round((linkedPosts.filter((post) => post.status === "Published").length / linkedPosts.length) * 100) : 0}% complete</span>
              <span>{number(linkedPosts.length)} total tasks</span>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-6">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold" style={{ backgroundColor: accent.bg, color: accent.text }}>
                DC
              </span>
              <div>
                <p className="text-sm text-white/45">Project Owner</p>
                <p className="text-lg text-white">Diego Castillo</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-white/35 text-white/65">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm text-white/45">Due date</p>
                <p className="text-lg text-white">{campaign.endDate}</p>
              </div>
            </div>
          </div>

          <div className="mt-10 space-y-7 text-xl text-white">
            {[
              ["Connected content", linkedPosts.length],
              ["Approvals", campaignApprovals.length],
              ["Publishing jobs", campaignPublishJobs.length],
              ["Weekly metrics", overview.linkedMetrics.length]
            ].map(([label, value]) => (
              <div className="flex items-center justify-between" key={String(label)}>
                <div className="flex items-center gap-4">
                  <ChevronUp className="h-4 w-4 rotate-90 text-white/50" />
                  <span>{label}</span>
                </div>
                <span className="text-white/55">{value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card id="campaign-brief">
          <CardHeader>
            <div>
              <CardDescription>Campaign Brief</CardDescription>
              <CardTitle className="mt-3">What this campaign is trying to change</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <ListCard>
              <p className="text-sm text-muted-foreground">Objective</p>
              <p className="mt-2 text-lg text-foreground">{campaign.objective}</p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Launch window</p>
              <p className="mt-2 text-lg text-foreground">
                {campaign.startDate} to {campaign.endDate}
              </p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Channels</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {campaign.channels.length ? (
                  campaign.channels.map((channel) => (
                    <span
                      className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                      key={channel}
                    >
                      {channel}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No channels added yet.</span>
                )}
              </div>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Notes</p>
              <p className="mt-2 text-sm text-foreground">{campaign.notes || "No campaign notes yet."}</p>
            </ListCard>
          </div>
        </Card>

        <Card id="content-composer">
          <CardHeader>
            <div>
              <CardDescription>Create Content</CardDescription>
              <CardTitle className="mt-3">Add content directly inside the campaign</CardTitle>
            </div>
          </CardHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Platform</Label>
                <Select
                  value={draft.platform}
                  onChange={(value) =>
                    setDraft((current) => ({ ...current, platform: value as Post["platform"] }))
                  }
                  options={["Instagram", "Facebook", "TikTok", "Email", "Stories"].map((value) => ({
                    label: value,
                    value
                  }))}
                />
              </div>
              <div>
                <Label>Publish Date</Label>
                <Input
                  type="date"
                  value={draft.publishDate}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, publishDate: event.target.value }))
                  }
                />
                {errors.publishDate ? <p className="mt-2 text-xs text-primary">{errors.publishDate}</p> : null}
              </div>
            </div>
            <div>
              <Label>Goal</Label>
              <Input
                value={draft.goal}
                onChange={(event) => setDraft((current) => ({ ...current, goal: event.target.value }))}
                placeholder="Push Thursday reservations"
              />
              {errors.goal ? <p className="mt-2 text-xs text-primary">{errors.goal}</p> : null}
            </div>
            <div>
              <Label>Call To Action</Label>
              <Input
                value={draft.cta}
                onChange={(event) => setDraft((current) => ({ ...current, cta: event.target.value }))}
                placeholder="Reserve tonight"
              />
              {errors.cta ? <p className="mt-2 text-xs text-primary">{errors.cta}</p> : null}
            </div>
            <div>
              <Label>Post Content</Label>
              <Textarea
                value={draft.content}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, content: event.target.value }))
                }
                placeholder="Write the caption, offer, or email copy for this campaign."
              />
              {errors.content ? <p className="mt-2 text-xs text-primary">{errors.content}</p> : null}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button disabled={saving} onClick={() => void savePost("Draft")} variant="outline">
                Save Draft
              </Button>
              <Button disabled={saving} onClick={() => void savePost("Scheduled")}>
                Save Scheduled
              </Button>
            </div>
            {errors.form ? <p className="text-xs text-primary">{errors.form}</p> : null}
          </div>
        </Card>
      </div>
      ) : null}

      {activeView === "list" ? (
      <Card id="campaign-list">
        <CardHeader>
          <div>
            <CardDescription>Campaign List</CardDescription>
            <CardTitle className="mt-3">Every content item in this campaign</CardTitle>
          </div>
        </CardHeader>
        <div className="space-y-3">
          {linkedPosts.length ? (
            linkedPosts.map((post) => {
              const approval = getPostApproval(post.id);
              const publishJob = getPostPublishJob(post.id);

              return (
                <div key={post.id}>
                  <ListCard className="sm:hidden">
                    <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3">
                      <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-lg font-medium text-foreground">{post.goal}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span>{post.platform}</span>
                          <DatePill value={post.publishDate} fallback="No date" />
                        </div>
                      </div>
                      <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </ListCard>
                  <ListCard className="hidden sm:block">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_8rem_9rem_9rem_9rem] lg:items-center">
                      <div>
                        <p className="font-medium text-foreground">{post.goal}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span>{post.platform}</span>
                          <DatePill value={post.publishDate} fallback="No date" />
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{post.content}</p>
                      </div>
                      <div>
                        <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground lg:hidden">Status</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground lg:mt-0">{post.status}</p>
                      </div>
                      <div>
                        <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground lg:hidden">Approval</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-primary lg:mt-0">{approval?.status ?? "No approval"}</p>
                      </div>
                      <div>
                        <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground lg:hidden">Publish</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground lg:mt-0">{publishJob?.status ?? "No publish job"}</p>
                      </div>
                      <div>
                        <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground lg:hidden">CTA</p>
                        <p className="mt-1 text-sm text-muted-foreground lg:mt-0">{post.cta || "No CTA"}</p>
                      </div>
                    </div>
                  </ListCard>
                </div>
              );
            })
          ) : (
            <EmptyState title="No campaign posts yet" description="Use Overview to add the first post for this campaign." />
          )}
        </div>
      </Card>
      ) : null}

      {activeView === "board" ? (
      <Card id="campaign-board">
        <CardHeader>
          <div>
            <CardDescription>Campaign Board</CardDescription>
            <CardTitle className="mt-3">Move work through the publishing rhythm</CardTitle>
          </div>
        </CardHeader>
        <div className="grid gap-4 lg:grid-cols-4">
          {boardLanes.map((lane) => {
            const lanePosts = getBoardLanePosts(lane);

            return (
              <div className="rounded-3xl border border-border bg-card/55 p-4" key={lane}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{lane}</p>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{lanePosts.length}</span>
                </div>
                <div className="mt-4 space-y-3">
                  {lanePosts.length ? (
                    lanePosts.map((post) => {
                      const approval = getPostApproval(post.id);
                      const publishJob = getPostPublishJob(post.id);

                      return (
                        <ListCard key={post.id}>
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-medium text-foreground">{post.goal}</p>
                            <span className="rounded-full bg-primary/10 px-2 py-1 text-[0.65rem] uppercase tracking-[0.12em] text-primary">
                              {post.platform}
                            </span>
                          </div>
                          <div className="mt-2">
                            <DatePill value={post.publishDate} fallback="No date" />
                          </div>
                          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{post.content}</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
                            <span>{approval?.status ?? "No approval"}</span>
                            <span>{publishJob?.status ?? "No publish job"}</span>
                          </div>
                        </ListCard>
                      );
                    })
                  ) : (
                    <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                      No {lane.toLowerCase()} posts.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      ) : null}

      {activeView === "calendar" ? (
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card id="scheduled-timeline">
          <CardHeader>
            <div>
              <CardDescription>Scheduled Timeline</CardDescription>
              <CardTitle className="mt-3">What is actually going live and when</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            {scheduledPosts.length ? (
              scheduledPosts.map((post) => {
                const approval = getPostApproval(post.id);
                const publishJob = getPostPublishJob(post.id);

                return (
                  <ListCard key={post.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">{post.platform}</p>
                          <DatePill value={post.publishDate} fallback="No date" />
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{post.goal}</p>
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{post.content}</p>
                      </div>
                      <div className="text-right text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        <p>{post.status}</p>
                        <p className="mt-2 text-primary">{approval?.status ?? "No approval"}</p>
                        <p className="mt-2">{publishJob?.status ?? "No publish job"}</p>
                      </div>
                    </div>
                  </ListCard>
                );
              })
            ) : (
              <EmptyState
                title="Nothing scheduled yet"
                description="Add a scheduled post in this campaign and it will appear in the timeline and on the calendar."
              />
            )}
          </div>
        </Card>
      </div>
      ) : null}

      {activeView === "performance" ? (
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card id="performance-snapshot">
          <CardHeader>
            <div>
              <CardDescription>Performance Snapshot</CardDescription>
              <CardTitle className="mt-3">What this campaign is producing so far</CardTitle>
            </div>
          </CardHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <ListCard>
              <p className="text-sm text-muted-foreground">Attributed revenue</p>
              <p className="mt-2 text-2xl text-foreground">{currency(overview.attributedRevenue)}</p>
              <p className="mt-2 text-sm text-muted-foreground">Revenue currently tied back to this campaign.</p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Attributed covers</p>
              <p className="mt-2 text-2xl text-foreground">{number(overview.attributedCovers)}</p>
              <p className="mt-2 text-sm text-muted-foreground">Dining demand currently attributed to this campaign.</p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Attributed tables</p>
              <p className="mt-2 text-2xl text-foreground">{number(overview.attributedTables, 1)}</p>
              <p className="mt-2 text-sm text-muted-foreground">Table demand translated from linked reporting.</p>
            </ListCard>
            <ListCard>
              <p className="text-sm text-muted-foreground">Linked weekly metrics</p>
              <p className="mt-2 text-2xl text-foreground">{number(overview.linkedMetrics.length)}</p>
              <p className="mt-2 text-sm text-muted-foreground">Weekly performance entries tied to this campaign.</p>
            </ListCard>
          </div>
        </Card>

        <Card id="publishing-queue">
          <CardHeader>
            <div>
              <CardDescription>Publishing Queue</CardDescription>
              <CardTitle className="mt-3">Publishing status for campaign content</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            {campaignPublishJobs.length ? (
              campaignPublishJobs.map((job) => {
                const linkedPost = overview.linkedPosts.find((post) => post.id === job.postId);

                return (
                  <ListCard key={job.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium capitalize text-foreground">{job.provider}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {linkedPost ? linkedPost.goal : "Scheduled publish"}
                          <span className="mt-2 block">
                            <DatePill value={job.scheduledFor} />
                          </span>
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">{job.detail}</p>
                      </div>
                      <p className="text-xs uppercase tracking-[0.16em] text-primary">{job.status}</p>
                    </div>
                    {job.errorMessage ? (
                      <p className="mt-3 text-sm text-primary">{job.errorMessage}</p>
                    ) : null}
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <Button
                        disabled={processingJobId === job.id}
                        onClick={() => void runPublishJob(job.id)}
                        size="sm"
                        variant="outline"
                      >
                        {processingJobId === job.id ? "Running..." : "Run Publish"}
                      </Button>
                    </div>
                  </ListCard>
                );
              })
            ) : (
              <EmptyState
                title="No publish jobs yet"
                description="Scheduled social posts inside this campaign will create publish jobs automatically."
              />
            )}
          </div>
        </Card>
      </div>
      ) : null}

      {activeView === "list" ? (
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card id="approval-queue">
          <CardHeader>
            <div>
              <CardDescription>Approval Queue</CardDescription>
              <CardTitle className="mt-3">Review what is still blocking launch</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            {campaignApprovals.length ? (
              campaignApprovals.map((approval) => (
                <ListCard key={approval.id}>
                  <p className="font-medium text-foreground">{approval.summary}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>Requested by {approval.requesterName}</span>
                    <DatePill value={approval.requestedAt} />
                  </div>
                  {approval.note ? <p className="mt-2 text-sm text-muted-foreground">{approval.note}</p> : null}
                  {approval.status === "Pending" ? (
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <Button
                        disabled={reviewingId === approval.id}
                        onClick={() => void handleReview(approval.id, "Approved")}
                        size="sm"
                      >
                        Approve
                      </Button>
                      <Button
                        disabled={reviewingId === approval.id}
                        onClick={() => void handleReview(approval.id, "Changes Requested")}
                        size="sm"
                        variant="outline"
                      >
                        Request Changes
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-4 text-xs uppercase tracking-[0.16em] text-primary">
                      {approval.status}
                    </p>
                  )}
                </ListCard>
              ))
            ) : (
              <EmptyState
                title="No campaign approvals"
                description="Approvals for posts created in this campaign will appear here automatically."
              />
            )}
          </div>
        </Card>
      </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-[4.6rem] z-40 flex justify-center sm:hidden">
        <div className="flex items-center gap-2 rounded-[1.5rem] border border-white/15 bg-[#202024]/95 p-1.5 text-white shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur">
          <button
            aria-label="Board view"
            className="rounded-[1.1rem] border p-3"
            style={{ backgroundColor: accent.soft, borderColor: accent.bg, color: accent.bg }}
            type="button"
            onClick={() => setActiveView("board")}
          >
            <LayoutList className="h-5 w-5" />
          </button>
          <button
            className="flex min-w-[8.5rem] items-center justify-center gap-2 rounded-[1.1rem] border border-white/15 px-5 py-3 text-lg font-medium"
            type="button"
          >
            {activeViewLabel}
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            aria-label="Add content"
            className="rounded-[1.1rem] p-4"
            style={{ backgroundColor: accent.bg, color: accent.text }}
            type="button"
            onClick={() => setActiveView("overview")}
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
