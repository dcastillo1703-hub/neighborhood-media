import type {
  ApprovalRequest,
  Campaign,
  CampaignGoal,
  OperationalTask,
  Post,
  PublishJob
} from "@/types";

export type OperatorQueueSection = "today" | "waiting" | "upcoming" | "unscheduled";
export type OperatorQueueTone = "review" | "schedule" | "task" | "publishing" | "goal" | "content";

export type OperatorQueueItem = {
  id: string;
  title: string;
  detail: string;
  status: string;
  tone: OperatorQueueTone;
  href: string;
  campaignId?: string;
  campaignName?: string;
  dateKey?: string;
  section: OperatorQueueSection;
  sortValue: number;
};

type OperatorQueueInput = {
  campaigns: Campaign[];
  posts: Post[];
  approvals: ApprovalRequest[];
  jobs: PublishJob[];
  tasks: OperationalTask[];
  goals: CampaignGoal[];
  todayKey?: string;
};

const farFutureDate = "9999-12-31";

function toSortValue(section: OperatorQueueSection, dateKey?: string, offset = 0) {
  const sectionOrder =
    section === "today" ? 0 : section === "waiting" ? 1 : section === "upcoming" ? 2 : 3;
  const dateOrder = (dateKey ?? farFutureDate).replaceAll("-", "");
  return Number(`${sectionOrder}${dateOrder}`) + offset;
}

export function buildOperatorQueue({
  campaigns,
  posts,
  approvals,
  jobs,
  tasks,
  goals,
  todayKey = new Date().toISOString().slice(0, 10)
}: OperatorQueueInput) {
  const campaignNameById = new Map(campaigns.map((campaign) => [campaign.id, campaign.name]));
  const postById = new Map(posts.map((post) => [post.id, post]));

  const queueItems: OperatorQueueItem[] = [];

  approvals
    .filter((approval) => approval.status === "Pending")
    .forEach((approval, index) => {
      const linkedPost = postById.get(approval.entityId);
      const dateKey = linkedPost?.publishDate;
      queueItems.push({
        id: `approval-${approval.id}`,
        title: approval.summary,
        detail: approval.note ?? "Waiting on approval before content can move forward.",
        status: approval.status,
        tone: "review",
        href: linkedPost?.campaignId ? `/campaigns/${linkedPost.campaignId}?view=list` : "/approvals",
        campaignId: linkedPost?.campaignId,
        campaignName: linkedPost?.campaignId ? campaignNameById.get(linkedPost.campaignId) : undefined,
        dateKey,
        section: "waiting",
        sortValue: toSortValue("waiting", dateKey, index)
      });
    });

  tasks
    .filter((task) => task.status !== "Done")
    .forEach((task, index) => {
      const isBlocked = task.status === "Waiting" && Boolean(task.blockedByTaskIds?.length);
      const isOverdue = Boolean(task.dueDate && task.dueDate < todayKey);
      const dateKey = task.dueDate || task.startDate;
      const section: OperatorQueueSection = isBlocked
        ? "waiting"
        : isOverdue || dateKey === todayKey
          ? "today"
          : dateKey && dateKey > todayKey
            ? "upcoming"
            : "unscheduled";

      queueItems.push({
        id: `task-${task.id}`,
        title: task.title,
        detail: task.detail || "Campaign-linked task.",
        status: isBlocked ? "Blocked" : isOverdue ? "Overdue" : task.status,
        tone: "task",
        href:
          task.linkedEntityType === "campaign" && task.linkedEntityId
            ? `/campaigns/${task.linkedEntityId}?view=list`
            : "/operations",
        campaignId: task.linkedEntityType === "campaign" ? task.linkedEntityId : undefined,
        campaignName:
          task.linkedEntityType === "campaign" && task.linkedEntityId
            ? campaignNameById.get(task.linkedEntityId)
            : undefined,
        dateKey,
        section,
        sortValue: toSortValue(section, dateKey, index)
      });
    });

  posts
    .filter((post) => Boolean(post.campaignId))
    .forEach((post, index) => {
      const isApprovedReady = post.approvalState === "Approved" && post.status !== "Scheduled";
      const isScheduled = post.status === "Scheduled";
      const section: OperatorQueueSection = isApprovedReady
        ? "unscheduled"
        : isScheduled && post.publishDate === todayKey
          ? "today"
          : isScheduled && post.publishDate && post.publishDate > todayKey
            ? "upcoming"
            : "unscheduled";

      if (isApprovedReady || isScheduled) {
        queueItems.push({
          id: `post-${post.id}`,
          title: post.goal,
          detail: post.content || `${post.platform} content`,
          status: isApprovedReady ? "Approved" : post.status,
          tone: isApprovedReady ? "schedule" : "content",
          href: post.campaignId ? `/campaigns/${post.campaignId}?view=${isApprovedReady ? "calendar" : "overview"}` : "/content",
          campaignId: post.campaignId,
          campaignName: post.campaignId ? campaignNameById.get(post.campaignId) : undefined,
          dateKey: post.publishDate,
          section,
          sortValue: toSortValue(section, post.publishDate, index)
        });
      }
    });

  jobs
    .filter((job) => ["Queued", "Processing", "Blocked"].includes(job.status))
    .forEach((job, index) => {
      const linkedPost = postById.get(job.postId);
      const dateKey = job.scheduledFor?.split("T")[0];
      queueItems.push({
        id: `job-${job.id}`,
        title: `${job.provider} publish job`,
        detail: job.detail,
        status: job.status,
        tone: "publishing",
        href: linkedPost?.campaignId ? `/campaigns/${linkedPost.campaignId}?view=calendar` : "/content",
        campaignId: linkedPost?.campaignId,
        campaignName: linkedPost?.campaignId ? campaignNameById.get(linkedPost.campaignId) : undefined,
        dateKey,
        section: dateKey === todayKey ? "today" : "waiting",
        sortValue: toSortValue(dateKey === todayKey ? "today" : "waiting", dateKey, index)
      });
    });

  goals
    .filter((goal) => !goal.done)
    .forEach((goal, index) => {
      const dateKey = goal.dueDate;
      const section: OperatorQueueSection =
        dateKey === todayKey ? "today" : dateKey && dateKey > todayKey ? "upcoming" : "unscheduled";

      queueItems.push({
        id: `goal-${goal.id}`,
        title: goal.label,
        detail: goal.assigneeName ? `Assigned to ${goal.assigneeName}` : "Campaign checkpoint.",
        status: "Open",
        tone: "goal",
        href: `/campaigns/${goal.campaignId}?view=overview`,
        campaignId: goal.campaignId,
        campaignName: campaignNameById.get(goal.campaignId),
        dateKey,
        section,
        sortValue: toSortValue(section, dateKey, index)
      });
    });

  const sortedItems = queueItems.sort((left, right) => left.sortValue - right.sortValue);

  return {
    items: sortedItems,
    today: sortedItems.filter((item) => item.section === "today"),
    waiting: sortedItems.filter((item) => item.section === "waiting"),
    upcoming: sortedItems.filter((item) => item.section === "upcoming"),
    unscheduled: sortedItems.filter((item) => item.section === "unscheduled")
  };
}
