import { NextRequest, NextResponse } from "next/server";

import { requireAdminPermission, requireClientPermission } from "@/lib/auth/permissions";
import {
  createClientMembership,
  listClientMemberships
} from "@/lib/services/client-memberships-service";
import {
  createClientMembershipSchema,
  listClientMembershipsQuerySchema
} from "@/lib/validation/client-memberships";

export async function GET(request: NextRequest) {
  const parsed = listClientMembershipsQuerySchema.safeParse({
    clientId: request.nextUrl.searchParams.get("clientId")
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid client membership query.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const permissionResponse = await requireClientPermission(parsed.data.clientId);

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const memberships = await listClientMemberships(parsed.data.clientId);
    return NextResponse.json({ memberships });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load client memberships."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createClientMembershipSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid client membership payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const permissionResponse = await requireAdminPermission();

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const payload = await createClientMembership(parsed.data);
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create client membership."
      },
      { status: 500 }
    );
  }
}
