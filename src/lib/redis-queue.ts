import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';
import type { ConnectionOptions } from 'bullmq';

/**
 * BullMQ connections, deliberately kept apart from the cache client.
 *
 * src/lib/redis.ts is the request-path client: no offline queue and two retries, so a dead
 * Redis makes an API route fail fast instead of hanging a serverless invocation. A worker
 * cannot use that client. BullMQ blocks on its queue commands, and a blocked command that is
 * silently retried would consume the same job twice, so RedisConnection throws as soon as it
 * is handed an instance whose maxRetriesPerRequest is a number
 * ("BullMQ: Your redis options maxRetriesPerRequest must be null").
 *
 * A blocking command also occupies its socket until it returns, which is why every worker gets
 * its own connection here instead of sharing one socket with the other four.
 */

const QUEUE_OPTIONS: RedisOptions = {
    maxRetriesPerRequest: null, // BullMQ requirement: a command may wait for the connection
    connectTimeout: 5000,
};

/**
 * BullMQ vendors its own copy of ioredis, so an instance created against the top-level package
 * is structurally incompatible with its ConnectionOptions despite being the same class. The
 * cast is kept here once so no call site needs an `as any`.
 */
function asBullMQ(client: Redis): ConnectionOptions {
    return client as unknown as ConnectionOptions;
}

function connect(label: string): Redis {
    const client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        ...QUEUE_OPTIONS,
        connectionName: label,
    });
    // BullMQ attaches its own handlers to the client it wraps. This covers the window before
    // that, where a refused handshake would otherwise surface as an unhandled error event.
    client.on('error', (err: Error) => {
        if (client.status !== 'ready') console.warn(`[QUEUE-REDIS] ${label}: ${err.message}`);
    });
    return client;
}

const producer = connect('sltserp-producer');

/** Enqueue side (cron routes, services). One socket, shared by every Queue. */
export const queueConnection = asBullMQ(producer);

/** False once the producer socket has been closed for good, i.e. fallback mode. */
export function queueConnectionAlive(): boolean {
    return producer.status !== 'end' && producer.status !== 'close';
}

/** A dedicated socket per worker. ioredis connects eagerly; BullMQ waits for 'ready'. */
export function createQueueConnection(label: string): ConnectionOptions {
    return asBullMQ(connect(label));
}
