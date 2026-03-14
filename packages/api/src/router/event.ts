import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { EVENTS_INDEX } from "@acme/es";

import { protectedProcedure } from "../trpc";
import {
  syncEventToEs,
  syncEventParticipantsToEs,
  syncUserEventsToEs,
  removeEventFromEs,
} from "../es-sync";

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

  getMyUpcomingEvents: protectedProcedure.query(({ ctx }) => {
    return ctx.db.event.findMany({
      where: {
        date: { gte: new Date() },
        participants: {
          some: { id: ctx.session.user.id },
        },
      },
      orderBy: { date: "asc" },
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

  getUsersInEvents: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const event = await ctx.db.event.findUnique({
        where: { id: input.id },
        select: { id: true },
      });

      if (!event) return {};

      return ctx.db.user.findMany({
        where: {
          upcomingEvents: {
            some: { id: input.id },
          },
        },
      });
    }),

  getSuggestedUsersInEvents: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [event, currentUser] = await Promise.all([
        ctx.db.event.findUnique({
          where: { id: input.id },
          select: { id: true },
        }),
        ctx.db.user.findUnique({
          where: { id: ctx.session.user.id },
          select: {
            enrolledUnits: true,
            upcomingEvents: { select: { id: true } },
          },
        }),
      ]);

      if (!event || !currentUser) return [];

      const units = Array.isArray(currentUser.enrolledUnits)
        ? (currentUser.enrolledUnits as { code: string; university: string }[])
        : [];
      const unitCodes = units.map((u) => u.code);

      const sharedEventIds = currentUser.upcomingEvents
        .map((e) => e.id)
        .filter((id) => id !== input.id);

      const orConditions = [];
      if (unitCodes.length > 0) {
        orConditions.push({
          enrolledUnits: {
            array_contains: unitCodes.map((code) => ({ code })),
          },
        });
      }
      if (sharedEventIds.length > 0) {
        orConditions.push({
          upcomingEvents: { some: { id: { in: sharedEventIds } } },
        });
      }

      if (orConditions.length === 0) return [];

      return ctx.db.user.findMany({
        where: {
          id: { not: ctx.session.user.id },
          OR: orConditions,
        },
      });
    }),

  getSuggestedEvents: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const currentUser = await ctx.db.user.findUnique({
      where: { id: userId },
      select: {
        enrolledUnits: true,
        upcomingEvents: { select: { id: true } },
        organisedEvents: { select: { id: true } },
        connections: { select: { id: true } },
        connectedBy: { select: { id: true } },
      },
    });

    if (!currentUser) return [];

    const myEventIds = [
      ...currentUser.upcomingEvents.map((e) => e.id),
      ...currentUser.organisedEvents.map((e) => e.id),
    ];

    const connectionIds = [
      ...new Set([
        ...currentUser.connections.map((c) => c.id),
        ...currentUser.connectedBy.map((c) => c.id),
      ]),
    ];

    const units = Array.isArray(currentUser.enrolledUnits)
      ? (currentUser.enrolledUnits as { code: string; university: string }[])
      : [];
    const unitCodes = units.map((u) => u.code);

    if (!ctx.es) {
      return fallbackSuggestedEvents(ctx.db, userId, currentUser, myEventIds, connectionIds, unitCodes);
    }

    let similarUserIds: string[] = [];
    if (unitCodes.length > 0) {
      const similarUsers = await ctx.db.user.findMany({
        where: {
          id: { not: userId },
          OR: unitCodes.map((code) => ({
            enrolledUnits: { array_contains: [{ code }] },
          })),
        },
        select: { id: true },
        take: 100,
      });
      similarUserIds = similarUsers.map((u) => u.id);
    }

    const functions: any[] = [];

    if (connectionIds.length > 0) {
      functions.push({
        filter: { terms: { participantIds: connectionIds } },
        script_score: {
          script: {
            source:
              "int count = 0; for (def id : params.ids) { if (doc['participantIds'].size() > 0 && doc['participantIds'].contains(id)) count++; } return count * 30;",
            params: { ids: connectionIds },
          },
        },
      });
    }

    if (similarUserIds.length > 0) {
      functions.push({
        filter: { terms: { participantIds: similarUserIds } },
        weight: 15,
      });
    }

    functions.push({
      field_value_factor: {
        field: "participantCount",
        modifier: "log1p",
        factor: 2,
        missing: 0,
      },
    });

    functions.push({
      gauss: {
        date: {
          origin: "now",
          scale: "7d",
          decay: 0.5,
        },
      },
    });

    const mustNot: any[] = [];
    if (myEventIds.length > 0) {
      mustNot.push({ terms: { id: myEventIds } });
    }

    const esResult = await ctx.es.search({
      index: EVENTS_INDEX,
      body: {
        query: {
          function_score: {
            query: {
              bool: {
                must: [{ range: { date: { gte: "now" } } }],
                must_not: mustNot,
              },
            },
            functions,
            score_mode: "sum",
            boost_mode: "replace",
          },
        },
        size: 15,
        _source: ["id"],
      },
    });

    const hits = esResult.hits.hits;
    if (hits.length === 0) return [];

    const eventIds = hits.map((h: any) => h._id as string);
    const scoreMap = new Map<string, number>();
    for (const hit of hits) {
      scoreMap.set(hit._id!, hit._score ?? 0);
    }

    const events = await ctx.db.event.findMany({
      where: { id: { in: eventIds } },
      include: {
        organisers: { select: { id: true, name: true } },
        participants: { select: { id: true, name: true } },
      },
    });

    const connectionIdSet = new Set(connectionIds);
    const similarUserIdSet = new Set(similarUserIds);

    return events
      .map((event) => {
        const connectionsGoing = event.participants.filter((p) =>
          connectionIdSet.has(p.id),
        );
        const unitPeersGoing = event.participants.filter((p) =>
          similarUserIdSet.has(p.id),
        );

        let reason = "";
        if (connectionsGoing.length > 0 && unitPeersGoing.length > 0) {
          const names = connectionsGoing.slice(0, 2).map((p) => p.name.split(" ")[0]);
          const extra = connectionsGoing.length - names.length;
          reason =
            extra > 0
              ? `${names.join(", ")} +${extra} connections & classmates going`
              : `${names.join(" & ")} & classmates going`;
        } else if (connectionsGoing.length > 0) {
          const names = connectionsGoing.slice(0, 2).map((p) => p.name.split(" ")[0]);
          const extra = connectionsGoing.length - names.length;
          reason =
            extra > 0
              ? `${names.join(", ")} +${extra} more connections going`
              : connectionsGoing.length === 1
                ? `${names[0]} is going`
                : `${names.join(" & ")} are going`;
        } else if (unitPeersGoing.length > 0) {
          reason = "Popular with students in your units";
        }

        const daysUntil = Math.max(
          0,
          Math.ceil(
            (new Date(event.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          ),
        );

        const recommendationSignals: {
          type: "connections" | "unit_peers" | "popularity" | "happening_soon";
          label: string;
          icon: string;
          names?: string[];
        }[] = [];

        if (connectionsGoing.length > 0) {
          const names = connectionsGoing.slice(0, 3).map((p) => p.name);
          recommendationSignals.push({
            type: "connections",
            label:
              connectionsGoing.length === 1
                ? `${names[0]!.split(" ")[0]} is going`
                : `${connectionsGoing.length} of your connections are going`,
            icon: "people",
            names,
          });
        }

        if (unitPeersGoing.length > 0) {
          recommendationSignals.push({
            type: "unit_peers",
            label: `Popular with ${unitPeersGoing.length} student${unitPeersGoing.length === 1 ? "" : "s"} in your units`,
            icon: "school",
          });
        }

        if (event.participants.length >= 5) {
          recommendationSignals.push({
            type: "popularity",
            label: `${event.participants.length} people attending`,
            icon: "trending-up",
          });
        }

        if (daysUntil <= 7) {
          recommendationSignals.push({
            type: "happening_soon",
            label:
              daysUntil === 0
                ? "Happening today"
                : daysUntil === 1
                  ? "Happening tomorrow"
                  : `Happening in ${daysUntil} days`,
            icon: "time",
          });
        }

        return {
          id: event.id,
          title: event.title,
          date: event.date,
          location: event.location,
          bannerUrl: event.bannerUrl,
          organisers: event.organisers,
          participants: event.participants.map((p) => ({ id: p.id })),
          reason,
          connectionsGoingCount: connectionsGoing.length,
          unitPeersGoingCount: unitPeersGoing.length,
          recommendationSignals,
          _score: scoreMap.get(event.id) ?? 0,
        };
      })
      .sort((a, b) => b._score - a._score)
      .map(({ _score, ...rest }) => rest);
  }),

  searchEvents: protectedProcedure
    .input(
      z.object({
        query: z.string().optional(),
        filter: z.enum(["all", "upcoming", "this_week", "my_events", "past"]).optional(),
        limit: z.number().min(1).max(50).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const limit = input.limit ?? 30;
      const filter = input.filter ?? "all";
      const searchQuery = input.query?.trim();

      if (!ctx.es) {
        return fallbackSearchEvents(ctx.db, userId, searchQuery, filter, limit);
      }

      const must: any[] = [];
      const filterClauses: any[] = [];

      if (searchQuery && searchQuery.length > 0) {
        must.push({
          multi_match: {
            query: searchQuery,
            fields: ["title^3", "location^2", "content", "organiserNames"],
            type: "best_fields",
            fuzziness: "AUTO",
          },
        });
      }

      const now = new Date();
      switch (filter) {
        case "upcoming":
          filterClauses.push({ range: { date: { gte: "now" } } });
          break;
        case "this_week": {
          const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          filterClauses.push({
            range: { date: { gte: "now", lte: weekFromNow.toISOString() } },
          });
          break;
        }
        case "my_events":
          filterClauses.push({
            bool: {
              should: [
                { term: { organiserIds: userId } },
                { term: { participantIds: userId } },
              ],
              minimum_should_match: 1,
            },
          });
          break;
        case "past":
          filterClauses.push({ range: { date: { lt: "now" } } });
          break;
      }

      const esResult = await ctx.es.search({
        index: EVENTS_INDEX,
        body: {
          query: {
            bool: {
              must: must.length > 0 ? must : [{ match_all: {} }],
              filter: filterClauses,
            },
          },
          sort: searchQuery
            ? [{ _score: { order: "desc" } }, { date: { order: "desc" } }]
            : [{ date: { order: "desc" } }],
          size: limit,
          _source: ["id"],
        },
      });

      const hits = esResult.hits.hits;
      if (hits.length === 0) return [];

      const eventIds = hits.map((h: any) => h._id as string);

      const events = await ctx.db.event.findMany({
        where: { id: { in: eventIds } },
        include: {
          organisers: { select: { id: true, name: true } },
          participants: { select: { id: true } },
        },
      });

      const orderMap = new Map(eventIds.map((id, i) => [id, i]));
      return events.sort(
        (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
      );
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.db.event.findUnique({
        where: { id: input.id },
        include: {
          organisers: {
            select: { id: true, name: true, avatarUrl: true, image: true },
          },
          participants: {
            select: { id: true, name: true, avatarUrl: true, image: true },
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
        bannerUrl: z.string().optional(),
        ticketUrl: z.string().optional(),
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

      const event = await ctx.db.event.create({
        data: {
          title: input.title,
          date: eventDate,
          location: input.location,
          content: input.content ?? null,
          bannerUrl: input.bannerUrl ?? null,
          ticketUrl: input.ticketUrl ?? null,
          organisers: {
            connect: { id: ctx.session.user.id },
          },
        },
      });

      void syncEventToEs(ctx.es, ctx.db, event.id);
      void syncUserEventsToEs(ctx.es, ctx.db, ctx.session.user.id);

      return event;
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
          bannerUrl: z.string().optional(),
          ticketUrl: z.string().nullable().optional(),
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

      const result = await ctx.db.event.update({
        where: { id: input.id },
        data,
      });

      void syncEventToEs(ctx.es, ctx.db, input.id);

      return result;
    }),

  joinById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.event.update({
        where: { id: input.id },
        data: {
          participants: {
            connect: { id: ctx.session.user.id },
          },
        },
      });

      void syncEventParticipantsToEs(ctx.es, ctx.db, input.id);
      void syncUserEventsToEs(ctx.es, ctx.db, ctx.session.user.id);

      return result;
    }),

  leaveById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.event.update({
        where: { id: input.id },
        data: {
          participants: {
            disconnect: { id: ctx.session.user.id },
          },
        },
      });

      void syncEventParticipantsToEs(ctx.es, ctx.db, input.id);
      void syncUserEventsToEs(ctx.es, ctx.db, ctx.session.user.id);

      return result;
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

      const result = await ctx.db.event.delete({ where: { id: input } });

      void removeEventFromEs(ctx.es, input);

      return result;
    }),

  joinViaQr: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.db.event.findUnique({
        where: { id: input.eventId },
        select: {
          id: true,
          title: true,
          participants: { where: { id: ctx.session.user.id }, select: { id: true } },
        },
      });

      if (!event) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found." });
      }

      if (event.participants.length > 0) {
        return { alreadyJoined: true, event: { id: event.id, title: event.title } };
      }

      await ctx.db.event.update({
        where: { id: input.eventId },
        data: { participants: { connect: { id: ctx.session.user.id } } },
      });

      void syncEventParticipantsToEs(ctx.es, ctx.db, input.eventId);
      void syncUserEventsToEs(ctx.es, ctx.db, ctx.session.user.id);

      return { alreadyJoined: false, event: { id: event.id, title: event.title } };
    }),
} satisfies TRPCRouterRecord;

