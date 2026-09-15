"use client";

import React, { useState, useCallback, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/roles';
import { Button } from "@/components/ui/button";
import {
    Download, RefreshCw, Calendar as CalendarIcon, TrendingUp,
    CheckCircle2, AlertCircle, Clock, ClipboardCopy, Zap,
    ChevronDown, ChevronUp, Activity, BarChart3, Camera,
    Eye, Search, ExternalLink, Check
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getSriLankaToday } from '@/lib/timezone';
import * as XLSX from 'xlsx';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReportMetrics {
    [key: string]: number;
    nc: number;
    rl: number;
    data: number;
    total: number;
}

interface CompletedMetrics {
    [key: string]: number;
    create: number;
    recon: number;
    upgrade: number;
    fnc: number;
    or: number;
    ml: number;
    frl: number;
    data: number;
    total: number;
}

interface MaterialMetrics {
    [key: string]: number;
    dwSlt: number;
    dwCompany: number;
    dw: number;
    pole56: number;
    pole67: number;
    pole80: number;
}

interface ReportRowData {
    region: string;
    province: string;
    rtom: string;
    regularTeams: number;
    teamsWorked: number;
    inHandMorning: ReportMetrics;
    received: ReportMetrics;
    totalInHand: number;
    completed: CompletedMetrics;
    material: MaterialMetrics;
    returned: ReportMetrics;
    wiredOnly: ReportMetrics;
    installClosed: CompletedMetrics;
    sameDayCompleted?: number;
    intakeSameDayCompleted?: number;
    backlogSameDayCompleted?: number;
    delays: Record<string, number>;
    balance: ReportMetrics;
    shortages: { [key: string]: number; stb: number; ont: number };
}

export interface MonthlyPipelineEntry {
    region: string;
    province: string;
    rtom: string;
    monthInstallClosed: number;
    completed: number;
    opmcPatPassed: number;
    finalPatPassed: number;
    patRejected: number;
    pendingFinalPat: number;
    sameDayCompleted: number;
    intakeSameDayCompleted: number;
    backlogSameDayCompleted: number;
    sameDayRate: number;
    finalPatConversionRate: number;
}

export interface MonthlyPipelineGrandTotal {
    monthInstallClosed: number;
    completed: number;
    opmcPatPassed: number;
    finalPatPassed: number;
    patRejected: number;
    pendingFinalPat: number;
    sameDayCompleted: number;
    intakeSameDayCompleted: number;
    backlogSameDayCompleted: number;
    sameDayRate: number;
    finalPatConversionRate: number;
}

interface ReportData {
    reportData: ReportRowData[];
    monthlyPipeline?: MonthlyPipelineEntry[];
    monthlyPipelineGrandTotal?: MonthlyPipelineGrandTotal;
    date: string;
    snapshot?: boolean;
}

// ─── Breakdown Config ────────────────────────────────────────────────────────

type BreakdownTone = 'green' | 'blue';
type BreakdownKey = 'create' | 'recon' | 'upgrade' | 'fnc' | 'or' | 'ml' | 'frl' | 'data' | 'total';

const BREAKDOWN_COLUMNS: { label: string; key: BreakdownKey; kind: 'bucket' | 'subtotal' | 'total' }[] = [
    { label: 'CR',    key: 'create',  kind: 'bucket' },
    { label: 'RC',    key: 'recon',   kind: 'bucket' },
    { label: 'UP',    key: 'upgrade', kind: 'bucket' },
    { label: 'FNC',   key: 'fnc',     kind: 'subtotal' },
    { label: 'OR',    key: 'or',      kind: 'bucket' },
    { label: 'ML',    key: 'ml',      kind: 'bucket' },
    { label: 'FRL',   key: 'frl',     kind: 'subtotal' },
    { label: 'DT',    key: 'data',    kind: 'bucket' },
    { label: 'Total', key: 'total',   kind: 'total' },
];

const BREAKDOWN_STYLE: Record<BreakdownTone, {
    groupBg: string; headSubBg: string; headSubColor: string; headSubTotalBg: string; headSubTotalColor: string;
    edge: string; bucket: string; subtotal: string; total: string;
    sumBucket: string; sumSubtotal: string; sumTotal: string;
}> = {
    green: {
        groupBg:          '#d1fae5',
        headSubBg:        '#a7f3d0',
        headSubColor:     '#064e3b',
        headSubTotalBg:   '#6ee7b7',
        headSubTotalColor:'#022c22',
        edge:             'border-l-2 border-l-emerald-600',
        bucket:           'bg-emerald-50 text-emerald-950 font-medium',
        subtotal:         'bg-emerald-100 font-bold text-emerald-950 border-x border-emerald-200',
        total:            'bg-emerald-200 font-black text-emerald-950 border-x border-emerald-300',
        sumBucket:        'bg-emerald-900 text-emerald-100 font-bold border-r border-emerald-800/60',
        sumSubtotal:      'bg-emerald-700 text-white font-black border-r border-emerald-600',
        sumTotal:         'bg-emerald-500 text-white font-black border-r border-emerald-400',
    },
    blue: {
        groupBg:          '#e0f2fe',
        headSubBg:        '#bae6fd',
        headSubColor:     '#0c4a6e',
        headSubTotalBg:   '#7dd3fc',
        headSubTotalColor:'#032830',
        edge:             'border-l-2 border-l-sky-600',
        bucket:           'bg-sky-50 text-sky-950 font-medium',
        subtotal:         'bg-sky-100 font-bold text-sky-950 border-x border-sky-200',
        total:            'bg-sky-200 font-black text-sky-950 border-x border-sky-300',
        sumBucket:        'bg-sky-900 text-sky-100 font-bold border-r border-sky-800/60',
        sumSubtotal:      'bg-sky-700 text-white font-black border-r border-sky-600',
        sumTotal:         'bg-sky-500 text-white font-black border-r border-sky-400',
    },
};

const breakdownFill = (tone: BreakdownTone, kind: 'bucket' | 'subtotal' | 'total', summary: boolean): string => {
    const s = BREAKDOWN_STYLE[tone];
    if (summary) return kind === 'total' ? s.sumTotal : kind === 'subtotal' ? s.sumSubtotal : s.sumBucket;
    return kind === 'total' ? s.total : kind === 'subtotal' ? s.subtotal : s.bucket;
};

function BreakdownHeadCells({ tone }: { tone: BreakdownTone }) {
    const s = BREAKDOWN_STYLE[tone];
    return (
        <>
            {BREAKDOWN_COLUMNS.map(({ label, key, kind }, i) => (
                <th
                    key={key}
                    className={`px-0.5 py-1.5 text-[10px] font-black uppercase tracking-wider ${kind === 'total' ? 'w-10' : 'w-7'} ${i === 0 ? s.edge : ''}`}
                    style={{
                        background: kind === 'total' ? s.headSubTotalBg : s.headSubBg,
                        color: kind === 'total' ? s.headSubTotalColor : s.headSubColor,
                    }}
                >
                    {label}
                </th>
            ))}
        </>
    );
}

function BreakdownCells({ metrics, tone, summary = false, onOpenModal }: {
    metrics: CompletedMetrics; tone: BreakdownTone; summary?: boolean; onOpenModal?: (cat: string) => void;
}) {
    const s = BREAKDOWN_STYLE[tone];
    const cat = tone === 'green' ? 'COM' : 'IC';
    return (
        <>
            {BREAKDOWN_COLUMNS.map(({ key, kind }, i) => (
                <td
                    key={key}
                    onClick={() => onOpenModal && onOpenModal(cat)}
                    className={`border border-slate-200/80 px-1 py-1 text-center text-[11px] cursor-pointer hover:opacity-80 transition-opacity
                        ${breakdownFill(tone, kind, summary)}
                        ${i === 0 ? s.edge : ''}`}
                    title={`Click to view ${tone === 'green' ? 'Completed' : 'Install Closed'} SODs (${key.toUpperCase()})`}
                >
                    {metrics[key]}
                </td>
            ))}
        </>
    );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonPulse({ className }: { className?: string }) {
    return (
        <div className={`animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 rounded ${className ?? ''}`} />
    );
}

function KpiSkeleton() {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                    <SkeletonPulse className="h-3 w-16 mb-3" />
                    <SkeletonPulse className="h-7 w-20" />
                </div>
            ))}
        </div>
    );
}

function TableSkeleton() {
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="h-10 bg-slate-900" />
            <div className="h-8 bg-slate-800" />
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={`flex gap-1 px-2 py-2 border-b border-slate-100 ${i % 3 === 0 ? 'bg-slate-100' : ''}`}>
                    <SkeletonPulse className="h-4 w-20" />
                    <SkeletonPulse className="h-4 w-12 ml-2" />
                    {Array.from({ length: 8 }).map((__, j) => (
                        <SkeletonPulse key={j} className="h-4 w-8 ml-1" />
                    ))}
                </div>
            ))}
        </div>
    );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
    label: string;
    value: number | string;
    icon: React.ReactNode;
    gradient: string;
    iconBg: string;
    badge?: string;
    badgeColor?: string;
}

