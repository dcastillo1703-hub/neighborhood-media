import { NextRequest, NextResponse } from "next/server";

import { requireClientPermission } from "@/lib/auth/permissions";
import { listPublishJobs } from "@/lib/services/publishing-service";

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json({ error: "clientId is required." }, { status: 400 });
  }

  const permissionResponse = await requireClientPermission(clientId);

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const jobs = await listPublishJobs(clientId);

    return NextResponse.json({ jobs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load publish jobs." },
      { status: 500 }
    );
  }
}
