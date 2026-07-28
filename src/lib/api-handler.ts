import { NextResponse } from 'next/server';
import { ZodSchema } from 'zod';
import { AppError, ErrorCode } from './error';
import { AuditService } from '@/services/audit.service';
import { SystemMonitoringService } from '@/services/admin/system-monitoring.service';
import { requestContext } from './request-context';
import { logger } from './logger';

// ─── Response Envelope ────────────────────────────────────────────────────────

export interface ApiPagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

/**
 * Standard API Response Envelope — ERP Grade.
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
    /** Idempotency key echoed back for financial write endpoints */
    idempotencyKey?: string;
    /** Non-fatal advisory messages (e.g. "Stock nearing ROP threshold") */
    warnings?: string[];
    /** Request correlation ID for cross-log tracing */
    requestId?: string;
    pagination?: ApiPagination;
    timestamp: string;
    duration?: string;
}

// ─── Request-scoped metadata injected into every handler's params arg ─────────

/**
 * ERP-grade metadata fields merged into the `params` object passed to every
 * handler.  Backward-compatible: existing `params.id`, `params.teamId` etc.
 * continue to work; the new fields (prefixed with underscore) are added
 * transparently so callers that don't need them are unaffected.
 */
export interface ApiHandlerMeta {
    /** Authenticated user ID from x-user-id header */
    _userId: string | null;
    /** Authenticated user role from x-user-role header */
    _userRole: string | null;
    /** Request correlation ID (x-request-id or generated UUID) */
    _requestId: string;
    /**
     * Idempotency key from x-idempotency-key header.
     * Guaranteed non-null when `financialWrite: true` is set in options.
     */
    _idempotencyKey: string | null;
}

// ─── apiHandler Options ───────────────────────────────────────────────────────

export interface ApiHandlerOptions<B> {
    schema?: ZodSchema<B>;
    roles?: string[];
    audit?: {
        action: string;
        entity: string;
    };
    rawResponse?: boolean;
    rateLimit?: {
        max: number;
        windowSecs: number;
    };
    /**
     * Financial write path guard.
     * When true:
     *  - enforces x-idempotency-key header presence (HTTP 400 if absent)
     *  - logs a FINANCIAL_WRITE advisory event with userId + route
     *  - echoes idempotencyKey in success response envelope
     *
     * AGENTS.md STOP Rule: routes with financialWrite = true must be explicitly
     * reviewed and user-approved before handler logic is changed.
     */
    financialWrite?: boolean;
}

// ─── Internal result introspection type ──────────────────────────────────────
type ResultMeta = {
    id?: unknown;
    soNum?: unknown;
    __oldValue?: unknown;
    __warnings?: unknown;
};

// ─── Body casting utilities ───────────────────────────────────────────────────

/**
 * Explicit, reviewable type assertion for routes without a Zod schema.
 * Use this when passing `body` to a service function that expects a specific
 * typed interface, as an incremental migration step before adding a Zod schema.
 *
 * @example
 * export const POST = apiHandler(async (_req, _params, body) => {
 *     const result = await InventoryService.createMRN(castBody<CreateMRNInput>(body));
 * });
 */
export function castBody<T>(body: Record<string, unknown>): T {
    return body as unknown as T;
}

// ─── Core apiHandler ──────────────────────────────────────────────────────────

/**
 * Enterprise API Handler — wraps every route with:
 *   1. RBAC enforcement (fail-closed)
 *   2. Redis rate limiting (optional)
 *   3. Financial write guard: idempotency header enforcement + advisory log
 *   4. Zod body validation
 *   5. Structured logger with requestId + perf alerting (>500 ms)
 *   6. Typed error mapping (no `any` in catch blocks)
 *   7. Full audit trail with oldValue annotation
 *   8. 500-error system monitoring
 *   9. Standardised ApiResponse envelope (requestId, warnings, idempotencyKey)
 *
 * Backward-compatible handler signature:
 *   handler(req, params, body)
 *   where `params` = route params merged with ApiHandlerMeta (_userId, _userRole,
 *   _requestId, _idempotencyKey).  Existing code accessing params.id etc. is
 *   unaffected; new code can read params._userId etc.
 */
