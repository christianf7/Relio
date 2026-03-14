import { PrismaClient } from "@prisma/client";

import { es } from "./client";
import { EVENTS_INDEX, USERS_INDEX } from "./indices";
import { indexEvent, indexUser } from "./sync";

const prisma = new PrismaClient({ log: ["error"] });

async function seedUsers() {
  if (!es) throw new Error("ES client not available");

  const users = await prisma.user.findMany({
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

  console.log(`[ES Seed] Indexing ${users.length} users...`);

  for (const user of users) {
    await indexUser(es, user);
  }

  console.log(`[ES Seed] Indexed ${users.length} users`);
}

async function seedEvents() {
  if (!es) throw new Error("ES client not available");

  const events = await prisma.event.findMany({
    include: {
      organisers: { select: { id: true, name: true } },
      participants: { select: { id: true } },
    },
  });

  console.log(`[ES Seed] Indexing ${events.length} events...`);

  for (const event of events) {
    await indexEvent(es, event);
  }

  console.log(`[ES Seed] Indexed ${events.length} events`);
}

async function main() {
  if (!es) {
    console.error("[ES Seed] ES client not available – check env vars");
    process.exit(1);
  }

  const usersExists = await es.indices.exists({ index: USERS_INDEX });
  const eventsExists = await es.indices.exists({ index: EVENTS_INDEX });

  if (!usersExists || !eventsExists) {
    console.error(
      "[ES Seed] Indices not found. Run `pnpm -F @acme/es ensure-indices` first.",
    );
    process.exit(1);
  }

  await seedUsers();
  await seedEvents();

  await es.indices.refresh({ index: [USERS_INDEX, EVENTS_INDEX] });

  console.log("[ES Seed] Done");
  process.exit(0);
}

main().catch((err) => {
  console.error("[ES Seed] Failed:", err);
  process.exit(1);
});
