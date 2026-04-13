export type DemoTask = {
  id: string;
  campaignId: string;
  title: string;
  description: string;
  type: "Content" | "Meeting" | "General";
  assignee: string;
  priority: "Low" | "Medium" | "High";
  status: "Backlog" | "In Progress" | "Waiting" | "Done";
  startDate?: string;
  dueDate?: string;
  milestone?: boolean;
  blockedBy?: string[];
};

export type DemoContent = {
  id: string;
  campaignId: string;
  linkedTaskId?: string;
  title: string;
  platform: "Instagram" | "Facebook" | "Email";
  format: "Static" | "Carousel" | "Reel" | "Email";
  caption: string;
  assetState: "Missing" | "In Progress" | "Ready";
  approvalState: "None" | "Pending" | "Approved" | "Changes Requested";
  publishState: "Draft" | "Ready" | "Scheduled" | "Published";
  publishDate?: string;
  destinationUrl?: string;
};

export type DemoApproval = {
  id: string;
  contentId: string;
  campaignId: string;
  status: "Pending" | "Approved" | "Changes Requested";
  requester: string;
  waitingOn: string;
  comment: string;
};

export type DemoCampaign = {
  id: string;
  name: string;
  objective: string;
  status: "Planning" | "Active" | "Completed";
  startDate: string;
  endDate: string;
  goal: string;
  attributedRevenue: number;
  attributedCovers: number;
};

export type DemoAnalytics = {
  sessions: number;
  users: number;
  views: number;
  topSource: string;
  topLandingPage: string;
  reservationClicks: number;
  orderClicks: number;
  callClicks: number;
  menuViews: number;
};

export type DemoRevenueModel = {
  weeklyCovers: number;
  monthlyRevenue: number;
  weeklyRevenue: number;
  growthTarget: number;
  softestNight: string;
  strongestNight: string;
};

