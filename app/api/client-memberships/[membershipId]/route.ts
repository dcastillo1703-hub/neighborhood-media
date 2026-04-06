import { NextRequest, NextResponse } from "next/server";

import { requireAdminPermission } from "@/lib/auth/permissions";
import { updateClientMembership } from "@/lib/services/client-memberships-service";
import { updateClientMembershipSchema } from "@/lib/validation/client-memberships";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  const body = await request.json();
  const parsed = updateClientMembershipSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid client membership update.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const permissionResponse = await requireAdminPermission();

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const { membershipId } = await params;
    const payload = await updateClientMembership(
      parsed.data.clientId,
      membershipId,
      parsed.data.role
    );
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update client membership."
      },
      { status: 500 }
    );
  }
}
