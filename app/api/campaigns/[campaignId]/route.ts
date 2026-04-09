import { NextRequest, NextResponse } from "next/server";

import { requireClientRole } from "@/lib/auth/permissions";
import { archiveCampaign, updateCampaign } from "@/lib/services/campaigns-service";
import { archiveCampaignSchema, createCampaignSchema } from "@/lib/validation/campaigns";
import type { Campaign } from "@/types";

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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const body = await request.json();
  const parsed = createCampaignSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid campaign payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const permissionResponse = await requireClientRole(parsed.data.clientId, "strategist");

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const { campaignId } = await params;
    const campaign: Campaign = {
      id: campaignId,
      clientId: parsed.data.clientId,
      name: parsed.data.name,
      objective: parsed.data.objective,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      channels: parsed.data.channels,
      linkedPostIds: parsed.data.linkedPostIds,
      linkedBlogPostIds: parsed.data.linkedBlogPostIds,
      linkedAssetIds: parsed.data.linkedAssetIds,
      linkedWeeklyMetricIds: parsed.data.linkedWeeklyMetricIds,
      notes: parsed.data.notes,
      status: parsed.data.status
    };

    const updatedCampaign = await updateCampaign(campaign);

    return NextResponse.json({ campaign: updatedCampaign });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update campaign." },
      { status: 500 }
    );
  }
}
