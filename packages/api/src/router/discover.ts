import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { protectedProcedure } from "../trpc";

type EnrolledUnit = { code: string; university: string };

function computeScore(
  candidate: {
    id: string;
    enrolledUnits: unknown;
    upcomingEventIds: string[];
    organisedEventIds: string[];
  },
  currentUser: {
    enrolledUnits: EnrolledUnit[];
    upcomingEventIds: string[];
    organisedEventIds: string[];
    connectionIds: string[];
  },
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const candidateUnits: EnrolledUnit[] = Array.isArray(candidate.enrolledUnits)
    ? (candidate.enrolledUnits as EnrolledUnit[])
    : [];

  const myUnitCodes = new Set(currentUser.enrolledUnits.map((u) => u.code));
  const sharedUnits = candidateUnits.filter((u) => myUnitCodes.has(u.code));
  if (sharedUnits.length > 0) {
    score += sharedUnits.length * 25;
    reasons.push(
      sharedUnits.length === 1
        ? `Shares ${sharedUnits[0]!.code}`
        : `${sharedUnits.length} shared courses`,
    );
  }

  const myUnis = new Set(currentUser.enrolledUnits.map((u) => u.university));
  const candidateUnis = new Set(candidateUnits.map((u) => u.university));
  const sharedUnis = [...candidateUnis].filter((u) => myUnis.has(u));
  if (sharedUnis.length > 0 && sharedUnits.length === 0) {
    score += 10;
    reasons.push(`Same university`);
  }

  const myEventIds = new Set([
    ...currentUser.upcomingEventIds,
    ...currentUser.organisedEventIds,
  ]);
  const candidateEventIds = new Set([
    ...candidate.upcomingEventIds,
    ...candidate.organisedEventIds,
  ]);
  const sharedEvents = [...candidateEventIds].filter((id) =>
    myEventIds.has(id),
  );
  if (sharedEvents.length > 0) {
    score += sharedEvents.length * 30;
    reasons.push(
      sharedEvents.length === 1
        ? `Attending same event`
        : `${sharedEvents.length} shared events`,
    );
  }

  return { score, reasons };
}

