"use client";

import { ResponsiveContainer } from "recharts";

import { cn } from "@/lib/utils";

export function ChartShell({
  children,
  heightClassName = "h-72"
}: {
  children: React.ReactElement;
  heightClassName?: string;
}) {
  return (
    <div className="relative mt-2 rounded-[1.5rem] border border-[rgba(146,124,73,0.12)] bg-[linear-gradient(180deg,rgba(251,248,242,0.98),rgba(244,237,227,0.94))] p-4 shadow-[0_14px_28px_rgba(124,97,48,0.06)]">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(189,156,87,0.28)] to-transparent" />
      <div className={cn("w-full", heightClassName)}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
