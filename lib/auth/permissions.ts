import { NextResponse } from "next/server";

import { hasSupabaseCredentials } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/types";

export type PermissionContext = {
  workspaceId: string;
  clientId?: string;
};

const roleRank: Record<WorkspaceRole, number> = {
  "client-viewer": 1,
  operator: 2,
  strategist: 3,
  admin: 4,
  owner: 5
};

export class PermissionError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "PermissionError";
    this.status = status;
  }
}

async function getAuthenticatedAccessContext() {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    throw new PermissionError("Supabase auth is unavailable.", 500);
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new PermissionError("You must be signed in to access this workspace.", 401);
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileData as { role?: string } | null;

  if (profileError) {
    throw new PermissionError("Unable to resolve your profile.", 500);
  }

  return {
    supabase,
    userId: user.id,
    isPlatformAdmin: profile?.role === "admin"
  };
}

function hasRequiredRole(
  actualRole: WorkspaceRole | null | undefined,
  minimumRole: WorkspaceRole
) {
  if (!actualRole) {
    return false;
  }

  return roleRank[actualRole] >= roleRank[minimumRole];
}

async function getClientRole(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  clientId: string
) {
  const { data: membershipData, error: membershipError } = await supabase
    .from("client_memberships")
    .select("client_id, role")
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .maybeSingle();

  const membership = membershipData as
    | { client_id?: string; role?: WorkspaceRole }
    | null;

  if (membershipError) {
    throw new PermissionError("Unable to verify client access.", 500);
  }

  return membership?.client_id ? membership.role ?? null : null;
}

async function getWorkspaceRole(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  workspaceId: string
) {
  const { data: workspaceMembershipData, error: workspaceError } = await supabase
    .from("workspace_memberships")
    .select("workspace_id, role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  const workspaceMembership = workspaceMembershipData as
    | { workspace_id?: string; role?: WorkspaceRole }
    | null;

  if (workspaceError) {
    throw new PermissionError("Unable to verify workspace membership.", 500);
  }

  return workspaceMembership?.workspace_id === workspaceId
    ? workspaceMembership.role ?? null
    : null;
}

export async function assertWorkspacePermission(context: PermissionContext) {
  if (!hasSupabaseCredentials) {
    return true;
  }

  const { supabase, userId, isPlatformAdmin } = await getAuthenticatedAccessContext();

  if (isPlatformAdmin) {
    return true;
  }

  if (context.clientId) {
    const clientRole = await getClientRole(supabase, userId, context.clientId);

    if (clientRole) {
      if (!context.workspaceId) {
        return true;
      }

      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("workspace_id")
        .eq("id", context.clientId)
        .maybeSingle();

      const client = clientData as { workspace_id?: string } | null;

      if (clientError) {
        throw new PermissionError("Unable to verify workspace access.", 500);
      }

      if (client?.workspace_id === context.workspaceId) {
        return true;
      }
    }
  }

  const workspaceRole = await getWorkspaceRole(supabase, userId, context.workspaceId);

  if (workspaceRole) {
    return true;
  }

  throw new PermissionError("You do not have access to this workspace.", 403);
}

export async function assertAdminPermission() {
  if (!hasSupabaseCredentials) {
    return true;
  }

  const { isPlatformAdmin } = await getAuthenticatedAccessContext();

  if (!isPlatformAdmin) {
    throw new PermissionError("Admin access is required for this action.", 403);
  }

  return true;
}

export async function assertClientRole(
  clientId: string,
  minimumRole: WorkspaceRole,
  workspaceId = "ws-neighborhood"
) {
  if (!hasSupabaseCredentials) {
    return true;
  }

  const { supabase, userId, isPlatformAdmin } = await getAuthenticatedAccessContext();

  if (isPlatformAdmin) {
    return true;
  }

  const clientRole = await getClientRole(supabase, userId, clientId);

  if (hasRequiredRole(clientRole, minimumRole)) {
    return true;
  }

  const workspaceRole = await getWorkspaceRole(supabase, userId, workspaceId);

  if (hasRequiredRole(workspaceRole, minimumRole)) {
    return true;
  }

  throw new PermissionError(
    `You need ${minimumRole} access or higher to perform this action.`,
    403
  );
}

export async function assertWorkspaceRole(
  workspaceId: string,
  minimumRole: WorkspaceRole
) {
  if (!hasSupabaseCredentials) {
    return true;
  }

  const { supabase, userId, isPlatformAdmin } = await getAuthenticatedAccessContext();

  if (isPlatformAdmin) {
    return true;
  }

  const workspaceRole = await getWorkspaceRole(supabase, userId, workspaceId);

  if (hasRequiredRole(workspaceRole, minimumRole)) {
    return true;
  }

  throw new PermissionError(
    `You need ${minimumRole} workspace access or higher to perform this action.`,
    403
  );
}

export function toPermissionErrorResponse(error: unknown) {
  if (error instanceof PermissionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json({ error: "Permission check failed." }, { status: 500 });
}

export async function requireWorkspacePermission(context: PermissionContext) {
  try {
    await assertWorkspacePermission(context);
    return null;
  } catch (error) {
    return toPermissionErrorResponse(error);
  }
}

export async function requireAdminPermission() {
  try {
    await assertAdminPermission();
    return null;
  } catch (error) {
    return toPermissionErrorResponse(error);
  }
}

export async function requireClientRole(
  clientId: string,
  minimumRole: WorkspaceRole,
  workspaceId = "ws-neighborhood"
) {
  try {
    await assertClientRole(clientId, minimumRole, workspaceId);
    return null;
  } catch (error) {
    return toPermissionErrorResponse(error);
  }
}

export async function requireWorkspaceRole(
  workspaceId: string,
  minimumRole: WorkspaceRole
) {
  try {
    await assertWorkspaceRole(workspaceId, minimumRole);
    return null;
  } catch (error) {
    return toPermissionErrorResponse(error);
  }
}

export async function requireClientPermission(clientId: string, workspaceId = "ws-neighborhood") {
  return requireWorkspacePermission({ workspaceId, clientId });
}

export async function requireWorkspaceOnlyPermission(workspaceId: string) {
  return requireWorkspacePermission({ workspaceId });
}

export function isPermissionError(error: unknown) {
  return error instanceof PermissionError;
}

export function getPermissionErrorStatus(error: unknown) {
  return error instanceof PermissionError ? error.status : 500;
}

export function getPermissionErrorMessage(error: unknown) {
  return error instanceof PermissionError ? error.message : "Permission check failed.";
}

export async function canAccessClient(clientId: string, workspaceId = "ws-neighborhood") {
  try {
    await assertWorkspacePermission({ workspaceId, clientId });
    return true;
  } catch {
    return false;
  }
}

export async function canAccessWorkspace(workspaceId: string) {
  try {
    await assertWorkspacePermission({ workspaceId });
    return true;
  } catch {
    return false;
  }
}

export async function assertClientPermission(clientId: string, workspaceId = "ws-neighborhood") {
  return assertWorkspacePermission({ workspaceId, clientId });
}

export async function assertWorkspaceOnlyPermission(workspaceId: string) {
  return assertWorkspacePermission({ workspaceId });
}

export async function withPermission<T>(
  context: PermissionContext,
  fn: () => Promise<T>
) {
  await assertWorkspacePermission(context);
  return fn();
}
