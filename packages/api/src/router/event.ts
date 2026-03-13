import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { protectedProcedure } from "../trpc";

export const eventRouter = {
  getEvents: protectedProcedure.query(({ ctx }) => {
    return ctx.db.event.findMany({
      take: 50,
      orderBy: { date: "desc" },
      include: {
        organisers: {
          select: { id: true, name: true },
        },
        participants: {
          select: { id: true },
        },
      },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.db.event.findUnique({
        where: { id: input.id },
        include: {
          organisers: {
            select: { id: true, name: true },
          },
          participants: {
            select: { id: true, name: true },
          },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        date: z.string(),
        location: z.string().min(1),
        content: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const eventDate = new Date(input.date);
      if (isNaN(eventDate.getTime())) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid date format",
        });
      }

      return ctx.db.event.create({
        data: {
          title: input.title,
          date: eventDate,
          location: input.location,
          content: input.content ?? null,
          organisers: {
            connect: { id: ctx.session.user.id },
          },
        },
      });
    }),

  updateById: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          title: z.string().optional(),
          date: z.string().optional(),
          location: z.string().optional(),
          content: z.string().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organiserEvent = await ctx.db.event.findFirst({
        where: {
          id: input.id,
          organisers: {
            some: { id: ctx.session.user.id },
          },
        },
        select: { id: true },
      });

      if (!organiserEvent) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const data: Record<string, unknown> = { ...input.data };
      if (typeof data.date === "string") {
        const parsed = new Date(data.date);
        if (isNaN(parsed.getTime())) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid date format",
          });
        }
        data.date = parsed;
      }

      return ctx.db.event.update({
        where: { id: input.id },
        data,
      });
    }),

  joinById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.event.update({
        where: { id: input.id },
        data: {
          participants: {
            connect: { id: ctx.session.user.id },
          },
        },
      });
    }),

  leaveById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.event.update({
        where: { id: input.id },
        data: {
          participants: {
            disconnect: { id: ctx.session.user.id },
          },
        },
      });
    }),

  deleteById: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const organiserEvent = await ctx.db.event.findFirst({
        where: {
          id: input,
          organisers: {
            some: { id: ctx.session.user.id },
          },
        },
        select: { id: true },
      });

      if (!organiserEvent) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.event.delete({ where: { id: input } });
    }),
} satisfies TRPCRouterRecord;
