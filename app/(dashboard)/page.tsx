"use client";

import { useMemo, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  MessageSquare,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePill } from "@/components/ui/date-pill";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { useActiveClient } from "@/lib/client-context";
import { calculateRevenueModel } from "@/lib/calculations";
import { getCampaignOverview } from "@/lib/domain/campaigns";
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
import { useManualMetaPerformance } from "@/lib/use-manual-meta-performance";
import { useMetaBusinessSuite } from "@/lib/use-meta-business-suite";
import { cn, currency, number } from "@/lib/utils";
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

type ClientAction = {
  id: string;
  title: string;
  detail: string;
  href: Route;
  tone: "review" | "schedule" | "task";
  date?: string;
};

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
                (item.id === "primary" || item.id === "review" || item.id === "publish") &&
                typeof item.label === "string" &&
                typeof item.value === "string" &&
                typeof item.detail === "string" &&
                typeof item.href === "string"
              );
            })
            .slice(0, 3)
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
    homeConfig?.cards.length === 3
      ? homeConfig.cards
      : decodedOverview.cards?.length === 3
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
  const { items, deleteItem } = usePlannerItems(activeClient.id);
  const { posts, deletePost } = usePosts(activeClient.id);
  const { campaigns } = useCampaigns(activeClient.id);
  const { blogPosts } = useBlogPosts(activeClient.id);
  const { assets } = useAssets(activeClient.id);
  const { analyticsSnapshots } = useAnalyticsSnapshots(activeClient.id);
  const { tasks } = useOperationalTasks(workspace.id);
  const { events } = useActivityEvents(workspace.id);
  const { approvals, ready: approvalsReady, reviewApproval, deleteApproval } = useApprovalsApi(activeClient.id);
  const { summary: metaSummary } = useMetaBusinessSuite(activeClient.id);
  const { enabledChannels: manualMetaChannels } = useManualMetaPerformance(activeClient.id);
  const [isEditingOverview, setIsEditingOverview] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mobileAttentionExpanded, setMobileAttentionExpanded] = useState(false);
  const [overviewDraft, setOverviewDraft] = useState<OverviewDraft>(() => toOverviewDraft(settings));

  const model = calculateRevenueModel(revenueModelDefaults);
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
  const workspaceTasks = tasks.filter((task) => !task.clientId || task.clientId === activeClient.id);
  const openTasks = workspaceTasks
    .filter((task) => task.status !== "Done")
    .sort((left, right) => {
      if (!left.dueDate) return 1;
      if (!right.dueDate) return -1;
      return new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
    });
  const recentActivity = events.filter((item) => !item.clientId || item.clientId === activeClient.id).slice(0, 3);
  const pendingApprovals = approvals.filter((approval) => approval.status === "Pending");
  const nextScheduledItem = scheduledContent[0] ?? null;
  const nextTask = openTasks[0] ?? null;
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
  const leadCampaign = pinnedCampaign
    ? getCampaignOverview(pinnedCampaign, posts, blogPosts, assets, metrics, analyticsSnapshots)
    : null;
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
  const connectedFacebook = metaSummary?.channels.find(
    (channel) => channel.provider === "facebook" && channel.authStatus === "connected"
  );
  const manualFacebook = manualMetaChannels.find((channel) => channel.provider === "facebook");
  const homeFacebookSummary = connectedFacebook
    ? {
        label: connectedFacebook.accountLabel || "Facebook",
        impressions: connectedFacebook.impressions,
        clicks: connectedFacebook.clicks,
        engagement: connectedFacebook.conversions,
        periodLabel: connectedFacebook.latestPeriodLabel,
        syncedAt: connectedFacebook.lastSyncAt
      }
    : manualFacebook
      ? {
          label: manualFacebook.accountLabel || "Facebook",
          impressions: manualFacebook.impressions,
          clicks: manualFacebook.clicks,
          engagement: manualFacebook.engagement,
          periodLabel: manualFacebook.periodLabel,
          syncedAt: undefined
        }
      : null;

  const clientActions = useMemo<ClientAction[]>(() => {
    const actions: ClientAction[] = [];

    if (pendingApprovals[0]) {
      actions.push({
        id: pendingApprovals[0].id,
        title: pendingApprovals[0].summary,
        detail: pendingApprovals[0].note ?? "Waiting on approval before this can move forward.",
        href: "/approvals",
        tone: "review"
      });
    }

    if (nextScheduledItem) {
      actions.push({
        id: nextScheduledItem.id,
        title: nextScheduledItem.content,
        detail: nextScheduledItem.platform,
        href: "/calendar",
        tone: "schedule",
        date: nextScheduledItem.date
      });
    }

    if (nextTask) {
      actions.push({
        id: nextTask.id,
        title: nextTask.title,
        detail: nextTask.status,
        href: "/approvals#open-tasks",
        tone: "task",
        date: nextTask.dueDate
      });
    }

    return actions.slice(0, 4);
  }, [nextScheduledItem, nextTask, pendingApprovals]);

  const featuredMetric = useMemo(() => {
    switch (settings.overviewFeaturedMetric) {
      case "weekly-revenue":
        return {
          label: "Weekly Revenue",
          value: currency(model.weeklyRevenue),
          href: "/performance#business-snapshot" as Route
        };
      case "tracked-revenue":
        return {
          label: "Tracked Revenue",
          value: currency(analyticsSnapshots.reduce((total, snapshot) => total + snapshot.attributedRevenue, 0)),
          href: "/performance#campaign-impact" as Route
        };
      case "open-tasks":
        return {
          label: "Open Items",
          value: number(openTasks.length),
          href: "/approvals#open-tasks" as Route
        };
      case "weekly-covers":
      default:
        return {
          label: "Weekly Covers",
          value: number(model.weeklyCovers),
          href: "/performance#business-snapshot" as Route
        };
    }
  }, [analyticsSnapshots, model.weeklyCovers, model.weeklyRevenue, openTasks.length, settings.overviewFeaturedMetric]);

  const defaultHomeCards = useMemo<OverviewCardDraft[]>(() => [
    {
      id: "primary",
      label: featuredMetric.label,
      value: featuredMetric.value,
      detail: "The one number to keep in view this week.",
      href: featuredMetric.href
    },
    {
      id: "review",
      label: "Waiting on Review",
      value: approvalsReady ? number(pendingApprovals.length) : "...",
      detail: "Content or requests that need a client decision.",
      href: "/approvals" as Route
    },
    {
      id: "publish",
      label: "Next Publish",
      value: nextScheduledItem ? nextScheduledItem.platform : "None",
      detail: nextScheduledItem?.content ?? "No scheduled content is on the calendar yet.",
      href: "/calendar" as Route
    }
  ], [approvalsReady, featuredMetric, nextScheduledItem, pendingApprovals.length]);

  const fallbackClientHomeConfig = useMemo(
    () =>
      createDefaultClientHomeConfig(activeClient.id, {
        headline: settings.overviewHeadline,
        note: decodedOverview.summary,
        cards: decodedOverview.cards?.length === 3 ? decodedOverview.cards : defaultHomeCards
      }),
    [activeClient.id, decodedOverview.cards, decodedOverview.summary, defaultHomeCards, settings.overviewHeadline]
  );
  const {
    config: clientHomeConfig,
    error: clientHomeConfigError,
    saveConfig: saveClientHomeConfig
  } = useClientHomeConfig(activeClient.id, fallbackClientHomeConfig);
  const clientHomeCards = clientHomeConfig.cards.length === 3 ? clientHomeConfig.cards : defaultHomeCards;
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
    overviewSummary || "Use Customize to control the headline, note, and the three client-home rows.";

  const openOverviewEditor = () => {
    setOverviewDraft(toOverviewDraft(settings, defaultHomeCards, clientHomeConfig));
    setIsEditingOverview(true);
  };

  const saveOverview = () => {
    const nextConfig = {
      ...clientHomeConfig,
      headline: overviewDraft.overviewHeadline.trim(),
      note: overviewDraft.overviewSummary.trim(),
      cards: overviewDraft.overviewCards,
      sections: overviewDraft.overviewSections
    };

    saveClientHomeConfig(nextConfig);

    setSettings((current) => ({
      ...current,
      averageCheck: Number(overviewDraft.averageCheck) || 0,
      weeklyCovers: Math.round(Number(overviewDraft.weeklyCovers) || 0),
      monthlyCovers: Math.round(Number(overviewDraft.monthlyCovers) || 0),
      defaultGrowthTarget: Number(overviewDraft.growthTarget) || 0,
      overviewHeadline: nextConfig.headline,
      overviewSummary: encodeOverviewSummary(nextConfig.note, nextConfig.cards),
      overviewPinnedCampaignId: overviewDraft.overviewPinnedCampaignId || undefined,
      overviewFeaturedMetric: overviewDraft.overviewFeaturedMetric
    }));
    setIsEditingOverview(false);
  };

  const useBestOverviewSuggestions = () => {
    const suggestedCards: OverviewCardDraft[] = [
      pendingApprovals.length
        ? {
            id: "review",
            label: "Needs review",
            value: number(pendingApprovals.length),
            detail: "Items waiting on a decision before the work can move forward.",
            href: "/approvals"
          }
        : {
            id: "review",
            label: "Review queue",
            value: "Clear",
            detail: "No approvals are waiting right now.",
            href: "/approvals"
          },
      nextScheduledItem
        ? {
            id: "publish",
            label: "Next publish",
            value: nextScheduledItem.platform,
            detail: nextScheduledItem.content,
            href: "/calendar"
          }
        : {
            id: "publish",
            label: "Next publish",
            value: "None",
            detail: "No scheduled content is on the calendar yet.",
            href: "/calendar"
          },
      {
        id: "primary",
        label: leadCampaign ? "Current campaign" : featuredMetric.label,
        value: leadCampaign ? leadCampaign.campaign.name : featuredMetric.value,
        detail: leadCampaign
          ? leadCampaign.campaign.objective || "Pinned campaign for this client home."
          : "The best live metric to keep in view this week.",
        href: leadCampaign ? `/campaigns/${leadCampaign.campaign.id}` : featuredMetric.href
      }
    ];
    const suggestedSectionOrder: ClientHomeSection["id"][] = [
      "attention",
      pendingApprovals.length ? "review" : "active-campaign",
      nextScheduledItem ? "upcoming-content" : "active-campaign",
      "recent-activity",
      pendingApprovals.length ? "active-campaign" : "review"
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
      overviewCards: suggestedCards,
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
            (sectionId === "review" && pendingApprovals.length > 0) ||
            (sectionId === "upcoming-content" && Boolean(nextScheduledItem)) ||
            (sectionId === "recent-activity" && recentActivity.length > 0)
        };
      })
    }));
  };

  const handleReview = async (approvalId: string, status: "Approved" | "Changes Requested") => {
    setReviewingId(approvalId);

    try {
      await reviewApproval(approvalId, {
        status,
        note: status === "Approved" ? "Approved from the client home dashboard." : "Requested changes from the client home dashboard.",
        approverName: profile?.fullName ?? profile?.email ?? "Client"
      });
    } finally {
      setReviewingId(null);
    }
  };

  const handleDeleteApproval = async (approvalId: string) => {
    setDeletingId(approvalId);

    try {
      await deleteApproval(approvalId);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteScheduledContent = async (item: (typeof scheduledContent)[number]) => {
    setDeletingId(`${item.sourceType}-${item.id}`);

    try {
      if (item.sourceType === "post") {
        await deletePost(item.id);
      } else {
        await deleteItem(item.id);
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="grid gap-6 sm:gap-8">
      <section className="-mx-4 -mt-4 rounded-b-[1.75rem] bg-[#202124] px-4 pb-5 pt-6 text-white shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:hidden">
        <div className="flex items-start justify-between">
          <div className="min-w-0 pr-4">
            <p className="text-sm font-semibold text-white/70">{formatToday()}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">{mobileOverviewTitle}</h1>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/50">{mobileOverviewSummary}</p>
          </div>
          <button
            className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70"
            type="button"
            onClick={isEditingOverview ? () => setIsEditingOverview(false) : openOverviewEditor}
            aria-label="Customize client home"
          >
            {isEditingOverview ? "Close" : "Customize"}
          </button>
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
                    <div className="flex items-start gap-4" key={action.id}>
                      <Link
                        className="flex min-w-0 flex-1 items-start gap-4"
                        href={action.href}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
                            action.tone === "review" ? "border-[var(--app-accent-bg)] text-[var(--app-accent-bg)]" : "border-white/25 text-white/60"
                          )}
                        >
                          {action.tone === "review" ? <MessageSquare className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-base font-semibold">{action.title}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-2 text-sm leading-5 text-white/55">
                            <span>{action.detail}</span>
                            {action.date ? (
                              <DatePill className="border-white/15 bg-white/10 text-white/75" value={action.date} />
                            ) : null}
                          </span>
                        </span>
                      </Link>
                      {action.tone === "review" ? (
                        <button
                          aria-label="Delete approval"
                          className="rounded-full border border-white/10 p-2 text-white/45"
                          disabled={deletingId === action.id}
                          type="button"
                          onClick={() => void handleDeleteApproval(action.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
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
        <div className="fixed inset-0 z-50 flex items-end bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6">
          <Card className="max-h-[88vh] w-full overflow-y-auto rounded-b-none p-5 shadow-2xl sm:max-w-5xl sm:rounded-[1.5rem]">
            <CardHeader className="px-0 pt-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardDescription>Client Home Settings</CardDescription>
                  <CardTitle className="mt-3">Edit Home</CardTitle>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    This changes the Overview/Home page on both mobile and desktop. Use it to choose the headline, top rows, section order, and what should be hidden.
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
            <div className="grid gap-6">
            <div className="rounded-[1.25rem] border border-primary/25 bg-[var(--app-accent-soft)] p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Sparkles className="h-4 w-4 text-[var(--app-accent-bg)]" />
                    Best suggestions
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Let the app pick the most useful Home setup from current approvals, scheduled content, active campaigns, and recent work.
                  </p>
                </div>
                <Button className="shrink-0" type="button" variant="outline" onClick={useBestOverviewSuggestions}>
                  Use suggestions
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <Label>Average Check</Label>
                <Input value={overviewDraft.averageCheck} type="number" step="0.01" onChange={(event) => setOverviewDraft((current) => ({ ...current, averageCheck: event.target.value }))} />
              </div>
              <div>
                <Label>Weekly Covers</Label>
                <Input value={overviewDraft.weeklyCovers} type="number" step="0.01" onChange={(event) => setOverviewDraft((current) => ({ ...current, weeklyCovers: event.target.value }))} />
              </div>
              <div>
                <Label>Monthly Covers</Label>
                <Input value={overviewDraft.monthlyCovers} type="number" step="0.01" onChange={(event) => setOverviewDraft((current) => ({ ...current, monthlyCovers: event.target.value }))} />
              </div>
              <div>
                <Label>Growth Target %</Label>
                <Input value={overviewDraft.growthTarget} type="number" step="0.01" onChange={(event) => setOverviewDraft((current) => ({ ...current, growthTarget: event.target.value }))} />
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4">
                <div>
                  <Label>Headline</Label>
                  <Input value={overviewDraft.overviewHeadline} onChange={(event) => setOverviewDraft((current) => ({ ...current, overviewHeadline: event.target.value }))} placeholder="Set the headline you want at the top of the client home." />
                </div>
                <div>
                  <Label>Client Note</Label>
                  <Textarea value={overviewDraft.overviewSummary} onChange={(event) => setOverviewDraft((current) => ({ ...current, overviewSummary: event.target.value }))} placeholder="Add the context you want the client to see first." />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Featured Metric</Label>
                  <Select
                    value={overviewDraft.overviewFeaturedMetric}
                    onChange={(value) =>
                      setOverviewDraft((current) => ({
                        ...current,
                        overviewFeaturedMetric: value as OverviewDraft["overviewFeaturedMetric"]
                      }))
                    }
                    options={[
                      { label: "Weekly Covers", value: "weekly-covers" },
                      { label: "Weekly Revenue", value: "weekly-revenue" },
                      { label: "Tracked Revenue", value: "tracked-revenue" },
                      { label: "Open Items", value: "open-tasks" }
                    ]}
                  />
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
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Top Home rows</p>
                  <p className="mt-1 text-sm text-muted-foreground">These are the three compact rows shown first on mobile and the three summary cards shown first on desktop.</p>
                </div>
                <Button
                  onClick={() =>
                    setOverviewDraft((current) => ({
                      ...current,
                      overviewCards: defaultHomeCards
                    }))
                  }
                  type="button"
                  variant="outline"
                >
                  Use live defaults
                </Button>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                {overviewDraft.overviewCards.map((card, index) => (
                  <div className="rounded-[1rem] border border-border/70 bg-background/60 p-4" key={card.id}>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Card {index + 1}</p>
                    <div className="mt-4 space-y-3">
                      <div>
                        <Label>Label</Label>
                        <Input
                          value={card.label}
                          onChange={(event) =>
                            setOverviewDraft((current) => ({
                              ...current,
                              overviewCards: current.overviewCards.map((item) =>
                                item.id === card.id ? { ...item, label: event.target.value } : item
                              )
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label>Value</Label>
                        <Input
                          value={card.value}
                          onChange={(event) =>
                            setOverviewDraft((current) => ({
                              ...current,
                              overviewCards: current.overviewCards.map((item) =>
                                item.id === card.id ? { ...item, value: event.target.value } : item
                              )
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label>Detail</Label>
                        <Textarea
                          className="min-h-24"
                          value={card.detail}
                          onChange={(event) =>
                            setOverviewDraft((current) => ({
                              ...current,
                              overviewCards: current.overviewCards.map((item) =>
                                item.id === card.id ? { ...item, detail: event.target.value } : item
                              )
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-border/70 bg-card/55 p-4">
              <p className="text-sm font-medium text-foreground">Home sections</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Turn sections on or off, then move the most important ones higher. Hidden sections are removed from Home until you turn them back on.
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

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setOverviewDraft(toOverviewDraft(settings, defaultHomeCards, clientHomeConfig))}>
                Reset
              </Button>
              <Button onClick={saveOverview}>Save and update Home</Button>
            </div>
            </div>
          </Card>
        </div>
      ) : null}

      <motion.div animate={{ opacity: 1, y: 0 }} className="hidden gap-4 sm:grid md:grid-cols-3" initial={{ opacity: 0, y: 12 }}>
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

      {visibleSectionIds.has("review") || visibleSectionIds.has("active-campaign") ? (
        <div
          className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]"
          style={{ order: Math.min(getSectionOrder("review"), getSectionOrder("active-campaign")) }}
        >
          {visibleSectionIds.has("review") ? (
            <Card id="client-review" style={{ order: getSectionOrder("review") }}>
              <CardHeader>
                <div>
                  <CardDescription>Client Review</CardDescription>
                  <CardTitle className="mt-3">What needs a decision</CardTitle>
                </div>
                <Link className="hidden items-center gap-1 text-sm font-medium text-primary sm:flex" href="/approvals">
                  Open inbox <ChevronRight className="h-4 w-4" />
                </Link>
              </CardHeader>
              <div className="space-y-3">
                {pendingApprovals.length ? (
                  pendingApprovals.slice(0, 3).map((approval) => (
                    <div className="rounded-3xl border border-border/70 bg-card/60 p-4" key={approval.id}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-foreground">{approval.summary}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{approval.note ?? `Requested by ${approval.requesterName}`}</p>
                        </div>
                        <p className="shrink-0 rounded-full bg-[var(--app-accent-soft)] px-3 py-1 text-xs font-medium text-[var(--app-accent-bg)]">
                          Review
                        </p>
                      </div>
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <Button
                          className="sm:w-auto"
                          disabled={reviewingId === approval.id}
                          onClick={() => void handleReview(approval.id, "Approved")}
                        >
                          Approve
                        </Button>
                        <Button
                          className="sm:w-auto"
                          disabled={reviewingId === approval.id}
                          variant="outline"
                          onClick={() => void handleReview(approval.id, "Changes Requested")}
                        >
                          Request changes
                        </Button>
                        <Button
                          className="sm:w-auto"
                          disabled={deletingId === approval.id}
                          variant="ghost"
                          onClick={() => void handleDeleteApproval(approval.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title={approvalsReady ? "Nothing waiting on you" : "Loading reviews"}
                    description={approvalsReady ? "Approvals and requested changes will show up here when content needs a decision." : "Checking the client review inbox."}
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
                  <div className="rounded-3xl border border-border/70 bg-card/60 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">Most relevant right now</p>
                        <p className="mt-1 line-clamp-3 text-sm leading-6 text-muted-foreground">
                          {toastOpportunities.recommendation}
                        </p>
                      </div>
                      <Link
                        className="shrink-0 text-sm font-medium text-primary"
                        href={"/performance#business-snapshot" as Route}
                      >
                        Open
                      </Link>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      {toastOpportunities.flags.map((flag) => (
                        <div className="rounded-2xl bg-muted/50 px-3 py-3" key={flag.id}>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                            {flag.title}
                          </p>
                          <p className="mt-2 text-lg font-semibold text-foreground">{flag.value}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{flag.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {homeFacebookSummary ? (
                    <div className="rounded-3xl border border-border/70 bg-[var(--app-accent-soft)]/55 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">Facebook snapshot</p>
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                            {homeFacebookSummary.label}
                            {homeFacebookSummary.periodLabel ? ` · ${homeFacebookSummary.periodLabel}` : ""}
                          </p>
                        </div>
                        <Link
                          className="shrink-0 text-sm font-medium text-primary"
                          href={"/performance#meta-business-suite" as Route}
                        >
                          Open
                        </Link>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <div className="rounded-2xl bg-background/70 px-3 py-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Impressions</p>
                          <p className="mt-2 text-lg font-semibold text-foreground">{number(homeFacebookSummary.impressions)}</p>
                        </div>
                        <div className="rounded-2xl bg-background/70 px-3 py-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Clicks</p>
                          <p className="mt-2 text-lg font-semibold text-foreground">{number(homeFacebookSummary.clicks)}</p>
                        </div>
                        <div className="rounded-2xl bg-background/70 px-3 py-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Engagement</p>
                          <p className="mt-2 text-lg font-semibold text-foreground">{number(homeFacebookSummary.engagement)}</p>
                        </div>
                      </div>
                      {homeFacebookSummary.syncedAt ? (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Synced {new Date(homeFacebookSummary.syncedAt).toLocaleDateString()}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {activeHomeCampaigns.map((campaign) => {
                    const campaignOverview = getCampaignOverview(campaign, posts, blogPosts, assets, metrics, analyticsSnapshots);

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
                          </div>
                          <span className="shrink-0 rounded-full bg-[var(--app-accent-soft)] px-3 py-1 text-xs font-medium text-[var(--app-accent-bg)]">
                            {campaign.status}
                          </span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="rounded-full bg-muted/60 px-2.5 py-1">{number(campaignOverview.linkedPosts.length)} posts</span>
                          <span className="rounded-full bg-muted/60 px-2.5 py-1">{currency(campaignOverview.attributedRevenue)} revenue</span>
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

      {visibleSectionIds.has("upcoming-content") ? (
      <div style={{ order: getSectionOrder("upcoming-content") }}>
        <Card id="upcoming-content">
          <CardHeader>
            <div>
              <CardDescription>This Week</CardDescription>
              <CardTitle className="mt-3">Upcoming content</CardTitle>
            </div>
            <Link className="hidden items-center gap-1 text-sm font-medium text-primary sm:flex" href="/calendar">
              Calendar <ChevronRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <div className="space-y-3">
            {scheduledContent.length ? (
              scheduledContent.slice(0, 4).map((item) => (
                <div
                  className="grid gap-3 rounded-3xl border border-border/70 bg-card/60 p-4 transition hover:border-primary/40 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                  key={item.id}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--app-accent-soft)] text-[var(--app-accent-bg)]">
                    <CalendarDays className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{item.content}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{item.platform} · {item.cta}</span>
                  </span>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock3 className="h-4 w-4" />
                    <DatePill value={item.date} />
                  </span>
                  <div className="flex gap-2 sm:col-span-3 sm:justify-end">
                    <Link className="text-sm font-medium text-primary" href="/content">
                      Open content
                    </Link>
                    <button
                      className="text-sm font-medium text-muted-foreground hover:text-destructive"
                      disabled={deletingId === `${item.sourceType}-${item.id}`}
                      type="button"
                      onClick={() => void handleDeleteScheduledContent(item)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="No content scheduled" description="Scheduled posts will show up here once the campaign calendar is populated." />
            )}
          </div>
        </Card>
      </div>
      ) : null}

      {visibleSectionIds.has("recent-activity") && recentActivity.length ? (
        <Card className="hidden sm:block" style={{ order: getSectionOrder("recent-activity") }}>
          <CardHeader>
            <div>
              <CardDescription>Recent Updates</CardDescription>
              <CardTitle className="mt-3">Small changes since the last check-in</CardTitle>
            </div>
          </CardHeader>
          <div className="grid gap-3 md:grid-cols-3">
            {recentActivity.map((item) => (
              <div className="rounded-3xl border border-border/70 bg-card/60 p-4" key={item.id}>
                <p className="font-medium text-foreground">{item.subjectName}</p>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.detail}</p>
                <p className="mt-4 text-xs uppercase tracking-[0.16em] text-primary">
                  {item.actorName} {item.actionLabel}
                </p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
