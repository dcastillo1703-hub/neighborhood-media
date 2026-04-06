import { NextRequest, NextResponse } from "next/server";

import { requireClientPermission } from "@/lib/auth/permissions";
import { listApprovalRequests } from "@/lib/services/approvals-service";
import { listApprovalRequestsQuerySchema } from "@/lib/validation/approvals";

export async function GET(request: NextRequest) {
  const parsed = listApprovalRequestsQuerySchema.safeParse({
    clientId: request.nextUrl.searchParams.get("clientId")
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid approvals query.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const permissionResponse = await requireClientPermission(parsed.data.clientId);

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const approvals = await listApprovalRequests(parsed.data.clientId);
    return NextResponse.json({ approvals });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load approvals." },
      { status: 500 }
    );
  }
}
