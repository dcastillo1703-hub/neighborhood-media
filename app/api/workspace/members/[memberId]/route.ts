import { NextRequest, NextResponse } from "next/server";

import { requireAdminPermission } from "@/lib/auth/permissions";
import { updateWorkspaceMember } from "@/lib/services/workspace-members-service";
import { updateWorkspaceMemberSchema } from "@/lib/validation/workspace-members";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const body = await request.json();
  const parsed = updateWorkspaceMemberSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid workspace member update.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const permissionResponse = await requireAdminPermission();

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const { memberId } = await params;
    const payload = await updateWorkspaceMember(
      parsed.data.workspaceId,
      memberId,
      parsed.data
    );

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update workspace member."
      },
      { status: 500 }
    );
  }
}
