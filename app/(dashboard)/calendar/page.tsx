"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, LayoutList } from "lucide-react";

import { SchedulingPlanPanel } from "@/components/dashboard/scheduling-plan-panel";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePill } from "@/components/ui/date-pill";
import { useActiveClient } from "@/lib/client-context";
import { buildSchedulingPlanContextFromInput } from "@/lib/agents/scheduling";
import { buildToastOpportunitySummary } from "@/lib/domain/performance";
import { useCampaigns } from "@/lib/repositories/use-campaigns";
import { usePosts } from "@/lib/repositories/use-posts";
import { useClientSettings } from "@/lib/repositories/use-client-settings";
import { useWeeklyMetrics } from "@/lib/repositories/use-weekly-metrics";
import { useSchedulingPlan } from "@/lib/use-scheduling-plan";
import { currency, number } from "@/lib/utils";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function formatDateKey(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function getInitialCalendarMonth(campaignDates: string[]) {
  const today = new Date();
  const upcoming = campaignDates
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((left, right) => left.getTime() - right.getTime())
    .find((value) => value >= startOfMonth(today));

  return startOfMonth(upcoming ?? today);
}

export default function CampaignCalendarPage() {
  const { activeClient } = useActiveClient();
  const { campaigns, ready, error } = useCampaigns(activeClient.id);
  const { posts, ready: postsReady, error: postsError } = usePosts(activeClient.id);
  const { settings } = useClientSettings(activeClient.id);
  const { metrics } = useWeeklyMetrics(activeClient.id);
  const [monthCursor, setMonthCursor] = useState<Date>(() =>
    getInitialCalendarMonth(campaigns.flatMap((campaign) => [campaign.startDate, campaign.endDate]))
  );

  const monthLabel = monthCursor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });
  const monthStartKey = useMemo(() => formatDateKey(startOfMonth(monthCursor)), [monthCursor]);
  const nextMonthStartKey = useMemo(() => formatDateKey(addMonths(monthCursor, 1)), [monthCursor]);
  const postsByPublishDate = useMemo(
    () =>
      posts.reduce<Map<string, typeof posts>>((map, post) => {
        if (!post.campaignId || !post.publishDate) {
          return map;
        }

        const currentPosts = map.get(post.publishDate) ?? [];
        map.set(post.publishDate, [...currentPosts, post]);
        return map;
      }, new Map()),
    [posts]
  );

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(monthCursor);
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - monthStart.getDay());

      return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(gridStart);
        date.setDate(gridStart.getDate() + index);
        const dateKey = formatDateKey(date);
      const scheduledPosts = postsByPublishDate.get(dateKey) ?? [];

      return {
        date,
        dateKey,
        inCurrentMonth: date.getMonth() === monthCursor.getMonth(),
        scheduledPosts
      };
    });
  }, [monthCursor, postsByPublishDate]);

  const visibleCampaigns = useMemo(
    () =>
      campaigns.filter((campaign) => campaign.endDate >= monthStartKey && campaign.startDate < nextMonthStartKey),
    [campaigns, monthStartKey, nextMonthStartKey]
  );
  const visiblePosts = useMemo(
    () =>
      posts.filter(
        (post) =>
          Boolean(post.campaignId && post.publishDate) &&
          post.publishDate >= monthStartKey &&
          post.publishDate < nextMonthStartKey
      ),
    [monthStartKey, nextMonthStartKey, posts]
  );
  const todayKey = formatDateKey(new Date());
  const nextCalendarItems = useMemo(
    () =>
      [
        ...campaigns.flatMap((campaign) => [
          {
            id: `${campaign.id}-start`,
            date: campaign.startDate,
            label: campaign.name,
            detail: "Campaign starts",
            href: `/campaigns/${campaign.id}`
          },
          {
            id: `${campaign.id}-end`,
            date: campaign.endDate,
            label: campaign.name,
            detail: "Campaign ends",
            href: `/campaigns/${campaign.id}`
          }
        ]),
        ...posts
          .filter((post) => post.campaignId && post.publishDate)
          .map((post) => ({
            id: `${post.id}-post`,
            date: post.publishDate,
            label: post.goal || post.platform,
            detail: `${post.platform} post · ${post.status}`,
            href: `/campaigns/${post.campaignId}`
          }))
      ]
        .filter((item) => item.date >= todayKey)
        .sort((left, right) => left.date.localeCompare(right.date))
        .slice(0, 4),
    [campaigns, posts, todayKey]
  );
  const scheduledDays = useMemo(
    () => calendarDays.filter((day) => day.inCurrentMonth && day.scheduledPosts.length),
    [calendarDays]
  );
  const openExecutionDays = useMemo(
    () => calendarDays.filter((day) => day.inCurrentMonth && !day.scheduledPosts.length).length,
    [calendarDays]
  );
  const schedulingOpportunity = useMemo(
    () => buildToastOpportunitySummary(metrics, settings.averageCheck),
    [metrics, settings.averageCheck]
  );
  const focusedCampaign = useMemo(
    () =>
      campaigns.find((campaign) => campaign.status === "Active") ??
      campaigns.find((campaign) => campaign.status === "Planning") ??
      campaigns[0] ??
      null,
    [campaigns]
  );
  const schedulingPlanContext = useMemo(() => {
    try {
      if (!focusedCampaign) {
        return null;
      }

      const scheduledPostSummaries = scheduledDays.slice(0, 5).flatMap((day) =>
        day.scheduledPosts.map((post) => {
          const campaignName =
            campaigns.find((campaign) => campaign.id === post.campaignId)?.name ?? focusedCampaign.name;

          return {
            id: post.id,
            title: post.goal || post.platform,
            platform: post.platform,
            dateKey: post.publishDate,
            timingIntent: `${day.date.toLocaleDateString("en-US", {
              weekday: "long"
            })} slot`,
            campaignName
          };
        })
      );
      const scheduledDateSet = new Set(scheduledPostSummaries.map((item) => item.dateKey));
      const openScheduleGaps = calendarDays
        .filter((day) => day.inCurrentMonth && !day.scheduledPosts.length)
        .slice(0, 5)
        .map((day) => {
          const weekday = day.date.toLocaleDateString("en-US", { weekday: "long" });
          const isWeakDay = weekday === schedulingOpportunity.weakestDay.day;

          return {
            dateKey: day.dateKey,
            label: isWeakDay ? `${weekday} revenue window` : `${weekday} open window`,
            detail: isWeakDay
              ? "This is the softest recurring window, so it is the best place for the next post."
              : "No scheduled content is attached here yet."
          };
        })
        .filter((gap): gap is { dateKey: string; label: string; detail: string } =>
          Boolean(gap) && !scheduledDateSet.has(gap.dateKey)
        )
        .slice(0, 5);

      const readyContentItems = posts
        .filter(
          (post) =>
            post.campaignId === focusedCampaign.id &&
            post.status !== "Scheduled" &&
            post.status !== "Published" &&
            post.approvalState === "Approved" &&
            (post.assetState ?? "Missing") === "Ready"
        )
        .slice(0, 5)
        .map((post) => {
          const weekday = new Date(`${post.publishDate}T00:00:00`).toLocaleDateString("en-US", {
            weekday: "long"
          });

          return {
            id: post.id,
            title: post.goal || post.content.slice(0, 48) || `${post.platform} post`,
            platform: post.platform,
            format: post.format ?? "Static",
            cta: post.cta,
            timingIntent: `${weekday} ${post.platform.toLowerCase()} decision window`,
            assetState: post.assetState ?? "Missing",
            approvalState: post.approvalState ?? "Draft",
            guestBehaviorGoal: post.goal || "Drive guest action",
            campaignName: focusedCampaign.name,
            campaignId: focusedCampaign.id
          };
        });

      const scheduledPostSummariesByDate = scheduledPostSummaries.slice(0, 5);

      return buildSchedulingPlanContextFromInput({
        client: {
          id: activeClient.id,
          name: activeClient.name,
          segment: activeClient.segment,
          location: activeClient.location
        },
        selectedCampaign: {
          id: focusedCampaign.id,
          name: focusedCampaign.name,
          objective: focusedCampaign.objective,
          status: focusedCampaign.status
        },
        campaignObjective: focusedCampaign.objective,
        readyContentItems,
        currentCalendar: {
          label: monthLabel,
          openDaysThisMonth: openExecutionDays,
          upcomingScheduledPosts: scheduledPostSummariesByDate
        },
        openScheduleGaps,
        weakRevenueWindow: {
          label: schedulingOpportunity.weakestDay.day,
          value: currency(schedulingOpportunity.weakestDay.averageRevenue),
          detail: schedulingOpportunity.recommendation
        },
        performanceSignals: [
          {
            label: "Ready items",
            value: number(readyContentItems.length),
            detail: "Approved content that can move to scheduling"
          },
          {
            label: "Scheduled posts",
            value: number(scheduledPostSummaries.length),
            detail: "Existing calendar commitments"
          },
          {
            label: "Open gaps",
            value: number(openScheduleGaps.length),
            detail: "Calendar windows available for new placements"
          }
        ],
        attributionConfidence: {
          label: "Medium",
          detail: "Scheduling should stay directional until more tracked posts are live."
        },
        existingScheduledPosts: scheduledPostSummariesByDate,
        businessHours: {
          daysOpenPerWeek: settings.daysOpenPerWeek,
          weeksPerMonth: settings.weeksPerMonth
        }
      });
    } catch {
      return null;
    }
  }, [
    activeClient.id,
    activeClient.location,
    activeClient.name,
    activeClient.segment,
    calendarDays,
    campaigns,
    focusedCampaign,
    monthLabel,
    openExecutionDays,
    posts,
    scheduledDays,
    schedulingOpportunity.recommendation,
    schedulingOpportunity.weakestDay.averageRevenue,
    schedulingOpportunity.weakestDay.day,
    settings.daysOpenPerWeek,
    settings.weeksPerMonth
  ]);
  const {
    plan: schedulingPlan,
    error: schedulingPlanError,
    generating: generatingSchedulingPlan,
    generate: generateSchedulingPlan
  } = useSchedulingPlan(activeClient.id, schedulingPlanContext);

  if (!ready || !postsReady) {
    return <div className="text-sm text-muted-foreground">Loading campaign calendar...</div>;
  }

  if (error || postsError) {
    return <div className="text-sm text-destructive">{error ?? postsError}</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Calendar"
        title="Campaign calendar"
        description="See every campaign on the calendar so timing, overlap, and launch windows are obvious at a glance."
        actions={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              className="justify-center"
              disabled={generatingSchedulingPlan || !schedulingPlanContext}
              onClick={() => void generateSchedulingPlan()}
              type="button"
              variant="outline"
            >
              {generatingSchedulingPlan ? (
                <LayoutList className="mr-2 h-4 w-4 animate-pulse" />
              ) : (
                <LayoutList className="mr-2 h-4 w-4" />
              )}
              Fill Schedule Gaps
            </Button>
            <Link className={buttonVariants({ variant: "outline" })} href="/campaigns">
              Back to campaigns
            </Link>
          </div>
        }
      />

      <SchedulingPlanPanel
        description="Revenue-aware scheduling recommendation"
        error={schedulingPlanError}
        loading={generatingSchedulingPlan}
        plan={schedulingPlan}
        title="Schedule operator plan"
      />

      <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-[1rem] border border-border/70 bg-card/70 px-4 py-3 text-sm text-muted-foreground">
        <span><strong className="font-medium text-foreground">{number(visibleCampaigns.length)}</strong> campaigns</span>
        <span><strong className="font-medium text-foreground">{number(visiblePosts.length)}</strong> scheduled posts</span>
        <span><strong className="font-medium text-foreground">{number(visibleCampaigns.filter((campaign) => campaign.status === "Active").length)}</strong> active</span>
        <span><strong className="font-medium text-foreground">{number(visibleCampaigns.filter((campaign) => campaign.status === "Planning").length)}</strong> planning</span>
      </div>

      <Card className="p-0">
        <CardHeader className="border-b border-border/70 px-4 py-4 sm:px-5">
          <div>
            <CardDescription>Next Up</CardDescription>
            <CardTitle className="mt-2">What is happening next</CardTitle>
          </div>
        </CardHeader>
        <div className="divide-y divide-border/70">
          {nextCalendarItems.length ? (
            nextCalendarItems.map((item) => (
              <Link
                className="grid gap-3 px-4 py-4 transition hover:bg-primary/5 sm:grid-cols-[8rem_1fr_auto] sm:items-center sm:px-5"
                href={item.href as Route}
                key={item.id}
              >
                <DatePill value={item.date} />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{item.label}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{item.detail}</span>
                </span>
                <span className="text-sm font-medium text-primary">Open</span>
              </Link>
            ))
          ) : (
            <EmptyState
              title="No upcoming calendar items"
              description="Create a campaign or schedule content to build the next-up list."
            />
          )}
        </div>
      </Card>

      <Card id="monthly-calendar" className="overflow-hidden p-0">
        <CardHeader className="border-b border-border/70 px-4 py-4 sm:px-5">
          <div>
            <CardDescription>Monthly Calendar</CardDescription>
            <CardTitle className="mt-2">{monthLabel}</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Scheduled content stays on the grid. Campaign context stays lightweight above it.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className={buttonVariants({ variant: "outline", size: "sm" })}
              onClick={() => setMonthCursor((current) => addMonths(current, -1))}
              type="button"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Previous
            </button>
            <button
              className={buttonVariants({ variant: "outline", size: "sm" })}
              onClick={() => setMonthCursor((current) => addMonths(current, 1))}
              type="button"
            >
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </button>
          </div>
        </CardHeader>
        <div className="border-b border-border/70 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Active campaigns</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Keep campaign context visible without covering the calendar.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {number(openExecutionDays)} open day{openExecutionDays === 1 ? "" : "s"} this month
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {visibleCampaigns.length ? (
              visibleCampaigns.map((campaign) => (
                <Link
                  className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-sm text-foreground transition hover:border-primary/40 hover:text-primary"
                  href={`/campaigns/${campaign.id}`}
                  key={campaign.id}
                >
                  <span className="font-medium">{campaign.name}</span>
                  <span className="text-xs text-muted-foreground">{campaign.status}</span>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No campaigns in view for this month.</p>
            )}
          </div>
        </div>
        <div className="space-y-3 p-3 xl:hidden">
          {scheduledDays.length ? (
            scheduledDays.map((day) => (
              <div
                className="rounded-[1rem] border border-border bg-card/70 p-3.5"
                key={day.dateKey}
              >
                <p className="text-sm font-medium text-foreground">
                  {day.date.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric"
                  })}
                </p>
                <div className="mt-3 space-y-2">
                  {day.scheduledPosts.map((post) => (
                    <Link
                      className="block rounded-xl border border-border/60 bg-[rgba(189,156,87,0.08)] px-3 py-2 text-sm text-foreground transition hover:border-primary/40 hover:text-primary"
                      href={`/campaigns/${post.campaignId}`}
                      key={`${day.dateKey}-${post.id}-post`}
                    >
                      <p className="font-medium">{post.platform}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {post.goal}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-primary">
                        Post · {post.status}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              title="Nothing scheduled in this month"
              description="Schedule content and it will show here. The open days count above shows how much room is still available."
            />
          )}
        </div>

        <div className="hidden grid-cols-7 gap-px bg-border xl:grid">
          {weekdayLabels.map((label) => (
            <div
              className="bg-muted/30 px-3 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground"
              key={label}
            >
              {label}
            </div>
          ))}
          {calendarDays.map((day) => (
            <div
              className={`min-h-40 min-w-0 overflow-hidden p-3 ${
                day.inCurrentMonth
                  ? "bg-card/80"
                  : "bg-muted/20"
              }`}
              key={day.dateKey}
            >
              <p
                className={`text-sm ${
                  day.inCurrentMonth ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {day.date.getDate()}
              </p>
              <div className="mt-3 space-y-2">
                {day.scheduledPosts.slice(0, 3).map((post) => (
                  <Link
                    className="block min-w-0 rounded-xl border border-border/60 bg-[rgba(189,156,87,0.08)] px-3 py-2 text-xs text-foreground transition hover:border-primary/40 hover:text-primary"
                    href={`/campaigns/${post.campaignId}`}
                    key={`${day.dateKey}-${post.id}-post`}
                  >
                    <p className="truncate font-medium">{post.platform}</p>
                    <p className="truncate text-[0.72rem] text-muted-foreground">{post.goal}</p>
                    <p className="mt-1 text-[0.68rem] uppercase tracking-[0.16em] text-primary">
                      Post
                    </p>
                  </Link>
                ))}
                {!day.scheduledPosts.length && day.inCurrentMonth ? (
                  <p className="rounded-xl border border-dashed border-border/70 px-3 py-2 text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                    Open
                  </p>
                ) : null}
                {day.scheduledPosts.length > 3 ? (
                  <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                    +{day.scheduledPosts.length - 3} more
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
