import { z } from "zod";

export const createWeeklyMetricSchema = z.object({
  clientId: z.string().min(1),
  weekLabel: z.string().trim().min(1),
  covers: z.number().positive(),
  netSales: z.number().nonnegative().optional(),
  totalOrders: z.number().nonnegative().optional(),
  notes: z.string().default(""),
  campaignAttribution: z.string().default(""),
  campaignId: z.string().optional()
});
