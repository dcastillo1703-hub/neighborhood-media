import { NextRequest, NextResponse } from "next/server";

import { requireClientRole } from "@/lib/auth/permissions";
import { selectMetaBusinessAsset } from "@/lib/services/meta-auth-service";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    clientId?: string;
    provider?: "facebook" | "instagram";
    assetId?: string;
  };

  if (!body.clientId || !body.provider || !body.assetId) {
    return NextResponse.json(
      { error: "clientId, provider, and assetId are required." },
      { status: 400 }
    );
  }

  const permissionResponse = await requireClientRole(body.clientId, "admin");

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const connection = await selectMetaBusinessAsset({
      clientId: body.clientId,
      provider: body.provider,
      assetId: body.assetId
    });

    return NextResponse.json({ connection });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to select Meta account."
      },
      { status: 500 }
    );
  }
}
