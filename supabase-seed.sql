-- Run this after supabase-init.sql
-- This seeds the demo workspace and records the UI expects.

insert into workspaces (id, name, slug, plan, seat_count)
values ('ws-neighborhood', 'Neighborhood Media', 'neighborhood-media', 'Agency', 12)
on conflict (id) do update
set name = excluded.name,
    slug = excluded.slug,
    plan = excluded.plan,
    seat_count = excluded.seat_count;

insert into clients (id, workspace_id, name, segment, location, status)
values
  ('client-meama', 'ws-neighborhood', 'Meama', 'Restaurant', 'Chicago, IL', 'Active'),
  ('client-luma', 'ws-neighborhood', 'Luma House', 'Restaurant', 'Austin, TX', 'Pipeline')
on conflict (id) do update
set workspace_id = excluded.workspace_id,
    name = excluded.name,
    segment = excluded.segment,
    location = excluded.location,
    status = excluded.status;

insert into client_settings (
  id, client_id, average_check, monthly_covers, weekly_covers,
  days_open_per_week, weeks_per_month, guests_per_table, default_growth_target
)
values
  ('settings-meama', 'client-meama', 45, 1166, 151.625, 7, 4.33, 2.5, 10),
  ('settings-luma', 'client-luma', 38, 360, 83, 6, 4.33, 2.2, 8)
on conflict (id) do update
set client_id = excluded.client_id,
    average_check = excluded.average_check,
    monthly_covers = excluded.monthly_covers,
    weekly_covers = excluded.weekly_covers,
    days_open_per_week = excluded.days_open_per_week,
    weeks_per_month = excluded.weeks_per_month,
    guests_per_table = excluded.guests_per_table,
    default_growth_target = excluded.default_growth_target;

insert into campaigns (
  id, client_id, name, objective, start_date, end_date, channels, notes, status
)
values
  (
    'ca-1',
    'client-meama',
    'Midweek Pasta Push',
    'Increase Midweek Covers',
    '2026-03-10',
    '2026-03-31',
    array['Instagram', 'Email', 'Reservation System'],
    'Built to prove slower-night demand generation with Tuesday and Wednesday offers.',
    'Active'
  ),
  (
    'ca-2',
    'client-meama',
    'Spring Chef Tasting',
    'Promote Seasonal Menu',
    '2026-04-01',
    '2026-04-20',
    array['Instagram', 'Google Business Profile', 'Website Blog'],
    'Campaign shell for the next menu launch and local discovery push.',
    'Planning'
  )
on conflict (id) do update
set client_id = excluded.client_id,
    name = excluded.name,
    objective = excluded.objective,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    channels = excluded.channels,
    notes = excluded.notes,
    status = excluded.status;

insert into weekly_metrics (
  id, client_id, week_label, covers, notes, campaign_attribution, campaign_id, created_at
)
values
  ('wm-1', 'client-meama', 'Jan 6', 86, 'Snow week but strong Friday close.', 'Winter prix fixe', null, '2026-01-12T10:00:00.000Z'),
  ('wm-2', 'client-meama', 'Jan 13', 93, null, 'Happy hour reels', null, '2026-01-19T10:00:00.000Z'),
  ('wm-3', 'client-meama', 'Jan 20', 98, 'Thursday uplift after paid boost.', 'Date-night carousel', null, '2026-01-26T10:00:00.000Z'),
  ('wm-4', 'client-meama', 'Jan 27', 101, null, 'Chef feature story', null, '2026-02-02T10:00:00.000Z'),
  ('wm-5', 'client-meama', 'Feb 3', 95, null, 'Slow-night wine pairing', 'ca-1', '2026-02-09T10:00:00.000Z'),
  ('wm-6', 'client-meama', 'Feb 10', 108, 'Best Tuesday in 8 weeks.', 'Valentine bookings', 'ca-1', '2026-02-16T10:00:00.000Z')
