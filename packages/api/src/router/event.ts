import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { protectedProcedure } from "../trpc";

export const eventRouter = {
  // --------------getEvents-----------------------------------------
  getEvents: protectedProcedure.query(({ ctx }) => {
    return ctx.db.event.findMany({
      take: 15,
    });
  }),
  // --------------getUsersInEvent-----------------------------------------
  getUsersInEvents: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const event = await ctx.db.event.findUnique({
        where: {
          id: input.id,
        },
        select: {
          id: true,
        },
      });

      if (!event) return {};

      return ctx.db.user.findMany({
        where: {
          upcomingEvents: {
            some: { id: input.id },
          },
        },
      });
    }),
  // --------------getSuggestedUsersInEvent-----------------------------------------
  getSuggestedUsersInEvents: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [event, currentUser] = await Promise.all([
        ctx.db.event.findUnique({
          where: { id: input.id },
          select: { id: true },
        }),
        ctx.db.user.findUnique({
          where: { id: ctx.session.user.id },
          select: {
            enrolledUnits: true,
            upcomingEvents: { select: { id: true } },
          },
        }),
      ]);

      if (!event || !currentUser) return [];

      const sharedEventIds = currentUser.upcomingEvents
        .map((e) => e.id)
        .filter((id) => id !== input.id);

      return ctx.db.user.findMany({
        where: {
          id: { not: ctx.session.user.id },
          OR: [
            ...(currentUser.enrolledUnits.length > 0
              ? [{ enrolledUnits: { hasSome: currentUser.enrolledUnits } }]
              : []),
            ...(sharedEventIds.length > 0
              ? [{ upcomingEvents: { some: { id: { in: sharedEventIds } } } }]
              : []),
          ],
        },
      });
    }),
  // --------------getById-----------------------------------------
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.db.event.findUnique({
        where: { id: input.id },
      });
    }),
  // --------------updateById-----------------------------------------
  updateById: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          name: z.string().optional(),
          date: z.string().optional(),
          location: z.string().optional(),
          content: z.string().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.db.event.findUnique({
        where: {
          id: input.id,
        },
        select: {
          id: true,
        },
      });

      if (!event) return {};

      const organiserEvent = await ctx.db.event.findFirst({
        where: {
          id: input.id,
          organisers: {
            some: {
              id: ctx.session.user.id,
            },
          },
        },
        select: {
          id: true,
        },
      });

      if (!organiserEvent) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.event.update({
        where: { id: input.id },
        data: input.data,
      });
    }),

  // --------------joinById-----------------------------------------
  joinById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.event.update({
        where: { id: input.id },
        data: {
          participants: {
            connect: {
              id: ctx.session.user.id,
            },
          },
        },
      });
    }),
  // --------------leaveById-----------------------------------------
  leaveById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.event.update({
        where: { id: input.id },
        data: {
          participants: {
            disconnect: {
              id: ctx.session.user.id,
            },
          },
        },
      });
    }),
  // --------------deleteById-----------------------------------------
  deleteById: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.db.event.findUnique({
        where: {
          id: input,
        },
        select: {
          id: true,
        },
      });

      if (!event) return {};

      const organiserEvent = await ctx.db.event.findFirst({
        where: {
          id: input,
          organisers: {
            some: {
              id: ctx.session.user.id,
            },
          },
        },
        select: {
          id: true,
        },
      });

      if (!organiserEvent) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.event.delete({ where: { id: input } });
    }),
} satisfies TRPCRouterRecord;
