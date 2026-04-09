import { NextRequest, NextResponse } from "next/server";

import { requireClientRole } from "@/lib/auth/permissions";
import { getGoogleAnalyticsSummary } from "@/lib/services/google-analytics-service";

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json({ error: "clientId is required." }, { status: 400 });
  }

  const permissionResponse = await requireClientRole(clientId, "admin");

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const summary = await getGoogleAnalyticsSummary(clientId);
    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Google Analytics summary."
      },
      { status: 500 }
    );
  }
}
