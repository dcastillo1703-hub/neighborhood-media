"use client";

import { useEffect, useState } from "react";

import type { ActivityEvent, OperationalTask, TaskStatus } from "@/types";

type OperationsResponse = {
  tasks: OperationalTask[];
  events: ActivityEvent[];
};

type CreateTaskInput = Omit<OperationalTask, "id" | "createdAt">;
type UpdateTaskInput = Partial<Omit<OperationalTask, "id" | "workspaceId" | "createdAt">>;

export function useOperationsApi(workspaceId: string, clientId?: string) {
  const [tasks, setTasks] = useState<OperationalTask[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setReady(false);
      setError(null);

      const search = new URLSearchParams({ workspaceId });
      if (clientId) {
        search.set("clientId", clientId);
      }

      try {
        const response = await fetch(`/api/operations?${search.toString()}`, {
          method: "GET",
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("Failed to load operations.");
        }

        const payload = (await response.json()) as OperationsResponse;

        if (!active) {
          return;
        }

        setTasks(payload.tasks);
        setEvents(payload.events);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Failed to load operations.");
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
  }, [clientId, workspaceId]);

  return {
    tasks,
    events,
    ready,
    error,
    async createTask(input: CreateTaskInput) {
      const response = await fetch("/api/operations/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        throw new Error("Failed to create task.");
      }

      const payload = (await response.json()) as {
        task: OperationalTask;
        event: ActivityEvent;
      };

      setTasks((current) => [payload.task, ...current]);
      setEvents((current) => [payload.event, ...current]);

      return payload;
    },
    async updateTaskStatus(taskId: string, status: TaskStatus) {
      const response = await fetch(`/api/operations/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ workspaceId, status })
      });

      if (!response.ok) {
        throw new Error("Failed to update task.");
      }

      const payload = (await response.json()) as {
        task: OperationalTask;
        event: ActivityEvent;
      };

      setTasks((current) =>
        current.map((task) => (task.id === payload.task.id ? payload.task : task))
      );
      setEvents((current) => [payload.event, ...current]);

      return payload;
    },
    async updateTask(taskId: string, updates: UpdateTaskInput) {
      const response = await fetch(`/api/operations/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ workspaceId, ...updates })
      });

      if (!response.ok) {
        throw new Error("Failed to update task.");
      }

      const payload = (await response.json()) as {
        task: OperationalTask;
        event: ActivityEvent;
      };

      setTasks((current) =>
        current.map((task) => (task.id === payload.task.id ? payload.task : task))
      );
      setEvents((current) => [payload.event, ...current]);

      return payload;
    }
  };
}
