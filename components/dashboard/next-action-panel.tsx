"use client";

import { memo } from "react";
import type { Route } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type NextActionPanelProps = {
  tone: "light" | "dark";
  label: string;
  title: string;
  detail: string;
  reason: string;
  impact: string;
  timeContext: string;
  actionLabel: string;
  onAction?: () => void;
  actionHref?: Route;
  statusLabel?: string;
  statusToneClassName?: string;
  feedback?: {
    label: string;
    detail: string;
  } | null;
};

function NextActionPanelComponent({
  tone,
  label,
  title,
  detail,
  reason,
  impact,
  timeContext,
  actionLabel,
  onAction,
  actionHref,
  statusLabel,
  statusToneClassName,
  feedback
}: NextActionPanelProps) {
  const dark = tone === "dark";

  return (
    <Card className={dark ? "border-white/10 bg-[#1b1c1f] p-4 text-white" : "p-0"}>
      {dark ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-white/45">{label}</p>
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/58">
              {timeContext}
            </span>
          </div>
          <p className="mt-1 text-lg font-semibold text-white">{title}</p>
          <p className="mt-2 text-sm leading-6 text-white/58">{detail}</p>
          <div className="mt-4 grid gap-3 rounded-[1rem] border border-white/10 bg-white/[0.03] p-3">
            <div>
              <p className="text-[0.68rem] uppercase tracking-[0.16em] text-white/40">Why now</p>
              <p className="mt-1 text-sm leading-5 text-white/72">{reason}</p>
            </div>
            <div>
              <p className="text-[0.68rem] uppercase tracking-[0.16em] text-white/40">What it unlocks</p>
              <p className="mt-1 text-sm leading-5 text-white/72">{impact}</p>
            </div>
          </div>
          {onAction ? (
            <button
              className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#202124] active:scale-[0.99]"
              type="button"
              onClick={onAction}
            >
              {actionLabel}
            </button>
          ) : actionHref ? (
            <Link
              className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#202124] active:scale-[0.99]"
              href={actionHref}
            >
              {actionLabel}
            </Link>
          ) : null}
          {feedback ? (
            <div className="mt-3 rounded-[1.1rem] border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="text-sm font-medium text-white/82">{feedback.label}</p>
              <p className="mt-1 text-sm text-white/58">{feedback.detail}</p>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="border-b border-border/70 px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardDescription>{label}</CardDescription>
                <CardTitle className="mt-3">{title}</CardTitle>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {timeContext}
                </span>
                {statusLabel ? (
                  <span className={statusToneClassName}>{statusLabel}</span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="space-y-4 px-4 py-4 sm:px-5">
            <p className="text-sm leading-6 text-muted-foreground">{detail}</p>
            <div className="grid gap-3 rounded-[1rem] border border-border/70 bg-card/55 p-4">
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">Why now</p>
                <p className="mt-1 text-sm leading-6 text-foreground">{reason}</p>
              </div>
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">What it unlocks</p>
                <p className="mt-1 text-sm leading-6 text-foreground">{impact}</p>
              </div>
            </div>
            {onAction ? (
              <Button size="sm" type="button" onClick={onAction}>
                {actionLabel}
              </Button>
            ) : null}
            {feedback ? (
              <div className="rounded-[1rem] border border-border/70 bg-card/55 p-4">
                <p className="text-sm font-medium text-foreground">{feedback.label}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{feedback.detail}</p>
              </div>
            ) : null}
          </div>
        </>
      )}
    </Card>
  );
}

export const NextActionPanel = memo(NextActionPanelComponent);
