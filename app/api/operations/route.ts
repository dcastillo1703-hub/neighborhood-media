import { NextRequest, NextResponse } from "next/server";

import { requireWorkspacePermission } from "@/lib/auth/permissions";
import { listWorkspaceOperations } from "@/lib/services/operations-service";
import { listOperationsQuerySchema } from "@/lib/validation/operations";

export async function GET(request: NextRequest) {
  const parsed = listOperationsQuerySchema.safeParse({
    workspaceId: request.nextUrl.searchParams.get("workspaceId"),
    clientId: request.nextUrl.searchParams.get("clientId") ?? undefined
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid workspace query.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const permissionResponse = await requireWorkspacePermission(parsed.data);

  if (permissionResponse) {
    return permissionResponse;
  }

  const payload = await listWorkspaceOperations(parsed.data.workspaceId, parsed.data.clientId);

  return NextResponse.json(payload);
}
