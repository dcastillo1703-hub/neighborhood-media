import { NextRequest, NextResponse } from "next/server";

import { requireClientRole } from "@/lib/auth/permissions";
import {
  getGoogleAnalyticsSummary,
  syncGoogleAnalytics
} from "@/lib/services/google-analytics-service";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    clientId?: string;
  };

  if (!body.clientId) {
    return NextResponse.json({ error: "clientId is required." }, { status: 400 });
  }

  const permissionResponse = await requireClientRole(body.clientId, "admin");

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const sync = await syncGoogleAnalytics(body.clientId);
    const summary = await getGoogleAnalyticsSummary(body.clientId, request.url);

    return NextResponse.json({ sync, summary });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to sync Google Analytics."
      },
      { status: 500 }
    );
  }
}
