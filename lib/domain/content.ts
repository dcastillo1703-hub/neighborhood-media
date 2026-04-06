import { PlannerItem, Post } from "@/types";

export function buildScheduledContent(posts: Post[], plannerItems: PlannerItem[]) {
  return posts
    .filter((post) => post.status === "Scheduled")
    .map((post) => ({
      id: post.id,
      platform: post.platform,
      content: post.content,
      cta: post.cta,
      date: post.publishDate,
      status: post.status
    }))
    .concat(
      plannerItems
        .filter((item) => item.status === "Scheduled")
        .map((item) => ({
          id: item.id,
          platform: item.platform,
          content: item.caption,
          cta: item.campaignGoal,
          date: item.dayOfWeek,
          status: item.status
        }))
    );
}

export function getPlannerItemsForDay(items: PlannerItem[], day: string) {
  return items.filter((item) => item.dayOfWeek === day);
}

export function getScheduledPosts(posts: Post[]) {
  return posts
    .filter((post) => post.status === "Scheduled")
    .sort((a, b) => a.publishDate.localeCompare(b.publishDate));
}
