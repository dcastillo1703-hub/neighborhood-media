import { meamaClient, seededWorkspaceMembers } from "@/data/seed";
import {
  mapActivityEventInsert,
  mapActivityEventRow,
  mapClientMembershipInsert,
  mapClientMembershipRow
} from "@/lib/supabase/mappers";
import type { ActivityEvent, ClientMembership, WorkspaceRole } from "@/types";

type DecoratedClientMembership = ClientMembership & {
  fullName?: string;
  email?: string;
};

const clientMembershipStore = new Map<string, DecoratedClientMembership[]>();

function getClientSnapshot(clientId: string) {
  const existing = clientMembershipStore.get(clientId);

  if (existing) {
    return existing;
  }

  const seeded = seededWorkspaceMembers
    .filter((member) => member.workspaceId === (meamaClient.workspaceId ?? "ws-neighborhood"))
    .filter((member) => member.userId)
    .slice(0, 1)
    .map((member) => ({
      id: `cmem-${member.userId}-${clientId}`,
      clientId,
      userId: member.userId,
      role: "owner" as WorkspaceRole,
      fullName: member.fullName,
      email: member.email,
      createdAt: new Date().toISOString()
    }));

  clientMembershipStore.set(clientId, seeded);

  return seeded;
}

async function getClientWorkspace(clientId: string) {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data } = await supabase
      .from("clients")
      .select("workspace_id,name")
      .eq("id", clientId)
      .maybeSingle();

    if (data) {
      return {
        workspaceId: String(data.workspace_id),
        clientName: String(data.name)
      };
    }
  }

  return {
    workspaceId: meamaClient.workspaceId ?? "ws-neighborhood",
    clientName: meamaClient.name
  };
}

async function recordClientMembershipEvent(event: ActivityEvent) {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (!supabase) {
    return event;
  }

  try {
    const { data, error } = await supabase
      .from("activity_events")
      .insert(mapActivityEventInsert(event))
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return mapActivityEventRow(data as Parameters<typeof mapActivityEventRow>[0]);
  } catch (error) {
    console.error("Failed to record client membership event.", error);
    return event;
  }
}

export async function listClientMemberships(clientId: string) {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data, error } = await supabase
      .from("client_memberships")
      .select("id, client_id, user_id, role, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    const memberships = ((data ?? []) as Array<Parameters<typeof mapClientMembershipRow>[0]>).map(
      mapClientMembershipRow
    );

    const userIds = memberships.map((membership) => membership.userId);

    const { data: workspaceMembers } = await supabase
      .from("workspace_memberships")
      .select("user_id, full_name, email")
      .in("user_id", userIds);

    const memberMap = new Map<string, { full_name: string; email: string }>();
    (workspaceMembers ?? []).forEach((member: { user_id: string; full_name: string; email: string }) => {
      memberMap.set(member.user_id, {
        full_name: member.full_name,
        email: member.email
      });
    });

    return memberships.map((membership) => ({
      ...membership,
      fullName: memberMap.get(membership.userId)?.full_name,
      email: memberMap.get(membership.userId)?.email
    }));
  }

  return getClientSnapshot(clientId);
}

export async function createClientMembership(input: {
  clientId: string;
  userId: string;
  role: WorkspaceRole;
}) {
  const { workspaceId, clientName } = await getClientWorkspace(input.clientId);
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data: memberRow } = await supabase
      .from("workspace_memberships")
      .select("full_name,email")
      .eq("user_id", input.userId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    const membership: ClientMembership = {
      id: `cmem-${Date.now()}`,
      clientId: input.clientId,
      userId: input.userId,
      role: input.role,
      createdAt: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("client_memberships")
      .upsert(mapClientMembershipInsert(membership), { onConflict: "client_id,user_id" })
      .select("id, client_id, user_id, role, created_at")
      .single();

    if (error) {
      throw error;
    }

    const createdMembership = mapClientMembershipRow(
      data as Parameters<typeof mapClientMembershipRow>[0]
    );
    const event = await recordClientMembershipEvent({
      id: `evt-${Date.now()}`,
      workspaceId,
      clientId: input.clientId,
      actorName: "Workspace admin",
      actionLabel: "assigned",
      subjectType: "workspace",
      subjectName: memberRow?.email ?? input.userId,
      detail: `${memberRow?.full_name ?? "Operator"} assigned to ${clientName} as ${input.role}.`,
      createdAt: new Date().toISOString()
    });

    return {
      membership: {
        ...createdMembership,
        fullName: memberRow?.full_name,
        email: memberRow?.email
      },
      event
    };
  }

  const snapshot = getClientSnapshot(input.clientId);
  const seedMember = seededWorkspaceMembers.find((member) => member.userId === input.userId);
  const membership: DecoratedClientMembership = {
    id: `cmem-${Date.now()}`,
    clientId: input.clientId,
    userId: input.userId,
    role: input.role,
    fullName: seedMember?.fullName,
    email: seedMember?.email,
    createdAt: new Date().toISOString()
  };

  const existingIndex = snapshot.findIndex((entry) => entry.userId === input.userId);
  if (existingIndex >= 0) {
    snapshot[existingIndex] = membership;
  } else {
    snapshot.push(membership);
  }

  return { membership, event: null };
}

export async function updateClientMembership(
  clientId: string,
  membershipId: string,
  role: WorkspaceRole
) {
  const { workspaceId, clientName } = await getClientWorkspace(clientId);
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data, error } = await supabase
      .from("client_memberships")
      .update({ role })
      .eq("id", membershipId)
      .eq("client_id", clientId)
      .select("id, client_id, user_id, role, created_at")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("Client membership not found.");
    }

    const membership = mapClientMembershipRow(
      data as Parameters<typeof mapClientMembershipRow>[0]
    );

    const { data: memberRow } = await supabase
      .from("workspace_memberships")
      .select("full_name,email")
      .eq("user_id", membership.userId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    const event = await recordClientMembershipEvent({
      id: `evt-${Date.now()}`,
      workspaceId,
      clientId,
      actorName: "Workspace admin",
      actionLabel: "updated",
      subjectType: "workspace",
      subjectName: memberRow?.email ?? membership.userId,
      detail: `${memberRow?.full_name ?? "Operator"} updated on ${clientName} to ${role}.`,
      createdAt: new Date().toISOString()
    });

    return {
      membership: {
        ...membership,
        fullName: memberRow?.full_name,
        email: memberRow?.email
      },
      event
    };
  }

  const snapshot = getClientSnapshot(clientId);
  const existing = snapshot.find((membership) => membership.id === membershipId);

  if (!existing) {
    throw new Error("Client membership not found.");
  }

  existing.role = role;

  return { membership: existing, event: null };
}
