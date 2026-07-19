---
kind: logging_system
name: Custom Console-Based Logger with Request Tracing
category: logging_system
scope:
    - '**'
source_files:
    - src/lib/logger.ts
    - src/lib/request-context.ts
    - src/middleware.ts
    - src/lib/prisma.ts
---

The SLT ERP monorepo uses a minimal, in-house logging implementation rather than a third-party framework. There is no dedicated `log/` or `logging/` directory; the entire system lives in two small files under `src/lib/`.

**Core components**
- `src/lib/logger.ts` — A tiny synchronous `Logger` class exposing `info`, `warn`, `error`, and a `perf(message, durationMs, meta?)` helper that auto-promotes to `warn` when `durationMs > 500`. Every message is formatted as `[ISO timestamp] [LEVEL] [ReqID: ...] <message> | <JSON meta>` and emitted via `console.log` / `console.warn` / `console.error`.
- `src/lib/request-context.ts` — An `AsyncLocalStorage` store holding `{ requestId, forcePrimary }`; `getRequestId()` is consumed by the logger so every log line can be correlated back to its HTTP request.
- `src/middleware.ts` — Generates a UUID per request (`crypto.randomUUID()`) and injects it into the response header `x-request-id`; this value is then picked up by the logger through the request context (the middleware sets the header but does not explicitly populate `requestContext`, so correlation relies on callers passing the ID or on the context being set elsewhere).
- `src/lib/prisma.ts` — Extends Prisma with an `$allOperations` hook that logs slow queries (>500 ms) via `logger.perf`, tagging each entry with `[PRIMARY]` or `[REPLICA]` and including `{ operation, model }` metadata. Prisma's own query logging is kept at `['error', 'warn']` in dev and `['error']` in production.

**Usage pattern across the codebase**
The logger singleton is imported from `@/lib/logger` (or dynamically imported inside hot paths like `stats.service.ts`) and used consistently in API routes and services:
- `src/app/api/gis/process/route.ts`, `src/app/api/gis/upload/route.ts`, `src/app/api/gis/route.ts`
- `src/app/api/cron/drift-correction/route.ts`, `src/app/api/health/route.ts`
- `src/services/gis/GISImportService.ts`
- `src/lib/prisma.ts` (slow-query perf logs)

Callers typically pass structured `meta` objects (e.g. `{ importId, layerTypes }`) alongside the message string.

**Architecture & conventions**
- No external logging dependency — pure Node.js `console.*` output, suitable for Docker stdout collection.
- Four levels only: `info`, `warn`, `error`, plus a performance-specific `perf` level that doubles as info/warn based on duration.
- Structured fields are attached as a third argument and serialized inline as JSON after a ` | ` separator.
- Request correlation is intended via `x-request-id` + `AsyncLocalStorage`, but the current middleware does not call `runInRealtimeContext`, so the `RequestId` prefix appears only when the caller explicitly sets the context.
- Slow-query threshold is hardcoded at 500 ms in both the Prisma hook and the `Logger.perf` helper.

**Rules developers should follow**
1. Import the shared logger via `import { logger } from '@/lib/logger'` (or dynamic `await import(...)`) instead of calling `console.*` directly in application code.
2. Always include a descriptive message string as the first argument; attach contextual data as a plain object in the second/third argument so it serializes as structured JSON.
3. Use `logger.perf(msg, durationMs, meta)` for timing-sensitive operations rather than manual timestamps.
4. Do not add new log levels — stick to `info|warn|error|perf`.
5. If you need the `ReqID` prefix automatically, wrap your async work with `runInRealtimeContext` from `@/lib/request-context` so `getRequestId()` returns a value.