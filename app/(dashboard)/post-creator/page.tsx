"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ListCard } from "@/components/dashboard/list-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePill } from "@/components/ui/date-pill";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActiveClient } from "@/lib/client-context";
import { getScheduledPosts } from "@/lib/domain/content";
import { useAssets } from "@/lib/repositories/use-assets";
import { useCampaigns } from "@/lib/repositories/use-campaigns";
import { usePlannerItems } from "@/lib/repositories/use-planner-items";
import { usePosts } from "@/lib/repositories/use-posts";
import { useApprovalsApi } from "@/lib/use-approvals-api";
import { usePersistentDraft } from "@/lib/use-persistent-draft";
import { usePublishingApi } from "@/lib/use-publishing-api";
import { validatePost } from "@/lib/validation";
import { Post, PostStatus } from "@/types";

const createEmptyPost = (clientId: string): Post => ({
  id: "",
  clientId,
  platform: "Instagram",
  content: "",
  cta: "",
  publishDate: "2026-03-16",
  goal: "",
  status: "Draft"
  ,
  assetIds: []
});

export default function PostCreatorPage() {
  const { activeClient } = useActiveClient();
  const { campaigns } = useCampaigns(activeClient.id);
  const { assets } = useAssets(activeClient.id);
  const { posts, addPost, ready, error } = usePosts(activeClient.id);
  const { items } = usePlannerItems(activeClient.id);
  const {
    jobs: publishJobs,
    ready: publishingReady,
    error: publishingError,
    processJob,
    prependJob
  } = usePublishingApi(activeClient.id);
  const {
    approvals,
    ready: approvalsReady,
    error: approvalsError,
    prependApproval
  } = useApprovalsApi(activeClient.id);
  const {
    value: draft,
    setValue: setDraft,
    reset: resetDraft
  } = usePersistentDraft<Post>(
    `post-creator:${activeClient.id}:draft`,
    () => createEmptyPost(activeClient.id)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const {
    value: linkedPlannerItemIds,
    setValue: setLinkedPlannerItemIds
  } = usePersistentDraft<string[]>(`post-creator:${activeClient.id}:linked-planner-item-ids`, []);

  const scheduledPosts = useMemo(() => getScheduledPosts(posts), [posts]);
  const approvalsByPostId = useMemo(
    () =>
      new Map(
        approvals
          .filter((approval) => approval.entityType === "post")
          .map((approval) => [approval.entityId, approval])
      ),
    [approvals]
  );
  const schedulablePlannerItems = useMemo(
    () =>
      items.filter(
        (item) =>
          !item.linkedPostId &&
          !linkedPlannerItemIds.includes(item.id) &&
          (item.status === "Draft" || item.status === "Scheduled")
      ),
    [items, linkedPlannerItemIds]
  );

  const savePost = (status: PostStatus) => {
    const result = validatePost({ ...draft, status });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }

    void addPost({
      ...draft,
      ...result.data,
      clientId: activeClient.id,
      status
    })
      .then((payload) => {
        if (draft.plannerItemId) {
          setLinkedPlannerItemIds((current) => [...current, draft.plannerItemId!]);
        }

        if (payload.publishJob) {
          prependJob(payload.publishJob);
        }

        if (payload.approval) {
          prependApproval(payload.approval);
        }

        setErrors({});
        resetDraft(() => createEmptyPost(activeClient.id));
      })
      .catch(() => {
        setErrors({
          form: "Post could not be saved. Check permissions and backend connectivity."
        });
      });
  };

  if (!ready) {
    return <div className="text-sm text-muted-foreground">Loading post creator...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive">{error}</div>;
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Post creator"
        title="Post creator"
        description="Create draft and scheduled content linked to planner items, campaigns, and assets."
      />
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <div>
              <CardDescription>Post Creator</CardDescription>
              <CardTitle className="mt-3">Drafts and scheduled posts</CardTitle>
            </div>
          </CardHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Platform</Label>
                <Select
                  value={draft.platform}
                  onChange={(value) => setDraft((current) => ({ ...current, platform: value as Post["platform"] }))}
                  options={["Instagram", "Facebook", "TikTok", "Email", "Stories"].map((value) => ({ label: value, value }))}
                />
                {errors.platform ? <p className="mt-2 text-xs text-primary">{errors.platform}</p> : null}
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={draft.publishDate}
                  onChange={(event) => setDraft((current) => ({ ...current, publishDate: event.target.value }))}
                />
                {errors.publishDate ? <p className="mt-2 text-xs text-primary">{errors.publishDate}</p> : null}
              </div>
            </div>
            <div>
              <Label>Planner Link</Label>
              <Select
                value={draft.plannerItemId ?? "none"}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    plannerItemId: value === "none" ? undefined : value
                  }))
                }
                options={[
                  { label: "No linked planner item", value: "none" },
                  ...schedulablePlannerItems.map((item) => ({
                    label: `${item.dayOfWeek} · ${item.platform} · ${item.campaignGoal}`,
                    value: item.id
                  }))
                ]}
              />
            </div>
            <div>
              <Label>Campaign Link</Label>
              <Select
                value={draft.campaignId ?? "none"}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    campaignId: value === "none" ? undefined : value
                  }))
                }
                options={[
                  { label: "No linked campaign", value: "none" },
                  ...campaigns.map((campaign) => ({ label: campaign.name, value: campaign.id }))
                ]}
              />
            </div>
            <div>
              <Label>Linked Assets</Label>
              <select
                multiple
                className="flex min-h-28 w-full rounded-xl border border-border bg-card/70 px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                value={draft.assetIds}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    assetIds: Array.from(event.target.selectedOptions).map((option) => option.value)
                  }))
                }
              >
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Goal</Label>
              <Input
                value={draft.goal}
                onChange={(event) => setDraft((current) => ({ ...current, goal: event.target.value }))}
                placeholder="Increase Tuesday covers"
              />
              {errors.goal ? <p className="mt-2 text-xs text-primary">{errors.goal}</p> : null}
            </div>
            <div>
              <Label>Call To Action</Label>
              <Input
                value={draft.cta}
                onChange={(event) => setDraft((current) => ({ ...current, cta: event.target.value }))}
                placeholder="Reserve your table"
              />
              {errors.cta ? <p className="mt-2 text-xs text-primary">{errors.cta}</p> : null}
            </div>
            <div>
              <Label>Post Content</Label>
              <Textarea
                value={draft.content}
                onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
                placeholder="Write the client-ready caption or email copy."
              />
              {errors.content ? <p className="mt-2 text-xs text-primary">{errors.content}</p> : null}
            </div>
            <div className="flex gap-3">
              <Button onClick={() => savePost("Draft")} variant="outline">
                Save Draft
              </Button>
              <Button onClick={() => savePost("Scheduled")}>Save as Scheduled</Button>
            </div>
            {errors.form ? <p className="text-xs text-primary">{errors.form}</p> : null}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardDescription>Scheduled Content View</CardDescription>
              <CardTitle className="mt-3">What {activeClient.name} has queued</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            {scheduledPosts.length ? (
              scheduledPosts.map((post) => (
                <ListCard key={post.id}>
                  {(() => {
                    const approval = approvalsByPostId.get(post.id);

                    return (
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-medium text-foreground">{post.platform}</p>
                      <div className="mt-2">
                        <DatePill value={post.publishDate} />
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">{post.content}</p>
                      <p className="mt-3 text-sm text-foreground">CTA: {post.cta}</p>
                      <p className="mt-2 text-sm text-muted-foreground">Goal: {post.goal}</p>
                      {post.campaignId ? <p className="mt-2 text-sm text-muted-foreground">Campaign: {post.campaignId}</p> : null}
                      {post.assetIds.length ? <p className="mt-2 text-sm text-muted-foreground">Assets: {post.assetIds.join(", ")}</p> : null}
                      {post.plannerItemId ? (
                        <p className="mt-2 text-sm text-muted-foreground">Linked planner item: {post.plannerItemId}</p>
                      ) : null}
                      {approval ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Approval: {approval.status}
                        </p>
                      ) : null}
                    </div>
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-primary">
                      {post.status}
                    </span>
                  </div>
                    );
                  })()}
                </ListCard>
              ))
            ) : (
              <EmptyState
                title="No scheduled posts"
                description="Save a draft as scheduled and it will appear here in chronological order."
              />
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardDescription>Publisher Queue</CardDescription>
            <CardTitle className="mt-3">Scheduled social publishing</CardTitle>
          </div>
        </CardHeader>
        {!publishingReady ? (
          <div className="px-6 pb-6 text-sm text-muted-foreground">Loading publish queue...</div>
        ) : publishingError ? (
          <div className="px-6 pb-6 text-sm text-destructive">{publishingError}</div>
        ) : (
          <div className="space-y-3">
            {publishJobs.length ? (
              publishJobs.map((job) => (
                <ListCard key={job.id}>
                  {(() => {
                    const approval = approvalsByPostId.get(job.postId);
                    const isAwaitingApproval = approval?.status !== "Approved";

                    return (
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-medium text-foreground">
                        {job.provider} · {job.status}
                      </p>
                      <div className="mt-2">
                        <DatePill value={job.scheduledFor} />
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">{job.detail}</p>
                      {approval ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Approval status: {approval.status}
                        </p>
                      ) : null}
                      {job.externalId ? <p className="mt-2 text-sm text-muted-foreground">External ID: {job.externalId}</p> : null}
                      {job.errorMessage ? <p className="mt-2 text-sm text-primary">{job.errorMessage}</p> : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-primary">
                        {job.status}
                      </span>
                      <Button
                        disabled={
                          job.status === "Published" ||
                          job.status === "Processing" ||
                          isAwaitingApproval
                        }
                        onClick={() => void processJob(job.id)}
                        size="sm"
                        variant="outline"
                      >
                        {isAwaitingApproval ? "Awaiting approval" : "Run Publish"}
                      </Button>
                    </div>
                  </div>
                    );
                  })()}
                </ListCard>
              ))
            ) : (
              <EmptyState
                title="No publish jobs"
                description="Scheduled Instagram, Facebook, and TikTok posts will queue here."
              />
            )}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardDescription>Approval queue</CardDescription>
            <CardTitle className="mt-3">Scheduled content waiting for sign-off</CardTitle>
          </div>
        </CardHeader>
        {!approvalsReady ? (
          <div className="px-6 pb-6 text-sm text-muted-foreground">Loading approvals...</div>
        ) : approvalsError ? (
          <div className="px-6 pb-6 text-sm text-destructive">{approvalsError}</div>
        ) : approvals.length ? (
          <div className="space-y-3">
            {approvals.map((approval) => (
              <ListCard key={approval.id}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-medium text-foreground">{approval.summary}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs uppercase tracking-[0.16em] text-primary">{approval.status}</span>
                      <DatePill value={approval.requestedAt} />
                    </div>
                    {approval.note ? (
                      <p className="mt-3 text-sm text-muted-foreground">{approval.note}</p>
                    ) : null}
                    {approval.approverName ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Approver: {approval.approverName}
                      </p>
                    ) : null}
                  </div>
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-primary">
                    {approval.status}
                  </span>
                </div>
              </ListCard>
            ))}
          </div>
        ) : (
          <div className="px-6 pb-6 text-sm text-muted-foreground">
            Scheduled posts will request approval automatically before publishing.
          </div>
        )}
      </Card>
    </div>
  );
}
