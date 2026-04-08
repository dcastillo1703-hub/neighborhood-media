export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      approval_requests: {
        Row: {
          id: string;
          workspace_id: string;
          client_id: string;
          entity_type: string;
          entity_id: string;
          summary: string;
          requester_name: string;
          approver_user_id: string | null;
          approver_name: string | null;
          status: string;
          note: string | null;
          requested_at: string;
          reviewed_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          workspace_id: string;
          client_id: string;
          entity_type: string;
          entity_id: string;
          summary: string;
          requester_name: string;
          approver_user_id?: string | null;
          approver_name?: string | null;
          status: string;
          note?: string | null;
          requested_at: string;
          reviewed_at?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["approval_requests"]["Insert"]>;
        Relationships: [];
      };
      analytics_snapshots: {
        Row: {
          id: string;
          client_id: string;
          source: string;
          period_label: string;
          linked_post_id: string | null;
          linked_campaign_id: string | null;
          impressions: number;
          clicks: number;
          conversions: number;
          attributed_revenue: number;
          attributed_covers: number;
          attributed_tables: number;
          created_at: string | null;
        };
        Insert: {
          id: string;
          client_id: string;
          source: string;
          period_label: string;
          linked_post_id?: string | null;
          linked_campaign_id?: string | null;
          impressions?: number;
          clicks?: number;
          conversions?: number;
          attributed_revenue?: number;
          attributed_covers?: number;
          attributed_tables?: number;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["analytics_snapshots"]["Insert"]>;
        Relationships: [];
      };
      assets: {
        Row: {
          id: string;
          client_id: string;
          name: string;
          asset_type: string;
          status: string;
          url: string;
          created_at: string | null;
        };
        Insert: {
          id: string;
          client_id: string;
          name: string;
          asset_type: string;
          status: string;
          url: string;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["assets"]["Insert"]>;
        Relationships: [];
      };
      blog_assets: {
        Row: {
          blog_post_id: string;
          asset_id: string;
        };
        Insert: {
          blog_post_id: string;
          asset_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["blog_assets"]["Insert"]>;
        Relationships: [];
      };
      blog_posts: {
        Row: {
          id: string;
          client_id: string;
          title: string;
          slug: string;
          summary: string;
          publish_date: string | null;
          status: string;
          campaign_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          client_id: string;
          title: string;
          slug: string;
          summary: string;
          publish_date?: string | null;
          status: string;
          campaign_id?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["blog_posts"]["Insert"]>;
        Relationships: [];
      };
      campaign_asset_links: {
        Row: {
          campaign_id: string;
          asset_id: string;
        };
        Insert: {
          campaign_id: string;
          asset_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["campaign_asset_links"]["Insert"]>;
        Relationships: [];
      };
      campaign_blog_post_links: {
        Row: {
          campaign_id: string;
          blog_post_id: string;
        };
        Insert: {
          campaign_id: string;
          blog_post_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["campaign_blog_post_links"]["Insert"]>;
        Relationships: [];
      };
      campaign_post_links: {
        Row: {
          campaign_id: string;
          post_id: string;
        };
        Insert: {
          campaign_id: string;
          post_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["campaign_post_links"]["Insert"]>;
        Relationships: [];
      };
      campaign_weekly_metric_links: {
        Row: {
          campaign_id: string;
          weekly_metric_id: string;
        };
        Insert: {
          campaign_id: string;
          weekly_metric_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["campaign_weekly_metric_links"]["Insert"]>;
        Relationships: [];
      };
      campaigns: {
        Row: {
          id: string;
          client_id: string;
          name: string;
          objective: string;
          start_date: string;
          end_date: string;
          channels: string[];
          notes: string;
          status: string;
          created_at: string | null;
        };
        Insert: {
          id: string;
          client_id: string;
          name: string;
          objective: string;
          start_date: string;
          end_date: string;
          channels?: string[];
          notes?: string;
          status: string;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["campaigns"]["Insert"]>;
        Relationships: [];
      };
      campaign_roi_snapshots: {
        Row: {
          id: string;
          client_id: string;
          campaign_id: string;
          ad_spend: number;
          production_cost: number;
          agency_hours: number;
          hourly_rate: number;
          other_cost: number;
          attributed_revenue: number;
          attributed_covers: number;
          attributed_bookings: number;
          reach: number;
          engagement: number;
          clicks: number;
          top_performer: string;
          result_summary: string;
          next_recommendation: string;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          client_id: string;
          campaign_id: string;
          ad_spend?: number;
          production_cost?: number;
          agency_hours?: number;
          hourly_rate?: number;
          other_cost?: number;
          attributed_revenue?: number;
          attributed_covers?: number;
          attributed_bookings?: number;
          reach?: number;
          engagement?: number;
          clicks?: number;
          top_performer?: string;
          result_summary?: string;
          next_recommendation?: string;
          updated_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["campaign_roi_snapshots"]["Insert"]>;
        Relationships: [];
      };
      campaign_goals: {
        Row: {
          id: string;
          client_id: string;
          campaign_id: string;
          label: string;
          done: boolean;
          due_date: string | null;
          assignee_name: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          client_id: string;
          campaign_id: string;
          label: string;
          done?: boolean;
          due_date?: string | null;
          assignee_name?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["campaign_goals"]["Insert"]>;
        Relationships: [];
      };
      client_memberships: {
        Row: {
          id: string;
          client_id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          user_id: string;
          role?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["client_memberships"]["Insert"]>;
        Relationships: [];
      };
      client_settings: {
        Row: {
          id: string;
          client_id: string;
          average_check: number;
          monthly_covers: number;
          weekly_covers: number;
          days_open_per_week: number;
          weeks_per_month: number;
          guests_per_table: number;
          default_growth_target: number;
          overview_headline: string;
          overview_summary: string;
          overview_pinned_campaign_id: string | null;
          overview_featured_metric: string;
          overview_show_schedule: boolean;
          overview_show_traffic_trend: boolean;
          overview_show_channel_contribution: boolean;
          overview_show_quick_links: boolean;
          overview_show_campaign_recaps: boolean;
          overview_show_recent_activity: boolean;
        };
        Insert: {
          id: string;
          client_id: string;
          average_check: number;
          monthly_covers: number;
          weekly_covers: number;
          days_open_per_week: number;
          weeks_per_month: number;
          guests_per_table: number;
          default_growth_target: number;
          overview_headline?: string;
          overview_summary?: string;
          overview_pinned_campaign_id?: string | null;
          overview_featured_metric?: string;
          overview_show_schedule?: boolean;
          overview_show_traffic_trend?: boolean;
          overview_show_channel_contribution?: boolean;
          overview_show_quick_links?: boolean;
          overview_show_campaign_recaps?: boolean;
          overview_show_recent_activity?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["client_settings"]["Insert"]>;
        Relationships: [];
      };
      client_home_configs: {
        Row: {
          id: string;
          client_id: string;
          headline: string;
          note: string;
          cards: Json;
          sections: Json;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          client_id: string;
          headline?: string;
          note?: string;
          cards?: Json;
          sections?: Json;
          updated_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["client_home_configs"]["Insert"]>;
        Relationships: [];
      };
      client_preferences: {
        Row: {
          id: string;
          client_id: string;
          mobile_nav_keys: Json;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          client_id: string;
          mobile_nav_keys?: Json;
          updated_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["client_preferences"]["Insert"]>;
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          segment: string;
          location: string | null;
          status: string;
          created_at: string | null;
        };
        Insert: {
          id: string;
          workspace_id: string;
          name: string;
          segment: string;
          location?: string | null;
          status?: string;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
        Relationships: [];
      };
      integration_connections: {
        Row: {
          id: string;
          client_id: string;
          provider: string;
          account_label: string;
          status: string;
          last_sync_at: string | null;
          notes: string;
          created_at: string | null;
        };
        Insert: {
          id: string;
          client_id: string;
          provider: string;
          account_label: string;
          status: string;
          last_sync_at?: string | null;
          notes?: string;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["integration_connections"]["Insert"]>;
        Relationships: [];
      };
      manual_meta_performance: {
        Row: {
          id: string;
          client_id: string;
          channels: Json;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          client_id: string;
          channels?: Json;
          updated_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["manual_meta_performance"]["Insert"]>;
        Relationships: [];
      };
      activity_events: {
        Row: {
          id: string;
          workspace_id: string;
          client_id: string | null;
          actor_name: string;
          action_label: string;
          subject_type: string;
          subject_name: string;
          detail: string;
          created_at: string;
        };
        Insert: {
          id: string;
          workspace_id: string;
          client_id?: string | null;
          actor_name: string;
          action_label: string;
          subject_type: string;
          subject_name: string;
          detail?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["activity_events"]["Insert"]>;
        Relationships: [];
      };
      operational_tasks: {
        Row: {
          id: string;
          workspace_id: string;
          client_id: string | null;
          title: string;
          detail: string;
          status: string;
          priority: string;
          due_date: string | null;
          assignee_user_id: string | null;
          assignee_name: string | null;
          linked_entity_type: string | null;
          linked_entity_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          workspace_id: string;
          client_id?: string | null;
          title: string;
          detail?: string;
          status?: string;
          priority?: string;
          due_date?: string | null;
          assignee_user_id?: string | null;
          assignee_name?: string | null;
          linked_entity_type?: string | null;
          linked_entity_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["operational_tasks"]["Insert"]>;
        Relationships: [];
      };
      planner_items: {
        Row: {
          id: string;
          client_id: string;
          day_of_week: string;
          platform: string;
          content_type: string;
          campaign_goal: string;
          status: string;
          caption: string;
          linked_post_id: string | null;
          campaign_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          client_id: string;
          day_of_week: string;
          platform: string;
          content_type: string;
          campaign_goal: string;
          status: string;
          caption: string;
          linked_post_id?: string | null;
          campaign_id?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["planner_items"]["Insert"]>;
        Relationships: [];
      };
      post_assets: {
        Row: {
          post_id: string;
          asset_id: string;
        };
        Insert: {
          post_id: string;
          asset_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["post_assets"]["Insert"]>;
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          client_id: string;
          platform: string;
          content: string;
          cta: string;
          publish_date: string;
          goal: string;
          status: string;
          planner_item_id: string | null;
          campaign_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          client_id: string;
          platform: string;
          content: string;
          cta: string;
          publish_date: string;
          goal: string;
          status: string;
          planner_item_id?: string | null;
          campaign_id?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["posts"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      sync_jobs: {
        Row: {
          id: string;
          client_id: string;
          provider: string;
          job_type: string;
          schedule: string;
          status: string;
          last_run_at: string | null;
          next_run_at: string | null;
          detail: string;
          created_at: string | null;
        };
        Insert: {
          id: string;
          client_id: string;
          provider: string;
          job_type: string;
          schedule: string;
          status: string;
          last_run_at?: string | null;
          next_run_at?: string | null;
          detail?: string;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["sync_jobs"]["Insert"]>;
        Relationships: [];
      };
      publish_jobs: {
        Row: {
          id: string;
          client_id: string;
          post_id: string;
          provider: string;
          scheduled_for: string;
          status: string;
          detail: string;
          external_id: string | null;
          error_message: string | null;
          last_attempt_at: string | null;
          published_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          client_id: string;
          post_id: string;
          provider: string;
          scheduled_for: string;
          status: string;
          detail?: string;
          external_id?: string | null;
          error_message?: string | null;
          last_attempt_at?: string | null;
          published_at?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["publish_jobs"]["Insert"]>;
        Relationships: [];
      };
      workspace_memberships: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string | null;
          full_name: string;
          email: string;
          role: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id: string;
          workspace_id: string;
          user_id?: string | null;
          full_name: string;
          email: string;
          role?: string;
          status?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspace_memberships"]["Insert"]>;
        Relationships: [];
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          slug: string;
          plan: string;
          seat_count: number;
          created_at: string | null;
        };
        Insert: {
          id: string;
          name: string;
          slug: string;
          plan?: string;
          seat_count?: number;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["workspaces"]["Insert"]>;
        Relationships: [];
      };
      weekly_metrics: {
        Row: {
          id: string;
          client_id: string;
          week_label: string;
          covers: number;
          notes: string | null;
          campaign_attribution: string | null;
          campaign_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          client_id: string;
          week_label: string;
          covers: number;
          notes?: string | null;
          campaign_attribution?: string | null;
          campaign_id?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["weekly_metrics"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
