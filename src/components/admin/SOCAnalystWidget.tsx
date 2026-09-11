'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
    Shield, 
    ShieldAlert, 
    ShieldCheck, 
    AlertTriangle, 
    CheckCircle2, 
    RefreshCw, 
    Lock, 
    Terminal, 
    Activity, 
    Zap, 
    Database, 
    Eye 
} from 'lucide-react';
import { toast } from 'sonner';
import type { SOCSecurityReport } from '@/services/admin/soc-analyst.service';

export default function SOCAnalystWidget() {
    const [report, setReport] = useState<SOCSecurityReport | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

    const fetchReport = useCallback(async () => {
        try {
            setIsRefreshing(true);
            const res = await fetch(`/api/admin/monitoring/soc-analyst?_t=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
            });
            if (res.ok) {
                const data = await res.json();
                setReport(data.data || data);
            } else {
                toast.error('Failed to load SOC Security Intelligence report');
            }
        } catch (err) {
            console.error('SOC Analyst widget error:', err);
            toast.error('Network error fetching SOC security report');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const handleRunLedgerAudit = async () => {
        try {
            toast.info('Running cryptographic SHA-256 ledger integrity audit...');
            const res = await fetch('/api/admin/monitoring/audit-ledger');
            if (res.ok) {
                const data = await res.json();
                const audit = data.data || data;
                if (audit.tamperedCount > 0) {
                    toast.error(`⚠️ TAMPER WARNING: ${audit.tamperedCount} tampered ledger records detected!`);
                } else {
                    toast.success('✅ Cryptographic Audit Passed: All SHA-256 ledger checksums valid!');
                }
                fetchReport();
            }
        } catch {
            toast.error('Failed to complete ledger integrity audit');
        }
    };

    if (isLoading) {
        return (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white animate-pulse">
                <div className="flex items-center space-x-3 mb-4">
                    <div className="w-8 h-8 bg-slate-800 rounded-lg"></div>
                    <div className="h-5 bg-slate-800 rounded w-1/3"></div>
                </div>
                <div className="h-24 bg-slate-800 rounded-xl w-full"></div>
            </div>
        );
    }

    if (!report) return null;

    const getScoreBadge = (score: number) => {
        if (score >= 85) return { color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10', label: 'OPTIMAL SECURITY' };
        if (score >= 60) return { color: 'text-amber-400 border-amber-500/30 bg-amber-500/10', label: 'ELEVATED RISK' };
        return { color: 'text-rose-400 border-rose-500/30 bg-rose-500/10', label: 'CRITICAL THREAT' };
    };

    const scoreBadge = getScoreBadge(report.securityScore);

    return (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-2xl relative overflow-hidden">
            {/* Ambient Security Glow */}
            <div className={`absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl opacity-20 pointer-events-none ${
                report.securityScore >= 85 ? 'bg-emerald-500' : report.securityScore >= 60 ? 'bg-amber-500' : 'bg-rose-500'
            }`} />

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
                <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
                        {report.securityScore >= 85 ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6 text-rose-400" />}
                    </div>
                    <div>
                        <div className="flex items-center space-x-2">
                            <h2 className="text-lg font-bold tracking-tight text-white">SOC Analyst AI Agent</h2>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                REALTIME SIEM / SOAR
                            </span>
                        </div>
                        <p className="text-xs text-slate-400">Automated Threat Detection, Cryptographic Auditing & System Integrity Engine</p>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    <button
                        onClick={handleRunLedgerAudit}
                        className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition shadow-sm"
                    >
                        <Database className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Run SHA-256 Audit</span>
                    </button>

                    <button
                        onClick={fetchReport}
                        disabled={isRefreshing}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition shadow-md shadow-indigo-600/20 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        <span>Analyze System</span>
                    </button>
                </div>
            </div>

            {/* Metrics Overview Bar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 my-6">
                {/* Security Health Score */}
                <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-slate-400 font-medium">Security Health Score</p>
                        <div className="flex items-baseline space-x-2 mt-1">
                            <span className="text-3xl font-extrabold text-white">{report.securityScore}</span>
                            <span className="text-xs text-slate-500">/ 100</span>
                        </div>
                    </div>
                    <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${scoreBadge.color}`}>
                        {scoreBadge.label}
                    </div>
                </div>

                {/* Ledger Integrity */}
                <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4">
                    <p className="text-xs text-slate-400 font-medium">SHA-256 Ledger Status</p>
                    <div className="flex items-center space-x-2 mt-2">
                        {report.tamperedLedgersCount === 0 ? (
                            <span className="inline-flex items-center text-xs font-semibold text-emerald-400">
                                <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-400" /> 100% Verified Valid
                            </span>
                        ) : (
                            <span className="inline-flex items-center text-xs font-semibold text-rose-400">
                                <AlertTriangle className="w-4 h-4 mr-1.5 text-rose-400" /> {report.tamperedLedgersCount} Tampered Records
                            </span>
                        )}
                    </div>
                </div>

                {/* Unauthorized Probes */}
                <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4">
                    <p className="text-xs text-slate-400 font-medium">Unauthorized Access (403)</p>
                    <div className="flex items-center space-x-2 mt-2">
                        <span className={`text-xl font-bold ${report.unauthorizedAccessCount > 5 ? 'text-amber-400' : 'text-slate-200'}`}>
                            {report.unauthorizedAccessCount}
                        </span>
                        <span className="text-xs text-slate-500">attempts (24h)</span>
                    </div>
                </div>

                {/* Unresolved Telemetry Logs */}
                <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4">
                    <p className="text-xs text-slate-400 font-medium">Unresolved Exceptions</p>
                    <div className="flex items-center space-x-2 mt-2">
                        <span className={`text-xl font-bold ${report.unresolvedErrorsCount > 10 ? 'text-amber-400' : 'text-slate-200'}`}>
                            {report.unresolvedErrorsCount}
                        </span>
                        <span className="text-xs text-slate-500">pending logs</span>
                    </div>
                </div>
            </div>

            {/* Threat Advisories Section */}
            <div className="mt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center">
                    <Terminal className="w-4 h-4 mr-1.5 text-indigo-400" />
                    SOC Threat Intelligence Advisories ({report.advisories.length})
                </h3>

                {report.advisories.length === 0 ? (
                    <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-6 text-center text-slate-400">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                        <p className="text-sm font-medium text-slate-300">No active security threats detected.</p>
                        <p className="text-xs text-slate-500 mt-1">System telemetry and SHA-256 cryptographic ledgers are operating within optimal security boundaries.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {report.advisories.map((adv) => (
                            <div key={adv.id} className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div className="space-y-1">
                                    <div className="flex items-center space-x-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                            adv.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                                            adv.severity === 'HIGH' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                            'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                        }`}>
                                            {adv.severity}
                                        </span>
                                        <span className="text-sm font-bold text-slate-200">{adv.title}</span>
                                    </div>
                                    <p className="text-xs text-slate-400">{adv.description}</p>
                                    <p className="text-[11px] text-indigo-300 font-mono">
                                        💡 Suggested Action: {adv.suggestedAction}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
