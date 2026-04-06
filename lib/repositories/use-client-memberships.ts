"use client";

import { useEffect, useState } from "react";

import type { ClientMembership, WorkspaceMember } from "@/types";

export type ClientMembershipRecord = ClientMembership & {
  fullName?: string;
  email?: string;
};

export function useClientMemberships(clientId: string) {
  const [memberships, setMemberships] = useState<ClientMembershipRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setReady(false);
      setError(null);

      try {
        const response = await fetch(
          `/api/client-memberships?clientId=${encodeURIComponent(clientId)}`,
          {
            method: "GET",
            cache: "no-store"
          }
        );

        if (!response.ok) {
          throw new Error("Failed to load client memberships.");
        }

        const payload = (await response.json()) as {
          memberships: ClientMembershipRecord[];
        };

        if (active) {
          setMemberships(payload.memberships);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load client memberships."
          );
          setMemberships([]);
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
    memberships,
    ready,
    error,
    async addMembership(input: {
      clientId: string;
      userId: string;
      role: WorkspaceMember["role"];
    }) {
      const response = await fetch("/api/client-memberships", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        throw new Error("Failed to add client membership.");
      }

      const payload = (await response.json()) as {
        membership: ClientMembershipRecord;
      };

      setMemberships((current) => {
        const existingIndex = current.findIndex(
          (membership) => membership.userId === payload.membership.userId
        );

        if (existingIndex >= 0) {
          return current.map((membership, index) =>
            index === existingIndex ? payload.membership : membership
          );
        }

        return [...current, payload.membership];
      });

      return payload;
    },
    async updateMembership(
      membershipId: string,
      input: { clientId: string; role: WorkspaceMember["role"] }
    ) {
      const response = await fetch(`/api/client-memberships/${membershipId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        throw new Error("Failed to update client membership.");
      }

      const payload = (await response.json()) as {
        membership: ClientMembershipRecord;
      };

      setMemberships((current) =>
        current.map((membership) =>
          membership.id === membershipId ? payload.membership : membership
        )
      );

      return payload;
    }
  };
}
