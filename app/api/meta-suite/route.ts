import { NextRequest, NextResponse } from "next/server";

import { requireClientPermission } from "@/lib/auth/permissions";
import { getMetaBusinessSuiteSummary } from "@/lib/services/meta-suite-service";

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
    const summary = await getMetaBusinessSuiteSummary(clientId, request.url);
    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load Meta suite summary." },
      { status: 500 }
    );
  }
}
