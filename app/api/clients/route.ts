import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceOnlyPermission } from "@/lib/auth/permissions";
import { listVisibleClients } from "@/lib/services/clients-service";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId") ?? "ws-neighborhood";

  const permissionResponse = await requireWorkspaceOnlyPermission(workspaceId);

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const clients = await listVisibleClients(workspaceId);
    return NextResponse.json({ clients });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load clients."
      },
      { status: 500 }
    );
  }
}
