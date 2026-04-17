"use client";

import { memo } from "react";
import type { Route } from "next";
import Link from "next/link";
import { Circle, MessageSquare } from "lucide-react";

import { DatePill } from "@/components/ui/date-pill";
import type { OperatorQueueItem } from "@/lib/domain/operator-queue";
import { cn } from "@/lib/utils";

type QueueAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  emphasis?: "default" | "subtle";
};

type OperatorQueueCardProps = {
  item: OperatorQueueItem;
  theme: "dark" | "light";
  eyebrow: string;
  primaryAction?: QueueAction | null;
  secondaryAction?: QueueAction | null;
  className?: string;
  compact?: boolean;
  statusBadge?: string;
};

function OperatorQueueCardComponent({
  item,
  theme,
  eyebrow,
  primaryAction,
  secondaryAction,
  className,
  compact = false,
  statusBadge,
}: OperatorQueueCardProps) {
  const dark = theme === "dark";

  return (
    <div
      className={cn(
        dark
          ? "rounded-[1.2rem] border border-white/10 bg-white/[0.035] px-4 py-3"
          : "rounded-3xl border border-border/70 bg-card/60 p-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Link
          className="flex min-w-0 flex-1 items-start gap-3"
          href={item.href as Route}
        >
          <span
            className={cn(
              "mt-0.5 flex shrink-0 items-center justify-center rounded-full border",
              compact ? "h-6 w-6 text-xs" : "h-8 w-8 text-sm",
              dark
                ? item.tone === "review"
                  ? "border-[var(--app-accent-bg)] text-[var(--app-accent-bg)]"
                  : "border-white/25 text-white/60"
                : item.tone === "review"
                  ? "border-[var(--app-accent-bg)] text-[var(--app-accent-bg)]"
                  : "border-border text-muted-foreground"
            )}
          >
            {item.tone === "review" ? <MessageSquare className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-xs uppercase tracking-[0.16em]",
                dark ? "text-white/38" : "text-muted-foreground"
              )}
            >
              {eyebrow}
            </p>
            <p
              className={cn(
                "mt-1 truncate font-semibold",
                compact ? "text-base" : "text-lg",
                dark ? "text-white" : "text-foreground"
              )}
            >
              {item.title}
            </p>
            <p
              className={cn(
                "mt-2 line-clamp-2 text-sm",
                dark ? "text-white/55" : "text-muted-foreground"
              )}
            >
              {item.detail}
            </p>
            <div
              className={cn(
                "mt-3 flex flex-wrap gap-2 text-xs",
                dark ? "text-white/48" : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "rounded-full px-2.5 py-1",
                  dark ? "bg-white/[0.06]" : "bg-accent"
                )}
              >
                {item.status}
              </span>
              {item.dateKey ? (
                <DatePill
                  className={dark ? "border-white/12 bg-white/[0.06] text-white/58" : undefined}
                  value={item.dateKey}
                />
              ) : null}
              {item.campaignName ? (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1",
                    dark ? "bg-white/[0.06]" : "bg-accent"
                  )}
                >
                  {item.campaignName}
                </span>
              ) : null}
            </div>
          </div>
        </Link>
        {statusBadge ? (
          <span
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-xs font-medium",
              dark
                ? "bg-white/[0.08] text-white/72"
                : "bg-[var(--app-accent-soft)] text-[var(--app-accent-bg)]"
            )}
          >
            {statusBadge}
          </span>
        ) : null}
      </div>
      {primaryAction || secondaryAction ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            className={cn(
              "text-sm font-medium",
              dark ? "text-white/70" : "text-primary"
            )}
            href={item.href as Route}
          >
            Open
          </Link>
          {primaryAction ? (
            <button
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:pointer-events-none disabled:opacity-50",
                dark
                  ? "bg-white text-[#202024]"
                  : "bg-primary text-primary-foreground"
              )}
              disabled={primaryAction.disabled}
              type="button"
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </button>
          ) : null}
          {secondaryAction ? (
            <button
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:pointer-events-none disabled:opacity-50",
                secondaryAction.emphasis === "default"
                  ? dark
                    ? "border-white/22 bg-white/10 text-white"
                    : "border-primary/40 bg-primary/10 text-foreground"
                  : dark
                    ? "border-white/12 text-white/72"
                    : "border-border text-muted-foreground"
              )}
              disabled={secondaryAction.disabled}
              type="button"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export const OperatorQueueCard = memo(OperatorQueueCardComponent, (prevProps, nextProps) =>
  prevProps.item.id === nextProps.item.id &&
  prevProps.item.status === nextProps.item.status &&
  prevProps.item.title === nextProps.item.title &&
  prevProps.item.detail === nextProps.item.detail &&
  prevProps.item.dateKey === nextProps.item.dateKey &&
  prevProps.item.campaignName === nextProps.item.campaignName &&
  prevProps.item.tone === nextProps.item.tone &&
  prevProps.theme === nextProps.theme &&
  prevProps.eyebrow === nextProps.eyebrow &&
  prevProps.className === nextProps.className &&
  prevProps.compact === nextProps.compact &&
  prevProps.statusBadge === nextProps.statusBadge &&
  prevProps.primaryAction?.label === nextProps.primaryAction?.label &&
  prevProps.primaryAction?.disabled === nextProps.primaryAction?.disabled &&
  prevProps.primaryAction?.emphasis === nextProps.primaryAction?.emphasis &&
  prevProps.secondaryAction?.label === nextProps.secondaryAction?.label &&
  prevProps.secondaryAction?.disabled === nextProps.secondaryAction?.disabled &&
  prevProps.secondaryAction?.emphasis === nextProps.secondaryAction?.emphasis
);
