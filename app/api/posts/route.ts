import { NextRequest, NextResponse } from "next/server";

import { requireClientPermission, requireClientRole } from "@/lib/auth/permissions";
import { createPost, listClientPosts } from "@/lib/services/posts-service";
import { createPostSchema } from "@/lib/validation/posts";
import type { Post } from "@/types";

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
    const posts = await listClientPosts(clientId);

    return NextResponse.json({ posts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load posts." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createPostSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid post payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const permissionResponse = await requireClientRole(parsed.data.clientId, "operator");

  if (permissionResponse) {
    return permissionResponse;
  }

  const post: Post = {
    id: `po-${Date.now()}`,
    clientId: parsed.data.clientId,
    platform: parsed.data.platform,
    content: parsed.data.content,
    cta: parsed.data.cta,
    publishDate: parsed.data.publishDate,
    goal: parsed.data.goal,
    status: parsed.data.status,
    plannerItemId: parsed.data.plannerItemId,
    campaignId: parsed.data.campaignId,
    assetIds: parsed.data.assetIds,
    createdAt: new Date().toISOString()
  };

  try {
    const payload = await createPost(post);

    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create post." },
      { status: 500 }
    );
  }
}
