/**
 * Grafana Dashboard Definition (single source of truth)
 *
 * The metric names referenced here MUST stay in sync with the exposition
 * output of {@link PrometheusService.generateMetricsText}. This object is
 * served (as a downloadable file) via /api/admin/monitoring/dashboard so the
 * Admin UI never links to a stale static asset.
 *
 * The dashboard is "import ready": it declares a `DS_PROMETHEUS` datasource
 * input and every panel target binds to it, so Grafana's import flow can wire
 * the panels to a Prometheus datasource automatically.
 */

const DS = { type: 'prometheus', uid: '${DS_PROMETHEUS}' } as const;

interface DashboardTarget {
    expr: string;
    legendFormat: string;
    refId: string;
    datasource: typeof DS;
}

interface DashboardPanel {
    id: number;
    type: string;
    title: string;
    datasource: typeof DS;
    gridPos: { h: number; w: number; x: number; y: number };
    fieldConfig?: Record<string, unknown>;
    options?: Record<string, unknown>;
    targets: DashboardTarget[];
}

function target(expr: string, legendFormat: string, refId = 'A'): DashboardTarget {
    return { expr, legendFormat, refId, datasource: DS };
}

export function buildGrafanaDashboard() {
    const panels: DashboardPanel[] = [
        {
            id: 1,
            type: 'stat',
            title: 'System Status',
            datasource: DS,
            gridPos: { h: 4, w: 6, x: 0, y: 0 },
            fieldConfig: {
                defaults: {
                    mappings: [
                        { type: 'value', options: { '0': { text: 'DEGRADED', color: 'red' }, '1': { text: 'HEALTHY', color: 'green' } } }
                    ],
                    thresholds: { mode: 'absolute', steps: [ { color: 'red', value: null }, { color: 'green', value: 1 } ] }
                },
                overrides: []
            },
            options: { colorMode: 'background', graphMode: 'none', textMode: 'value' },
            targets: [ target('slts_db_status', 'Database Status') ]
        },
        {
            id: 2,
            type: 'stat',
            title: 'Database Query Latency',
            datasource: DS,
            gridPos: { h: 4, w: 6, x: 6, y: 0 },
            fieldConfig: {
                defaults: {
                    unit: 'ms',
                    thresholds: { mode: 'absolute', steps: [ { color: 'green', value: null }, { color: 'yellow', value: 100 }, { color: 'red', value: 300 } ] }
                },
                overrides: []
            },
            options: { colorMode: 'value', graphMode: 'area', textMode: 'value' },
            targets: [ target('slts_db_latency_seconds * 1000', 'Latency (ms)') ]
        },
        {
            id: 3,
            type: 'stat',
            title: 'Unresolved System Errors',
            datasource: DS,
            gridPos: { h: 4, w: 6, x: 12, y: 0 },
            fieldConfig: {
                defaults: {
                    thresholds: { mode: 'absolute', steps: [ { color: 'green', value: null }, { color: 'yellow', value: 1 }, { color: 'red', value: 10 } ] }
                },
                overrides: []
            },
            options: { colorMode: 'background', graphMode: 'none', textMode: 'value' },
            targets: [ target('slts_unresolved_errors_count', 'Unresolved') ]
        },
        {
            id: 4,
            type: 'stat',
            title: 'Node.js Heap Used (MB)',
            datasource: DS,
            gridPos: { h: 4, w: 6, x: 18, y: 0 },
            fieldConfig: {
                defaults: {
                    unit: 'decmbytes',
                    thresholds: { mode: 'absolute', steps: [ { color: 'green', value: null }, { color: 'yellow', value: 512 }, { color: 'red', value: 1024 } ] }
                },
                overrides: []
            },
            options: { colorMode: 'value', graphMode: 'area', textMode: 'value' },
            targets: [ target('nodejs_heap_size_used_bytes / 1024 / 1024', 'Heap Used') ]
        },
        {
            id: 5,
            type: 'timeseries',
            title: 'Memory Heap Trend',
            datasource: DS,
            gridPos: { h: 8, w: 12, x: 0, y: 4 },
            fieldConfig: {
                defaults: {
                    unit: 'decmbytes',
                    custom: { drawStyle: 'line', fillOpacity: 10, lineWidth: 2, showPoints: 'never' }
                },
                overrides: []
            },
            options: { legend: { displayMode: 'list', placement: 'bottom' }, tooltip: { mode: 'multi' } },
            targets: [
                target('nodejs_heap_size_used_bytes / 1024 / 1024', 'Used (MB)', 'A'),
                target('nodejs_heap_size_total_bytes / 1024 / 1024', 'Total (MB)', 'B')
            ]
        },
        {
            id: 6,
            type: 'timeseries',
            title: 'System Errors (24h) Trend',
            datasource: DS,
            gridPos: { h: 8, w: 12, x: 12, y: 4 },
            fieldConfig: {
                defaults: {
                    custom: { drawStyle: 'line', fillOpacity: 15, lineWidth: 2, showPoints: 'never' }
                },
                overrides: []
            },
            options: { legend: { displayMode: 'list', placement: 'bottom' }, tooltip: { mode: 'multi' } },
            targets: [
                target('slts_errors_total_24h', 'Total (24h)', 'A'),
                target('slts_unresolved_errors_count', 'Unresolved', 'B')
            ]
        },
        {
            id: 7,
            type: 'bargauge',
            title: 'Top Route Failures (24h)',
            datasource: DS,
            gridPos: { h: 8, w: 24, x: 0, y: 12 },
            fieldConfig: {
                defaults: {
                    thresholds: { mode: 'absolute', steps: [ { color: 'green', value: null }, { color: 'yellow', value: 5 }, { color: 'red', value: 20 } ] }
                },
                overrides: []
            },
            options: { orientation: 'horizontal', displayMode: 'gradient', showUnfilled: true },
            targets: [ target('slts_route_failures_24h', '{{path}}') ]
        }
    ];

    return {
        __inputs: [
            {
                name: 'DS_PROMETHEUS',
                label: 'Prometheus',
                description: 'Prometheus datasource scraping /api/metrics',
                type: 'datasource',
                pluginId: 'prometheus',
                pluginName: 'Prometheus'
            }
        ],
        __requires: [
            { type: 'grafana', id: 'grafana', name: 'Grafana', version: '10.0.0' },
            { type: 'datasource', id: 'prometheus', name: 'Prometheus', version: '1.0.0' }
        ],
        annotations: { list: [] },
        editable: true,
        fiscalYearStartMonth: 0,
        graphTooltip: 0,
        id: null,
        links: [],
        liveNow: false,
        panels,
        refresh: '10s',
        schemaVersion: 38,
        style: 'dark',
        tags: ['sltserp', 'monitoring'],
        templating: { list: [] },
        time: { from: 'now-1h', to: 'now' },
        timepicker: {},
        timezone: 'browser',
        title: 'SLTSERP Executive System Health Dashboard',
        version: 2,
        weekStart: ''
    };
}
