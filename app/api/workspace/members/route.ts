import { NextRequest, NextResponse } from "next/server";

import {
  requireAdminPermission,
  requireWorkspacePermission
} from "@/lib/auth/permissions";
import {
  createWorkspaceMember,
  listWorkspaceMembers
} from "@/lib/services/workspace-members-service";
import {
  createWorkspaceMemberSchema,
  listWorkspaceMembersQuerySchema
} from "@/lib/validation/workspace-members";

export async function GET(request: NextRequest) {
  const parsed = listWorkspaceMembersQuerySchema.safeParse({
    workspaceId: request.nextUrl.searchParams.get("workspaceId")
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid workspace query.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const permissionResponse = await requireWorkspacePermission({
    workspaceId: parsed.data.workspaceId
  });

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const members = await listWorkspaceMembers(parsed.data.workspaceId);
    return NextResponse.json({ members });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load workspace members."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createWorkspaceMemberSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid workspace member payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const permissionResponse = await requireAdminPermission();

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const payload = await createWorkspaceMember(parsed.data);
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create workspace member."
      },
      { status: 500 }
    );
  }
}
