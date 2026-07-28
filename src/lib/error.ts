export enum ErrorCode {
    BAD_REQUEST               = 'BAD_REQUEST',
    UNAUTHORIZED              = 'UNAUTHORIZED',
    FORBIDDEN                 = 'FORBIDDEN',
    NOT_FOUND                 = 'NOT_FOUND',
    CONFLICT                  = 'CONFLICT',
    VALIDATION_ERROR          = 'VALIDATION_ERROR',
    INTERNAL_ERROR            = 'INTERNAL_ERROR',
    INSUFFICIENT_STOCK        = 'INSUFFICIENT_STOCK',
    DATABASE_ERROR            = 'DATABASE_ERROR',
    /** HTTP 429 — Redis-backed per-IP rate limiter tripped */
    RATE_LIMIT_EXCEEDED       = 'RATE_LIMIT_EXCEEDED',
    /** HTTP 400 — Financial write endpoint called without x-idempotency-key */
    IDEMPOTENCY_REQUIRED      = 'IDEMPOTENCY_REQUIRED',
    /** HTTP 409 — A Journal Entry with the given idempotency key already exists */
    IDEMPOTENCY_CONFLICT      = 'IDEMPOTENCY_CONFLICT',
    /** HTTP 423 — Fiscal period is closed; posting is blocked */
    PERIOD_LOCKED             = 'PERIOD_LOCKED',
    /** HTTP 422 — Double-entry DR/CR imbalance or financial integrity violation */
    FINANCIAL_INTEGRITY_ERROR = 'FINANCIAL_INTEGRITY_ERROR'
}

export class AppError extends Error {
    public readonly code: ErrorCode;
    public readonly statusCode: number;
    public readonly details?: unknown;

    constructor(message: string, code: ErrorCode = ErrorCode.INTERNAL_ERROR, statusCode: number = 500, details?: unknown) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        Object.setPrototypeOf(this, AppError.prototype);
    }

    static badRequest(message: string, details?: unknown) {
        return new AppError(message, ErrorCode.BAD_REQUEST, 400, details);
    }

    static notFound(message: string) {
        return new AppError(message, ErrorCode.NOT_FOUND, 404);
    }

    static unauthorized(message: string) {
        return new AppError(message, ErrorCode.UNAUTHORIZED, 401);
    }

    static forbidden(message: string) {
        return new AppError(message, ErrorCode.FORBIDDEN, 403);
    }

    static conflict(message: string) {
        return new AppError(message, ErrorCode.CONFLICT, 409);
    }

    static validation(message: string, details?: unknown) {
        return new AppError(message, ErrorCode.VALIDATION_ERROR, 422, details);
    }

    static internal(message: string) {
        return new AppError(message, ErrorCode.INTERNAL_ERROR, 500);
    }

    static insufficientStock(itemId: string, missing: number) {
        return new AppError(`Insufficient stock for item ${itemId}`, ErrorCode.INSUFFICIENT_STOCK, 400, { itemId, missing });
    }
}
