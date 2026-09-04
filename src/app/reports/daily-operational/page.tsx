"use client";

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Calendar as CalendarIcon, TrendingUp, CheckCircle2, AlertCircle, Clock, ClipboardCopy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getSriLankaToday } from '@/lib/timezone';
import * as XLSX from 'xlsx';

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
    delays: Record<string, number>;
    balance: ReportMetrics;
    shortages: { [key: string]: number; stb: number; ont: number };
}

interface ReportData {
    reportData: ReportRowData[];
    date: string;
}

/**
 * Completed Orders and Install Closed expose the same order-type breakdown, so they are
 * painted from one config: green marks the Completed area, blue the Install Closed area.
 */
type BreakdownTone = 'green' | 'blue';

type BreakdownKey = 'create' | 'recon' | 'upgrade' | 'fnc' | 'or' | 'ml' | 'frl' | 'data' | 'total';

const BREAKDOWN_COLUMNS: { label: string; key: BreakdownKey; kind: 'bucket' | 'subtotal' | 'total' }[] = [
    { label: 'CR', key: 'create', kind: 'bucket' },
    { label: 'RC', key: 'recon', kind: 'bucket' },
    { label: 'UP', key: 'upgrade', kind: 'bucket' },
    { label: 'FNC', key: 'fnc', kind: 'subtotal' },
    { label: 'OR', key: 'or', kind: 'bucket' },
    { label: 'ML', key: 'ml', kind: 'bucket' },
    { label: 'FRL', key: 'frl', kind: 'subtotal' },
    { label: 'DT', key: 'data', kind: 'bucket' },
    { label: 'Total', key: 'total', kind: 'total' },
];

const BREAKDOWN_STYLE: Record<BreakdownTone, {
    group: string; sub: string; subTotal: string; edge: string;
    bucket: string; subtotal: string; total: string;
    sumBucket: string; sumSubtotal: string; sumTotal: string;
}> = {
    green: {
        group: 'px-2 py-1 text-center bg-green-800 border-b border-green-700 border-l-2 border-l-green-400',
        sub: 'bg-green-700',
        subTotal: 'bg-green-600',
        edge: 'border-l-2 border-l-green-400',
        bucket: 'bg-green-50/70 text-green-950',
        subtotal: 'bg-green-200/60 font-bold text-green-900',
        total: 'bg-green-500/25 font-black text-green-900',
        sumBucket: 'bg-green-500/15',
        sumSubtotal: 'bg-green-500/30 font-bold',
        sumTotal: 'bg-green-500 text-white font-bold',
    },
    blue: {
        group: 'px-2 py-1 text-center bg-blue-800 border-b border-blue-700 border-l-2 border-l-blue-400',
        sub: 'bg-blue-700',
        subTotal: 'bg-blue-600',
        edge: 'border-l-2 border-l-blue-400',
        bucket: 'bg-blue-50/70 text-blue-950',
        subtotal: 'bg-blue-200/60 font-bold text-blue-900',
        total: 'bg-blue-500/25 font-black text-blue-900',
        sumBucket: 'bg-blue-500/15',
        sumSubtotal: 'bg-blue-500/30 font-bold',
        sumTotal: 'bg-blue-500 text-white font-bold',
    },
};

const breakdownFill = (tone: BreakdownTone, kind: 'bucket' | 'subtotal' | 'total', summary: boolean): string => {
    const s = BREAKDOWN_STYLE[tone];
    if (summary) return kind === 'total' ? s.sumTotal : kind === 'subtotal' ? s.sumSubtotal : s.sumBucket;
    return kind === 'total' ? s.total : kind === 'subtotal' ? s.subtotal : s.bucket;
};

/** Column-label header cells of one breakdown group. */
function BreakdownHeadCells({ tone }: { tone: BreakdownTone }) {
    const s = BREAKDOWN_STYLE[tone];
    return (
        <>
            {BREAKDOWN_COLUMNS.map(({ label, key, kind }, i) => (
                <th
                    key={key}
                    className={`${kind === 'total' ? `px-1 py-1 w-10 ${s.subTotal}` : `px-0.5 py-1 w-7 ${s.sub}`}${i === 0 ? ` ${s.edge}` : ''} text-white`}
                >
                    {label}
                </th>
            ))}
        </>
    );
}

