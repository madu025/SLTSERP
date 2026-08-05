import { NextResponse } from 'next/server';
import { ZodSchema } from 'zod';
import { AppError, ErrorCode } from './error';
import { AuditService } from '@/services/audit/audit.service';
import { SystemMonitoringService } from '@/services/admin/system-monitoring.service';
import { requestContext } from './request-context';
import { logger } from './logger';
import { getMenuAllowedRoles } from '@/config/route-permissions';
import { validateSession } from '@/lib/session-validator';
import { getPrefixGuardRoles, PASSWORD_CHANGE_EXEMPT_PATHS } from '@/config/route-guard-defaults';

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
    /**
     * Dynamic RBAC: resolve allowed roles at runtime from the SIDEBAR_MENU
     * entry at this path (single source of truth). Prefer this over `roles`
     * whenever the route backs a page declared in the sidebar menu — no
     * hardcoded role lists to drift.
     */
    menuPath?: string;
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
 * Recursively redacts sensitive fields (passwords, tokens, secrets, credentials)
 * before persisting payloads to Audit Logs.
 */
export function redactSensitiveFields(data: unknown): unknown {
    if (!data || typeof data !== 'object') return data;
    if (Array.isArray(data)) {
        return data.map(redactSensitiveFields);
    }
    const sensitiveKeys = new Set([
        'password', 'pass', 'token', 'secret', 'jwt',
        'creditcard', 'cvv', 'authorization', 'apikey', 'pin',
        'ssn', 'privatekey'
    ]);
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('token') || lowerKey.includes('secret')) {
            redacted[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
            redacted[key] = redactSensitiveFields(value);
        } else {
            redacted[key] = value;
        }
    }
    return redacted;
}

// ─── Core apiHandler ──────────────────────────────────────────────────────────

