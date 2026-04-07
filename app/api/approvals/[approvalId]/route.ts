import { NextRequest, NextResponse } from "next/server";

import { requireClientRole } from "@/lib/auth/permissions";
import { deleteApprovalRequest, reviewApprovalRequest } from "@/lib/services/approvals-service";
import { reviewApprovalRequestSchema } from "@/lib/validation/approvals";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ approvalId: string }> }
) {
  const body = await request.json();
  const parsed = reviewApprovalRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid approval review payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const permissionResponse = await requireClientRole(parsed.data.clientId, "strategist");

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const { approvalId } = await params;
    const payload = await reviewApprovalRequest({
      ...parsed.data,
      approvalId
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to review approval." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ approvalId: string }> }
) {
  const clientId = request.nextUrl.searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json({ error: "clientId is required." }, { status: 400 });
  }

  const permissionResponse = await requireClientRole(clientId, "strategist");

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const { approvalId } = await params;
    const payload = await deleteApprovalRequest(clientId, approvalId);

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete approval." },
      { status: 500 }
    );
  }
}