/** The nine figures of one breakdown group; shared by RTOM rows and the region / grand total rows. */
function BreakdownCells({ metrics, tone, summary = false }: { metrics: CompletedMetrics; tone: BreakdownTone; summary?: boolean }) {
    const s = BREAKDOWN_STYLE[tone];
    const border = summary ? 'border border-slate-300' : 'border border-slate-200';
    return (
        <>
            {BREAKDOWN_COLUMNS.map(({ key, kind }, i) => (
                <td
                    key={key}
                    className={`${border} px-1 py-1 text-center ${breakdownFill(tone, kind, summary)}${i === 0 ? ` ${s.edge}` : ''}`}
                >
                    {metrics[key]}
                </td>
            ))}
        </>
    );
}

export default function DailyOperationalReportPage() {
    const [data, setData] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(getSriLankaToday());

    // React hydrates in time slices, so a response that lands while the server markup is
    // still being compared re-renders the tree underneath it - the toolbar buttons sit
    // before the 30-column body, so their `disabled` flag was the first node to disagree
    // (server: disabled because data was null; client: enabled because data had arrived).
    // Holding the fetch until after the hydration commit keeps both passes identical; the
    // buttons additionally carry suppressHydrationWarning because whether a report exists
    // is unknowable at render time and losing hydration costs a full client re-render of
    // the whole table.
    const [hydrated, setHydrated] = useState(false);

    const fetchReport = React.useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/reports/daily-operational?date=${selectedDate}`);
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (err) {
            console.error("Failed to fetch daily report", err);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    React.useEffect(() => {
        setHydrated(true);
    }, []);

    React.useEffect(() => {
        if (hydrated) fetchReport();
    }, [hydrated, fetchReport]);

    const reportData = data?.reportData || [];

    const calculateSummaries = (): { summaries: Record<string, ReportRowData>, grandTotal: ReportRowData } => {
        const summaries: Record<string, ReportRowData> = {};
        const grandTotal: ReportRowData = {
            region: 'ALL',
            province: 'ALL',
            rtom: 'GRAND TOTAL',
            regularTeams: 0,
            teamsWorked: 0,
            inHandMorning: { nc: 0, rl: 0, data: 0, total: 0 },
            received: { nc: 0, rl: 0, data: 0, total: 0 },
            totalInHand: 0,
            completed: { create: 0, recon: 0, upgrade: 0, fnc: 0, or: 0, ml: 0, frl: 0, data: 0, total: 0 },
            material: { dwSlt: 0, dwCompany: 0, dw: 0, pole56: 0, pole67: 0, pole80: 0 },
            returned: { nc: 0, rl: 0, data: 0, total: 0 },
            wiredOnly: { nc: 0, rl: 0, data: 0, total: 0 },
            installClosed: { create: 0, recon: 0, upgrade: 0, fnc: 0, or: 0, ml: 0, frl: 0, data: 0, total: 0 },
            delays: { ontShortage: 0, stbShortage: 0, nokia: 0, system: 0, opmc: 0, cxDelay: 0, sameDay: 0, polePending: 0 },
            balance: { nc: 0, rl: 0, data: 0, total: 0 },
            shortages: { stb: 0, ont: 0 }
        };

        const acc = (target: Record<string, number>, source: Record<string, number>) => {
            Object.keys(source).forEach(k => {
                if (k !== 'total' && typeof source[k] === 'number') target[k] = (target[k] || 0) + source[k];
            });
        };

        const recalcTotal = (obj: Record<string, number>, keys: string[]) => {
            obj.total = keys.reduce((sum, k) => sum + (typeof obj[k] === 'number' ? obj[k] : 0), 0);
        };

        reportData.forEach((row) => {
            const region = row.region;
            if (!summaries[region]) {
                summaries[region] = JSON.parse(JSON.stringify(grandTotal));
                summaries[region].region = region;
                summaries[region].rtom = `${region} TOTAL`;
            }

            // Accumulate region totals
            summaries[region].regularTeams += row.regularTeams;
            summaries[region].teamsWorked += row.teamsWorked;
            summaries[region].totalInHand += row.totalInHand;
            acc(summaries[region].inHandMorning, row.inHandMorning);
            acc(summaries[region].received, row.received);
            acc(summaries[region].completed, row.completed);
            acc(summaries[region].material, row.material);
            acc(summaries[region].returned, row.returned);
            acc(summaries[region].wiredOnly, row.wiredOnly);
            acc(summaries[region].installClosed, row.installClosed);
            acc(summaries[region].delays, row.delays);
            acc(summaries[region].balance, row.balance);
            acc(summaries[region].shortages, row.shortages);

            // Recalculate totals from individual fields
            recalcTotal(summaries[region].inHandMorning, ['nc', 'rl', 'data']);
            recalcTotal(summaries[region].received, ['nc', 'rl', 'data']);
            // FNC/FRL are subtotals of the buckets above, so they stay out of the total.
            recalcTotal(summaries[region].completed, ['create', 'recon', 'upgrade', 'or', 'ml', 'data']);
            recalcTotal(summaries[region].returned, ['nc', 'rl', 'data']);
            recalcTotal(summaries[region].wiredOnly, ['nc', 'rl', 'data']);
            recalcTotal(summaries[region].installClosed, ['create', 'recon', 'upgrade', 'or', 'ml', 'data']);
            recalcTotal(summaries[region].balance, ['nc', 'rl', 'data']);

            // Accumulate grand totals
            grandTotal.regularTeams += row.regularTeams;
            grandTotal.teamsWorked += row.teamsWorked;
            grandTotal.totalInHand += row.totalInHand;
            acc(grandTotal.inHandMorning, row.inHandMorning);
            acc(grandTotal.received, row.received);
            acc(grandTotal.completed, row.completed);
            acc(grandTotal.material, row.material);
            acc(grandTotal.returned, row.returned);
            acc(grandTotal.wiredOnly, row.wiredOnly);
            acc(grandTotal.installClosed, row.installClosed);
            acc(grandTotal.delays, row.delays);
            acc(grandTotal.balance, row.balance);
            acc(grandTotal.shortages, row.shortages);
        });

        // Recalculate grand totals from individual fields
        recalcTotal(grandTotal.inHandMorning, ['nc', 'rl', 'data']);
        recalcTotal(grandTotal.received, ['nc', 'rl', 'data']);
        recalcTotal(grandTotal.completed, ['create', 'recon', 'upgrade', 'or', 'ml', 'data']);
        recalcTotal(grandTotal.returned, ['nc', 'rl', 'data']);
        recalcTotal(grandTotal.wiredOnly, ['nc', 'rl', 'data']);
        recalcTotal(grandTotal.installClosed, ['create', 'recon', 'upgrade', 'or', 'ml', 'data']);
        recalcTotal(grandTotal.balance, ['nc', 'rl', 'data']);

        return { summaries, grandTotal };
    };

    const { summaries, grandTotal } = reportData.length > 0
        ? calculateSummaries()
        : { summaries: {} as Record<string, ReportRowData>, grandTotal: null };

    const handleExport = () => {
        if (!data || reportData.length === 0) return;

        const worksheetData: (string | number)[][] = [];
        // Install Closed exports the same order-type breakdown as Completed Orders.
        const breakdown = (m: CompletedMetrics): number[] =>
            [m.create, m.recon, m.upgrade, m.fnc, m.or, m.ml, m.frl, m.data, m.total];

        // Headers
        worksheetData.push([
            "Province", "RTOM", "In Hand Morning", "Received Today", "Total In Hand",
            "CR", "RC", "UP", "FNC", "OR", "ML", "FRL", "DATA", "Total Completed",
            "IC CR", "IC RC", "IC UP", "IC FNC", "IC OR", "IC ML", "IC FRL", "IC DATA", "IC Total",
            "DW", "Pole 5.6", "Pole 6.7", "Pole 8.0", "Returned SOD", "Wired Only", "Balance"
        ]);

        let currentRegion = '';
        reportData.forEach((row) => {
            if (currentRegion !== row.region) {
                if (currentRegion && summaries[currentRegion]) {
                    const s = summaries[currentRegion];
                    worksheetData.push([
                        "", `${currentRegion} TOTAL`, s.inHandMorning.total, s.received.total, s.totalInHand,
                        s.completed.create, s.completed.recon, s.completed.upgrade, s.completed.fnc, s.completed.or, s.completed.ml, s.completed.frl, s.completed.data, s.completed.total, ...breakdown(s.installClosed),
                        s.material.dw.toFixed(2), s.material.pole56, s.material.pole67, s.material.pole80, s.returned.total, s.wiredOnly.total, s.balance.total
                    ]);
                }
                currentRegion = row.region;
                worksheetData.push([row.region, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
            }

            worksheetData.push([
                row.province, row.rtom, row.inHandMorning.total, row.received.total, row.totalInHand,
                row.completed.create, row.completed.recon, row.completed.upgrade, row.completed.fnc, row.completed.or, row.completed.ml, row.completed.frl, row.completed.data, row.completed.total, ...breakdown(row.installClosed),
                row.material.dw.toFixed(2), row.material.pole56, row.material.pole67, row.material.pole80, row.returned.total, row.wiredOnly.total, row.balance.total
            ]);
        });

        if (currentRegion && summaries[currentRegion]) {
            const s = summaries[currentRegion];
            worksheetData.push([
                "", `${currentRegion} TOTAL`, s.inHandMorning.total, s.received.total, s.totalInHand,
                s.completed.create, s.completed.recon, s.completed.upgrade, s.completed.fnc, s.completed.or, s.completed.ml, s.completed.frl, s.completed.data, s.completed.total, ...breakdown(s.installClosed),
                s.material.dw.toFixed(2), s.material.pole56, s.material.pole67, s.material.pole80, s.returned.total, s.wiredOnly.total, s.balance.total
            ]);
        }

        if (grandTotal) {
            worksheetData.push([
                "GRAND TOTAL", "", grandTotal.inHandMorning.total, grandTotal.received.total, grandTotal.totalInHand,
                grandTotal.completed.create, grandTotal.completed.recon, grandTotal.completed.upgrade, grandTotal.completed.fnc, grandTotal.completed.or, grandTotal.completed.ml, grandTotal.completed.frl, grandTotal.completed.data, grandTotal.completed.total, ...breakdown(grandTotal.installClosed),
                grandTotal.material.dw.toFixed(2), grandTotal.material.pole56, grandTotal.material.pole67, grandTotal.material.pole80, grandTotal.returned.total, grandTotal.wiredOnly.total, grandTotal.balance.total
            ]);
        }

        const ws = XLSX.utils.aoa_to_sheet(worksheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Daily Operational Report");
        XLSX.writeFile(wb, `Daily_Operational_Report_${selectedDate}.xlsx`);
    };

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
        return blocks.join('\n\n----------------------------------------\n\n');
    };

    const handleCopyText = async () => {
        try {
            await navigator.clipboard.writeText(formatShareText());
        } catch {
            // Clipboard API unavailable (non-secure context) - ignore silently
        }
    };

    const SummaryRow = ({ label, data, isGrandTotal = false }: { label: string; data: ReportRowData; isGrandTotal?: boolean }) => (
        <tr className={isGrandTotal ? "bg-slate-900 text-white font-bold" : "bg-indigo-200/70 font-bold text-indigo-950"}>
            <td colSpan={2} className="border border-slate-300 px-2 py-1.5 text-right uppercase tracking-wider">{label}</td>
            <td className="border border-slate-300 px-1 py-1 text-center bg-blue-50/10 font-bold">{data.inHandMorning.total}</td>
            <td className="border border-slate-300 px-1 py-1 text-center bg-emerald-50/10 font-bold">{data.received.total}</td>
            <td className="border border-slate-300 px-1 py-1 text-center bg-indigo-50/10 font-bold">{data.totalInHand}</td>

            <BreakdownCells metrics={data.completed} tone="green" summary />
            <BreakdownCells metrics={data.installClosed} tone="blue" summary />

            <td className="border border-slate-300 px-1 py-1 text-center">{data.material.dw.toFixed(1)}</td>
            <td className="border border-slate-300 px-1 py-1 text-center">{data.material.pole56}</td>
            <td className="border border-slate-300 px-1 py-1 text-center">{data.material.pole67}</td>
            <td className="border border-slate-300 px-1 py-1 text-center">{data.material.pole80}</td>
            <td className="border border-slate-300 px-1 py-1 text-center">{data.returned.total}</td>
            <td className="border border-slate-300 px-1 py-1 text-center">{data.wiredOnly.total}</td>
            <td className="border border-slate-300 px-1 py-1 text-center font-bold bg-slate-200 text-slate-900">{data.balance.total}</td>
        </tr>
    );

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
                <Header />
                <div className="p-6 space-y-6 max-w-full mx-auto w-full">

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Daily Operational Report</h1>
                            <p className="text-slate-500">Compact performance tracking & regional summaries</p>
                        </div>

                        <div className="flex gap-3">
                            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                                <CalendarIcon className="w-4 h-4 text-slate-400" />
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="text-sm border-none focus:outline-none"
                                />
                            </div>
                            <Button
                                onClick={fetchReport}
                                disabled={loading}
                                variant="outline"
                                size="sm"
                                className="gap-2"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                            <Button
                                onClick={handleExport}
                                disabled={loading || !data}
                                size="sm"
                                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                                suppressHydrationWarning
                            >
                                <Download className="w-4 h-4" /> Export
                            </Button>
                            <Button
                                onClick={handleCopyText}
                                disabled={loading || !data || reportData.length === 0}
                                size="sm"
                                variant="outline"
                                className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                title="Copy FN Progress text format for sharing"
                                suppressHydrationWarning
                            >
                                <ClipboardCopy className="w-4 h-4" /> Copy Text
                            </Button>
                        </div>
                    </div>

                    {grandTotal && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Card className="bg-blue-50 border-blue-100 shadow-sm">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="p-2 bg-blue-500 rounded-lg"><Clock className="w-5 h-5 text-white" /></div>
                                    <div>
                                        <p className="text-xs text-blue-600 font-semibold uppercase">Morning Hand</p>
                                        <p className="text-2xl font-bold text-blue-900">{grandTotal.inHandMorning.total}</p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-emerald-50 border-emerald-100 shadow-sm">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="p-2 bg-emerald-500 rounded-lg"><TrendingUp className="w-5 h-5 text-white" /></div>
                                    <div>
                                        <p className="text-xs text-emerald-600 font-semibold uppercase">Received Today</p>
                                        <p className="text-2xl font-bold text-emerald-900">{grandTotal.received.total}</p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-green-50 border-green-100 shadow-sm">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="p-2 bg-green-500 rounded-lg"><CheckCircle2 className="w-5 h-5 text-white" /></div>
                                    <div>
                                        <p className="text-xs text-green-600 font-semibold uppercase">Completed</p>
                                        <p className="text-2xl font-bold text-green-900">{grandTotal.completed.total}</p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-slate-100 border-slate-200 shadow-sm">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="p-2 bg-slate-700 rounded-lg"><AlertCircle className="w-5 h-5 text-white" /></div>
                                    <div>
                                        <p className="text-xs text-slate-600 font-semibold uppercase">Pending Balance</p>
                                        <p className="text-2xl font-bold text-slate-900">{grandTotal.balance.total}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-[11px] border-collapse report-table-dark">
                                <thead className="bg-slate-900 text-white sticky top-0 z-20">
                                    <tr className="divide-x divide-slate-700">
                                        <th rowSpan={2} className="px-2 py-2 text-left w-24 bg-slate-900">Province</th>
                                        <th rowSpan={2} className="px-2 py-2 text-center w-20 bg-slate-900">RTOM</th>
                                        <th rowSpan={2} className="px-1 py-2 bg-blue-800 text-center w-14">In Hand<br />(AM)</th>
                                        <th rowSpan={2} className="px-1 py-2 bg-emerald-800 text-center w-14">Recv<br />Today</th>
                                        <th rowSpan={2} className="px-1 py-2 bg-indigo-800 text-center w-14">Total<br />Hand</th>
                                        <th colSpan={9} className={BREAKDOWN_STYLE.green.group}>Completed Orders</th>
                                        <th colSpan={9} className={BREAKDOWN_STYLE.blue.group}>Install Closed</th>
                                        <th rowSpan={2} className="px-1 py-2 bg-amber-800 text-center w-12">DW</th>
                                        <th colSpan={3} className="px-2 py-1 bg-cyan-800 text-center border-b border-cyan-700">Poles</th>
                                        <th rowSpan={2} className="px-1 py-2 bg-rose-800 text-center w-12">Ret<br />SOD</th>
                                        <th rowSpan={2} className="px-1 py-2 bg-purple-800 text-center w-12">Wired<br />Only</th>
                                        <th rowSpan={2} className="px-2 py-2 bg-slate-700 text-center w-16 uppercase">BAL</th>
                                    </tr>
                                    <tr className="text-white text-[9px] uppercase font-bold tracking-tighter divide-x divide-slate-700">
                                        <BreakdownHeadCells tone="green" />
                                        <BreakdownHeadCells tone="blue" />
                                        <th className="px-0.5 py-1 w-7 bg-cyan-700 text-white">5.6</th>
                                        <th className="px-0.5 py-1 w-7 bg-cyan-700 text-white">6.7</th>
                                        <th className="px-0.5 py-1 w-7 bg-cyan-700 text-white">8.0</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white">
                                    {reportData.length === 0 ? (
                                        <tr>
                                            <td colSpan={30} className="text-center py-12 text-slate-400">
                                                {loading ? (
                                                    <div className="flex flex-col items-center gap-2">
                                                        <RefreshCw className="w-8 h-8 animate-spin text-slate-300" />
                                                        <span>Loading report data...</span>
                                                    </div>
                                                ) : 'No data available for selected date'}
                                            </td>
                                        </tr>
                                    ) : (
                                        <>
                                            {(() => {
                                                let currentRegion = '';
                                                const rows: React.ReactNode[] = [];

                                                reportData.forEach((row, idx) => {
                                                    if (currentRegion !== row.region) {
                                                        if (currentRegion && summaries[currentRegion]) {
                                                            rows.push(<SummaryRow key={`summary-${currentRegion}`} label={`${currentRegion} TOTAL`} data={summaries[currentRegion]} />);
                                                        }

                                                        currentRegion = row.region;
                                                        rows.push(
                                                            <tr key={`header-${row.region}`} className="bg-slate-200 border-y border-slate-300">
                                                                <td colSpan={30} className="px-3 py-1 text-[11px] font-black text-slate-800 tracking-wider uppercase">{row.region} REGION</td>
                                                            </tr>
                                                        );
                                                    }

                                                    rows.push(
                                                        <tr key={`${idx}-${row.rtom}`} className="hover:bg-blue-50/40 border-b group transition-colors">
                                                            <td className="border border-slate-200 px-2 py-1 text-slate-600 text-[10px] uppercase">{row.province}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center font-bold text-slate-900">{row.rtom}</td>

                                                            <td className="border border-slate-200 px-1 py-1 text-center bg-blue-50/50 text-blue-700 font-bold">{row.inHandMorning.total}</td>
                                                            <td className="border border-slate-200 px-1 py-1 text-center bg-emerald-50/50 text-emerald-700 font-bold">{row.received.total}</td>
                                                            <td className="border border-slate-200 px-1 py-1 text-center bg-indigo-50 font-black text-indigo-900">{row.totalInHand}</td>

                                                            <BreakdownCells metrics={row.completed} tone="green" />
                                                            <BreakdownCells metrics={row.installClosed} tone="blue" />

                                                            <td className="border border-slate-200 px-1 py-1 text-center bg-amber-50/50 text-amber-900 font-medium">{row.material.dw.toFixed(1)}</td>
                                                            <td className="border border-slate-200 px-1 py-1 text-center bg-cyan-50/40 text-cyan-900 font-medium">{row.material.pole56}</td>
                                                            <td className="border border-slate-200 px-1 py-1 text-center bg-cyan-50/40 text-cyan-900 font-medium">{row.material.pole67}</td>
                                                            <td className="border border-slate-200 px-1 py-1 text-center bg-cyan-50/40 text-cyan-900 font-medium">{row.material.pole80}</td>
                                                            <td className="border border-slate-200 px-1 py-1 text-center bg-rose-50/50 text-rose-900 font-medium">{row.returned.total}</td>
                                                            <td className="border border-slate-200 px-1 py-1 text-center bg-purple-50/50 text-purple-900 font-medium">{row.wiredOnly.total}</td>

                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-slate-100 font-black text-slate-900">{row.balance.total}</td>
                                                        </tr>
                                                    );
                                                });

                                                if (currentRegion && summaries[currentRegion]) {
                                                    rows.push(<SummaryRow key={`summary-${currentRegion}`} label={`${currentRegion} TOTAL`} data={summaries[currentRegion]} />);
                                                }

                                                if (grandTotal) {
                                                    rows.push(<SummaryRow key="grand-total" label="GRAND TOTAL" data={grandTotal} isGrandTotal={true} />);
                                                }

                                                return rows;
                                            })()}
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {reportData.length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">NC / RL / DATA Breakdown</h2>
                                <p className="text-[11px] text-slate-500">Category split per RTOM for the FN Progress report</p>
                            </div>
                            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                                <table className="w-full text-[11px] border-collapse report-table-dark">
                                    <thead className="bg-slate-900 text-white sticky top-0 z-10">
                                        <tr className="divide-x divide-slate-700">
                                            <th className="px-2 py-2 text-left w-24 bg-slate-900">RTOM</th>
                                            <th className="px-2 py-2 text-left w-32 bg-slate-900">Metric</th>
                                            <th className="px-2 py-2 text-center w-16 bg-slate-900">NC</th>
                                            <th className="px-2 py-2 text-center w-16 bg-slate-900">RL</th>
                                            <th className="px-2 py-2 text-center w-16 bg-slate-900">DATA</th>
                                            <th className="px-2 py-2 text-center w-16 bg-slate-700">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white">
                                        {reportData.map((row) => {
                                            // Install Closed is excluded: it now breaks down by order type, not family.
                                            const metrics: { label: string; m: { nc: number; rl: number; data: number; total: number } }[] = [
                                                { label: 'C/F (In Hand AM)', m: row.inHandMorning },
                                                { label: 'SOD Receiving', m: row.received },
                                                { label: 'Returned', m: row.returned },
                                                { label: 'Wired Only', m: row.wiredOnly },
                                                { label: 'Balance C/F', m: row.balance },
                                            ];
                                            return metrics.map(({ label, m }, mi) => (
                                                <tr key={`${row.rtom}-${label}`} className={`border-b border-slate-100 hover:bg-blue-50/40 ${mi === 0 ? 'border-t-2 border-t-slate-300' : ''}`}>
                                                    {mi === 0 && (
                                                        <td rowSpan={5} className="border-r border-slate-200 px-2 py-1 text-center font-bold text-slate-900 bg-slate-50 align-middle">{row.rtom}</td>
                                                    )}
                                                    <td className="border-r border-slate-200 px-2 py-1 text-slate-600">{label}</td>
                                                    <td className="border-r border-slate-100 px-2 py-1 text-center text-slate-800">{m.nc}</td>
                                                    <td className="border-r border-slate-100 px-2 py-1 text-center text-slate-800">{m.rl}</td>
                                                    <td className="border-r border-slate-100 px-2 py-1 text-center text-slate-800">{m.data}</td>
                                                    <td className="px-2 py-1 text-center font-bold text-slate-900 bg-slate-100/60">{m.total}</td>
                                                </tr>
                                            ));
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
}


