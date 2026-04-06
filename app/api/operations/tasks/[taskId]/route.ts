import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceRole } from "@/lib/auth/permissions";
import { updateOperationalTaskStatus } from "@/lib/services/operations-service";
import { updateOperationalTaskStatusSchema } from "@/lib/validation/operations";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const body = await request.json();
  const parsed = updateOperationalTaskStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid task status update.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const permissionResponse = await requireWorkspaceRole(parsed.data.workspaceId, "operator");

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const { taskId } = await params;
    const payload = await updateOperationalTaskStatus(
      parsed.data.workspaceId,
      taskId,
      parsed.data.status
    );

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update task." },
      { status: 404 }
    );
  }
}
