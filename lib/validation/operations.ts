import { z } from "zod";

const taskStatusSchema = z.enum(["Backlog", "In Progress", "Waiting", "Done"]);
const taskPrioritySchema = z.enum(["Low", "Medium", "High"]);

export const createOperationalTaskSchema = z.object({
  workspaceId: z.string().min(1),
  clientId: z.string().min(1).optional(),
  title: z.string().trim().min(2).max(140),
  detail: z.string().trim().min(2).max(600),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  dueDate: z.string().min(1).optional(),
  assigneeUserId: z.string().min(1).optional(),
  assigneeName: z.string().min(1).optional(),
  linkedEntityType: z.enum(["campaign", "post", "integration", "metric"]).optional(),
  linkedEntityId: z.string().min(1).optional()
});

export const updateOperationalTaskStatusSchema = z.object({
  workspaceId: z.string().min(1),
  status: taskStatusSchema
});

export const updateOperationalTaskSchema = createOperationalTaskSchema.partial().extend({
  workspaceId: z.string().min(1)
});

export const listOperationsQuerySchema = z.object({
  workspaceId: z.string().min(1),
  clientId: z.string().min(1).optional()
});

export type CreateOperationalTaskInput = z.infer<typeof createOperationalTaskSchema>;
export type UpdateOperationalTaskStatusInput = z.infer<typeof updateOperationalTaskStatusSchema>;
export type UpdateOperationalTaskInput = z.infer<typeof updateOperationalTaskSchema>;
export type ListOperationsQuery = z.infer<typeof listOperationsQuerySchema>;
