'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
    Activity, 
    AlertTriangle, 
    CheckCircle, 
    Database, 
    Cpu, 
    RefreshCw, 
    Trash2, 
    Search,
    ChevronLeft,
    ChevronRight,
    Server,
    X,
    Filter,
    Copy,
    Check,
    Download,
    ExternalLink,
    ChevronDown,
    LineChart
} from 'lucide-react';

interface ErrorLog {
    id: string;
    statusCode: number;
    errorCode: string;
    message: string;
    stackTrace?: string;
    path: string;
    method: string;
    userId?: string;
    userRole?: string;
    ipAddress?: string;
    resolved: boolean;
    createdAt: string;
}

interface HealthStats {
    status: 'HEALTHY' | 'DEGRADED';
    memory: {
        heapUsedMB: number;
        heapTotalMB: number;
        rssMB: number;
    };
    uptimeSeconds: number;
    database: {
        status: string;
        latencyMs: number;
    };
    errors: {
        total24h: number;
        unresolved: number;
        topFailing: { path: string; count: number }[];
    };
    timestamp: string;
}

export default function SystemMonitoringPage() {
    const [health, setHealth] = useState<HealthStats | null>(null);
    const [logs, setLogs] = useState<ErrorLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [filterResolved, setFilterResolved] = useState<string>('all');
    const [selectedLog, setSelectedLog] = useState<ErrorLog | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [showGuide, setShowGuide] = useState(false);
    const [origin, setOrigin] = useState('');

    useEffect(() => {
        setOrigin(window.location.origin);
    }, []);

    const metricsUrl = origin ? `${origin}/api/metrics` : '/api/metrics';

    const prometheusConfig = `global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'sltserp_nextjs'
    metrics_path: '/api/metrics'
    static_configs:
      - targets: ['host.docker.internal:3000']`;

    const copyToClipboard = useCallback(async (key: string, text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(null), 2000);
        } catch (err) {
            console.error('Clipboard write failed:', err);
        }
    }, []);

    const fetchHealth = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/monitoring/health?_t=${Date.now()}`);
            const data = await res.json();
            if (data.success) {
                setHealth(data.data);
            }
        } catch (err) {
            console.error('Failed to load health stats:', err);
        }
    }, []);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            let url = `/api/admin/monitoring/errors?page=${page}&limit=15&_t=${Date.now()}`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
            if (filterResolved === 'true') url += '&resolved=true';
            if (filterResolved === 'false') url += '&resolved=false';

            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                setLogs(data.data.logs);
                setTotalPages(data.data.pagination.totalPages || 1);
            }
        } catch (err) {
            console.error('Failed to load error logs:', err);
        } finally {
            setLoading(false);
        }
    }, [page, search, filterResolved]);

    useEffect(() => {
        fetchHealth();
        fetchLogs();

        // Auto refresh health stats every 30s
        const interval = setInterval(() => {
            fetchHealth();
        }, 30000);

        return () => clearInterval(interval);
    }, [fetchHealth, fetchLogs]);

    const handleResolve = async (id: string) => {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/admin/monitoring/errors/${id}`, { method: 'PATCH' });
            if (res.ok) {
                setLogs(prev => prev.map(l => l.id === id ? { ...l, resolved: true } : l));
                if (selectedLog?.id === id) {
                    setSelectedLog(prev => prev ? { ...prev, resolved: true } : null);
                }
                fetchHealth();
            }
        } catch (err) {
            console.error('Failed to resolve error:', err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleClearLogs = async () => {
        if (!confirm('Are you sure you want to clear all resolved and old error logs?')) return;
        setActionLoading(true);
        try {
            const res = await fetch('/api/admin/monitoring/errors?daysToKeep=14', { method: 'DELETE' });
            if (res.ok) {
                fetchLogs();
                fetchHealth();
            }
        } catch (err) {
            console.error('Failed to clear logs:', err);
        } finally {
            setActionLoading(false);
        }
    };

    const formatUptime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}h ${m}m ${s}s`;
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                        <Activity className="w-7 h-7 text-indigo-400 animate-pulse" />
                        System Health & Error Monitoring
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Real-time server exception tracking, DB latencies, and runtime metrics for Super Admin.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => { fetchHealth(); fetchLogs(); }}
                        className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition flex items-center gap-2 border border-slate-700"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <button
                        onClick={handleClearLogs}
                        disabled={actionLoading}
                        className="px-3.5 py-2 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/60 text-sm font-medium transition flex items-center gap-2"
                    >
                        <Trash2 className="w-4 h-4" />
                        Clear Logs
                    </button>
                </div>
            </div>

            {/* Health Overview Cards */}
            {health && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Overall Status */}
                    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 p-5 rounded-xl flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">System Status</p>
                            <h3 className={`text-xl font-bold mt-1 ${health.status === 'HEALTHY' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {health.status}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">Uptime: {formatUptime(health.uptimeSeconds)}</p>
                        </div>
                        <div className={`p-3 rounded-xl ${health.status === 'HEALTHY' ? 'bg-emerald-950/50 border border-emerald-800/40 text-emerald-400' : 'bg-amber-950/50 border border-amber-800/40 text-amber-400'}`}>
                            <Server className="w-6 h-6" />
                        </div>
                    </div>

                    {/* Database Health */}
                    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 p-5 rounded-xl flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Database Latency</p>
                            <h3 className="text-xl font-bold mt-1 text-white">
                                {health.database.latencyMs} ms
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">Status: {health.database.status}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-indigo-950/50 border border-indigo-800/40 text-indigo-400">
                            <Database className="w-6 h-6" />
                        </div>
                    </div>

                    {/* Memory Usage */}
                    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 p-5 rounded-xl flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Heap Memory</p>
                            <h3 className="text-xl font-bold mt-1 text-white">
                                {health.memory.heapUsedMB} MB
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">Total: {health.memory.heapTotalMB} MB</p>
                        </div>
                        <div className="p-3 rounded-xl bg-purple-950/50 border border-purple-800/40 text-purple-400">
                            <Cpu className="w-6 h-6" />
                        </div>
                    </div>

                    {/* Unresolved Errors */}
                    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 p-5 rounded-xl flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Unresolved Errors</p>
                            <h3 className={`text-xl font-bold mt-1 ${health.errors.unresolved > 0 ? 'text-red-400' : 'text-slate-300'}`}>
                                {health.errors.unresolved}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">Total (24h): {health.errors.total24h}</p>
                        </div>
                        <div className={`p-3 rounded-xl ${health.errors.unresolved > 0 ? 'bg-red-950/50 border border-red-800/40 text-red-400' : 'bg-slate-800 border border-slate-700 text-slate-400'}`}>
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                    </div>
                </div>
            )}

            {/* Grafana & Prometheus Observability Section */}
            <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-xl overflow-hidden">
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-b border-slate-800 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-indigo-200 font-bold text-sm">
                            <LineChart className="w-4 h-4 text-orange-400" />
                            Prometheus &amp; Grafana Observability
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 text-[10px] font-semibold uppercase tracking-wider">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Exporter Active
                            </span>
                        </div>
                        <p className="text-xs text-slate-400">
                            Metrics are exposed in standard Prometheus Exposition Format (v0.0.4) for scrapers &amp; Grafana dashboards.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <a
                            href="/api/metrics"
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-800/60 text-xs font-mono text-indigo-200 transition flex items-center gap-1.5"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View Raw Metrics
                        </a>
                        <a
                            href="/api/admin/monitoring/dashboard"
                            className="px-3 py-1.5 rounded-lg bg-orange-950/60 hover:bg-orange-900/70 border border-orange-800/50 text-xs font-medium text-orange-200 transition flex items-center gap-1.5"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Grafana Dashboard
                        </a>
                    </div>
                </div>

                {/* Endpoint / Config quick-copy */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Scrape Endpoint</p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs font-mono text-indigo-300 truncate">{metricsUrl}</code>
                            <button
                                onClick={() => copyToClipboard('endpoint', metricsUrl)}
                                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition shrink-0"
                                title="Copy endpoint"
                            >
                                {copiedKey === 'endpoint' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Local Grafana</p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs font-mono text-slate-300 truncate">http://localhost:3001</code>
                            <a
                                href="http://localhost:3001"
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition shrink-0"
                                title="Open Grafana"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                        </div>
                    </div>
                </div>

                {/* Collapsible Setup Guide */}
                <div className="border-t border-slate-800">
                    <button
                        onClick={() => setShowGuide(s => !s)}
                        className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-slate-300 hover:bg-slate-800/40 transition"
                    >
                        <span className="flex items-center gap-2">
                            <Server className="w-3.5 h-3.5 text-indigo-400" />
                            Setup Guide — Wire up Prometheus &amp; Grafana
                        </span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${showGuide ? 'rotate-180' : ''}`} />
                    </button>
                    {showGuide && (
                        <div className="px-4 pb-4 space-y-4 text-xs text-slate-400">
                            <ol className="list-decimal list-inside space-y-2 marker:text-indigo-400">
                                <li>Launch the stack: <code className="px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded font-mono text-indigo-300">docker compose -f docker-compose.monitoring.yml up -d</code></li>
                                <li>Prometheus scrapes the exporter using the config below (already at <code className="font-mono text-slate-300">monitoring/prometheus.yml</code>).</li>
                                <li>Open Grafana at <code className="font-mono text-slate-300">http://localhost:3001</code> (default admin / admin) and add Prometheus (<code className="font-mono text-slate-300">http://prometheus:9090</code>) as a datasource.</li>
                                <li>Import the downloaded <code className="font-mono text-slate-300">sltserp-dashboard.json</code> and select the Prometheus datasource when prompted.</li>
                            </ol>
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">prometheus.yml</p>
                                    <button
                                        onClick={() => copyToClipboard('config', prometheusConfig)}
                                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1.5 text-[11px]"
                                    >
                                        {copiedKey === 'config' ? <><Check className="w-3 h-3 text-emerald-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                                    </button>
                                </div>
                                <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-[11px] text-slate-300 overflow-x-auto whitespace-pre">{prometheusConfig}</pre>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Top Failing Routes - live bar-gauge visualization */}
            {health?.errors.topFailing && health.errors.topFailing.length > 0 && (() => {
                const maxCount = Math.max(...health.errors.topFailing.map(r => r.count), 1);
                return (
                    <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
                        <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3 flex items-center gap-2">
                            <Filter className="w-3.5 h-3.5 text-amber-400" />
                            Top Failing Routes (24 Hours)
                        </h4>
                        <div className="space-y-2.5">
                            {health.errors.topFailing.map((item, idx) => {
                                const pct = Math.round((item.count / maxCount) * 100);
                                return (
                                    <div key={idx} className="flex items-center gap-3">
                                        <code className="w-48 shrink-0 text-xs font-mono text-slate-300 truncate" title={item.path}>{item.path}</code>
                                        <div className="flex-1 h-5 bg-slate-950 rounded-md overflow-hidden border border-slate-800/60">
                                            <div
                                                className="h-full bg-gradient-to-r from-amber-600/80 to-red-600/80 rounded-md transition-all"
                                                style={{ width: `${Math.max(pct, 6)}%` }}
                                            />
                                        </div>
                                        <span className="w-10 shrink-0 text-right text-xs font-bold font-mono text-red-300">{item.count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            {/* Search & Filter Toolbar */}
            <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search path, message, code..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <select
                        value={filterResolved}
                        onChange={(e) => { setFilterResolved(e.target.value); setPage(1); }}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                    >
                        <option value="all">All Errors</option>
                        <option value="false">Unresolved Only</option>
                        <option value="true">Resolved Only</option>
                    </select>
                </div>
            </div>

            {/* Error Log Table */}
            <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-xs uppercase tracking-wider">
                                <th className="py-3.5 px-4 font-semibold">Status</th>
                                <th className="py-3.5 px-4 font-semibold">Method & Path</th>
                                <th className="py-3.5 px-4 font-semibold">Error Message</th>
                                <th className="py-3.5 px-4 font-semibold">User Role</th>
                                <th className="py-3.5 px-4 font-semibold">Time</th>
                                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-slate-500">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                                        Loading System Error Logs...
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-slate-500">
                                        <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-70" />
                                        No error logs found. System is running cleanly!
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-800/40 transition">
                                        <td className="py-3.5 px-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                                                log.statusCode >= 500 ? 'bg-red-950 text-red-400 border border-red-800/50' : 'bg-amber-950 text-amber-400 border border-amber-800/50'
                                            }`}>
                                                {log.statusCode}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-slate-300">
                                            <span className="font-bold text-indigo-400 mr-2">{log.method}</span>
                                            {log.path}
                                        </td>
                                        <td className="py-3.5 px-4 max-w-xs truncate text-slate-200">
                                            {log.message}
                                        </td>
                                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-400">
                                            {log.userRole || 'ANONYMOUS'}
                                        </td>
                                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-500">
                                            {new Date(log.createdAt).toLocaleString()}
                                        </td>
                                        <td className="py-3.5 px-4 whitespace-nowrap text-right space-x-2">
                                            <button
                                                onClick={() => setSelectedLog(log)}
                                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition"
                                            >
                                                Details
                                            </button>
                                            {!log.resolved && (
                                                <button
                                                    onClick={() => handleResolve(log.id)}
                                                    className="px-2.5 py-1 rounded bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/50 text-xs font-medium transition"
                                                >
                                                    Resolve
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
                    <span>Page {page} of {totalPages}</span>
                    <div className="flex items-center gap-2">
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage(p => p - 1)}
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Stack Trace Modal */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl relative">
                        <button
                            onClick={() => setSelectedLog(null)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-3">
                            <span className="px-2.5 py-1 rounded bg-red-950 text-red-400 font-mono text-xs font-bold border border-red-800">
                                {selectedLog.statusCode}
                            </span>
                            <h3 className="text-lg font-bold text-white font-mono">{selectedLog.method} {selectedLog.path}</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                            <div><span className="text-slate-500">Error Code:</span> <span className="text-slate-200 font-mono">{selectedLog.errorCode}</span></div>
                            <div><span className="text-slate-500">Time:</span> <span className="text-slate-200">{new Date(selectedLog.createdAt).toLocaleString()}</span></div>
                            <div><span className="text-slate-500">User Role:</span> <span className="text-slate-200">{selectedLog.userRole || 'N/A'}</span></div>
                            <div><span className="text-slate-500">Status:</span> <span className={selectedLog.resolved ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{selectedLog.resolved ? 'RESOLVED' : 'UNRESOLVED'}</span></div>
                        </div>

                        <div>
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Message</h4>
                            <p className="text-sm bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-red-300">
                                {selectedLog.message}
                            </p>
                        </div>

                        {selectedLog.stackTrace && (
                            <div>
                                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Stack Trace</h4>
                                <pre className="text-xs bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-slate-300 max-h-60 overflow-y-auto whitespace-pre-wrap">
                                    {selectedLog.stackTrace}
                                </pre>
                            </div>
                        )}

                        <div className="pt-2 flex justify-end gap-3">
                            {!selectedLog.resolved && (
                                <button
                                    onClick={() => handleResolve(selectedLog.id)}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition"
                                >
                                    Mark as Resolved
                                </button>
                            )}
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
