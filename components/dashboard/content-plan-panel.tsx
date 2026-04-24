import { ListChecks } from "lucide-react";

import { ListCard } from "@/components/dashboard/list-card";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ContentPlanResult } from "@/lib/agents/content-plan";
import { cn } from "@/lib/utils";

export function ContentPlanPanel({
  title,
  description,
  plan,
  error,
  loading,
  className
}: {
  title: string;
  description: string;
  plan: ContentPlanResult | null;
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
            Building an execution-first content plan from the current campaign context.
          </div>
        ) : null}

        {plan ? (
          <>
            <div className="rounded-[1.35rem] border border-border/70 bg-background/75 p-4 sm:p-5">
              <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                Plan summary
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">{plan.planSummary}</p>
              <div className="mt-4 rounded-[1rem] border border-border/70 bg-card/75 p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                  Campaign objective
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">{plan.campaignObjective}</p>
              </div>
              <div className="mt-4 rounded-[1rem] border border-border/70 bg-card/75 p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                  Execution focus
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">{plan.executionFocus}</p>
              </div>
              <div className="mt-4 rounded-[1rem] border border-border/70 bg-card/75 p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                  Measurement focus
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">{plan.measurementFocus}</p>
              </div>
              <div className="mt-4 rounded-[1rem] border border-border/70 bg-card/75 p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                  Recommended sequence
                </p>
                <div className="mt-3 space-y-2 text-sm leading-6 text-foreground">
                  {plan.recommendedSequence.map((step, index) => (
                    <p key={step}>
                      <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                      {step}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {plan.contentPlan.map((item, index) => (
                <ListCard key={`${item.title}-${index}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                        Content {index + 1}
                      </p>
                      <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-foreground">
                        {item.title}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.16em] text-primary">
                      <ListChecks className="h-3.5 w-3.5" />
                      Ready to execute
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                        Role in campaign
                      </p>
                      <p className="mt-1 text-sm leading-6 text-foreground">{item.roleInCampaign}</p>
                    </div>
                    <div>
                      <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                        Guest behavior goal
                      </p>
                      <p className="mt-1 text-sm leading-6 text-foreground">{item.guestBehaviorGoal}</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3 rounded-[1rem] border border-border/70 bg-background/70 p-4">
                    <div>
                      <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                        Creative direction
                      </p>
                      <p className="mt-1 text-sm leading-6 text-foreground">{item.creativeDirection}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                          Platform
                        </p>
                        <p className="mt-1 text-sm leading-6 text-foreground">{item.platform}</p>
                      </div>
                      <div>
                        <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                          Format
                        </p>
                        <p className="mt-1 text-sm leading-6 text-foreground">{item.format}</p>
                      </div>
                      <div>
                        <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                          Asset needed
                        </p>
                        <p className="mt-1 text-sm leading-6 text-foreground">{item.assetNeeded}</p>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                          Timing intent
                        </p>
                        <p className="mt-1 text-sm leading-6 text-foreground">{item.timingIntent}</p>
                      </div>
                      <div>
                        <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                          Next action
                        </p>
                        <p className="mt-1 text-sm leading-6 text-foreground">{item.nextAction}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                        CTA
                      </p>
                      <p className="mt-1 text-sm leading-6 text-foreground">{item.cta}</p>
                    </div>
                    <div>
                      <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                        Success signal
                      </p>
                      <p className="mt-1 text-sm leading-6 text-foreground">{item.successSignal}</p>
                    </div>
                  </div>
                </ListCard>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-[1rem] border border-dashed border-border/70 bg-background/55 p-5 text-sm leading-6 text-muted-foreground">
            {loading
              ? "Building the content plan..."
              : "Generate a content plan to turn campaign strategy into a trackable execution list."}
          </div>
        )}
      </div>
    </Card>
  );
}
