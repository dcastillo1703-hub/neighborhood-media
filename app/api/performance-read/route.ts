import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireClientPermission } from "@/lib/auth/permissions";
import {
  buildFallbackPerformanceRead,
  buildPerformanceReadPrompt,
  performanceReadContextSchema,
  performanceReadResultSchema
} from "@/lib/agents/performance-read";

const performanceReadRequestSchema = z.object({
  clientId: z.string().min(1, "clientId is required."),
  context: performanceReadContextSchema
});

function stripCodeFences(value: string) {
  const trimmed = value.trim();

  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = performanceReadRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid performance read payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const permissionResponse = await requireClientPermission(parsed.data.clientId);

  if (permissionResponse) {
    return permissionResponse;
  }

  const fallback = buildFallbackPerformanceRead(parsed.data.context);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ read: fallback });
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const { systemPrompt, userPrompt } = buildPerformanceReadPrompt(parsed.data.context);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      return NextResponse.json({ read: fallback });
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
        };
      }>;
    };

    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ read: fallback });
    }

    const parsedContent = performanceReadResultSchema.safeParse(
      JSON.parse(stripCodeFences(content))
    );

    if (!parsedContent.success) {
      return NextResponse.json({ read: fallback });
    }

    return NextResponse.json({ read: parsedContent.data });
  } catch {
    return NextResponse.json({ read: fallback });
  }
}
