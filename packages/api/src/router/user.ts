import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { protectedProcedure } from "../trpc";

export const userRouter = {
  // I replaced the unsafe getUserById with this @getMe as the other one could be ran by any user responding with ALL their data.
  getMe: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      include: {
        _count: {
          select: {
            connections: true,
            connectedBy: true,
            upcomingEvents: true,
            organisedEvents: true,
          },
        },
      },
    });

    if (!user) return null;

    const connectionsCount =
      user._count.connections + user._count.connectedBy;
    const eventsCount =
      user._count.upcomingEvents + user._count.organisedEvents;

    const { _count, ...rest } = user;
    return {
      ...rest,
      connectionsCount,
      eventsCount,
    };
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        slug: z.string().min(1).optional(),
        displayName: z.string().min(1).optional(),
        bio: z.string().nullable().optional(),
        image: z.string().nullable().optional(),
        enrolledUnits: z
          .array(
            z.object({
              code: z.string().min(1),
              university: z.string().min(1),
            }),
          )
          .optional(),
        socials: z
          .object({
            githubUrl: z.string().nullable().optional(),
            linkedInUrl: z.string().nullable().optional(),
            discordUrl: z.string().nullable().optional(),
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
} satisfies TRPCRouterRecord;
