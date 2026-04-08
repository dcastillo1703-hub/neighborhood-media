import { NextRequest, NextResponse } from "next/server";

import { requireClientRole } from "@/lib/auth/permissions";
import { deletePlannerItem, updatePlannerItemStatus } from "@/lib/services/planner-items-service";
import { updatePlannerItemStatusSchema } from "@/lib/validation/planner-items";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const body = await request.json();
  const parsed = updatePlannerItemStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid planner item status update.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const permissionResponse = await requireClientRole(parsed.data.clientId, "operator");

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const { itemId } = await params;
    const payload = await updatePlannerItemStatus(parsed.data.clientId, itemId, parsed.data.status);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update planner item." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const clientId = request.nextUrl.searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json({ error: "clientId is required." }, { status: 400 });
  }

  const permissionResponse = await requireClientRole(clientId, "operator");

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const { itemId } = await params;
    const payload = await deletePlannerItem(clientId, itemId);

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete planner item." },
      { status: 500 }
    );
  }
}
