# Elasticsearch Integration

Relio uses [Elasticsearch](https://www.elastic.co/elasticsearch) via Elastic Cloud to power two core features: the **people discover feed** and **event recommendations/search**. This replaces the previous approach of fetching candidates from PostgreSQL and scoring them in-memory.

## What Elasticsearch Powers

### People Discover Feed (`discover.getDiscoverFeed`)

The swipe-based discover feed uses an Elasticsearch `function_score` query to find and rank candidate profiles in a single request. Scoring factors:

| Signal | Weight | Description |
|--------|--------|-------------|
| Shared unit codes | +25 per match | Students enrolled in the same courses score highest |
| Same university | +10 | Fallback boost when no shared units but same university |
| Shared events | +30 per event | Students attending or organising the same upcoming events |
| Random tiebreaker | +0.1 | Shuffles equal-scoring profiles so the feed feels fresh |

Users who have already been swiped on, are already connected, or are the current user are excluded via a `must_not` terms filter. The query returns results pre-sorted by score, eliminating the need for in-memory sorting.

### Event Recommendations (`event.getSuggestedEvents`)

The "Events you may be interested in" section on the home screen uses a `function_score` query on the events index. Scoring factors:

| Signal | Weight | Description |
|--------|--------|-------------|
| Connections attending | +30 per connection | Events your connections have joined |
| Unit peers attending | +15 | Events popular with students in your units |
| Popularity | log1p(participantCount) * 2 | Trending events with more attendees get a boost |
| Date proximity | Gaussian decay (7-day scale) | Events happening sooner score higher |

Only future events the user hasn't already joined are considered.

### Event Search (`event.searchEvents`)

The events tab uses server-side full-text search powered by Elasticsearch instead of client-side string filtering. Features:

- **Multi-field search** across event title, location, description, and organiser names
- **Fuzzy matching** with automatic typo tolerance
- **Filter support** for time-based filters (upcoming, this week, past, my events)
- **Relevance ranking** when a search query is provided, date-sorted otherwise

## Architecture

```
PostgreSQL (source of truth)
     |
     |-- tRPC mutations trigger fire-and-forget ES sync calls
     |
Elasticsearch (search/scoring layer)
     |
     |-- relio_users index (profiles, units, connections, events)
     |-- relio_events index (title, location, participants, dates)
```

- **PostgreSQL** remains the source of truth for all data
- **Elasticsearch** is a read-optimised secondary index used only for search and scoring
- Data flows one way: PG -> ES, triggered by explicit sync calls after tRPC mutations
- The app **gracefully degrades** when ES is not configured -- all procedures fall back to the original Prisma-based logic

## Package Structure

The ES integration lives in `packages/es` (`@acme/es`):

| File | Purpose |
|------|---------|
| `src/client.ts` | Singleton ES client, connects via `ELASTICSEARCH_URL` and `ELASTICSEARCH_API_KEY` |
| `src/indices.ts` | Index mappings for `relio_users` and `relio_events`, plus TypeScript document types |
| `src/sync.ts` | Functions to index, update, and delete documents in ES |
| `src/seed.ts` | Bulk-indexes all existing PostgreSQL data into ES |
| `src/ensure-indices.ts` | Creates indices with correct mappings |

The sync layer lives in `packages/api/src/es-sync.ts` and provides fire-and-forget wrappers that the tRPC routers call after mutations (create/update/delete events, join/leave events, accept/remove connections, update profiles).

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ELASTICSEARCH_URL` | Elastic Cloud deployment endpoint (e.g. `https://my-deployment.es.us-east-1.aws.elastic.cloud:443`) |
| `ELASTICSEARCH_API_KEY` | Base64-encoded API key created from Kibana > Stack Management > API Keys |

Both are optional. When not set, the ES client is `null` and all search/scoring falls back to PostgreSQL.

## Setup

1. Sign up at [cloud.elastic.co](https://cloud.elastic.co) and create a deployment
2. Create an API key from Kibana > Stack Management > API Keys
3. Add both values to `.env`:
   ```
   ELASTICSEARCH_URL=https://your-deployment.es.region.aws.elastic.cloud:443
   ELASTICSEARCH_API_KEY=your-base64-api-key
   ```
4. Create the indices:
   ```bash
   pnpm es:ensure-indices
   ```
5. Seed existing data from PostgreSQL:
   ```bash
   pnpm es:seed
   ```

## Why Elasticsearch Over PostgreSQL Full-Text Search

- **`function_score` queries** combine multiple scoring signals (shared units, events, popularity, date decay) in a single request with configurable weights -- this would require complex raw SQL or multiple queries in PostgreSQL
- **Fuzzy matching and typo tolerance** are built-in via `fuzziness: "AUTO"`
- **Gaussian decay functions** for date proximity scoring have no PostgreSQL equivalent
- **Scales independently** of the primary database -- search load doesn't impact transactional queries
- **Easy to extend** with new signals (bio text similarity, mutual connections, vector embeddings) without changing the database schema
