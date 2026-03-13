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
