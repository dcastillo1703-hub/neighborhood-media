import { z } from "zod";

export const listApprovalRequestsQuerySchema = z.object({
  clientId: z.string().min(1, "clientId is required.")
});

export const reviewApprovalRequestSchema = z.object({
  clientId: z.string().min(1, "clientId is required."),
  status: z.enum(["Approved", "Changes Requested"]),
  note: z.string().optional(),
  approverName: z.string().min(1, "approverName is required."),
  approverUserId: z.string().optional()
});
