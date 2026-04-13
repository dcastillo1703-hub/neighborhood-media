import { z } from "zod";

export const createPostSchema = z.object({
  clientId: z.string().min(1),
  platform: z.enum(["Instagram", "Facebook", "Stories", "TikTok", "Email"]),
  format: z.enum(["Static", "Carousel", "Reel", "Story", "Email", "Offer"]).optional(),
  content: z.string().trim().min(1),
  cta: z.string().trim().min(1),
  destinationUrl: z.string().trim().min(1).optional(),
  publishDate: z.string().optional(),
  goal: z.string().trim().min(1),
  status: z.enum(["Draft", "Scheduled", "Published"]),
  approvalState: z.enum(["Pending", "Approved", "Changes Requested"]).optional(),
  publishState: z.enum(["Queued", "Processing", "Published", "Blocked", "Failed"]).optional(),
  assetState: z.enum(["Missing", "In Progress", "Ready"]).optional(),
  linkedTaskId: z.string().optional(),
  plannerItemId: z.string().optional(),
  campaignId: z.string().optional(),
  assetIds: z.array(z.string()).default([])
});

export const updatePostSchema = createPostSchema.partial().extend({
  clientId: z.string().min(1)
});

export type UpdatePostInput = z.infer<typeof updatePostSchema>;
