"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";

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
import { useAuth } from "@/lib/auth-context";
import { useActiveClient } from "@/lib/client-context";
import { getCampaignOverview } from "@/lib/domain/campaigns";
import { useAnalyticsSnapshots } from "@/lib/repositories/use-analytics-snapshots";
import { useAssets } from "@/lib/repositories/use-assets";
import { useBlogPosts } from "@/lib/repositories/use-blog-posts";
import { useCampaigns } from "@/lib/repositories/use-campaigns";
import { usePosts } from "@/lib/repositories/use-posts";
import { useWeeklyMetrics } from "@/lib/repositories/use-weekly-metrics";
import { useApprovalsApi } from "@/lib/use-approvals-api";
import { usePublishingApi } from "@/lib/use-publishing-api";
import { currency, number } from "@/lib/utils";
import { validatePost } from "@/lib/validation";
import { Post, PostStatus } from "@/types";

type CampaignWorkspaceView = "overview" | "list" | "board" | "calendar" | "performance";

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

  return (
    <div className="space-y-10">
      <PageHeader
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

      <StatGrid>
        <MetricCard href="/campaigns" label="Status" value={campaign.status} detail={`${campaign.startDate} to ${campaign.endDate}`} />
        <MetricCard href="#campaign-workspace" label="Campaign Posts" value={number(overview.linkedPosts.length)} detail="Posts currently linked to this campaign." />
        <MetricCard href="#campaign-workspace" label="Pending Reviews" value={number(campaignApprovals.filter((approval) => approval.status === "Pending").length)} detail="Linked posts still waiting on approval." />
        <MetricCard href="#campaign-workspace" label="Queued Publish Jobs" value={number(campaignPublishJobs.filter((job) => ["Queued", "Processing", "Blocked"].includes(job.status)).length)} detail="Publishing jobs currently tied to this campaign." />
        <MetricCard href="#performance-snapshot" label="Attributed Revenue" value={currency(overview.attributedRevenue)} detail="Revenue currently tied to this campaign in reporting." tone="olive" />
      </StatGrid>

      <Card id="campaign-workspace" className="p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-5">
          {campaignViews.map((view) => {
            const selected = activeView === view.id;

            return (
              <button
                key={view.id}
                className={[
                  "rounded-3xl border px-4 py-3 text-left transition",
                  selected
                    ? "border-primary/45 bg-primary/10 shadow-[0_12px_30px_rgba(149,114,46,0.12)]"
                    : "border-border bg-card/60 hover:border-primary/25 hover:bg-primary/5"
                ].join(" ")}
                type="button"
                onClick={() => setActiveView(view.id)}
              >
                <span className="block text-sm font-medium text-foreground">{view.label}</span>
                <span className="mt-1 block text-[0.7rem] leading-4 text-muted-foreground">{view.description}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {activeView === "overview" ? (
      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
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
              const approval = campaignApprovals.find((item) => item.entityId === post.id);
              const publishJob = campaignPublishJobs.find((item) => item.postId === post.id);

              return (
                <ListCard key={post.id}>
                  <div className="grid gap-4 lg:grid-cols-[1fr_10rem_10rem_10rem] lg:items-center">
                    <div>
                      <p className="font-medium text-foreground">{post.goal}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{post.platform} · {post.publishDate || "No date yet"}</p>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{post.content}</p>
                    </div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{post.status}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-primary">{approval?.status ?? "No approval"}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{publishJob?.status ?? "No publish job"}</p>
                  </div>
                </ListCard>
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
        <div className="grid gap-4 lg:grid-cols-3">
          {(["Draft", "Scheduled", "Published"] as PostStatus[]).map((status) => {
            const lanePosts = linkedPosts.filter((post) => post.status === status);

            return (
              <div className="rounded-3xl border border-border bg-card/55 p-4" key={status}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{status}</p>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{lanePosts.length}</span>
                </div>
                <div className="mt-4 space-y-3">
                  {lanePosts.length ? (
                    lanePosts.map((post) => (
                      <ListCard key={post.id}>
                        <p className="font-medium text-foreground">{post.goal}</p>
                        <p className="mt-2 text-sm text-muted-foreground">{post.platform} · {post.publishDate || "No date yet"}</p>
                        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{post.content}</p>
                      </ListCard>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                      No {status.toLowerCase()} posts.
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
                const approval = campaignApprovals.find((item) => item.entityId === post.id);
                const publishJob = campaignPublishJobs.find((item) => item.postId === post.id);

                return (
                  <ListCard key={post.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-foreground">
                          {post.platform} · {post.publishDate}
                        </p>
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
                          {linkedPost ? `${linkedPost.goal} · ${job.scheduledFor.slice(0, 10)}` : job.scheduledFor.slice(0, 10)}
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
                  <p className="mt-2 text-sm text-muted-foreground">
                    Requested by {approval.requesterName} on {approval.requestedAt.slice(0, 10)}
                  </p>
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
    </div>
  );
}
