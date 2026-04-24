import { NextRequest, NextResponse } from "next/server";

import { completeMetaOAuthCallback } from "@/lib/services/meta-auth-service";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");
  const errorReason = request.nextUrl.searchParams.get("error_description");

  if (error) {
    const redirectUrl = new URL("/settings", request.url);
    redirectUrl.searchParams.set("meta", "error");
    redirectUrl.searchParams.set("reason", errorReason ?? error);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code || !state) {
    const redirectUrl = new URL("/settings", request.url);
    redirectUrl.searchParams.set("meta", "missing-code");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const payload = await completeMetaOAuthCallback(code, state, request.url);
    const redirectUrl = new URL("/settings", request.url);
    redirectUrl.searchParams.set("meta", "connected");
    redirectUrl.searchParams.set("provider", payload.provider);
    return NextResponse.redirect(redirectUrl);
  } catch (callbackError) {
    const redirectUrl = new URL("/settings", request.url);
    redirectUrl.searchParams.set("meta", "error");
    redirectUrl.searchParams.set(
      "reason",
      callbackError instanceof Error ? callbackError.message : "Meta callback failed."
    );
    return NextResponse.redirect(redirectUrl);
  }
}
