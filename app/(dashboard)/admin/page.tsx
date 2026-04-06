"use client";

import { useState } from "react";
import { ShieldCheck, Users } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ListCard } from "@/components/dashboard/list-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatGrid } from "@/components/dashboard/stat-grid";
import { MetricCard } from "@/components/metric-card";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { useActiveClient } from "@/lib/client-context";
import { useClientMemberships } from "@/lib/repositories/use-client-memberships";
import { useWorkspaceContext } from "@/lib/workspace-context";
import type { WorkspaceMember } from "@/types";

const emptyInvite = {
  fullName: "",
  email: "",
  role: "strategist" as WorkspaceMember["role"],
  status: "Invited" as WorkspaceMember["status"]
};

export default function AdminPage() {
  const { activeClient, clients } = useActiveClient();
  const { errorMessage, isAdmin, mode, profile, session } = useAuth();
  const { addMember, error, members, updateMember, workspace } = useWorkspaceContext();
  const {
    memberships,
    ready: membershipsReady,
    error: membershipError,
    addMembership,
    updateMembership
  } = useClientMemberships(activeClient.id);
  const [inviteDraft, setInviteDraft] = useState(emptyInvite);
  const [assignmentDraft, setAssignmentDraft] = useState({
    userId: "",
    role: "strategist" as WorkspaceMember["role"]
  });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (mode === "local") {
    return (
      <div className="space-y-10">
        <PageHeader
          eyebrow="Admin"
          title="Admin scaffolding is ready"
          description="Connect Supabase auth to enable workspace sign-in, role-aware access, and client membership controls."
        />
        <EmptyState
          title="Supabase not configured"
          description={errorMessage ?? "Set the public Supabase URL and anon key to enable admin mode."}
        />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-10">
        <PageHeader
          eyebrow="Admin"
          title="Admin access required"
          description="This area is reserved for platform administrators managing staff access and client entitlements."
        />
        <EmptyState
          title="Insufficient permissions"
          description="Promote your profile to role = admin in the profiles table to unlock the admin workspace."
        />
      </div>
    );
  }

  const handleInvite = () => {
    setSaving(true);
    setSaveError(null);

    void addMember({
      workspaceId: workspace.id,
      fullName: inviteDraft.fullName.trim(),
      email: inviteDraft.email.trim(),
      role: inviteDraft.role,
      status: inviteDraft.status
    })
      .then(() => {
        setInviteDraft(emptyInvite);
      })
      .catch((inviteError) => {
        setSaveError(
          inviteError instanceof Error
            ? inviteError.message
            : "Unable to add workspace member."
        );
      })
      .finally(() => {
        setSaving(false);
      });
  };

  const handleRoleUpdate = (memberId: string, role: WorkspaceMember["role"]) => {
    void updateMember(memberId, { workspaceId: workspace.id, role }).catch((updateError) => {
      setSaveError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update workspace member."
      );
    });
  };

  const assignableMembers = members.filter((member) => member.userId);

  const handleAssignment = () => {
    if (!assignmentDraft.userId) {
      setSaveError("Select a workspace member before assigning client access.");
      return;
    }

    setSaveError(null);

    void addMembership({
      clientId: activeClient.id,
      userId: assignmentDraft.userId,
      role: assignmentDraft.role
    }).catch((assignmentError) => {
      setSaveError(
        assignmentError instanceof Error
          ? assignmentError.message
          : "Unable to assign client access."
      );
    });
  };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Admin"
        title="Agency access and platform control"
        description="This scaffold gives you a real foundation for user access, client memberships, and operational ownership as Neighborhood Media OS grows beyond a single workspace."
      />

      <StatGrid>
        <MetricCard
          label="Workspace Mode"
          value="Supabase"
          detail="Authenticated multi-user mode is active."
        />
        <MetricCard
          label="Admin Role"
          value={profile?.role ?? "unknown"}
          detail="Profile role currently attached to this session."
        />
        <MetricCard
          label="Visible Clients"
          value={String(clients.length)}
          detail="Clients currently available to the signed-in user."
        />
        <MetricCard
          label="Workspace Seats"
          value={`${members.length}/${workspace.seatCount}`}
          detail="Operational team footprint versus purchased seat capacity."
        />
        <MetricCard
          label="Session State"
          value={session ? "Active" : "Signed Out"}
          detail="Supabase auth session health for the current browser."
          tone="olive"
        />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardDescription>Current Admin</CardDescription>
              <CardTitle className="mt-3">Signed-in operator</CardTitle>
            </div>
          </CardHeader>
          <ListCard>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">{profile?.fullName ?? profile?.email ?? "Unknown"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{profile?.email ?? "No email on profile"}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-primary">
                  Role: {profile?.role ?? "unknown"}
                </p>
              </div>
            </div>
          </ListCard>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardDescription>Workspace Access</CardDescription>
              <CardTitle className="mt-3">Invite operator</CardTitle>
            </div>
          </CardHeader>
          <div className="grid gap-4">
            <div>
              <Label>Full name</Label>
              <Input
                value={inviteDraft.fullName}
                onChange={(event) =>
                  setInviteDraft((current) => ({ ...current, fullName: event.target.value }))
                }
                placeholder="Avery Strategist"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={inviteDraft.email}
                onChange={(event) =>
                  setInviteDraft((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="avery@agency.com"
              />
            </div>
            <div>
              <Label>Role</Label>
              <select
                className="flex h-11 w-full rounded-xl border border-border bg-card/70 px-4 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                value={inviteDraft.role}
                onChange={(event) =>
                  setInviteDraft((current) => ({
                    ...current,
                    role: event.target.value as WorkspaceMember["role"]
                  }))
                }
              >
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="strategist">Strategist</option>
                <option value="operator">Operator</option>
                <option value="client-viewer">Client Viewer</option>
              </select>
            </div>
            <Button onClick={handleInvite} disabled={saving}>
              {saving ? "Saving..." : "Add workspace member"}
            </Button>
            {saveError || error ? (
              <p className="text-xs text-primary">{saveError ?? error}</p>
            ) : null}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardDescription>Workspace Team</CardDescription>
            <CardTitle className="mt-3">Roles and seat assignments</CardTitle>
          </div>
        </CardHeader>
        <div className="space-y-3">
          {members.map((member) => (
            <ListCard key={member.id}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-medium text-foreground">{member.fullName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{member.email}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-primary">
                    {member.status}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    className="flex h-11 rounded-xl border border-border bg-card/70 px-4 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                    value={member.role}
                    onChange={(event) =>
                      handleRoleUpdate(member.id, event.target.value as WorkspaceMember["role"])
                    }
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="strategist">Strategist</option>
                    <option value="operator">Operator</option>
                    <option value="client-viewer">Client Viewer</option>
                  </select>
                </div>
              </div>
            </ListCard>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardDescription>Client Access</CardDescription>
            <CardTitle className="mt-3">Client assignments</CardTitle>
          </div>
        </CardHeader>
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-3">
            {clients.map((client) => (
              <ListCard key={client.id}>
                <div className="flex items-start gap-3">
                  <Users className="mt-1 h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{client.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {client.segment} · {client.location}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-primary">
                      {client.id === activeClient.id ? "Selected" : client.status}
                    </p>
                  </div>
                </div>
              </ListCard>
            ))}
          </div>
          <div className="space-y-4">
            <ListCard>
              <div className="grid gap-4">
                <div>
                  <p className="font-medium text-foreground">{activeClient.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Assign who can operate inside this account.
                  </p>
                </div>
                <div>
                  <Label>Workspace member</Label>
                  <select
                    className="flex h-11 w-full rounded-xl border border-border bg-card/70 px-4 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                    value={assignmentDraft.userId}
                    onChange={(event) =>
                      setAssignmentDraft((current) => ({
                        ...current,
                        userId: event.target.value
                      }))
                    }
                  >
                    <option value="">Select a member</option>
                    {assignableMembers.map((member) => (
                      <option key={member.id} value={member.userId}>
                        {member.fullName} · {member.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Client role</Label>
                  <select
                    className="flex h-11 w-full rounded-xl border border-border bg-card/70 px-4 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                    value={assignmentDraft.role}
                    onChange={(event) =>
                      setAssignmentDraft((current) => ({
                        ...current,
                        role: event.target.value as WorkspaceMember["role"]
                      }))
                    }
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="strategist">Strategist</option>
                    <option value="operator">Operator</option>
                    <option value="client-viewer">Client Viewer</option>
                  </select>
                </div>
                <Button onClick={handleAssignment}>Assign to client</Button>
              </div>
            </ListCard>

            {membershipsReady ? (
              memberships.length ? (
                memberships.map((membership) => (
                  <ListCard key={membership.id}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="font-medium text-foreground">
                          {membership.fullName ?? membership.email ?? membership.userId}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {membership.email ?? membership.userId}
                        </p>
                      </div>
                      <select
                        className="flex h-11 rounded-xl border border-border bg-card/70 px-4 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                        value={membership.role}
                        onChange={(event) =>
                          void updateMembership(membership.id, {
                            clientId: activeClient.id,
                            role: event.target.value as WorkspaceMember["role"]
                          }).catch((updateError) => {
                            setSaveError(
                              updateError instanceof Error
                                ? updateError.message
                                : "Unable to update client role."
                            );
                          })
                        }
                      >
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="strategist">Strategist</option>
                        <option value="operator">Operator</option>
                        <option value="client-viewer">Client Viewer</option>
                      </select>
                    </div>
                  </ListCard>
                ))
              ) : (
                <EmptyState
                  title="No client assignments yet"
                  description="Assign at least one operator so this account is visible to the right team."
                />
              )
            ) : (
              <p className="text-sm text-muted-foreground">Loading client assignments...</p>
            )}

            {membershipError ? (
              <p className="text-xs text-primary">{membershipError}</p>
            ) : null}
          </div>
        </div>
      </Card>
    </div>
  );
}
