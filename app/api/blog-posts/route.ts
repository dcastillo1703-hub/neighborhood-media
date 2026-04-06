import { NextRequest, NextResponse } from "next/server";

import { requireClientPermission } from "@/lib/auth/permissions";
import { listBlogPosts } from "@/lib/services/blog-posts-service";

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
    const blogPosts = await listBlogPosts(clientId);
    return NextResponse.json({ blogPosts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load blog posts." },
      { status: 500 }
    );
  }
}