/**
 * Enterprise API Handler — wraps every route with:
 *   1. RBAC enforcement (fail-closed)
 *   2. Redis rate limiting (optional)
 *   3. Financial write guard: idempotency header enforcement + Redis deduplication + advisory log
 *   4. Zod body validation & strict malformed JSON error handling
 *   5. Structured logger with requestId + perf alerting (>500 ms)
 *   6. Typed error mapping (no `any` in catch blocks)
 *   7. Full audit trail with sensitive data redaction & oldValue annotation
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
        let userRole         = req.headers.get('x-user-role');
        const rawReqId       = req.headers.get('x-request-id');
        const requestId      = rawReqId ?? crypto.randomUUID();
        const idempotencyKey = req.headers.get('x-idempotency-key');

        return await requestContext.run({ requestId }, async () => {
            try {
                // ── 0. Session freshness (fail-closed) ───────────────────────
                // Verifies the account still exists, is active, and the token
                // version matches the DB — role/status changes invalidate all
                // existing tokens immediately. The DB role replaces the JWT
                // claim so privilege changes take effect without re-login delay.
                if (userId) {
                    const rawVersion = req.headers.get('x-token-version');
                    const parsedVersion = rawVersion === null || rawVersion === '' ? NaN : Number(rawVersion);
                    const session = await validateSession(userId, Number.isFinite(parsedVersion) ? parsedVersion : null);
                    if (!session.valid) {
                        throw new AppError(
                            'Session expired: account deactivated or credentials changed',
                            ErrorCode.UNAUTHORIZED,
                            401
                        );
                    }
                    if (session.role) userRole = session.role;

                    // ── 0b. Forced password-change lockdown (fail-closed) ────
                    // Accounts flagged with mustChangePassword may only reach the
                    // password-change / session-exit endpoints until they rotate.
                    if (session.mustChangePassword) {
                        const pathname = new URL(req.url).pathname;
                        const exempt = PASSWORD_CHANGE_EXEMPT_PATHS.has(pathname)
                            || (pathname === '/api/profile' && req.method === 'GET');
                        if (!exempt) {
                            throw new AppError(
                                'Password change required before continuing',
                                ErrorCode.FORBIDDEN,
                                403
                            );
                        }
                    }
                }

                // ── 1. RBAC (fail-closed) ──────────────────────────────────
                const pathname = new URL(req.url).pathname;
                const declaredGuard = options?.roles && options.roles.length > 0 || options?.menuPath;
                const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);

                // Explicit `roles` win; otherwise resolve dynamically from the
                // sidebar menu config via `menuPath`; undeclared mutating routes
                // fall back to prefix-based departmental defaults (fail-closed).
                const effectiveRoles = options?.roles && options.roles.length > 0
                    ? options.roles
                    : options?.menuPath
                        ? getMenuAllowedRoles(options.menuPath) ?? undefined
                        : isMutating
                            ? getPrefixGuardRoles(pathname)
                            : undefined;

                if (declaredGuard || effectiveRoles) {
                    const allowed = !effectiveRoles || effectiveRoles.length === 0
                        ? true
                        : effectiveRoles.includes('ALL')
                            ? !!userRole // 'ALL' = any authenticated user, never anonymous
                            : !!userRole && effectiveRoles.includes(userRole);
                    if (!allowed) {
                        // Denial traceability: record who tried to hit what with which role
                        if (userId) {
                            AuditService.log({
                                userId,
                                action: 'ACCESS_DENIED',
                                entity: 'API',
                                entityId: pathname,
                                oldValue: null,
                                newValue: { method: req.method, userRole: userRole ?? 'UNKNOWN' },
                                ipAddress: req.headers.get('x-real-ip') ?? undefined,
                                userAgent: req.headers.get('user-agent') ?? undefined,
                            }).catch((err: unknown) =>
                                logger.error('[AUDIT-LOG-FAIL]', { error: err, requestId })
                            );
                        }
                        logger.warn('[RBAC-DENIED]', { path: pathname, method: req.method, userId, userRole, requestId });
                        throw new AppError(
                            'Forbidden: insufficient role',
                            ErrorCode.FORBIDDEN,
                            403
                        );
                    }
                } else if (isMutating) {
                    // No declared guard and no prefix default — surface for the
                    // hardening backlog instead of failing silently.
                    logger.warn('[RBAC-UNDECLARED-WRITE]', { path: pathname, method: req.method, userId, userRole, requestId });
                }

                // ── 2. Financial Write Guard & Redis Idempotency Lock ────────
                if (options?.financialWrite) {
                    if (!idempotencyKey) {
                        throw new AppError(
                            'Financial write operations require the x-idempotency-key header',
                            ErrorCode.IDEMPOTENCY_REQUIRED,
                            400
                        );
                    }

                    try {
                        const { redis } = await import('@/lib/redis');
                        const urlPath = new URL(req.url).pathname;
                        const redisIdempotencyKey = `idempotency:${urlPath}:${idempotencyKey}`;
                        const acquired = await redis.set(redisIdempotencyKey, 'PROCESSING', 'EX', 86400, 'NX');

                        if (!acquired) {
                            const existingState = await redis.get(redisIdempotencyKey);
                            logger.warn('[IDEMPOTENCY-REPLAY-PREVENTED]', {
                                path: urlPath,
                                userId,
                                idempotencyKey,
                                existingState
                            });
                            throw new AppError(
                                'A request with this x-idempotency-key is already processing or completed.',
                                ErrorCode.IDEMPOTENCY_CONFLICT,
                                409
                            );
                        }
                    } catch (e: unknown) {
                        if (e instanceof AppError) throw e;
                        logger.warn('[IDEMPOTENCY-REDIS-FAIL-OPEN]', { error: e, idempotencyKey });
                    }

                    logger.warn('[FINANCIAL-WRITE]', {
                        path: req.url,
                        method: req.method,
                        userId,
                        idempotencyKey,
                        requestId,
                    });
                }

                // 🚨 3. Traffic Inspector Blacklist & Rate Limiting 🚨
                  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('x-real-ip') ?? '127.0.0.1';
                  
                  const { TrafficService } = await import('@/services/system/traffic.service');
                  if (userId && await TrafficService.isBlocked(userId)) {
                      throw new AppError('Access Denied. User is blacklisted.', ErrorCode.FORBIDDEN, 403);
                  }
                  if (await TrafficService.isBlocked(ip)) {
                      throw new AppError('Access Denied. IP is blacklisted.', ErrorCode.FORBIDDEN, 403);
                  }

                  if (options?.rateLimit) {
                      const { checkRateLimit } = await import('@/lib/rate-limiter');
                      const rlResult = await checkRateLimit(`${req.url}:${ip}`, {
                        max: options.rateLimit.max,
                        windowSecs: options.rateLimit.windowSecs,
                        prefix: 'ratelimit:api',
                    });
                    if (!rlResult.allowed) {
                        throw new AppError(
                            'Too many requests, please try again later.',
                            ErrorCode.RATE_LIMIT_EXCEEDED,
                            429
                        );
                    }
                }

                // ── 4. Body Parsing & Strict Validation ────────────────────
                let body: B = undefined as unknown as B;

                if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
                    const contentType = req.headers.get('content-type') || '';
                    const isMultipart = contentType.includes('multipart/form-data');

                    if (!isMultipart) {
                        let rawText = '';
                        try {
                            rawText = await req.clone().text();
                        } catch {
                            // Body stream unreadable
                        }

                        if (rawText.trim().length > 0) {
                            let rawBody: unknown;
                            try {
                                rawBody = JSON.parse(rawText);
                            } catch {
                                throw AppError.badRequest('Malformed JSON payload in request body');
                            }

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
                                body = rawBody as B;
                            }
                        }
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

                // ── 8. Audit Log with Redacted Sensitive Data ───────────────
                if (options?.audit && userId) {
                    const meta     = result as ResultMeta;
                    const entityId = String(meta?.id ?? meta?.soNum ?? 'N/A');

                    AuditService.log({
                        userId,
                        action: options.audit.action,
                        entity: options.audit.entity,
                        entityId,
                        // Handlers pre-fetch oldValue and attach as result.__oldValue
                        oldValue: meta?.__oldValue ? redactSensitiveFields(meta.__oldValue) : null,
                        newValue: redactSensitiveFields(body ?? result),
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
