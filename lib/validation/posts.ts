import { z } from "zod";

export const createPostSchema = z.object({
  clientId: z.string().min(1),
  platform: z.enum(["Instagram", "Facebook", "Stories", "TikTok", "Email"]),
  content: z.string().trim().min(1),
  cta: z.string().trim().min(1),
  publishDate: z.string().min(1),
  goal: z.string().trim().min(1),
  status: z.enum(["Draft", "Scheduled", "Published"]),
  plannerItemId: z.string().optional(),
  campaignId: z.string().optional(),
  assetIds: z.array(z.string()).default([])
});
