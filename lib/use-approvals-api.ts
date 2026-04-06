"use client";

import { useEffect, useState } from "react";

import type { ActivityEvent, ApprovalRequest } from "@/types";

type ApprovalsResponse = {
  approvals: ApprovalRequest[];
};

export function useApprovalsApi(clientId: string) {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setReady(false);
      setError(null);

      try {
        const response = await fetch(`/api/approvals?clientId=${encodeURIComponent(clientId)}`, {
          method: "GET",
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("Failed to load approvals.");
        }

        const payload = (await response.json()) as ApprovalsResponse;

        if (active) {
          setApprovals(payload.approvals);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load approvals.");
          setApprovals([]);
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
    approvals,
    ready,
    error,
    async reviewApproval(
      approvalId: string,
      input: {
        status: "Approved" | "Changes Requested";
        note?: string;
        approverName: string;
        approverUserId?: string;
      }
    ) {
      const response = await fetch(`/api/approvals/${approvalId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ clientId, ...input })
      });

      if (!response.ok) {
        throw new Error("Failed to review approval.");
      }

      const payload = (await response.json()) as {
        approval: ApprovalRequest;
        event: ActivityEvent;
      };

      setApprovals((current) =>
        current.map((approval) =>
          approval.id === approvalId ? payload.approval : approval
        )
      );

      return payload;
    },
    prependApproval(approval: ApprovalRequest) {
      setApprovals((current) => [approval, ...current]);
    }
  };
}
