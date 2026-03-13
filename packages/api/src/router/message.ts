import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { protectedProcedure } from "../trpc";

export const messageRouter = {
  // --------------getDirectMessages-----------------------------------------
  getDirectMessages: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        take: z.number().int().positive().max(100).optional(),
      }),
    )
    .query(({ ctx, input }) => {
      return ctx.db.message.findMany({
        where: {
          OR: [
            {
              senderId: ctx.session.user.id,
              receiverId: input.userId,
            },
            {
              senderId: input.userId,
              receiverId: ctx.session.user.id,
            },
          ],
          eventId: null,
        },
        include: {
          sender: true,
          receiver: true,
        },
        orderBy: {
          createdAt: "asc",
        },
        take: input.take ?? 50,
      });
    }),

  // --------------sendDirectMessage-----------------------------------------
  sendDirectMessage: protectedProcedure
    .input(
      z.object({
        receiverId: z.string(),
        content: z.string().min(1).max(4000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.receiverId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot send a direct message to yourself.",
        });
      }

      const receiver = await ctx.db.user.findUnique({
        where: { id: input.receiverId },
        select: { id: true },
      });

      if (!receiver) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      }

      return ctx.db.message.create({
        data: {
          senderId: ctx.session.user.id,
          receiverId: input.receiverId,
          content: input.content,
        },
        include: {
          sender: true,
          receiver: true,
        },
      });
    }),

  // --------------getEventMessages-----------------------------------------
  getEventMessages: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        take: z.number().int().positive().max(100).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const event = await ctx.db.event.findFirst({
        where: {
          id: input.eventId,
          OR: [
            {
              organisers: {
                some: {
                  id: ctx.session.user.id,
                },
              },
            },
            {
              participants: {
                some: {
                  id: ctx.session.user.id,
                },
              },
            },
          ],
        },
        select: { id: true },
      });

      if (!event) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this event's messages.",
        });
      }

      return ctx.db.message.findMany({
        where: {
          eventId: input.eventId,
        },
        include: {
          sender: true,
        },
        orderBy: {
          createdAt: "asc",
        },
        take: input.take ?? 50,
      });
    }),

  // --------------sendEventMessage-----------------------------------------
  sendEventMessage: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        content: z.string().min(1).max(4000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.db.event.findFirst({
        where: {
          id: input.eventId,
          OR: [
            {
              organisers: {
                some: {
                  id: ctx.session.user.id,
                },
              },
            },
            {
              participants: {
                some: {
                  id: ctx.session.user.id,
                },
              },
            },
          ],
        },
        select: { id: true },
      });

      if (!event) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this event.",
        });
      }

      return ctx.db.message.create({
        data: {
          senderId: ctx.session.user.id,
          eventId: input.eventId,
          content: input.content,
        },
        include: {
          sender: true,
          event: true,
        },
      });
    }),

  // --------------deleteMessageById-----------------------------------------
  deleteMessageById: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.db.message.findUnique({
        where: { id: input.messageId },
        select: { id: true, senderId: true },
      });

      if (!message) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found.",
        });
      }

      if (message.senderId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.message.delete({
        where: { id: input.messageId },
      });
    }),
} satisfies TRPCRouterRecord;
