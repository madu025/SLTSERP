/* eslint-disable @typescript-eslint/no-explicit-any */
export enum ErrorCode {
    BAD_REQUEST = 'BAD_REQUEST',
    UNAUTHORIZED = 'UNAUTHORIZED',
    FORBIDDEN = 'FORBIDDEN',
    NOT_FOUND = 'NOT_FOUND',
    CONFLICT = 'CONFLICT',
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
    DATABASE_ERROR = 'DATABASE_ERROR'
}

export class AppError extends Error {
    public readonly code: ErrorCode;
    public readonly statusCode: number;
    public readonly details?: any;

    constructor(message: string, code: ErrorCode = ErrorCode.INTERNAL_ERROR, statusCode: number = 500, details?: any) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        Object.setPrototypeOf(this, AppError.prototype);
    }

    static badRequest(message: string, details?: any) {
        return new AppError(message, ErrorCode.BAD_REQUEST, 400, details);
    }

    static notFound(message: string) {
        return new AppError(message, ErrorCode.NOT_FOUND, 404);
    }

    static validation(message: string, details?: any) {
        return new AppError(message, ErrorCode.VALIDATION_ERROR, 422, details);
    }

    static internal(message: string) {
        return new AppError(message, ErrorCode.INTERNAL_ERROR, 500);
    }

    static insufficientStock(itemId: string, missing: number) {
        return new AppError(`Insufficient stock for item ${itemId}`, ErrorCode.INSUFFICIENT_STOCK, 400, { itemId, missing });
    }
}
