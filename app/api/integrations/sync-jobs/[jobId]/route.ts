import { NextRequest, NextResponse } from "next/server";

import { requireClientRole } from "@/lib/auth/permissions";
import { updateSyncJob } from "@/lib/services/integrations-service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const body = (await request.json()) as { clientId?: string; update?: Record<string, unknown> };

  if (!body.clientId || !body.update) {
    return NextResponse.json(
      { error: "clientId and update are required." },
      { status: 400 }
    );
  }

  const permissionResponse = await requireClientRole(body.clientId, "operator");

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const { jobId } = await params;
    const job = await updateSyncJob(body.clientId, jobId, body.update);

    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update sync job." },
      { status: 500 }
    );
  }
}
