import { z } from "zod";

const workspaceRoleSchema = z.enum([
  "owner",
  "admin",
  "strategist",
  "operator",
  "client-viewer"
]);

const membershipStatusSchema = z.enum(["Active", "Invited"]);

export const listWorkspaceMembersQuerySchema = z.object({
  workspaceId: z.string().min(1, "workspaceId is required.")
});

export const createWorkspaceMemberSchema = z.object({
  workspaceId: z.string().min(1, "workspaceId is required."),
  fullName: z.string().trim().min(2, "Full name is required."),
  email: z.string().trim().email("Valid email is required."),
  role: workspaceRoleSchema,
  status: membershipStatusSchema.default("Invited")
});

export const updateWorkspaceMemberSchema = z.object({
  workspaceId: z.string().min(1, "workspaceId is required."),
  role: workspaceRoleSchema.optional(),
  status: membershipStatusSchema.optional()
});
