import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { nextCookies } from "better-auth/next-js";

import { initAuth } from "@acme/auth";
import { db } from "@acme/db/client";
import { es, indexUser } from "@acme/es";

import { env } from "~/env";

const baseUrl =
  env.VERCEL_ENV === "production"
    ? `${env.VERCEL_PROJECT_PRODUCTION_URL}`
    : env.VERCEL_ENV === "preview"
      ? `https://${env.VERCEL_URL}`
      : "http://localhost:3000";

export const auth = initAuth({
  baseUrl,
  productionUrl: `${env.VERCEL_PROJECT_PRODUCTION_URL ?? "turbo.t3.gg"}`,
  secret: env.AUTH_SECRET,
  discordClientId: env.AUTH_DISCORD_ID,
  discordClientSecret: env.AUTH_DISCORD_SECRET,
  extraPlugins: [nextCookies()],
  onUserCreated: async (user) => {
    if (!es) return;
    try {
      const fullUser = await db.user.findUnique({
        where: { id: user.id },
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
      if (fullUser) await indexUser(es, fullUser);
    } catch (err) {
      console.error("[Auth] Failed to index new user to ES:", err);
    }
  },
});

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);
