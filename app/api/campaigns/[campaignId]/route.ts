import { NextRequest, NextResponse } from "next/server";

import { requireClientRole } from "@/lib/auth/permissions";
import { archiveCampaign } from "@/lib/services/campaigns-service";
import { archiveCampaignSchema } from "@/lib/validation/campaigns";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const body = await request.json();
  const parsed = archiveCampaignSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid archive request.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const permissionResponse = await requireClientRole(parsed.data.clientId, "strategist");

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const { campaignId } = await params;
    const payload = await archiveCampaign(parsed.data.clientId, campaignId);

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to archive campaign." },
      { status: 404 }
    );
  }
}
