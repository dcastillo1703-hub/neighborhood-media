"use client";

import { useCallback, useMemo, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronRight,
  Pencil,
  Sparkles,
} from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { NextActionPanel } from "@/components/dashboard/next-action-panel";
import { OperatorQueueCard } from "@/components/dashboard/operator-queue-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { useActiveClient } from "@/lib/client-context";
import { calculateRevenueModel } from "@/lib/calculations";
import { getCampaignOverview } from "@/lib/domain/campaigns";
import { buildOperatorQueue } from "@/lib/domain/operator-queue";
import {
  getQueuePrimaryActionLabel,
  getQueueSecondaryActionLabel,
  getQueueToneLabel,
  isQueueUndoable,
} from "@/lib/domain/operator-queue-actions";
import { buildToastOpportunitySummary } from "@/lib/domain/performance";
import { useAnalyticsSnapshots } from "@/lib/repositories/use-analytics-snapshots";
import { useAssets } from "@/lib/repositories/use-assets";
import { useBlogPosts } from "@/lib/repositories/use-blog-posts";
import { useCampaigns } from "@/lib/repositories/use-campaigns";
import {
  createDefaultClientHomeConfig,
  defaultClientHomeSections,
  useClientHomeConfig
} from "@/lib/repositories/use-client-home-config";
import { useClientSettings } from "@/lib/repositories/use-client-settings";
import { usePlannerItems } from "@/lib/repositories/use-planner-items";
import { usePosts } from "@/lib/repositories/use-posts";
import { useActivityEvents } from "@/lib/repositories/use-activity-events";
import { useOperationalTasks } from "@/lib/repositories/use-operational-tasks";
import { useWeeklyMetrics } from "@/lib/repositories/use-weekly-metrics";
import { useApprovalsApi } from "@/lib/use-approvals-api";
import { useGoogleAnalytics } from "@/lib/use-google-analytics";
import { cn, currency, formatShortDate, number } from "@/lib/utils";
import { useWorkspaceContext } from "@/lib/workspace-context";
import type { ClientHomeCard, ClientHomeSection, ClientSettings } from "@/types";

type OverviewDraft = {
  averageCheck: string;
  weeklyCovers: string;
  monthlyCovers: string;
  growthTarget: string;
  overviewHeadline: string;
  overviewSummary: string;
  overviewPinnedCampaignId: string;
  overviewFeaturedMetric: ClientSettings["overviewFeaturedMetric"];
  overviewCards: OverviewCardDraft[];
  overviewSections: ClientHomeSection[];
};

type OverviewCardDraft = ClientHomeCard;

const overviewStatePrefix = "__client_home_v1__";

function decodeOverviewSummary(value: string): {
  summary: string;
  cards?: ClientHomeCard[];
} {
  if (!value.startsWith(overviewStatePrefix)) {
    return { summary: value };
  }

  try {
    const parsed = JSON.parse(value.slice(overviewStatePrefix.length)) as {
      summary?: unknown;
      cards?: unknown;
    };

    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      cards: Array.isArray(parsed.cards)
        ? parsed.cards
            .filter((card): card is ClientHomeCard => {
              if (!card || typeof card !== "object") return false;
              const item = card as Partial<ClientHomeCard>;
              return (
                (item.id === "traffic" ||
                  item.id === "covers" ||
                  item.id === "growth" ||
                  item.id === "attention") &&
                typeof item.label === "string" &&
                typeof item.value === "string" &&
                typeof item.detail === "string" &&
                typeof item.href === "string"
              );
            })
            .slice(0, 4)
        : undefined
    };
  } catch {
    return { summary: value.replace(overviewStatePrefix, "") };
  }
}

function encodeOverviewSummary(summary: string, cards: ClientHomeCard[]) {
  return `${overviewStatePrefix}${JSON.stringify({ summary, cards })}`;
}

function toOverviewDraft(
  settings: ClientSettings,
  fallbackCards: OverviewCardDraft[] = [],
  homeConfig?: {
    headline: string;
    note: string;
    cards: ClientHomeCard[];
    sections: ClientHomeSection[];
  }
): OverviewDraft {
  const decodedOverview = decodeOverviewSummary(settings.overviewSummary);
  const resolvedCards =
    homeConfig?.cards.length === 4
      ? homeConfig.cards
      : decodedOverview.cards?.length === 4
        ? decodedOverview.cards
        : fallbackCards;

  return {
    averageCheck: String(settings.averageCheck),
    weeklyCovers: String(settings.weeklyCovers),
    monthlyCovers: String(settings.monthlyCovers),
    growthTarget: String(settings.defaultGrowthTarget),
    overviewHeadline: homeConfig?.headline ?? settings.overviewHeadline,
    overviewSummary: homeConfig?.note ?? decodedOverview.summary,
    overviewPinnedCampaignId: settings.overviewPinnedCampaignId ?? "",
    overviewFeaturedMetric: settings.overviewFeaturedMetric,
    overviewCards: resolvedCards as OverviewCardDraft[],
    overviewSections: homeConfig?.sections ?? defaultClientHomeSections
  };
}

function getGreeting(name: string) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return `${greeting}, ${name}`;
}

function formatToday() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "long",
    day: "2-digit"
  }).format(new Date());
}

