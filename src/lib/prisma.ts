import { PrismaClient } from '@prisma/client'
import { logger } from './logger'
import { getRequestId } from './request-context'

/**
 * Utility to sanitize and optimize DB URLs (timeouts, pooling)
 */
const getSafeDatabaseUrl = (url: string, isWorker: boolean = false) => {
    if (!url) return url;
    try {
        const urlObj = new URL(url);
        if (!urlObj.searchParams.has('statement_timeout')) {
            urlObj.searchParams.set('statement_timeout', '30000'); // 30s timeout
        }
        if (isWorker && !urlObj.searchParams.has('connection_limit')) {
            urlObj.searchParams.set('connection_limit', '5');
        }
        return urlObj.toString();
    } catch {
        return url;
    }
}

const isWorker = process.env.IS_WORKER === 'true';

// 1. Initialize Primary Connection (Write/Master)
const primaryUrl = getSafeDatabaseUrl(process.env.DATABASE_URL || '', isWorker);
const primaryClient = new PrismaClient({
    datasourceUrl: primaryUrl,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

// 2. Initialize Read Replica Connection (Optional)
// In local development, these usually point to the same DB.
const readReplicaUrl = process.env.READ_REPLICA_URL
    ? getSafeDatabaseUrl(process.env.READ_REPLICA_URL, isWorker)
    : primaryUrl;

const readClient = new PrismaClient({
    datasourceUrl: readReplicaUrl,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

/**
 * Enhanced Prisma Client with:
 * - Read/Write Splitting
 * - Request Tracing
 * - Slow Query Logging
 */
export const prisma = primaryClient.$extends({
    query: {
        async $allOperations({ operation, model, args, query }) {
            const start = Date.now();

            // ROUTING LOGIC: 
            // Move heavy Read operations to Replica if available.
            const readOperations = ['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy'];
            const isReadOperation = readOperations.includes(operation);

            let result;
            // Only route to replica if it's a read operation AND a replica URL is actually different from primary
            if (isReadOperation && process.env.READ_REPLICA_URL && process.env.READ_REPLICA_URL !== process.env.DATABASE_URL) {
                // Execute on Read Replica
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                result = await (readClient as any)[model as string][operation](args);
            } else {
                // Execute on Primary (Write/Master)
                result = await query(args);
            }

            const duration = Date.now() - start;

            // PERFORMANCE LOGGING
            if (duration > 500) {
                const reqId = getRequestId();
                const traceInfo = reqId ? `[ReqID: ${reqId}] ` : '';
                const isReplicaUsed = isReadOperation && process.env.READ_REPLICA_URL && process.env.READ_REPLICA_URL !== process.env.DATABASE_URL;
                const replicaTag = isReplicaUsed ? '[REPLICA] ' : '[PRIMARY] ';

                logger.perf(`${traceInfo}${replicaTag}Prisma Query: ${model}.${operation}`, duration, {
                    operation,
                    model
                });
            }

            return result;
        },
    },
});

export { primaryClient, readClient };
