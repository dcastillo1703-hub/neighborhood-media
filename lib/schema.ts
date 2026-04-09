export const phaseOneSchema = `
create extension if not exists pgcrypto;

create table workspaces (
  id text primary key,
  name text not null,
  slug text not null unique,
  plan text not null default 'Agency',
  seat_count integer not null default 5,
  created_at timestamptz default now()
);

create table clients (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  name text not null,
  segment text not null,
  location text,
  status text not null default 'Pipeline',
  created_at timestamptz default now()
);

create table client_settings (
  id text primary key,
  client_id text not null references clients(id) on delete cascade,
  average_check numeric(10,2) not null,
  monthly_covers integer not null,
  weekly_covers integer not null,
  days_open_per_week integer not null,
  weeks_per_month numeric(4,2) not null,
  guests_per_table numeric(4,2) not null,
  default_growth_target numeric(5,2) not null,
  overview_headline text not null default '',
  overview_summary text not null default '',
  overview_pinned_campaign_id text,
  overview_featured_metric text not null default 'weekly-covers',
  overview_show_schedule boolean not null default true,
  overview_show_traffic_trend boolean not null default true,
  overview_show_channel_contribution boolean not null default true,
  overview_show_quick_links boolean not null default true,
  overview_show_campaign_recaps boolean not null default true,
  overview_show_recent_activity boolean not null default true
);

create table client_home_configs (
  id text primary key,
  client_id text not null references clients(id) on delete cascade,
  headline text not null default '',
  note text not null default '',
  cards jsonb not null default '[]'::jsonb,
  sections jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now(),
  unique (client_id)
);

create table client_preferences (
  id text primary key,
  client_id text not null references clients(id) on delete cascade,
  mobile_nav_keys jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now(),
  unique (client_id)
);

create table weekly_metrics (
  id text primary key,
  client_id text not null references clients(id) on delete cascade,
  week_label text not null,
  covers integer not null,
  net_sales numeric(12,2),
  total_orders integer,
  notes text,
  campaign_attribution text,
  campaign_id text,
  created_at timestamptz default now(),
  unique (client_id, week_label)
);

create table campaigns (
  id text primary key,
  client_id text not null references clients(id) on delete cascade,
  name text not null,
  objective text not null,
  start_date date not null,
  end_date date not null,
  channels text[] not null default '{}',
  notes text not null default '',
  status text not null,
  created_at timestamptz default now()
);

create table campaign_roi_snapshots (
  id text primary key,
  client_id text not null references clients(id) on delete cascade,
  campaign_id text not null references campaigns(id) on delete cascade,
  ad_spend numeric not null default 0,
  production_cost numeric not null default 0,
  agency_hours numeric not null default 0,
  hourly_rate numeric not null default 0,
  other_cost numeric not null default 0,
  attributed_revenue numeric not null default 0,
  attributed_covers numeric not null default 0,
  attributed_bookings numeric not null default 0,
  reach integer not null default 0,
  engagement integer not null default 0,
  clicks integer not null default 0,
  top_performer text not null default '',
  result_summary text not null default '',
  next_recommendation text not null default '',
  updated_at timestamptz default now(),
  unique (campaign_id)
);

create table campaign_goals (
  id text primary key,
  client_id text not null references clients(id) on delete cascade,
  campaign_id text not null references campaigns(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  due_date date,
  assignee_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table assets (
  id text primary key,
  client_id text not null references clients(id) on delete cascade,
  name text not null,
  asset_type text not null,
  status text not null,
  url text not null,
  created_at timestamptz default now()
);

create table blog_posts (
  id text primary key,
  client_id text not null references clients(id) on delete cascade,
  title text not null,
  slug text not null,
  summary text not null,
  publish_date date,
  status text not null,
  campaign_id text references campaigns(id) on delete set null,
  created_at timestamptz default now()
);

create table planner_items (
  id text primary key,
  client_id text not null references clients(id) on delete cascade,
  day_of_week text not null,
  platform text not null,
  content_type text not null,
  campaign_goal text not null,
  status text not null,
  caption text not null,
  linked_post_id text,
  campaign_id text references campaigns(id) on delete set null,
  created_at timestamptz default now()
);

create table posts (
  id text primary key,
  client_id text not null references clients(id) on delete cascade,
  platform text not null,
  content text not null,
  cta text not null,
  publish_date date not null,
  goal text not null,
  status text not null,
  planner_item_id text,
  campaign_id text references campaigns(id) on delete set null,
  created_at timestamptz default now()
);

create table post_assets (
  post_id text not null references posts(id) on delete cascade,
  asset_id text not null references assets(id) on delete cascade,
  primary key (post_id, asset_id)
);

create table blog_assets (
  blog_post_id text not null references blog_posts(id) on delete cascade,
  asset_id text not null references assets(id) on delete cascade,
  primary key (blog_post_id, asset_id)
);

create table campaign_post_links (
  campaign_id text not null references campaigns(id) on delete cascade,
  post_id text not null references posts(id) on delete cascade,
  primary key (campaign_id, post_id)
);

create table campaign_blog_post_links (
  campaign_id text not null references campaigns(id) on delete cascade,
  blog_post_id text not null references blog_posts(id) on delete cascade,
  primary key (campaign_id, blog_post_id)
);

create table campaign_asset_links (
  campaign_id text not null references campaigns(id) on delete cascade,
  asset_id text not null references assets(id) on delete cascade,
  primary key (campaign_id, asset_id)
);

create table campaign_weekly_metric_links (
  campaign_id text not null references campaigns(id) on delete cascade,
  weekly_metric_id text not null references weekly_metrics(id) on delete cascade,
  primary key (campaign_id, weekly_metric_id)
);

create table analytics_snapshots (
  id text primary key,
  client_id text not null references clients(id) on delete cascade,
  source text not null,
  period_label text not null,
  linked_post_id text references posts(id) on delete set null,
  linked_campaign_id text references campaigns(id) on delete set null,
  impressions integer not null default 0,
  clicks integer not null default 0,
  conversions integer not null default 0,
  attributed_revenue numeric(12,2) not null default 0,
  attributed_covers integer not null default 0,
  attributed_tables numeric(10,2) not null default 0,
  created_at timestamptz default now()
);

create table integration_connections (
  id text primary key,
  client_id text not null references clients(id) on delete cascade,
  provider text not null,
  account_label text not null,
  status text not null,
  last_sync_at timestamptz,
  notes text not null default '',
  created_at timestamptz default now()
);

create table manual_meta_performance (
  id text primary key,
  client_id text not null references clients(id) on delete cascade,
  channels jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

create table sync_jobs (
  id text primary key,
  client_id text not null references clients(id) on delete cascade,
  provider text not null,
  job_type text not null,
  schedule text not null,
  status text not null,
  last_run_at timestamptz,
  next_run_at timestamptz,
  detail text not null default '',
  created_at timestamptz default now()
);

create table publish_jobs (
  id text primary key,
  client_id text not null references clients(id) on delete cascade,
  post_id text not null references posts(id) on delete cascade,
  provider text not null,
  scheduled_for timestamptz not null,
  status text not null,
  detail text not null default '',
  external_id text,
  error_message text,
  last_attempt_at timestamptz,
  published_at timestamptz,
  created_at timestamptz default now()
);

create table approval_requests (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  client_id text not null references clients(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  summary text not null,
  requester_name text not null,
  approver_user_id uuid references auth.users(id) on delete set null,
  approver_name text,
  status text not null,
  note text,
  requested_at timestamptz not null,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table client_memberships (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references clients(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (client_id, user_id)
);

create table workspace_memberships (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  full_name text not null,
  email text not null,
  role text not null default 'strategist',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create table operational_tasks (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  client_id text references clients(id) on delete set null,
  title text not null,
  detail text not null default '',
  status text not null default 'Backlog',
  priority text not null default 'Medium',
  due_date date,
  assignee_user_id uuid references profiles(id) on delete set null,
  assignee_name text,
  linked_entity_type text,
  linked_entity_id text,
  created_at timestamptz not null default now()
);

create table activity_events (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  client_id text references clients(id) on delete set null,
  actor_name text not null,
  action_label text not null,
  subject_type text not null,
  subject_name text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.has_client_access(target_client_id text)
returns boolean
language sql
stable
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from client_memberships
      where client_memberships.client_id = target_client_id
        and client_memberships.user_id = auth.uid()
    );
$$;

create or replace function public.has_workspace_access(target_workspace_id text)
returns boolean
language sql
stable
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from workspace_memberships
      where workspace_memberships.workspace_id = target_workspace_id
        and workspace_memberships.user_id = auth.uid()
    );
$$;

alter table workspaces enable row level security;
alter table clients enable row level security;
alter table client_settings enable row level security;
alter table client_home_configs enable row level security;
alter table client_preferences enable row level security;
alter table weekly_metrics enable row level security;
alter table campaigns enable row level security;
alter table campaign_roi_snapshots enable row level security;
alter table campaign_goals enable row level security;
alter table assets enable row level security;
alter table blog_posts enable row level security;
alter table planner_items enable row level security;
alter table posts enable row level security;
alter table analytics_snapshots enable row level security;
alter table integration_connections enable row level security;
alter table manual_meta_performance enable row level security;
alter table sync_jobs enable row level security;
alter table publish_jobs enable row level security;
alter table approval_requests enable row level security;
alter table campaign_post_links enable row level security;
alter table campaign_blog_post_links enable row level security;
alter table campaign_asset_links enable row level security;
alter table campaign_weekly_metric_links enable row level security;
alter table post_assets enable row level security;
alter table blog_assets enable row level security;
alter table profiles enable row level security;
alter table client_memberships enable row level security;
alter table workspace_memberships enable row level security;
alter table operational_tasks enable row level security;
alter table activity_events enable row level security;

create policy "profiles can read self"
  on profiles for select
  using (id = auth.uid() or public.is_platform_admin());

create policy "profiles can update self"
  on profiles for update
  using (id = auth.uid() or public.is_platform_admin())
  with check (id = auth.uid() or public.is_platform_admin());

create policy "admins manage profiles"
  on profiles for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "memberships visible to members"
  on client_memberships for select
  using (user_id = auth.uid() or public.is_platform_admin());

create policy "admins manage memberships"
  on client_memberships for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "workspaces readable by membership"
  on workspaces for select
  using (public.has_workspace_access(id));

create policy "admins manage workspaces"
  on workspaces for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "workspace memberships visible to workspace members"
  on workspace_memberships for select
  using (public.has_workspace_access(workspace_id));

create policy "admins manage workspace memberships"
  on workspace_memberships for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "clients readable by membership"
  on clients for select
  using (public.has_client_access(id));

create policy "admins manage clients"
  on clients for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "client_settings readable by membership"
  on client_settings for select
  using (public.has_client_access(client_id));

create policy "admins manage client_settings"
  on client_settings for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "client_home_configs readable by membership"
  on client_home_configs for select
  using (public.has_client_access(client_id));

create policy "admins manage client_home_configs"
  on client_home_configs for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "client_preferences readable by membership"
  on client_preferences for select
  using (public.has_client_access(client_id));

create policy "admins manage client_preferences"
  on client_preferences for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "weekly_metrics readable by membership"
  on weekly_metrics for select
  using (public.has_client_access(client_id));

create policy "admins manage weekly_metrics"
  on weekly_metrics for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "campaigns readable by membership"
  on campaigns for select
  using (public.has_client_access(client_id));

create policy "admins manage campaigns"
  on campaigns for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "campaign_goals readable by membership"
  on campaign_goals for select
  using (public.has_client_access(client_id));

create policy "admins manage campaign_goals"
  on campaign_goals for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "assets readable by membership"
  on assets for select
  using (public.has_client_access(client_id));

create policy "admins manage assets"
  on assets for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "blog_posts readable by membership"
  on blog_posts for select
  using (public.has_client_access(client_id));

create policy "admins manage blog_posts"
  on blog_posts for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "planner_items readable by membership"
  on planner_items for select
  using (public.has_client_access(client_id));

create policy "admins manage planner_items"
  on planner_items for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "posts readable by membership"
  on posts for select
  using (public.has_client_access(client_id));

create policy "admins manage posts"
  on posts for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "analytics_snapshots readable by membership"
  on analytics_snapshots for select
  using (public.has_client_access(client_id));

create policy "admins manage analytics_snapshots"
  on analytics_snapshots for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "integration_connections readable by membership"
  on integration_connections for select
  using (public.has_client_access(client_id));

create policy "admins manage integration_connections"
  on integration_connections for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "manual_meta_performance readable by membership"
  on manual_meta_performance for select
  using (public.has_client_access(client_id));

create policy "admins manage manual_meta_performance"
  on manual_meta_performance for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "sync_jobs readable by membership"
  on sync_jobs for select
  using (public.has_client_access(client_id));

create policy "admins manage sync_jobs"
  on sync_jobs for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "publish_jobs readable by membership"
  on publish_jobs for select
  using (public.has_client_access(client_id));

create policy "admins manage publish_jobs"
  on publish_jobs for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "approval_requests readable by membership"
  on approval_requests for select
  using (public.has_client_access(client_id));

create policy "admins manage approval_requests"
  on approval_requests for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "operational_tasks readable by workspace membership"
  on operational_tasks for select
  using (public.has_workspace_access(workspace_id));

create policy "admins manage operational_tasks"
  on operational_tasks for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "activity_events readable by workspace membership"
  on activity_events for select
  using (public.has_workspace_access(workspace_id));

create policy "admins manage activity_events"
  on activity_events for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "campaign_post_links readable through campaign"
  on campaign_post_links for select
  using (
    exists (
      select 1
      from campaigns
      where campaigns.id = campaign_post_links.campaign_id
        and public.has_client_access(campaigns.client_id)
    )
  );

create policy "admins manage campaign_post_links"
  on campaign_post_links for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "campaign_blog_post_links readable through campaign"
  on campaign_blog_post_links for select
  using (
    exists (
      select 1
      from campaigns
      where campaigns.id = campaign_blog_post_links.campaign_id
        and public.has_client_access(campaigns.client_id)
    )
  );

create policy "admins manage campaign_blog_post_links"
  on campaign_blog_post_links for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "campaign_asset_links readable through campaign"
  on campaign_asset_links for select
  using (
    exists (
      select 1
      from campaigns
      where campaigns.id = campaign_asset_links.campaign_id
        and public.has_client_access(campaigns.client_id)
    )
  );

create policy "admins manage campaign_asset_links"
  on campaign_asset_links for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "campaign_weekly_metric_links readable through campaign"
  on campaign_weekly_metric_links for select
  using (
    exists (
      select 1
      from campaigns
      where campaigns.id = campaign_weekly_metric_links.campaign_id
        and public.has_client_access(campaigns.client_id)
    )
  );

create policy "admins manage campaign_weekly_metric_links"
  on campaign_weekly_metric_links for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "post_assets readable through post"
  on post_assets for select
  using (
    exists (
      select 1
      from posts
      where posts.id = post_assets.post_id
        and public.has_client_access(posts.client_id)
    )
  );

create policy "admins manage post_assets"
  on post_assets for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "blog_assets readable through blog"
  on blog_assets for select
  using (
    exists (
      select 1
      from blog_posts
      where blog_posts.id = blog_assets.blog_post_id
        and public.has_client_access(blog_posts.client_id)
    )
  );

create policy "admins manage blog_assets"
  on blog_assets for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

alter table planner_items
  add constraint planner_items_linked_post_id_fkey
  foreign key (linked_post_id) references posts(id) on delete set null;

alter table posts
  add constraint posts_planner_item_id_fkey
  foreign key (planner_item_id) references planner_items(id) on delete set null;

alter table weekly_metrics
  add constraint weekly_metrics_campaign_id_fkey
  foreign key (campaign_id) references campaigns(id) on delete set null;
`;
