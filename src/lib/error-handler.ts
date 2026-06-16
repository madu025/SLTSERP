// Global Error Handler Middleware
// This catches all unhandled errors and returns proper responses

import { NextResponse } from 'next/server';

export class ApiError extends Error {
    constructor(
        public statusCode: number,
        public message: string,
        public details?: any
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

export function handleApiError(error: unknown) {
    console.error('API Error:', error);

    // Known API Error
    if (error instanceof ApiError) {
        return NextResponse.json(
            {
                error: error.message,
                details: process.env.NODE_ENV === 'development' ? error.details : undefined
            },
            { status: error.statusCode }
        );
    }

    // Prisma Errors
    if (error && typeof error === 'object' && 'code' in error) {
        const prismaError = error as any;

        switch (prismaError.code) {
            case 'P2002':
                return NextResponse.json(
                    { error: 'A record with this value already exists.' },
                    { status: 409 }
                );
            case 'P2025':
                return NextResponse.json(
                    { error: 'Record not found.' },
                    { status: 404 }
                );
            case 'P2003':
                return NextResponse.json(
                    { error: 'Related record not found.' },
                    { status: 400 }
                );
            default:
                return NextResponse.json(
                    {
                        error: 'Database operation failed.',
                        details: process.env.NODE_ENV === 'development' ? prismaError.message : undefined
                    },
                    { status: 500 }
                );
        }
    }

    // Validation Errors
    if (error instanceof Error && error.message.includes('Invalid')) {
        return NextResponse.json(
            { error: error.message },
            { status: 400 }
        );
    }

    // Generic Error
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
        {
            error: 'Internal Server Error',
            message: process.env.NODE_ENV === 'development' ? message : 'Please try again later.',
            details: process.env.NODE_ENV === 'development' ? error : undefined
        },
        { status: 500 }
    );
}

// Async handler wrapper - prevents unhandled promise rejections
export function asyncHandler(handler: Function) {
    return async (req: Request, context?: any) => {
        try {
            return await handler(req, context);
        } catch (error) {
            return handleApiError(error);
        }
    };
}
