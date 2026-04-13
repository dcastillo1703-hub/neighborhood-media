import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceRole } from "@/lib/auth/permissions";
import { createOperationalTask } from "@/lib/services/operations-service";
import { createOperationalTaskSchema } from "@/lib/validation/operations";
import type { OperationalTask } from "@/types";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createOperationalTaskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid task payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const permissionResponse = await requireWorkspaceRole(parsed.data.workspaceId, "operator");

  if (permissionResponse) {
    return permissionResponse;
  }

  const task: OperationalTask = {
    id: `task-${Date.now()}`,
    workspaceId: parsed.data.workspaceId,
    clientId: parsed.data.clientId,
    title: parsed.data.title,
    detail: parsed.data.detail,
    taskType: parsed.data.taskType,
    status: parsed.data.status,
    priority: parsed.data.priority,
    startDate: parsed.data.startDate,
    dueDate: parsed.data.dueDate,
    isMilestone: parsed.data.isMilestone,
    blockedByTaskIds: parsed.data.blockedByTaskIds,
    linkedPostId: parsed.data.linkedPostId,
    notes: parsed.data.notes,
    assigneeUserId: parsed.data.assigneeUserId,
    assigneeName: parsed.data.assigneeName,
    linkedEntityType: parsed.data.linkedEntityType,
    linkedEntityId: parsed.data.linkedEntityId,
    createdAt: new Date().toISOString()
  };

  const payload = await createOperationalTask(task);

  return NextResponse.json(payload, { status: 201 });
}
