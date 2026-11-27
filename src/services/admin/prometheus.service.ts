import { SystemMonitoringService } from './system-monitoring.service';
import { CacheService } from '@/lib/cache.service';
import { redis } from '@/lib/redis';
import { QUEUE_NAMES } from '@/lib/queue';
import { WATCHDOG, watchdogState } from '@/workers/watchdog';
import { safe } from '@/utils/safe-await.util';

export class PrometheusService {
    /**
     * Generate Prometheus Text Exposition Format (version 0.0.4)
     */
    static async generateMetricsText(): Promise<string> {
        const health = await SystemMonitoringService.getHealthStats();

        const memory = process.memoryUsage();
        const uptime = Math.floor(process.uptime());

        const lines: string[] = [
            '# HELP nodejs_heap_size_used_bytes Memory heap used in bytes.',
            '# TYPE nodejs_heap_size_used_bytes gauge',
            `nodejs_heap_size_used_bytes ${memory.heapUsed}`,
            '',
            '# HELP nodejs_heap_size_total_bytes Memory heap total in bytes.',
            '# TYPE nodejs_heap_size_total_bytes gauge',
            `nodejs_heap_size_total_bytes ${memory.heapTotal}`,
            '',
            '# HELP nodejs_external_memory_bytes Memory external bytes.',
            '# TYPE nodejs_external_memory_bytes gauge',
            `nodejs_external_memory_bytes ${memory.external}`,
            '',
            '# HELP nodejs_process_uptime_seconds Process uptime in seconds.',
            '# TYPE nodejs_process_uptime_seconds gauge',
            `nodejs_process_uptime_seconds ${uptime}`,
            '',
            '# HELP slts_db_status Database health status (1=ONLINE, 0=OFFLINE).',
            '# TYPE slts_db_status gauge',
            `slts_db_status ${health.database.status === 'ONLINE' ? 1 : 0}`,
            '',
            '# HELP slts_db_latency_seconds Database query ping latency in seconds.',
            '# TYPE slts_db_latency_seconds gauge',
            `slts_db_latency_seconds ${(health.database.latencyMs / 1000).toFixed(4)}`,
            '',
            '# HELP slts_errors_total_24h Total system error count in the last 24 hours.',
            '# TYPE slts_errors_total_24h gauge',
            `slts_errors_total_24h ${health.errors.total24h}`,
            '',
            '# HELP slts_unresolved_errors_count Total unresolved system errors.',
            '# TYPE slts_unresolved_errors_count gauge',
            `slts_unresolved_errors_count ${health.errors.unresolved}`,
            ''
        ];

        // Append top failing routes metrics
        if (health.errors.topFailing && health.errors.topFailing.length > 0) {
            lines.push('# HELP slts_route_failures_24h Total failures per API path in 24 hours.');
            lines.push('# TYPE slts_route_failures_24h gauge');
            for (const route of health.errors.topFailing) {
                const cleanPath = route.path.replace(/"/g, '\\"');
                lines.push(`slts_route_failures_24h{path="${cleanPath}"} ${route.count}`);
            }
            lines.push('');
        }

        // The app's own Redis cache (Redis keyspace hits/misses are mostly BullMQ queue polling)
        const { cacheHits, cacheMisses } = CacheService.getHitMetrics();
        const { cacheErrorCount } = CacheService.getFailureMetrics();
        lines.push(
            '# HELP slts_cache_hits_total App cache reads answered from Redis since start.',
            '# TYPE slts_cache_hits_total counter',
            `slts_cache_hits_total ${cacheHits}`,
            '',
            '# HELP slts_cache_misses_total App cache reads not found in Redis (or Redis not ready) since start.',
            '# TYPE slts_cache_misses_total counter',
            `slts_cache_misses_total ${cacheMisses}`,
            '',
            '# HELP slts_cache_errors_total App cache operations that failed open since start.',
            '# TYPE slts_cache_errors_total counter',
            `slts_cache_errors_total ${cacheErrorCount}`,
            '',
        );

        // Queue watchdog (src/workers/watchdog.ts): stalled queues now, and when it last restarted the app
        const wd = watchdogState();
        lines.push(
            '# HELP slts_queue_stalled A BullMQ queue whose jobs are not being taken (1) at the last watchdog check.',
            '# TYPE slts_queue_stalled gauge',
            ...Object.values(QUEUE_NAMES).map((q) => `slts_queue_stalled{queue="${q}"} ${wd.stalled.includes(q) ? 1 : 0}`),
            '',
            '# HELP slts_watchdog_last_check_timestamp_seconds When the queue watchdog last checked (0 = not running here).',
            '# TYPE slts_watchdog_last_check_timestamp_seconds gauge',
            `slts_watchdog_last_check_timestamp_seconds ${Math.floor(wd.checkedAt / 1000)}`,
            '',
        );
        const [, last] = await safe(redis.get(WATCHDOG.LAST_RESTART_KEY));
        const lastAt = last ? Number((JSON.parse(last) as { at?: number }).at ?? 0) : 0;
        lines.push(
            '# HELP slts_watchdog_last_restart_timestamp_seconds When the watchdog last restarted the app because the workers were stuck.',
            '# TYPE slts_watchdog_last_restart_timestamp_seconds gauge',
            `slts_watchdog_last_restart_timestamp_seconds ${Math.floor(lastAt / 1000)}`,
            '',
        );

        return lines.join('\n');
    }
}
