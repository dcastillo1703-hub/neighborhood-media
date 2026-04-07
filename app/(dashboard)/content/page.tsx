"use client";

import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ListCard } from "@/components/dashboard/list-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatGrid } from "@/components/dashboard/stat-grid";
import { MetricCard } from "@/components/metric-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePill } from "@/components/ui/date-pill";
import { useActiveClient } from "@/lib/client-context";
import { getScheduledPosts } from "@/lib/domain/content";
import { useAssets } from "@/lib/repositories/use-assets";
import { useCampaigns } from "@/lib/repositories/use-campaigns";
import { usePlannerItems } from "@/lib/repositories/use-planner-items";
import { usePosts } from "@/lib/repositories/use-posts";
import { useApprovalsApi } from "@/lib/use-approvals-api";
import { usePublishingApi } from "@/lib/use-publishing-api";
import { number } from "@/lib/utils";

export default function ContentPage() {
  const { activeClient } = useActiveClient();
  const { campaigns } = useCampaigns(activeClient.id);
  const { assets } = useAssets(activeClient.id);
  const { items } = usePlannerItems(activeClient.id);
  const { posts, ready, error } = usePosts(activeClient.id);
  const { approvals } = useApprovalsApi(activeClient.id);
  const { jobs } = usePublishingApi(activeClient.id);

  const scheduledPosts = getScheduledPosts(posts);
  const pendingApprovals = approvals.filter((approval) => approval.status === "Pending");
  const planningBacklog = items.filter((item) => item.status !== "Published");
  const queuedPublishJobs = jobs.filter((job) =>
    ["Queued", "Processing", "Blocked"].includes(job.status)
  );

  if (!ready) {
    return <div className="text-sm text-muted-foreground">Loading content workspace...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive">{error}</div>;
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Content"
        title="Plan, review, and schedule content"
        description="Keep the restaurant content pipeline in one place: what is drafted, what is scheduled, and what is still waiting on approval."
      />

      <StatGrid>
        <MetricCard href="/content#scheduled-content" label="Scheduled Posts" value={number(scheduledPosts.length)} detail="Content already slotted to go live." />
        <MetricCard href="/approvals" label="Pending Approvals" value={number(pendingApprovals.length)} detail="Posts that still need a sign-off before they can publish." />
        <MetricCard href="/content#planner-queue" label="Planner Backlog" value={number(planningBacklog.length)} detail="Ideas and scheduled items still moving through the content pipeline." />
        <MetricCard href="/post-creator" label="Queued Publish Jobs" value={number(queuedPublishJobs.length)} detail="Publishing jobs currently waiting, processing, or blocked." />
        <MetricCard href="/content#deep-workspaces" label="Ready Assets" value={number(assets.filter((asset) => asset.status === "Ready").length)} detail="Approved assets available for new content." tone="olive" />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card id="scheduled-content">
          <CardHeader>
            <div>
              <CardDescription>Scheduled Content</CardDescription>
              <CardTitle className="mt-3">Next items going live</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            {scheduledPosts.length ? (
              scheduledPosts.slice(0, 6).map((post) => {
                const linkedCampaign = campaigns.find((campaign) => campaign.id === post.campaignId);
                const approval = approvals.find(
                  (item) => item.entityType === "post" && item.entityId === post.id
                );

                return (
                  <ListCard key={post.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">{post.platform}</p>
                          <DatePill value={post.publishDate} />
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{post.goal}</p>
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                          {post.content}
                        </p>
                      </div>
                      <div className="text-right text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        <p>{post.status}</p>
                        <p className="mt-2 text-primary">
                          {approval?.status ?? "No approval"}
                        </p>
                      </div>
                    </div>
                    {linkedCampaign ? (
                      <p className="mt-3 text-xs uppercase tracking-[0.16em] text-primary">
                        Campaign: {linkedCampaign.name}
                      </p>
                    ) : null}
                  </ListCard>
                );
              })
            ) : (
              <EmptyState
                title="Nothing scheduled"
                description="Use the content workspace to stage the next publish before service gets busy."
              />
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card id="planner-queue">
            <CardHeader>
              <div>
                <CardDescription>Planner Queue</CardDescription>
                <CardTitle className="mt-3">Ideas still in motion</CardTitle>
              </div>
            </CardHeader>
            <div className="space-y-3">
              {planningBacklog.length ? (
                planningBacklog.slice(0, 5).map((item) => (
                  <ListCard key={item.id}>
                    <p className="font-medium text-foreground">
                      {item.dayOfWeek} · {item.platform}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">{item.campaignGoal}</p>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {item.caption}
                    </p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-primary">
                      {item.status}
                    </p>
                  </ListCard>
                ))
              ) : (
                <EmptyState
                  title="Planner is clear"
                  description="No draft or scheduled planner items are waiting right now."
                />
              )}
            </div>
          </Card>

          <Card id="deep-workspaces">
            <CardHeader>
              <div>
                <CardDescription>Deep Workspaces</CardDescription>
                <CardTitle className="mt-3">Open detailed tools when needed</CardTitle>
              </div>
            </CardHeader>
            <div className="grid gap-3">
              <Link className={buttonVariants({ variant: "outline" })} href="/post-creator">
                Open post composer
              </Link>
              <Link className={buttonVariants({ variant: "outline" })} href="/marketing-planner">
                Open planning board
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
