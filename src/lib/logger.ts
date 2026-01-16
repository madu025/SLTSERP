import { getRequestId } from './request-context';

type LogLevel = 'info' | 'warn' | 'error' | 'perf';

class Logger {
    private format(level: LogLevel, message: string, meta?: unknown) {
        const timestamp = new Date().toISOString();
        const requestId = getRequestId();
        const tracePrefix = requestId ? ` [ReqID: ${requestId}]` : '';
        const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}]${tracePrefix} ${message}${metaStr}`;
    }

    info(message: string, meta?: unknown) {
        console.log(this.format('info', message, meta));
    }

    warn(message: string, meta?: unknown) {
        console.warn(this.format('warn', message, meta));
    }

    error(message: string, meta?: unknown) {
        console.error(this.format('error', message, meta));
    }

    perf(message: string, durationMs: number, meta?: unknown) {
        // Log slow operations (e.g., queries > 500ms)
        const level: LogLevel = durationMs > 500 ? 'warn' : 'info';
        const msg = `${message} took ${durationMs}ms`;
        if (level === 'warn') {
            console.warn(this.format('perf', msg, meta));
        } else {
            console.log(this.format('perf', msg, meta));
        }
    }
}

export const logger = new Logger();
