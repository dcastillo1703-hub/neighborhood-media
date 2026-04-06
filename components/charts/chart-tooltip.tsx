"use client";

import type { ReactNode } from "react";
import type { TooltipProps } from "recharts";

type TooltipRow = {
  label: string;
  value: string;
  color?: string;
};

export function ChartTooltip({
  active,
  label,
  payload,
  formatter
}: TooltipProps<number, string> & {
  formatter?: (value: number, name: string) => string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const rows: TooltipRow[] = payload
    .filter((entry) => typeof entry.value === "number")
    .map((entry) => ({
      label: entry.name ?? "Value",
      value: formatter
        ? formatter(Number(entry.value), entry.name ?? "value")
        : Number(entry.value).toLocaleString(undefined, {
            maximumFractionDigits: 1
          }),
      color: entry.color
    }));

  return (
    <div className="min-w-[180px] rounded-2xl border border-[rgba(146,124,73,0.14)] bg-[rgba(253,250,245,0.98)] px-4 py-3 shadow-[0_18px_40px_rgba(124,97,48,0.12)] backdrop-blur">
      <p className="text-xs uppercase tracking-[0.16em] text-primary">{String(label)}</p>
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div className="flex items-center justify-between gap-4 text-sm" key={`${row.label}-${row.value}`}>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: row.color ?? "#b89a5a" }}
              />
              <span className="capitalize">{row.label}</span>
            </div>
            <span className="font-medium text-foreground">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartHeaderAction({
  children
}: {
  children: ReactNode;
}) {
  return <div className="mt-4 flex justify-end">{children}</div>;
}
