export const syncScheduleOptions = [
  "Every 6 hours",
  "Every 12 hours",
  "Daily at 6:15 AM"
] as const;

export type SyncScheduleOption = (typeof syncScheduleOptions)[number];

export function computeNextSyncRun(schedule: string, from = new Date()) {
  const base = new Date(from);

  if (schedule === "Every 6 hours") {
    return new Date(base.getTime() + 6 * 60 * 60 * 1000).toISOString();
  }

  if (schedule === "Every 12 hours") {
    return new Date(base.getTime() + 12 * 60 * 60 * 1000).toISOString();
  }

  const next = new Date(base);
  next.setHours(6, 15, 0, 0);

  if (next <= base) {
    next.setDate(next.getDate() + 1);
  }

  return next.toISOString();
}

export function isSyncDue(nextRunAt: string | null | undefined, now = new Date()) {
  if (!nextRunAt) {
    return false;
  }

  return new Date(nextRunAt).getTime() <= now.getTime();
}
