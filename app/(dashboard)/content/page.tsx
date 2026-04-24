"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { LayoutList } from "lucide-react";

import { ContentPlanPanel } from "@/components/dashboard/content-plan-panel";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePill } from "@/components/ui/date-pill";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SchedulingPlanPanel } from "@/components/dashboard/scheduling-plan-panel";
import { buildSchedulingPlanContextFromInput } from "@/lib/agents/scheduling";
import { buildContentPlanContextFromInput } from "@/lib/agents/content-plan";
import { useActiveClient } from "@/lib/client-context";
import { getScheduledPosts } from "@/lib/domain/content";
import { summarizeCampaigns } from "@/lib/domain/campaigns";
import { getContentExecutionState } from "@/lib/domain/execution-state";
import { buildToastOpportunitySummary } from "@/lib/domain/performance";
import { useCampaigns } from "@/lib/repositories/use-campaigns";
import { useAssets } from "@/lib/repositories/use-assets";
import { usePosts } from "@/lib/repositories/use-posts";
import { useClientSettings } from "@/lib/repositories/use-client-settings";
import { useWeeklyMetrics } from "@/lib/repositories/use-weekly-metrics";
import { useApprovalsApi } from "@/lib/use-approvals-api";
import { useSchedulingPlan } from "@/lib/use-scheduling-plan";
import { useContentPlan } from "@/lib/use-content-plan";
import { useOperationsApi } from "@/lib/use-operations-api";
import { usePersistentDraft } from "@/lib/use-persistent-draft";
import { currency, number } from "@/lib/utils";
import { useWorkspaceContext } from "@/lib/workspace-context";
import type { ApprovalRequest, OperationalTask, Platform, Post } from "@/types";

type ContentDraft = {
  platform: Platform;
  format: NonNullable<Post["format"]>;
  content: string;
  cta: string;
  publishDate: string;
  goal: string;
  campaignId?: string;
  linkedTaskId?: string;
  destinationUrl: string;
  assetState: NonNullable<Post["assetState"]>;
};

type ContentWorkflowStage = "planning" | "review" | "ready" | "scheduled" | "live";

type ContentWorkflowItem = {
  post: Post;
  approval?: ApprovalRequest;
  campaignName?: string;
  campaignObjective?: string;
  linkedTaskTitle?: string;
  stage: ContentWorkflowStage;
  stageLabel: string;
  toneClassName: string;
  approvalLabel: string;
  assetLabel: string;
  timingLabel: string;
  nextStepLabel: string;
  nextStepDetail: string;
  actionLabel?: string;
  secondaryActionLabel?: string;
  isReadyForReview: boolean;
};

const platformOptions: Array<{ label: string; value: Platform }> = [
  { label: "Instagram", value: "Instagram" },
  { label: "Facebook", value: "Facebook" },
  { label: "Stories", value: "Stories" },
  { label: "TikTok", value: "TikTok" },
  { label: "Email", value: "Email" }
];

const formatOptions: Array<{ label: string; value: NonNullable<Post["format"]> }> = [
  { label: "Static post", value: "Static" },
  { label: "Carousel", value: "Carousel" },
  { label: "Reel", value: "Reel" },
  { label: "Story", value: "Story" },
  { label: "Email", value: "Email" },
  { label: "Offer", value: "Offer" }
];

const assetStateOptions: Array<{ label: string; value: NonNullable<Post["assetState"]> }> = [
  { label: "Missing", value: "Missing" },
  { label: "In progress", value: "In Progress" },
  { label: "Ready", value: "Ready" }
];

const stageConfig: Array<{
  id: ContentWorkflowStage;
  label: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
}> = [
  {
    id: "planning",
    label: "Building now",
    description: "Ideas, missing assets, or items that need revisions before review.",
    emptyTitle: "Nothing is being built right now",
    emptyDescription: "Add the next campaign idea below so production has a clear next step."
  },
  {
    id: "review",
    label: "Waiting on approval",
    description: "Content that is written and ready for a yes / no decision.",
    emptyTitle: "No content is waiting on approval",
    emptyDescription: "Send the next ready item into review so scheduling does not stall."
  },
  {
    id: "ready",
    label: "Ready to schedule",
    description: "Approved content that is clear to place on the calendar.",
    emptyTitle: "Nothing is ready to schedule",
    emptyDescription: "Approve the next strong item so the calendar can keep moving."
  },
  {
    id: "scheduled",
    label: "Scheduled",
    description: "Content already committed to a publish date.",
    emptyTitle: "Nothing is scheduled yet",
    emptyDescription: "Use the ready queue to place the next post on the calendar."
  },
  {
    id: "live",
    label: "Live",
    description: "Published content that should roll into campaign and performance review.",
    emptyTitle: "Nothing is live yet",
    emptyDescription: "The first published item will appear here once it goes live."
  }
];

