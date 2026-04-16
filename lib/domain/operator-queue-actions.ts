import type { OperatorQueueItem } from "@/lib/domain/operator-queue";

export function getQueueToneLabel(item: OperatorQueueItem) {
  switch (item.tone) {
    case "review":
      return "Review";
    case "schedule":
      return "Ready";
    case "publishing":
      return "Publishing";
    case "goal":
      return "Goal";
    case "content":
      return "Scheduled";
    default:
      return "Task";
  }
}

export function getQueuePrimaryActionLabel(item: OperatorQueueItem) {
  if (item.entityType === "approval") {
    return "Approve";
  }

  if (item.entityType === "task") {
    return "Mark done";
  }

  if (item.entityType === "post" && item.tone === "schedule") {
    return "Schedule";
  }

  return "Open";
}

export function getQueueSecondaryActionLabel(item: OperatorQueueItem) {
  if (item.entityType === "approval") {
    return "Request changes";
  }

  return null;
}

export function isQueueUndoable(item: OperatorQueueItem) {
  return item.entityType === "task" || (item.entityType === "post" && item.tone === "schedule");
}
