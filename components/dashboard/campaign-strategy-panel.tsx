import { ChevronDown, Target } from "lucide-react";

import { ListCard } from "@/components/dashboard/list-card";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CampaignStrategyResult } from "@/lib/agents/campaign-strategy";
import { cn } from "@/lib/utils";

export function CampaignStrategyPanel({
  title,
  description,
  strategy,
  error,
  loading,
  className
}: {
  title: string;
  description: string;
  strategy: CampaignStrategyResult | null;
  error?: string | null;
  loading?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden border-primary/15 bg-card/95", className)}>
      <CardHeader className="border-b border-border/70 px-5 py-5 sm:px-6">
        <div className="max-w-3xl">
          <CardDescription>{title}</CardDescription>
          <CardTitle className="mt-3 text-2xl tracking-[-0.04em]">
            {description}
          </CardTitle>
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
            Generating a single campaign recommendation from the current performance context.
          </div>
        ) : null}

        {strategy ? (
          <>
            <div className="rounded-[1.35rem] border border-border/70 bg-background/75 p-4 sm:p-5">
              <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                Opportunity
              </p>
              <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground sm:text-[1.8rem]">
                {strategy.opportunity}
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                    Campaign
                  </p>
                  <p className="mt-1 text-lg font-medium text-foreground">{strategy.campaign.name}</p>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {strategy.campaign.description}
                  </p>
                </div>
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-xs font-medium text-primary">
                  <Target className="h-3.5 w-3.5" />
                  Opportunity-driven test
                </span>
              </div>
              <div className="mt-5 rounded-[1rem] border border-border/70 bg-card/75 p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                  Objective
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">{strategy.objective}</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ListCard>
                <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">Why it matters</p>
                <p className="mt-2 text-sm leading-6 text-foreground">{strategy.whyItMatters}</p>
              </ListCard>
              <ListCard>
                <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">Expected impact</p>
                <p className="mt-2 text-sm leading-6 text-foreground">{strategy.expectedImpact}</p>
              </ListCard>
            </div>

            <details className="rounded-[1rem] border border-border/70 bg-background/55 p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground">
                First steps
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </summary>
              <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                {strategy.firstSteps.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </details>

            <details className="rounded-[1rem] border border-border/70 bg-background/55 p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground">
                Success signals
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </summary>
              <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                {strategy.successSignals.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </details>

            <div className="rounded-[1rem] border border-dashed border-border/70 bg-background/55 p-4 text-xs leading-5 text-muted-foreground">
              This is a directional strategy test, not a guaranteed revenue promise.
            </div>
          </>
        ) : (
          <div className="rounded-[1rem] border border-dashed border-border/70 bg-background/55 p-5 text-sm leading-6 text-muted-foreground">
            {loading
              ? "Thinking through the highest-leverage campaign opportunity..."
              : "Generate a campaign strategy to see the single best next campaign recommendation."}
          </div>
        )}
      </div>
    </Card>
  );
}
