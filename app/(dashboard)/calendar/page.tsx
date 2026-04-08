"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePill } from "@/components/ui/date-pill";
import { useActiveClient } from "@/lib/client-context";
import { useCampaigns } from "@/lib/repositories/use-campaigns";
import { usePosts } from "@/lib/repositories/use-posts";
import { number } from "@/lib/utils";

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
  const [monthCursor, setMonthCursor] = useState<Date>(() =>
    getInitialCalendarMonth(campaigns.flatMap((campaign) => [campaign.startDate, campaign.endDate]))
  );

  const monthLabel = monthCursor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(monthCursor);
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - monthStart.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const dateKey = formatDateKey(date);
      const activeCampaigns = campaigns.filter(
        (campaign) => campaign.startDate <= dateKey && campaign.endDate >= dateKey
      );
      const scheduledPosts = posts.filter(
        (post) => post.campaignId && post.publishDate === dateKey
      );

      return {
        date,
        dateKey,
        inCurrentMonth: date.getMonth() === monthCursor.getMonth(),
        activeCampaigns,
        scheduledPosts
      };
    });
  }, [campaigns, monthCursor, posts]);

  const visibleCampaigns = campaigns.filter((campaign) => {
    const monthStartKey = formatDateKey(startOfMonth(monthCursor));
    const nextMonthStartKey = formatDateKey(addMonths(monthCursor, 1));
    return campaign.endDate >= monthStartKey && campaign.startDate < nextMonthStartKey;
  });
  const visiblePosts = posts.filter((post) => {
    if (!post.campaignId || !post.publishDate) {
      return false;
    }

    const monthStartKey = formatDateKey(startOfMonth(monthCursor));
    const nextMonthStartKey = formatDateKey(addMonths(monthCursor, 1));
    return post.publishDate >= monthStartKey && post.publishDate < nextMonthStartKey;
  });
  const todayKey = formatDateKey(new Date());
  const nextCalendarItems = [
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
    .slice(0, 4);
  const agendaDays = calendarDays.filter(
    (day) => day.inCurrentMonth && (day.activeCampaigns.length || day.scheduledPosts.length)
  );

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
          <Link className={buttonVariants({ variant: "outline" })} href="/campaigns">
            Back to campaigns
          </Link>
        }
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
        <div className="space-y-3 p-3 xl:hidden">
          {agendaDays.length ? (
            agendaDays.map((day) => (
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
                  {day.activeCampaigns.map((campaign) => (
                    <Link
                      className="block rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-sm text-foreground transition hover:border-primary/40 hover:text-primary"
                      href={`/campaigns/${campaign.id}`}
                      key={`${day.dateKey}-${campaign.id}-campaign`}
                    >
                      <p className="font-medium">{campaign.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Campaign · {campaign.status}
                      </p>
                    </Link>
                  ))}
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
              description="Campaigns and campaign-linked posts will appear here as soon as they are dated."
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
                {day.activeCampaigns.slice(0, 2).map((campaign) => (
                  <Link
                    className="block min-w-0 rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-xs text-foreground transition hover:border-primary/40 hover:text-primary"
                    href={`/campaigns/${campaign.id}`}
                    key={`${day.dateKey}-${campaign.id}-campaign`}
                  >
                    <p className="truncate font-medium">{campaign.name}</p>
                    <p className="mt-1 text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                      Campaign
                    </p>
                  </Link>
                ))}
                {day.scheduledPosts.slice(0, 2).map((post) => (
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
                {day.activeCampaigns.length + day.scheduledPosts.length > 4 ? (
                  <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                    +{day.activeCampaigns.length + day.scheduledPosts.length - 4} more
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <CardHeader className="border-b border-border/70 px-4 py-4 sm:px-5">
          <div>
            <CardDescription>Campaigns In View</CardDescription>
            <CardTitle className="mt-2">What is on the board this month</CardTitle>
          </div>
        </CardHeader>
        <div className="divide-y divide-border/70">
          {visibleCampaigns.length ? (
            visibleCampaigns.map((campaign) => (
              <Link
                className="block px-4 py-4 transition hover:bg-primary/5 sm:px-5"
                href={`/campaigns/${campaign.id}`}
                key={campaign.id}
              >
                <p className="font-medium text-foreground">{campaign.name}</p>
                <p className="mt-2 text-sm text-muted-foreground">{campaign.objective}</p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <DatePill value={campaign.startDate} />
                  <span className="text-xs text-muted-foreground">to</span>
                  <DatePill value={campaign.endDate} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {visiblePosts.filter((post) => post.campaignId === campaign.id).length} scheduled posts this month
                </p>
              </Link>
            ))
          ) : (
            <EmptyState
              title="No campaigns in this month"
              description="Create a campaign on the campaigns page and it will appear here on the calendar."
            />
          )}
        </div>
      </Card>
    </div>
  );
}
