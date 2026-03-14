import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { protectedProcedure } from "../trpc";
import { syncUserToEs } from "../es-sync";

export const userRouter = {
  getMe: protectedProcedure.query(async ({ ctx }) => {
    const [user, pendingRequestCount, unreadDmCount] = await Promise.all([
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
      ctx.db.message.count({
        where: {
          receiverId: ctx.session.user.id,
          senderId: { not: ctx.session.user.id },
          eventId: null,
          readAt: null,
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
      unreadDmCount,
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
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.user.update({
        where: {
          id: ctx.session.user.id,
        },
        data: input,
      });

      void syncUserToEs(ctx.es, ctx.db, ctx.session.user.id);

      return result;
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

  getReconnectPeople: protectedProcedure.query(async ({ ctx }) => {
    const me = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        connections: { select: { id: true } },
        connectedBy: { select: { id: true } },
        upcomingEvents: {
          where: { date: { lt: new Date() } },
          orderBy: { date: "desc" },
          select: {
            id: true,
            title: true,
            date: true,
            participants: {
              select: {
                id: true,
                name: true,
                displayName: true,
                image: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!me) return [];

    const excludedIds = new Set<string>([
      me.id,
      ...me.connections.map((u) => u.id),
      ...me.connectedBy.map((u) => u.id),
    ]);

    const byUserId = new Map<
      string,
      {
        id: string;
        name: string;
        displayName: string | null;
        image: string | null;
        avatarUrl: string | null;
        metAt: string;
        metAtDate: Date;
      }
    >();

    for (const event of me.upcomingEvents) {
      for (const participant of event.participants) {
        if (excludedIds.has(participant.id)) continue;

        const existing = byUserId.get(participant.id);
        if (!existing || event.date > existing.metAtDate) {
          byUserId.set(participant.id, {
            id: participant.id,
            name: participant.name,
            displayName: participant.displayName,
            image: participant.image,
            avatarUrl: participant.avatarUrl,
            metAt: event.title,
            metAtDate: event.date,
          });
        }
      }
    }

    return [...byUserId.values()]
      .sort((a, b) => b.metAtDate.getTime() - a.metAtDate.getTime())
      .slice(0, 20);
  }),
} satisfies TRPCRouterRecord;