function formatDateKey(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatShortDate(dateKey?: string) {
  if (!dateKey) {
    return "No date set";
  }

  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

function weekdayIndexFromLabel(label?: string | null) {
  if (!label) {
    return null;
  }

  const normalized = label.toLowerCase();
  const weekdays: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  };

  return weekdays[normalized] ?? null;
}

function createContentDraft(date = new Date()): ContentDraft {
  return {
    platform: "Instagram",
    format: "Static",
    content: "",
    cta: "",
    publishDate: formatDateKey(date),
    goal: "",
    campaignId: undefined,
    linkedTaskId: undefined,
    destinationUrl: "",
    assetState: "Missing"
  };
}

function getMonthDays(anchorDate: Date) {
  const firstOfMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    return {
      date,
      dateKey: formatDateKey(date),
      isCurrentMonth: date.getMonth() === anchorDate.getMonth()
    };
  });
}

function getStageLabel(stage: ContentWorkflowStage) {
  switch (stage) {
    case "review":
      return "In review";
    case "ready":
      return "Ready";
    case "scheduled":
      return "Scheduled";
    case "live":
      return "Live";
    case "planning":
    default:
      return "Planning";
  }
}

function getStageTone(stage: ContentWorkflowStage) {
  switch (stage) {
    case "review":
      return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "ready":
      return "border-[var(--app-accent-bg)]/20 bg-[var(--app-accent-soft)] text-foreground";
    case "scheduled":
      return "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    case "live":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "planning":
    default:
      return "border-border bg-card/80 text-muted-foreground";
  }
}

function isReadyForReview(post: Post) {
  return Boolean(
    post.campaignId &&
      post.goal.trim() &&
      post.content.trim() &&
      post.cta.trim() &&
      post.assetState === "Ready"
  );
}

function resolveWorkflowStage(post: Post, approval?: ApprovalRequest): ContentWorkflowStage {
  const executionState = getContentExecutionState(post, approval?.status, post.publishState);

  if (executionState === "Published") {
    return "live";
  }

  if (executionState === "Scheduled") {
    return "scheduled";
  }

  if (executionState === "Approved") {
    return "ready";
  }

  if (executionState === "In Review") {
    return "review";
  }

  return "planning";
}

function buildWorkflowItem(
  post: Post,
  approval: ApprovalRequest | undefined,
  linkedTask: OperationalTask | undefined,
  campaignName: string | undefined,
  campaignObjective: string | undefined,
  todayKey: string
): ContentWorkflowItem {
  const stage = resolveWorkflowStage(post, approval);
  const readyForReview = isReadyForReview(post);
  const approvalLabel =
    approval?.status ?? post.approvalState ?? (readyForReview ? "Ready for review" : "Not requested");
  const assetLabel = post.assetState ?? "Missing";
  const publishDateLabel = formatShortDate(post.publishDate);
  const isPastOrToday = Boolean(post.publishDate && post.publishDate <= todayKey);
  let nextStepLabel = "Finish the content brief";
  let nextStepDetail = "Add the campaign, objective, CTA, and assets so this can move into review.";
  let actionLabel: string | undefined;
  let secondaryActionLabel: string | undefined;

  if (stage === "planning") {
    if (!post.campaignId) {
      nextStepLabel = "Link this to a campaign";
      nextStepDetail = "Content should belong to a live campaign before it moves into review.";
    } else if (assetLabel !== "Ready") {
      nextStepLabel = "Finish the assets";
      nextStepDetail = "Design or assets still need to be ready before review can happen cleanly.";
      actionLabel = "Mark assets ready";
    } else if (post.approvalState === "Changes Requested") {
      nextStepLabel = "Resend for review";
      nextStepDetail = "Requested edits are holding this item out of scheduling.";
      actionLabel = "Send to review";
    } else if (readyForReview) {
      nextStepLabel = "Send to review";
      nextStepDetail = "The content is fully built and can move into approval now.";
      actionLabel = "Send to review";
    }
  }

  if (stage === "review") {
    nextStepLabel = "Clear approval";
    nextStepDetail = "A fast approval decision unlocks scheduling immediately.";
    actionLabel = "Approve";
    secondaryActionLabel = "Request changes";
  }

  if (stage === "ready") {
    nextStepLabel = "Place it on the calendar";
    nextStepDetail = "This item is approved and only needs a publish slot.";
    actionLabel = "Schedule";
  }

  if (stage === "scheduled") {
    nextStepLabel = isPastOrToday ? "Mark it live" : "Protect the publish date";
    nextStepDetail = isPastOrToday
      ? "This content should now move into live tracking and campaign review."
      : `This is already set for ${publishDateLabel}. Keep supporting assets and campaign timing aligned.`;
    actionLabel = isPastOrToday ? "Mark live" : undefined;
  }

  if (stage === "live") {
    nextStepLabel = "Review campaign performance";
    nextStepDetail = campaignName
      ? `Use ${campaignName} performance to see whether this content helped move covers, traffic, or revenue.`
      : "Check Performance once campaign and website signals have updated.";
  }

  return {
    post,
    approval,
    campaignName,
    campaignObjective,
    linkedTaskTitle: linkedTask?.title,
    stage,
    stageLabel: getStageLabel(stage),
    toneClassName: getStageTone(stage),
    approvalLabel,
    assetLabel,
    timingLabel:
      stage === "ready"
        ? "Ready to place"
        : stage === "planning" && !post.publishDate
          ? "Date not set"
          : publishDateLabel,
    nextStepLabel,
    nextStepDetail,
    actionLabel,
    secondaryActionLabel,
    isReadyForReview: readyForReview
  };
}

