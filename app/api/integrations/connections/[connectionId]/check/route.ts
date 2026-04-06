import { NextRequest, NextResponse } from "next/server";

import { requireClientRole } from "@/lib/auth/permissions";
import {
  performConnectionCheck,
  prepareConnection
} from "@/lib/services/integrations-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const body = (await request.json()) as { clientId?: string; mode?: "check" | "prepare" };

  if (!body.clientId) {
    return NextResponse.json({ error: "clientId is required." }, { status: 400 });
  }

  const permissionResponse = await requireClientRole(body.clientId, "admin");

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const { connectionId } = await params;
    const payload =
      body.mode === "prepare"
        ? await prepareConnection(body.clientId, connectionId)
        : await performConnectionCheck(body.clientId, connectionId);

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to check integration connection."
      },
      { status: 500 }
    );
  }
}
