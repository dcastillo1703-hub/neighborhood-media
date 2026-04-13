import type { ApprovalStatus, OperationalTask, Post, PublishJobStatus } from "@/types";

export type PipelineStageState =
  | "Empty"
  | "In Progress"
  | "Waiting"
  | "Ready"
  | "Scheduled"
  | "Measuring"
  | "Complete"
  | "Blocked";

export type ContentExecutionState =
  | "Draft"
  | "In Review"
  | "Approved"
  | "Scheduled"
  | "Published";

export function getTaskExecutionState(task: OperationalTask, now = new Date()) {
  if (task.blockedByTaskIds?.length && task.status === "Waiting") {
    return "Blocked";
  }

  if (task.status !== "Done" && task.dueDate && new Date(task.dueDate) < now) {
    return "Overdue";
  }

  if (task.isMilestone) {
    return "Milestone";
  }

  return task.status;
}

export function getContentExecutionState(
  post: Post,
  approvalStatus?: ApprovalStatus,
  publishStatus?: PublishJobStatus
): ContentExecutionState {
  const resolvedApproval = approvalStatus ?? post.approvalState;
  const resolvedPublish = publishStatus ?? post.publishState;

  if (post.status === "Published" || resolvedPublish === "Published") {
    return "Published";
  }

  if (post.status === "Scheduled" || resolvedPublish === "Queued" || resolvedPublish === "Processing") {
    return "Scheduled";
  }

  if (resolvedApproval === "Approved") {
    return "Approved";
  }

  if (resolvedApproval === "Pending" || resolvedApproval === "Changes Requested") {
    return "In Review";
  }

  return "Draft";
}

export function getPipelineStateTone(state: PipelineStageState) {
  switch (state) {
    case "Complete":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "Ready":
      return "border-[var(--app-accent-bg)]/30 bg-[var(--app-accent-soft)] text-foreground";
    case "Scheduled":
    case "Measuring":
      return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    case "Blocked":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "Waiting":
      return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
    case "Empty":
      return "border-border bg-card/70 text-muted-foreground";
    case "In Progress":
    default:
      return "border-border bg-card/70 text-foreground";
  }
}

