import {
  type EsClient,
  indexEvent,
  indexUser,
  removeDocument,
  updateEventParticipants,
  updateUserConnections,
  updateUserEvents,
  EVENTS_INDEX,
  USERS_INDEX,
} from "@acme/es";

import { db } from "../../db/src/client";

type Db = typeof db;

function logError(action: string, err: unknown) {
  console.error(`[ES Sync] ${action} failed:`, err);
}

export async function syncUserToEs(
  es: EsClient | null,
  prisma: Db,
  userId: string,
): Promise<void> {
  if (!es) return;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        displayName: true,
        bio: true,
        enrolledUnits: true,
        createdAt: true,
        connections: { select: { id: true } },
        connectedBy: { select: { id: true } },
        upcomingEvents: { select: { id: true } },
        organisedEvents: { select: { id: true } },
      },
    });
    if (user) await indexUser(es, user);
  } catch (err) {
    logError(`indexUser(${userId})`, err);
  }
}

export async function syncEventToEs(
  es: EsClient | null,
  prisma: Db,
  eventId: string,
): Promise<void> {
  if (!es) return;
  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        organisers: { select: { id: true, name: true } },
        participants: { select: { id: true } },
      },
    });
    if (event) await indexEvent(es, event);
  } catch (err) {
    logError(`indexEvent(${eventId})`, err);
  }
}

export async function removeUserFromEs(
  es: EsClient | null,
  userId: string,
): Promise<void> {
  if (!es) return;
  try {
    await removeDocument(es, USERS_INDEX, userId);
  } catch (err) {
    logError(`removeUser(${userId})`, err);
  }
}

export async function removeEventFromEs(
  es: EsClient | null,
  eventId: string,
): Promise<void> {
  if (!es) return;
  try {
    await removeDocument(es, EVENTS_INDEX, eventId);
  } catch (err) {
    logError(`removeEvent(${eventId})`, err);
  }
}

export async function syncEventParticipantsToEs(
  es: EsClient | null,
  prisma: Db,
  eventId: string,
): Promise<void> {
  if (!es) return;
  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { participants: { select: { id: true } } },
    });
    if (event) {
      await updateEventParticipants(
        es,
        eventId,
        event.participants.map((p: { id: string }) => p.id),
      );
    }
  } catch (err) {
    logError(`syncEventParticipants(${eventId})`, err);
  }
}

export async function syncUserConnectionsToEs(
  es: EsClient | null,
  prisma: Db,
  userId: string,
): Promise<void> {
  if (!es) return;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        connections: { select: { id: true } },
        connectedBy: { select: { id: true } },
      },
    });
    if (user) {
      const allConnectionIds = [
        ...new Set([
          ...user.connections.map((c: { id: string }) => c.id),
          ...user.connectedBy.map((c: { id: string }) => c.id),
        ]),
      ];
      try {
        await updateUserConnections(es, userId, allConnectionIds);
      } catch (err: any) {
        if (err?.meta?.statusCode === 404) {
          await syncUserToEs(es, prisma, userId);
        } else {
          throw err;
        }
      }
    }
  } catch (err) {
    logError(`syncUserConnections(${userId})`, err);
  }
}

export async function syncUserEventsToEs(
  es: EsClient | null,
  prisma: Db,
  userId: string,
): Promise<void> {
  if (!es) return;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        upcomingEvents: { select: { id: true } },
        organisedEvents: { select: { id: true } },
      },
    });
    if (user) {
      try {
        await updateUserEvents(
          es,
          userId,
          user.upcomingEvents.map((e: { id: string }) => e.id),
          user.organisedEvents.map((e: { id: string }) => e.id),
        );
      } catch (err: any) {
        if (err?.meta?.statusCode === 404) {
          await syncUserToEs(es, prisma, userId);
        } else {
          throw err;
        }
      }
    }
  } catch (err) {
    logError(`syncUserEvents(${userId})`, err);
  }
}
