"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Brush, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

import { ChartShell } from "@/components/charts/chart-shell";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListCard } from "@/components/dashboard/list-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatGrid } from "@/components/dashboard/stat-grid";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActiveClient } from "@/lib/client-context";
import { meamaToastMonthlySnapshots } from "@/data/toast";
import { buildMonthlyPerformance, getLatestWeekSummary } from "@/lib/domain/performance";
import { useCampaigns } from "@/lib/repositories/use-campaigns";
import { useClientSettings } from "@/lib/repositories/use-client-settings";
import { useWeeklyMetrics } from "@/lib/repositories/use-weekly-metrics";
import { currency, number } from "@/lib/utils";
import { validateWeeklyMetric } from "@/lib/validation";
import { WeeklyMetric } from "@/types";

const createEmptyMetric = (clientId: string): WeeklyMetric => ({
  id: "",
  clientId,
  weekLabel: "",
  covers: 0,
  netSales: 0,
  totalOrders: 0,
  notes: "",
  campaignAttribution: ""
});

export default function WeeklyPerformancePage() {
  const { activeClient } = useActiveClient();
  const { settings } = useClientSettings(activeClient.id);
  const { campaigns } = useCampaigns(activeClient.id);
  const { metrics, saveMetric: persistMetric, deleteMetric, ready, error } = useWeeklyMetrics(activeClient.id);
  const [draft, setDraft] = useState<WeeklyMetric>(createEmptyMetric(activeClient.id));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showFullMonthlyTimeline, setShowFullMonthlyTimeline] = useState(false);

  useEffect(() => {
    setDraft(createEmptyMetric(activeClient.id));
  }, [activeClient.id]);

  const summary = useMemo(
    () => getLatestWeekSummary(metrics, settings.averageCheck),
    [metrics, settings.averageCheck]
  );
  const monthlyPerformance = useMemo(
    () =>
      buildMonthlyPerformance(
        metrics,
        settings.averageCheck,
        settings.guestsPerTable,
        showFullMonthlyTimeline ? 8 : 6,
        false
      ),
    [metrics, settings.averageCheck, settings.guestsPerTable, showFullMonthlyTimeline]
  );
  const latestToastMonthlySnapshot =
    meamaToastMonthlySnapshots[meamaToastMonthlySnapshots.length - 1] ?? null;

  const resetDraft = () => {
    setDraft(createEmptyMetric(activeClient.id));
    setEditingId(null);
    setErrors({});
  };

  const saveMetric = () => {
    const result = validateWeeklyMetric(draft);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }

    void persistMetric(
      {
        ...draft,
        ...result.data,
        id: editingId ?? `wm-${Date.now()}`,
        clientId: activeClient.id
      },
      editingId
    )
      .then(() => {
        resetDraft();
      })
      .catch(() => {
        setErrors({
          form: "Weekly metric could not be saved. Check backend connectivity and permissions."
        });
      });
  };

  const startEdit = (metric: WeeklyMetric) => {
    setDraft(metric);
    setEditingId(metric.id);
    setErrors({});
  };

  const removeMetric = (id: string) => {
    void deleteMetric(id)
      .then(() => {
        if (editingId === id) {
          resetDraft();
        }
      })
      .catch(() => {
        setErrors({
          form: "Weekly metric could not be deleted. Check backend connectivity and permissions."
        });
      });
  };

  if (!ready) {
    return <div className="text-sm text-muted-foreground">Loading weekly performance...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive">{error}</div>;
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Weekly performance"
        title="Weekly covers"
        description="Track covers, revenue, and week-over-week changes against campaign activity."
      />
      <StatGrid>
        <MetricCard label="Rolling Average Covers" value={number(summary.average, 1)} detail="Average weekly traffic across all entered weeks." />
        <MetricCard label="Best Week" value={summary.best ? summary.best.weekLabel : "N/A"} detail={summary.best ? `${number(summary.best.covers)} covers achieved.` : "No data yet."} />
        <MetricCard label="Latest Revenue" value={currency(summary.latestRevenue)} detail="Derived automatically from covers x average check." />
        <MetricCard
          label="Latest WoW Change"
          value={`${summary.latestWowChange > 0 ? "+" : ""}${number(summary.latestWowChange)} covers`}
          detail="Week-over-week change from the most recent entry."
          tone="olive"
        />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <div>
              <CardDescription>Weekly Metrics</CardDescription>
              <CardTitle className="mt-3">{editingId ? "Edit week" : "Add new week"}</CardTitle>
            </div>
          </CardHeader>
          <div className="grid gap-4">
            <div>
              <Label>Week Label</Label>
              <Input value={draft.weekLabel} onChange={(event) => setDraft((current) => ({ ...current, weekLabel: event.target.value }))} placeholder="Mar 2" />
              {errors.weekLabel ? <p className="mt-2 text-xs text-primary">{errors.weekLabel}</p> : null}
            </div>
            <div>
              <Label>Covers</Label>
              <Input value={draft.covers || ""} type="number" onChange={(event) => setDraft((current) => ({ ...current, covers: Number(event.target.value) }))} placeholder="99" />
              {errors.covers ? <p className="mt-2 text-xs text-primary">{errors.covers}</p> : null}
            </div>
            <div>
              <Label>Net Sales</Label>
              <Input
                value={draft.netSales || ""}
                type="number"
                step="0.01"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, netSales: Number(event.target.value) }))
                }
                placeholder="4850.25"
              />
            </div>
            <div>
              <Label>Total Orders / Tables</Label>
              <Input
                value={draft.totalOrders || ""}
                type="number"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, totalOrders: Number(event.target.value) }))
                }
                placeholder="42"
              />
            </div>
            <div>
              <Label>Campaign Attribution</Label>
              <Input
                value={draft.campaignAttribution}
                onChange={(event) => setDraft((current) => ({ ...current, campaignAttribution: event.target.value }))}
                placeholder="Slow-night wine pairing"
              />
            </div>
            <div>
              <Label>Campaign Link</Label>
              <select
                className="flex h-11 w-full rounded-xl border border-border bg-card/70 px-4 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                value={draft.campaignId ?? "none"}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    campaignId: event.target.value === "none" ? undefined : event.target.value
                  }))
                }
              >
                <option value="none">No linked campaign</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional context for the week." />
            </div>
            <div className="flex gap-3">
              <Button onClick={saveMetric}>{editingId ? "Update Week" : "Save Week"}</Button>
              <Button onClick={resetDraft} variant="outline">
                Reset
              </Button>
            </div>
            {errors.form ? <p className="text-xs text-primary">{errors.form}</p> : null}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardDescription>Week-by-Week Record</CardDescription>
              <CardTitle className="mt-3">Weekly record</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            {summary.performance.length ? (
              summary.performance.map((metric) => (
                <ListCard key={metric.id}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-medium text-foreground">{metric.weekLabel}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {number(metric.covers)} covers, {currency(metric.revenue)} revenue
                      </p>
                      {typeof metric.totalOrders === "number" ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {number(metric.totalOrders)} orders / tables captured by Toast
                        </p>
                      ) : null}
                      <p className="mt-2 text-sm text-primary">
                        {metric.wowChange >= 0 ? "+" : ""}
                        {number(metric.wowChange)} covers vs prior week
                      </p>
                      {metric.campaignAttribution ? (
                        <p className="mt-2 text-sm text-muted-foreground">Campaign: {metric.campaignAttribution}</p>
                      ) : null}
                      {metric.campaignId ? (
                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-primary">Linked campaign: {metric.campaignId}</p>
                      ) : null}
                      {metric.notes ? <p className="mt-2 text-sm text-muted-foreground">{metric.notes}</p> : null}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(metric)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => removeMetric(metric.id)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </ListCard>
              ))
            ) : (
              <EmptyState
                title="No weekly data yet"
                description="Add a week of covers to start measuring how campaigns influence dining demand."
              />
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardDescription>Covers Chart</CardDescription>
              <CardTitle className="mt-3">Weekly covers</CardTitle>
            </div>
          </CardHeader>
          <ChartShell>
            <LineChart data={summary.performance}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="weekLabel" stroke="#b9b2a0" tickLine={false} axisLine={false} />
              <YAxis stroke="#b9b2a0" tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line dataKey="covers" stroke="#d4b26a" strokeWidth={3} dot={{ r: 4, fill: "#d4b26a" }} />
              {summary.performance.length > 6 ? (
                <Brush
                  dataKey="weekLabel"
                  height={26}
                  stroke="#b89a5a"
                  travellerWidth={8}
                  fill="rgba(255,255,255,0.03)"
                />
              ) : null}
            </LineChart>
          </ChartShell>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardDescription>Revenue Chart</CardDescription>
              <CardTitle className="mt-3">Weekly revenue</CardTitle>
            </div>
          </CardHeader>
          <ChartShell>
            <LineChart data={summary.performance}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="weekLabel" stroke="#b9b2a0" tickLine={false} axisLine={false} />
              <YAxis stroke="#b9b2a0" tickFormatter={(value) => `$${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} />
              <Tooltip
                content={<ChartTooltip />}
                formatter={(value: number) => currency(value)}
              />
              <Line dataKey="revenue" stroke="#7f8a57" strokeWidth={3} dot={{ r: 4, fill: "#7f8a57" }} />
              {summary.performance.length > 6 ? (
                <Brush
                  dataKey="weekLabel"
                  height={26}
                  stroke="#7f8a57"
                  travellerWidth={8}
                  fill="rgba(255,255,255,0.03)"
                />
              ) : null}
            </LineChart>
          </ChartShell>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardDescription>Monthly Timeline</CardDescription>
            <CardTitle className="mt-3">Monthly covers and average tables</CardTitle>
          </div>
          {latestToastMonthlySnapshot ? (
            <div className="mt-4 rounded-2xl border border-border/60 bg-card/65 px-4 py-3 text-sm">
              <p className="text-muted-foreground">
                {latestToastMonthlySnapshot.monthLabel} snapshot from the Toast sales summary
              </p>
              <p className="mt-2 font-medium text-foreground">
                {number(latestToastMonthlySnapshot.covers)} covers · {number(latestToastMonthlySnapshot.orders)} orders / tables · {currency(latestToastMonthlySnapshot.revenue)} net sales
              </p>
            </div>
          ) : null}
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => setShowFullMonthlyTimeline((current) => !current)}
              size="sm"
              variant="outline"
            >
              {showFullMonthlyTimeline ? "Show recent 6 months" : "Show full 8 months"}
            </Button>
          </div>
        </CardHeader>
        <ChartShell heightClassName="h-80">
          <LineChart data={monthlyPerformance}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="monthLabel" stroke="#b9b2a0" tickLine={false} axisLine={false} />
            <YAxis stroke="#b9b2a0" tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Line dataKey="covers" name="monthly covers" stroke="#b89a5a" strokeWidth={3} dot={{ r: 4, fill: "#b89a5a" }} />
            <Line
              dataKey="averageTables"
              name="average tables"
              stroke="#7f8a57"
              strokeWidth={3}
              dot={{ r: 4, fill: "#7f8a57" }}
            />
            {monthlyPerformance.length > 6 ? (
              <Brush
                dataKey="monthLabel"
                height={26}
                stroke="#b89a5a"
                travellerWidth={8}
                fill="rgba(255,255,255,0.03)"
              />
            ) : null}
          </LineChart>
        </ChartShell>
        {monthlyPerformance.length <= 1 ? (
          <div className="px-6 pb-6 text-sm text-muted-foreground">
            The monthly view is currently showing spreadsheet-backed months only.
          </div>
        ) : null}
      </Card>
    </div>
  );
}
