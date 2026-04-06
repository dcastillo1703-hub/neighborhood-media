"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { neighborhoodWorkspace, seededWorkspaceMembers } from "@/data/seed";
import { useWorkspace, useWorkspaceMembers } from "@/lib/repositories/use-workspace";
import { Workspace, WorkspaceMember } from "@/types";

type WorkspaceContextValue = {
  workspace: Workspace;
  members: WorkspaceMember[];
  ready: boolean;
  error: string | null;
  addMember: (
    member: Pick<WorkspaceMember, "workspaceId" | "fullName" | "email" | "role" | "status">
  ) => Promise<{ member: WorkspaceMember }>;
  updateMember: (
    memberId: string,
    update: Pick<WorkspaceMember, "workspaceId"> &
      Partial<Pick<WorkspaceMember, "role" | "status">>
  ) => Promise<{ member: WorkspaceMember }>;
};

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspace: neighborhoodWorkspace,
  members: [],
  ready: false,
  error: null,
  addMember: async () => ({ member: seededWorkspaceMembers[0] }),
  updateMember: async () => ({ member: seededWorkspaceMembers[0] })
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { workspace, ready: workspaceReady } = useWorkspace();
  const { members, ready: membersReady, error, addMember, updateMember } = useWorkspaceMembers(
    workspace.id
  );

  const value = useMemo(
    () => ({
      workspace,
      members,
      ready: workspaceReady && membersReady,
      error,
      addMember,
      updateMember
    }),
    [addMember, error, members, membersReady, updateMember, workspace, workspaceReady]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceContext() {
  return useContext(WorkspaceContext);
}
