import { ChevronDown, ListChecks } from "lucide-react";

import { ListCard } from "@/components/dashboard/list-card";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SchedulingPlanResult } from "@/lib/agents/scheduling";
import { cn } from "@/lib/utils";

export function SchedulingPlanPanel({
  title,
  description,
  plan,
  error,
  loading,
  className
}: {
  title: string;
  description: string;
  plan: SchedulingPlanResult | null;
  error?: string | null;
  loading?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden border-primary/15 bg-card/95", className)}>
      <CardHeader className="border-b border-border/70 px-5 py-5 sm:px-6">
        <div className="max-w-3xl">
          <CardDescription>{title}</CardDescription>
          <CardTitle className="mt-3 text-2xl tracking-[-0.04em]">{description}</CardTitle>
        </div>
      </CardHeader>

      <div className="space-y-4 px-5 py-5 sm:px-6">
        {error ? (
          <div className="rounded-[1rem] border border-rose-500/20 bg-rose-500/10 p-4 text-sm leading-6 text-rose-700 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-[1rem] border border-border/70 bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
            Building a revenue-aware schedule recommendation from the current campaign context.
          </div>
        ) : null}

        {plan ? (
          <>
            <div className="rounded-[1.35rem] border border-border/70 bg-background/75 p-4 sm:p-5">
              <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                Schedule summary
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">{plan.scheduleSummary}</p>

              <div className="mt-4 rounded-[1rem] border border-border/70 bg-card/75 p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                  Scheduling strategy
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">{plan.schedulingStrategy}</p>
              </div>

              <div className="mt-4 rounded-[1rem] border border-border/70 bg-card/75 p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                  Next operator action
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">{plan.nextOperatorAction}</p>
              </div>

              {plan.scheduleGapsFilled.length ? (
                <div className="mt-4 rounded-[1rem] border border-border/70 bg-card/75 p-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                    Schedule gaps filled
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {plan.scheduleGapsFilled.map((gap) => (
                      <span
                        className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs text-foreground"
                        key={gap}
                      >
                        {gap}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              {plan.recommendedPlacements.map((placement, index) => (
                <ListCard key={`${placement.contentTitle}-${index}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                        Placement {index + 1}
                      </p>
                      <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-foreground">
                        {placement.contentTitle}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.16em] text-primary">
                      <ListChecks className="h-3.5 w-3.5" />
                      {placement.confidence} confidence
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1rem] border border-border/70 bg-background/70 p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                        Recommended timing
                      </p>
                      <p className="mt-2 text-sm leading-6 text-foreground">
                        {placement.recommendedDate} · {placement.recommendedTimeWindow}
                      </p>
                    </div>
                    <div className="rounded-[1rem] border border-border/70 bg-background/70 p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                        Business goal
                      </p>
                      <p className="mt-2 text-sm leading-6 text-foreground">{placement.businessGoal}</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3 rounded-[1rem] border border-border/70 bg-background/70 p-4">
                    <div>
                      <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                        Timing reason
                      </p>
                      <p className="mt-1 text-sm leading-6 text-foreground">{placement.timingReason}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                          Platform
                        </p>
                        <p className="mt-1 text-sm leading-6 text-foreground">{placement.platform}</p>
                      </div>
                      <div>
                        <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                          Format
                        </p>
                        <p className="mt-1 text-sm leading-6 text-foreground">{placement.format}</p>
                      </div>
                    </div>

                    <details className="rounded-[0.9rem] border border-border/70 bg-card/80 p-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground">
                        Review before publishing
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </summary>
                      <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                        {placement.reviewBeforePublishing.map((check) => (
                          <p key={check}>{check}</p>
                        ))}
                      </div>
                    </details>
                  </div>
                </ListCard>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ListCard>
                <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                  Risks or warnings
                </p>
                <div className="mt-3 space-y-2 text-sm leading-6 text-foreground">
                  {plan.risksOrWarnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              </ListCard>
              <ListCard>
                <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                  Measurement note
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  Review this as a draft schedule, then convert approved placements into scheduled content.
                </p>
              </ListCard>
            </div>
          </>
        ) : (
          <div className="rounded-[1rem] border border-dashed border-border/70 bg-background/55 p-5 text-sm leading-6 text-muted-foreground">
            {loading
              ? "Building the schedule recommendation..."
              : "Generate a scheduling plan to place approved content in the strongest revenue windows."}
          </div>
        )}
      </div>
    </Card>
  );
}
