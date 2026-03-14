import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { protectedProcedure } from "../trpc";

export const messageRouter = {
  getDirectMessages: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        cursor: z.string().optional(),
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
          sender: {
            select: { id: true, name: true, displayName: true, image: true },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        take: input.take ?? 50,
      });
    }),

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
          sender: {
            select: { id: true, name: true, displayName: true, image: true },
          },
        },
      });
    }),

  getConversations: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const messages = await ctx.db.message.findMany({
      where: {
        eventId: null,
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        sender: {
          select: { id: true, name: true, displayName: true, image: true },
        },
        receiver: {
          select: { id: true, name: true, displayName: true, image: true },
        },
      },
    });

    const conversationMap = new Map<
      string,
      {
        otherUser: {
          id: string;
          name: string;
          displayName: string | null;
          image: string | null;
        };
        lastMessage: string;
        lastMessageAt: Date;
        lastMessageSenderId: string;
        unreadCount: number;
      }
    >();

    for (const msg of messages) {
      const otherId =
        msg.senderId === userId ? msg.receiverId! : msg.senderId;
      if (!otherId) continue;

      if (!conversationMap.has(otherId)) {
        const otherUser =
          msg.senderId === userId ? msg.receiver! : msg.sender;
        conversationMap.set(otherId, {
          otherUser: {
            id: otherUser.id,
            name: otherUser.name,
            displayName: otherUser.displayName,
            image: otherUser.image,
          },
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          lastMessageSenderId: msg.senderId,
          unreadCount: 0,
        });
      }

      if (
        msg.receiverId === userId &&
        msg.senderId !== userId &&
        !msg.readAt
      ) {
        const entry = conversationMap.get(otherId)!;
        entry.unreadCount += 1;
      }
    }

    return [...conversationMap.values()].sort(
      (a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime(),
    );
  }),

  getUnreadDmCount: protectedProcedure.query(({ ctx }) => {
    return ctx.db.message.count({
      where: {
        receiverId: ctx.session.user.id,
        senderId: { not: ctx.session.user.id },
        eventId: null,
        readAt: null,
      },
    });
  }),

  markConversationRead: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.message.updateMany({
        where: {
          senderId: input.userId,
          receiverId: ctx.session.user.id,
          eventId: null,
          readAt: null,
        },
        data: { readAt: new Date() },
      });
    }),

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
            { organisers: { some: { id: ctx.session.user.id } } },
            { participants: { some: { id: ctx.session.user.id } } },
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
        where: { eventId: input.eventId },
        include: {
          sender: {
            select: { id: true, name: true, displayName: true, image: true },
          },
        },
        orderBy: { createdAt: "asc" },
        take: input.take ?? 50,
      });
    }),

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
            { organisers: { some: { id: ctx.session.user.id } } },
            { participants: { some: { id: ctx.session.user.id } } },
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
          sender: {
            select: { id: true, name: true, displayName: true, image: true },
          },
        },
      });
    }),

  deleteMessageById: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.db.message.findUnique({
        where: { id: input.messageId },
        select: { id: true, senderId: true, eventId: true },
      });

      if (!message) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found.",
        });
      }

      const isSender = message.senderId === ctx.session.user.id;

      if (message.eventId) {
        const isOrganiser = await ctx.db.event.findFirst({
          where: {
            id: message.eventId,
            organisers: { some: { id: ctx.session.user.id } },
          },
          select: { id: true },
        });
        if (!isSender && !isOrganiser) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      } else if (!isSender) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.message.delete({
        where: { id: input.messageId },
      });
    }),
} satisfies TRPCRouterRecord;