export const demoWorkspace = {
  label: "Demo Mode",
  restaurantName: "Meama NYC",
  summary: "Public demo workspace. Explore campaigns, approvals, scheduling, analytics, and revenue signals without signing in.",
  nextAction: "Review the Midtown lunch campaign approval, then schedule the ready Instagram post into Thursday.",
  topMetrics: [
    { id: "visitors", label: "Website visitors", value: "2,480", detail: "Last 30 days" },
    { id: "covers", label: "Weekly covers", value: "412", detail: "Toast-backed" },
    { id: "growth", label: "Growth target", value: "12%", detail: "Current target" },
    { id: "attention", label: "Needs attention", value: "6", detail: "Tasks + approvals" }
  ],
  campaigns: [
    {
      id: "cmp-brunch",
      name: "Brunch Rollout",
      objective: "Grow Saturday and Sunday brunch covers with better reservation intent.",
      status: "Active",
      startDate: "2026-04-07",
      endDate: "2026-04-28",
      goal: "Increase brunch covers by 12%",
      attributedRevenue: 8600,
      attributedCovers: 96
    },
    {
      id: "cmp-lunch",
      name: "Midtown Lunch Push",
      objective: "Fill weekday lunch traffic from nearby offices and Google search intent.",
      status: "Active",
      startDate: "2026-04-10",
      endDate: "2026-05-02",
      goal: "Lift Tuesday and Wednesday lunch by 18 covers",
      attributedRevenue: 5100,
      attributedCovers: 62
    },
    {
      id: "cmp-wine",
      name: "Wine Night Relaunch",
      objective: "Bring back Thursday dinner demand with a reservation-first wine offer.",
      status: "Planning",
      startDate: "2026-04-15",
      endDate: "2026-05-08",
      goal: "Increase Thursday dinner covers by 10%",
      attributedRevenue: 0,
      attributedCovers: 0
    }
  ] satisfies DemoCampaign[],
  tasks: [
    {
      id: "task-1",
      campaignId: "cmp-brunch",
      title: "Finalize brunch landing page hero",
      description: "Update hero headline, reservation CTA, and Sunday section.",
      type: "Content",
      assignee: "Diego",
      priority: "High",
      status: "In Progress",
      startDate: "2026-04-11",
      dueDate: "2026-04-14"
    },
    {
      id: "task-2",
      campaignId: "cmp-brunch",
      title: "Owner sign-off on brunch reel",
      description: "Need approval before scheduling the teaser reel.",
      type: "General",
      assignee: "Client",
      priority: "High",
      status: "Waiting",
      dueDate: "2026-04-13",
      blockedBy: ["task-1"]
    },
    {
      id: "task-3",
      campaignId: "cmp-lunch",
      title: "Shoot lunch combo carousel",
      description: "Capture updated lunch plates and two office-order moments.",
      type: "Content",
      assignee: "Marco",
      priority: "Medium",
      status: "Backlog",
      startDate: "2026-04-14",
      dueDate: "2026-04-16"
    },
    {
      id: "task-4",
      campaignId: "cmp-lunch",
      title: "Launch Midtown lunch offer",
      description: "Campaign milestone tied to first scheduled Facebook + Instagram drop.",
      type: "General",
      assignee: "Diego",
      priority: "High",
      status: "Backlog",
      dueDate: "2026-04-17",
      milestone: true
    },
    {
      id: "task-5",
      campaignId: "cmp-wine",
      title: "Confirm wine partner lineup",
      description: "Need vendor confirmation before creative is ready.",
      type: "Meeting",
      assignee: "Anya",
      priority: "Medium",
      status: "In Progress",
      startDate: "2026-04-15",
      dueDate: "2026-04-18"
    },
    {
      id: "task-6",
      campaignId: "cmp-wine",
      title: "Finalize Thursday reservation CTA",
      description: "Currently overdue and blocking the teaser email.",
      type: "General",
      assignee: "Diego",
      priority: "High",
      status: "In Progress",
      dueDate: "2026-04-12"
    }
  ] satisfies DemoTask[],
  content: [
    {
      id: "post-1",
      campaignId: "cmp-brunch",
      linkedTaskId: "task-1",
      title: "Sunday brunch reel",
      platform: "Instagram",
      format: "Reel",
      caption: "Brunch is back this weekend. Reserve now for the first pours and soft ricotta toast.",
      assetState: "Ready",
      approvalState: "Pending",
      publishState: "Ready",
      publishDate: "2026-04-16",
      destinationUrl: "/brunch"
    },
    {
      id: "post-2",
      campaignId: "cmp-brunch",
      title: "Weekend brunch email",
      platform: "Email",
      format: "Email",
      caption: "Subject: Your weekend brunch table is waiting.",
      assetState: "In Progress",
      approvalState: "None",
      publishState: "Draft",
      destinationUrl: "/reserve"
    },
    {
      id: "post-3",
      campaignId: "cmp-lunch",
      linkedTaskId: "task-3",
      title: "Lunch combo carousel",
      platform: "Instagram",
      format: "Carousel",
      caption: "Three weekday lunch combos designed for a faster Midtown break.",
      assetState: "Ready",
      approvalState: "Approved",
      publishState: "Scheduled",
      publishDate: "2026-04-17",
      destinationUrl: "/lunch"
    },
    {
      id: "post-4",
      campaignId: "cmp-lunch",
      title: "Office lunch reminder",
      platform: "Facebook",
      format: "Static",
      caption: "Midtown lunch starts at noon with a quicker reservation flow.",
      assetState: "Ready",
      approvalState: "Approved",
      publishState: "Ready",
      destinationUrl: "/lunch"
    },
    {
      id: "post-5",
      campaignId: "cmp-wine",
      title: "Wine night teaser",
      platform: "Instagram",
      format: "Static",
      caption: "",
      assetState: "Missing",
      approvalState: "None",
      publishState: "Draft",
      destinationUrl: "/wine-night"
    }
  ] satisfies DemoContent[],
  approvals: [
    {
      id: "apr-1",
      contentId: "post-1",
      campaignId: "cmp-brunch",
      status: "Pending",
      requester: "Diego",
      waitingOn: "Client",
      comment: "Need sign-off on reel caption before Thursday scheduling."
    }
  ] satisfies DemoApproval[],
  analytics: {
    sessions: 2480,
    users: 1896,
    views: 5124,
    topSource: "google / organic",
    topLandingPage: "/brunch",
    reservationClicks: 164,
    orderClicks: 41,
    callClicks: 23,
    menuViews: 392
  } satisfies DemoAnalytics,
  revenueModel: {
    weeklyCovers: 412,
    monthlyRevenue: 74200,
    weeklyRevenue: 17100,
    growthTarget: 12,
    softestNight: "Tuesday dinner",
    strongestNight: "Saturday brunch"
  } satisfies DemoRevenueModel
};

