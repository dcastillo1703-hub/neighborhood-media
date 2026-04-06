"use client";

import { useMemo } from "react";

import { neighborhoodWorkspace, seededOperationalTasks } from "@/data/seed";
import { useScopedCollection } from "@/lib/repositories/client-store";
import { operationalTasksAdapter } from "@/lib/repositories/supabase-store";
import { OperationalTask, TaskStatus } from "@/types";

export function useOperationalTasks(workspaceId = neighborhoodWorkspace.id) {
  const seed = useMemo(
    () => seededOperationalTasks.filter((task) => task.workspaceId === workspaceId),
    [workspaceId]
  );
  const [tasks, setTasks, ready] = useScopedCollection<OperationalTask>(
    "nmos-operational-tasks",
    workspaceId,
    seed,
    operationalTasksAdapter
  );

  return {
    tasks,
    ready,
    addTask(task: OperationalTask) {
      setTasks((current) => [...current, task]);
    },
    updateTaskStatus(id: string, status: TaskStatus) {
      setTasks((current) => current.map((task) => (task.id === id ? { ...task, status } : task)));
    }
  };
}
