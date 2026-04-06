import {
  AnalyticsSnapshot,
  Asset,
  BlogPost,
  Campaign,
  Post,
  WeeklyMetric
} from "@/types";

export function getCampaignOverview(
  campaign: Campaign,
  posts: Post[],
  blogs: BlogPost[],
  assets: Asset[],
  metrics: WeeklyMetric[],
  analytics: AnalyticsSnapshot[]
) {
  const linkedPosts = posts.filter(
    (post) => post.campaignId === campaign.id || campaign.linkedPostIds.includes(post.id)
  );
  const linkedBlogs = blogs.filter(
    (blog) => blog.campaignId === campaign.id || campaign.linkedBlogPostIds.includes(blog.id)
  );
  const linkedAssets = assets.filter(
    (asset) =>
      asset.linkedCampaignIds.includes(campaign.id) || campaign.linkedAssetIds.includes(asset.id)
  );
  const linkedMetrics = metrics.filter(
    (metric) =>
      metric.campaignId === campaign.id || campaign.linkedWeeklyMetricIds.includes(metric.id)
  );
  const linkedAnalytics = analytics.filter((snapshot) => snapshot.linkedCampaignId === campaign.id);

  const attributedRevenue = linkedAnalytics.reduce((sum, item) => sum + item.attributedRevenue, 0);
  const attributedCovers = linkedAnalytics.reduce((sum, item) => sum + item.attributedCovers, 0);
  const attributedTables = linkedAnalytics.reduce((sum, item) => sum + item.attributedTables, 0);

  return {
    campaign,
    linkedPosts,
    linkedBlogs,
    linkedAssets,
    linkedMetrics,
    linkedAnalytics,
    attributedRevenue,
    attributedCovers,
    attributedTables
  };
}

export function summarizeCampaigns(
  campaigns: Campaign[],
  posts: Post[],
  blogs: BlogPost[],
  assets: Asset[],
  metrics: WeeklyMetric[],
  analytics: AnalyticsSnapshot[]
) {
  return campaigns.map((campaign) =>
    getCampaignOverview(campaign, posts, blogs, assets, metrics, analytics)
  );
}
