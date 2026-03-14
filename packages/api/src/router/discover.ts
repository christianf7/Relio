import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { USERS_INDEX } from "@acme/es";

import { protectedProcedure } from "../trpc";
import { syncUserConnectionsToEs } from "../es-sync";

type EnrolledUnit = { code: string; university: string };

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

      const [currentUser, swipedUserIds, rightSwipedOnMe] = await Promise.all([
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
        ctx.db.swipe.findMany({
          where: { swipedId: userId, direction: "RIGHT", matched: false },
          select: { swiperId: true },
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

      const interestedInMeIds = rightSwipedOnMe.map((s) => s.swiperId);

      if (!ctx.es) {
        return fallbackDiscoverFeed(ctx.db, userId, currentUser, excludeIds, myUnits, myUnitCodes, myUnis, allMyEventIds, myUpcomingEventIds, myOrganisedEventIds, myConnectionIds, interestedInMeIds, limit);
      }

      const functions: any[] = [];

      if (interestedInMeIds.length > 0) {
        functions.push({
          filter: { terms: { id: interestedInMeIds } },
          weight: 200,
        });
      }

      if (myUnitCodes.length > 0) {
        functions.push({
          filter: { terms: { unitCodes: myUnitCodes } },
          script_score: {
            script: {
              source:
                "int count = 0; for (def c : params.codes) { if (doc['unitCodes'].size() > 0 && doc['unitCodes'].contains(c)) count++; } return count * 25;",
              params: { codes: myUnitCodes },
            },
          },
        });
      }

      if (myUnis.length > 0) {
        functions.push({
          filter: {
            bool: {
              must: [{ terms: { unitUniversities: myUnis } }],
              ...(myUnitCodes.length > 0
                ? { must_not: [{ terms: { unitCodes: myUnitCodes } }] }
                : {}),
            },
          },
          weight: 10,
        });
      }

      if (allMyEventIds.length > 0) {
        functions.push({
          filter: {
            bool: {
              should: [
                { terms: { upcomingEventIds: allMyEventIds } },
                { terms: { organisedEventIds: allMyEventIds } },
              ],
              minimum_should_match: 1,
            },
          },
          script_score: {
            script: {
              source:
                "int count = 0; for (def id : params.ids) { if (doc['upcomingEventIds'].size() > 0 && doc['upcomingEventIds'].contains(id)) count++; if (doc['organisedEventIds'].size() > 0 && doc['organisedEventIds'].contains(id)) count++; } return count * 30;",
              params: { ids: allMyEventIds },
            },
          },
        });
      }

      functions.push({
        random_score: { seed: Date.now(), field: "id" },
        weight: 0.1,
      });

      const esResult = await ctx.es.search({
        index: USERS_INDEX,
        body: {
          query: {
            function_score: {
              query: {
                bool: {
                  must_not: [{ terms: { id: excludeIds } }],
                },
              },
              functions,
              score_mode: "sum",
              boost_mode: "replace",
              min_score: 0.1,
            },
          },
          size: limit,
          _source: ["id", "unitCodes", "unitUniversities", "upcomingEventIds", "organisedEventIds"],
        },
      });

      const hits = esResult.hits.hits;
      if (hits.length === 0) {
        return { profiles: [], remaining: 0 };
      }

      const candidateIds = hits.map((h: any) => h._id as string);
      const scoreMap = new Map<string, number>();
      for (const hit of hits) {
        scoreMap.set(hit._id!, hit._score ?? 0);
      }

      const candidates = await ctx.db.user.findMany({
        where: { id: { in: candidateIds } },
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
      });

      const myUnitCodeSet = new Set(myUnitCodes);
      const myUniSet = new Set(myUnis);
      const myEventIdSet = new Set(allMyEventIds);

      const profiles = candidates
        .map((candidate) => {
          const candidateUnits: EnrolledUnit[] = Array.isArray(candidate.enrolledUnits)
            ? (candidate.enrolledUnits as EnrolledUnit[])
            : [];

          const reasons: string[] = [];
          const sharedUnits = candidateUnits.filter((u) => myUnitCodeSet.has(u.code));
          if (sharedUnits.length > 0) {
            reasons.push(
              sharedUnits.length === 1
                ? `Shares ${sharedUnits[0]!.code}`
                : `${sharedUnits.length} shared courses`,
            );
          } else {
            const sharedUnis = candidateUnits.filter((u) => myUniSet.has(u.university));
            if (sharedUnis.length > 0) reasons.push("Same university");
          }

          const allEvents = [...candidate.upcomingEvents, ...candidate.organisedEvents];
          const sharedEvents = allEvents.filter((e) => myEventIdSet.has(e.id));
          if (sharedEvents.length > 0) {
            reasons.push(
              sharedEvents.length === 1
                ? "Attending same event"
                : `${sharedEvents.length} shared events`,
            );
          }

          const nextSharedEvent = sharedEvents
            .filter((e) => new Date(e.date) > new Date())
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

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
            score: scoreMap.get(candidate.id) ?? 0,
            reasons,
          };
        })
        .sort((a, b) => b.score - a.score);

      const totalHits = typeof esResult.hits.total === "number"
        ? esResult.hits.total
        : esResult.hits.total?.value ?? 0;

      return {
        profiles,
        remaining: Math.max(0, totalHits - profiles.length),
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

  connectFromMatch: protectedProcedure
    .input(z.object({ matchedUserId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      if (input.matchedUserId === userId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot connect with yourself" });
      }

      const mySwipe = await ctx.db.swipe.findUnique({
        where: { swiperId_swipedId: { swiperId: userId, swipedId: input.matchedUserId } },
      });

      if (!mySwipe?.matched) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You haven't matched with this user" });
      }

      const alreadyConnected = await ctx.db.user.findFirst({
        where: {
          id: userId,
          OR: [
            { connections: { some: { id: input.matchedUserId } } },
            { connectedBy: { some: { id: input.matchedUserId } } },
          ],
        },
        select: { id: true },
      });

      if (alreadyConnected) {
        return { alreadyConnected: true };
      }

      await ctx.db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { connections: { connect: { id: input.matchedUserId } } },
        });

        const existingReq = await tx.connectionRequest.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: input.matchedUserId },
              { senderId: input.matchedUserId, receiverId: userId },
            ],
          },
          select: { id: true },
        });

        if (existingReq) {
          await tx.connectionRequest.update({
            where: { id: existingReq.id },
            data: { status: "ACCEPTED" },
          });
        } else {
          await tx.connectionRequest.create({
            data: {
              senderId: userId,
              receiverId: input.matchedUserId,
              status: "ACCEPTED",
            },
          });
        }
      });

      void syncUserConnectionsToEs(ctx.es, ctx.db, userId);
      void syncUserConnectionsToEs(ctx.es, ctx.db, input.matchedUserId);

      return { alreadyConnected: false };
    }),

  removeMatch: protectedProcedure
    .input(z.object({ matchedUserId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      await ctx.db.swipe.updateMany({
        where: {
          OR: [
            { swiperId: userId, swipedId: input.matchedUserId, matched: true },
            { swiperId: input.matchedUserId, swipedId: userId, matched: true },
          ],
        },
        data: { matched: false },
      });

      return { success: true };
    }),
} satisfies TRPCRouterRecord;

