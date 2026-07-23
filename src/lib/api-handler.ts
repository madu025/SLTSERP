/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { ZodSchema } from 'zod';
import { AppError, ErrorCode } from './error';
import { AuditService } from '@/services/audit.service';
import { SystemMonitoringService } from '@/services/admin/system-monitoring.service';
import { requestContext } from './request-context';

/**
 * Standard API Response Format
 */
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    timestamp: string;
    duration?: string;
}

/**
 * Higher-order function to wrap API routes with standard error handling, validation, and security
 */
export function apiHandler<T, B = any>(
    handler: (req: Request, params: any, body: B) => Promise<T>,
    options?: {
        schema?: ZodSchema<B>;
        roles?: string[];
        audit?: {
            action: string;
            entity: string;
        };
        rawResponse?: boolean;
    }
) {
    return async (req: Request, context: any) => {
        const start = Date.now();
        const userId = req.headers.get('x-user-id');
        const userRole = req.headers.get('x-user-role');
        const requestId = req.headers.get('x-request-id') || crypto.randomUUID();

        return await requestContext.run({ requestId }, async () => {
            try {
                // 1. Authentication & RBAC Check
                if (options?.roles && options.roles.length > 0) {
                    if (!userRole || !options.roles.includes(userRole)) {
                        throw new AppError('Forbidden: Access denied', ErrorCode.FORBIDDEN, 403);
                    }
                }

                let body: B = undefined as any;

                // 2. Body Parsing & Validation Logic
                if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
                    try {
                        const rawBody = await req.clone().json();
                        if (options?.schema) {
                            const validation = options.schema.safeParse(rawBody);
                            if (!validation.success) {
                                throw AppError.validation('Invalid input data', validation.error.format());
                            }
                            body = validation.data;
                        } else {
                            body = rawBody;
                        }
                    } catch (e) {
                        if (options?.schema) {
                            throw e;
                        }
                        // If no schema required and body stream is empty/invalid JSON, body remains undefined
                    }
                }

                // 3. Execute the actual Route Logic
                const params = context?.params ? await context.params : undefined;
                const result = await handler(req, params, body);

                // 4. Audit Logging (Optional)
                if (options?.audit && userId) {
                    // If the result has an 'id' or we can find it, use it as entityId
                    const entityId = (result as any)?.id || (result as any)?.soNum || 'N/A';
                    
                    // Fire and forget audit log to not slow down response
                    AuditService.log({
                        userId,
                        action: options.audit.action,
                        entity: options.audit.entity,
                        entityId: String(entityId),
                        newValue: body || result,
                        ipAddress: req.headers.get('x-real-ip') || undefined,
                        userAgent: req.headers.get('user-agent') || undefined
                    }).catch(err => console.error('[AUDIT-LOG-FAIL]', err));
                }

                // 5. Success Response
                if (options?.rawResponse) {
                    if (result instanceof Response) {
                        return result;
                    }
                    return NextResponse.json(result);
                }

                return NextResponse.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    duration: `${Date.now() - start}ms`
                } as ApiResponse<T>);

            } catch (error: any) {
                console.error(`[API ERROR] ${req.url}:`, error);

                // 6. Standardized Error Response
                let appError: AppError;

                if (error instanceof AppError) {
                    appError = error;
                } else if (error instanceof Error && error.message === 'Unauthorized') {
                    appError = new AppError('Unauthorized', ErrorCode.UNAUTHORIZED, 401);
                } else if (error instanceof Error && error.message === 'Forbidden') {
                    appError = new AppError('Forbidden', ErrorCode.FORBIDDEN, 403);
                } else {
                    appError = new AppError(
                        error.message || 'An unexpected error occurred',
                        ErrorCode.INTERNAL_ERROR,
                        500
                    );
                }

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
                            userId: userId || undefined,
                            userRole: userRole || undefined,
                            ipAddress: req.headers.get('x-real-ip') || undefined,
                            userAgent: req.headers.get('user-agent') || undefined,
                            metadata: {
                                details: appError.details || null
                            }
                        }).catch(err => console.error('[MONITORING-LOG-FAIL]', err));
                    } catch (e) {
                        console.error('[MONITORING-URL-PARSE-FAIL]', e);
                    }
                }

                return NextResponse.json({
                    success: false,
                    error: {
                        code: appError.code,
                        message: appError.message,
                        details: appError.details
                    },
                    timestamp: new Date().toISOString()
                } as ApiResponse, { status: appError.statusCode });
            }
        });
    };
}
