import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";

import { requireClientRole } from "@/lib/auth/permissions";
import { replaceWeeklyMetricsSnapshot } from "@/lib/services/weekly-metrics-service";
import { createWeeklyMetricSchema } from "@/lib/validation/weekly-metrics";
import type { WeeklyMetric } from "@/types";

type ParsedWeeklyMetric = z.infer<typeof createWeeklyMetricSchema>;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    clientId?: string;
    metrics?: unknown[];
    importLabel?: string;
  };

  if (!body?.clientId || !Array.isArray(body?.metrics)) {
    return NextResponse.json({ error: "clientId and metrics are required." }, { status: 400 });
  }

  const permissionResponse = await requireClientRole(body.clientId, "operator");

  if (permissionResponse) {
    return permissionResponse;
  }

  const parsedResults = body.metrics.map((metric: unknown) => createWeeklyMetricSchema.safeParse(metric));
  const parsedMetrics = parsedResults.filter((result): result is { success: true; data: ParsedWeeklyMetric } => result.success);

  if (!parsedMetrics.length) {
    return NextResponse.json({ error: "No valid metrics were provided." }, { status: 400 });
  }

  try {
    const payload = await replaceWeeklyMetricsSnapshot(
      body.clientId,
      parsedMetrics.map(
        (result: { success: true; data: ParsedWeeklyMetric }, index): WeeklyMetric => ({
          id: `wm-import-${Date.now()}-${index}`,
          createdAt: new Date().toISOString(),
          ...result.data
        })
      ),
      body.importLabel
    );

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to apply uploaded metrics." },
      { status: 500 }
    );
  }
}
