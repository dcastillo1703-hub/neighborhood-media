"use client";

import { useEffect, useState } from "react";

import type { ActivityEvent, PublishJob } from "@/types";

type PublishingResponse = {
  jobs: PublishJob[];
};

export function usePublishingApi(clientId: string) {
  const [jobs, setJobs] = useState<PublishJob[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setReady(false);
      setError(null);

      try {
        const response = await fetch(`/api/publishing?clientId=${encodeURIComponent(clientId)}`, {
          method: "GET",
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("Failed to load publish queue.");
        }

        const payload = (await response.json()) as PublishingResponse;

        if (active) {
          setJobs(payload.jobs);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load publish queue.");
          setJobs([]);
        }
      } finally {
        if (active) {
          setReady(true);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [clientId]);

  return {
    jobs,
    ready,
    error,
    async processJob(jobId: string) {
      const response = await fetch(`/api/publishing/${jobId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ clientId })
      });

      if (!response.ok) {
        throw new Error("Failed to process publish job.");
      }

      const payload = (await response.json()) as {
        job: PublishJob;
        event: ActivityEvent;
      };

      setJobs((current) => current.map((job) => (job.id === payload.job.id ? payload.job : job)));

      return payload;
    },
    prependJob(job: PublishJob) {
      setJobs((current) => [job, ...current]);
    }
  };
}