export function apiHandler<T, B = Record<string, unknown>, P extends Record<string, string> = Record<string, string>>(
    handler: (
        req: Request,
        params: P & ApiHandlerMeta,
        body: B
    ) => Promise<T>,
    options?: ApiHandlerOptions<B>
) {
    return async (req: Request, context: { params?: Promise<P> | P } | undefined) => {
        const start = Date.now();

        const userId         = req.headers.get('x-user-id');
        const userRole       = req.headers.get('x-user-role');
        const rawReqId       = req.headers.get('x-request-id');
        const requestId      = rawReqId ?? crypto.randomUUID();
        const idempotencyKey = req.headers.get('x-idempotency-key');

        return await requestContext.run({ requestId }, async () => {
            try {
                // ── 1. RBAC (fail-closed) ──────────────────────────────────
                if (options?.roles && options.roles.length > 0) {
                    if (!userRole || !options.roles.includes(userRole)) {
                        throw new AppError(
                            'Forbidden: insufficient role',
                            ErrorCode.FORBIDDEN,
                            403
                        );
                    }
                }

                // ── 2. Financial Write Guard ───────────────────────────────
                if (options?.financialWrite) {
                    if (!idempotencyKey) {
                        throw new AppError(
                            'Financial write operations require the x-idempotency-key header',
                            ErrorCode.IDEMPOTENCY_REQUIRED,
                            400
                        );
                    }
                    logger.warn('[FINANCIAL-WRITE]', {
                        path: req.url,
                        method: req.method,
                        userId,
                        idempotencyKey,
                        requestId,
                    });
                }

                // ── 3. Rate Limiting ───────────────────────────────────────
                if (options?.rateLimit) {
                    const ip    = req.headers.get('x-forwarded-for') ?? '127.0.0.1';
                    const rlKey = `rate-limit:${req.url}:${ip}`;
                    try {
                        const { redis } = await import('@/lib/redis');
                        const current = await redis.incr(rlKey);
                        if (current === 1) {
                            await redis.expire(rlKey, options.rateLimit.windowSecs);
                        }
                        if (current > options.rateLimit.max) {
                            throw new AppError(
                                'Too many requests, please try again later.',
                                ErrorCode.RATE_LIMIT_EXCEEDED,
                                429
                            );
                        }
                    } catch (e: unknown) {
                        if (e instanceof AppError) throw e;
                        logger.warn('Rate limiter redis failure — bypassing', { error: e });
                    }
                }

                // ── 4. Body Parsing & Validation ───────────────────────────
                let body: B = undefined as unknown as B;

                if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
                    try {
                        const rawBody: unknown = await req.clone().json();
                        if (options?.schema) {
                            const validation = options.schema.safeParse(rawBody);
                            if (!validation.success) {
                                throw AppError.validation(
                                    'Invalid input data',
                                    validation.error.format()
                                );
                            }
                            body = validation.data;
                        } else {
                            // No schema: caller is responsible for casting body to the correct type
                            body = rawBody as B;
                        }
                    } catch (e: unknown) {
                        if (e instanceof AppError) throw e;
                        // Body is empty or non-JSON and no schema required — leave body undefined
                    }
                }

                // ── 5. Build enriched params (route params + ERP meta) ─────
                const routeParams = context?.params
                    ? await Promise.resolve(context.params)
                    : ({} as P);

                const params: P & ApiHandlerMeta = {
                    ...routeParams,
                    _userId: userId,
                    _userRole: userRole,
                    _requestId: requestId,
                    _idempotencyKey: idempotencyKey,
                };

                // ── 6. Execute Handler ─────────────────────────────────────
                const result = await handler(req, params, body);

                // ── 7. Performance Alert (>500 ms) ─────────────────────────
                const durationMs = Date.now() - start;
                logger.perf(`${req.method} ${req.url}`, durationMs, { userId, requestId });

                // ── 8. Audit Log (fire-and-forget) ─────────────────────────
                if (options?.audit && userId) {
                    const meta     = result as ResultMeta;
                    const entityId = String(meta?.id ?? meta?.soNum ?? 'N/A');

                    AuditService.log({
                        userId,
                        action: options.audit.action,
                        entity: options.audit.entity,
                        entityId,
                        // Handlers pre-fetch oldValue and attach as result.__oldValue
                        oldValue: meta?.__oldValue ?? null,
                        newValue: body ?? result,
                        ipAddress: req.headers.get('x-real-ip') ?? undefined,
                        userAgent: req.headers.get('user-agent') ?? undefined,
                    }).catch((err: unknown) =>
                        logger.error('[AUDIT-LOG-FAIL]', { error: err, requestId })
                    );
                }

                // ── 9. Raw Response Passthrough ────────────────────────────
                if (options?.rawResponse) {
                    if (result instanceof Response) return result;
                    return NextResponse.json(result);
                }

                // ── 10. Success Envelope ───────────────────────────────────
                const envelope: ApiResponse<T> = {
                    success: true,
                    data: result,
                    requestId,
                    timestamp: new Date().toISOString(),
                    duration: `${durationMs}ms`,
                };

                if (options?.financialWrite && idempotencyKey) {
                    envelope.idempotencyKey = idempotencyKey;
                }

                const meta = result as ResultMeta;
                if (Array.isArray(meta?.__warnings) && meta.__warnings.length > 0) {
                    envelope.warnings = meta.__warnings as string[];
                }

                return NextResponse.json(envelope);

            } catch (error: unknown) {
                const durationMs = Date.now() - start;
                logger.error(`[API ERROR] ${req.method} ${req.url}`, {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    userId,
                    requestId,
                    durationMs,
                });

                // ── Typed Error Mapping ────────────────────────────────────
                let appError: AppError;

                if (error instanceof AppError) {
                    appError = error;
                } else if (error instanceof Error && error.message === 'Unauthorized') {
                    appError = new AppError('Unauthorized', ErrorCode.UNAUTHORIZED, 401);
                } else if (error instanceof Error && error.message === 'Forbidden') {
                    appError = new AppError('Forbidden', ErrorCode.FORBIDDEN, 403);
                } else if (error instanceof Error) {
                    appError = new AppError(
                        error.message || 'An unexpected error occurred',
                        ErrorCode.INTERNAL_ERROR,
                        500
                    );
                } else {
                    appError = new AppError(
                        'An unexpected error occurred',
                        ErrorCode.INTERNAL_ERROR,
                        500
                    );
                }

                // ── 500 System Monitoring ──────────────────────────────────
                if (appError.statusCode >= 500) {
                    try {
                        const url = new URL(req.url);
                        SystemMonitoringService.logError({
                            statusCode: appError.statusCode,
                            errorCode: appError.code,
                            message: appError.message,
                            stackTrace: error instanceof Error ? error.stack : undefined,
                            path: url.pathname,
                            method: req.method,
                            userId: userId ?? undefined,
                            userRole: userRole ?? undefined,
                            ipAddress: req.headers.get('x-real-ip') ?? undefined,
                            userAgent: req.headers.get('user-agent') ?? undefined,
                            metadata: { details: appError.details ?? null },
                        }).catch((err: unknown) =>
                            logger.error('[MONITORING-LOG-FAIL]', { error: err, requestId })
                        );
                    } catch (e: unknown) {
                        logger.error('[MONITORING-URL-PARSE-FAIL]', { error: e, requestId });
                    }
                }

                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: appError.code,
                            message: appError.message,
                            details: appError.details,
                        },
                        requestId,
                        timestamp: new Date().toISOString(),
                    } satisfies ApiResponse,
                    { status: appError.statusCode }
                );
            }
        });
    };
}
