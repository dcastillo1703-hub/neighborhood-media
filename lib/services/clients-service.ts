import { meamaClient, seededClients } from "@/data/seed";
import { mapClientRow } from "@/lib/supabase/mappers";

async function getCurrentAccessProfile() {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You must be signed in to access clients.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    supabase,
    userId: user.id,
    isAdmin: profile?.role === "admin"
  };
}

export async function listVisibleClients(workspaceId = "ws-neighborhood") {
  const access = await getCurrentAccessProfile();

  if (!access) {
    return seededClients.filter((client) => client.workspaceId === workspaceId);
  }

  const { supabase, userId, isAdmin } = access;

  if (isAdmin) {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return ((data ?? []) as Array<Parameters<typeof mapClientRow>[0]>).map(mapClientRow);
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("client_memberships")
    .select("client_id")
    .eq("user_id", userId);

  if (membershipError) {
    throw membershipError;
  }

  const clientIds = (memberships ?? []).map((membership: { client_id: string }) => membership.client_id);

  if (!clientIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .in("id", clientIds)
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<Parameters<typeof mapClientRow>[0]>).map(mapClientRow);
}

export async function getDefaultVisibleClient(workspaceId = "ws-neighborhood") {
  const clients = await listVisibleClients(workspaceId);
  return clients[0] ?? meamaClient;
}
