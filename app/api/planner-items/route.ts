import { NextRequest, NextResponse } from "next/server";

import { requireClientPermission, requireClientRole } from "@/lib/auth/permissions";
import { createPlannerItem, listPlannerItems } from "@/lib/services/planner-items-service";
import { createPlannerItemSchema } from "@/lib/validation/planner-items";
import type { PlannerItem } from "@/types";

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
    const items = await listPlannerItems(clientId);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load planner items." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createPlannerItemSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid planner item payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const permissionResponse = await requireClientRole(parsed.data.clientId, "operator");

  if (permissionResponse) {
    return permissionResponse;
  }

  const item: PlannerItem = {
    id: `pl-${Date.now()}`,
    clientId: parsed.data.clientId,
    dayOfWeek: parsed.data.dayOfWeek,
    platform: parsed.data.platform,
    contentType: parsed.data.contentType,
    campaignGoal: parsed.data.campaignGoal,
    status: parsed.data.status,
    caption: parsed.data.caption,
    campaignId: parsed.data.campaignId,
    createdAt: new Date().toISOString()
  };

  try {
    const payload = await createPlannerItem(item);
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create planner item." },
      { status: 500 }
    );
  }
}
