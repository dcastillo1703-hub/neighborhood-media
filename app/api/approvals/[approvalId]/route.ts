import { NextRequest, NextResponse } from "next/server";

import { requireClientRole } from "@/lib/auth/permissions";
import { reviewApprovalRequest } from "@/lib/services/approvals-service";
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
