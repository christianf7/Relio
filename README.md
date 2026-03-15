# Relio

A social networking app built for real-world connection.

Relio helps people discover events, meet nearby peers, and connect instantly with branded QR flows.

## Stack

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Expo](https://img.shields.io/badge/Expo-SDK%2054-000020?logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?logo=react&logoColor=0A0A1A)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![tRPC](https://img.shields.io/badge/tRPC-11-398CCB?logo=trpc&logoColor=white)
![TanStack Query](https://img.shields.io/badge/TanStack%20Query-v5-FF4154?logo=reactquery&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)
![Better Auth](https://img.shields.io/badge/Better%20Auth-1.4%20beta-8A2BE2)
![Elasticsearch](https://img.shields.io/badge/Elasticsearch-Search-005571?logo=elasticsearch&logoColor=white)
![Turbo](https://img.shields.io/badge/Turborepo-2.5-EF4444?logo=turborepo&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&logoColor=white)

## What Relio Does

- Instant QR-based profile and event connections
- Event creation, discovery, and attendance flow
- People discovery and connection requests powered by Elastic search
- 1:1 messaging and event chat
- Structured onboarding with role selection
- Profile management with social links and course metadata

## Monorepo Layout

```text
apps/
  expo/      Mobile app (Expo + React Native)
  nextjs/    Web app and API host (Next.js + tRPC)
packages/
  api/       tRPC routers
  auth/      Better Auth config
  db/        Prisma schema and DB package
  es/        Elasticsearch indexing/search helpers
  ui/        Shared web UI package
  validators/ Shared validation schemas
tooling/
  eslint/ prettier/ tailwind/ typescript shared configs
```

## Prerequisites

- Node.js `^22.21.0`
- pnpm `^10.19.0`
- PostgreSQL database (via `POSTGRES_URL`)
- Optional: Elasticsearch for search/recommendation features

## Quick Start

```bash
# 1) Install dependencies
pnpm i

# 2) Configure env vars
cp .env.example .env

# 3) Generate auth schema
pnpm auth:generate

# 4) Sync Prisma schema
pnpm db:push

# 5) (Optional) Ensure ES indices
pnpm es:ensure-indices

# 6) Run all apps/packages in watch mode
pnpm dev

Optionally you can also seed with pnpm db:seed & pnpm es:seed to fill with test data.
```

## Useful Commands

```bash
pnpm dev           # start workspace dev watch
pnpm dev:next      # run Next.js-focused dev watch
pnpm typecheck     # typecheck all packages
pnpm lint          # lint all packages
pnpm format:fix    # auto-format
pnpm db:studio     # open Prisma Studio
pnpm db:migrate    # run Prisma migrate
pnpm db:seed       # seed database
pnpm es:seed       # seed Elasticsearch data
```

## Mobile App Notes

Run Expo app only:

```bash
pnpm --filter @acme/expo dev
```

Platform-specific:

```bash
pnpm --filter @acme/expo dev:ios
pnpm --filter @acme/expo dev:android
```

## Web App Notes

Run Next.js app only:

```bash
pnpm --filter @acme/nextjs dev
```

## Authentication

Relio uses Better Auth with OAuth support and Expo compatibility.

- Auth config: `packages/auth/src/index.ts`
- Auth schema generation: `pnpm auth:generate`
- Expo flow support via Better Auth Expo plugin and OAuth proxy

## Search

Elasticsearch powers fast event/user discovery and recommendation workflows.

- Index setup: `pnpm es:ensure-indices`
- Seed data: `pnpm es:seed`
- Related docs: `ELASTICSEARCH.md`

## Tech Principles

- End-to-end typesafety (tRPC + TypeScript)
- Shared packages for API/auth/db/validators
- Fast iterative dev with Turborepo pipelines
- Mobile-first product with dedicated web companion app

## Status

Actively evolving product codebase.

If you are contributing, open an issue or PR with clear reproduction steps, screenshots, and environment details.
