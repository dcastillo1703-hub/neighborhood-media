import { IntegrationConnection, IntegrationProvider, Post, SyncJob } from "@/types";

export type SyncResult = {
  provider: IntegrationProvider;
  status: "success" | "blocked";
  message: string;
  syncedAt?: string;
  nextRunAt?: string;
  setup?: Partial<IntegrationConnection["setup"]>;
};

export type PublishResult = {
  provider: IntegrationProvider;
  status: "success" | "blocked";
  externalId?: string;
  message: string;
};

export type ConnectionGuide = {
  provider: IntegrationProvider;
  title: string;
  summary: string;
  connectLabel: string;
  steps: string[];
  scopes?: string[];
  reportingViews?: string[];
};

export interface IntegrationAdapter {
  provider: IntegrationProvider;
  description: string;
  getConnectionStatus(connection?: IntegrationConnection): SyncResult;
  getConnectionGuide(connection?: IntegrationConnection): ConnectionGuide;
  sync(job: SyncJob, connection?: IntegrationConnection): Promise<SyncResult>;
  connect?(connection?: IntegrationConnection): Promise<SyncResult>;
  publish?(post: Post, connection?: IntegrationConnection): Promise<PublishResult>;
}