function ContentWorkflowCard({
  item,
  actioning,
  reviewing,
  onPrimaryAction,
  onSecondaryAction
}: {
  item: ContentWorkflowItem;
  actioning: boolean;
  reviewing: boolean;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
}) {
  return (
    <div className="rounded-[1.2rem] border border-border/70 bg-card/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={["rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em]", item.toneClassName].join(" ")}>
              {item.stageLabel}
            </span>
            <span className="rounded-full bg-accent px-2.5 py-1 text-xs text-muted-foreground">
              {item.post.platform}
            </span>
            <span className="rounded-full bg-accent px-2.5 py-1 text-xs text-muted-foreground">
              {item.post.format ?? "Static"}
            </span>
            <DatePill value={item.post.publishDate} />
          </div>
          <p className="mt-3 text-base font-semibold text-foreground">{item.post.goal}</p>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{item.post.content}</p>
        </div>
        {item.stage === "live" && item.post.campaignId ? (
          <Link
            className="inline-flex h-9 items-center justify-center rounded-full border border-border px-3 text-sm font-medium text-foreground transition hover:bg-accent/40"
            href="/performance"
          >
            View results
          </Link>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-3">
        <span>Campaign: {item.campaignName ?? "Not linked yet"}</span>
        <span>Objective: {item.campaignObjective ?? item.post.goal}</span>
        <span>Offer / CTA: {item.post.cta}</span>
        <span>Assets: {item.assetLabel}</span>
        <span>Approval: {item.approvalLabel}</span>
        <span>Timing: {item.timingLabel}</span>
        {item.post.destinationUrl ? <span>Destination: {item.post.destinationUrl}</span> : null}
        {item.linkedTaskTitle ? <span>Task: {item.linkedTaskTitle}</span> : null}
      </div>

      <div className="mt-4 rounded-[1rem] border border-border/70 bg-background/65 px-3 py-3">
        <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">Next step</p>
        <p className="mt-1 text-sm font-medium text-foreground">{item.nextStepLabel}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.nextStepDetail}</p>
      </div>

      {onPrimaryAction || onSecondaryAction ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {onPrimaryAction ? (
            <Button disabled={actioning || reviewing} size="sm" onClick={onPrimaryAction} type="button">
              {actioning || reviewing ? "Updating..." : item.actionLabel}
            </Button>
          ) : null}
          {onSecondaryAction ? (
            <Button disabled={reviewing || actioning} size="sm" variant="outline" onClick={onSecondaryAction} type="button">
              {item.secondaryActionLabel}
            </Button>
          ) : null}
          {item.post.campaignId ? (
            <Link
              className="inline-flex h-9 items-center justify-center rounded-full px-3 text-sm font-medium text-muted-foreground transition hover:bg-accent/40 hover:text-foreground"
              href={`/campaigns/${item.post.campaignId}`}
            >
              Open campaign
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function ContentPage() {
  const { activeClient } = useActiveClient();
  const { workspace } = useWorkspaceContext();
  const { campaigns } = useCampaigns(activeClient.id);
  const { assets } = useAssets(activeClient.id);
  const { posts, ready, error, addPost, updatePost } = usePosts(activeClient.id);
  const { settings } = useClientSettings(activeClient.id);
  const { metrics } = useWeeklyMetrics(activeClient.id);
  const { tasks } = useOperationsApi(workspace.id, activeClient.id);
  const { approvals, prependApproval, reviewApproval } = useApprovalsApi(activeClient.id);
  const todayKey = formatDateKey(new Date());
  const contentDraftNamespace = `content:${activeClient.id}`;
  const { value: selectedDate, setValue: setSelectedDate } = usePersistentDraft<string>(
    `${contentDraftNamespace}:selected-date`,
    todayKey
  );
  const { value: contentView, setValue: setContentView } = usePersistentDraft<"list" | "calendar">(
    `${contentDraftNamespace}:content-view`,
    "list"
  );
  const {
    value: draft,
    setValue: setDraft,
    reset: resetDraft
  } = usePersistentDraft<ContentDraft>(`${contentDraftNamespace}:draft`, () => createContentDraft());
  const [isCreating, setIsCreating] = useState(false);
  const [actioningPostId, setActioningPostId] = useState<string | null>(null);
  const [reviewingApprovalId, setReviewingApprovalId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<null | { label: string; detail: string }>(null);
  const campaignOverviews = useMemo(
    () => summarizeCampaigns(campaigns, posts, [], assets, [], []),
    [assets, campaigns, posts]
  );
  const selectedCampaignForPlan = useMemo(
    () =>
      campaigns.find((campaign) => campaign.id === draft.campaignId) ??
      campaigns.find((campaign) => campaign.status !== "Completed") ??
      campaigns[0] ??
      null,
    [campaigns, draft.campaignId]
  );
  const selectedCampaignOverview = useMemo(
    () =>
      selectedCampaignForPlan
        ? campaignOverviews.find((overview) => overview.campaign.id === selectedCampaignForPlan.id) ??
          null
        : null,
    [campaignOverviews, selectedCampaignForPlan]
  );
  const contentPlanContext = useMemo(() => {
    if (!selectedCampaignForPlan) {
      return null;
    }

    const selectedOverview = selectedCampaignOverview ?? {
      campaign: selectedCampaignForPlan,
      linkedPosts: [],
      linkedBlogs: [],
      linkedAssets: [],
      linkedMetrics: [],
      linkedAnalytics: [],
      attributedRevenue: 0,
      attributedCovers: 0,
      attributedTables: 0
    };

    return buildContentPlanContextFromInput({
      client: {
        id: activeClient.id,
        name: activeClient.name,
        segment: activeClient.segment,
        location: activeClient.location
      },
      selectedCampaign: {
        id: selectedCampaignForPlan.id,
        name: selectedCampaignForPlan.name,
        objective: selectedCampaignForPlan.objective,
        status: selectedCampaignForPlan.status
      },
      selectedCampaignStrategy: null,
      opportunityContext: {
        title: `${selectedCampaignForPlan.name} needs an execution-first content plan`,
        evidence: selectedOverview.linkedPosts.length
          ? `${number(selectedOverview.linkedPosts.length)} linked post${selectedOverview.linkedPosts.length === 1 ? "" : "s"} and ${number(selectedOverview.linkedAssets.length)} linked asset${selectedOverview.linkedAssets.length === 1 ? "" : "s"} are already attached.`
          : "This campaign does not have a clear linked content trail yet.",
        whyNow: selectedOverview.linkedPosts.length
          ? "The campaign has enough structure to turn into a concrete content plan."
          : "The campaign still needs a content path before the next execution window closes."
      },
      performanceSignals: [
        {
          label: "Linked posts",
          value: number(selectedOverview.linkedPosts.length),
          detail: "Content already attached to the campaign"
        },
        {
          label: "Linked assets",
          value: number(selectedOverview.linkedAssets.length),
          detail: "Ready or reusable asset support"
        },
        {
          label: "Attributed revenue",
          value: currency(selectedOverview.attributedRevenue),
          detail: "Current campaign proof"
        }
      ],
      currentContentGaps: [
        selectedOverview.linkedPosts.length
          ? "This campaign already has some content. Add the next execution piece."
          : "This campaign still needs its first linked content item."
      ],
      currentScheduleGaps: [
        posts.some((post) => post.campaignId === selectedCampaignForPlan.id && post.status === "Scheduled")
          ? "At least one post is already scheduled for this campaign."
          : "No scheduled content is attached to this campaign yet."
      ],
      availableAssets: assets
        .filter((asset) => asset.linkedCampaignIds.includes(selectedCampaignForPlan.id))
        .map((asset) => ({
          id: asset.id,
          label: asset.name,
          status: asset.status,
          assetType: asset.assetType
        }))
    });
  }, [
    activeClient.id,
    activeClient.location,
    activeClient.name,
    activeClient.segment,
    assets,
    posts,
    selectedCampaignForPlan,
    selectedCampaignOverview
  ]);
  const {
    plan: contentPlan,
    error: contentPlanError,
    generating: generatingContentPlan,
    generate: generateContentPlan
  } = useContentPlan(activeClient.id, contentPlanContext);
  const schedulingOpportunity = useMemo(
    () => buildToastOpportunitySummary(metrics, settings.averageCheck),
    [metrics, settings.averageCheck]
  );
  const schedulingPlanContext = useMemo(() => {
    if (!selectedCampaignForPlan) {
      return null;
    }

    const scheduledPostSummaries = posts
      .filter((post) => post.status === "Scheduled" && post.publishDate)
      .slice(0, 5)
      .map((post) => {
        const campaignName =
          campaigns.find((campaign) => campaign.id === post.campaignId)?.name ??
          selectedCampaignForPlan.name;

        return {
          id: post.id,
          title: post.goal || post.content.slice(0, 48) || post.platform,
          platform: post.platform,
          dateKey: post.publishDate,
          timingIntent: `${new Date(`${post.publishDate}T00:00:00`).toLocaleDateString("en-US", {
            weekday: "long"
          })} slot`,
          campaignName
        };
      });

    const scheduledDateSet = new Set(scheduledPostSummaries.map((item) => item.dateKey));
    const openScheduleGaps = Array.from({ length: 14 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() + index);
      const dateKey = formatDateKey(date);

      if (scheduledDateSet.has(dateKey)) {
        return null;
      }

      const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
      const isWeakDay = weekdayIndexFromLabel(schedulingOpportunity.weakestDay.day) === date.getDay();

      return {
        dateKey,
        label: isWeakDay ? `${weekday} revenue window` : `${weekday} open window`,
        detail: isWeakDay
          ? "This is the softest recurring window, so it is the best place for the next post."
          : "No scheduled content is attached here yet."
      };
    })
      .filter((gap): gap is { dateKey: string; label: string; detail: string } => Boolean(gap))
      .slice(0, 5);

    const readyContentItems = posts
      .filter(
        (post) =>
          post.campaignId === selectedCampaignForPlan.id &&
          getContentExecutionState(post, post.approvalState, post.publishState) === "Approved" &&
          (post.assetState ?? "Missing") === "Ready" &&
          post.status !== "Scheduled" &&
          post.status !== "Published"
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
          campaignName: selectedCampaignForPlan.name,
          campaignId: selectedCampaignForPlan.id
        };
      });

    return buildSchedulingPlanContextFromInput({
      client: {
        id: activeClient.id,
        name: activeClient.name,
        segment: activeClient.segment,
        location: activeClient.location
      },
      selectedCampaign: {
        id: selectedCampaignForPlan.id,
        name: selectedCampaignForPlan.name,
        objective: selectedCampaignForPlan.objective,
        status: selectedCampaignForPlan.status
      },
      campaignObjective: selectedCampaignForPlan.objective,
      readyContentItems,
      currentCalendar: {
        label: new Date().toLocaleDateString("en-US", {
          month: "long",
          year: "numeric"
        }),
        openDaysThisMonth: openScheduleGaps.length,
        upcomingScheduledPosts: scheduledPostSummaries
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
        detail: "Scheduling should stay directional until the next round of tracked posts lands."
      },
      existingScheduledPosts: scheduledPostSummaries,
      businessHours: {
        daysOpenPerWeek: settings.daysOpenPerWeek,
        weeksPerMonth: settings.weeksPerMonth
      }
    });
  }, [
    activeClient.id,
    activeClient.location,
    activeClient.name,
    activeClient.segment,
    campaigns,
    posts,
    selectedCampaignForPlan,
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

  const selectedDateObject = useMemo(
    () => new Date(`${selectedDate}T00:00:00`),
    [selectedDate]
  );
  const monthDays = useMemo(() => getMonthDays(selectedDateObject), [selectedDateObject]);
  const monthLabel = selectedDateObject.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });

  const campaignsById = useMemo(
    () => new Map(campaigns.map((campaign) => [campaign.id, campaign])),
    [campaigns]
  );
  const contentTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.taskType === "Content" ||
          task.linkedEntityType === "campaign" ||
          task.linkedEntityType === "post"
      ),
    [tasks]
  );
  const tasksById = useMemo(
    () => new Map(contentTasks.map((task) => [task.id, task])),
    [contentTasks]
  );
  const approvalsByPostId = useMemo(
    () =>
      new Map(
        approvals
          .filter((item) => item.entityType === "post")
          .map((item) => [item.entityId, item])
      ),
    [approvals]
  );

  const workflowItems = useMemo(() => {
    const items = posts.map((post) => {
      const linkedCampaign = post.campaignId ? campaignsById.get(post.campaignId) : undefined;
      const approval = approvalsByPostId.get(post.id);
      const linkedTask = post.linkedTaskId ? tasksById.get(post.linkedTaskId) : undefined;

      return buildWorkflowItem(
        post,
        approval,
        linkedTask,
        linkedCampaign?.name,
        linkedCampaign?.objective,
        todayKey
      );
    });

    const stageOrder: Record<ContentWorkflowStage, number> = {
      planning: 0,
      review: 1,
      ready: 2,
      scheduled: 3,
      live: 4
    };

    return items.sort((left, right) => {
      const stageDelta = stageOrder[left.stage] - stageOrder[right.stage];

      if (stageDelta !== 0) {
        return stageDelta;
      }

      return left.post.publishDate.localeCompare(right.post.publishDate);
    });
  }, [approvalsByPostId, campaignsById, posts, tasksById, todayKey]);

  const workflowSections = useMemo(
    () =>
      stageConfig.map((section) => ({
        ...section,
        items: workflowItems.filter((item) => item.stage === section.id)
      })),
    [workflowItems]
  );

  const workflowCounts = useMemo(
    () =>
      workflowSections.reduce<Record<ContentWorkflowStage, number>>(
        (counts, section) => {
          counts[section.id] = section.items.length;
          return counts;
        },
        {
          planning: 0,
          review: 0,
          ready: 0,
          scheduled: 0,
          live: 0
        }
      ),
    [workflowSections]
  );

  const scheduledAndLiveItems = useMemo(
    () => workflowItems.filter((item) => item.stage === "scheduled" || item.stage === "live"),
    [workflowItems]
  );
  const contentItemsByDate = useMemo(
    () =>
      scheduledAndLiveItems.reduce<Map<string, ContentWorkflowItem[]>>((map, item) => {
        const currentItems = map.get(item.post.publishDate) ?? [];
        map.set(item.post.publishDate, [...currentItems, item]);
        return map;
      }, new Map()),
    [scheduledAndLiveItems]
  );
  const selectedDayItems = useMemo(
    () => contentItemsByDate.get(selectedDate) ?? [],
    [contentItemsByDate, selectedDate]
  );
  const selectedDayLabel = selectedDateObject.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric"
  });
  const scheduledPosts = useMemo(
    () => getScheduledPosts(posts.filter((post) => Boolean(post.campaignId))),
    [posts]
  );
  const readyItems = workflowSections.find((section) => section.id === "ready")?.items ?? [];
  const liveItems = workflowSections.find((section) => section.id === "live")?.items ?? [];

  const plannerTaskOptions = useMemo(
    () =>
      [
        { label: "No linked task", value: "none" },
        ...contentTasks.map((task) => ({ label: task.title, value: task.id }))
      ],
    [contentTasks]
  );

  const scrollToPlanner = useCallback(() => {
    document.getElementById("content-planner")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const shiftMonth = useCallback(
    (direction: -1 | 1) => {
      const nextDate = new Date(`${selectedDate}T00:00:00`);
      nextDate.setMonth(nextDate.getMonth() + direction);
      setSelectedDate(formatDateKey(nextDate));
    },
    [selectedDate, setSelectedDate]
  );

  const handleCreateContent = useCallback(async () => {
    if (!draft.campaignId || !draft.goal.trim() || !draft.content.trim() || !draft.cta.trim()) {
      return;
    }

    setIsCreating(true);

    try {
      await addPost({
        clientId: activeClient.id,
        platform: draft.platform,
        format: draft.format,
        content: draft.content.trim(),
        cta: draft.cta.trim(),
        destinationUrl: draft.destinationUrl.trim() || undefined,
        publishDate: draft.publishDate,
        goal: draft.goal.trim(),
        status: "Draft",
        assetState: draft.assetState,
        linkedTaskId: draft.linkedTaskId,
        campaignId: draft.campaignId,
        assetIds: []
      });

      setActionFeedback({
        label: "Content saved to planning.",
        detail: "It is now tied to the campaign and ready to move through review and scheduling."
      });
      resetDraft(() => createContentDraft(new Date(draft.publishDate)));
      setContentView("list");
    } finally {
      setIsCreating(false);
    }
  }, [activeClient.id, addPost, draft, resetDraft, setContentView]);

  const handleSendToReview = useCallback(
    async (item: ContentWorkflowItem) => {
      setActioningPostId(item.post.id);

      try {
        const payload = await updatePost(item.post.id, {
          ...item.post,
          approvalState: "Pending"
        });

        if (payload.approval && !approvalsByPostId.has(payload.approval.entityId)) {
          prependApproval(payload.approval);
        }

        setActionFeedback({
          label: "Sent for approval.",
          detail: "The next step is a quick approval decision so this can move into scheduling."
        });
      } finally {
        setActioningPostId(null);
      }
    },
    [approvalsByPostId, prependApproval, updatePost]
  );

  const handleMarkAssetsReady = useCallback(
    async (item: ContentWorkflowItem) => {
      setActioningPostId(item.post.id);

      try {
        await updatePost(item.post.id, {
          ...item.post,
          assetState: "Ready"
        });
        setActionFeedback({
          label: "Assets marked ready.",
          detail: "This content can now move into review as soon as the brief is complete."
        });
      } finally {
        setActioningPostId(null);
      }
    },
    [updatePost]
  );

  const handleReview = useCallback(
    async (item: ContentWorkflowItem, status: "Approved" | "Changes Requested") => {
      setReviewingApprovalId(item.approval?.id ?? item.post.id);

      try {
        if (item.approval) {
          await reviewApproval(item.approval.id, {
            status,
            note:
              status === "Approved"
                ? "Approved from the content workflow."
                : "Changes requested from the content workflow.",
            approverName: "Operator"
          });
        }

        await updatePost(item.post.id, {
          ...item.post,
          approvalState: status
        });

        setActionFeedback({
          label: status === "Approved" ? "Approval cleared." : "Changes requested.",
          detail:
            status === "Approved"
              ? "This content can move straight into scheduling now."
              : "The item has moved back into production so edits can happen before review."
        });
      } finally {
        setReviewingApprovalId(null);
      }
    },
    [reviewApproval, updatePost]
  );

  const handleSchedule = useCallback(
    async (item: ContentWorkflowItem, publishDate?: string) => {
      const nextDate = publishDate ?? item.post.publishDate ?? selectedDate ?? todayKey;
      setActioningPostId(item.post.id);

      try {
        await updatePost(item.post.id, {
          ...item.post,
          publishDate: nextDate,
          status: "Scheduled",
          approvalState: item.post.approvalState ?? "Approved"
        });
        setActionFeedback({
          label: `Scheduled for ${formatShortDate(nextDate)}.`,
          detail: "The publish date is now set and this item is visible in the execution calendar."
        });
      } finally {
        setActioningPostId(null);
      }
    },
    [selectedDate, todayKey, updatePost]
  );

  const handleMarkLive = useCallback(
    async (item: ContentWorkflowItem) => {
      setActioningPostId(item.post.id);

      try {
        await updatePost(item.post.id, {
          ...item.post,
          status: "Published",
          publishState: "Published"
        });
        setActionFeedback({
          label: "Marked live.",
          detail: "This content now rolls into campaign and performance review."
        });
      } finally {
        setActioningPostId(null);
      }
    },
    [updatePost]
  );

  const getPrimaryAction = useCallback(
    (item: ContentWorkflowItem) => {
      if (!item.actionLabel) {
        return undefined;
      }

      if (item.actionLabel === "Mark assets ready") {
        return () => void handleMarkAssetsReady(item);
      }

      if (item.actionLabel === "Send to review") {
        return () => void handleSendToReview(item);
      }

      if (item.actionLabel === "Approve") {
        return () => void handleReview(item, "Approved");
      }

      if (item.actionLabel === "Schedule") {
        return () => void handleSchedule(item);
      }

      if (item.actionLabel === "Mark live") {
        return () => void handleMarkLive(item);
      }

      return undefined;
    },
    [handleMarkAssetsReady, handleMarkLive, handleReview, handleSchedule, handleSendToReview]
  );

  const getSecondaryAction = useCallback(
    (item: ContentWorkflowItem) => {
      if (item.secondaryActionLabel === "Request changes") {
        return () => void handleReview(item, "Changes Requested");
      }

      return undefined;
    },
    [handleReview]
  );

  if (!ready) {
    return <div className="text-sm text-muted-foreground">Loading content workspace...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content"
        title="Run content like campaign work"
        description="Every item should show why it exists, where it is blocked, and what the next move is before it goes live."
        actions={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              size="sm"
              variant="outline"
              disabled={generatingContentPlan || !contentPlanContext}
              onClick={() => void generateContentPlan()}
              type="button"
            >
              <LayoutList className="mr-2 h-4 w-4" />
              Build Content Plan from Campaign
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={generatingSchedulingPlan || !schedulingPlanContext}
              onClick={() => void generateSchedulingPlan()}
              type="button"
            >
              <LayoutList className="mr-2 h-4 w-4" />
              Recommend Schedule
            </Button>
          </div>
        }
      />

      <ContentPlanPanel
        description="Execution-first content plan"
        error={contentPlanError}
        loading={generatingContentPlan}
        plan={contentPlan}
        title="Content operator plan"
      />

      <SchedulingPlanPanel
        description="Revenue-aware scheduling recommendation"
        error={schedulingPlanError}
        loading={generatingSchedulingPlan}
        plan={schedulingPlan}
        title="Schedule operator plan"
      />

      {actionFeedback ? (
        <Card>
          <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{actionFeedback.label}</p>
              <p className="text-sm text-muted-foreground">{actionFeedback.detail}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setActionFeedback(null)} type="button">
              Dismiss
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stageConfig.map((section) => (
          <Card key={section.id} className="p-4">
            <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">{section.label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-foreground">
              {number(workflowCounts[section.id])}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{section.description}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <Card id="content-planner" className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardDescription>Plan content</CardDescription>
              <CardTitle className="mt-2">Build the next campaign asset</CardTitle>
            </div>
            <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
              Starts in planning
            </span>
          </div>

          <div className="mt-5 grid gap-4">
            <div>
              <Label>Campaign</Label>
              <Select
                value={draft.campaignId ?? "none"}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    campaignId: value === "none" ? undefined : value
                  }))
                }
                options={[
                  { label: "Choose campaign", value: "none" },
                  ...campaigns.map((campaign) => ({ label: campaign.name, value: campaign.id }))
                ]}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Platform</Label>
                <Select
                  value={draft.platform}
                  onChange={(value) => setDraft((current) => ({ ...current, platform: value as Platform }))}
                  options={platformOptions}
                />
              </div>
              <div>
                <Label>Content type</Label>
                <Select
                  value={draft.format}
                  onChange={(value) =>
                    setDraft((current) => ({ ...current, format: value as NonNullable<Post["format"]> }))
                  }
                  options={formatOptions}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Linked task</Label>
                <Select
                  value={draft.linkedTaskId ?? "none"}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      linkedTaskId: value === "none" ? undefined : value
                    }))
                  }
                  options={plannerTaskOptions}
                />
              </div>
              <div>
                <Label>Asset state</Label>
                <Select
                  value={draft.assetState}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      assetState: value as NonNullable<Post["assetState"]>
                    }))
                  }
                  options={assetStateOptions}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="content-goal">Objective</Label>
              <Input
                id="content-goal"
                placeholder="Drive Thursday reservations"
                value={draft.goal}
                onChange={(event) => setDraft((current) => ({ ...current, goal: event.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="content-cta">Offer / CTA</Label>
              <Input
                id="content-cta"
                placeholder="Reserve a table"
                value={draft.cta}
                onChange={(event) => setDraft((current) => ({ ...current, cta: event.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="content-destination">Destination</Label>
              <Input
                id="content-destination"
                placeholder="https://restaurant.com/reservations"
                value={draft.destinationUrl}
                onChange={(event) => setDraft((current) => ({ ...current, destinationUrl: event.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="content-publish-date">Preferred publish date</Label>
              <Input
                id="content-publish-date"
                type="date"
                value={draft.publishDate}
                onChange={(event) => setDraft((current) => ({ ...current, publishDate: event.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="content-body">Message / angle</Label>
              <Textarea
                id="content-body"
                placeholder="What is the hook, offer, and reason this should matter to the guest right now?"
                value={draft.content}
                onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
              />
            </div>

            <Button
              disabled={isCreating || !draft.campaignId || !draft.goal.trim() || !draft.content.trim() || !draft.cta.trim()}
              onClick={() => void handleCreateContent()}
              type="button"
            >
              {isCreating ? "Saving..." : "Save content"}
            </Button>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="overflow-hidden p-0">
            <CardHeader className="border-b border-border/70 px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardDescription>Execution view</CardDescription>
                  <CardTitle className="mt-2">Content workflow</CardTitle>
                </div>
                <div className="inline-flex rounded-full border border-border bg-card/80 p-1">
                  {(["list", "calendar"] as const).map((view) => (
                    <button
                      className={[
                        "rounded-full px-4 py-2 text-xs font-semibold capitalize transition",
                        contentView === view ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/40"
                      ].join(" ")}
                      key={view}
                      type="button"
                      onClick={() => setContentView(view)}
                    >
                      {view}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>

            {contentView === "list" ? (
              <div className="space-y-4 p-4 sm:p-5">
                {workflowSections.map((section) => (
                  <Card key={section.id} className="overflow-hidden border border-border/70 bg-background/40 shadow-none">
                    <div className="border-b border-border/70 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{section.label}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
                        </div>
                        <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          {number(section.items.length)}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3 px-4 py-4">
                      {section.items.length ? (
                        section.items.map((item) => (
                          <ContentWorkflowCard
                            actioning={actioningPostId === item.post.id}
                            item={item}
                            key={item.post.id}
                            onPrimaryAction={getPrimaryAction(item)}
                            onSecondaryAction={getSecondaryAction(item)}
                            reviewing={reviewingApprovalId === (item.approval?.id ?? item.post.id)}
                          />
                        ))
                      ) : (
                        <EmptyState
                          title={section.emptyTitle}
                          description={section.emptyDescription}
                          action={
                            <Button size="sm" variant="outline" onClick={scrollToPlanner} type="button">
                              Plan content
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-5 p-4 sm:p-5">
                <Card className="border border-border/70 bg-background/40 shadow-none">
                  <div className="border-b border-border/70 px-4 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Ready to schedule</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Approved content should move onto the calendar quickly so momentum does not slip.
                        </p>
                      </div>
                      <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {number(readyItems.length)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3 px-4 py-4">
                    {readyItems.length ? (
                      readyItems.map((item) => (
                        <ContentWorkflowCard
                          actioning={actioningPostId === item.post.id}
                          item={item}
                          key={item.post.id}
                          onPrimaryAction={getPrimaryAction(item)}
                          reviewing={false}
                        />
                      ))
                    ) : (
                      <EmptyState
                        title="No approved content is waiting"
                        description="Clear the next approval and it will appear here ready for scheduling."
                        action={
                          <Button size="sm" variant="outline" onClick={() => setContentView("list")} type="button">
                            Back to workflow
                          </Button>
                        }
                      />
                    )}
                  </div>
                </Card>

                <Card className="overflow-hidden border border-border/70 bg-background/40 shadow-none">
                  <div className="border-b border-border/70 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{monthLabel}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          The calendar only shows real scheduled or live content.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => shiftMonth(-1)} type="button">
                          Prev
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => shiftMonth(1)} type="button">
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-7 gap-1 text-center text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                        <span key={day}>{day}</span>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-7 gap-2">
                      {monthDays.map((day) => {
                        const dayItems = contentItemsByDate.get(day.dateKey) ?? [];
                        const selected = day.dateKey === selectedDate;

                        return (
                          <button
                            className={[
                              "min-h-24 rounded-[1rem] border px-2 py-2 text-left transition",
                              selected ? "border-primary bg-primary/8" : "border-border/70 bg-card/60 hover:bg-accent/25",
                              day.isCurrentMonth ? "text-foreground" : "text-muted-foreground/50"
                            ].join(" ")}
                            key={day.dateKey}
                            type="button"
                            onClick={() => setSelectedDate(day.dateKey)}
                          >
                            <span className="text-sm font-semibold">{day.date.getDate()}</span>
                            <div className="mt-2 space-y-1">
                              {dayItems.slice(0, 2).map((item) => (
                                <span
                                  className={[
                                    "block truncate rounded-md px-2 py-1 text-[0.68rem] font-medium",
                                    item.stage === "live"
                                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                      : "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                                  ].join(" ")}
                                  key={item.post.id}
                                >
                                  {item.post.platform}: {item.post.goal}
                                </span>
                              ))}
                              {!dayItems.length && day.isCurrentMonth ? (
                                <span className="block text-[0.68rem] text-muted-foreground">Open</span>
                              ) : null}
                              {dayItems.length > 2 ? (
                                <span className="block text-[0.68rem] text-muted-foreground">
                                  +{dayItems.length - 2} more
                                </span>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </Card>

                <Card className="border border-border/70 bg-background/40 shadow-none">
                  <div className="border-b border-border/70 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{selectedDayLabel}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Scheduled content should reflect real execution, not placeholders.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDraft((current) => ({ ...current, publishDate: selectedDate }));
                          scrollToPlanner();
                        }}
                        type="button"
                      >
                        Plan for this day
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3 px-4 py-4">
                    {selectedDayItems.length ? (
                      selectedDayItems.map((item) => (
                        <ContentWorkflowCard
                          actioning={actioningPostId === item.post.id}
                          item={item}
                          key={item.post.id}
                          onPrimaryAction={getPrimaryAction(item)}
                          reviewing={false}
                        />
                      ))
                    ) : (
                      <EmptyState
                        title="No scheduled content for this day"
                        description="Use a ready item above or plan a new one for this slot."
                        action={
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={readyItems.length ? () => setContentView("calendar") : scrollToPlanner}
                            type="button"
                          >
                            {readyItems.length ? "Schedule ready content" : "Plan content"}
                          </Button>
                        }
                      />
                    )}
                  </div>
                </Card>
              </div>
            )}
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">Campaign-linked</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-foreground">
                {number(posts.filter((post) => Boolean(post.campaignId)).length)}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Every new content item now starts tied to a campaign, so intent is visible from the start.
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">Scheduled</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-foreground">
                {number(scheduledPosts.length)}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                The calendar only counts real scheduled posts, not placeholders or campaign spans.
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">Live and measurable</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-foreground">
                {number(liveItems.length)}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Live content can now point back into campaign and performance review without mixing analytics into planning.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
