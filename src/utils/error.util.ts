export class ErrorUtil {
    /**
     * Safely parses an unknown error into a standardized object containing a message and optional code/status.
     */
    static parseError(error: unknown): { message: string; code?: string; status?: number; [key: string]: unknown } {
        if (error instanceof Error) {
            const errObj = error as unknown as Record<string, unknown>;
            return {
                ...errObj,
                message: error.message,
                code: typeof errObj.code === 'string' ? errObj.code : undefined,
                status: typeof errObj.status === 'number' ? errObj.status : undefined,
            };
        }

        if (typeof error === 'object' && error !== null) {
            const errObj = error as Record<string, unknown>;
            return {
                ...errObj,
                message: typeof errObj.message === 'string' ? errObj.message : String(error),
                code: typeof errObj.code === 'string' ? errObj.code : undefined,
                status: typeof errObj.status === 'number' ? errObj.status : undefined,
            };
        }

        if (typeof error === 'string') {
            return { message: error };
        }

        return { message: 'An unknown error occurred' };
    }

    /**
     * Helper to safely extract just the message from an unknown error.
     */
    static getMessage(error: unknown): string {
        return this.parseError(error).message;
    }

    /**
     * Helper to safely extract just the code from an unknown error.
     */
    static getCode(error: unknown): string | undefined {
        return this.parseError(error).code;
    }
}
