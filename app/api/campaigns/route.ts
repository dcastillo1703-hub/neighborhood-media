import { NextRequest, NextResponse } from "next/server";

import { requireClientPermission, requireClientRole } from "@/lib/auth/permissions";
import { createCampaign, listClientCampaigns } from "@/lib/services/campaigns-service";
import { createCampaignSchema } from "@/lib/validation/campaigns";
import type { Campaign } from "@/types";

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
    const campaigns = await listClientCampaigns(clientId);

    return NextResponse.json({ campaigns });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load campaigns." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

  const campaign: Campaign = {
    id: `ca-${Date.now()}`,
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

  try {
    const payload = await createCampaign(campaign);

    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create campaign." },
      { status: 500 }
    );
  }
}
