import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceRole } from "@/lib/auth/permissions";
import { updateOperationalTask } from "@/lib/services/operations-service";
import { updateOperationalTaskSchema } from "@/lib/validation/operations";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const body = await request.json();
  const parsed = updateOperationalTaskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid task update.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const permissionResponse = await requireWorkspaceRole(parsed.data.workspaceId, "operator");

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const { taskId } = await params;
    const { workspaceId, ...updates } = parsed.data;
    const payload = await updateOperationalTask(workspaceId, taskId, updates);

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update task." },
      { status: 404 }
    );
  }
}
