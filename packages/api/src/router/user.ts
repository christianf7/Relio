import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { protectedProcedure } from "../trpc";

export const userRouter = {
  // --------------getUserById-----------------------------------------
  getUserById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.db.user.findUnique({
        where: { id: input.id },
      });
    }),

  // --------------updateProfile-----------------------------------------
  updateProfile: protectedProcedure
    .input(
      z.object({
        slug: z.string().min(1).optional(),
        displayName: z.string().min(4).optional(),
        bio: z.string().nullable().optional(),
        socials: z
          .object({
            githubUrl: z.string().nullable().optional(),
            linkedInUrl: z.string().nullable().optional(),
            discordUrl: z.string().nullable().optional()
          })
          .optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      return ctx.db.user.update({
        where: {
          id: ctx.session.user.id,
        },
        data: input,
      });
    }),
    // --------------connectById-----------------------------------------
    
} satisfies TRPCRouterRecord;
