import { NextResponse } from 'next/server';
import { z } from 'zod';

export class ApiError extends Error {
    constructor(public message: string, public statusCode: number = 500, public errors?: unknown) {
        super(message);
    }
}

export function handleApiError(error: unknown) {
    console.error('[API_ERROR]:', error);

    if (error instanceof ApiError) {
        return NextResponse.json(
            { message: error.message, errors: error.errors },
            { status: error.statusCode }
        );
    }

    if (error instanceof z.ZodError) {
        return NextResponse.json(
            { message: 'Validation failed', errors: error.format() },
            { status: 400 }
        );
    }

    // Default error handling
    const errObj = error instanceof Error ? error : new Error(String(error));
    const message = errObj.message || 'Internal Server Error';
    const status = errObj.name === 'PrismaClientKnownRequestError' ? 400 : 500;

    return NextResponse.json(
        { message, debug: process.env.NODE_ENV === 'development' ? errObj.stack : undefined },
        { status }
    );
}

export async function validateBody<T>(request: Request, schema: z.Schema<T>): Promise<T> {
    const body = await request.json();
    const result = schema.safeParse(body);
    if (!result.success) {
        throw new ApiError('Validation failed', 400, result.error.format());
    }
    return result.data;
}
