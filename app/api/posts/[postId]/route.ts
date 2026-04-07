import { NextRequest, NextResponse } from "next/server";

import { requireClientRole } from "@/lib/auth/permissions";
import { updatePost } from "@/lib/services/posts-service";
import { updatePostSchema } from "@/lib/validation/posts";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const body = await request.json();
  const parsed = updatePostSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid post update payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const permissionResponse = await requireClientRole(parsed.data.clientId, "operator");

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const { postId } = await params;
    const { clientId, ...updates } = parsed.data;
    const payload = await updatePost(clientId, postId, updates);

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update post." },
      { status: 404 }
    );
  }
}
