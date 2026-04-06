import { NextRequest, NextResponse } from "next/server";

import { requireClientRole } from "@/lib/auth/permissions";
import { updateIntegrationConnection } from "@/lib/services/integrations-service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const body = (await request.json()) as { clientId?: string; update?: Record<string, unknown> };

  if (!body.clientId || !body.update) {
    return NextResponse.json(
      { error: "clientId and update are required." },
      { status: 400 }
    );
  }

  const permissionResponse = await requireClientRole(body.clientId, "admin");

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const { connectionId } = await params;
    const connection = await updateIntegrationConnection(
      body.clientId,
      connectionId,
      body.update
    );

    return NextResponse.json({ connection });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update connection." },
      { status: 500 }
    );
  }
}