function moveSection(
  sections: ClientHomeSection[],
  sectionId: ClientHomeSection["id"],
  direction: "up" | "down"
) {
  const currentIndex = sections.findIndex((section) => section.id === sectionId);
  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sections.length) {
    return sections;
  }

  const nextSections = [...sections];
  const [section] = nextSections.splice(currentIndex, 1);
  nextSections.splice(nextIndex, 0, section);

  return nextSections;
}

export default function DashboardPage() {
  const { activeClient } = useActiveClient();
  const { profile } = useAuth();
  const { workspace } = useWorkspaceContext();
  const { settings, setSettings, revenueModelDefaults } = useClientSettings(activeClient.id);
  const { metrics } = useWeeklyMetrics(activeClient.id);
  const { items } = usePlannerItems(activeClient.id);
  const { posts, updatePost } = usePosts(activeClient.id);
  const { campaigns } = useCampaigns(activeClient.id);
  const { blogPosts } = useBlogPosts(activeClient.id);
  const { assets } = useAssets(activeClient.id);
  const { analyticsSnapshots } = useAnalyticsSnapshots(activeClient.id);
  const { tasks, updateTaskStatus } = useOperationalTasks(workspace.id);
  useActivityEvents(workspace.id);
  const { approvals, ready: approvalsReady, reviewApproval } = useApprovalsApi(activeClient.id);
  const { summary: googleAnalyticsSummary } = useGoogleAnalytics(activeClient.id);
  const [isEditingOverview, setIsEditingOverview] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [queueActioningId, setQueueActioningId] = useState<string | null>(null);
  const [queueConfirmingId, setQueueConfirmingId] = useState<string | null>(null);
  const [nextActionFeedback, setNextActionFeedback] = useState<null | { label: string; detail: string; undo?: () => Promise<void> }>(null);
  const [mobileAttentionExpanded, setMobileAttentionExpanded] = useState(false);
  const [overviewDraft, setOverviewDraft] = useState<OverviewDraft>(() => toOverviewDraft(settings));

  const model = calculateRevenueModel(revenueModelDefaults);
  const currentDateKey = new Date().toISOString().slice(0, 10);
  const scheduledContent = useMemo(() => {
    const postItems = posts
      .filter((post) => post.status === "Scheduled")
      .map((post) => ({
        id: post.id,
        platform: post.platform,
        content: post.content,
        cta: post.cta,
        date: post.publishDate,
        status: post.status,
        sourceType: "post" as const
      }));
    const plannerItems = items
      .filter((item) => item.status === "Scheduled")
      .map((item) => ({
        id: item.id,
        platform: item.platform,
        content: item.caption,
        cta: item.campaignGoal,
        date: item.dayOfWeek,
        status: item.status,
        sourceType: "planner" as const
      }));

    return [...postItems, ...plannerItems].slice(0, 5);
  }, [items, posts]);
  const nextScheduledItem = scheduledContent[0] ?? null;
  const workspaceTasks = tasks.filter((task) => !task.clientId || task.clientId === activeClient.id);
  const openTasks = workspaceTasks
    .filter((task) => task.status !== "Done")
    .sort((left, right) => {
      if (!left.dueDate) return 1;
      if (!right.dueDate) return -1;
      return new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
    });
  const pendingApprovals = approvals.filter((approval) => approval.status === "Pending");
  const overdueWorkspaceTask = openTasks.find(
    (task) => task.dueDate && new Date(task.dueDate) < new Date()
  );
  const blockedWorkspaceTask = openTasks.find(
    (task) => task.status === "Waiting" && task.blockedByTaskIds?.length
  );
  const readyUnscheduledPost = posts.find(
    (post) => post.approvalState === "Approved" && post.status !== "Scheduled"
  );
  const hasExecutionSetup = Boolean(openTasks.length || posts.length || items.length);
  const decodedOverview = useMemo(() => decodeOverviewSummary(settings.overviewSummary), [settings.overviewSummary]);
  const clientFirstName =
    profile?.fullName?.split(" ")[0] ??
    profile?.email?.split("@")[0] ??
    "there";
  const pinnedCampaign =
    campaigns.find((campaign) => campaign.id === settings.overviewPinnedCampaignId) ??
    campaigns.find((campaign) => campaign.status === "Active") ??
    campaigns[0] ??
    null;
  const toastOpportunities = useMemo(
    () => buildToastOpportunitySummary(metrics, settings.averageCheck),
    [metrics, settings.averageCheck]
  );
  const relevantCampaigns = useMemo(
    () =>
      [...campaigns]
        .sort((left, right) => {
          if (left.id === pinnedCampaign?.id) return -1;
          if (right.id === pinnedCampaign?.id) return 1;
          if (left.status === "Active" && right.status !== "Active") return -1;
          if (right.status === "Active" && left.status !== "Active") return 1;
          return right.startDate.localeCompare(left.startDate);
        })
        .slice(0, 4),
    [campaigns, pinnedCampaign?.id]
  );
  const activeHomeCampaigns = useMemo(
    () => {
      const activeCampaigns = campaigns.filter((campaign) => campaign.status === "Active");

      return (activeCampaigns.length ? activeCampaigns : relevantCampaigns).slice(0, 4);
    },
    [campaigns, relevantCampaigns]
  );
  const operatorQueue = useMemo(
    () =>
      buildOperatorQueue({
        campaigns,
        posts,
        approvals,
        jobs: [],
        tasks: openTasks,
        goals: [],
        todayKey: currentDateKey
      }),
    [approvals, campaigns, currentDateKey, openTasks, posts]
  );
  const clientActions = operatorQueue.items.slice(0, 4);
  const hasScheduleGap = hasExecutionSetup && !nextScheduledItem;
  const homeNextAction = useMemo(() => (!hasExecutionSetup
    ? {
        title: "Create the first meaningful step",
        detail: "Start with one campaign task or one content item so this workspace has something concrete to execute.",
        reason: "Nothing can move until the first real execution item exists.",
        impact: "This creates the first task or content step the team can move into review and scheduling next.",
        timeContext: "This week",
        href: "/campaigns" as Route,
        actionLabel: "Add first step"
      }
      : overdueWorkspaceTask
        ? {
            title: "Resolve overdue work",
            detail: "An overdue task is blocking execution. Clear it first so the schedule stays realistic.",
            reason: "Overdue work is the highest-risk item in the system right now.",
            impact: "Clearing it lets the next approval or publish step move again today.",
            timeContext: "Today",
            href: "/approvals#open-tasks" as Route,
            actionLabel: "Fix task"
          }
    : blockedWorkspaceTask
      ? {
          title: "Unblock waiting work",
          detail: `${blockedWorkspaceTask.title} is waiting on another dependency before the campaign can move forward.`,
          reason: "A blocked dependency is holding up downstream work.",
          impact: "Unblocking it moves the stalled task back into progress so the next content or approval step can follow.",
          timeContext: "Today",
          href: "/approvals#open-tasks" as Route,
          actionLabel: "Fix task"
        }
        : pendingApprovals[0]
          ? {
              title: "Review pending approvals",
              detail: `${number(pendingApprovals.length)} approval${pendingApprovals.length === 1 ? "" : "s"} are waiting before content can move forward.`,
              reason: "Content cannot move into scheduling or publishing until approval clears.",
              impact: "Approving now moves the next content item straight into scheduling.",
              timeContext: "Today",
              href: "/approvals" as Route,
              actionLabel: "Review now"
            }
          : hasScheduleGap
            ? {
                title: "Close the schedule gap",
                detail: readyUnscheduledPost
                  ? `${readyUnscheduledPost.goal} is approved, but nothing is scheduled next.`
                  : "The content calendar has no upcoming scheduled item right now.",
                reason: "A visible gap in the schedule weakens campaign momentum.",
                impact: "Filling the gap puts the next live publish on the calendar for the next few days.",
                timeContext: "Next 7 days",
                href: "/calendar" as Route,
                actionLabel: "Schedule next"
              }
          : readyUnscheduledPost
            ? {
                title: "Schedule approved content",
                detail: `${readyUnscheduledPost.goal} is approved and ready for a publish date.`,
                reason: "This item is fully ready and can move immediately.",
                impact: "Scheduling it creates the next live post and clears the ready queue.",
                timeContext: "Next 2 days",
                href: "/calendar" as Route,
                actionLabel: "Schedule now"
              }
            : nextScheduledItem
              ? {
                  title: "Prepare the next scheduled publish",
                  detail: `${nextScheduledItem.platform} is coming up ${nextScheduledItem.date ? `on ${formatShortDate(nextScheduledItem.date)}` : "soon"}.`,
                  reason: "The next scheduled publish is the most immediate live execution point.",
                  impact: "Checking it now keeps the next scheduled post ready instead of slipping at the last minute.",
                  timeContext: nextScheduledItem.date ? formatShortDate(nextScheduledItem.date) : "Coming up",
                  href: "/calendar" as Route,
                  actionLabel: "Check publish"
                }
              : {
                  title: "Add the next execution step",
                  detail: "The workspace is active, but it needs another task or content item to keep momentum moving.",
                  reason: "There is no clear follow-on item lined up after the current work.",
                  impact: "Adding one next step keeps the workflow moving from task to content to scheduling.",
                  timeContext: "This week",
                  href: "/campaigns" as Route,
                  actionLabel: "Add next step"
                }), [blockedWorkspaceTask, hasExecutionSetup, hasScheduleGap, nextScheduledItem, overdueWorkspaceTask, pendingApprovals, readyUnscheduledPost]);

  const defaultHomeCards = useMemo<OverviewCardDraft[]>(() => [
    {
      id: "traffic",
      label: "Website visitors",
      value: number(googleAnalyticsSummary?.sessions ?? 0),
      detail: "Latest synced website sessions from Google Analytics.",
      href: "/web-analytics" as Route
    },
    {
      id: "covers",
      label: "Weekly covers",
      value: number(model.weeklyCovers),
      detail: "Toast-backed weekly covers baseline.",
      href: "/performance#business-snapshot" as Route
    },
    {
      id: "growth",
      label: "Growth target",
      value: `${number(settings.defaultGrowthTarget, 1)}%`,
      detail: "Current growth target for the restaurant.",
      href: "/revenue-modeling" as Route
    },
    {
      id: "attention",
      label: "Needs attention",
      value: number(pendingApprovals.length + openTasks.length),
      detail: "Open approvals and tasks that still need action.",
      href: "/approvals" as Route
    }
  ], [googleAnalyticsSummary?.sessions, model.weeklyCovers, openTasks.length, pendingApprovals.length, settings.defaultGrowthTarget]);

  const fallbackClientHomeConfig = useMemo(
    () =>
      createDefaultClientHomeConfig(activeClient.id, {
        headline: settings.overviewHeadline,
        note: decodedOverview.summary,
        cards: decodedOverview.cards?.length === 4 ? decodedOverview.cards : defaultHomeCards
      }),
    [activeClient.id, decodedOverview.cards, decodedOverview.summary, defaultHomeCards, settings.overviewHeadline]
  );
  const {
    config: clientHomeConfig,
    error: clientHomeConfigError,
    saveConfig: saveClientHomeConfig
  } = useClientHomeConfig(activeClient.id, fallbackClientHomeConfig);
  const clientHomeCards = defaultHomeCards;
  const orderedVisibleSections = useMemo(
    () => clientHomeConfig.sections.filter((section) => section.visible),
    [clientHomeConfig.sections]
  );
  const visibleSectionIds = useMemo(
    () => new Set(orderedVisibleSections.map((section) => section.id)),
    [orderedVisibleSections]
  );
  const getSectionOrder = (sectionId: ClientHomeSection["id"]) => {
    const index = orderedVisibleSections.findIndex((section) => section.id === sectionId);

    return index < 0 ? orderedVisibleSections.length : index;
  };
  const overviewHeadline = clientHomeConfig.headline;
  const overviewSummary = clientHomeConfig.note;
  const mobileOverviewTitle = overviewHeadline || getGreeting(clientFirstName);
  const mobileOverviewSummary =
    overviewSummary || "Home keeps website visitors, weekly covers, growth target, and what needs attention in view automatically.";

  const openOverviewEditor = () => {
    setOverviewDraft(toOverviewDraft(settings, defaultHomeCards, clientHomeConfig));
    setIsEditingOverview(true);
  };

  const saveOverview = () => {
    const nextConfig = {
      ...clientHomeConfig,
      headline: overviewDraft.overviewHeadline.trim(),
      note: overviewDraft.overviewSummary.trim(),
      cards: defaultHomeCards,
      sections: overviewDraft.overviewSections
    };

    saveClientHomeConfig(nextConfig);

    setSettings((current) => ({
      ...current,
      defaultGrowthTarget: Number(overviewDraft.growthTarget) || 0,
      overviewHeadline: nextConfig.headline,
      overviewSummary: encodeOverviewSummary(nextConfig.note, defaultHomeCards),
      overviewPinnedCampaignId: overviewDraft.overviewPinnedCampaignId || undefined,
      overviewFeaturedMetric: current.overviewFeaturedMetric
    }));
    setIsEditingOverview(false);
  };

  const useBestOverviewSuggestions = () => {
    const suggestedSectionOrder: ClientHomeSection["id"][] = [
      "attention",
      "active-campaign",
      "business-read"
    ];
    const seenSectionIds = new Set<ClientHomeSection["id"]>();
    const orderedSectionIds = [
      ...suggestedSectionOrder,
      ...defaultClientHomeSections.map((section) => section.id)
    ].filter((sectionId) => {
      if (seenSectionIds.has(sectionId)) {
        return false;
      }

      seenSectionIds.add(sectionId);
      return true;
    });

    setOverviewDraft((current) => ({
      ...current,
      overviewHeadline: current.overviewHeadline || getGreeting(clientFirstName),
      overviewSummary:
        current.overviewSummary ||
        "Here is what needs attention, what is coming next, and what campaign is driving growth.",
      overviewSections: orderedSectionIds.map((sectionId) => {
        const existing = current.overviewSections.find((section) => section.id === sectionId);

        return {
          id: sectionId,
          label:
            existing?.label ??
            defaultClientHomeSections.find((section) => section.id === sectionId)?.label ??
            sectionId,
          visible:
            sectionId === "attention" ||
            sectionId === "active-campaign" ||
            sectionId === "business-read"
        };
      })
    }));
  };

  const handleReview = useCallback(async (approvalId: string, status: "Approved" | "Changes Requested") => {
    setReviewingId(approvalId);

    try {
      await reviewApproval(approvalId, {
        status,
        note: status === "Approved" ? "Approved from the client home dashboard." : "Requested changes from the client home dashboard.",
        approverName: profile?.fullName ?? profile?.email ?? "Client"
      });
      setNextActionFeedback(
        status === "Approved"
          ? {
              label: "Approval cleared.",
              detail: "That item can move into scheduling next."
            }
          : {
              label: "Changes requested.",
              detail: "The content stays in review until the updates are made."
            }
      );
    } finally {
      setReviewingId(null);
    }
  }, [profile?.email, profile?.fullName, reviewApproval]);

  const handleQueuePrimaryAction = useCallback(async (action: (typeof clientActions)[number]) => {
    setQueueActioningId(action.id);

    try {
      if (action.entityType === "task") {
        const linkedTask = tasks.find((task) => task.id === action.entityId);
        await updateTaskStatus(action.entityId, "Done");
        if (linkedTask && isQueueUndoable(action)) {
          setNextActionFeedback({
            label: "Task marked done.",
            detail: "The next priority can move up in Today.",
            undo: async () => {
              await updateTaskStatus(action.entityId, linkedTask.status);
            }
          });
        }
        return;
      }

      if (action.entityType === "post" && action.tone === "schedule") {
        const linkedPost = posts.find((post) => post.id === action.entityId);

        if (!linkedPost) {
          return;
        }

        await updatePost(action.entityId, {
          ...linkedPost,
          publishDate: linkedPost.publishDate || currentDateKey,
          status: "Scheduled",
          approvalState: linkedPost.approvalState ?? "Approved"
        });
        if (isQueueUndoable(action)) {
          setNextActionFeedback({
            label: `Scheduled for ${formatShortDate(linkedPost.publishDate || currentDateKey)}.`,
            detail: "The calendar now has a live next step.",
            undo: async () => {
              await updatePost(action.entityId, {
                ...linkedPost
              });
            }
          });
        }
      }
    } finally {
      setQueueActioningId(null);
    }
  }, [currentDateKey, posts, tasks, updatePost, updateTaskStatus]);

  const handleQueueSecondaryAction = useCallback(async (action: (typeof clientActions)[number]) => {
    if (action.entityType !== "approval") {
      return;
    }

    if (queueConfirmingId !== action.id) {
      setQueueConfirmingId(action.id);
      return;
    }

    setQueueConfirmingId(null);
    await handleReview(action.entityId, "Changes Requested");
  }, [handleReview, queueConfirmingId]);

  const handleUndoLastQueueAction = useCallback(async () => {
    if (!nextActionFeedback?.undo) {
      return;
    }

    const undoAction = nextActionFeedback.undo;
    setNextActionFeedback(null);
    await undoAction();
    setNextActionFeedback({
      label: "Change undone.",
      detail: "The item is back in its previous state."
    });
  }, [nextActionFeedback]);

  return (
    <div className="grid gap-6 sm:gap-8">
      <section className="-mx-4 -mt-4 rounded-b-[1.75rem] bg-[#202124] px-4 pb-5 pt-6 text-white shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white/70">{formatToday()}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">{mobileOverviewTitle}</h1>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/50">{mobileOverviewSummary}</p>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-[1rem] border border-white/10 bg-white/[0.04] px-3 py-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Home setup</p>
                <p className="mt-1 text-sm text-white/70">Adjust what Home shows first.</p>
              </div>
              <button
                className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#202124] shadow-sm"
                type="button"
                onClick={isEditingOverview ? () => setIsEditingOverview(false) : openOverviewEditor}
                aria-label="Customize client home"
              >
                {isEditingOverview ? "Close" : "Customize"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#1b1c1f]">
          {clientHomeCards.map((card, index) => (
            <Link
              className={cn(
                "flex items-center justify-between gap-4 px-4 py-3",
                index ? "border-t border-white/10" : ""
              )}
              href={card.href as Route}
              key={card.id}
            >
              <span className="min-w-0">
                <span className="block truncate text-base font-semibold text-white">{card.label}</span>
                <span className="mt-0.5 block truncate text-xs text-white/45">{card.detail}</span>
              </span>
              <span className="shrink-0 text-right text-lg font-semibold tracking-[-0.03em] text-white">{card.value}</span>
            </Link>
          ))}
        </div>

        <div className="mt-3">
          <NextActionPanel
            actionHref={homeNextAction.href}
            actionLabel={homeNextAction.actionLabel}
            detail={homeNextAction.detail}
            feedback={null}
            impact={homeNextAction.impact}
            label="Next action"
            reason={homeNextAction.reason}
            timeContext={homeNextAction.timeContext}
            title={homeNextAction.title}
            tone="dark"
          />
        </div>

        {nextActionFeedback ? (
          <div className="mt-3 rounded-[1.1rem] border border-white/10 bg-white/[0.04] px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-white/82">{nextActionFeedback.label}</p>
                <p className="mt-1 text-sm text-white/58">{nextActionFeedback.detail}</p>
              </div>
              {nextActionFeedback.undo ? (
                <button
                  className="shrink-0 rounded-full border border-white/12 px-3 py-1.5 text-xs font-semibold text-white"
                  type="button"
                  onClick={() => void handleUndoLastQueueAction()}
                >
                  Undo
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {visibleSectionIds.has("attention") ? (
          <div className="mt-3 rounded-[1.35rem] border border-white/10 bg-[#1b1c1f] p-4">
            <button
              className="flex w-full items-center justify-between text-left"
              type="button"
              onClick={() => setMobileAttentionExpanded((current) => !current)}
            >
              <span>
                <span className="block text-sm text-white/45">Today</span>
                <span className="mt-1 block text-base font-semibold tracking-[-0.03em]">
                  {clientActions.length ? `${clientActions.length} item${clientActions.length === 1 ? "" : "s"} need attention` : "Nothing needs attention"}
                </span>
              </span>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">
                {mobileAttentionExpanded ? "Close" : "Expand"}
              </span>
            </button>
            {mobileAttentionExpanded ? (
              <div className="mt-5 space-y-4 border-t border-white/10 pt-4">
                {clientActions.length ? (
                  clientActions.map((action) => (
                    <OperatorQueueCard
                      className="px-0 py-0 border-0 bg-transparent"
                      eyebrow={getQueueToneLabel(action)}
                      item={action}
                      key={action.id}
                      primaryAction={
                        action.tone === "review"
                          ? {
                              label: getQueuePrimaryActionLabel(action),
                              disabled: reviewingId === action.entityId,
                              onClick: () => void handleReview(action.entityId, "Approved"),
                            }
                          : action.entityType === "task" || (action.entityType === "post" && action.tone === "schedule")
                            ? {
                                label: getQueuePrimaryActionLabel(action),
                                disabled: queueActioningId === action.id,
                                onClick: () => void handleQueuePrimaryAction(action),
                              }
                            : null
                      }
                      secondaryAction={
                        action.tone === "review"
                          ? {
                              label: queueConfirmingId === action.id ? "Confirm" : (getQueueSecondaryActionLabel(action) ?? "Request changes"),
                              disabled: reviewingId === action.entityId,
                              emphasis: queueConfirmingId === action.id ? "default" : "subtle",
                              onClick: () => void handleQueueSecondaryAction(action),
                            }
                          : null
                      }
                      theme="dark"
                    />
                  ))
                ) : (
                  <div className="flex items-center gap-4 text-white/65">
                    <CheckCircle2 className="h-9 w-9 text-[var(--app-accent-bg)]" />
                    <p className="text-base">Nothing needs approval right now.</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

      </section>

      <div className="hidden items-start justify-between gap-6 sm:flex">
        <PageHeader
          eyebrow="Client Home"
          title={overviewHeadline || `${activeClient.name} home`}
          description={
            overviewSummary ||
            "A calmer client-facing view of what needs review, what is going out next, and how the restaurant is tracking."
          }
        />
        <Button className="shrink-0" variant="outline" onClick={isEditingOverview ? () => setIsEditingOverview(false) : openOverviewEditor}>
          <Pencil className="mr-2 h-4 w-4" />
          {isEditingOverview ? "Close" : "Customize"}
        </Button>
      </div>

      {isEditingOverview ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/55 p-0 sm:items-center sm:justify-center sm:p-6">
          <Card className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-b-none p-0 shadow-2xl sm:max-w-5xl sm:rounded-[1.5rem]">
            <CardHeader className="sticky top-0 z-10 border-b border-border/70 bg-card px-5 pb-4 pt-5 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardDescription>Client Home Settings</CardDescription>
                  <CardTitle className="mt-3">Edit Home</CardTitle>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    This changes Home on both mobile and desktop. Set the headline, note, growth target, and decide which core sections stay visible.
                  </p>
                  {clientHomeConfigError ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Saving locally right now. Run the client home SQL to sync this across devices.
                    </p>
                  ) : null}
                </div>
                <Button type="button" variant="ghost" onClick={() => setIsEditingOverview(false)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <div className="grid flex-1 gap-6 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="rounded-[1.25rem] border border-primary/25 bg-[var(--app-accent-soft)] p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Sparkles className="h-4 w-4 text-[var(--app-accent-bg)]" />
                    Home highlights update automatically
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    The top of Home now always shows website visitors, weekly covers, growth target, and what needs attention. You only need to set the message and the growth target.
                  </p>
                </div>
                <Button className="shrink-0" type="button" variant="outline" onClick={useBestOverviewSuggestions}>
                  Use a cleaner layout
                </Button>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4">
                <div>
                  <Label>Home headline</Label>
                  <Input value={overviewDraft.overviewHeadline} onChange={(event) => setOverviewDraft((current) => ({ ...current, overviewHeadline: event.target.value }))} placeholder="Example: Here is what matters most this week." />
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    This is the main line shown first on Home. Keep it short, clear, and operator-friendly.
                  </p>
                </div>
                <div>
                  <Label>Home note</Label>
                  <Textarea value={overviewDraft.overviewSummary} onChange={(event) => setOverviewDraft((current) => ({ ...current, overviewSummary: event.target.value }))} placeholder="Example: Reviews are clear, Tuesday still needs help, and brunch traffic is strongest from Facebook." />
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Use this for a plain-English read of the week, not internal notes or setup instructions.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Growth target %</Label>
                  <Input value={overviewDraft.growthTarget} type="number" step="0.01" onChange={(event) => setOverviewDraft((current) => ({ ...current, growthTarget: event.target.value }))} />
                </div>
                <div>
                <Label>Pinned Campaign</Label>
                <Select
                  value={overviewDraft.overviewPinnedCampaignId}
                  onChange={(value) => setOverviewDraft((current) => ({ ...current, overviewPinnedCampaignId: value }))}
                  options={[
                    { label: "No pinned campaign", value: "" },
                    ...campaigns.map((campaign) => ({ label: campaign.name, value: campaign.id }))
                  ]}
                />
                </div>
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-border/70 bg-card/55 p-4">
              <p className="text-sm font-medium text-foreground">Home sections</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Keep Home focused. These are the only operating sections below the top metrics.
              </p>
              <div className="mt-4 space-y-2">
                {overviewDraft.overviewSections.map((section, index) => (
                  <div
                    className={cn(
                      "flex flex-col gap-3 rounded-2xl border px-4 py-3 text-sm transition sm:flex-row sm:items-center sm:justify-between",
                      section.visible
                        ? "border-primary/40 bg-[var(--app-accent-soft)] text-foreground"
                        : "border-border/70 bg-background/60 text-muted-foreground"
                    )}
                    key={section.id}
                  >
                    <div className="flex flex-1 items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium">{section.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {section.visible ? "Visible on Home" : "Hidden from Home"}
                        </p>
                      </div>
                      <button
                      aria-pressed={section.visible}
                      className={cn(
                        "relative h-7 w-12 shrink-0 rounded-full border transition",
                        section.visible
                          ? "border-primary/50 bg-primary/80"
                          : "border-border bg-muted"
                      )}
                      type="button"
                      onClick={() =>
                        setOverviewDraft((current) => ({
                          ...current,
                          overviewSections: current.overviewSections.map((item) =>
                            item.id === section.id ? { ...item, visible: !item.visible } : item
                          )
                        }))
                      }
                    >
                        <span
                          className={cn(
                            "absolute top-1 h-5 w-5 rounded-full bg-background shadow-sm transition",
                            section.visible ? "left-6" : "left-1"
                          )}
                        />
                    </button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        aria-label={`Move ${section.label} up`}
                        className="h-8 flex-1 sm:flex-none"
                        disabled={index === 0}
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setOverviewDraft((current) => ({
                            ...current,
                            overviewSections: moveSection(current.overviewSections, section.id, "up")
                          }))
                        }
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        aria-label={`Move ${section.label} down`}
                        className="h-8 flex-1 sm:flex-none"
                        disabled={index === overviewDraft.overviewSections.length - 1}
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setOverviewDraft((current) => ({
                            ...current,
                            overviewSections: moveSection(current.overviewSections, section.id, "down")
                          }))
                        }
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </div>
            <div className="sticky bottom-0 z-10 flex justify-end gap-3 border-t border-border/70 bg-card px-5 py-4 sm:px-6">
              <Button variant="outline" onClick={() => setOverviewDraft(toOverviewDraft(settings, defaultHomeCards, clientHomeConfig))}>
                Reset
              </Button>
              <Button onClick={saveOverview}>Save and update Home</Button>
            </div>
          </Card>
        </div>
      ) : null}

      <motion.div animate={{ opacity: 1, y: 0 }} className="hidden gap-4 sm:grid md:grid-cols-2 xl:grid-cols-4" initial={{ opacity: 0, y: 12 }}>
        {clientHomeCards.map((card) => (
          <Link href={card.href as Route} key={card.id}>
            <Card className="h-full p-5">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="mt-3 truncate font-display text-4xl text-foreground">{card.value}</p>
              <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">{card.detail}</p>
            </Card>
          </Link>
        ))}
      </motion.div>

      <div className="hidden sm:block">
        <NextActionPanel
          actionHref={homeNextAction.href}
          actionLabel={homeNextAction.actionLabel}
          detail={homeNextAction.detail}
          feedback={null}
          impact={homeNextAction.impact}
          label="Next Action"
          reason={homeNextAction.reason}
          timeContext={homeNextAction.timeContext}
          title={homeNextAction.title}
          tone="light"
        />
      </div>

      {nextActionFeedback ? (
        <Card className="hidden sm:block">
          <div className="flex items-center justify-between gap-4 px-6 py-4">
            <div>
              <p className="text-sm font-medium text-foreground">{nextActionFeedback.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{nextActionFeedback.detail}</p>
            </div>
            {nextActionFeedback.undo ? (
              <Button size="sm" variant="outline" onClick={() => void handleUndoLastQueueAction()}>
                Undo
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {visibleSectionIds.has("attention") || visibleSectionIds.has("active-campaign") ? (
        <div
          className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]"
          style={{ order: Math.min(getSectionOrder("attention"), getSectionOrder("active-campaign")) }}
        >
          {visibleSectionIds.has("attention") ? (
            <Card id="today" style={{ order: getSectionOrder("attention") }}>
              <CardHeader>
                <div>
                  <CardDescription>Today</CardDescription>
                  <CardTitle className="mt-3">What needs attention first</CardTitle>
                </div>
                <Link className="hidden items-center gap-1 text-sm font-medium text-primary sm:flex" href="/approvals">
                  Open tasks <ChevronRight className="h-4 w-4" />
                </Link>
              </CardHeader>
              <div className="space-y-3">
                {clientActions.length ? (
                  clientActions.map((action) => (
                    <OperatorQueueCard
                      eyebrow={getQueueToneLabel(action)}
                      item={action}
                      key={action.id}
                      primaryAction={
                        action.tone === "review"
                          ? {
                              label: getQueuePrimaryActionLabel(action),
                              disabled: reviewingId === action.entityId,
                              onClick: () => void handleReview(action.entityId, "Approved"),
                            }
                          : action.entityType === "task" || (action.entityType === "post" && action.tone === "schedule")
                            ? {
                                label: getQueuePrimaryActionLabel(action),
                                disabled: queueActioningId === action.id,
                                onClick: () => void handleQueuePrimaryAction(action),
                              }
                            : null
                      }
                      secondaryAction={
                        action.tone === "review"
                          ? {
                              label:
                                queueConfirmingId === action.id
                                  ? "Confirm changes"
                                  : (getQueueSecondaryActionLabel(action) ?? "Request changes"),
                              disabled: reviewingId === action.entityId,
                              emphasis: queueConfirmingId === action.id ? "default" : "subtle",
                              onClick: () => void handleQueueSecondaryAction(action),
                            }
                          : null
                      }
                      statusBadge={getQueueToneLabel(action)}
                      theme="light"
                    />
                  ))
                ) : (
                  <EmptyState
                    title={approvalsReady ? "Nothing urgent right now" : "Loading today"}
                    description={approvalsReady ? "New approvals, scheduled posts, and open tasks will show up here when something needs attention." : "Checking what needs attention today."}
                  />
                )}
              </div>
            </Card>
          ) : null}

          {visibleSectionIds.has("active-campaign") ? (
            <Card id="active-campaign" style={{ order: getSectionOrder("active-campaign") }}>
              <CardHeader>
                <div>
                  <CardDescription>Campaigns</CardDescription>
                  <CardTitle className="mt-3">Active campaigns</CardTitle>
                </div>
              </CardHeader>
              {activeHomeCampaigns.length ? (
                <div className="space-y-3">
                  <div className="rounded-3xl border border-border/70 bg-[var(--app-accent-soft)]/50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">Biggest opportunity right now</p>
                        <p className="mt-1 line-clamp-3 text-sm leading-6 text-muted-foreground">
                          {toastOpportunities.recommendation}
                        </p>
                      </div>
                      <Link
                        className="shrink-0 text-sm font-medium text-primary"
                        href={"/performance#opportunity-flags" as Route}
                      >
                        Open
                      </Link>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-background/70 px-3 py-1 text-xs text-foreground">
                        Softest night: {toastOpportunities.weakestDay.day}
                      </span>
                      <span className="rounded-full bg-background/70 px-3 py-1 text-xs text-foreground">
                        Website visitors: {number(googleAnalyticsSummary?.sessions ?? 0)}
                      </span>
                      <span className="rounded-full bg-background/70 px-3 py-1 text-xs text-foreground">
                        Weekly change: {toastOpportunities.weekOverWeekRevenueChange >= 0 ? "+" : ""}
                        {currency(toastOpportunities.weekOverWeekRevenueChange)}
                      </span>
                    </div>
                  </div>
                  {activeHomeCampaigns.map((campaign) => {
                    const campaignOverview = getCampaignOverview(campaign, posts, blogPosts, assets, metrics, analyticsSnapshots);
                    const nextCampaignPost = [...campaignOverview.linkedPosts]
                      .filter((post) => post.status === "Scheduled" && Boolean(post.publishDate))
                      .sort((left, right) => left.publishDate.localeCompare(right.publishDate))[0];
                    const campaignHealth =
                      nextCampaignPost
                        ? "On Track"
                        : campaignOverview.linkedPosts.length > 0
                        ? "Needs Attention"
                        : "At Risk";

                    return (
                      <Link
                        className="block rounded-3xl border border-border/70 bg-card/60 p-4 transition hover:border-primary/35 hover:bg-primary/5"
                        href={`/campaigns/${campaign.id}` as Route}
                        key={`home-active-${campaign.id}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{campaign.name}</p>
                            <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                              {campaign.objective || "No objective added yet."}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span className="rounded-full bg-muted/60 px-2.5 py-1">{campaign.status}</span>
                              <span className="rounded-full bg-muted/60 px-2.5 py-1">{campaignHealth}</span>
                              <span className="rounded-full bg-muted/60 px-2.5 py-1">
                                {nextCampaignPost ? `Next publish ${formatShortDate(nextCampaignPost.publishDate)}` : "No publish scheduled"}
                              </span>
                              <span className="rounded-full bg-muted/60 px-2.5 py-1">
                                {number(campaignOverview.linkedPosts.length)} posts
                              </span>
                            </div>
                          </div>
                          <span className="shrink-0 text-sm font-medium text-primary">Open</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <EmptyState title="No active campaigns" description="Create or activate a campaign to show it here." />
              )}
            </Card>
          ) : null}
        </div>
      ) : null}

      {visibleSectionIds.has("business-read") ? (
        <Card className="hidden sm:block" style={{ order: getSectionOrder("business-read") }}>
          <CardHeader>
            <div>
              <CardDescription>Business Read</CardDescription>
              <CardTitle className="mt-3">Biggest opportunity</CardTitle>
            </div>
            <Link className="hidden items-center gap-1 text-sm font-medium text-primary sm:flex" href="/performance#opportunity-flags">
              Open performance <ChevronRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-3xl border border-border/70 bg-card/60 p-4">
              <p className="font-medium text-foreground">What the numbers are saying</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{toastOpportunities.recommendation}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-muted/60 px-2.5 py-1">
                  Softest night: {toastOpportunities.weakestDay.day}
                </span>
                <span className="rounded-full bg-muted/60 px-2.5 py-1">
                  Weekly visitors: {number(googleAnalyticsSummary?.sessions ?? 0)}
                </span>
                <span className="rounded-full bg-muted/60 px-2.5 py-1">
                  Growth target: {number(settings.defaultGrowthTarget, 1)}%
                </span>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
              {toastOpportunities.flags.slice(0, 3).map((flag) => (
                <div className="rounded-3xl border border-border/70 bg-card/60 p-4" key={flag.id}>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{flag.title}</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{flag.value}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{flag.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      {visibleSectionIds.has("business-read") ? (
        <Card className="sm:hidden" style={{ order: getSectionOrder("business-read") }}>
          <CardHeader>
            <div>
              <CardDescription>Business Read</CardDescription>
              <CardTitle className="mt-3">Biggest opportunity</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            <div className="rounded-3xl border border-border/70 bg-card/60 p-4">
              <p className="text-sm leading-6 text-muted-foreground">{toastOpportunities.recommendation}</p>
            </div>
            {toastOpportunities.flags.slice(0, 2).map((flag) => (
              <div className="rounded-3xl border border-border/70 bg-card/60 p-4" key={flag.id}>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{flag.title}</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{flag.value}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{flag.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
