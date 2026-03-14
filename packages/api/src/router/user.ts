import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { syncUserToEs } from "../es-sync";
import { protectedProcedure } from "../trpc";

export const userRouter = {
  getMe: protectedProcedure.query(async ({ ctx }) => {
    const [user, pendingRequestCount, unreadDmCount] = await Promise.all([
      ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        include: {
          accounts: {
            select: {
              providerId: true,
              accountId: true,
            },
          },
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

    const linkedInAccount = user.accounts.find(
      (a) => a.providerId === "linkedin",
    );
    const oauthLinkedInUrl = linkedInAccount
      ? `https://www.linkedin.com/in/${linkedInAccount.accountId}`
      : null;
    const socialsObj =
      user.socials && typeof user.socials === "object"
        ? ({ ...(user.socials as Record<string, unknown>) } as Record<
            string,
            unknown
          >)
        : {};

    if (oauthLinkedInUrl) {
      socialsObj.linkedInUrl = oauthLinkedInUrl;

      const currentLinkedIn =
        typeof (user.socials as any)?.linkedInUrl === "string"
          ? ((user.socials as any).linkedInUrl as string)
          : null;

      if (currentLinkedIn !== oauthLinkedInUrl) {
        void ctx.db.user.update({
          where: { id: user.id },
          data: {
            socials: {
              ...(user.socials && typeof user.socials === "object"
                ? (user.socials as Record<string, unknown>)
                : {}),
              linkedInUrl: oauthLinkedInUrl,
            },
          },
        });
      }
    }

    const { _count, ...rest } = user;
    return {
      ...rest,
      socials: socialsObj,
      linkedInLocked: !!oauthLinkedInUrl,
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
        bannerUrl: z.string().nullable().optional(),
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
      const linkedInAccount = await ctx.db.account.findFirst({
        where: {
          userId: ctx.session.user.id,
          providerId: "linkedin",
        },
        select: { accountId: true },
      });

      const oauthLinkedInUrl = linkedInAccount
        ? `https://www.linkedin.com/in/${linkedInAccount.accountId}`
        : null;

      const socialsInput = input.socials
        ? ({ ...input.socials } as Record<string, string | null | undefined>)
        : undefined;

      if (oauthLinkedInUrl) {
        if (socialsInput) {
          socialsInput.linkedInUrl = oauthLinkedInUrl;
        } else {
          input.socials = { linkedInUrl: oauthLinkedInUrl };
        }
      }

      if (socialsInput) {
        input.socials = socialsInput as {
          githubUrl?: string | null;
          linkedInUrl?: string | null;
          discordUsername?: string | null;
        };
      }

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

      const [isConnected, pendingRequest, isMatched] = await Promise.all([
        ctx.db.user.findFirst({
          where: {
            id: ctx.session.user.id,
            OR: [
              { connections: { some: { id: input.id } } },
              { connectedBy: { some: { id: input.id } } },
            ],
          },
          select: { id: true },
        }),
        ctx.db.connectionRequest.findFirst({
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
        }),
        ctx.db.swipe.findFirst({
          where: {
            swiperId: ctx.session.user.id,
            swipedId: input.id,
            matched: true,
          },
          select: { id: true },
        }),
      ]);

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
        isMatched: !!isMatched,
      };
    }),

  completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.user.update({
      where: { id: ctx.session.user.id },
      data: { onboardingCompleted: true },
    });
    return { success: true };
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
