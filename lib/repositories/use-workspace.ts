"use client";

import { useEffect, useMemo, useState } from "react";

import { neighborhoodWorkspace, seededWorkspaceMembers } from "@/data/seed";
import { useScopedEntity } from "@/lib/repositories/client-store";
import {
  workspaceAdapter
} from "@/lib/repositories/supabase-store";
import { Workspace, WorkspaceMember } from "@/types";

export function useWorkspace() {
  const [workspace, setWorkspace, ready] = useScopedEntity<Workspace>(
    "nmos-workspace",
    neighborhoodWorkspace.id,
    neighborhoodWorkspace,
    workspaceAdapter
  );

  return {
    workspace,
    ready,
    setWorkspace
  };
}

export function useWorkspaceMembers(workspaceId: string) {
  const seedMembers = useMemo(
    () => seededWorkspaceMembers.filter((member) => member.workspaceId === workspaceId),
    [workspaceId]
  );
  const [members, setMembers] = useState<WorkspaceMember[]>(seedMembers);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setReady(false);
      setError(null);

      try {
        const response = await fetch(
          `/api/workspace/members?workspaceId=${encodeURIComponent(workspaceId)}`,
          {
            method: "GET",
            cache: "no-store"
          }
        );

        if (!response.ok) {
          throw new Error("Failed to load workspace members.");
        }

        const payload = (await response.json()) as { members: WorkspaceMember[] };

        if (active) {
          setMembers(payload.members);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load workspace members."
          );
          setMembers(seedMembers);
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
  }, [seedMembers, workspaceId]);

  return {
    members,
    ready,
    error,
    async addMember(member: Pick<WorkspaceMember, "workspaceId" | "fullName" | "email" | "role" | "status">) {
      const response = await fetch("/api/workspace/members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(member)
      });

      if (!response.ok) {
        throw new Error("Failed to add workspace member.");
      }

      const payload = (await response.json()) as {
        member: WorkspaceMember;
      };

      setMembers((current) => [...current, payload.member]);

      return payload;
    },
    async updateMember(
      memberId: string,
      update: Pick<WorkspaceMember, "workspaceId"> &
        Partial<Pick<WorkspaceMember, "role" | "status">>
    ) {
      const response = await fetch(`/api/workspace/members/${memberId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(update)
      });

      if (!response.ok) {
        throw new Error("Failed to update workspace member.");
      }

      const payload = (await response.json()) as {
        member: WorkspaceMember;
      };

      setMembers((current) =>
        current.map((member) => (member.id === memberId ? payload.member : member))
      );

      return payload;
    }
  };
}
