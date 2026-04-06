import { NextRequest, NextResponse } from "next/server";

import { requireClientRole } from "@/lib/auth/permissions";
import { removeWeeklyMetric, saveWeeklyMetric } from "@/lib/services/weekly-metrics-service";
import { createWeeklyMetricSchema } from "@/lib/validation/weekly-metrics";
import type { WeeklyMetric } from "@/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ metricId: string }> }
) {
  const body = await request.json();
  const parsed = createWeeklyMetricSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid weekly metric payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const permissionResponse = await requireClientRole(parsed.data.clientId, "operator");

  if (permissionResponse) {
    return permissionResponse;
  }

  const { metricId } = await params;
  const metric: WeeklyMetric = {
    id: metricId,
    clientId: parsed.data.clientId,
    weekLabel: parsed.data.weekLabel,
    covers: parsed.data.covers,
    notes: parsed.data.notes,
    campaignAttribution: parsed.data.campaignAttribution,
    campaignId: parsed.data.campaignId
  };

  try {
    const payload = await saveWeeklyMetric(metric);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update weekly metric." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ metricId: string }> }
) {
  const body = (await request.json()) as { clientId?: string };

  if (!body.clientId) {
    return NextResponse.json({ error: "clientId is required." }, { status: 400 });
  }

  const permissionResponse = await requireClientRole(body.clientId, "operator");

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const { metricId } = await params;
    const payload = await removeWeeklyMetric(body.clientId, metricId);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete weekly metric." },
      { status: 500 }
    );
  }
}
