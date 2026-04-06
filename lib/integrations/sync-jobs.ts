import { getIntegrationAdapter } from "@/lib/integrations/registry";
import { IntegrationConnection, SyncJob } from "@/types";

export async function runSyncJob(job: SyncJob, connection?: IntegrationConnection) {
  // This is where a real background job or server action would call the provider adapter.
  const adapter = getIntegrationAdapter(job.provider);
  return adapter.sync(job, connection);
}
