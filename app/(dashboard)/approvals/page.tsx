"use client";

import { useState } from "react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ListCard } from "@/components/dashboard/list-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePill } from "@/components/ui/date-pill";
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
  const { approvals, ready, error, reviewApproval, deleteApproval } = useApprovalsApi(activeClient.id);
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

  const handleDelete = async (approvalId: string) => {
    setReviewingId(approvalId);

    try {
      await deleteApproval(approvalId);
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Approvals"
        title="Review what is waiting on sign-off"
        description="Keep one clean queue for client review, internal approval, and operational blockers before content goes live."
      />

      <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-[1rem] border border-border/70 bg-card/70 px-4 py-3 text-sm text-muted-foreground">
        <span><strong className="font-medium text-foreground">{number(pendingApprovals.length)}</strong> pending</span>
        <span><strong className="font-medium text-foreground">{number(approvals.filter((approval) => approval.status === "Approved").length)}</strong> approved</span>
        <span><strong className="font-medium text-foreground">{number(approvals.filter((approval) => approval.status === "Changes Requested").length)}</strong> needs changes</span>
        <span><strong className="font-medium text-foreground">{number(openTasks.length)}</strong> open tasks</span>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card id="approval-queue" className="overflow-hidden p-0">
          <CardHeader className="border-b border-border/70 px-4 py-4 sm:px-5">
            <div>
              <CardDescription>Approval Queue</CardDescription>
              <CardTitle className="mt-2">Pending review</CardTitle>
            </div>
          </CardHeader>
          <div className="divide-y divide-border/70">
            {pendingApprovals.length ? (
              pendingApprovals.map((approval) => (
                <ListCard key={approval.id} className="rounded-none border-0 bg-transparent px-4 py-4 hover:bg-primary/5 sm:px-5">
                  <p className="font-medium text-foreground">{approval.summary}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>Requested by {approval.requesterName}</span>
                    <DatePill value={approval.requestedAt} />
                  </div>
                  {approval.note ? (
                    <p className="mt-2 text-sm text-muted-foreground">{approval.note}</p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-3">
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
                    <Button
                      disabled={reviewingId === approval.id}
                      onClick={() => void handleDelete(approval.id)}
                      size="sm"
                      variant="ghost"
                    >
                      Delete
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
          <Card id="open-tasks" className="overflow-hidden p-0">
            <CardHeader className="border-b border-border/70 px-4 py-4 sm:px-5">
              <div>
                <CardDescription>Execution Queue</CardDescription>
                <CardTitle className="mt-2">Related open work</CardTitle>
              </div>
            </CardHeader>
            <div className="divide-y divide-border/70">
              {openTasks.length ? (
                openTasks.slice(0, 5).map((task) => (
                  <ListCard key={task.id} className="rounded-none border-0 bg-transparent px-4 py-4 hover:bg-primary/5 sm:px-5">
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
        </div>
      </div>
    </div>
  );
}
