'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/roles';
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
    LineChart,
    CheckCheck,
    Wrench,
    Zap,
    Terminal,
    FileText,
    ShieldCheck,
    ShieldAlert,
    Radio,
    Truck,
    Lock
} from 'lucide-react';
import { toast } from 'sonner';

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
    securityThreats?: { ipAddress: string; failedAttempts: number }[];
    contractorTelemetry?: {
        pendingPatCount: number;
        inProgressOrders: number;
        unreadNotifs: number;
        syncStatus: string;
    };
    timestamp: string;
}

interface ErrorDiagnostic {
    category: string;
    label: string;
    badgeColor: string;
    advice: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

interface LedgerAuditResult {
    status: 'SECURE' | 'TAMPERING_DETECTED';
    totalVerified: number;
    tamperedCount: number;
    auditedAt: string;
}

interface QueueJobStat {
    name: string;
    active: number;
    waiting: number;
    completed: number;
    failed: number;
    delayed: number;
    recentCompleted?: { id: string; name: string; finishedOn: number }[];
    repeatableCount?: number;
    repeatable?: { key: string; name: string; next: string }[];
}

export default function SystemMonitoringPage() {
    const [health, setHealth] = useState<HealthStats | null>(null);
    const [logs, setLogs] = useState<ErrorLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [filterResolved, setFilterResolved] = useState<string>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [selectedLog, setSelectedLog] = useState<ErrorLog | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditResult, setAuditResult] = useState<LedgerAuditResult | null>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [origin, setOrigin] = useState('');
    const [jobsStats, setJobsStats] = useState<QueueJobStat[]>([]);

    useEffect(() => {
        setOrigin(window.location.origin);
    }, []);

    const metricsUrl = origin ? `${origin}/api/metrics` : '/api/metrics';

