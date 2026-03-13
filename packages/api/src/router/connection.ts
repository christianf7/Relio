import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { protectedProcedure } from "../trpc";

export const connectionRouter = {
  // --------------requestConnection-----------------------------------------
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

  // --------------getIncomingRequests-----------------------------------------
  getIncomingRequests: protectedProcedure.query(({ ctx }) => {
    return ctx.db.connectionRequest.findMany({
      where: {
        receiverId: ctx.session.user.id,
        status: "PENDING",
      },
      include: {
        sender: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }),

  // --------------getOutgoingRequests-----------------------------------------
  getOutgoingRequests: protectedProcedure.query(({ ctx }) => {
    return ctx.db.connectionRequest.findMany({
      where: {
        senderId: ctx.session.user.id,
        status: "PENDING",
      },
      include: {
        receiver: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }),

  // --------------acceptConnection-----------------------------------------
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

      return ctx.db.user.update({
        where: {
          id: request.receiverId,
        },
        data: {
          connections: {
            connect: {
              id: request.senderId,
            },
          },
        },
      });
    }),

  // --------------declineConnection-----------------------------------------
  declineConnection: protectedProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.connectionRequest.findUnique({
        where: { id: input.requestId },
        select: {
          id: true,
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
          message: "Only pending requests can be declined.",
        });
      }

      return ctx.db.connectionRequest.update({
        where: { id: input.requestId },
        data: { status: "DECLINED" },
      });
    }),

  // --------------cancelOutgoingRequest-----------------------------------------
  cancelOutgoingRequest: protectedProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.connectionRequest.findUnique({
        where: { id: input.requestId },
        select: {
          id: true,
          senderId: true,
          status: true,
        },
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

  // --------------getConnections-----------------------------------------
  getConnections: protectedProcedure.query(({ ctx }) => {
    return ctx.db.user.findUnique({
      where: {
        id: ctx.session.user.id,
      },
      select: {
        connections: true,
        connectedBy: true,
      },
    });
  }),

  // --------------removeConnection-----------------------------------------
  removeConnection: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: {
          id: ctx.session.user.id,
        },
        data: {
          connections: {
            disconnect: {
              id: input.userId,
            },
          },
          connectedBy: {
            disconnect: {
              id: input.userId,
            },
          },
        },
      });
    }),
} satisfies TRPCRouterRecord;