on conflict (id) do update
set client_id = excluded.client_id,
    week_label = excluded.week_label,
    covers = excluded.covers,
    notes = excluded.notes,
    campaign_attribution = excluded.campaign_attribution,
    campaign_id = excluded.campaign_id,
    created_at = excluded.created_at;

insert into assets (id, client_id, name, asset_type, status, url, created_at)
values
  ('as-1', 'client-meama', 'Pasta Pour Hero', 'Video', 'Ready', '/demo-assets/pasta-pour.mp4', '2026-03-04T11:00:00.000Z'),
  ('as-2', 'client-meama', 'Wine Pairing Table Shot', 'Photo', 'Ready', '/demo-assets/wine-pairing.jpg', '2026-03-04T11:05:00.000Z'),
  ('as-3', 'client-meama', 'Chef Tasting Menu Graphic', 'Graphic', 'Needs Review', '/demo-assets/chef-tasting.png', '2026-03-05T10:00:00.000Z')
on conflict (id) do update
set client_id = excluded.client_id,
    name = excluded.name,
    asset_type = excluded.asset_type,
    status = excluded.status,
    url = excluded.url,
    created_at = excluded.created_at;

insert into blog_posts (
  id, client_id, title, slug, summary, publish_date, status, campaign_id, created_at
)
values
  ('bl-1', 'client-meama', 'How Meama Turns Tuesdays Into a Neighborhood Ritual', 'meama-tuesday-neighborhood-ritual', 'A campaign-ready story angle about slower-night hospitality and local habit building.', '2026-03-18', 'Ready', 'ca-1', '2026-03-08T13:30:00.000Z'),
  ('bl-2', 'client-meama', 'Spring Chef Tasting Preview', 'spring-chef-tasting-preview', 'Scaffolded blog draft for the next menu launch.', null, 'Draft', 'ca-2', '2026-03-09T09:00:00.000Z')
on conflict (id) do update
set client_id = excluded.client_id,
    title = excluded.title,
    slug = excluded.slug,
    summary = excluded.summary,
    publish_date = excluded.publish_date,
    status = excluded.status,
    campaign_id = excluded.campaign_id,
    created_at = excluded.created_at;

insert into posts (
  id, client_id, platform, content, cta, publish_date, goal,
  status, planner_item_id, campaign_id, created_at
)
values
  ('po-1', 'client-meama', 'Instagram', 'Monday is your quiet advantage. Join us tomorrow for a cozy pasta night with a complimentary sommelier pairing on the first 12 tables.', 'Reserve for Tuesday night', '2026-03-10', 'Increase Tuesday covers', 'Scheduled', null, 'ca-1', '2026-03-08T13:00:00.000Z'),
  ('po-2', 'client-meama', 'Email', 'Neighborhood regulars get first access to our chef’s spring tasting preview this Thursday.', 'Book your table', '2026-03-12', 'Fill Thursday early seatings', 'Draft', null, 'ca-1', '2026-03-08T13:15:00.000Z'),
  ('po-3', 'client-meama', 'Facebook', 'Friday starts here. Book your weekend table and let the dining room do the rest.', 'Reserve for Friday night', '2026-03-13', 'Drive Friday reservations', 'Scheduled', null, 'ca-2', '2026-03-08T13:20:00.000Z')
on conflict (id) do update
set client_id = excluded.client_id,
    platform = excluded.platform,
    content = excluded.content,
    cta = excluded.cta,
    publish_date = excluded.publish_date,
    goal = excluded.goal,
    status = excluded.status,
    planner_item_id = excluded.planner_item_id,
    campaign_id = excluded.campaign_id,
    created_at = excluded.created_at;

