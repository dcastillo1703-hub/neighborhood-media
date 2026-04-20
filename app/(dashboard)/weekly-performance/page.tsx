"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
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
import { compareImportedMetrics, parseToastPerformanceFile } from "@/lib/imports/toast-performance";
import { useCampaigns } from "@/lib/repositories/use-campaigns";
import { useClientSettings } from "@/lib/repositories/use-client-settings";
import { useToastPerformanceImports } from "@/lib/repositories/use-toast-performance-imports";
import { useWeeklyMetrics } from "@/lib/repositories/use-weekly-metrics";
import { currency, number } from "@/lib/utils";
import { validateWeeklyMetric } from "@/lib/validation";
import { ToastPerformanceImport, WeeklyMetric } from "@/types";

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
  const {
    metrics,
    saveMetric: persistMetric,
    deleteMetric,
    replaceMetrics,
    ready,
    error
  } = useWeeklyMetrics(activeClient.id);
  const { imports, upsertImport, approveImport } = useToastPerformanceImports(activeClient.id);
  const [draft, setDraft] = useState<WeeklyMetric>(createEmptyMetric(activeClient.id));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showFullMonthlyTimeline, setShowFullMonthlyTimeline] = useState(false);
  const [reviewImportId, setReviewImportId] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [applyingImportId, setApplyingImportId] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
  const reviewedImport = useMemo(
    () => imports.find((item) => item.id === reviewImportId) ?? null,
    [imports, reviewImportId]
  );
  const approvedImports = useMemo(
    () => imports.filter((item) => item.status === "approved"),
    [imports]
  );
  const reviewChanges = useMemo(
    () =>
      reviewedImport
        ? compareImportedMetrics(metrics, reviewedImport.parsedSnapshot.metrics)
        : { addedMetrics: [], updatedMetrics: [], removedMetrics: [] },
    [metrics, reviewedImport]
  );

  const resetDraft = () => {
    setDraft(createEmptyMetric(activeClient.id));
    setEditingId(null);
    setErrors({});
  };

  const applyImport = async (importRecord: ToastPerformanceImport) => {
    if (!importRecord.parsedSnapshot.metrics.length) {
      setImportNotice("This import does not contain any valid rows yet.");
      return;
    }

    const currentByWeekLabel = new Map(metrics.map((metric) => [metric.weekLabel, metric]));
    const nextMetrics: WeeklyMetric[] = importRecord.parsedSnapshot.metrics.map((metric, index) => {
      const existing = currentByWeekLabel.get(metric.weekLabel);

      return {
        id: existing?.id ?? `wm-${Date.now()}-${index}`,
        clientId: activeClient.id,
        weekLabel: metric.weekLabel,
        covers: metric.covers,
        netSales: metric.netSales,
        totalOrders: metric.totalOrders,
        notes: metric.notes,
        campaignAttribution: metric.campaignAttribution,
        campaignId: metric.campaignId,
        createdAt: existing?.createdAt ?? new Date().toISOString()
      };
    });

    setApplyingImportId(importRecord.id);
    setImportNotice(null);

    try {
      const payload = await replaceMetrics(nextMetrics, importRecord.fileName);
      approveImport(importRecord.id, payload.metrics.map((metric) => metric.id));
      setImportNotice(
        `${payload.metrics.length} Toast row${payload.metrics.length === 1 ? "" : "s"} are now active across performance, campaigns, and reporting.`
      );
      setReviewImportId(importRecord.id);
    } catch (importError) {
      setImportNotice(
        importError instanceof Error ? importError.message : "The upload could not be applied."
      );
    } finally {
      setApplyingImportId(null);
    }
  };

  const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploadingFile(true);
    setImportNotice(null);

    try {
      const nextImport = await parseToastPerformanceFile(file, activeClient.id, metrics);
      upsertImport(nextImport);
      setReviewImportId(nextImport.id);
    } catch (uploadError) {
      setImportNotice(
        uploadError instanceof Error ? uploadError.message : "The file could not be parsed."
      );
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
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
        description="Upload Toast snapshots, review what changed, and update the active performance record without touching backend values manually."
      />

      <div className="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
        <Card>
          <CardHeader>
            <div>
              <CardDescription>Toast import</CardDescription>
              <CardTitle className="mt-3">Upload a performance snapshot</CardTitle>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Upload CSV or XLSX for the cleanest result. PDF is supported as a lower-confidence backup and always needs closer review.
              </p>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <div className="rounded-[1.1rem] border border-border/70 bg-card/55 p-4">
              <p className="text-sm font-medium text-foreground">How this works</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                {[
                  "1. Upload",
                  "2. Review changes",
                  "3. Confirm import",
                  "4. Update live metrics"
                ].map((step) => (
                  <div className="rounded-[1rem] border border-border/70 bg-background/60 px-3 py-3 text-sm text-muted-foreground" key={step}>
                    {step}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <input
                ref={fileInputRef}
                accept=".csv,.xlsx,.xls,.pdf"
                className="hidden"
                id="toast-file-upload"
                type="file"
                onChange={(event) => void handleFileSelection(event)}
              />
              <Button disabled={uploadingFile} onClick={() => fileInputRef.current?.click()} type="button">
                {uploadingFile ? "Parsing upload..." : "Upload Toast snapshot"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setReviewImportId(approvedImports[0]?.id ?? null)}
                type="button"
                disabled={!approvedImports.length}
              >
                Review latest approved snapshot
              </Button>
            </div>

            {importNotice ? (
              <div className="rounded-[1rem] border border-border/70 bg-card/55 p-4 text-sm text-muted-foreground">
                {importNotice}
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardDescription>Review</CardDescription>
              <CardTitle className="mt-3">Review before applying</CardTitle>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Nothing changes live until this review is approved. The card below shows the detected period, parsed values, and what would change in the active snapshot.
              </p>
            </div>
          </CardHeader>
          {reviewedImport ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ListCard>
                  <p className="text-sm text-muted-foreground">File</p>
                  <p className="mt-2 text-lg text-foreground">{reviewedImport.fileName}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{reviewedImport.fileType.toUpperCase()}</p>
                </ListCard>
                <ListCard>
                  <p className="text-sm text-muted-foreground">Reporting period</p>
                  <p className="mt-2 text-lg text-foreground">{reviewedImport.reportingPeriodLabel}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{number(reviewedImport.rawSnapshot.rowCount)} rows detected</p>
                </ListCard>
                <ListCard>
                  <p className="text-sm text-muted-foreground">Import confidence</p>
                  <p className="mt-2 text-lg text-foreground">{reviewedImport.review.confidence}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {reviewedImport.review.warnings.length ? reviewedImport.review.warnings[0] : "Structured file with review-ready field detection."}
                  </p>
                </ListCard>
                <ListCard>
                  <p className="text-sm text-muted-foreground">Change summary</p>
                  <p className="mt-2 text-lg text-foreground">
                    +{number(reviewedImport.review.addedCount)} / ~{number(reviewedImport.review.updatedCount)} / -{number(reviewedImport.review.removedCount)}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">Added / updated / removed week rows.</p>
                </ListCard>
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-3">
                  <ListCard>
                    <p className="font-medium text-foreground">Parsed metrics</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Covers</p>
                        <p className="mt-2 text-lg text-foreground">{number(reviewedImport.parsedSnapshot.totals.covers)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Net sales</p>
                        <p className="mt-2 text-lg text-foreground">{currency(reviewedImport.parsedSnapshot.totals.netSales)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Orders / tables</p>
                        <p className="mt-2 text-lg text-foreground">{number(reviewedImport.parsedSnapshot.totals.totalOrders)}</p>
                      </div>
                    </div>
                  </ListCard>
                  <ListCard>
                    <p className="font-medium text-foreground">Warnings and missing fields</p>
                    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                      {reviewedImport.review.warnings.length ? reviewedImport.review.warnings.map((warning) => (
                        <p key={warning}>{warning}</p>
                      )) : <p>No parsing warnings.</p>}
                      {reviewedImport.review.missingFields.length ? (
                        <p>Missing fields: {reviewedImport.review.missingFields.join(", ")}.</p>
                      ) : null}
                    </div>
                  </ListCard>
                  {reviewedImport.rawSnapshot.textPreview ? (
                    <ListCard>
                      <p className="font-medium text-foreground">PDF text preview</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{reviewedImport.rawSnapshot.textPreview}</p>
                    </ListCard>
                  ) : null}
                </div>

                <ListCard>
                  <p className="font-medium text-foreground">What changes vs the active snapshot</p>
                  <div className="mt-4 space-y-4">
                    {reviewChanges.updatedMetrics.slice(0, 6).map((metric) => {
                      const previous = metrics.find((entry) => entry.weekLabel === metric.weekLabel);
                      return (
                        <div className="border-b border-border/60 pb-3 last:border-b-0 last:pb-0" key={metric.weekLabel}>
                          <p className="font-medium text-foreground">{metric.weekLabel}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Covers {number(previous?.covers ?? 0)} {"->"} {number(metric.covers)}
                            {metric.netSales !== undefined || previous?.netSales !== undefined
                              ? ` · Sales ${currency(previous?.netSales ?? 0)} -> ${currency(metric.netSales ?? 0)}`
                              : ""}
                          </p>
                        </div>
                      );
                    })}
                    {reviewChanges.addedMetrics.slice(0, 4).map((metric) => (
                      <div className="border-b border-border/60 pb-3 last:border-b-0 last:pb-0" key={`add-${metric.weekLabel}`}>
                        <p className="font-medium text-foreground">{metric.weekLabel}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          New row: {number(metric.covers)} covers{metric.netSales !== undefined ? ` · ${currency(metric.netSales)}` : ""}
                        </p>
                      </div>
                    ))}
                    {reviewChanges.removedMetrics.slice(0, 4).map((metric) => (
                      <div className="border-b border-border/60 pb-3 last:border-b-0 last:pb-0" key={`remove-${metric.id}`}>
                        <p className="font-medium text-foreground">{metric.weekLabel}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          This active row would be removed by the new snapshot.
                        </p>
                      </div>
                    ))}
                    {!reviewChanges.updatedMetrics.length && !reviewChanges.addedMetrics.length && !reviewChanges.removedMetrics.length ? (
                      <p className="text-sm text-muted-foreground">No differences detected against the active snapshot.</p>
                    ) : null}
                  </div>
                </ListCard>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={applyingImportId === reviewedImport.id || !reviewedImport.parsedSnapshot.metrics.length}
                  onClick={() => void applyImport(reviewedImport)}
                  type="button"
                >
                  {applyingImportId === reviewedImport.id ? "Applying snapshot..." : "Approve and apply snapshot"}
                </Button>
                <Button variant="outline" onClick={() => setReviewImportId(null)} type="button">
                  Close review
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No staged upload yet"
              description="Upload a Toast snapshot to review the parsed metrics before anything changes live."
            />
          )}
        </Card>
      </div>
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

      {approvedImports.length ? (
        <Card>
          <CardHeader>
            <div>
              <CardDescription>Approved snapshot history</CardDescription>
              <CardTitle className="mt-3">Reapply a prior approved import if needed</CardTitle>
            </div>
          </CardHeader>
          <div className="grid gap-3 lg:grid-cols-3">
            {approvedImports.slice(0, 6).map((item) => (
              <ListCard key={item.id}>
                <p className="font-medium text-foreground">{item.fileName}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.reportingPeriodLabel} · approved {item.approvedAt ? new Date(item.approvedAt).toLocaleDateString("en-US") : "just now"}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {number(item.parsedSnapshot.metrics.length)} rows · {currency(item.parsedSnapshot.totals.netSales)} net sales
                </p>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setReviewImportId(item.id)} type="button">
                    Review
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void applyImport(item)}
                    type="button"
                    disabled={applyingImportId === item.id}
                  >
                    {applyingImportId === item.id ? "Applying..." : "Apply again"}
                  </Button>
                </div>
              </ListCard>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <div>
              <CardDescription>Manual correction</CardDescription>
              <CardTitle className="mt-3">{editingId ? "Edit week" : "Add or correct one week"}</CardTitle>
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
