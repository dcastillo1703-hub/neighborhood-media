import { z } from "zod";

export const createPlannerItemSchema = z.object({
  clientId: z.string().min(1),
  dayOfWeek: z.enum([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
  ]),
  platform: z.enum(["Instagram", "Facebook", "Stories", "TikTok", "Email"]),
  contentType: z.string().trim().min(1),
  campaignGoal: z.string().trim().min(1),
  status: z.enum(["Draft", "Scheduled", "Published"]),
  caption: z.string().trim().min(1),
  campaignId: z.string().optional()
});

export const updatePlannerItemStatusSchema = z.object({
  clientId: z.string().min(1),
  status: z.enum(["Draft", "Scheduled", "Published"])
});