function KpiCard({ label, value, icon, gradient, iconBg, badge, badgeColor }: KpiCardProps) {
    return (
        <div className={`relative overflow-hidden rounded-xl border border-white/10 shadow-lg ${gradient} p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl group`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/70 mb-1">{label}</p>
                    <p className="text-2xl font-black text-white leading-none">{value}</p>
                    {badge && (
                        <span className={`inline-block mt-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badgeColor}`}>
                            {badge}
                        </span>
                    )}
                </div>
                <div className={`p-2.5 rounded-xl ${iconBg} shadow-inner`}>
                    {icon}
                </div>
            </div>
            {/* Decorative glow */}
            <div className="absolute -bottom-3 -right-3 w-16 h-16 rounded-full opacity-20 blur-xl bg-white group-hover:opacity-30 transition-opacity duration-300" />
        </div>
    );
}

// ─── Pipeline Funnel ─────────────────────────────────────────────────────────

function PipelineFunnelBar({ gt }: { gt: MonthlyPipelineGrandTotal }) {
    const base = gt.monthInstallClosed || 1;
    const stages = [
        { label: '1. Install Closed', value: gt.monthInstallClosed, color: 'bg-blue-500', pct: 100 },
        { label: '2. Completed',      value: gt.completed,          color: 'bg-sky-500',  pct: Math.round((gt.completed / base) * 100) },
        { label: '3. OPMC PAT',       value: gt.opmcPatPassed,      color: 'bg-emerald-500', pct: Math.round((gt.opmcPatPassed / base) * 100) },
        { label: '4. Final PAT',      value: gt.finalPatPassed,     color: 'bg-teal-500', pct: Math.round((gt.finalPatPassed / base) * 100) },
    ];

    return (
        <div className="grid grid-cols-4 gap-2 mb-4">
            {stages.map((s, i) => (
                <div key={i} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-300 font-semibold">{s.label}</span>
                        <span className="text-[10px] text-white font-black">{s.pct}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full ${s.color} transition-all duration-700`}
                            style={{ width: `${s.pct}%` }}
                        />
                    </div>
                    <div className="text-lg font-black text-white">{s.value}</div>
                </div>
            ))}
        </div>
    );
}

// ─── Summary Row ─────────────────────────────────────────────────────────────

interface OrderDetail {
    id: string;
    soNum: string;
    voiceNumber: string | null;
    rtom: string;
    lea: string | null;
    customerName: string | null;
    address: string | null;
    package: string | null;
    orderType: string | null;
    serviceType: string | null;
    status: string;
    sltsStatus: string;
    receivedDate: string | null;
    completedDate: string | null;
    statusDate: string | null;
    createdAt: string;
    wiredOnly: boolean;
    stbShortage: boolean;
    ontShortage: boolean;
    ontSerialNumber: string | null;
    dropWireDistance: number | null;
    dropWireMeters: number;
    poles: { p56: number; p67: number; p80: number };
    stbSerialsList: string[];
    returnReason: string | null;
    comments: string | null;
    opmcPatStatus: string | null;
    hoPatStatus: string | null;
    sltsPatStatus: string | null;
    completionMode: string | null;
    contractor?: { id: string; name: string } | null;
    team?: { id: string; name: string; sltCode?: string | null } | null;
    opmc?: { id: string; name: string; rtom: string } | null;
}

interface SummaryTotals {
    totalCompleted: number;
    totalInstallClosed: number;
    totalReturned: number;
    totalWiredOnly: number;
    totalDwDistance: number;
    totalPoles56: number;
    totalPoles67: number;
    totalPoles80: number;
    totalStbShortage: number;
    totalOntShortage: number;
}

function DailyOperationalOrdersModal({
    isOpen,
    onClose,
    rtom,
    date,
    initialCategory = 'ALL'
}: {
    isOpen: boolean;
    onClose: () => void;
    rtom: string;
    date: string;
    initialCategory?: string;
}) {
    const [orders, setOrders] = useState<OrderDetail[]>([]);
    const [summaryTotals, setSummaryTotals] = useState<SummaryTotals | null>(null);
    const [loading, setLoading] = useState(false);
    const [category, setCategory] = useState(initialCategory);
    const [search, setSearch] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const categoriesList = [
        { id: 'ALL', label: 'All Orders' },
        { id: 'REC', label: 'Received (REC)' },
        { id: 'COM', label: 'Completed (COM)' },
        { id: 'IC', label: 'Install Closed (IC)' },
        { id: 'RET', label: 'Returned (RET)' },
        { id: 'WIP', label: 'In Progress (WIP)' },
        { id: 'REJECT', label: 'Rejected' },
    ];

    const copyToClipboard = (text: string, id: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    useEffect(() => {
        setCategory(initialCategory);
    }, [initialCategory]);

    useEffect(() => {
        if (!isOpen || !rtom) return;
        let isCancelled = false;

        const fetchOrders = async () => {
            setLoading(true);
            try {
                const targetCat = category || 'ALL';
                const res = await fetch(
                    `/api/reports/daily-operational/orders?date=${encodeURIComponent(date || '')}&rtom=${encodeURIComponent(rtom)}&category=${encodeURIComponent(targetCat)}&_t=${Date.now()}`,
                    {
                        cache: 'no-store',
                        headers: {
                            'Cache-Control': 'no-cache',
                            'Pragma': 'no-cache',
                        }
                    }
                );
                const json = await res.json();
                if (!isCancelled && json.success) {
                    setOrders(json.data.orders || []);
                    setSummaryTotals(json.data.summaryTotals || null);
                }
            } catch (err) {
                console.error('Failed to load RTOM orders:', err);
            } finally {
                if (!isCancelled) setLoading(false);
            }
        };

        fetchOrders();
        return () => { isCancelled = true; };
    }, [isOpen, rtom, date, category]);

    const filteredOrders = React.useMemo(() => {
        if (!search.trim()) return orders;
        const q = search.toLowerCase().trim();
        return orders.filter(o => 
            o.soNum?.toLowerCase().includes(q) ||
            o.voiceNumber?.toLowerCase().includes(q) ||
            o.customerName?.toLowerCase().includes(q) ||
            o.address?.toLowerCase().includes(q) ||
            o.package?.toLowerCase().includes(q) ||
            o.orderType?.toLowerCase().includes(q) ||
            o.sltsStatus?.toLowerCase().includes(q) ||
            o.ontSerialNumber?.toLowerCase().includes(q) ||
            o.team?.name?.toLowerCase().includes(q) ||
            o.returnReason?.toLowerCase().includes(q)
        );
    }, [orders, search]);

    const handleExportModalOrders = () => {
        if (filteredOrders.length === 0) return;
        const exportRows = filteredOrders.map((o, index) => ({
            '#': index + 1,
            'RTOM': o.rtom,
            'LEA': o.lea || 'N/A',
            'SOD Number': o.soNum,
            'Voice / Service Number': o.voiceNumber || 'N/A',
            'Customer Name': o.customerName || 'N/A',
            'Address': o.address || 'N/A',
            'Package': o.package || 'N/A',
            'Order Type': o.orderType || 'N/A',
            'Service Type': o.serviceType || 'N/A',
            'SLTS Status': o.sltsStatus,
            'System Status': o.status,
            'Drop Wire (Meters)': o.dropWireMeters || 0,
            'ONT Serial Number': o.ontSerialNumber || 'N/A',
            'STB Serials': o.stbSerialsList ? o.stbSerialsList.join(', ') : 'N/A',
            'Poles 5.6m': o.poles?.p56 || 0,
            'Poles 6.7m': o.poles?.p67 || 0,
            'Poles 8.0m': o.poles?.p80 || 0,
            'OPMC PAT Status': o.opmcPatStatus || 'PENDING',
            'HO PAT Status': o.hoPatStatus || 'PENDING',
            'Return / Delay Reason': o.returnReason || o.comments || 'N/A',
            'Assigned Team': o.team?.name || 'N/A',
            'Contractor': o.contractor?.name || 'N/A',
            'Received Date': o.receivedDate ? new Date(o.receivedDate).toLocaleDateString() : 'N/A',
            'Completed Date': o.completedDate ? new Date(o.completedDate).toLocaleDateString() : 'N/A',
        }));

        const ws = XLSX.utils.json_to_sheet(exportRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `${rtom}_Orders`);
        XLSX.writeFile(wb, `Daily_Operational_${rtom}_${date}.xlsx`);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-[96vw] h-[92vh] max-h-[92vh] flex flex-col p-0 overflow-hidden bg-slate-950 text-white border-slate-800 shadow-2xl rounded-2xl">
                {/* Header */}
                <DialogHeader className="p-5 border-b border-slate-800 bg-slate-900 flex flex-row items-center justify-between shrink-0">
                    <div>
                        <DialogTitle className="text-xl font-black text-white flex items-center gap-3">
                            <span>Daily Operational Cross-Check Workstation</span>
                            <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase tracking-wider">
                                RTOM: {rtom}
                            </span>
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                Date: {date}
                            </span>
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400 mt-1">
                            In-depth cross-checking workstation displaying SOD numbers, Voice numbers, Drop Wire meters, CPE serials, Poles, Return reasons, and PAT statuses.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                {/* Summary KPI Banner */}
                {summaryTotals && (
                    <div className="bg-slate-900/90 border-b border-slate-800 p-3.5 px-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 shrink-0">
                        <div className="bg-slate-950/90 rounded-xl p-3 border border-slate-800 shadow-inner">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total SODs</div>
                            <div className="text-xl font-black text-white mt-0.5">{orders.length}</div>
                        </div>
                        <div className="bg-emerald-950/50 rounded-xl p-3 border border-emerald-800/50 shadow-inner">
                            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Completed / IC</div>
                            <div className="text-xl font-black text-emerald-300 mt-0.5">
                                {summaryTotals.totalCompleted} <span className="text-xs font-normal text-slate-400">({summaryTotals.totalInstallClosed} IC)</span>
                            </div>
                        </div>
                        <div className={`rounded-xl p-3 border shadow-inner ${summaryTotals.totalReturned > 0 ? 'bg-rose-950/60 border-rose-800/60' : 'bg-slate-950/90 border-slate-800'}`}>
                            <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Returned SODs</div>
                            <div className="text-xl font-black text-rose-300 mt-0.5">{summaryTotals.totalReturned}</div>
                        </div>
                        <div className="bg-cyan-950/50 rounded-xl p-3 border border-cyan-800/50 shadow-inner">
                            <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Drop Wire (DW)</div>
                            <div className="text-xl font-black text-cyan-300 mt-0.5">{summaryTotals.totalDwDistance} <span className="text-xs text-slate-400">m</span></div>
                        </div>
                        <div className="bg-indigo-950/50 rounded-xl p-3 border border-indigo-800/50 shadow-inner">
                            <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Poles Used</div>
                            <div className="text-xs font-bold text-indigo-200 mt-1">
                                5.6m: {summaryTotals.totalPoles56} | 6.7m: {summaryTotals.totalPoles67} | 8m: {summaryTotals.totalPoles80}
                            </div>
                        </div>
                        <div className="bg-amber-950/50 rounded-xl p-3 border border-amber-800/50 shadow-inner">
                            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Shortages</div>
                            <div className="text-xs font-bold text-amber-300 mt-1">
                                STB: {summaryTotals.totalStbShortage} | ONT: {summaryTotals.totalOntShortage}
                            </div>
                        </div>
                    </div>
                )}

                {/* Filter and Search toolbar */}
                <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {categoriesList.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setCategory(cat.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                    category === cat.id
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40 ring-2 ring-indigo-400/30'
                                        : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white'
                                }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 sm:w-80">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                            <Input
                                type="text"
                                placeholder="Search SOD, Voice No, Customer Name, Address, ONT SN, Return Reason..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-8 h-9 text-xs bg-slate-950 border-slate-800 text-white focus:border-indigo-500"
                            />
                        </div>
                        <Button
                            onClick={handleExportModalOrders}
                            disabled={filteredOrders.length === 0}
                            size="sm"
                            className="h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-4"
                        >
                            <Download className="w-3.5 h-3.5" /> Export XLSX
                        </Button>
                    </div>
                </div>

                {/* Main Detailed Workstation Table */}
                <div className="flex-1 overflow-auto p-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-28 gap-3">
                            <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin" />
                            <span className="text-xs text-slate-400 font-medium">Loading comprehensive report orders for {rtom}...</span>
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="text-center py-24 text-slate-400 text-xs">
                            No service orders found matching category &quot;{category}&quot; and search query.
                        </div>
                    ) : (
                        <div className="rounded-xl border border-slate-800 overflow-x-auto bg-slate-950 shadow-inner">
                            <table className="w-full text-left text-xs border-collapse min-w-[1300px]">
                                <thead className="bg-slate-900 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-300 sticky top-0 z-10 backdrop-blur-md">
                                    <tr>
                                        <th className="p-3 w-10 text-center border-r border-slate-800">#</th>
                                        <th className="p-3 w-40 border-r border-slate-800">SOD Number &amp; LEA</th>
                                        <th className="p-3 w-40 border-r border-slate-800">Voice / Service No</th>
                                        <th className="p-3 w-52 border-r border-slate-800">Customer Name</th>
                                        <th className="p-3 w-64 border-r border-slate-800">Customer Address</th>
                                        <th className="p-3 w-44 border-r border-slate-800">Package &amp; Order Type</th>
                                        <th className="p-3 w-48 border-r border-slate-800">Materials &amp; CPE Serials</th>
                                        <th className="p-3 w-40 border-r border-slate-800">SLTS &amp; PAT Status</th>
                                        <th className="p-3 w-64 border-r border-slate-800">Delay / Return Remarks</th>
                                        <th className="p-3 w-48 border-r border-slate-800">Assigned Team &amp; Contractor</th>
                                        <th className="p-3 w-28 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {filteredOrders.map((ord, idx) => (
                                        <tr key={ord.id} className="hover:bg-slate-900/90 transition-colors group">
                                            <td className="p-3 text-center text-slate-500 font-mono text-[11px] border-r border-slate-800/60">{idx + 1}</td>
                                            <td className="p-3 font-mono border-r border-slate-800/60">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-bold text-indigo-300 text-xs">{ord.soNum}</span>
                                                    <button
                                                        onClick={() => copyToClipboard(ord.soNum, `sod-${ord.id}`)}
                                                        className="text-slate-500 hover:text-indigo-300 transition-colors"
                                                        title="Copy SOD Number"
                                                    >
                                                        {copiedId === `sod-${ord.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-0.5 font-sans font-semibold">
                                                    LEA: {ord.lea || ord.rtom} {ord.opmc?.name ? `(${ord.opmc.name})` : ''}
                                                </div>
                                            </td>
                                            <td className="p-3 font-mono border-r border-slate-800/60">
                                                {ord.voiceNumber ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/70 font-bold text-xs">
                                                            {ord.voiceNumber}
                                                        </span>
                                                        <button
                                                            onClick={() => copyToClipboard(ord.voiceNumber || '', `voice-${ord.id}`)}
                                                            className="text-slate-500 hover:text-emerald-300 transition-colors"
                                                            title="Copy Voice Number"
                                                        >
                                                            {copiedId === `voice-${ord.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-600 font-italic text-[11px]">N/A</span>
                                                )}
                                            </td>
                                            <td className="p-3 border-r border-slate-800/60">
                                                <div className="font-bold text-slate-200 text-xs">{ord.customerName || 'N/A'}</div>
                                            </td>
                                            <td className="p-3 border-r border-slate-800/60">
                                                <div className="text-[11px] text-slate-300 leading-relaxed">
                                                    {ord.address || '-'}
                                                </div>
                                            </td>
                                            <td className="p-3 border-r border-slate-800/60">
                                                <div className="font-bold text-slate-200">{ord.package || 'N/A'}</div>
                                                <div className="text-[10px] text-slate-400 mt-1 flex flex-wrap gap-1">
                                                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-bold">{ord.orderType || '-'}</span>
                                                    {ord.serviceType && <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">{ord.serviceType}</span>}
                                                </div>
                                            </td>
                                            <td className="p-3 text-[11px] border-r border-slate-800/60">
                                                <div className="text-cyan-300 font-bold">
                                                    Drop Wire: {ord.dropWireMeters > 0 ? `${ord.dropWireMeters} m` : '0 m'}
                                                </div>
                                                {ord.ontSerialNumber && (
                                                    <div className="text-[10px] text-slate-400 mt-1 font-mono">
                                                        ONT: <span className="text-slate-200 font-bold">{ord.ontSerialNumber}</span>
                                                    </div>
                                                )}
                                                {ord.stbSerialsList.length > 0 && (
                                                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                                        STB: <span className="text-slate-200">{ord.stbSerialsList.join(', ')}</span>
                                                    </div>
                                                )}
                                                {(ord.poles?.p56 > 0 || ord.poles?.p67 > 0 || ord.poles?.p80 > 0) && (
                                                    <div className="text-[10px] text-indigo-300 mt-1 font-semibold">
                                                        Poles: 5.6m({ord.poles.p56}) 6.7m({ord.poles.p67}) 8m({ord.poles.p80})
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3 border-r border-slate-800/60">
                                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                                                    ord.sltsStatus === 'COMPLETED' ? 'bg-emerald-950 text-emerald-300 border-emerald-800' :
                                                    ord.sltsStatus === 'INSTALL_CLOSED' || ord.sltsStatus === 'PROV_CLOSED' ? 'bg-sky-950 text-sky-300 border-sky-800' :
                                                    ord.sltsStatus === 'RETURN' ? 'bg-rose-950 text-rose-300 border-rose-800' :
                                                    'bg-amber-950 text-amber-300 border-amber-800'
                                                }`}>
                                                    {ord.sltsStatus}
                                                </span>
                                                <div className="text-[9px] text-slate-400 mt-1.5 space-y-0.5">
                                                    <div>OPMC PAT: <strong className={ord.opmcPatStatus === 'PAT_PASSED' || ord.opmcPatStatus === 'PASSED' ? 'text-emerald-400' : 'text-slate-400'}>{ord.opmcPatStatus || 'PENDING'}</strong></div>
                                                    {ord.completedDate && <div>Done: {new Date(ord.completedDate).toLocaleDateString()}</div>}
                                                </div>
                                            </td>
                                            <td className="p-3 border-r border-slate-800/60 text-[11px]">
                                                {ord.returnReason || ord.comments ? (
                                                    <div className="text-rose-300 bg-rose-950/40 p-2 rounded-lg border border-rose-900/60 text-[10px] leading-relaxed whitespace-normal" title={ord.returnReason || ord.comments || ''}>
                                                        {ord.returnReason || ord.comments}
                                                    </div>
                                                ) : (
                                                    <div className="text-slate-500 text-[10px]">-</div>
                                                )}
                                                {(ord.stbShortage || ord.ontShortage) && (
                                                    <div className="flex gap-1 mt-1.5">
                                                        {ord.stbShortage && <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[9px] font-bold">STB Shortage</span>}
                                                        {ord.ontShortage && <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[9px] font-bold">ONT Shortage</span>}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3 text-[11px] text-slate-300 border-r border-slate-800/60">
                                                <div className="font-bold text-slate-200">{ord.team?.name || 'Unassigned'}</div>
                                                <div className="text-[10px] text-slate-400 mt-0.5">{ord.contractor?.name || ''}</div>
                                                {ord.team?.sltCode && <div className="text-[9px] font-mono text-indigo-400 mt-0.5">Code: {ord.team.sltCode}</div>}
                                            </td>
                                            <td className="p-3 text-right">
                                                <Button
                                                    onClick={() => window.open(`/helpdesk/service-orders?search=${ord.soNum}`, '_blank')}
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 px-3 text-indigo-400 hover:text-indigo-200 hover:bg-indigo-950/70 text-xs font-black gap-1"
                                                >
                                                    <span>View SOD</span>
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between text-xs text-slate-400 shrink-0">
                    <div>
                        Showing <strong className="text-white">{filteredOrders.length}</strong> of <strong className="text-white">{orders.length}</strong> detailed service orders for RTOM <strong className="text-indigo-300">{rtom}</strong> on date {date}.
                    </div>
                    <Button onClick={onClose} variant="outline" size="sm" className="bg-slate-800 text-white border-slate-700 hover:bg-slate-700 font-bold px-5">
                        Close Workstation
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function SummaryRow({ label, row, isGrandTotal = false, onOpenModal }: {
    label: string; row: ReportRowData; isGrandTotal?: boolean; onOpenModal?: (rtom: string, cat: string) => void;
}) {
    const base = isGrandTotal
        ? 'bg-slate-900 text-white'
        : 'bg-indigo-800/80 text-white';

    const rtomKey = isGrandTotal ? 'ALL' : row.rtom;

    return (
        <tr className={`${base} font-bold`}>
            <td colSpan={2} className="border border-slate-600/50 px-3 py-2 text-right uppercase tracking-wider text-sm">
                <button
                    onClick={() => onOpenModal && onOpenModal(rtomKey, 'ALL')}
                    className="hover:underline flex items-center justify-end gap-1.5 w-full font-bold cursor-pointer"
                    title="Click to view SOD Numbers & Voice Numbers"
                >
                    <span>{label}</span>
                    <Eye className="w-3.5 h-3.5 text-indigo-300 opacity-80" />
                </button>
            </td>
            <td className="border border-slate-600/50 px-1 py-1.5 text-center">{row.inHandMorning.total}</td>
            <td 
                onClick={() => onOpenModal && onOpenModal(rtomKey, 'RECEIVED')}
                className="border border-slate-600/50 px-1 py-1.5 text-center cursor-pointer hover:bg-emerald-700/60 transition-colors"
                title="Click to view Received SODs"
            >
                {row.received.total}
            </td>
            <td 
                onClick={() => onOpenModal && onOpenModal(rtomKey, 'ALL')}
                className="border border-slate-600/50 px-1 py-1.5 text-center font-black cursor-pointer hover:bg-indigo-700/60 transition-colors"
                title="Click to view In-Hand SODs"
            >
                {row.totalInHand}
            </td>
            <BreakdownCells metrics={row.completed} tone="green" summary onOpenModal={(cat) => onOpenModal && onOpenModal(rtomKey, cat)} />
            <BreakdownCells metrics={row.installClosed} tone="blue" summary onOpenModal={(cat) => onOpenModal && onOpenModal(rtomKey, cat)} />
            <td className="border border-slate-600/50 px-1 py-1.5 text-center">{row.material.dw.toFixed(1)}</td>
            <td className="border border-slate-600/50 px-1 py-1.5 text-center">{row.material.pole56}</td>
            <td className="border border-slate-600/50 px-1 py-1.5 text-center">{row.material.pole67}</td>
            <td className="border border-slate-600/50 px-1 py-1.5 text-center">{row.material.pole80}</td>
            <td 
                onClick={() => onOpenModal && onOpenModal(rtomKey, 'RETURNED')}
                className="border border-slate-600/50 px-1 py-1.5 text-center cursor-pointer hover:bg-rose-800/60 transition-colors"
                title="Click to view Returned SODs"
            >
                {row.returned.total}
            </td>
            <td className="border border-slate-600/50 px-1 py-1.5 text-center">{row.wiredOnly.total}</td>
            <td 
                onClick={() => onOpenModal && onOpenModal(rtomKey, 'BALANCE')}
                className={`border border-slate-600/50 px-2 py-1.5 text-center font-black cursor-pointer hover:bg-slate-800 transition-colors ${isGrandTotal ? 'bg-slate-700 text-white' : 'bg-indigo-900/60'}`}
                title="Click to view Balance SODs"
            >
                {row.balance.total}
            </td>
        </tr>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DailyOperationalReportPage() {
    const [data, setData]               = useState<ReportData | null>(null);
    const [loading, setLoading]         = useState(false);
    const [selectedDate, setSelectedDate] = useState(getSriLankaToday());
    const [hydrated, setHydrated]       = useState(false);
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(false);

    // Modal state for RTOM orders drilldown
    const [modalOpen, setModalOpen]     = useState(false);
    const [modalRtom, setModalRtom]     = useState('');
    const [modalCategory, setModalCategory] = useState('ALL');

    const handleOpenOrdersModal = useCallback((rtom: string, category: string = 'ALL') => {
        setModalRtom(rtom);
        setModalCategory(category);
        setModalOpen(true);
    }, []);

    const today = getSriLankaToday();
    const isToday = selectedDate === today;

    const fetchReport = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(
                `/api/reports/daily-operational?date=${selectedDate}&_t=${Date.now()}`,
                { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }
            );
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (err) {
            console.error('Failed to fetch daily report', err);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => { setHydrated(true); }, []);
    useEffect(() => { if (hydrated) fetchReport(); }, [hydrated, fetchReport]);

    // Auto-refresh every 5 minutes for today's live data
    useEffect(() => {
        if (!autoRefresh || !isToday) return;
        const interval = setInterval(fetchReport, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [autoRefresh, isToday, fetchReport]);

    const reportData = React.useMemo(() => data?.reportData ?? [], [data?.reportData]);
    const monthlyPipeline = React.useMemo(() => data?.monthlyPipeline ?? [], [data?.monthlyPipeline]);
    const monthlyPipelineGrandTotal = data?.monthlyPipelineGrandTotal ?? null;
    const isSnapshot = data?.snapshot === true;

    // ── Summaries ────────────────────────────────────────────────────────────

    const calculateSummaries = (): { summaries: Record<string, ReportRowData>; grandTotal: ReportRowData } => {
        const empty = (): ReportRowData => ({
            region: '', province: '', rtom: '',
            regularTeams: 0, teamsWorked: 0,
            inHandMorning: { nc: 0, rl: 0, data: 0, total: 0 },
            received:      { nc: 0, rl: 0, data: 0, total: 0 },
            totalInHand: 0,
            completed:   { create: 0, recon: 0, upgrade: 0, fnc: 0, or: 0, ml: 0, frl: 0, data: 0, total: 0 },
            material:    { dwSlt: 0, dwCompany: 0, dw: 0, pole56: 0, pole67: 0, pole80: 0 },
            returned:    { nc: 0, rl: 0, data: 0, total: 0 },
            wiredOnly:   { nc: 0, rl: 0, data: 0, total: 0 },
            installClosed: { create: 0, recon: 0, upgrade: 0, fnc: 0, or: 0, ml: 0, frl: 0, data: 0, total: 0 },
            sameDayCompleted: 0, intakeSameDayCompleted: 0, backlogSameDayCompleted: 0,
            delays:    { ontShortage: 0, stbShortage: 0, nokia: 0, system: 0, opmc: 0, cxDelay: 0, sameDay: 0, polePending: 0 },
            balance:   { nc: 0, rl: 0, data: 0, total: 0 },
            shortages: { stb: 0, ont: 0 },
        });

        const summaries: Record<string, ReportRowData> = {};
        const grandTotal = empty();
        grandTotal.region = 'ALL'; grandTotal.rtom = 'GRAND TOTAL';

        const acc = (target: Record<string, number>, source: Record<string, number>) => {
            Object.keys(source).forEach(k => {
                if (k !== 'total' && typeof source[k] === 'number') target[k] = (target[k] || 0) + source[k];
            });
        };
        const recalcTotal = (obj: Record<string, number>, keys: string[]) => {
            obj.total = keys.reduce((s, k) => s + (typeof obj[k] === 'number' ? obj[k] : 0), 0);
        };

        reportData.forEach(row => {
            if (!summaries[row.region]) {
                summaries[row.region] = empty();
                summaries[row.region].region = row.region;
                summaries[row.region].rtom = `${row.region} TOTAL`;
            }
            const reg = summaries[row.region];

            reg.regularTeams += row.regularTeams;
            reg.teamsWorked  += row.teamsWorked;
            reg.totalInHand  += row.totalInHand;
            acc(reg.inHandMorning, row.inHandMorning);
            acc(reg.received,      row.received);
            acc(reg.completed,     row.completed);
            acc(reg.material,      row.material);
            acc(reg.returned,      row.returned);
            acc(reg.wiredOnly,     row.wiredOnly);
            acc(reg.installClosed, row.installClosed);
            reg.sameDayCompleted       = (reg.sameDayCompleted       || 0) + (row.sameDayCompleted       || 0);
            reg.intakeSameDayCompleted = (reg.intakeSameDayCompleted || 0) + (row.intakeSameDayCompleted || 0);
            reg.backlogSameDayCompleted= (reg.backlogSameDayCompleted|| 0) + (row.backlogSameDayCompleted|| 0);
            acc(reg.delays,    row.delays);
            acc(reg.balance,   row.balance);
            acc(reg.shortages, row.shortages);

            recalcTotal(reg.inHandMorning, ['nc','rl','data']);
            recalcTotal(reg.received,      ['nc','rl','data']);
            recalcTotal(reg.completed,     ['create','recon','upgrade','or','ml','data']);
            recalcTotal(reg.returned,      ['nc','rl','data']);
            recalcTotal(reg.wiredOnly,     ['nc','rl','data']);
            recalcTotal(reg.installClosed, ['create','recon','upgrade','or','ml','data']);
            recalcTotal(reg.balance,       ['nc','rl','data']);

            grandTotal.regularTeams += row.regularTeams;
            grandTotal.teamsWorked  += row.teamsWorked;
            grandTotal.totalInHand  += row.totalInHand;
            acc(grandTotal.inHandMorning, row.inHandMorning);
            acc(grandTotal.received,      row.received);
            acc(grandTotal.completed,     row.completed);
            acc(grandTotal.material,      row.material);
            acc(grandTotal.returned,      row.returned);
            acc(grandTotal.wiredOnly,     row.wiredOnly);
            acc(grandTotal.installClosed, row.installClosed);
            grandTotal.sameDayCompleted = (grandTotal.sameDayCompleted || 0) + (row.sameDayCompleted || 0);
            acc(grandTotal.delays,    row.delays);
            acc(grandTotal.balance,   row.balance);
            acc(grandTotal.shortages, row.shortages);
        });

        recalcTotal(grandTotal.inHandMorning, ['nc','rl','data']);
        recalcTotal(grandTotal.received,      ['nc','rl','data']);
        recalcTotal(grandTotal.completed,     ['create','recon','upgrade','or','ml','data']);
        recalcTotal(grandTotal.returned,      ['nc','rl','data']);
        recalcTotal(grandTotal.wiredOnly,     ['nc','rl','data']);
        recalcTotal(grandTotal.installClosed, ['create','recon','upgrade','or','ml','data']);
        recalcTotal(grandTotal.balance,       ['nc','rl','data']);

        return { summaries, grandTotal };
    };

    const { summaries, grandTotal } = reportData.length > 0
        ? calculateSummaries()
        : { summaries: {} as Record<string, ReportRowData>, grandTotal: null };

    // ── Monthly pipeline summaries ───────────────────────────────────────────

    const monthlyPipelineSummaries = React.useMemo(() => {
        const regionSummaries: Record<string, MonthlyPipelineEntry> = {};
        monthlyPipeline.forEach(item => {
            if (!regionSummaries[item.region]) {
                regionSummaries[item.region] = {
                    region: item.region, province: item.province,
                    rtom: `${item.region} TOTAL`,
                    monthInstallClosed: 0, completed: 0, opmcPatPassed: 0,
                    finalPatPassed: 0, patRejected: 0, pendingFinalPat: 0,
                    sameDayCompleted: 0, intakeSameDayCompleted: 0, backlogSameDayCompleted: 0,
                    sameDayRate: 0, finalPatConversionRate: 0,
                };
            }
            const reg = regionSummaries[item.region];
            reg.monthInstallClosed += item.monthInstallClosed;
            reg.completed          += item.completed;
            reg.opmcPatPassed      += item.opmcPatPassed;
            reg.finalPatPassed     += item.finalPatPassed;
            reg.patRejected        += item.patRejected;
            reg.pendingFinalPat    += item.pendingFinalPat;
            reg.sameDayCompleted   += item.sameDayCompleted;
            reg.intakeSameDayCompleted += item.intakeSameDayCompleted;
            reg.backlogSameDayCompleted+= item.backlogSameDayCompleted;
        });
        Object.values(regionSummaries).forEach(reg => {
            const base = reg.monthInstallClosed || 1;
            reg.finalPatConversionRate = Math.round((reg.finalPatPassed / base) * 1000) / 10;
            reg.sameDayRate            = Math.round((reg.sameDayCompleted / base) * 1000) / 10;
        });
        return regionSummaries;
    }, [monthlyPipeline]);

    // ── Export ───────────────────────────────────────────────────────────────

    const handleExport = () => {
        if (!data || reportData.length === 0) return;
        const breakdown = (m: CompletedMetrics): number[] =>
            [m.create, m.recon, m.upgrade, m.fnc, m.or, m.ml, m.frl, m.data, m.total];

        const worksheetData: (string | number)[][] = [[
            'Province', 'RTOM', 'In Hand Morning', 'Received Today', 'Total In Hand',
            'CR','RC','UP','FNC','OR','ML','FRL','DATA','Total Completed',
            'IC CR','IC RC','IC UP','IC FNC','IC OR','IC ML','IC FRL','IC DATA','IC Total',
            'DW','Pole 5.6','Pole 6.7','Pole 8.0','Returned SOD','Wired Only','Balance'
        ]];

        let currentRegion = '';
        reportData.forEach(row => {
            if (currentRegion !== row.region) {
                if (currentRegion && summaries[currentRegion]) {
                    const s = summaries[currentRegion];
                    worksheetData.push(['', `${currentRegion} TOTAL`, s.inHandMorning.total, s.received.total, s.totalInHand,
                        ...breakdown(s.completed), ...breakdown(s.installClosed),
                        s.material.dw.toFixed(2), s.material.pole56, s.material.pole67, s.material.pole80,
                        s.returned.total, s.wiredOnly.total, s.balance.total]);
                }
                currentRegion = row.region;
                worksheetData.push([row.region, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
            }
            worksheetData.push([row.province, row.rtom, row.inHandMorning.total, row.received.total, row.totalInHand,
                ...breakdown(row.completed), ...breakdown(row.installClosed),
                row.material.dw.toFixed(2), row.material.pole56, row.material.pole67, row.material.pole80,
                row.returned.total, row.wiredOnly.total, row.balance.total]);
        });

        if (currentRegion && summaries[currentRegion]) {
            const s = summaries[currentRegion];
            worksheetData.push(['', `${currentRegion} TOTAL`, s.inHandMorning.total, s.received.total, s.totalInHand,
                ...breakdown(s.completed), ...breakdown(s.installClosed),
                s.material.dw.toFixed(2), s.material.pole56, s.material.pole67, s.material.pole80,
                s.returned.total, s.wiredOnly.total, s.balance.total]);
        }

        if (grandTotal) {
            worksheetData.push(['GRAND TOTAL', '', grandTotal.inHandMorning.total, grandTotal.received.total, grandTotal.totalInHand,
                ...breakdown(grandTotal.completed), ...breakdown(grandTotal.installClosed),
                grandTotal.material.dw.toFixed(2), grandTotal.material.pole56, grandTotal.material.pole67, grandTotal.material.pole80,
                grandTotal.returned.total, grandTotal.wiredOnly.total, grandTotal.balance.total]);
        }

        const ws = XLSX.utils.aoa_to_sheet(worksheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Daily Operational Report');

        if (monthlyPipeline.length > 0) {
            const psd: (string | number)[][] = [[
                'Province','RTOM','Month Install Closed','System Completed','PAT OPMC Passed',
                'Final PAT Passed','PAT Rejected','Pending Final PAT','Same-Day Done','Same-Day Rate %','Final PAT Conversion Rate %'
            ]];
            let pr = '';
            monthlyPipeline.forEach(row => {
                if (pr !== row.region) {
                    if (pr && monthlyPipelineSummaries[pr]) {
                        const s = monthlyPipelineSummaries[pr];
                        psd.push(['', `${pr} TOTAL`, s.monthInstallClosed, s.completed, s.opmcPatPassed,
                            s.finalPatPassed, s.patRejected, s.pendingFinalPat, s.sameDayCompleted,
                            `${s.sameDayRate}%`, `${s.finalPatConversionRate}%`]);
                    }
                    pr = row.region;
                    psd.push([row.region, '', '', '', '', '', '', '', '', '', '']);
                }
                psd.push([row.province, row.rtom, row.monthInstallClosed, row.completed, row.opmcPatPassed,
                    row.finalPatPassed, row.patRejected, row.pendingFinalPat, row.sameDayCompleted,
                    `${row.sameDayRate}%`, `${row.finalPatConversionRate}%`]);
            });
            if (pr && monthlyPipelineSummaries[pr]) {
                const s = monthlyPipelineSummaries[pr];
                psd.push(['', `${pr} TOTAL`, s.monthInstallClosed, s.completed, s.opmcPatPassed,
                    s.finalPatPassed, s.patRejected, s.pendingFinalPat, s.sameDayCompleted,
                    `${s.sameDayRate}%`, `${s.finalPatConversionRate}%`]);
            }
            if (monthlyPipelineGrandTotal) {
                psd.push(['GRAND TOTAL', '',
                    monthlyPipelineGrandTotal.monthInstallClosed, monthlyPipelineGrandTotal.completed,
                    monthlyPipelineGrandTotal.opmcPatPassed, monthlyPipelineGrandTotal.finalPatPassed,
                    monthlyPipelineGrandTotal.patRejected, monthlyPipelineGrandTotal.pendingFinalPat,
                    monthlyPipelineGrandTotal.sameDayCompleted,
                    `${monthlyPipelineGrandTotal.sameDayRate}%`, `${monthlyPipelineGrandTotal.finalPatConversionRate}%`]);
            }
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(psd), 'Monthly Invoicing Pipeline');
        }

        XLSX.writeFile(wb, `Daily_Operational_Report_${selectedDate}.xlsx`);
    };

    // ── Copy Text ────────────────────────────────────────────────────────────

    const formatShareText = () => {
        if (!data || reportData.length === 0) return '';
        const dateStr = new Date(selectedDate).toLocaleDateString('en-GB');
        const blocks = reportData.map(row => [
            `FN Progress\t${dateStr}`,
            `RT : ${row.rtom}`,
            `C/F FY :\t${row.inHandMorning.total}`,
            `          NC :\t${row.inHandMorning.nc}`,
            `          RL :\t${row.inHandMorning.rl}`,
            `          DATA :\t${row.inHandMorning.data}`,
            ``,
            `SOD Receiving :\t${row.received.total}`,
            `          NC :\t${row.received.nc}`,
            `          RL :\t${row.received.rl}`,
            `          DATA :\t${row.received.data}`,
            `Total Inhand :\t${row.totalInHand}`,
            ``,
            `Total Completed :\t${row.completed.total}`,
            `          CR :\t${row.completed.create}`,
            `          CR-Recon :\t${row.completed.recon}`,
            `          CR-UP-SN :\t${row.completed.upgrade}`,
            `          CR-OR :\t${row.completed.or}`,
            `          ML :\t${row.completed.ml}`,
            `          Data :\t${row.completed.data}`,
            ``,
            `Install Closed within day :\t${row.installClosed.total}`,
            `          CR :\t${row.installClosed.create}`,
            `          CR-Recon :\t${row.installClosed.recon}`,
            `          CR-UP-SN :\t${row.installClosed.upgrade}`,
            `          CR-OR :\t${row.installClosed.or}`,
            `          ML :\t${row.installClosed.ml}`,
            `          Data :\t${row.installClosed.data}`,
            ``,
            `Same-Day Turnaround (Zero Backlog) :\t${row.sameDayCompleted || 0}`,
            `DW Usage :\t${row.material.dw}`,
            `Pole Usage :\t${row.material.pole56 + row.material.pole67 + row.material.pole80}`,
            `          5.6 :\t${row.material.pole56}`,
            `          6.7 :\t${row.material.pole67}`,
            `          8.0 :\t${row.material.pole80}`,
            ``,
            `Returned :\t${row.returned.total}`,
            `          NC :\t${row.returned.nc}`,
            `          RL :\t${row.returned.rl}`,
            `          DATA :\t${row.returned.data}`,
            ``,
            `Wired only within day :\t${row.wiredOnly.total}`,
            `          NC :\t${row.wiredOnly.nc}`,
            `          RL :\t${row.wiredOnly.rl}`,
            `          DATA :\t${row.wiredOnly.data}`,
            ``,
            `Delayed by CX :\t${row.delays.cxDelay || 0}`,
            `Balance C/F :\t${row.balance.total}`,
            ``,
            `Regular Team Count :\t${row.regularTeams}`,
            `Worked Team Count :\t${row.teamsWorked}`,
            `SODs inhand - STB shortage :\t${row.shortages.stb}`,
            `SODs inhand - ONT shortage :\t${row.shortages.ont}`,
        ].join('\n'));

        if (monthlyPipelineGrandTotal) {
            blocks.push([
                `========================================`,
                `MONTHLY 4-STAGE SOD LIFECYCLE PIPELINE (${dateStr})`,
                `========================================`,
                `1. Month Install Closed Base :\t${monthlyPipelineGrandTotal.monthInstallClosed}`,
                `2. System Completed :\t${monthlyPipelineGrandTotal.completed}`,
                `3. PAT OPMC Passed :\t${monthlyPipelineGrandTotal.opmcPatPassed}`,
                `4. Final PAT Passed (Invoicable) :\t${monthlyPipelineGrandTotal.finalPatPassed}`,
                `5. PAT Rejected :\t${monthlyPipelineGrandTotal.patRejected}`,
                `6. Pending Final PAT Backlog :\t${monthlyPipelineGrandTotal.pendingFinalPat}`,
                `7. Same-Day Turnaround :\t${monthlyPipelineGrandTotal.sameDayCompleted} (${monthlyPipelineGrandTotal.sameDayRate}%)`,
                `8. Final PAT Conversion Rate :\t${monthlyPipelineGrandTotal.finalPatConversionRate}%`,
                `========================================`
            ].join('\n'));
        }
        return blocks.join('\n\n----------------------------------------\n\n');
    };

    const handleCopyText = async () => {
        try { await navigator.clipboard.writeText(formatShareText()); } catch { /* ignore */ }
    };

    // ── KPI data ─────────────────────────────────────────────────────────────

    const sameDayPct = grandTotal && grandTotal.installClosed.total > 0
        ? Math.round(((grandTotal.sameDayCompleted || 0) / grandTotal.installClosed.total) * 100)
        : 0;

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'MANAGER', 'AREA_MANAGER', ...ROLE_GROUPS.SECTION_HEADS]}>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
                    <Header />

                    {/* ── Page Content ── */}
                    <div className="p-5 space-y-5 max-w-full w-full">

                        {/* ── Toolbar ── */}
                        <div className="bg-slate-900 rounded-2xl px-5 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl shadow-slate-900/20">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl shadow-lg">
                                    <BarChart3 className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h1 className="text-lg font-black text-white tracking-tight">Daily Operational Report</h1>
                                        {isSnapshot && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 border border-amber-400/40 rounded-full text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                                                <Camera className="w-2.5 h-2.5" /> Snapshot
                                            </span>
                                        )}
                                        {isToday && !isSnapshot && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 border border-emerald-400/40 rounded-full text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                                                <Activity className="w-2.5 h-2.5" /> Live
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-0.5">Regional performance & SOD lifecycle tracking</p>
                                </div>
                            </div>

                            <div className="flex items-center flex-wrap gap-2">
                                {/* Date Picker */}
                                <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 hover:border-slate-500 transition-colors">
                                    <CalendarIcon className="w-4 h-4 text-slate-400" />
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={e => setSelectedDate(e.target.value)}
                                        className="text-sm bg-transparent border-none focus:outline-none text-white [color-scheme:dark]"
                                    />
                                </div>

                                {/* Auto-refresh toggle (today only) */}
                                {isToday && (
                                    <button
                                        onClick={() => setAutoRefresh(p => !p)}
                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all duration-200
                                            ${autoRefresh
                                                ? 'bg-emerald-600 border-emerald-500 text-white'
                                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                    >
                                        <Zap className={`w-3 h-3 ${autoRefresh ? 'animate-pulse' : ''}`} />
                                        Auto
                                    </button>
                                )}

                                <Button
                                    onClick={fetchReport} disabled={loading}
                                    variant="outline" size="sm"
                                    className="gap-2 bg-slate-800 border-slate-700 text-white hover:bg-slate-700 hover:text-white"
                                >
                                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                    Refresh
                                </Button>

                                <Button
                                    onClick={handleExport}
                                    disabled={loading || !data}
                                    size="sm"
                                    className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white border-0"
                                    suppressHydrationWarning
                                >
                                    <Download className="w-4 h-4" /> Export
                                </Button>

                                <Button
                                    onClick={handleCopyText}
                                    disabled={loading || !data || reportData.length === 0}
                                    size="sm" variant="outline"
                                    className="gap-2 bg-slate-800 border-indigo-500/50 text-indigo-300 hover:bg-indigo-900/40 hover:text-indigo-200"
                                    suppressHydrationWarning
                                >
                                    <ClipboardCopy className="w-4 h-4" /> Copy Text
                                </Button>
                            </div>
                        </div>

                        {/* ── KPI Cards ── */}
                        {loading && !data ? (
                            <KpiSkeleton />
                        ) : grandTotal && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                                <KpiCard
                                    label="Morning In-Hand"
                                    value={grandTotal.inHandMorning.total}
                                    icon={<Clock className="w-4 h-4 text-white" />}
                                    gradient="bg-gradient-to-br from-blue-600 to-blue-800"
                                    iconBg="bg-blue-900/50"
                                />
                                <KpiCard
                                    label="Received Today"
                                    value={grandTotal.received.total}
                                    icon={<TrendingUp className="w-4 h-4 text-white" />}
                                    gradient="bg-gradient-to-br from-emerald-600 to-emerald-800"
                                    iconBg="bg-emerald-900/50"
                                />
                                <KpiCard
                                    label="Completed (PAT)"
                                    value={grandTotal.completed.total}
                                    icon={<CheckCircle2 className="w-4 h-4 text-white" />}
                                    gradient="bg-gradient-to-br from-green-600 to-green-800"
                                    iconBg="bg-green-900/50"
                                />
                                <KpiCard
                                    label="Install Closed"
                                    value={grandTotal.installClosed.total}
                                    icon={<CheckCircle2 className="w-4 h-4 text-white" />}
                                    gradient="bg-gradient-to-br from-sky-600 to-sky-800"
                                    iconBg="bg-sky-900/50"
                                />
                                <KpiCard
                                    label="Same-Day Done"
                                    value={grandTotal.sameDayCompleted || 0}
                                    badge={`${sameDayPct}% rate`}
                                    badgeColor="bg-indigo-900/60 text-indigo-300 border border-indigo-500/30"
                                    icon={<Zap className="w-4 h-4 text-white" />}
                                    gradient="bg-gradient-to-br from-indigo-600 to-indigo-800"
                                    iconBg="bg-indigo-900/50"
                                />
                                <KpiCard
                                    label="Pending Balance"
                                    value={grandTotal.balance.total}
                                    icon={<AlertCircle className="w-4 h-4 text-white" />}
                                    gradient="bg-gradient-to-br from-slate-600 to-slate-800"
                                    iconBg="bg-slate-900/50"
                                />
                            </div>
                        )}

                        {/* ── Main Operational Table ── */}
                        {loading && !data ? (
                            <TableSkeleton />
                        ) : (
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
                                    <div>
                                        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Operational Summary</h2>
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                            {new Date(selectedDate).toLocaleDateString('en-GB', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
                                            {' · '}{reportData.length} RTOMs
                                        </p>
                                    </div>
                                    {loading && <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />}
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-[11px] border-collapse">
                                        <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                                            <tr style={{ backgroundColor: '#f1f5f9' }}>
                                                <th rowSpan={2} className="px-2 py-2.5 text-left w-24 border-r border-slate-300 font-black text-[11px] uppercase tracking-wider" style={{ backgroundColor: '#e2e8f0', color: '#0f172a' }}>Province</th>
                                                <th rowSpan={2} className="px-2 py-2.5 text-center w-20 border-r border-slate-300 font-black text-[11px] uppercase tracking-wider" style={{ backgroundColor: '#e2e8f0', color: '#0f172a' }}>RTOM</th>
                                                <th rowSpan={2} className="px-1 py-2 text-center w-14 border-r border-slate-300 font-black text-[10px] leading-tight" style={{ backgroundColor: '#dbeafe', color: '#1e3a8a' }}>
                                                    In Hand<br />AM
                                                </th>
                                                <th rowSpan={2} className="px-1 py-2 text-center w-14 border-r border-slate-300 font-black text-[10px] leading-tight" style={{ backgroundColor: '#d1fae5', color: '#064e3b' }}>
                                                    Recv<br />Today
                                                </th>
                                                <th rowSpan={2} className="px-1 py-2 text-center w-14 border-r border-slate-300 font-black text-[10px] leading-tight" style={{ backgroundColor: '#e0e7ff', color: '#312e81' }}>
                                                    Total<br />Hand
                                                </th>

                                                {/* Completed group */}
                                                <th colSpan={9} className="px-2 py-2 text-center text-[11px] font-black uppercase tracking-wider border-l-2 border-l-emerald-600 border-b border-emerald-300" style={{ backgroundColor: '#a7f3d0', color: '#064e3b' }}>
                                                    Completed Orders
                                                </th>

                                                {/* Install Closed group */}
                                                <th colSpan={9} className="px-2 py-2 text-center text-[11px] font-black uppercase tracking-wider border-l-2 border-l-sky-600 border-b border-sky-300" style={{ backgroundColor: '#bae6fd', color: '#0c4a6e' }}>
                                                    Install Closed
                                                </th>

                                                <th rowSpan={2} className="px-1 py-2 text-center w-12 font-black text-[10px]" style={{ backgroundColor: '#fef3c7', color: '#78350f' }}>DW</th>
                                                <th colSpan={3} className="px-1 py-1.5 text-center font-black text-[10px] border-b border-cyan-300" style={{ backgroundColor: '#cffafe', color: '#155e75' }}>Poles</th>
                                                <th rowSpan={2} className="px-1 py-2 text-center w-12 font-black text-[10px] leading-tight" style={{ backgroundColor: '#ffe4e6', color: '#881337' }}>
                                                    Ret<br />SOD
                                                </th>
                                                <th rowSpan={2} className="px-1 py-2 text-center w-12 font-black text-[10px] leading-tight" style={{ backgroundColor: '#f3e8ff', color: '#581c87' }}>
                                                    Wired<br />Only
                                                </th>
                                                <th rowSpan={2} className="px-2 py-2 text-center w-14 font-black text-[10px] uppercase" style={{ backgroundColor: '#cbd5e1', color: '#0f172a' }}>BAL</th>
                                            </tr>
                                            <tr className="text-[10px] font-black tracking-tight" style={{ backgroundColor: '#f1f5f9' }}>
                                                <BreakdownHeadCells tone="green" />
                                                <BreakdownHeadCells tone="blue" />
                                                <th className="px-0.5 py-1.5 w-7 font-black" style={{ backgroundColor: '#a5f3fc', color: '#083344' }}>5.6</th>
                                                <th className="px-0.5 py-1.5 w-7 font-black" style={{ backgroundColor: '#a5f3fc', color: '#083344' }}>6.7</th>
                                                <th className="px-0.5 py-1.5 w-7 font-black" style={{ backgroundColor: '#a5f3fc', color: '#083344' }}>8.0</th>
                                            </tr>
                                        </thead>

                                        <tbody className="bg-white">
                                            {reportData.length === 0 ? (
                                                <tr>
                                                    <td colSpan={30} className="text-center py-16 text-slate-400">
                                                        {loading ? (
                                                            <div className="flex flex-col items-center gap-3">
                                                                <RefreshCw className="w-8 h-8 animate-spin text-slate-300" />
                                                                <span className="text-sm">Loading report data…</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-2">
                                                                <BarChart3 className="w-10 h-10 text-slate-200" />
                                                                <span className="text-sm">No data available for selected date</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ) : (() => {
                                                let currentRegion = '';
                                                const rows: React.ReactNode[] = [];

                                                reportData.forEach((row, idx) => {
                                                    if (currentRegion !== row.region) {
                                                        // Emit region summary before switching
                                                        if (currentRegion && summaries[currentRegion]) {
                                                            rows.push(<SummaryRow key={`sum-${currentRegion}`} label={`${currentRegion} TOTAL`} row={summaries[currentRegion]} onOpenModal={handleOpenOrdersModal} />);
                                                        }
                                                        currentRegion = row.region;
                                                        // Region header band
                                                        rows.push(
                                                            <tr key={`hdr-${row.region}`}>
                                                                <td colSpan={30} className="px-4 py-1.5 bg-gradient-to-r from-slate-800 to-slate-700 text-[10px] font-black text-slate-200 tracking-widest uppercase">
                                                                    {row.region} REGION
                                                                </td>
                                                            </tr>
                                                        );
                                                    }

                                                    rows.push(
                                                        <tr key={`${idx}-${row.rtom}`} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors group">
                                                            <td className="border-r border-slate-100 px-2 py-1.5 text-slate-500 text-[10px] uppercase tracking-wide">{row.province}</td>
                                                            <td className="border-r border-slate-100 px-2 py-1.5 text-center font-black text-slate-900">
                                                                <button
                                                                    onClick={() => handleOpenOrdersModal(row.rtom, 'ALL')}
                                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50 font-black transition-all cursor-pointer group/btn"
                                                                    title="Click to view SOD & Voice Numbers"
                                                                >
                                                                    <span>{row.rtom}</span>
                                                                    <Eye className="w-3 h-3 text-indigo-600 opacity-60 group-hover/btn:opacity-100" />
                                                                </button>
                                                            </td>

                                                            <td onClick={() => handleOpenOrdersModal(row.rtom, 'IN_HAND')} className="border-r border-slate-100 px-1 py-1.5 text-center bg-blue-50/50 text-blue-800 font-bold cursor-pointer hover:bg-blue-100 transition-colors" title="Click to view Morning In-Hand SODs">{row.inHandMorning.total}</td>
                                                            <td onClick={() => handleOpenOrdersModal(row.rtom, 'RECEIVED')} className="border-r border-slate-100 px-1 py-1.5 text-center bg-emerald-50/50 text-emerald-800 font-bold cursor-pointer hover:bg-emerald-100 transition-colors" title="Click to view Received SODs">{row.received.total}</td>
                                                            <td onClick={() => handleOpenOrdersModal(row.rtom, 'ALL')} className="border-r border-slate-100 px-1 py-1.5 text-center bg-indigo-50 font-black text-indigo-900 cursor-pointer hover:bg-indigo-100 transition-colors" title="Click to view Total In-Hand SODs">{row.totalInHand}</td>

                                                            <BreakdownCells metrics={row.completed} tone="green" onOpenModal={(cat) => handleOpenOrdersModal(row.rtom, cat)} />
                                                            <BreakdownCells metrics={row.installClosed} tone="blue" onOpenModal={(cat) => handleOpenOrdersModal(row.rtom, cat)} />

                                                            <td className="border-r border-slate-100 px-1 py-1.5 text-center bg-amber-50/40 text-amber-900">{row.material.dw.toFixed(1)}</td>
                                                            <td className="border-r border-slate-100 px-1 py-1.5 text-center bg-cyan-50/40 text-cyan-900">{row.material.pole56}</td>
                                                            <td className="border-r border-slate-100 px-1 py-1.5 text-center bg-cyan-50/40 text-cyan-900">{row.material.pole67}</td>
                                                            <td className="border-r border-slate-100 px-1 py-1.5 text-center bg-cyan-50/40 text-cyan-900">{row.material.pole80}</td>
                                                            <td onClick={() => handleOpenOrdersModal(row.rtom, 'RETURNED')} className="border-r border-slate-100 px-1 py-1.5 text-center bg-rose-50/40 text-rose-900 cursor-pointer hover:bg-rose-100 transition-colors" title="Click to view Returned SODs">{row.returned.total}</td>
                                                            <td onClick={() => handleOpenOrdersModal(row.rtom, 'WIRED_ONLY')} className="border-r border-slate-100 px-1 py-1.5 text-center bg-purple-50/40 text-purple-900 cursor-pointer hover:bg-purple-100 transition-colors" title="Click to view Wired Only SODs">{row.wiredOnly.total}</td>
                                                            <td onClick={() => handleOpenOrdersModal(row.rtom, 'BALANCE')} className="px-2 py-1.5 text-center bg-slate-100 font-black text-slate-900 group-hover:bg-slate-200/70 transition-colors cursor-pointer hover:bg-slate-300" title="Click to view Balance SODs">{row.balance.total}</td>
                                                        </tr>
                                                    );
                                                });

                                                // Last region summary
                                                if (currentRegion && summaries[currentRegion]) {
                                                    rows.push(<SummaryRow key={`sum-${currentRegion}`} label={`${currentRegion} TOTAL`} row={summaries[currentRegion]} onOpenModal={handleOpenOrdersModal} />);
                                                }
                                                // Grand total
                                                if (grandTotal) {
                                                    rows.push(<SummaryRow key="grand-total" label="GRAND TOTAL" row={grandTotal} isGrandTotal onOpenModal={handleOpenOrdersModal} />);
                                                }

                                                return rows;
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* ── Monthly Pipeline Section ── */}
                        {monthlyPipeline.length > 0 && (
                            <div className="rounded-2xl overflow-hidden shadow-xl shadow-indigo-900/20">
                                {/* Header */}
                                <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 px-5 py-5 border border-indigo-900/40">
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                                    4-Stage Lifecycle Funnel
                                                </span>
                                                <span className="text-[11px] text-slate-400">Month-to-Date Telecom Invoicing Control</span>
                                            </div>
                                            <h2 className="text-base font-black text-white tracking-wide">
                                                Monthly Invoicing &amp; Lifecycle Completion Pipeline
                                            </h2>
                                            <p className="text-[11px] text-slate-400 mt-0.5 max-w-2xl">
                                                <span className="text-blue-300 font-semibold">1. Install Closed</span>
                                                {' → '}
                                                <span className="text-sky-300 font-semibold">2. Completed</span>
                                                {' → '}
                                                <span className="text-emerald-300 font-semibold">3. OPMC PAT</span>
                                                {' → '}
                                                <span className="text-teal-300 font-bold">4. Final PAT (Invoicable)</span>
                                            </p>
                                        </div>

                                        {monthlyPipelineGrandTotal && (
                                            <div className="flex items-center gap-4 bg-white/5 rounded-xl px-4 py-3 border border-white/10 shrink-0">
                                                <div className="text-right">
                                                    <div className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">Invoicing Rate</div>
                                                    <div className="text-2xl font-black text-emerald-400">{monthlyPipelineGrandTotal.finalPatConversionRate}%</div>
                                                </div>
                                                <div className="h-8 w-px bg-white/10" />
                                                <div className="text-right">
                                                    <div className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">Pending PAT</div>
                                                    <div className="text-2xl font-black text-amber-300">{monthlyPipelineGrandTotal.pendingFinalPat}</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Funnel Progress Bars */}
                                    {monthlyPipelineGrandTotal && (
                                        <PipelineFunnelBar gt={monthlyPipelineGrandTotal} />
                                    )}

                                    {/* Stage metric cards */}
                                    {monthlyPipelineGrandTotal && (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-3 border-t border-white/10">
                                            {[
                                                { stage: '1', label: 'Install Closed',     value: monthlyPipelineGrandTotal.monthInstallClosed, color: 'text-blue-300',    border: 'border-blue-500/20' },
                                                { stage: '2', label: 'System Completed',   value: monthlyPipelineGrandTotal.completed,           color: 'text-sky-300',     border: 'border-sky-500/20' },
                                                { stage: '3', label: 'PAT OPMC Passed',    value: monthlyPipelineGrandTotal.opmcPatPassed,       color: 'text-emerald-300', border: 'border-emerald-500/20' },
                                                { stage: '4', label: 'Final PAT Passed',   value: monthlyPipelineGrandTotal.finalPatPassed,      color: 'text-teal-300',    border: 'border-teal-400/40', highlight: true },
                                                { stage: '!', label: 'Pending Final PAT',  value: monthlyPipelineGrandTotal.pendingFinalPat,     color: 'text-amber-300',   border: 'border-amber-500/20' },
                                                { stage: '⚡', label: 'Same-Day Turnaround', value: `${monthlyPipelineGrandTotal.sameDayCompleted} (${monthlyPipelineGrandTotal.sameDayRate}%)`, color: 'text-indigo-300', border: 'border-indigo-500/20' },
                                            ].map(({ stage, label, value, color, border, highlight }) => (
                                                <div key={stage} className={`bg-white/5 rounded-xl p-3 border ${border} ${highlight ? 'bg-emerald-500/8' : ''}`}>
                                                    <div className={`text-[9px] font-bold uppercase tracking-widest ${color} mb-1`}>{label}</div>
                                                    <div className={`text-xl font-black ${color}`}>{value}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Pipeline Detail Table */}
                                <div className="overflow-x-auto">
                                  <div className="max-h-[480px] overflow-y-auto">
                                    <table className="w-full text-[11px] border-collapse">
                                        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                            <tr className="border-b border-indigo-950">
                                                <th className="px-2.5 py-3 text-left w-24 border-r border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-100" style={{ backgroundColor: '#090d16' }}>Province</th>
                                                <th className="px-2.5 py-3 text-center w-20 border-r border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-100" style={{ backgroundColor: '#090d16' }}>RTOM</th>
                                                <th className="px-2.5 py-3 text-center w-28 text-[10px] font-black leading-tight border-r border-blue-900 text-blue-200" style={{ backgroundColor: '#1e3a8a' }}>1. Month<br />Install Closed</th>
                                                <th className="px-2.5 py-3 text-center w-24 text-[10px] font-black leading-tight border-r border-sky-900 text-sky-200" style={{ backgroundColor: '#075985' }}>2. System<br />Completed</th>
                                                <th className="px-2.5 py-3 text-center w-24 text-[10px] font-black leading-tight border-r border-emerald-900 text-emerald-200" style={{ backgroundColor: '#065f46' }}>3. PAT OPMC<br />Passed</th>
                                                <th className="px-2.5 py-3 text-center w-28 text-[10px] font-black leading-tight border-r border-teal-900 text-teal-200" style={{ backgroundColor: '#0f766e' }}>4. Final PAT<br />(Invoicable)</th>
                                                <th className="px-2.5 py-3 text-center w-20 text-[10px] font-black leading-tight border-r border-rose-950 text-rose-200" style={{ backgroundColor: '#881337' }}>PAT<br />Rejected</th>
                                                <th className="px-2.5 py-3 text-center w-28 text-[10px] font-black leading-tight border-r border-amber-950 text-amber-200" style={{ backgroundColor: '#78350f' }}>Pending<br />Final PAT</th>
                                                <th className="px-2.5 py-3 text-center w-24 text-[10px] font-black leading-tight border-r border-indigo-900 text-indigo-200" style={{ backgroundColor: '#3730a3' }}>Same-Day<br />Done</th>
                                                <th className="px-2.5 py-3 text-center w-20 text-[10px] font-black leading-tight border-r border-indigo-950 text-indigo-200" style={{ backgroundColor: '#1e1b4b' }}>Same-Day<br />Rate %</th>
                                                <th className="px-2.5 py-3 text-center w-24 text-[10px] font-black leading-tight text-emerald-300" style={{ backgroundColor: '#0f172a' }}>Final Invoicing<br />Rate %</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white">
                                            {(() => {
                                                let currentRegion = '';
                                                const rows: React.ReactNode[] = [];

                                                monthlyPipeline.forEach((row, idx) => {
                                                    if (currentRegion !== row.region) {
                                                        if (currentRegion && monthlyPipelineSummaries[currentRegion]) {
                                                            const s = monthlyPipelineSummaries[currentRegion];
                                                            rows.push(
                                                                <tr key={`ps-${currentRegion}`} className="bg-indigo-800/80 text-white font-bold border-b border-indigo-700">
                                                                    <td colSpan={2} className="border border-slate-600/30 px-2 py-1.5 text-right uppercase tracking-wider text-xs">{currentRegion} TOTAL</td>
                                                                    <td className="border border-slate-600/30 px-1 py-1.5 text-center text-blue-200">{s.monthInstallClosed}</td>
                                                                    <td className="border border-slate-600/30 px-1 py-1.5 text-center text-sky-200">{s.completed}</td>
                                                                    <td className="border border-slate-600/30 px-1 py-1.5 text-center text-emerald-200">{s.opmcPatPassed}</td>
                                                                    <td className="border border-slate-600/30 px-1 py-1.5 text-center text-teal-200 font-black">{s.finalPatPassed}</td>
                                                                    <td className="border border-slate-600/30 px-1 py-1.5 text-center text-rose-300">{s.patRejected}</td>
                                                                    <td className={`border border-slate-600/30 px-1 py-1.5 text-center font-black ${s.pendingFinalPat > 0 ? 'text-amber-300' : 'text-slate-300'}`}>{s.pendingFinalPat}</td>
                                                                    <td className="border border-slate-600/30 px-1 py-1.5 text-center text-indigo-200" title={`Intake: ${s.intakeSameDayCompleted} | Backlog: ${s.backlogSameDayCompleted}`}>
                                                                        <div>{s.sameDayCompleted}</div>
                                                                        <div className="text-[9px] opacity-70">{s.intakeSameDayCompleted}⚡/{s.backlogSameDayCompleted}🔄</div>
                                                                    </td>
                                                                    <td className="border border-slate-600/30 px-1 py-1.5 text-center text-indigo-200">{s.sameDayRate}%</td>
                                                                    <td className="border border-slate-600/30 px-1 py-1.5 text-center text-emerald-300 font-black">{s.finalPatConversionRate}%</td>
                                                                </tr>
                                                            );
                                                        }
                                                        currentRegion = row.region;
                                                        rows.push(
                                                            <tr key={`ph-${row.region}`}>
                                                                <td colSpan={11} className="px-4 py-1.5 bg-gradient-to-r from-slate-800 to-slate-700 text-[10px] font-black text-slate-200 tracking-widest uppercase">
                                                                    {row.region} REGION
                                                                </td>
                                                            </tr>
                                                        );
                                                    }

                                                    rows.push(
                                                        <tr key={`p-${idx}-${row.rtom}`} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                                                            <td className="border-r border-slate-100 px-2 py-1.5 text-slate-500 text-[10px] uppercase">{row.province}</td>
                                                            <td className="border-r border-slate-100 px-2 py-1.5 text-center font-black text-slate-900">{row.rtom}</td>
                                                            <td className="border-r border-slate-100 px-1 py-1.5 text-center font-bold text-blue-700 bg-blue-50/40">{row.monthInstallClosed}</td>
                                                            <td className="border-r border-slate-100 px-1 py-1.5 text-center font-bold text-sky-700 bg-sky-50/40">{row.completed}</td>
                                                            <td className="border-r border-slate-100 px-1 py-1.5 text-center font-bold text-emerald-700 bg-emerald-50/40">{row.opmcPatPassed}</td>
                                                            <td className="border-r border-slate-100 px-1 py-1.5 text-center font-black text-teal-800 bg-teal-50/50">{row.finalPatPassed}</td>
                                                            <td className="border-r border-slate-100 px-1 py-1.5 text-center text-rose-700 bg-rose-50/30">{row.patRejected > 0 ? row.patRejected : '—'}</td>
                                                            <td className={`border-r border-slate-100 px-1 py-1.5 text-center font-bold ${row.pendingFinalPat > 0 ? 'bg-amber-50 text-amber-900' : 'text-slate-400'}`}>
                                                                {row.pendingFinalPat > 0 ? (
                                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-black">
                                                                        {row.pendingFinalPat}
                                                                    </span>
                                                                ) : 0}
                                                            </td>
                                                            <td className="border-r border-slate-100 px-1 py-1.5 text-center font-bold text-indigo-700 bg-indigo-50/30" title={`Intake: ${row.intakeSameDayCompleted} | Backlog: ${row.backlogSameDayCompleted}`}>
                                                                <div>{row.sameDayCompleted}</div>
                                                                {(row.intakeSameDayCompleted > 0 || row.backlogSameDayCompleted > 0) && (
                                                                    <div className="text-[9px] text-slate-400">{row.intakeSameDayCompleted}⚡/{row.backlogSameDayCompleted}🔄</div>
                                                                )}
                                                            </td>
                                                            <td className="border-r border-slate-100 px-1 py-1.5 text-center font-semibold text-indigo-800">{row.sameDayRate}%</td>
                                                            <td className="px-1 py-1.5 text-center font-bold">
                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black ${
                                                                    row.finalPatConversionRate >= 80 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                                                    row.finalPatConversionRate >= 50 ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                                                    'bg-amber-100 text-amber-800 border border-amber-200'
                                                                }`}>
                                                                    {row.finalPatConversionRate}%
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                });

                                                // Last region summary
                                                if (currentRegion && monthlyPipelineSummaries[currentRegion]) {
                                                    const s = monthlyPipelineSummaries[currentRegion];
                                                    rows.push(
                                                        <tr key={`ps-${currentRegion}-last`} className="bg-indigo-800/80 text-white font-bold border-b border-indigo-700">
                                                            <td colSpan={2} className="border border-slate-600/30 px-2 py-1.5 text-right uppercase tracking-wider text-xs">{currentRegion} TOTAL</td>
                                                            <td className="border border-slate-600/30 px-1 py-1.5 text-center text-blue-200">{s.monthInstallClosed}</td>
                                                            <td className="border border-slate-600/30 px-1 py-1.5 text-center text-sky-200">{s.completed}</td>
                                                            <td className="border border-slate-600/30 px-1 py-1.5 text-center text-emerald-200">{s.opmcPatPassed}</td>
                                                            <td className="border border-slate-600/30 px-1 py-1.5 text-center text-teal-200 font-black">{s.finalPatPassed}</td>
                                                            <td className="border border-slate-600/30 px-1 py-1.5 text-center text-rose-300">{s.patRejected}</td>
                                                            <td className={`border border-slate-600/30 px-1 py-1.5 text-center font-black ${s.pendingFinalPat > 0 ? 'text-amber-300' : 'text-slate-300'}`}>{s.pendingFinalPat}</td>
                                                            <td className="border border-slate-600/30 px-1 py-1.5 text-center text-indigo-200" title={`Intake: ${s.intakeSameDayCompleted} | Backlog: ${s.backlogSameDayCompleted}`}>
                                                                <div>{s.sameDayCompleted}</div>
                                                                <div className="text-[9px] opacity-70">{s.intakeSameDayCompleted}⚡/{s.backlogSameDayCompleted}🔄</div>
                                                            </td>
                                                            <td className="border border-slate-600/30 px-1 py-1.5 text-center text-indigo-200">{s.sameDayRate}%</td>
                                                            <td className="border border-slate-600/30 px-1 py-1.5 text-center text-emerald-300 font-black">{s.finalPatConversionRate}%</td>
                                                        </tr>
                                                    );
                                                }

                                                // Grand total
                                                if (monthlyPipelineGrandTotal) {
                                                    rows.push(
                                                        <tr key="pgt" className="bg-slate-900 text-white font-bold border-t-2 border-slate-700">
                                                            <td colSpan={2} className="border border-slate-700 px-2 py-2 text-right uppercase tracking-wider text-slate-200">GRAND TOTAL</td>
                                                            <td className="border border-slate-700 px-1 py-2 text-center font-black text-blue-300">{monthlyPipelineGrandTotal.monthInstallClosed}</td>
                                                            <td className="border border-slate-700 px-1 py-2 text-center font-black text-sky-300">{monthlyPipelineGrandTotal.completed}</td>
                                                            <td className="border border-slate-700 px-1 py-2 text-center font-black text-emerald-300">{monthlyPipelineGrandTotal.opmcPatPassed}</td>
                                                            <td className="border border-slate-700 px-1 py-2 text-center font-black text-teal-300">{monthlyPipelineGrandTotal.finalPatPassed}</td>
                                                            <td className="border border-slate-700 px-1 py-2 text-center font-black text-rose-300">{monthlyPipelineGrandTotal.patRejected}</td>
                                                            <td className="border border-slate-700 px-1 py-2 text-center font-black text-amber-300">{monthlyPipelineGrandTotal.pendingFinalPat}</td>
                                                            <td className="border border-slate-700 px-1 py-2 text-center font-black text-indigo-300" title={`Intake: ${monthlyPipelineGrandTotal.intakeSameDayCompleted} | Backlog: ${monthlyPipelineGrandTotal.backlogSameDayCompleted}`}>
                                                                <div>{monthlyPipelineGrandTotal.sameDayCompleted}</div>
                                                                <div className="text-[9px] text-indigo-400">{monthlyPipelineGrandTotal.intakeSameDayCompleted}⚡/{monthlyPipelineGrandTotal.backlogSameDayCompleted}🔄</div>
                                                            </td>
                                                            <td className="border border-slate-700 px-1 py-2 text-center font-black text-indigo-300">{monthlyPipelineGrandTotal.sameDayRate}%</td>
                                                            <td className="border border-slate-700 px-1 py-2 text-center font-black text-emerald-400 bg-slate-800">{monthlyPipelineGrandTotal.finalPatConversionRate}%</td>
                                                        </tr>
                                                    );
                                                }

                                                return rows;
                                            })()}
                                        </tbody>
                                    </table>
                                  </div>
                                </div>
                            </div>
                        )}

                        {/* ── NC/RL/DATA Breakdown (collapsible) ── */}
                        {reportData.length > 0 && (
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <button
                                    onClick={() => setShowBreakdown(p => !p)}
                                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-1.5 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
                                            <BarChart3 className="w-3.5 h-3.5 text-slate-600" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-bold text-slate-800 uppercase tracking-wide">NC / RL / DATA Breakdown</p>
                                            <p className="text-[11px] text-slate-400">Category split per RTOM for the FN Progress report</p>
                                        </div>
                                    </div>
                                    {showBreakdown ? (
                                        <ChevronUp className="w-4 h-4 text-slate-400" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-slate-400" />
                                    )}
                                </button>

                                {showBreakdown && (
                                    <div className="border-t border-slate-100 overflow-x-auto max-h-[420px] overflow-y-auto">
                                        <table className="w-full text-[11px] border-collapse">
                                            <thead className="bg-slate-900 text-white sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-2 py-2.5 text-left w-24 border-r border-slate-700 text-[10px] font-bold uppercase tracking-wide">RTOM</th>
                                                    <th className="px-2 py-2.5 text-left w-32 border-r border-slate-700 text-[10px] font-bold uppercase tracking-wide">Metric</th>
                                                    <th className="px-2 py-2.5 text-center w-16 border-r border-slate-700 text-[10px] font-bold uppercase">NC</th>
                                                    <th className="px-2 py-2.5 text-center w-16 border-r border-slate-700 text-[10px] font-bold uppercase">RL</th>
                                                    <th className="px-2 py-2.5 text-center w-16 border-r border-slate-700 text-[10px] font-bold uppercase">DATA</th>
                                                    <th className="px-2 py-2.5 text-center w-16 bg-slate-700 text-[10px] font-bold uppercase">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white">
                                                {reportData.map(row => {
                                                    const metrics: { label: string; m: { nc: number; rl: number; data: number; total: number } }[] = [
                                                        { label: 'C/F (In Hand AM)',  m: row.inHandMorning },
                                                        { label: 'SOD Receiving',     m: row.received },
                                                        { label: 'Returned',          m: row.returned },
                                                        { label: 'Wired Only',        m: row.wiredOnly },
                                                        { label: 'Balance C/F',       m: row.balance },
                                                    ];
                                                    return metrics.map(({ label, m }, mi) => (
                                                        <tr key={`${row.rtom}-${label}`} className={`border-b border-slate-100 hover:bg-blue-50/30 transition-colors ${mi === 0 ? 'border-t-2 border-t-slate-200' : ''}`}>
                                                            {mi === 0 && (
                                                                <td rowSpan={5} className="border-r border-slate-200 px-2 py-1 text-center font-black text-slate-900 bg-slate-50/80 align-middle">
                                                                    {row.rtom}
                                                                </td>
                                                            )}
                                                            <td className="border-r border-slate-100 px-2 py-1.5 text-slate-500">{label}</td>
                                                            <td className="border-r border-slate-100 px-2 py-1.5 text-center text-slate-800">{m.nc}</td>
                                                            <td className="border-r border-slate-100 px-2 py-1.5 text-center text-slate-800">{m.rl}</td>
                                                            <td className="border-r border-slate-100 px-2 py-1.5 text-center text-slate-800">{m.data}</td>
                                                            <td className="px-2 py-1.5 text-center font-bold text-slate-900 bg-slate-100/60">{m.total}</td>
                                                        </tr>
                                                    ));
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </main>
            </div>

            {/* RTOM Detailed Service Orders & Voice Numbers Modal */}
            <DailyOperationalOrdersModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                rtom={modalRtom}
                date={selectedDate}
                initialCategory={modalCategory}
            />
        </RoleGuard>
    );
}
