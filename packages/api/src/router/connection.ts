import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { protectedProcedure } from "../trpc";
import { syncUserConnectionsToEs } from "../es-sync";

export const connectionRouter = {
  requestConnection: protectedProcedure
    .input(z.object({ receiverId: z.string(), message: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (input.receiverId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot send a connection request to yourself.",
        });
      }

      const receiver = await ctx.db.user.findUnique({
        where: { id: input.receiverId },
        select: { id: true },
      });

      if (!receiver) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      }

      const existingRequest = await ctx.db.connectionRequest.findFirst({
        where: {
          OR: [
            {
              senderId: ctx.session.user.id,
              receiverId: input.receiverId,
            },
            {
              senderId: input.receiverId,
              receiverId: ctx.session.user.id,
            },
          ],
          status: "PENDING",
        },
        select: { id: true },
      });

      if (existingRequest) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A pending connection request already exists.",
        });
      }

      return ctx.db.connectionRequest.create({
        data: {
          senderId: ctx.session.user.id,
          receiverId: input.receiverId,
          message: input.message,
        },
      });
    }),

  getIncomingRequests: protectedProcedure.query(({ ctx }) => {
    return ctx.db.connectionRequest.findMany({
      where: {
        receiverId: ctx.session.user.id,
        status: "PENDING",
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            displayName: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }),

  getOutgoingRequests: protectedProcedure.query(({ ctx }) => {
    return ctx.db.connectionRequest.findMany({
      where: {
        senderId: ctx.session.user.id,
        status: "PENDING",
      },
      include: {
        receiver: {
          select: {
            id: true,
            name: true,
            displayName: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }),

  acceptConnection: protectedProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.connectionRequest.findUnique({
        where: { id: input.requestId },
        select: {
          id: true,
          senderId: true,
          receiverId: true,
          status: true,
        },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found.",
        });
      }

      if (request.receiverId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (request.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending requests can be accepted.",
        });
      }

      await ctx.db.connectionRequest.update({
        where: { id: input.requestId },
        data: { status: "ACCEPTED" },
      });

      const result = await ctx.db.user.update({
        where: { id: request.receiverId },
        data: {
          connections: { connect: { id: request.senderId } },
        },
      });

      void syncUserConnectionsToEs(ctx.es, ctx.db, request.receiverId);
      void syncUserConnectionsToEs(ctx.es, ctx.db, request.senderId);

      return result;
    }),

  declineConnection: protectedProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.connectionRequest.findUnique({
        where: { id: input.requestId },
        select: { id: true, receiverId: true, status: true },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found.",
        });
      }

      if (request.receiverId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (request.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending requests can be declined.",
        });
      }

      return ctx.db.connectionRequest.update({
        where: { id: input.requestId },
        data: { status: "DECLINED" },
      });
    }),

  cancelOutgoingRequest: protectedProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.connectionRequest.findUnique({
        where: { id: input.requestId },
        select: { id: true, senderId: true, status: true },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found.",
        });
      }

      if (request.senderId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (request.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending requests can be cancelled.",
        });
      }

      return ctx.db.connectionRequest.delete({
        where: { id: input.requestId },
      });
    }),

  getConnections: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      include: {
        connections: {
          select: {
            id: true,
            name: true,
            displayName: true,
            image: true,
          },
        },
        connectedBy: {
          select: {
            id: true,
            name: true,
            displayName: true,
            image: true,
          },
        },
      },
    });

    if (!user) return [];

    const allConnections = [...user.connections, ...user.connectedBy];
    const seen = new Set<string>();
    const unique = allConnections.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    const connectionIds = unique.map((c) => c.id);

    const requests = await ctx.db.connectionRequest.findMany({
      where: {
        status: "ACCEPTED",
        OR: [
          {
            senderId: ctx.session.user.id,
            receiverId: { in: connectionIds },
          },
          {
            senderId: { in: connectionIds },
            receiverId: ctx.session.user.id,
          },
        ],
      },
      select: {
        senderId: true,
        receiverId: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    const connectedAtMap = new Map<string, Date>();
    for (const req of requests) {
      const otherId =
        req.senderId === ctx.session.user.id ? req.receiverId : req.senderId;
      if (!connectedAtMap.has(otherId)) {
        connectedAtMap.set(otherId, req.updatedAt);
      }
    }

    return unique
      .map((c) => ({
        ...c,
        connectedAt: connectedAtMap.get(c.id) ?? new Date(0),
      }))
      .sort(
        (a, b) =>
          new Date(b.connectedAt).getTime() -
          new Date(a.connectedAt).getTime(),
      );
  }),

  connectViaQr: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot connect with yourself.",
        });
      }

      const targetUser = await ctx.db.user.findUnique({
        where: { id: input.userId },
        select: { id: true, name: true, displayName: true, image: true },
      });

      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      }

      const existingConnection = await ctx.db.user.findFirst({
        where: {
          id: ctx.session.user.id,
          OR: [
            { connections: { some: { id: input.userId } } },
            { connectedBy: { some: { id: input.userId } } },
          ],
        },
        select: { id: true },
      });

      if (existingConnection) {
        return { alreadyConnected: true, user: targetUser };
      }

      await ctx.db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: ctx.session.user.id },
          data: { connections: { connect: { id: input.userId } } },
        });

        const existing = await tx.connectionRequest.findFirst({
          where: {
            OR: [
              { senderId: ctx.session.user.id, receiverId: input.userId },
              { senderId: input.userId, receiverId: ctx.session.user.id },
            ],
          },
          select: { id: true },
        });

        if (existing) {
          await tx.connectionRequest.update({
            where: { id: existing.id },
            data: { status: "ACCEPTED" },
          });
        } else {
          await tx.connectionRequest.create({
            data: {
              senderId: ctx.session.user.id,
              receiverId: input.userId,
              status: "ACCEPTED",
            },
          });
        }
      });

      void syncUserConnectionsToEs(ctx.es, ctx.db, ctx.session.user.id);
      void syncUserConnectionsToEs(ctx.es, ctx.db, input.userId);

      return { alreadyConnected: false, user: targetUser };
    }),

  removeConnection: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: {
          connections: { disconnect: { id: input.userId } },
          connectedBy: { disconnect: { id: input.userId } },
        },
      });

      void syncUserConnectionsToEs(ctx.es, ctx.db, ctx.session.user.id);
      void syncUserConnectionsToEs(ctx.es, ctx.db, input.userId);

      return result;
    }),
} satisfies TRPCRouterRecord;
