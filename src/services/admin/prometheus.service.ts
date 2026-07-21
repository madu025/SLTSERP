import { SystemMonitoringService } from './system-monitoring.service';

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

        return lines.join('\n');
    }
}