/**
 * Fallback for getSuggestedEvents when ES is not available.
 */
async function fallbackSuggestedEvents(
  db: any,
  userId: string,
  currentUser: any,
  myEventIds: string[],
  connectionIds: string[],
  unitCodes: string[],
) {
  let similarUserIds: string[] = [];
  if (unitCodes.length > 0) {
    const similarUsers = await db.user.findMany({
      where: {
        id: { not: userId },
        OR: unitCodes.map((code: string) => ({
          enrolledUnits: { array_contains: [{ code }] },
        })),
      },
      select: { id: true },
      take: 100,
    });
    similarUserIds = similarUsers.map((u: any) => u.id);
  }

  const relevantUserIds = [...new Set([...connectionIds, ...similarUserIds])];
  if (relevantUserIds.length === 0) return [];

  const connectionIdSet = new Set(connectionIds);
  const similarUserIdSet = new Set(similarUserIds);

  const events = await db.event.findMany({
    where: {
      date: { gte: new Date() },
      ...(myEventIds.length > 0 ? { id: { notIn: myEventIds } } : {}),
      participants: {
        some: { id: { in: relevantUserIds } },
      },
    },
    orderBy: { date: "asc" },
    take: 15,
    include: {
      organisers: { select: { id: true, name: true } },
      participants: { select: { id: true, name: true } },
    },
  });

  return events.map((event: any) => {
    const connectionsGoing = event.participants.filter((p: any) =>
      connectionIdSet.has(p.id),
    );
    const unitPeersGoing = event.participants.filter((p: any) =>
      similarUserIdSet.has(p.id),
    );

    let reason = "";
    if (connectionsGoing.length > 0 && unitPeersGoing.length > 0) {
      const names = connectionsGoing.slice(0, 2).map((p: any) => p.name.split(" ")[0]);
      const extra = connectionsGoing.length - names.length;
      reason =
        extra > 0
          ? `${names.join(", ")} +${extra} connections & classmates going`
          : `${names.join(" & ")} & classmates going`;
    } else if (connectionsGoing.length > 0) {
      const names = connectionsGoing.slice(0, 2).map((p: any) => p.name.split(" ")[0]);
      const extra = connectionsGoing.length - names.length;
      reason =
        extra > 0
          ? `${names.join(", ")} +${extra} more connections going`
          : connectionsGoing.length === 1
            ? `${names[0]} is going`
            : `${names.join(" & ")} are going`;
    } else if (unitPeersGoing.length > 0) {
      reason = "Popular with students in your units";
    }

    const daysUntil = Math.max(
      0,
      Math.ceil(
        (new Date(event.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ),
    );

    const recommendationSignals: {
      type: "connections" | "unit_peers" | "popularity" | "happening_soon";
      label: string;
      icon: string;
      names?: string[];
    }[] = [];

    if (connectionsGoing.length > 0) {
      const cNames = connectionsGoing.slice(0, 3).map((p: any) => p.name);
      recommendationSignals.push({
        type: "connections",
        label:
          connectionsGoing.length === 1
            ? `${cNames[0].split(" ")[0]} is going`
            : `${connectionsGoing.length} of your connections are going`,
        icon: "people",
        names: cNames,
      });
    }

    if (unitPeersGoing.length > 0) {
      recommendationSignals.push({
        type: "unit_peers",
        label: `Popular with ${unitPeersGoing.length} student${unitPeersGoing.length === 1 ? "" : "s"} in your units`,
        icon: "school",
      });
    }

    if (event.participants.length >= 5) {
      recommendationSignals.push({
        type: "popularity",
        label: `${event.participants.length} people attending`,
        icon: "trending-up",
      });
    }

    if (daysUntil <= 7) {
      recommendationSignals.push({
        type: "happening_soon",
        label:
          daysUntil === 0
            ? "Happening today"
            : daysUntil === 1
              ? "Happening tomorrow"
              : `Happening in ${daysUntil} days`,
        icon: "time",
      });
    }

    return {
      id: event.id,
      title: event.title,
      date: event.date,
      location: event.location,
      bannerUrl: event.bannerUrl,
      organisers: event.organisers,
      participants: event.participants.map((p: any) => ({ id: p.id })),
      reason,
      connectionsGoingCount: connectionsGoing.length,
      unitPeersGoingCount: unitPeersGoing.length,
      recommendationSignals,
    };
  });
}

/**
 * Fallback for searchEvents when ES is not available.
 */
async function fallbackSearchEvents(
  db: any,
  userId: string,
  searchQuery: string | undefined,
  filter: string,
  limit: number,
) {
  const where: any = {};
  const now = new Date();

  switch (filter) {
    case "upcoming":
      where.date = { gte: now };
      break;
    case "this_week": {
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      where.date = { gte: now, lte: weekFromNow };
      break;
    }
    case "my_events":
      where.OR = [
        { organisers: { some: { id: userId } } },
        { participants: { some: { id: userId } } },
      ];
      break;
    case "past":
      where.date = { lt: now };
      break;
  }

  if (searchQuery) {
    where.OR = [
      ...(where.OR ?? []),
      { title: { contains: searchQuery, mode: "insensitive" } },
      { location: { contains: searchQuery, mode: "insensitive" } },
    ];
  }

  return db.event.findMany({
    where,
    take: limit,
    orderBy: { date: "desc" },
    include: {
      organisers: { select: { id: true, name: true } },
      participants: { select: { id: true } },
    },
  });
}
