---
name: api-endpoint
description: How to add a backend API endpoint in apps/web (Next.js App Router route handlers + MongoDB) consumed by the Expo app. Use when creating or changing anything under apps/web/src/app/api or server-side data access.
---

# API endpoint (apps/web)

This Next.js is newer than training data: read the relevant guide in `node_modules/next/dist/docs/` (route handlers, caching) before writing code.

## Layout

- Route handlers: `apps/web/src/app/api/<resource>/route.ts` (export `GET`, `POST`, ...).
- Server-only code (Mongo client, queries): `apps/web/src/server/**`. Never import it from client components.
- Request/response types: `@champion/shared`, so the mobile app uses the same types.

## Rules

- Validate all input (query params, body) at the handler boundary; return `400` with a clear message on bad input.
- Return JSON via `Response.json(...)`. Keep response shapes stable and typed.
- One shared, cached Mongo client (module-level singleton, reused across hot reloads in dev). Connection string from `MONGODB_URI`.
- Historical data is static: cache aggressively. API-Football-backed data: cache and respect rate limits.
- CORS: the Expo web build calls this API from another origin in dev – handle it if needed.
- Verify: `pnpm --filter @champion/web typecheck`, then hit the route with `curl` on the dev server.
