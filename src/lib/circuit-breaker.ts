/**
 * Lightweight circuit breaker for external service calls.
 *
 * States:
 *   CLOSED   -- normal operation, calls pass through
 *   OPEN     -- failures exceeded threshold, calls fail fast (or use fallback)
 *   HALF_OPEN -- reset timeout elapsed, one probe call is allowed through
 *
 * Usage:
 * ```ts
 * const geoBreaker = new CircuitBreaker(5, 30_000);
 *
 * const result = await geoBreaker.execute(() =>
 *     fetch(`${GEOSERVER_URL}/wms?...`)
 * );
 * ```
 */
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreakerError extends Error {
    constructor(public readonly serviceName: string) {
        super(`Circuit breaker OPEN for "${serviceName}" -- service temporarily unavailable`);
        this.name = 'CircuitBreakerError';
    }
}

export class CircuitBreaker {
    private state: CircuitState = 'CLOSED';
    private failureCount = 0;
    private lastFailureTime = 0;

    /**
     * @param failureThreshold Number of consecutive failures before opening the circuit
     * @param resetTimeoutMs   Duration (ms) to wait before transitioning from OPEN to HALF_OPEN
     * @param serviceName      Descriptive name for error messages and logging
     * @param fallback         Optional fallback function invoked when circuit is OPEN
     */
    constructor(
        private failureThreshold: number = 5,
        private resetTimeoutMs: number = 30_000,
        private serviceName: string = 'external-service',
        private fallback?: () => Promise<unknown>,
    ) {}

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
                // Transition to HALF_OPEN -- allow one probe request
                this.state = 'HALF_OPEN';
            } else {
                if (this.fallback) {
                    return this.fallback() as T;
                }
                throw new CircuitBreakerError(this.serviceName);
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (err) {
            this.onFailure();
            throw err;
        }
    }

    private onSuccess(): void {
        this.failureCount = 0;
        this.state = 'CLOSED';
    }

    private onFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
            console.warn(
                `[CircuitBreaker] "${this.serviceName}" OPEN after ${this.failureCount} failures. ` +
                `Will retry after ${this.resetTimeoutMs}ms.`
            );
        }
    }

    getState(): CircuitState {
        return this.state;
    }

    reset(): void {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.lastFailureTime = 0;
    }
}
