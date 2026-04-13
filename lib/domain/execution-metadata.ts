import type { OperationalTask, Post } from "@/types";

const TASK_META_PREFIX = "__nmos_task_meta__";
const POST_META_PREFIX = "__nmos_post_meta__";

type TaskMeta = Pick<
  OperationalTask,
  "taskType" | "startDate" | "isMilestone" | "blockedByTaskIds" | "linkedPostId" | "notes"
>;

type PostMeta = Pick<Post, "format" | "destinationUrl" | "assetState" | "linkedTaskId">;

function splitPayload(value: string, prefix: string) {
  const separatorIndex = value.indexOf(`\n${prefix}`);

  if (separatorIndex === -1) {
    return { body: value, metadata: null as string | null };
  }

  return {
    body: value.slice(0, separatorIndex).trimEnd(),
    metadata: value.slice(separatorIndex + 1 + prefix.length)
  };
}

export function decodeTaskDetail(detail: string): { detail: string; meta: TaskMeta } {
  const { body, metadata } = splitPayload(detail, TASK_META_PREFIX);

  if (!metadata) {
    return { detail, meta: {} };
  }

  try {
    const parsed = JSON.parse(metadata) as Partial<TaskMeta>;

    return {
      detail: body,
      meta: {
        taskType: parsed.taskType,
        startDate: parsed.startDate,
        isMilestone: parsed.isMilestone,
        blockedByTaskIds: Array.isArray(parsed.blockedByTaskIds) ? parsed.blockedByTaskIds : [],
        linkedPostId: parsed.linkedPostId,
        notes: Array.isArray(parsed.notes) ? parsed.notes.filter((note): note is string => typeof note === "string") : []
      }
    };
  } catch {
    return { detail, meta: {} };
  }
}

export function encodeTaskDetail(detail: string, meta: TaskMeta) {
  const payload = {
    taskType: meta.taskType,
    startDate: meta.startDate,
    isMilestone: meta.isMilestone,
    blockedByTaskIds: meta.blockedByTaskIds?.filter(Boolean) ?? [],
    linkedPostId: meta.linkedPostId,
    notes: meta.notes?.filter(Boolean) ?? []
  };

  return `${detail.trim()}\n${TASK_META_PREFIX}${JSON.stringify(payload)}`;
}

export function decodePostContent(content: string): { content: string; meta: PostMeta } {
  const { body, metadata } = splitPayload(content, POST_META_PREFIX);

  if (!metadata) {
    return { content, meta: {} };
  }

  try {
    const parsed = JSON.parse(metadata) as Partial<PostMeta>;

    return {
      content: body,
      meta: {
        format: parsed.format,
        destinationUrl: parsed.destinationUrl,
        assetState: parsed.assetState,
        linkedTaskId: parsed.linkedTaskId
      }
    };
  } catch {
    return { content, meta: {} };
  }
}

export function encodePostContent(content: string, meta: PostMeta) {
  const payload = {
    format: meta.format,
    destinationUrl: meta.destinationUrl,
    assetState: meta.assetState,
    linkedTaskId: meta.linkedTaskId
  };

  return `${content.trim()}\n${POST_META_PREFIX}${JSON.stringify(payload)}`;
}
