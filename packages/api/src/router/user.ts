import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { protectedProcedure } from "../trpc";

export const userRouter = {
  getMe: protectedProcedure.query(async ({ ctx }) => {
    const [user, pendingRequestCount] = await Promise.all([
      ctx.db.user.findUnique({
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
      }),
      ctx.db.connectionRequest.count({
        where: {
          receiverId: ctx.session.user.id,
          status: "PENDING",
        },
      }),
    ]);

    if (!user) return null;

    const connectionsCount = user._count.connections + user._count.connectedBy;
    const eventsCount =
      user._count.upcomingEvents + user._count.organisedEvents;

    const { _count, ...rest } = user;
    return {
      ...rest,
      connectionsCount,
      eventsCount,
      pendingRequestCount,
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
            discordUsername: z.string().nullable().optional(),
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
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      if (input.id === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use getMe for your own profile.",
        });
      }

      const user = await ctx.db.user.findUnique({
        where: { id: input.id },
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

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      }

      const isConnected = await ctx.db.user.findFirst({
        where: {
          id: ctx.session.user.id,
          OR: [
            { connections: { some: { id: input.id } } },
            { connectedBy: { some: { id: input.id } } },
          ],
        },
        select: { id: true },
      });

      const pendingRequest = await ctx.db.connectionRequest.findFirst({
        where: {
          OR: [
            { senderId: ctx.session.user.id, receiverId: input.id },
            { senderId: input.id, receiverId: ctx.session.user.id },
          ],
          status: "PENDING",
        },
        select: {
          id: true,
          senderId: true,
        },
      });

      const connectionsCount =
        user._count.connections + user._count.connectedBy;
      const eventsCount =
        user._count.upcomingEvents + user._count.organisedEvents;

      return {
        id: user.id,
        name: user.name,
        displayName: user.displayName,
        slug: user.slug,
        bio: user.bio,
        image: user.image,
        bannerUrl: user.bannerUrl,
        enrolledUnits: (user as any).enrolledUnits ?? [],
        socials: user.socials,
        connectionsCount,
        eventsCount,
        connectionStatus: isConnected
          ? ("connected" as const)
          : pendingRequest
            ? pendingRequest.senderId === ctx.session.user.id
              ? ("pending_sent" as const)
              : ("pending_received" as const)
            : ("none" as const),
        pendingRequestId: pendingRequest?.id ?? null,
      };
    }),
} satisfies TRPCRouterRecord;
