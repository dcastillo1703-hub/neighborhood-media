"use client";

import { useState } from "react";
import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ListCard } from "@/components/dashboard/list-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatGrid } from "@/components/dashboard/stat-grid";
import { MetricCard } from "@/components/metric-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { useActiveClient } from "@/lib/client-context";
import { useOperationsApi } from "@/lib/use-operations-api";
import { useApprovalsApi } from "@/lib/use-approvals-api";
import { number } from "@/lib/utils";
import { useWorkspaceContext } from "@/lib/workspace-context";

export default function ApprovalsPage() {
  const { activeClient } = useActiveClient();
  const { workspace } = useWorkspaceContext();
  const { profile } = useAuth();
  const { approvals, ready, error, reviewApproval } = useApprovalsApi(activeClient.id);
  const { tasks } = useOperationsApi(workspace.id, activeClient.id);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const pendingApprovals = approvals.filter((approval) => approval.status === "Pending");
  const openTasks = tasks.filter((task) => task.status !== "Done");
  const approverName = profile?.fullName ?? profile?.email ?? "Workspace operator";

  const handleReview = async (
    approvalId: string,
    status: "Approved" | "Changes Requested"
  ) => {
    setReviewingId(approvalId);

    try {
      await reviewApproval(approvalId, {
        status,
        approverName,
        approverUserId: profile?.id,
        note:
          status === "Approved"
            ? "Approved from the unified approvals queue."
            : "Sent back for revisions from the unified approvals queue."
      });
    } finally {
      setReviewingId(null);
    }
  };

  if (!ready) {
    return <div className="text-sm text-muted-foreground">Loading approvals...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive">{error}</div>;
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Approvals"
        title="Review what is waiting on sign-off"
        description="Keep one clean queue for client review, internal approval, and operational blockers before content goes live."
      />

      <StatGrid>
        <MetricCard href="/approvals#approval-queue" label="Pending Reviews" value={number(pendingApprovals.length)} detail="Content that cannot publish until someone approves it." />
        <MetricCard href="/approvals#approval-queue" label="Approved Items" value={number(approvals.filter((approval) => approval.status === "Approved").length)} detail="Requests that are cleared to move forward." />
        <MetricCard href="/approvals#approval-queue" label="Needs Changes" value={number(approvals.filter((approval) => approval.status === "Changes Requested").length)} detail="Items that still need edits before they re-enter review." />
        <MetricCard href="/approvals#open-tasks" label="Open Tasks" value={number(openTasks.length)} detail="Operational work still attached to this client." tone="olive" />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card id="approval-queue">
          <CardHeader>
            <div>
              <CardDescription>Approval Queue</CardDescription>
              <CardTitle className="mt-3">Pending review</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            {pendingApprovals.length ? (
              pendingApprovals.map((approval) => (
                <ListCard key={approval.id}>
                  <p className="font-medium text-foreground">{approval.summary}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Requested by {approval.requesterName} on {approval.requestedAt.slice(0, 10)}
                  </p>
                  {approval.note ? (
                    <p className="mt-2 text-sm text-muted-foreground">{approval.note}</p>
                  ) : null}
                  <div className="mt-4 flex gap-3">
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
                </ListCard>
              ))
            ) : (
              <EmptyState
                title="No pending approvals"
                description="Nothing is waiting on sign-off right now."
              />
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card id="open-tasks">
            <CardHeader>
              <div>
                <CardDescription>Execution Queue</CardDescription>
                <CardTitle className="mt-3">Related open work</CardTitle>
              </div>
            </CardHeader>
            <div className="space-y-3">
              {openTasks.length ? (
                openTasks.slice(0, 5).map((task) => (
                  <ListCard key={task.id}>
                    <p className="font-medium text-foreground">{task.title}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{task.detail}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-primary">
                      {task.status} · {task.priority}
                    </p>
                  </ListCard>
                ))
              ) : (
                <EmptyState
                  title="No open tasks"
                  description="There are no active blockers attached to this client."
                />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardDescription>Deep Workspaces</CardDescription>
                <CardTitle className="mt-3">Open the detailed queues</CardTitle>
              </div>
            </CardHeader>
            <div className="grid gap-3">
              <Link className={buttonVariants({ variant: "outline" })} href="/operations">
                Open operations board
              </Link>
              <Link className={buttonVariants({ variant: "outline" })} href="/post-creator">
                Open content review workspace
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
