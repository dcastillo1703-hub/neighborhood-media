import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireClientPermission } from "@/lib/auth/permissions";
import {
  buildFallbackSchedulingPlan,
  buildSchedulingPlanPrompt,
  schedulingPlanContextSchema,
  schedulingPlanResultSchema
} from "@/lib/agents/scheduling";

const schedulingRequestSchema = z.object({
  clientId: z.string().min(1, "clientId is required."),
  context: schedulingPlanContextSchema
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

  const parsed = schedulingRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid scheduling payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const permissionResponse = await requireClientPermission(parsed.data.clientId);

  if (permissionResponse) {
    return permissionResponse;
  }

  const fallback = buildFallbackSchedulingPlan(parsed.data.context);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ plan: fallback });
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const { systemPrompt, userPrompt } = buildSchedulingPlanPrompt(parsed.data.context);

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
      return NextResponse.json({ plan: fallback });
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
      return NextResponse.json({ plan: fallback });
    }

    const parsedContent = schedulingPlanResultSchema.safeParse(JSON.parse(stripCodeFences(content)));

    if (!parsedContent.success) {
      return NextResponse.json({ plan: fallback });
    }

    return NextResponse.json({ plan: parsedContent.data });
  } catch {
    return NextResponse.json({ plan: fallback });
  }
}