export const discoverRouter = {
  getDiscoverFeed: protectedProcedure
    .input(
      z
        .object({
          cursor: z.number().optional(),
          limit: z.number().min(1).max(50).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const userId = ctx.session.user.id;

      const [currentUser, swipedUserIds] = await Promise.all([
        ctx.db.user.findUnique({
          where: { id: userId },
          select: {
            enrolledUnits: true,
            upcomingEvents: { select: { id: true } },
            organisedEvents: { select: { id: true } },
            connections: { select: { id: true } },
            connectedBy: { select: { id: true } },
          },
        }),
        ctx.db.swipe.findMany({
          where: { swiperId: userId },
          select: { swipedId: true },
        }),
      ]);

      if (!currentUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const myUnits: EnrolledUnit[] = Array.isArray(currentUser.enrolledUnits)
        ? (currentUser.enrolledUnits as EnrolledUnit[])
        : [];
      const myUpcomingEventIds = currentUser.upcomingEvents.map((e) => e.id);
      const myOrganisedEventIds = currentUser.organisedEvents.map((e) => e.id);
      const myConnectionIds = new Set([
        ...currentUser.connections.map((c) => c.id),
        ...currentUser.connectedBy.map((c) => c.id),
      ]);

      const excludeIds = [
        userId,
        ...swipedUserIds.map((s) => s.swipedId),
        ...myConnectionIds,
      ];

      const myUnitCodes = myUnits.map((u) => u.code);
      const myUnis = [...new Set(myUnits.map((u) => u.university))];
      const allMyEventIds = [...myUpcomingEventIds, ...myOrganisedEventIds];

      const orConditions: any[] = [];

      if (myUnitCodes.length > 0) {
        for (const code of myUnitCodes) {
          orConditions.push({
            enrolledUnits: { array_contains: [{ code }] },
          });
        }
      }
      if (myUnis.length > 0) {
        for (const university of myUnis) {
          orConditions.push({
            enrolledUnits: { array_contains: [{ university }] },
          });
        }
      }
      if (allMyEventIds.length > 0) {
        orConditions.push({
          upcomingEvents: { some: { id: { in: allMyEventIds } } },
        });
        orConditions.push({
          organisedEvents: { some: { id: { in: allMyEventIds } } },
        });
      }

      const candidates = await ctx.db.user.findMany({
        where: {
          id: { notIn: excludeIds },
          ...(orConditions.length > 0 ? { OR: orConditions } : {}),
        },
        select: {
          id: true,
          name: true,
          displayName: true,
          image: true,
          bio: true,
          enrolledUnits: true,
          upcomingEvents: { select: { id: true, title: true, date: true } },
          organisedEvents: { select: { id: true, title: true, date: true } },
        },
        take: 100,
      });

      const scored = candidates.map((candidate) => {
        const { score, reasons } = computeScore(
          {
            id: candidate.id,
            enrolledUnits: candidate.enrolledUnits,
            upcomingEventIds: candidate.upcomingEvents.map((e) => e.id),
            organisedEventIds: candidate.organisedEvents.map((e) => e.id),
          },
          {
            enrolledUnits: myUnits,
            upcomingEventIds: myUpcomingEventIds,
            organisedEventIds: myOrganisedEventIds,
            connectionIds: [...myConnectionIds],
          },
        );

        const candidateUnits: EnrolledUnit[] = Array.isArray(
          candidate.enrolledUnits,
        )
          ? (candidate.enrolledUnits as EnrolledUnit[])
          : [];

        const allEvents = [...candidate.upcomingEvents, ...candidate.organisedEvents];
        const myAllEventSet = new Set(allMyEventIds);
        const sharedEvents = allEvents.filter((e) => myAllEventSet.has(e.id));
        const nextSharedEvent = sharedEvents
          .filter((e) => new Date(e.date) > new Date())
          .sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
          )[0];

        return {
          id: candidate.id,
          name: candidate.name,
          displayName: candidate.displayName,
          image: candidate.image,
          bio: candidate.bio,
          university: candidateUnits[0]?.university ?? null,
          courses: candidateUnits.map((u) => u.code),
          sharedEventCount: sharedEvents.length,
          nextSharedEvent: nextSharedEvent
            ? { id: nextSharedEvent.id, title: nextSharedEvent.title, date: nextSharedEvent.date }
            : null,
          score,
          reasons,
        };
      });

      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return Math.random() - 0.5;
      });

      const page = scored.slice(0, limit);

      return {
        profiles: page,
        remaining: scored.length - page.length,
      };
    }),

  swipe: protectedProcedure
    .input(
      z.object({
        targetUserId: z.string(),
        direction: z.enum(["LEFT", "RIGHT"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      if (input.targetUserId === userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot swipe on yourself",
        });
      }

      const existing = await ctx.db.swipe.findUnique({
        where: {
          swiperId_swipedId: {
            swiperId: userId,
            swipedId: input.targetUserId,
          },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Already swiped on this user",
        });
      }

      let matched = false;

      if (input.direction === "RIGHT") {
        const reciprocal = await ctx.db.swipe.findUnique({
          where: {
            swiperId_swipedId: {
              swiperId: input.targetUserId,
              swipedId: userId,
            },
          },
        });

        if (reciprocal?.direction === "RIGHT") {
          matched = true;

          await ctx.db.$transaction([
            ctx.db.swipe.create({
              data: {
                swiperId: userId,
                swipedId: input.targetUserId,
                direction: "RIGHT",
                matched: true,
              },
            }),
            ctx.db.swipe.update({
              where: { id: reciprocal.id },
              data: { matched: true },
            }),
            ctx.db.user.update({
              where: { id: userId },
              data: { connections: { connect: { id: input.targetUserId } } },
            }),
            ctx.db.connectionRequest.create({
              data: {
                senderId: userId,
                receiverId: input.targetUserId,
                status: "ACCEPTED",
              },
            }),
          ]);

          return { matched: true };
        }
      }

      await ctx.db.swipe.create({
        data: {
          swiperId: userId,
          swipedId: input.targetUserId,
          direction: input.direction,
        },
      });

      return { matched: false };
    }),

  getMatches: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const matches = await ctx.db.swipe.findMany({
      where: {
        swiperId: userId,
        matched: true,
      },
      include: {
        swiped: {
          select: {
            id: true,
            name: true,
            displayName: true,
            image: true,
            enrolledUnits: true,
            upcomingEvents: {
              where: { date: { gte: new Date() } },
              select: { id: true, title: true, date: true },
              orderBy: { date: "asc" },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return matches.map((m) => ({
      matchedAt: m.createdAt,
      user: {
        id: m.swiped.id,
        name: m.swiped.name,
        displayName: m.swiped.displayName,
        image: m.swiped.image,
        university:
          (
            Array.isArray(m.swiped.enrolledUnits)
              ? (m.swiped.enrolledUnits as EnrolledUnit[])[0]?.university
              : null
          ) ?? null,
        nextEvent: m.swiped.upcomingEvents[0] ?? null,
      },
    }));
  }),

  undoLastSwipe: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const lastSwipe = await ctx.db.swipe.findFirst({
      where: { swiperId: userId, matched: false },
      orderBy: { createdAt: "desc" },
    });

    if (!lastSwipe) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No swipe to undo",
      });
    }

    const timeSinceSwipe =
      Date.now() - new Date(lastSwipe.createdAt).getTime();
    if (timeSinceSwipe > 30_000) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Can only undo within 30 seconds",
      });
    }

    await ctx.db.swipe.delete({ where: { id: lastSwipe.id } });

    return { undoneUserId: lastSwipe.swipedId };
  }),
} satisfies TRPCRouterRecord;