insert into planner_items (
  id, client_id, day_of_week, platform, content_type, campaign_goal,
  status, caption, linked_post_id, campaign_id, created_at
)
values
  ('pl-1', 'client-meama', 'Monday', 'Instagram', 'Reel', 'Drive Tuesday covers', 'Scheduled', 'Slow-night pasta and wine pairing teaser.', null, 'ca-1', '2026-03-08T12:00:00.000Z'),
  ('pl-2', 'client-meama', 'Tuesday', 'Email', 'Offer', 'Fill Wednesday reservations', 'Draft', 'Midweek dining perk for neighborhood regulars.', null, 'ca-1', '2026-03-08T12:15:00.000Z'),
  ('pl-3', 'client-meama', 'Wednesday', 'Instagram', 'Carousel', 'Highlight chef specials', 'Draft', 'This week’s seasonal menu moments.', null, 'ca-2', '2026-03-08T12:20:00.000Z'),
  ('pl-4', 'client-meama', 'Thursday', 'Stories', 'Behind the scenes', 'Push weekend intent', 'Scheduled', 'Kitchen prep energy before service.', null, 'ca-1', '2026-03-08T12:30:00.000Z'),
  ('pl-5', 'client-meama', 'Sunday', 'TikTok', 'UGC cut', 'Promote Monday traffic', 'Draft', 'Neighborhood night recap with social proof.', null, 'ca-2', '2026-03-08T12:45:00.000Z')
on conflict (id) do update
set client_id = excluded.client_id,
    day_of_week = excluded.day_of_week,
    platform = excluded.platform,
    content_type = excluded.content_type,
    campaign_goal = excluded.campaign_goal,
    status = excluded.status,
    caption = excluded.caption,
    linked_post_id = excluded.linked_post_id,
    campaign_id = excluded.campaign_id,
    created_at = excluded.created_at;

update posts
set planner_item_id = 'pl-1'
where id = 'po-1';

update planner_items
set linked_post_id = 'po-1'
where id = 'pl-1';

insert into analytics_snapshots (
  id, client_id, source, period_label, linked_post_id, linked_campaign_id,
  impressions, clicks, conversions, attributed_revenue, attributed_covers,
  attributed_tables, created_at
)
values
  ('an-1', 'client-meama', 'Instagram', 'Last 30 days', 'po-1', 'ca-1', 12400, 420, 34, 1530, 34, 14, '2026-03-09T08:00:00.000Z'),
  ('an-2', 'client-meama', 'Email', 'Last 30 days', 'po-2', 'ca-1', 1800, 210, 18, 810, 18, 7, '2026-03-09T08:10:00.000Z'),
  ('an-3', 'client-meama', 'Google Business Profile', 'Last 30 days', null, 'ca-2', 5400, 160, 12, 540, 12, 5, '2026-03-09T08:15:00.000Z'),
  ('an-4', 'client-meama', 'Facebook', 'Last 30 days', 'po-3', 'ca-2', 9600, 280, 21, 945, 21, 8, '2026-03-09T08:20:00.000Z')
on conflict (id) do update
set client_id = excluded.client_id,
    source = excluded.source,
    period_label = excluded.period_label,
    linked_post_id = excluded.linked_post_id,
    linked_campaign_id = excluded.linked_campaign_id,
    impressions = excluded.impressions,
    clicks = excluded.clicks,
    conversions = excluded.conversions,
    attributed_revenue = excluded.attributed_revenue,
    attributed_covers = excluded.attributed_covers,
    attributed_tables = excluded.attributed_tables,
    created_at = excluded.created_at;

insert into integration_connections (
  id, client_id, provider, account_label, status, last_sync_at, notes
)
values
  ('ic-1', 'client-meama', 'instagram', '@meama_chicago', 'Scaffolded', '2026-03-08T09:00:00.000Z', 'Ready for insights and publishing credentials.'),
  ('ic-2', 'client-meama', 'facebook', 'Meama Chicago Page', 'Scaffolded', null, 'Ready for Meta Page connection and publish permissions.'),
  ('ic-3', 'client-meama', 'tiktok', '@meama_chicago', 'Needs Credentials', null, 'Awaiting TikTok app approval and account authorization.'),
  ('ic-4', 'client-meama', 'google-business-profile', 'Meama Chicago', 'Needs Credentials', null, 'Awaiting OAuth client and location access.'),
  ('ic-5', 'client-meama', 'google-analytics', 'meama.com / GA4', 'Scaffolded', null, 'Reporting adapter ready once property ID and service account are added.'),
  ('ic-6', 'client-meama', 'reservation-system', 'Tock/OpenTable Placeholder', 'Scaffolded', null, 'Hold until reservation vendor is confirmed.')
