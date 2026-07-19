---
kind: error_handling
name: Centralized Error Types, API Wrappers & Client-Side Boundaries
category: error_handling
scope:
    - '**'
source_files:
    - src/lib/error.ts
    - src/lib/api-handler.ts
    - src/lib/api-utils.ts
    - src/lib/error-handler.ts
    - src/middleware.ts
    - src/components/ErrorBoundary.tsx
---

The SLT ERP monorepo uses a layered error-handling strategy that spans server-side Next.js routes, shared service layers, and the React client. Three complementary systems coexist:

1. Server-side domain errors (src/lib/error.ts)
- ErrorCode enum defines canonical codes: BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, VALIDATION_ERROR, INTERNAL_ERROR, INSUFFICIENT_STOCK, DATABASE_ERROR.
- AppError extends Error with code, statusCode, and optional details; factory helpers (badRequest, notFound, validation, internal, insufficientStock) are used throughout services (e.g., invoice.service.ts, contractors/generate-link/route.ts).

2. Route-level response normalization — two parallel wrappers exist:
- apiHandler (src/lib/api-handler.ts) is the preferred higher-order wrapper for new routes. It injects request context (x-request-id, x-user-id, x-user-role), performs Zod validation when a schema is supplied, enforces role-based access via an optional roles array, wraps execution in requestContext.run, emits audit logs, and returns a uniform { success, data, timestamp, duration } or { success, error: { code, message, details }, timestamp } shape. Uncaught errors are mapped to AppError instances so clients always receive a typed error.code.
- handleApiError / ApiError (src/lib/api-utils.ts) is a simpler per-route try/catch helper still used by many legacy admin routes. It converts ApiError, ZodError, and Prisma known errors into JSON responses and exposes debug stacks only in development.

3. Global fallback (src/lib/error-handler.ts)
- Provides asyncHandler and handleApiError for route files that do not use either apiHandler or api-utils. It recognizes ApiError, Prisma error codes (P2002 → 409, P2025 → 404, P2003 → 400), generic Invalid* messages as 400, and otherwise returns a 500 with dev-only stack traces.

4. Middleware auth error path (src/middleware.ts)
- Rejects unauthenticated requests before they reach route handlers: API endpoints return { message: 'Authentication required' } with 401 + x-request-id; page routes redirect to /login. Authenticated requests carry x-user-id/x-user-role headers consumed by apiHandler.

5. Client-side resilience (src/components/ErrorBoundary.tsx)
- A React ErrorBoundary component catches render-time exceptions, shows a user-friendly fallback with a reload button, and prints full stack traces in development.
- safeFetch(url, options) wraps fetch, throws on non-OK responses, and calls logApiError which records endpoint, error message, stack, and userAgent (dev-only).

Conventions observed across the codebase:
- Prefer apiHandler with a Zod schema and optional roles/audit config for new routes; it centralizes validation, RBAC, auditing, and standardized responses.
- Throw AppError from service/repository layers using the typed ErrorCode values rather than raw strings; let apiHandler translate them to HTTP status + structured body.
- For older routes still using api-utils, throw ApiError(message, statusCode) and catch with handleApiError.
- Never swallow errors in async route bodies — always return or rethrow so the wrapper can normalize.
- The middleware already sanitizes incoming x-user-* headers to prevent spoofing; downstream code should trust those headers only after verification.
- Production responses never leak internal stacks or Prisma internals; NODE_ENV === 'development' gates debug payloads.