import { NextRequest, NextResponse } from "next/server";

import { requireClientPermission, requireClientRole } from "@/lib/auth/permissions";
import { listWeeklyMetrics, saveWeeklyMetric } from "@/lib/services/weekly-metrics-service";
import { createWeeklyMetricSchema } from "@/lib/validation/weekly-metrics";
import type { WeeklyMetric } from "@/types";

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
    const metrics = await listWeeklyMetrics(clientId);

    return NextResponse.json({ metrics });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load weekly metrics." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

  const metric: WeeklyMetric = {
    id: `wm-${Date.now()}`,
    clientId: parsed.data.clientId,
    weekLabel: parsed.data.weekLabel,
    covers: parsed.data.covers,
    netSales: parsed.data.netSales,
    totalOrders: parsed.data.totalOrders,
    notes: parsed.data.notes,
    campaignAttribution: parsed.data.campaignAttribution,
    campaignId: parsed.data.campaignId,
    createdAt: new Date().toISOString()
  };

  try {
    const payload = await saveWeeklyMetric(metric);
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save weekly metric." },
      { status: 500 }
    );
  }
}
