import { z } from "zod/v4";

export const CreatePostSchema = z.object({
  title: z.string().max(256),
  content: z.string().max(256),
});
