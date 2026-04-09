"use client";

import { useEffect, useMemo, useState, type FocusEvent } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartShell } from "@/components/charts/chart-shell";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatGrid } from "@/components/dashboard/stat-grid";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActiveClient } from "@/lib/client-context";
import { buildGrowthScenarios, calculateRevenueModel } from "@/lib/calculations";
import { useClientSettings } from "@/lib/repositories/use-client-settings";
import { currency, number } from "@/lib/utils";
import { RevenueModelInput } from "@/types";

type NumericField = Exclude<keyof RevenueModelInput, "mode">;

export default function RevenueModelingPage() {
  const { activeClient } = useActiveClient();
  const { revenueModelDefaults, ready } = useClientSettings(activeClient.id);
  const [form, setForm] = useState<RevenueModelInput>(revenueModelDefaults);

  useEffect(() => {
    setForm(revenueModelDefaults);
  }, [revenueModelDefaults]);

  const model = useMemo(() => calculateRevenueModel(form), [form]);
  const scenarios = useMemo(() => buildGrowthScenarios(form), [form]);
  const weekdaySchedule = useMemo(
    () =>
      model.weekdayBreakdown.map((day) => ({
        day: day.day.slice(0, 3),
        currentCovers: Number(day.currentCovers.toFixed(1)),
        projectedCovers: Number(day.projectedCovers.toFixed(1))
      })),
    [model.weekdayBreakdown]
  );
  const showMonthlyInputs = form.mode === "monthly";

  const updateField = (field: NumericField, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value === "" ? 0 : Number(value)
    }));
  };

  const clearZeroOnFocus = (field: NumericField, event: FocusEvent<HTMLInputElement>) => {
    if (form[field] !== 0) {
      return;
    }

    event.target.value = "";
  };

  if (!ready) {
    return <div className="text-sm text-muted-foreground">Loading revenue model...</div>;
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Revenue modeling"
        title="Map the growth goal to the actual week"
        description={`Model ${activeClient.name}'s dining volume, pressure-test growth scenarios, and show how the target affects Monday through Sunday based on the real shape of the business instead of a flat nightly average.`}
      />
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardDescription>Revenue Inputs</CardDescription>
              <CardTitle className="mt-3">Set the business assumptions</CardTitle>
            </div>
          </CardHeader>
          <div className="grid gap-5">
            <div>
              <Label>Volume Mode</Label>
              <div className="flex gap-3">
                <Button
                  variant={form.mode === "monthly" ? "default" : "outline"}
                  onClick={() => setForm((current) => ({ ...current, mode: "monthly" }))}
                >
                  Monthly Covers
                </Button>
                <Button
                  variant={form.mode === "weekly" ? "default" : "outline"}
                  onClick={() => setForm((current) => ({ ...current, mode: "weekly" }))}
                >
                  Weekly Covers
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["averageCheck", "Average Check"],
                ...(showMonthlyInputs
                  ? ([["monthlyCovers", "Monthly Covers"]] as const)
                  : ([["weeklyCovers", "Weekly Covers"]] as const)),
                ["guestsPerTable", "Guests / Table"]
              ].map(([field, label]) => (
                <div key={field}>
                  <Label>{label}</Label>
                  <Input
                    onFocus={(event) => clearZeroOnFocus(field as NumericField, event)}
                    onChange={(event) => updateField(field as NumericField, event.target.value)}
                    step="0.01"
                    type="number"
                    value={form[field as NumericField]}
                  />
                </div>
              ))}
            </div>

            <div id="growth-target">
              <div className="mb-2 flex items-center justify-between">
                <Label className="mb-0">Growth Target</Label>
                <span className="text-sm text-primary">{form.growthTarget}%</span>
              </div>
              <input
                className="w-full accent-[#b89a5a]"
                max={100}
                min={0}
                onChange={(event) => updateField("growthTarget", event.target.value)}
                type="range"
                value={form.growthTarget}
              />
            </div>
          </div>
        </Card>

        <StatGrid className="xl:grid-cols-2" id="model-outputs">
          <MetricCard
            label={showMonthlyInputs ? "Monthly Covers" : "Weekly Covers"}
            value={number(showMonthlyInputs ? model.monthlyCovers : model.weeklyCovers)}
            detail="Normalized from the volume mode you selected."
          />
          <MetricCard
            label={showMonthlyInputs ? "Revenue This Month" : "Revenue This Week"}
            value={currency(showMonthlyInputs ? model.monthlyRevenue : model.weeklyRevenue)}
            detail="Revenue implied by current covers and average check."
          />
          <MetricCard
            label={showMonthlyInputs ? "Revenue Added At Target" : "Weekly Revenue Added At Target"}
            value={currency(showMonthlyInputs ? model.addedMonthlyRevenue : model.addedWeeklyRevenue)}
            detail="Expected lift if the current growth target lands."
          />
          <MetricCard label="Annual Upside" value={currency(model.annualUpside)} detail="Twelve-month upside if the lift sustains." />
          <MetricCard
            label={`Peak Service Night: ${model.busiestDay.day}`}
            value={number(model.busiestDay.projectedCovers, 1)}
            detail={`${number(model.busiestDay.addedCovers, 1)} added covers on the heaviest night at this target.`}
          />
          <MetricCard
            label={`Slowest Service Night: ${model.slowestDay.day}`}
            value={number(model.slowestDay.projectedCovers, 1)}
            detail={`${number(model.slowestDay.projectedTables, 1)} projected tables on the lightest service.`}
            tone="olive"
          />
        </StatGrid>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <div>
              <CardDescription>Scenario Comparison</CardDescription>
              <CardTitle className="mt-3">Revenue impact across growth targets</CardTitle>
            </div>
          </CardHeader>
          <ChartShell>
            <BarChart data={scenarios}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="growth" stroke="#b9b2a0" tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} />
              <YAxis stroke="#b9b2a0" tickFormatter={(value) => `$${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} />
              <Bar dataKey="revenue" fill="#b89a5a" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ChartShell>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardDescription>Calculated Outputs</CardDescription>
              <CardTitle className="mt-3">Model outputs</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-4 text-sm">
            {[
              ...(showMonthlyInputs
                ? [
                    ["Monthly Revenue", currency(model.monthlyRevenue)],
                    ["Added Covers / Month", number(model.addedMonthlyCovers)],
                    ["Added Revenue / Month", currency(model.addedMonthlyRevenue)]
                  ]
                : [
                    ["Weekly Revenue", currency(model.weeklyRevenue)],
                    ["Added Covers / Week", number(model.addedWeeklyCovers)],
                    ["Added Revenue / Week", currency(model.addedWeeklyRevenue)]
                  ]),
              ["Daily Revenue", currency(model.dailyRevenue)]
            ].map(([label, value]) => (
              <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/65 px-4 py-3" key={label}>
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div>
              <CardDescription>Weekly Shape</CardDescription>
              <CardTitle className="mt-3">Current week vs target week by day</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Built from Meama&apos;s Toast daily mix from October 2025 through March 2026, so the weekly target lands where the business actually performs instead of using the old reservation-only baseline.
            </p>
          </CardHeader>
          <ChartShell>
            <BarChart data={weekdaySchedule}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="day" stroke="#b9b2a0" tickLine={false} axisLine={false} />
              <YAxis stroke="#b9b2a0" tickLine={false} axisLine={false} />
              <Bar dataKey="currentCovers" fill="#6f6657" radius={[10, 10, 0, 0]} />
              <Bar dataKey="projectedCovers" fill="#b89a5a" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ChartShell>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardDescription>Day-by-Day Impact</CardDescription>
              <CardTitle className="mt-3">How the target changes each service</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3 text-sm">
            {model.weekdayBreakdown.map((day) => (
              <div
                className="grid grid-cols-[84px_1fr_auto] items-center gap-4 rounded-2xl border border-border/60 bg-card/65 px-4 py-3"
                key={day.day}
              >
                <div>
                  <p className="font-medium text-foreground">{day.day}</p>
                  <p className="text-xs text-muted-foreground">{number(day.shareOfWeek * 100, 1)}% of week</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {number(day.currentCovers, 1)} now {"->"} {number(day.projectedCovers, 1)} at target
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {number(day.currentTables, 1)} {"->"} {number(day.projectedTables, 1)} tables
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-foreground">+{number(day.addedCovers, 1)}</p>
                  <p className="text-xs text-muted-foreground">{currency(day.projectedRevenue)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
