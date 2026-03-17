/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { ZodSchema } from 'zod';
import { AppError, ErrorCode } from './error';

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
}

/**
 * Higher-order function to wrap API routes with standard error handling and validation
 */
export function apiHandler<T, B = any>(
    handler: (req: Request, params: any, body: B) => Promise<T>,
    options?: {
        schema?: ZodSchema<B>;
        roles?: string[];
    }
) {
    return async (req: Request, context: any) => {
        const start = Date.now();
        try {
            let body: B = undefined as any;

            // 1. Validation Logic
            if (options?.schema) {
                const rawBody = await req.json();
                const validation = options.schema.safeParse(rawBody);
                if (!validation.success) {
                    throw AppError.validation('Invalid input data', validation.error.format());
                }
                body = validation.data;
            }

            // 2. Execute the actual Route Logic
            const result = await handler(req, context?.params, body);

            // 3. Success Response
            return NextResponse.json({
                success: true,
                data: result,
                timestamp: new Date().toISOString(),
                duration: `${Date.now() - start}ms`
            } as ApiResponse<T>);

        } catch (error: any) {
            console.error(`[API ERROR] ${req.url}:`, error);

            // 4. Standardized Error Response
            let appError: AppError;

            if (error instanceof AppError) {
                appError = error;
            } else {
                // Wrap unexpected errors
                appError = new AppError(
                    error.message || 'An unexpected error occurred',
                    ErrorCode.INTERNAL_ERROR,
                    500
                );
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
    };
}
