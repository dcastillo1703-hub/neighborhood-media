"use client";

import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ListCard } from "@/components/dashboard/list-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatGrid } from "@/components/dashboard/stat-grid";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePill } from "@/components/ui/date-pill";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActiveClient } from "@/lib/client-context";
import { useWorkspaceMembers } from "@/lib/repositories/use-workspace";
import { useAuth } from "@/lib/auth-context";
import { useApprovalsApi } from "@/lib/use-approvals-api";
import { useOperationsApi } from "@/lib/use-operations-api";
import { number } from "@/lib/utils";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { OperationalTask, TaskPriority, TaskStatus } from "@/types";

const taskStatuses: TaskStatus[] = ["Backlog", "In Progress", "Waiting", "Done"];
const taskPriorities: TaskPriority[] = ["Low", "Medium", "High"];

function createEmptyTask(workspaceId: string, clientId?: string): OperationalTask {
  return {
    id: "",
    workspaceId,
    clientId,
    title: "",
    detail: "",
    status: "Backlog",
    priority: "Medium"
  };
}

export default function OperationsPage() {
  const { activeClient } = useActiveClient();
  const { workspace } = useWorkspaceContext();
  const { profile } = useAuth();
  const { members } = useWorkspaceMembers(workspace.id);
  const { approvals, reviewApproval } = useApprovalsApi(activeClient.id);
  const { tasks, events, ready, error, createTask, updateTaskStatus } = useOperationsApi(
    workspace.id,
    activeClient.id
  );
  const [draft, setDraft] = useState<OperationalTask>(createEmptyTask(workspace.id, activeClient.id));
  const [saving, setSaving] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(createEmptyTask(workspace.id, activeClient.id));
  }, [activeClient.id, workspace.id]);

  const filteredTasks = useMemo(
    () => tasks.filter((task) => !task.clientId || task.clientId === activeClient.id),
    [activeClient.id, tasks]
  );
  const filteredEvents = useMemo(
    () => events.filter((event) => !event.clientId || event.clientId === activeClient.id).slice(0, 6),
    [activeClient.id, events]
  );

  const saveTask = async () => {
    if (!draft.title.trim()) {
      setFormError("Task title is required.");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      await createTask({
        ...draft,
        workspaceId: workspace.id,
        clientId: draft.clientId ?? activeClient.id
      });
      setDraft(createEmptyTask(workspace.id, activeClient.id));
    } catch (taskError) {
      setFormError(taskError instanceof Error ? taskError.message : "Unable to create task.");
    } finally {
      setSaving(false);
    }
  };

  const moveTask = async (taskId: string, status: TaskStatus) => {
    setSavingTaskId(taskId);

    try {
      await updateTaskStatus(taskId, status);
    } finally {
      setSavingTaskId(null);
    }
  };

  if (!ready) {
    return <div className="text-sm text-muted-foreground">Loading operations...</div>;
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Operations"
        title="Operations"
        description="Manage tasks, assignees, and activity across the workspace."
      />

      <StatGrid>
        <MetricCard href="/operations#task-board" label="Open Tasks" value={number(filteredTasks.filter((task) => task.status !== "Done").length)} detail="Current cross-functional work for the active client." />
        <MetricCard href="/operations#task-board" label="High Priority" value={number(filteredTasks.filter((task) => task.priority === "High").length)} detail="Items most likely to block publishing or reporting." />
        <MetricCard href="/operations#new-task" label="Team Members" value={number(members.length)} detail="Operators currently visible inside the workspace." />
        <MetricCard href="/operations#approval-queue" label="Pending Approvals" value={number(approvals.filter((approval) => approval.status === "Pending").length)} detail="Scheduled content waiting on strategist sign-off." />
        <MetricCard href="/operations#activity-log" label="Server Actions" value="Live" detail="Task mutations now flow through validated route handlers and services." tone="olive" />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card id="new-task">
          <CardHeader>
            <div>
              <CardDescription>New Operational Task</CardDescription>
              <CardTitle className="mt-3">Create work with ownership</CardTitle>
            </div>
          </CardHeader>
          <div className="grid gap-4">
            <div>
              <Label>Task Title</Label>
              <Input
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Approve launch carousel"
              />
            </div>
            <div>
              <Label>Detail</Label>
              <Textarea
                value={draft.detail}
                onChange={(event) => setDraft((current) => ({ ...current, detail: event.target.value }))}
                placeholder="What needs to happen before this is truly done?"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Status</Label>
                <Select
                  value={draft.status}
                  onChange={(value) => setDraft((current) => ({ ...current, status: value as TaskStatus }))}
                  options={taskStatuses.map((status) => ({ label: status, value: status }))}
                />
              </div>
              <div>
                <Label>Priority</Label>
                <Select
                  value={draft.priority}
                  onChange={(value) => setDraft((current) => ({ ...current, priority: value as TaskPriority }))}
                  options={taskPriorities.map((priority) => ({ label: priority, value: priority }))}
                />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={draft.dueDate ?? ""}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, dueDate: event.target.value || undefined }))
                  }
                />
              </div>
              <div>
                <Label>Assignee</Label>
                <Select
                  value={draft.assigneeUserId ?? "none"}
                  onChange={(value) => {
                    const member = members.find((item) => item.userId === value);
                    setDraft((current) => ({
                      ...current,
                      assigneeUserId: value === "none" ? undefined : value,
                      assigneeName: value === "none" ? undefined : member?.fullName
                    }));
                  }}
                  options={[
                    { label: "Unassigned", value: "none" },
                    ...members.map((member) => ({
                      label: `${member.fullName} · ${member.role}`,
                      value: member.userId
                    }))
                  ]}
                />
              </div>
            </div>
            {formError || error ? <p className="text-sm text-primary">{formError ?? error}</p> : null}
            <Button disabled={saving} onClick={() => void saveTask()}>
              {saving ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </Card>

        <Card id="task-board">
          <CardHeader>
            <div>
              <CardDescription>Task Board</CardDescription>
              <CardTitle className="mt-3">Operational status by lane</CardTitle>
            </div>
          </CardHeader>
          <div className="grid gap-4 xl:grid-cols-4">
            {taskStatuses.map((status) => {
              const laneTasks = filteredTasks.filter((task) => task.status === status);

              return (
                <div className="rounded-2xl border border-border/60 bg-card/60 p-4" key={status}>
                  <p className="text-sm uppercase tracking-[0.16em] text-primary">{status}</p>
                  <div className="mt-4 space-y-3">
                    {laneTasks.length ? (
                      laneTasks.map((task) => (
                        <ListCard className="bg-card/70 p-3" key={task.id}>
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-medium text-foreground">{task.title}</p>
                            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                              {task.priority}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{task.detail}</p>
                          <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            <span>{task.assigneeName ?? "Unassigned"}</span>
                            <DatePill className="tracking-[0.12em]" value={task.dueDate} fallback="No date" />
                          </div>
                          <select
                            className="mt-3 w-full rounded-xl border border-border bg-card/70 px-3 py-2 text-sm text-foreground"
                            disabled={savingTaskId === task.id}
                            value={task.status}
                            onChange={(event) => void moveTask(task.id, event.target.value as TaskStatus)}
                          >
                            {taskStatuses.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </ListCard>
                      ))
                    ) : (
                      <EmptyState title="No tasks" description="This lane is currently clear." />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card id="approval-queue">
        <CardHeader>
          <div>
            <CardDescription>Approvals</CardDescription>
            <CardTitle className="mt-3">Content review queue</CardTitle>
          </div>
        </CardHeader>
        <div className="space-y-3">
          {approvals.length ? (
            approvals.map((approval) => (
              <ListCard key={approval.id}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-medium text-foreground">{approval.summary}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-primary">
                      {approval.status}
                    </p>
                    {approval.note ? (
                      <p className="mt-2 text-sm text-muted-foreground">{approval.note}</p>
                    ) : null}
                  </div>
                  {approval.status === "Pending" ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void reviewApproval(approval.id, {
                            status: "Changes Requested",
                            approverName: profile?.fullName ?? profile?.email ?? "Workspace reviewer",
                            approverUserId: profile?.id,
                            note: "Requested revisions before publishing."
                          })
                        }
                      >
                        Request changes
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          void reviewApproval(approval.id, {
                            status: "Approved",
                            approverName: profile?.fullName ?? profile?.email ?? "Workspace reviewer",
                            approverUserId: profile?.id,
                            note: "Approved for publishing."
                          })
                        }
                      >
                        Approve
                      </Button>
                    </div>
                  ) : (
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-primary">
                      {approval.status}
                    </span>
                  )}
                </div>
              </ListCard>
            ))
          ) : (
            <EmptyState title="No approvals" description="Scheduled content approvals will show up here." />
          )}
        </div>
      </Card>

      <Card id="activity-log">
        <CardHeader>
          <div>
            <CardDescription>Workspace Activity</CardDescription>
            <CardTitle className="mt-3">Latest operating events</CardTitle>
          </div>
        </CardHeader>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredEvents.length ? (
            filteredEvents.map((event) => (
              <ListCard key={event.id}>
                <p className="text-xs uppercase tracking-[0.16em] text-primary">
                  {event.actorName} {event.actionLabel}
                </p>
                <p className="mt-2 font-medium text-foreground">{event.subjectName}</p>
                <p className="mt-2 text-sm text-muted-foreground">{event.detail}</p>
                <div className="mt-3">
                  <DatePill value={event.createdAt} />
                </div>
              </ListCard>
            ))
          ) : (
            <EmptyState
              title="No events yet"
              description="Task, campaign, and integration changes will accumulate here."
            />
          )}
        </div>
      </Card>
    </div>
  );
}