on conflict (id) do update
set client_id = excluded.client_id,
    provider = excluded.provider,
    account_label = excluded.account_label,
    status = excluded.status,
    last_sync_at = excluded.last_sync_at,
    notes = excluded.notes;

insert into publish_jobs (
  id, client_id, post_id, provider, scheduled_for, status, detail, created_at
)
values
  ('pub-1', 'client-meama', 'po-1', 'instagram', '2026-03-10T15:00:00.000Z', 'Queued', 'Tuesday dinner push queued for Instagram publishing.', '2026-03-09T16:00:00.000Z'),
  ('pub-2', 'client-meama', 'po-3', 'facebook', '2026-03-13T15:00:00.000Z', 'Queued', 'Friday reservation push queued for Facebook publishing.', '2026-03-10T16:00:00.000Z')
on conflict (id) do update
set client_id = excluded.client_id,
    post_id = excluded.post_id,
    provider = excluded.provider,
    scheduled_for = excluded.scheduled_for,
    status = excluded.status,
    detail = excluded.detail,
    created_at = excluded.created_at;

insert into sync_jobs (
  id, client_id, provider, job_type, schedule, status, last_run_at, next_run_at, detail
)
values
  ('sj-1', 'client-meama', 'instagram', 'sync-insights', 'Daily at 6:00 AM', 'Ready', '2026-03-08T06:00:00.000Z', '2026-03-10T06:00:00.000Z', 'Will backfill engagement, clicks, and attributed cover proxies once API credentials exist.'),
  ('sj-2', 'client-meama', 'facebook', 'sync-insights', 'Daily at 6:10 AM', 'Ready', '2026-03-08T06:10:00.000Z', '2026-03-10T06:10:00.000Z', 'Will sync Page reach, clicks, and attributed demand once Meta connection is completed.'),
  ('sj-3', 'client-meama', 'google-analytics', 'sync-insights', 'Daily at 6:15 AM', 'Blocked', null, null, 'GA4 sync is scaffolded but blocked until property and credentials are configured.'),
  ('sj-4', 'client-meama', 'reservation-system', 'sync-reservations', 'Hourly', 'Blocked', null, null, 'Reservation sync placeholder for covers and booking attribution.')
on conflict (id) do update
set client_id = excluded.client_id,
    provider = excluded.provider,
    job_type = excluded.job_type,
    schedule = excluded.schedule,
    status = excluded.status,
    last_run_at = excluded.last_run_at,
    next_run_at = excluded.next_run_at,
    detail = excluded.detail;

insert into workspace_memberships (
  id, workspace_id, user_id, full_name, email, role, status
)
select
  'wmem-admin',
  'ws-neighborhood',
  id,
  coalesce(raw_user_meta_data->>'full_name', email),
  email,
  'owner',
  'Active'
from auth.users
where email = 'Dcastillo1703@gmail.com'
on conflict (id) do update
set workspace_id = excluded.workspace_id,
    user_id = excluded.user_id,
    full_name = excluded.full_name,
    email = excluded.email,
    role = excluded.role,
    status = excluded.status;

insert into client_memberships (client_id, user_id, role)
select 'client-meama', id, 'owner'
from auth.users
where email = 'Dcastillo1703@gmail.com'
on conflict (client_id, user_id) do update
set role = excluded.role;

insert into client_memberships (client_id, user_id, role)
select 'client-luma', id, 'owner'
from auth.users
where email = 'Dcastillo1703@gmail.com'
on conflict (client_id, user_id) do update
set role = excluded.role;