    const copyToClipboard = useCallback(async (key: string, text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedKey(key);
            toast.success('Copied to clipboard!');
            setTimeout(() => setCopiedKey(null), 2000);
        } catch (err) {
            console.error('Clipboard write failed:', err);
            toast.error('Failed to copy');
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

    const fetchJobsStats = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/jobs?_t=${Date.now()}`);
            if (res.ok) {
                const resData = await res.json();
                const payload = resData.data || resData;
                setJobsStats(Array.isArray(payload.queues) ? payload.queues : []);
            }
        } catch (err: unknown) {
            console.error('Failed to load queue stats:', err);
        }
    }, []);

    useEffect(() => {
        fetchHealth();
        fetchLogs();
        fetchJobsStats();

        const interval = setInterval(() => {
            fetchHealth();
            fetchJobsStats();
        }, 30000);

        return () => clearInterval(interval);
    }, [fetchHealth, fetchLogs, fetchJobsStats]);

    const handleRunLedgerAudit = async () => {
        setAuditLoading(true);
        try {
            const res = await fetch('/api/admin/monitoring/audit-ledger');
            const data = await res.json();
            if (res.ok && data.success) {
                setAuditResult(data.data);
                if (data.data.status === 'SECURE') {
                    toast.success(`Ledger Audit Passed! ${data.data.totalVerified} entries verified via SHA-256.`);
                } else {
                    toast.error(`TAMPERING WARNING! ${data.data.tamperedCount} corrupted hashes detected.`);
                }
            }
        } catch (err) {
            console.error('Ledger audit failed:', err);
            toast.error('Failed to run SHA-256 security audit');
        } finally {
            setAuditLoading(false);
        }
    };

    const handleResolve = async (id: string) => {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/admin/monitoring/errors/${id}`, { method: 'PATCH' });
            if (res.ok) {
                toast.success('Error log marked as resolved');
                setLogs(prev => prev.map(l => l.id === id ? { ...l, resolved: true } : l));
                if (selectedLog?.id === id) {
                    setSelectedLog(prev => prev ? { ...prev, resolved: true } : null);
                }
                fetchHealth();
            }
        } catch (err) {
            console.error('Failed to resolve error:', err);
            toast.error('Failed to mark error as resolved');
        } finally {
            setActionLoading(false);
        }
    };

    const handleResolveAll = async () => {
        if (!confirm('Mark all unresolved system error logs as RESOLVED?')) return;
        setActionLoading(true);
        try {
            const res = await fetch('/api/admin/monitoring/errors', { method: 'PATCH' });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(`Resolved ${data.data.resolvedCount || 'all'} error logs!`);
                fetchLogs();
                fetchHealth();
            }
        } catch (err) {
            console.error('Failed to bulk resolve logs:', err);
            toast.error('Failed to resolve all error logs');
        } finally {
            setActionLoading(false);
        }
    };

    const handleClearLogs = async (clearAll = true) => {
        const confirmMsg = clearAll
            ? 'Are you sure you want to PERMANENTLY PURGE ALL error logs from the database?'
            : 'Are you sure you want to clear resolved error logs?';
        if (!confirm(confirmMsg)) return;

        setActionLoading(true);
        try {
            const url = clearAll
                ? '/api/admin/monitoring/errors?clearAll=true'
                : '/api/admin/monitoring/errors?daysToKeep=0';
            const res = await fetch(url, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(`Cleared ${data.data?.deletedCount ?? 'all'} log entries!`);
                fetchLogs();
                fetchHealth();
            } else {
                toast.error(data.error?.message || 'Failed to clear logs');
            }
        } catch (err) {
            console.error('Failed to clear logs:', err);
            toast.error('Failed to clear logs');
        } finally {
            setActionLoading(false);
        }
    };

    // Heuristic AI Diagnostic Classifier
    const getErrorDiagnostic = (log: ErrorLog): ErrorDiagnostic => {
        const fullText = (log.message + ' ' + (log.stackTrace || '') + ' ' + log.errorCode).toLowerCase();

        if (fullText.includes('emaxconnsession') || fullText.includes('pool_size') || fullText.includes('max clients reached')) {
            return {
                category: 'DB_POOL_EXHAUSTION',
                label: 'Database Connection Pool Exhausted',
                badgeColor: 'bg-red-500/20 text-red-400 border-red-500/40',
                advice: 'PostgreSQL/Supabase session connection limit (15) was exceeded. Connection_limit=3 policy applied in prisma.ts.',
                severity: 'CRITICAL'
            };
        }

        if (fullText.includes('erofs') || fullText.includes('read-only file system')) {
            return {
                category: 'SERVERLESS_EROFS',
                label: 'Vercel Read-Only File System Lock',
                badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
                advice: 'Lambda serverless filesystem is read-only. File operations must write to Prisma SystemSetting DB table or os.tmpdir().',
                severity: 'HIGH'
            };
        }

        if (fullText.includes('zod') || fullText.includes('validation') || fullText.includes('malformed json')) {
            return {
                category: 'PAYLOAD_VALIDATION',
                label: 'Invalid API Payload / Zod Check Fault',
                badgeColor: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
                advice: 'Client sent an unparseable body or missing required Zod schema fields.',
                severity: 'MEDIUM'
            };
        }

        if (fullText.includes('unauthorized') || fullText.includes('forbidden') || log.statusCode === 401 || log.statusCode === 403) {
            return {
                category: 'AUTH_DENIED',
                label: 'Authentication / Privilege Violation',
                badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
                advice: 'Request lacked valid JWT token or required role privileges.',
                severity: 'LOW'
            };
        }

        return {
            category: 'SERVER_EXCEPTION',
            label: 'Unhandled Internal Server Exception',
            badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
            advice: 'Unhandled error in route controller or service function.',
            severity: 'MEDIUM'
        };
    };

    const extractErrorLocation = (stackTrace?: string) => {
        if (!stackTrace) return null;
        const lines = stackTrace.split('\n');
        for (const line of lines) {
            if (line.includes('src/services/') || line.includes('src/app/api/') || line.includes('src/lib/')) {
                const match = line.match(/\(([^)]+)\)/) || line.match(/at\s+(.+)/);
                if (match) return match[1].trim();
            }
        }
        return null;
    };

    const generateIncidentMarkdown = (log: ErrorLog) => {
        const diag = getErrorDiagnostic(log);
        const loc = extractErrorLocation(log.stackTrace);
        return `## [INCIDENT REPORT] System Error #${log.id.slice(-6)}
- **Timestamp**: ${new Date(log.createdAt).toISOString()}
- **Status**: ${log.statusCode} ${log.errorCode}
- **Method/Path**: \`${log.method} ${log.path}\`
- **Category**: ${diag.label} (${diag.severity})
- **User Role**: ${log.userRole || 'ANONYMOUS'}
- **Source Location**: ${loc || 'N/A'}

### Message
\`\`\`
${log.message}
\`\`\`

### Diagnostic Recommendation
> ${diag.advice}

### Stack Trace
\`\`\`
${log.stackTrace || 'No stack trace recorded'}
\`\`\`
`;
    };

    const filteredLogsList = logs.filter(log => {
        if (filterCategory === 'all') return true;
        const diag = getErrorDiagnostic(log);
        return diag.category === filterCategory;
    });

    const formatUptime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}h ${m}m ${s}s`;
    };

    return (
        <RoleGuard allowedRoles={ROLE_GROUPS.ADMINS}>
            <div className="h-screen flex bg-slate-950 overflow-hidden text-xs text-slate-100">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-950">
                        {/* Header */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800/80 pb-5">
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
                                    <div className="p-2.5 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/30">
                                        <Activity className="w-6 h-6 text-white animate-pulse" />
                                    </div>
                                    System Telemetry &amp; Health Monitoring
                                </h1>
                                <p className="text-slate-400 text-xs mt-1.5 flex items-center gap-2">
                                    <span className="text-slate-300 font-medium">Real-time exception diagnostics</span>
                                    <span className="text-slate-600">•</span>
                                    <span className="text-slate-300 font-medium">SHA-256 Ledger Audit</span>
                                    <span className="text-slate-600">•</span>
                                    <span className="text-slate-300 font-medium">Security Threat Telemetry</span>
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={handleRunLedgerAudit}
                                    disabled={auditLoading}
                                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-indigo-950/40"
                                >
                                    <ShieldCheck className={`w-4 h-4 ${auditLoading ? 'animate-spin' : ''}`} />
                                    {auditLoading ? 'Auditing Checksums...' : 'SHA-256 Security Audit'}
                                </button>
                                <button
                                    onClick={handleResolveAll}
                                    disabled={actionLoading || (health?.errors.unresolved || 0) === 0}
                                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-emerald-950/40"
                                >
                                    <CheckCheck className="w-4 h-4" />
                                    Resolve All ({health?.errors.unresolved || 0})
                                </button>
                                <button
                                    onClick={() => { fetchHealth(); fetchLogs(); fetchJobsStats(); }}
                                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-2 border border-slate-700"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                                    Refresh
                                </button>
                                <button
                                    onClick={() => handleClearLogs(true)}
                                    disabled={actionLoading}
                                    className="px-3.5 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/60 text-xs font-semibold transition flex items-center gap-2"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Clear Old
                                </button>
                            </div>
                        </div>

                        {/* Audit Result Banner if run */}
                        {auditResult && (
                            <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-xl ${
                                auditResult.status === 'SECURE' ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300' : 'bg-red-950/80 border-red-800 text-red-300'
                            }`}>
                                <div className="flex items-center gap-3">
                                    {auditResult.status === 'SECURE' ? <ShieldCheck className="w-6 h-6 text-emerald-400" /> : <ShieldAlert className="w-6 h-6 text-red-400" />}
                                    <div>
                                        <h4 className="font-bold text-sm">
                                            {auditResult.status === 'SECURE' ? 'SHA-256 Cryptographic Ledger Audit PASSED' : 'SECURITY WARNING: Tampered Ledger Hashes Detected'}
                                        </h4>
                                        <p className="text-xs text-slate-300 mt-0.5">
                                            Verified {auditResult.totalVerified} InventoryLedger records • {auditResult.tamperedCount} anomalies found • Audited at {new Date(auditResult.auditedAt).toLocaleTimeString()}
                                        </p>
                                    </div>
                                </div>
                                <span className={`px-3 py-1 rounded-xl font-bold font-mono text-xs ${
                                    auditResult.status === 'SECURE' ? 'bg-emerald-900/80 border border-emerald-700 text-emerald-200' : 'bg-red-900 border border-red-700 text-red-200'
                                }`}>
                                    {auditResult.status}
                                </span>
                            </div>
                        )}

                        {/* Health Overview Cards */}
                        {health && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Overall Status */}
                                <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-800/80 p-5 rounded-2xl flex items-center justify-between shadow-xl">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">System Runtime</p>
                                        <h3 className={`text-xl font-black mt-1 ${health.status === 'HEALTHY' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                            {health.status}
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1 font-mono">Uptime: {formatUptime(health.uptimeSeconds)}</p>
                                    </div>
                                    <div className={`p-3 rounded-2xl ${health.status === 'HEALTHY' ? 'bg-emerald-950/50 border border-emerald-800/40 text-emerald-400' : 'bg-amber-950/50 border border-amber-800/40 text-amber-400'}`}>
                                        <Server className="w-6 h-6" />
                                    </div>
                                </div>

                                {/* Database Health */}
                                <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-800/80 p-5 rounded-2xl flex items-center justify-between shadow-xl">
                                    <div className="w-full">
                                        <div className="flex justify-between items-center">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Database Ping</p>
                                            <span className="text-[10px] font-mono text-emerald-400 font-bold">{health.database.status}</span>
                                        </div>
                                        <h3 className="text-xl font-black mt-1 text-white font-mono">
                                            {health.database.latencyMs} <span className="text-xs font-normal text-slate-400">ms</span>
                                        </h3>
                                        <div className="w-full bg-slate-950 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-800">
                                            <div
                                                className={`h-full transition-all ${health.database.latencyMs > 500 ? 'bg-red-500' : health.database.latencyMs > 150 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${Math.min(100, Math.max(10, (health.database.latencyMs / 1000) * 100))}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-2xl bg-indigo-950/50 border border-indigo-800/40 text-indigo-400 ml-3">
                                        <Database className="w-6 h-6" />
                                    </div>
                                </div>

                                {/* Memory Usage */}
                                <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-800/80 p-5 rounded-2xl flex items-center justify-between shadow-xl">
                                    <div className="w-full">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Heap RAM Usage</p>
                                        <h3 className="text-xl font-black mt-1 text-white font-mono">
                                            {health.memory.heapUsedMB} <span className="text-xs font-normal text-slate-400">/ {health.memory.heapTotalMB} MB</span>
                                        </h3>
                                        <div className="w-full bg-slate-950 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-800">
                                            <div
                                                className="h-full bg-purple-500 transition-all"
                                                style={{ width: `${Math.round((health.memory.heapUsedMB / health.memory.heapTotalMB) * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-2xl bg-purple-950/50 border border-purple-800/40 text-purple-400 ml-3">
                                        <Cpu className="w-6 h-6" />
                                    </div>
                                </div>

                                {/* Unresolved Errors */}
                                <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-800/80 p-5 rounded-2xl flex items-center justify-between shadow-xl">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Unresolved Exceptions</p>
                                        <h3 className={`text-xl font-black mt-1 ${health.errors.unresolved > 0 ? 'text-red-400' : 'text-slate-300'}`}>
                                            {health.errors.unresolved}
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1 font-mono">24h Total: {health.errors.total24h}</p>
                                    </div>
                                    <div className={`p-3 rounded-2xl ${health.errors.unresolved > 0 ? 'bg-red-950/50 border border-red-800/40 text-red-400' : 'bg-slate-800 border border-slate-700 text-slate-400'}`}>
                                        <AlertTriangle className="w-6 h-6" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 🔄 Background Workers & BullMQ Sync Telemetry Section */}
                        {jobsStats && jobsStats.length > 0 && (
                            <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-800/80 p-5 rounded-2xl shadow-xl space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                                    <h4 className="text-xs font-black uppercase text-indigo-400 tracking-wider flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-indigo-400 animate-pulse" />
                                        Background Workers &amp; BullMQ Sync Telemetry
                                    </h4>
                                    <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                                        {jobsStats.reduce((acc, curr) => acc + (curr.repeatableCount || 0), 0)} Scheduled Cron Tasks
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {(jobsStats || []).map((q) => (
                                        <div key={`queue-${q.name}`} className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 flex flex-col justify-between space-y-3">
                                            <div>
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="font-bold text-sm text-white flex items-center gap-1.5">
                                                        <div className={`w-2 h-2 rounded-full ${q.active > 0 ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
                                                        {q.name}
                                                    </span>
                                                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                                                        {q.completed} Completed
                                                    </span>
                                                </div>

                                                {/* Schedules */}
                                                {(q.repeatable || []).length > 0 ? (
                                                    <div className="space-y-2 mt-2 pt-2 border-t border-slate-900">
                                                        {q.repeatable?.map((job) => (
                                                            <div key={job.key} className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60 text-slate-300 text-xs">
                                                                <p className="font-bold text-indigo-300 text-[11px] mb-1">{job.name}</p>
                                                                <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                                                                    <span className="text-amber-400/90 font-semibold">⏰ Next: {job.next}</span>
                                                                </div>
                                                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                                    <span className="text-emerald-400/90">✅ Last: {q.recentCompleted && q.recentCompleted.length > 0 ? new Date(q.recentCompleted[0].finishedOn).toLocaleTimeString() : 'N/A'}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] text-slate-500 italic mt-2">No active cron schedule attached.</p>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between text-[11px] font-mono pt-2 border-t border-slate-900 text-slate-400">
                                                <span>Active: <strong className="text-blue-400">{q.active}</strong></span>
                                                <span>Waiting: <strong className="text-amber-400">{q.waiting}</strong></span>
                                                <span>Failed: <strong className={q.failed > 0 ? 'text-red-400 font-bold' : 'text-slate-500'}>{q.failed}</strong></span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Security Threat & Contractor Telemetry Panel Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Security & Rate Limiting Threat Panel */}
                            <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-800/80 p-5 rounded-2xl shadow-xl">
                                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3.5 flex items-center gap-2">
                                    <Lock className="w-4 h-4 text-blue-400" />
                                    Security Threat &amp; Rate-Limit Inspector (24h Window)
                                </h4>
                                {health?.securityThreats && health.securityThreats.length > 0 ? (
                                    <div className="space-y-2">
                                        {health.securityThreats.map((threat, idx) => (
                                            <div key={idx} className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-mono text-xs">
                                                <span className="text-slate-300 font-bold">{threat.ipAddress}</span>
                                                <span className="px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-900 font-bold text-[11px]">
                                                    {threat.failedAttempts} Failed Auth Attempts
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-6 text-center text-slate-500 font-sans">
                                        <ShieldCheck className="w-7 h-7 text-emerald-400 mx-auto mb-1.5 opacity-80" />
                                        No active rate-limit or brute-force threat signatures detected.
                                    </div>
                                )}
                            </div>

                            {/* Contractor Portal Sync Telemetry */}
                            <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-800/80 p-5 rounded-2xl shadow-xl">
                                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3.5 flex items-center gap-2">
                                    <Truck className="w-4 h-4 text-emerald-400" />
                                    Contractor Field Portal &amp; OSP Sync Telemetry
                                </h4>
                                {health?.contractorTelemetry ? (
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                                            <p className="text-[10px] text-slate-400 uppercase font-bold">Pending PAT</p>
                                            <p className="text-lg font-black text-amber-400 font-mono mt-0.5">{health.contractorTelemetry.pendingPatCount}</p>
                                        </div>
                                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                                            <p className="text-[10px] text-slate-400 uppercase font-bold">Active In-Progress</p>
                                            <p className="text-lg font-black text-indigo-400 font-mono mt-0.5">{health.contractorTelemetry.inProgressOrders}</p>
                                        </div>
                                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                                            <p className="text-[10px] text-slate-400 uppercase font-bold">Unread Alerts</p>
                                            <p className="text-lg font-black text-red-400 font-mono mt-0.5">{health.contractorTelemetry.unreadNotifs}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-6 text-center text-slate-500">Loading contractor sync metrics...</div>
                                )}
                            </div>
                        </div>

                        {/* Top Failing Routes */}
                        {health?.errors.topFailing && health.errors.topFailing.length > 0 && (() => {
                            const maxCount = Math.max(...health.errors.topFailing.map(r => r.count), 1);
                            return (
                                <div className="bg-slate-900/90 border border-slate-800/80 p-5 rounded-2xl shadow-xl">
                                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3.5 flex items-center gap-2">
                                        <Filter className="w-3.5 h-3.5 text-amber-400" />
                                        Top Failing Endpoints (24h Window)
                                    </h4>
                                    <div className="space-y-2.5">
                                        {health.errors.topFailing.map((item, idx) => {
                                            const pct = Math.round((item.count / maxCount) * 100);
                                            return (
                                                <div key={idx} className="flex items-center gap-3">
                                                    <code className="w-56 shrink-0 text-xs font-mono text-slate-300 truncate" title={item.path}>{item.path}</code>
                                                    <div className="flex-1 h-5 bg-slate-950 rounded-lg overflow-hidden border border-slate-800/80">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-amber-600/80 to-red-600/80 rounded-lg transition-all"
                                                            style={{ width: `${Math.max(pct, 6)}%` }}
                                                        />
                                                    </div>
                                                    <span className="w-12 shrink-0 text-right text-xs font-bold font-mono text-red-400 bg-red-950/40 px-2 py-0.5 rounded border border-red-900/50">{item.count} err</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Search & Filter Toolbar */}
                        <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-800/80 p-4 rounded-2xl flex flex-col md:flex-row gap-3 items-center justify-between shadow-xl">
                            <div className="relative w-full md:w-96">
                                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Search path, message, code..."
                                    value={search}
                                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                    className="w-full bg-slate-950 border border-slate-800/80 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                                <select
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                    className="bg-slate-950 border border-slate-800/80 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="all">All Issue Categories</option>
                                    <option value="DB_POOL_EXHAUSTION">🔴 Database Pool Exhaustion</option>
                                    <option value="SERVERLESS_EROFS">🟡 Vercel Read-Only File System</option>
                                    <option value="PAYLOAD_VALIDATION">🟡 Payload / Zod Validation</option>
                                    <option value="AUTH_DENIED">🔵 Auth / Privilege Denied</option>
                                    <option value="SERVER_EXCEPTION">🟣 Server Exception</option>
                                </select>

                                <select
                                    value={filterResolved}
                                    onChange={(e) => { setFilterResolved(e.target.value); setPage(1); }}
                                    className="bg-slate-950 border border-slate-800/80 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="all">All Resolution States</option>
                                    <option value="false">Unresolved Only</option>
                                    <option value="true">Resolved Only</option>
                                </select>
                            </div>
                        </div>

                        {/* Error Log Table */}
                        <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-800/80 bg-slate-950/80 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                                            <th className="py-3.5 px-4">Status</th>
                                            <th className="py-3.5 px-4">Method &amp; Path</th>
                                            <th className="py-3.5 px-4">AI Diagnostic Category</th>
                                            <th className="py-3.5 px-4">Error Message</th>
                                            <th className="py-3.5 px-4">Time</th>
                                            <th className="py-3.5 px-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60 font-sans">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={6} className="py-12 text-center text-slate-500">
                                                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                                                    Loading Telemetry Error Logs...
                                                </td>
                                            </tr>
                                        ) : filteredLogsList.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="py-12 text-center text-slate-500">
                                                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-70" />
                                                    No matching error logs found. System is running cleanly!
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredLogsList.map((log) => {
                                                const diag = getErrorDiagnostic(log);
                                                return (
                                                    <tr key={log.id} className="hover:bg-slate-800/40 transition">
                                                        <td className="py-3 px-4 whitespace-nowrap">
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                                                                log.statusCode >= 500 ? 'bg-red-950 text-red-400 border border-red-800/60' : 'bg-amber-950 text-amber-400 border border-amber-800/60'
                                                            }`}>
                                                                {log.statusCode}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-slate-300 max-w-[200px] truncate">
                                                            <span className="font-bold text-indigo-400 mr-1.5">{log.method}</span>
                                                            {log.path}
                                                        </td>
                                                        <td className="py-3 px-4 whitespace-nowrap">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${diag.badgeColor}`}>
                                                                {diag.label}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 max-w-xs truncate text-slate-200 font-mono text-[11px]">
                                                            {log.message}
                                                        </td>
                                                        <td className="py-3 px-4 whitespace-nowrap text-slate-400 text-[11px]">
                                                            {new Date(log.createdAt).toLocaleTimeString()}
                                                        </td>
                                                        <td className="py-3 px-4 whitespace-nowrap text-right space-x-2">
                                                            <button
                                                                onClick={() => setSelectedLog(log)}
                                                                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-medium transition"
                                                            >
                                                                Inspect
                                                            </button>
                                                            {!log.resolved && (
                                                                <button
                                                                    onClick={() => handleResolve(log.id)}
                                                                    className="px-2.5 py-1 rounded-xl bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/50 text-xs font-medium transition"
                                                                >
                                                                    Resolve
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
                                <span>Page {page} of {totalPages}</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={page <= 1}
                                        onClick={() => setPage(p => p - 1)}
                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        disabled={page >= totalPages}
                                        onClick={() => setPage(p => p + 1)}
                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Diagnostic Copilot Modal */}
                        {selectedLog && (() => {
                            const diag = getErrorDiagnostic(selectedLog);
                            const loc = extractErrorLocation(selectedLog.stackTrace);
                            return (
                                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                                    <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                                        <button
                                            onClick={() => setSelectedLog(null)}
                                            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>

                                        <div className="flex items-center gap-3 pr-8">
                                            <span className={`px-3 py-1 rounded-xl text-xs font-mono font-bold border ${selectedLog.statusCode >= 500 ? 'bg-red-950 text-red-400 border-red-800' : 'bg-amber-950 text-amber-400 border-amber-800'}`}>
                                                HTTP {selectedLog.statusCode}
                                            </span>
                                            <div>
                                                <h3 className="text-base font-black text-white font-mono">{selectedLog.method} {selectedLog.path}</h3>
                                                <p className="text-xs text-slate-400 font-mono mt-0.5">Error Code: {selectedLog.errorCode} • ID: {selectedLog.id.slice(-8)}</p>
                                            </div>
                                        </div>

                                        {/* AI / Heuristic Root-Cause Diagnostic Card */}
                                        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 shadow-inner">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-1.5">
                                                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                                                    Automated Root-Cause Diagnostic
                                                </span>
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${diag.badgeColor}`}>
                                                    {diag.severity} SEVERITY
                                                </span>
                                            </div>
                                            <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                                <Wrench className="w-4 h-4 text-emerald-400" />
                                                {diag.label}
                                            </h4>
                                            <p className="text-xs text-slate-300 bg-slate-900/90 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
                                                {diag.advice}
                                            </p>
                                        </div>

                                        {loc && (
                                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                                                <span className="text-slate-400 font-mono text-[11px] flex items-center gap-2">
                                                    <Terminal className="w-3.5 h-3.5 text-blue-400" /> Source Location:
                                                </span>
                                                <code className="text-blue-300 font-mono font-bold truncate max-w-xs">{loc}</code>
                                            </div>
                                        )}

                                        <div>
                                            <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-1.5">Exception Message</h4>
                                            <p className="text-xs bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-red-300 leading-relaxed">
                                                {selectedLog.message}
                                            </p>
                                        </div>

                                        {selectedLog.stackTrace && (
                                            <div>
                                                <div className="flex justify-between items-center mb-1.5">
                                                    <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Stack Trace</h4>
                                                    <button
                                                        onClick={() => copyToClipboard('stack', selectedLog.stackTrace || '')}
                                                        className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 font-mono"
                                                    >
                                                        <Copy className="w-3 h-3" /> Copy Stack
                                                    </button>
                                                </div>
                                                <pre className="text-[11px] bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-slate-300 max-h-52 overflow-y-auto whitespace-pre-wrap leading-tight">
                                                    {selectedLog.stackTrace}
                                                </pre>
                                            </div>
                                        )}

                                        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
                                            <button
                                                onClick={() => copyToClipboard('report', generateIncidentMarkdown(selectedLog))}
                                                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border border-slate-700"
                                            >
                                                <FileText className="w-3.5 h-3.5" />
                                                Copy Incident Markdown Report
                                            </button>
                                            <div className="flex gap-2">
                                                {!selectedLog.resolved && (
                                                    <button
                                                        onClick={() => handleResolve(selectedLog.id)}
                                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-950/50"
                                                    >
                                                        Mark as Resolved
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setSelectedLog(null)}
                                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition"
                                                >
                                                    Close
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}
