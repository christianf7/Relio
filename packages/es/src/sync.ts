import type { Client } from "@elastic/elasticsearch";

import type { EventDocument, UserDocument } from "./indices";
import { EVENTS_INDEX, USERS_INDEX } from "./indices";

type EnrolledUnit = { code: string; university: string };

function safeLog(msg: string) {
  if (process.env.NODE_ENV !== "production") {
    console.log(msg);
  }
}

export async function indexUser(
  client: Client,
  user: {
    id: string;
    name: string;
    displayName: string | null;
    bio: string | null;
    enrolledUnits: unknown;
    createdAt: Date;
    connections: { id: string }[];
    connectedBy: { id: string }[];
    upcomingEvents: { id: string }[];
    organisedEvents: { id: string }[];
  },
): Promise<void> {
  const units: EnrolledUnit[] = Array.isArray(user.enrolledUnits)
    ? (user.enrolledUnits as EnrolledUnit[])
    : [];

  const doc: UserDocument = {
    id: user.id,
    name: user.name,
    displayName: user.displayName,
    bio: user.bio,
    unitCodes: units.map((u) => u.code),
    unitUniversities: [...new Set(units.map((u) => u.university))],
    connectionIds: [
      ...new Set([
        ...user.connections.map((c) => c.id),
        ...user.connectedBy.map((c) => c.id),
      ]),
    ],
    upcomingEventIds: user.upcomingEvents.map((e) => e.id),
    organisedEventIds: user.organisedEvents.map((e) => e.id),
    createdAt: user.createdAt.toISOString(),
  };

  await client.index({
    index: USERS_INDEX,
    id: user.id,
    document: doc,
  });

  safeLog(`[ES] Indexed user ${user.id}`);
}

export async function indexEvent(
  client: Client,
  event: {
    id: string;
    title: string;
    location: string;
    content: string | null;
    date: Date;
    bannerUrl: string | null;
    ticketUrl: string | null;
    organisers: { id: string; name: string }[];
    participants: { id: string }[];
  },
): Promise<void> {
  const doc: EventDocument = {
    id: event.id,
    title: event.title,
    location: event.location,
    content: event.content,
    date: event.date.toISOString(),
    bannerUrl: event.bannerUrl,
    ticketUrl: event.ticketUrl,
    organiserIds: event.organisers.map((o) => o.id),
    organiserNames: event.organisers.map((o) => o.name),
    participantIds: event.participants.map((p) => p.id),
    participantCount: event.participants.length,
  };

  await client.index({
    index: EVENTS_INDEX,
    id: event.id,
    document: doc,
  });

  safeLog(`[ES] Indexed event ${event.id}`);
}

export async function removeDocument(
  client: Client,
  index: string,
  id: string,
): Promise<void> {
  try {
    await client.delete({ index, id });
    safeLog(`[ES] Deleted ${index}/${id}`);
  } catch (err: any) {
    if (err?.meta?.statusCode === 404) return;
    throw err;
  }
}

export async function updateEventParticipants(
  client: Client,
  eventId: string,
  participantIds: string[],
): Promise<void> {
  try {
    await client.update({
      index: EVENTS_INDEX,
      id: eventId,
      doc: {
        participantIds,
        participantCount: participantIds.length,
      },
    });
  } catch (err: any) {
    if (err?.meta?.statusCode === 404) return;
    throw err;
  }
}

export async function updateUserConnections(
  client: Client,
  userId: string,
  connectionIds: string[],
): Promise<void> {
  try {
    await client.update({
      index: USERS_INDEX,
      id: userId,
      doc: { connectionIds },
    });
  } catch (err: any) {
    if (err?.meta?.statusCode === 404) return;
    throw err;
  }
}

export async function updateUserEvents(
  client: Client,
  userId: string,
  upcomingEventIds: string[],
  organisedEventIds: string[],
): Promise<void> {
  try {
    await client.update({
      index: USERS_INDEX,
      id: userId,
      doc: { upcomingEventIds, organisedEventIds },
    });
  } catch (err: any) {
    if (err?.meta?.statusCode === 404) return;
    throw err;
  }
}