insert into operational_tasks (
  id, workspace_id, client_id, title, detail, status, priority,
  due_date, assignee_name, linked_entity_type, linked_entity_id, created_at
)
values
  ('task-1', 'ws-neighborhood', 'client-meama', 'Approve Tuesday reel creative', 'Lock caption, asset selection, and CTA before scheduling goes live.', 'In Progress', 'High', '2026-03-11', 'Anya Cole', 'campaign', 'ca-1', '2026-03-09T13:15:00.000Z'),
  ('task-2', 'ws-neighborhood', 'client-meama', 'Connect Instagram publishing credentials', 'Move account from scaffolded to ready so the team can test real publishing flows.', 'Waiting', 'High', null, 'Marco Lin', 'integration', 'ic-1', '2026-03-09T14:00:00.000Z'),
  ('task-3', 'ws-neighborhood', 'client-luma', 'Build launch campaign shell for Luma House', 'Create the first campaign brief, success metric, and starter content map.', 'Backlog', 'Medium', '2026-03-15', 'Diego Rivera', 'campaign', null, '2026-03-10T08:00:00.000Z'),
  ('task-4', 'ws-neighborhood', 'client-meama', 'Publish weekly covers recap to client dashboard', 'Confirm notes and upload the final March 10 performance summary.', 'Done', 'Low', null, 'Diego Rivera', 'metric', 'wm-6', '2026-03-10T09:20:00.000Z')
on conflict (id) do update
set workspace_id = excluded.workspace_id,
    client_id = excluded.client_id,
    title = excluded.title,
    detail = excluded.detail,
    status = excluded.status,
    priority = excluded.priority,
    due_date = excluded.due_date,
    assignee_name = excluded.assignee_name,
    linked_entity_type = excluded.linked_entity_type,
    linked_entity_id = excluded.linked_entity_id,
    created_at = excluded.created_at;

insert into activity_events (
  id, workspace_id, client_id, actor_name, action_label, subject_type,
  subject_name, detail, created_at
)
values
  ('evt-1', 'ws-neighborhood', 'client-meama', 'Anya Cole', 'updated', 'campaign', 'Midweek Pasta Push', 'Adjusted linked assets and refreshed the campaign recap with attributed revenue.', '2026-03-10T09:40:00.000Z'),
  ('evt-2', 'ws-neighborhood', 'client-meama', 'Marco Lin', 'scaffolded', 'integration', 'Instagram connection', 'Prepared provider status handling and sync job scaffolding for publish workflows.', '2026-03-10T08:55:00.000Z'),
  ('evt-3', 'ws-neighborhood', 'client-luma', 'Diego Rivera', 'created', 'workspace', 'Luma House pipeline account', 'Opened the client shell so strategy, revenue modeling, and launch planning can start.', '2026-03-10T08:15:00.000Z')
on conflict (id) do update
set workspace_id = excluded.workspace_id,
    client_id = excluded.client_id,
    actor_name = excluded.actor_name,
    action_label = excluded.action_label,
    subject_type = excluded.subject_type,
    subject_name = excluded.subject_name,
    detail = excluded.detail,
    created_at = excluded.created_at;

insert into post_assets (post_id, asset_id)
values
  ('po-1', 'as-1'),
  ('po-1', 'as-2'),
  ('po-2', 'as-2'),
  ('po-3', 'as-1')
on conflict do nothing;

insert into blog_assets (blog_post_id, asset_id)
values
  ('bl-1', 'as-2'),
  ('bl-2', 'as-3')
on conflict do nothing;

insert into campaign_post_links (campaign_id, post_id)
values
  ('ca-1', 'po-1'),
  ('ca-1', 'po-2'),
  ('ca-2', 'po-3')
on conflict do nothing;

insert into campaign_blog_post_links (campaign_id, blog_post_id)
values
  ('ca-1', 'bl-1'),
  ('ca-2', 'bl-2')
on conflict do nothing;

insert into campaign_asset_links (campaign_id, asset_id)
values
  ('ca-1', 'as-1'),
  ('ca-1', 'as-2'),
  ('ca-2', 'as-3')
on conflict do nothing;

insert into campaign_weekly_metric_links (campaign_id, weekly_metric_id)
values
  ('ca-1', 'wm-5'),
  ('ca-1', 'wm-6')
on conflict do nothing;
