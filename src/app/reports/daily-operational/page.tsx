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
    ChevronDown, ChevronUp, Activity, BarChart3, Camera
} from "lucide-react";
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
        groupBg:          '#022c22',
        headSubBg:        '#064e3b',
        headSubColor:     '#ffffff',
        headSubTotalBg:   '#047857',
        headSubTotalColor:'#ffffff',
        edge:             'border-l-2 border-l-emerald-400',
        bucket:           'bg-emerald-50 text-emerald-950 font-medium',
        subtotal:         'bg-emerald-100 font-bold text-emerald-950 border-x border-emerald-200',
        total:            'bg-emerald-200 font-black text-emerald-950 border-x border-emerald-300',
        sumBucket:        'bg-emerald-900 text-emerald-100 font-bold border-r border-emerald-800/60',
        sumSubtotal:      'bg-emerald-700 text-white font-black border-r border-emerald-600',
        sumTotal:         'bg-emerald-500 text-white font-black border-r border-emerald-400',
    },
    blue: {
        groupBg:          '#0c4a6e',
        headSubBg:        '#0369a1',
        headSubColor:     '#ffffff',
        headSubTotalBg:   '#0284c7',
        headSubTotalColor:'#ffffff',
        edge:             'border-l-2 border-l-sky-400',
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

function BreakdownCells({ metrics, tone, summary = false }: {
    metrics: CompletedMetrics; tone: BreakdownTone; summary?: boolean;
}) {
    const s = BREAKDOWN_STYLE[tone];
    return (
        <>
            {BREAKDOWN_COLUMNS.map(({ key, kind }, i) => (
                <td
                    key={key}
                    className={`border border-slate-200/80 px-1 py-1 text-center text-[11px]
                        ${breakdownFill(tone, kind, summary)}
                        ${i === 0 ? s.edge : ''}`}
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

function SummaryRow({ label, row, isGrandTotal = false }: {
    label: string; row: ReportRowData; isGrandTotal?: boolean;
}) {
    const base = isGrandTotal
        ? 'bg-slate-900 text-white'
        : 'bg-indigo-800/80 text-white';

    return (
        <tr className={`${base} font-bold`}>
            <td colSpan={2} className="border border-slate-600/50 px-3 py-2 text-right uppercase tracking-wider text-sm">
                {label}
            </td>
            <td className="border border-slate-600/50 px-1 py-1.5 text-center">{row.inHandMorning.total}</td>
            <td className="border border-slate-600/50 px-1 py-1.5 text-center">{row.received.total}</td>
            <td className="border border-slate-600/50 px-1 py-1.5 text-center font-black">{row.totalInHand}</td>
            <BreakdownCells metrics={row.completed} tone="green" summary />
            <BreakdownCells metrics={row.installClosed} tone="blue" summary />
            <td className="border border-slate-600/50 px-1 py-1.5 text-center">{row.material.dw.toFixed(1)}</td>
            <td className="border border-slate-600/50 px-1 py-1.5 text-center">{row.material.pole56}</td>
            <td className="border border-slate-600/50 px-1 py-1.5 text-center">{row.material.pole67}</td>
            <td className="border border-slate-600/50 px-1 py-1.5 text-center">{row.material.pole80}</td>
            <td className="border border-slate-600/50 px-1 py-1.5 text-center">{row.returned.total}</td>
            <td className="border border-slate-600/50 px-1 py-1.5 text-center">{row.wiredOnly.total}</td>
            <td className={`border border-slate-600/50 px-2 py-1.5 text-center font-black ${isGrandTotal ? 'bg-slate-700 text-white' : 'bg-indigo-900/60'}`}>
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

    const reportData = data?.reportData ?? [];
    const monthlyPipeline = data?.monthlyPipeline ?? [];
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
                                            <tr style={{ backgroundColor: '#0f172a' }}>
                                                <th rowSpan={2} className="px-2 py-2.5 text-left w-24 border-r border-slate-700 font-black text-[11px] uppercase tracking-wider text-slate-100" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>Province</th>
                                                <th rowSpan={2} className="px-2 py-2.5 text-center w-20 border-r border-slate-700 font-black text-[11px] uppercase tracking-wider text-slate-100" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>RTOM</th>
                                                <th rowSpan={2} className="px-1 py-2 text-center w-14 border-r border-slate-700 font-black text-[10px] leading-tight text-blue-200" style={{ backgroundColor: '#1e3a8a', color: '#dbeafe' }}>
                                                    In Hand<br />AM
                                                </th>
                                                <th rowSpan={2} className="px-1 py-2 text-center w-14 border-r border-slate-700 font-black text-[10px] leading-tight text-emerald-200" style={{ backgroundColor: '#064e3b', color: '#d1fae5' }}>
                                                    Recv<br />Today
                                                </th>
                                                <th rowSpan={2} className="px-1 py-2 text-center w-14 border-r border-slate-700 font-black text-[10px] leading-tight text-indigo-200" style={{ backgroundColor: '#312e81', color: '#e0e7ff' }}>
                                                    Total<br />Hand
                                                </th>

                                                {/* Completed group */}
                                                <th colSpan={9} className="px-2 py-2 text-center text-emerald-100 text-[11px] font-black uppercase tracking-wider border-l-2 border-l-emerald-400 border-b border-emerald-700" style={{ backgroundColor: '#065f46', color: '#ecfdf5' }}>
                                                    Completed Orders
                                                </th>

                                                {/* Install Closed group */}
                                                <th colSpan={9} className="px-2 py-2 text-center text-sky-100 text-[11px] font-black uppercase tracking-wider border-l-2 border-l-sky-400 border-b border-sky-700" style={{ backgroundColor: '#075985', color: '#f0f9ff' }}>
                                                    Install Closed
                                                </th>

                                                <th rowSpan={2} className="px-1 py-2 text-center w-12 font-black text-[10px]" style={{ backgroundColor: '#78350f', color: '#fef3c7' }}>DW</th>
                                                <th colSpan={3} className="px-1 py-1.5 text-center font-black text-[10px] border-b border-cyan-800" style={{ backgroundColor: '#155e75', color: '#cffafe' }}>Poles</th>
                                                <th rowSpan={2} className="px-1 py-2 text-center w-12 font-black text-[10px] leading-tight" style={{ backgroundColor: '#881337', color: '#ffe4e6' }}>
                                                    Ret<br />SOD
                                                </th>
                                                <th rowSpan={2} className="px-1 py-2 text-center w-12 font-black text-[10px] leading-tight" style={{ backgroundColor: '#581c87', color: '#f3e8ff' }}>
                                                    Wired<br />Only
                                                </th>
                                                <th rowSpan={2} className="px-2 py-2 text-center w-14 font-black text-[10px] uppercase text-white" style={{ backgroundColor: '#334155', color: '#ffffff' }}>BAL</th>
                                            </tr>
                                            <tr className="text-[10px] font-black tracking-tight" style={{ backgroundColor: '#0f172a' }}>
                                                <BreakdownHeadCells tone="green" />
                                                <BreakdownHeadCells tone="blue" />
                                                <th className="px-0.5 py-1.5 w-7 font-black" style={{ backgroundColor: '#0e7490', color: '#ffffff' }}>5.6</th>
                                                <th className="px-0.5 py-1.5 w-7 font-black" style={{ backgroundColor: '#0e7490', color: '#ffffff' }}>6.7</th>
                                                <th className="px-0.5 py-1.5 w-7 font-black" style={{ backgroundColor: '#0e7490', color: '#ffffff' }}>8.0</th>
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
                                                            rows.push(<SummaryRow key={`sum-${currentRegion}`} label={`${currentRegion} TOTAL`} row={summaries[currentRegion]} />);
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
                                                            <td className="border-r border-slate-100 px-2 py-1.5 text-center font-black text-slate-900">{row.rtom}</td>

                                                            <td className="border-r border-slate-100 px-1 py-1.5 text-center bg-blue-50/50 text-blue-800 font-bold">{row.inHandMorning.total}</td>
                                                            <td className="border-r border-slate-100 px-1 py-1.5 text-center bg-emerald-50/50 text-emerald-800 font-bold">{row.received.total}</td>
                                                            <td className="border-r border-slate-100 px-1 py-1.5 text-center bg-indigo-50 font-black text-indigo-900">{row.totalInHand}</td>

                                                            <BreakdownCells metrics={row.completed}    tone="green" />
                                                            <BreakdownCells metrics={row.installClosed} tone="blue" />

                                                            <td className="border-r border-slate-100 px-1 py-1.5 text-center bg-amber-50/40 text-amber-900">{row.material.dw.toFixed(1)}</td>
                                                            <td className="border-r border-slate-100 px-1 py-1.5 text-center bg-cyan-50/40 text-cyan-900">{row.material.pole56}</td>
                                                            <td className="border-r border-slate-100 px-1 py-1.5 text-center bg-cyan-50/40 text-cyan-900">{row.material.pole67}</td>
                                                            <td className="border-r border-slate-100 px-1 py-1.5 text-center bg-cyan-50/40 text-cyan-900">{row.material.pole80}</td>
                                                            <td className="border-r border-slate-100 px-1 py-1.5 text-center bg-rose-50/40 text-rose-900">{row.returned.total}</td>
                                                            <td className="border-r border-slate-100 px-1 py-1.5 text-center bg-purple-50/40 text-purple-900">{row.wiredOnly.total}</td>
                                                            <td className="px-2 py-1.5 text-center bg-slate-100 font-black text-slate-900 group-hover:bg-slate-200/70 transition-colors">{row.balance.total}</td>
                                                        </tr>
                                                    );
                                                });

                                                // Last region summary
                                                if (currentRegion && summaries[currentRegion]) {
                                                    rows.push(<SummaryRow key={`sum-${currentRegion}`} label={`${currentRegion} TOTAL`} row={summaries[currentRegion]} />);
                                                }
                                                // Grand total
                                                if (grandTotal) {
                                                    rows.push(<SummaryRow key="grand-total" label="GRAND TOTAL" row={grandTotal} isGrandTotal />);
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
                                            <tr>
                                                <th className="px-2 py-2.5 text-left w-24 border-r border-slate-700 text-[10px] font-extrabold uppercase tracking-wide text-white" style={{ background: '#020617' }}>Province</th>
                                                <th className="px-2 py-2.5 text-center w-20 border-r border-slate-700 text-[10px] font-extrabold uppercase tracking-wide text-white" style={{ background: '#020617' }}>RTOM</th>
                                                <th className="px-2 py-2.5 text-center w-28 text-[10px] font-extrabold leading-tight border-r border-blue-800 text-white" style={{ background: '#172554' }}>1. Month<br />Install Closed</th>
                                                <th className="px-2 py-2.5 text-center w-24 text-[10px] font-extrabold leading-tight border-r border-sky-800 text-white" style={{ background: '#0c4a6e' }}>2. System<br />Completed</th>
                                                <th className="px-2 py-2.5 text-center w-24 text-[10px] font-extrabold leading-tight border-r border-emerald-800 text-white" style={{ background: '#022c22' }}>3. PAT OPMC<br />Passed</th>
                                                <th className="px-2 py-2.5 text-center w-28 text-[10px] font-black leading-tight border-r border-teal-800" style={{ background: '#134e4a', color: '#99f6e4' }}>4. Final PAT<br />(Invoicable)</th>
                                                <th className="px-2 py-2.5 text-center w-20 text-[10px] font-extrabold leading-tight border-r border-rose-900" style={{ background: '#4c0519', color: '#fecdd3' }}>PAT<br />Rejected</th>
                                                <th className="px-2 py-2.5 text-center w-28 text-[10px] font-extrabold leading-tight border-r border-amber-800" style={{ background: '#431407', color: '#fde68a' }}>Pending<br />Final PAT</th>
                                                <th className="px-2 py-2.5 text-center w-24 text-[10px] font-extrabold leading-tight border-r border-indigo-800 text-white" style={{ background: '#1e1b4b' }}>Same-Day<br />Done</th>
                                                <th className="px-2 py-2.5 text-center w-20 text-[10px] font-extrabold leading-tight border-r border-indigo-700 text-white" style={{ background: '#312e81' }}>Same-Day<br />Rate %</th>
                                                <th className="px-2 py-2.5 text-center w-24 text-[10px] font-black leading-tight text-white" style={{ background: '#1e293b' }}>Final Invoicing<br />Rate %</th>
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
        </RoleGuard>
    );
}
