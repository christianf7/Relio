import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { protectedProcedure } from "../trpc";

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
  // --------------getUsersInEvent-----------------------------------------
  getUsersInEvents: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const event = await ctx.db.event.findUnique({
        where: {
          id: input.id,
        },
        select: {
          id: true,
        },
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
  // --------------getSuggestedUsersInEvent-----------------------------------------
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

    const myEventIds = new Set([
      ...currentUser.upcomingEvents.map((e) => e.id),
      ...currentUser.organisedEvents.map((e) => e.id),
    ]);

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

    const relevantUserIds = [...new Set([...connectionIds, ...similarUserIds])];
    if (relevantUserIds.length === 0) return [];

    const connectionIdSet = new Set(connectionIds);
    const similarUserIdSet = new Set(similarUserIds);

    const events = await ctx.db.event.findMany({
      where: {
        date: { gte: new Date() },
        ...(myEventIds.size > 0 ? { id: { notIn: [...myEventIds] } } : {}),
        participants: {
          some: { id: { in: relevantUserIds } },
        },
      },
      orderBy: { date: "asc" },
      take: 15,
      include: {
        organisers: {
          select: { id: true, name: true },
        },
        participants: {
          select: { id: true, name: true },
        },
      },
    });

    return events.map((event) => {
      const connectionsGoing = event.participants.filter((p) =>
        connectionIdSet.has(p.id),
      );
      const unitPeersGoing = event.participants.filter((p) =>
        similarUserIdSet.has(p.id),
      );

      let reason = "";
      if (connectionsGoing.length > 0 && unitPeersGoing.length > 0) {
        const names = connectionsGoing
          .slice(0, 2)
          .map((p) => p.name.split(" ")[0]);
        const extra = connectionsGoing.length - names.length;
        reason =
          extra > 0
            ? `${names.join(", ")} +${extra} connections & classmates going`
            : `${names.join(" & ")} & classmates going`;
      } else if (connectionsGoing.length > 0) {
        const names = connectionsGoing
          .slice(0, 2)
          .map((p) => p.name.split(" ")[0]);
        const extra = connectionsGoing.length - names.length;
        reason =
          extra > 0
            ? `${names.join(", ")} +${extra} more connections going`
            : connectionsGoing.length === 1
              ? `${names[0]} is going`
              : `${names.join(" & ")} are going`;
      } else if (unitPeersGoing.length > 0) {
        reason = `Popular with students in your units`;
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
      };
    });
  }),

  // --------------getById-----------------------------------------
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

      return ctx.db.event.create({
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
    }),
  // --------------updateById-----------------------------------------
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

      return ctx.db.event.update({
        where: { id: input.id },
        data,
      });
    }),

  joinById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.event.update({
        where: { id: input.id },
        data: {
          participants: {
            connect: { id: ctx.session.user.id },
          },
        },
      });
    }),

  leaveById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.event.update({
        where: { id: input.id },
        data: {
          participants: {
            disconnect: { id: ctx.session.user.id },
          },
        },
      });
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

      return ctx.db.event.delete({ where: { id: input } });
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

      return { alreadyJoined: false, event: { id: event.id, title: event.title } };
    }),
} satisfies TRPCRouterRecord;
