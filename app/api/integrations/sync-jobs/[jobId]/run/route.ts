import { NextRequest, NextResponse } from "next/server";

import { requireClientRole } from "@/lib/auth/permissions";
import { runSyncJob } from "@/lib/services/integrations-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const body = (await request.json()) as { clientId?: string };

  if (!body.clientId) {
    return NextResponse.json({ error: "clientId is required." }, { status: 400 });
  }

  const permissionResponse = await requireClientRole(body.clientId, "operator");

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const { jobId } = await params;
    const payload = await runSyncJob(body.clientId, jobId);

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to run sync job."
      },
      { status: 500 }
    );
  }
}