/**
 * Fallback when ES is not configured -- preserves the original Prisma-based logic
 * so the app still works without Elasticsearch.
 */
async function fallbackDiscoverFeed(
  db: any,
  userId: string,
  currentUser: any,
  excludeIds: string[],
  myUnits: EnrolledUnit[],
  myUnitCodes: string[],
  myUnis: string[],
  allMyEventIds: string[],
  myUpcomingEventIds: string[],
  myOrganisedEventIds: string[],
  myConnectionIds: Set<string>,
  interestedInMeIds: string[],
  limit: number,
) {
  const interestedSet = new Set(interestedInMeIds);
  const orConditions: any[] = [];

  if (myUnitCodes.length > 0) {
    for (const code of myUnitCodes) {
      orConditions.push({ enrolledUnits: { array_contains: [{ code }] } });
    }
  }
  if (myUnis.length > 0) {
    for (const university of myUnis) {
      orConditions.push({ enrolledUnits: { array_contains: [{ university }] } });
    }
  }
  if (allMyEventIds.length > 0) {
    orConditions.push({ upcomingEvents: { some: { id: { in: allMyEventIds } } } });
    orConditions.push({ organisedEvents: { some: { id: { in: allMyEventIds } } } });
  }

  const notExcludedInterestedIds = interestedInMeIds.filter((id) => !excludeIds.includes(id));
  if (notExcludedInterestedIds.length > 0) {
    orConditions.push({ id: { in: notExcludedInterestedIds } });
  }

  const candidates = await db.user.findMany({
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

  const myUnitCodeSet = new Set(myUnitCodes);
  const myUniSet = new Set(myUnis);
  const myEventIdSet = new Set(allMyEventIds);

  const scored = candidates.map((candidate: any) => {
    const candidateUnits: EnrolledUnit[] = Array.isArray(candidate.enrolledUnits)
      ? (candidate.enrolledUnits as EnrolledUnit[])
      : [];

    let score = 0;
    const reasons: string[] = [];

    if (interestedSet.has(candidate.id)) {
      score += 200;
    }

    const sharedUnits = candidateUnits.filter((u) => myUnitCodeSet.has(u.code));
    if (sharedUnits.length > 0) {
      score += sharedUnits.length * 25;
      reasons.push(
        sharedUnits.length === 1
          ? `Shares ${sharedUnits[0]!.code}`
          : `${sharedUnits.length} shared courses`,
      );
    }

    const sharedUnis = candidateUnits.filter((u) => myUniSet.has(u.university));
    if (sharedUnis.length > 0 && sharedUnits.length === 0) {
      score += 10;
      reasons.push("Same university");
    }

    const allEvents = [...candidate.upcomingEvents, ...candidate.organisedEvents];
    const sharedEvents = allEvents.filter((e: any) => myEventIdSet.has(e.id));
    if (sharedEvents.length > 0) {
      score += sharedEvents.length * 30;
      reasons.push(
        sharedEvents.length === 1
          ? "Attending same event"
          : `${sharedEvents.length} shared events`,
      );
    }

    const nextSharedEvent = sharedEvents
      .filter((e: any) => new Date(e.date) > new Date())
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

    return {
      id: candidate.id,
      name: candidate.name,
      displayName: candidate.displayName,
      image: candidate.image,
      bio: candidate.bio,
      university: candidateUnits[0]?.university ?? null,
      courses: candidateUnits.map((u: EnrolledUnit) => u.code),
      sharedEventCount: sharedEvents.length,
      nextSharedEvent: nextSharedEvent
        ? { id: nextSharedEvent.id, title: nextSharedEvent.title, date: nextSharedEvent.date }
        : null,
      score,
      reasons,
    };
  });

  scored.sort((a: any, b: any) => {
    if (b.score !== a.score) return b.score - a.score;
    return Math.random() - 0.5;
  });

  const page = scored.slice(0, limit);
  return { profiles: page, remaining: scored.length - page.length };
}
