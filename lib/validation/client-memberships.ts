import { z } from "zod";

const roleSchema = z.enum([
  "owner",
  "admin",
  "strategist",
  "operator",
  "client-viewer"
]);

export const listClientMembershipsQuerySchema = z.object({
  clientId: z.string().min(1, "clientId is required.")
});

export const createClientMembershipSchema = z.object({
  clientId: z.string().min(1, "clientId is required."),
  userId: z.string().min(1, "userId is required."),
  role: roleSchema
});

export const updateClientMembershipSchema = z.object({
  clientId: z.string().min(1, "clientId is required."),
  role: roleSchema
});
