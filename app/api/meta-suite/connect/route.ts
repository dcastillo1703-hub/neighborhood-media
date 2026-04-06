import { NextRequest, NextResponse } from "next/server";

import { requireClientRole } from "@/lib/auth/permissions";
import { beginMetaBusinessConnection } from "@/lib/services/meta-suite-service";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    clientId?: string;
    provider?: "facebook" | "instagram";
  };

  if (!body.clientId || !body.provider) {
    return NextResponse.json(
      { error: "clientId and provider are required." },
      { status: 400 }
    );
  }

  const permissionResponse = await requireClientRole(body.clientId, "admin");

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const payload = await beginMetaBusinessConnection(body.clientId, body.provider);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to prepare Meta connection."
      },
      { status: 500 }
    );
  }
}
