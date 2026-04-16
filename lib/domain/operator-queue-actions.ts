import type { OperatorQueueItem } from "@/lib/domain/operator-queue";

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
