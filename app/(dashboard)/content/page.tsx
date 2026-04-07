"use client";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ListCard } from "@/components/dashboard/list-card";
import { PageHeader } from "@/components/dashboard/page-header";
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content"
        title="Plan, review, and schedule content"
        description="Keep the restaurant content pipeline in one place: what is drafted, what is scheduled, and what is still waiting on approval."
      />

      <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-[1rem] border border-border/70 bg-card/70 px-4 py-3 text-sm text-muted-foreground">
        <span><strong className="font-medium text-foreground">{number(scheduledPosts.length)}</strong> scheduled</span>
        <span><strong className="font-medium text-foreground">{number(pendingApprovals.length)}</strong> pending approval</span>
        <span><strong className="font-medium text-foreground">{number(planningBacklog.length)}</strong> planner items</span>
        <span><strong className="font-medium text-foreground">{number(queuedPublishJobs.length)}</strong> publish jobs</span>
        <span><strong className="font-medium text-foreground">{number(assets.filter((asset) => asset.status === "Ready").length)}</strong> ready assets</span>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card id="scheduled-content" className="overflow-hidden p-0">
          <CardHeader className="border-b border-border/70 px-4 py-4 sm:px-5">
            <div>
              <CardDescription>Scheduled Content</CardDescription>
              <CardTitle className="mt-2">Next items going live</CardTitle>
            </div>
          </CardHeader>
          <div className="divide-y divide-border/70">
            {scheduledPosts.length ? (
              scheduledPosts.slice(0, 6).map((post) => {
                const linkedCampaign = campaigns.find((campaign) => campaign.id === post.campaignId);
                const approval = approvals.find(
                  (item) => item.entityType === "post" && item.entityId === post.id
                );

                return (
                  <ListCard key={post.id} className="rounded-none border-0 bg-transparent px-4 py-4 hover:bg-primary/5 sm:px-5">
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
          <Card id="planner-queue" className="overflow-hidden p-0">
            <CardHeader className="border-b border-border/70 px-4 py-4 sm:px-5">
              <div>
                <CardDescription>Planner Queue</CardDescription>
                <CardTitle className="mt-2">Ideas still in motion</CardTitle>
              </div>
            </CardHeader>
            <div className="divide-y divide-border/70">
              {planningBacklog.length ? (
                planningBacklog.slice(0, 5).map((item) => (
                  <ListCard key={item.id} className="rounded-none border-0 bg-transparent px-4 py-4 hover:bg-primary/5 sm:px-5">
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

        </div>
      </div>
    </div>
  );
}
