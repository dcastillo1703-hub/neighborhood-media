import { z } from "zod";

export const createCampaignSchema = z
  .object({
    clientId: z.string().min(1),
    name: z.string().trim().min(1),
    objective: z.string().trim().min(1),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    channels: z.array(z.string().trim().min(1)).min(1),
    linkedPostIds: z.array(z.string()).default([]),
    linkedBlogPostIds: z.array(z.string()).default([]),
    linkedAssetIds: z.array(z.string()).default([]),
    linkedWeeklyMetricIds: z.array(z.string()).default([]),
    notes: z.string().default(""),
    status: z.enum(["Planning", "Active", "Completed"])
  })
  .superRefine((value, context) => {
    if (value.endDate < value.startDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must be after start date."
      });
    }
  });

export const archiveCampaignSchema = z.object({
  clientId: z.string().min(1)
});
