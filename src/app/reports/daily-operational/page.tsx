"use client";

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Calendar as CalendarIcon, TrendingUp, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function DailyOperationalReportPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/reports/daily-operational?date=${selectedDate}`);
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (error) {
            console.error("Failed to fetch daily report");
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        fetchReport();
    }, [selectedDate]);

    const reportData = data?.reportData || [];

    // Calculate summaries
    const calculateSummaries = () => {
        const summaries: any = {};
        const grandTotal: any = {
            regularTeams: 0,
            teamsWorked: 0,
            inHandMorning: { nc: 0, rl: 0, data: 0, total: 0 },
            received: { nc: 0, rl: 0, data: 0, total: 0 },
            totalInHand: 0,
            completed: { create: 0, recon: 0, upgrade: 0, fnc: 0, or: 0, ml: 0, frl: 0, data: 0, total: 0 },
            material: { dw: 0, pole56: 0, pole67: 0, pole80: 0 },
            returned: { nc: 0, rl: 0, data: 0, total: 0 },
            wiredOnly: { nc: 0, rl: 0, data: 0, total: 0 },
            delays: { ontShortage: 0, stbShortage: 0, nokia: 0, system: 0, opmc: 0, cxDelay: 0, sameDay: 0, polePending: 0 },
            balance: { nc: 0, rl: 0, data: 0, total: 0 },
            shortages: { stb: 0, ont: 0 }
        };

        reportData.forEach((row: any) => {
            const region = row.region;
            if (!summaries[region]) {
                summaries[region] = JSON.parse(JSON.stringify(grandTotal));
            }

            // Accumulate region totals
            summaries[region].regularTeams += row.regularTeams;
            summaries[region].teamsWorked += row.teamsWorked;
            Object.keys(row.inHandMorning).forEach(k => summaries[region].inHandMorning[k] += row.inHandMorning[k]);
            Object.keys(row.received).forEach(k => summaries[region].received[k] += row.received[k]);
            summaries[region].totalInHand += row.totalInHand;
            Object.keys(row.completed).forEach(k => summaries[region].completed[k] += row.completed[k]);
            Object.keys(row.material).forEach(k => summaries[region].material[k] += row.material[k]);
            Object.keys(row.returned).forEach(k => summaries[region].returned[k] += row.returned[k]);
            Object.keys(row.wiredOnly).forEach(k => summaries[region].wiredOnly[k] += row.wiredOnly[k]);
            Object.keys(row.delays).forEach(k => summaries[region].delays[k] += row.delays[k]);
            Object.keys(row.balance).forEach(k => summaries[region].balance[k] += row.balance[k]);
            Object.keys(row.shortages).forEach(k => summaries[region].shortages[k] += row.shortages[k]);

            // Accumulate grand totals
            grandTotal.regularTeams += row.regularTeams;
            grandTotal.teamsWorked += row.teamsWorked;
            Object.keys(row.inHandMorning).forEach(k => grandTotal.inHandMorning[k] += row.inHandMorning[k]);
            Object.keys(row.received).forEach(k => grandTotal.received[k] += row.received[k]);
            grandTotal.totalInHand += row.totalInHand;
            Object.keys(row.completed).forEach(k => grandTotal.completed[k] += grandTotal.completed[k] !== undefined ? row.completed[k] : 0); // Safety check
            // Fix: Actually accumulate the completed keys properly
            ['create', 'recon', 'upgrade', 'fnc', 'or', 'ml', 'frl', 'data', 'total'].forEach(k => {
                grandTotal.completed[k] += row.completed[k] || 0;
            });
            Object.keys(row.material).forEach(k => grandTotal.material[k] += row.material[k]);
            Object.keys(row.returned).forEach(k => grandTotal.returned[k] += row.returned[k]);
            Object.keys(row.wiredOnly).forEach(k => grandTotal.wiredOnly[k] += row.wiredOnly[k]);
            Object.keys(row.delays).forEach(k => grandTotal.delays[k] += row.delays[k]);
            Object.keys(row.balance).forEach(k => grandTotal.balance[k] += row.balance[k]);
            Object.keys(row.shortages).forEach(k => grandTotal.shortages[k] += row.shortages[k]);
        });

        return { summaries, grandTotal };
    };

    const { summaries, grandTotal } = reportData.length > 0 ? calculateSummaries() : { summaries: {}, grandTotal: null };

    const SummaryRow = ({ label, data, isGrandTotal = false }: any) => (
        <tr className={isGrandTotal ? "bg-slate-900 text-white font-bold" : "bg-slate-100 font-bold"}>
            <td colSpan={2} className="border border-slate-300 px-2 py-1.5 text-right uppercase tracking-wider">{label}</td>
            <td className="border border-slate-300 px-1 py-1 text-center bg-blue-50/10 font-bold">{data.inHandMorning.total}</td>
            <td className="border border-slate-300 px-1 py-1 text-center bg-emerald-50/10 font-bold">{data.received.total}</td>
            <td className="border border-slate-300 px-1 py-1 text-center bg-indigo-50/10 font-bold">{data.totalInHand}</td>

            <td className="border border-slate-300 px-1 py-1 text-center">{data.completed.create}</td>
            <td className="border border-slate-300 px-1 py-1 text-center">{data.completed.recon}</td>
            <td className="border border-slate-300 px-1 py-1 text-center">{data.completed.upgrade}</td>
            <td className="border border-slate-300 px-1 py-1 text-center">{data.completed.fnc}</td>
            <td className="border border-slate-300 px-1 py-1 text-center">{data.completed.or}</td>
            <td className="border border-slate-300 px-1 py-1 text-center">{data.completed.ml}</td>
            <td className="border border-slate-300 px-1 py-1 text-center">{data.completed.frl}</td>
            <td className="border border-slate-300 px-1 py-1 text-center font-bold bg-green-500 text-white">{data.completed.total}</td>

            <td className="border border-slate-300 px-1 py-1 text-center">{data.material.dw.toFixed(1)}</td>
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

                    {/* Header */}
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
                            <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                                <Download className="w-4 h-4" /> Export
                            </Button>
                        </div>
                    </div>

                    {/* Summary Cards */}
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

                    {/* Main Report Table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-[11px] border-collapse">
                                <thead className="bg-slate-900 text-white sticky top-0 z-20">
                                    <tr className="divide-x divide-slate-700">
                                        <th rowSpan={2} className="px-2 py-2 text-left w-24">Province</th>
                                        <th rowSpan={2} className="px-2 py-2 text-center w-20">RTOM</th>
                                        <th rowSpan={2} className="px-1 py-2 bg-blue-900/50 text-center w-14">In Hand<br />(AM)</th>
                                        <th rowSpan={2} className="px-1 py-2 bg-emerald-900/50 text-center w-14">Recv<br />Today</th>
                                        <th rowSpan={2} className="px-1 py-2 bg-indigo-900 text-center w-14">Total<br />Hand</th>
                                        <th colSpan={8} className="px-2 py-1 bg-green-900 text-center border-b border-green-800">Completed Orders</th>
                                        <th rowSpan={2} className="px-1 py-2 bg-amber-900/50 text-center w-12">DW<br />(km)</th>
                                        <th rowSpan={2} className="px-1 py-2 bg-rose-900/50 text-center w-12">Ret<br />SOD</th>
                                        <th rowSpan={2} className="px-1 py-2 bg-purple-900/50 text-center w-12">Wired<br />Only</th>
                                        <th rowSpan={2} className="px-2 py-2 bg-slate-700 text-center w-16 uppercase">BAL</th>
                                    </tr>
                                    <tr className="bg-green-800 text-[9px] uppercase font-bold tracking-tighter divide-x divide-slate-700">
                                        <th className="px-0.5 py-1 w-7">CR</th>
                                        <th className="px-0.5 py-1 w-7">RC</th>
                                        <th className="px-0.5 py-1 w-7">UP</th>
                                        <th className="px-0.5 py-1 w-7">FNC</th>
                                        <th className="px-0.5 py-1 w-7">OR</th>
                                        <th className="px-0.5 py-1 w-7">ML</th>
                                        <th className="px-0.5 py-1 w-7">FRL</th>
                                        <th className="px-1 py-1 w-10 bg-green-600">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white">
                                    {reportData.length === 0 ? (
                                        <tr>
                                            <td colSpan={16} className="text-center py-12 text-slate-400">
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
                                                const rows: any[] = [];

                                                reportData.forEach((row: any, idx: number) => {
                                                    // Add region header
                                                    if (currentRegion !== row.region) {
                                                        // Before starting new region, add summary of previous region if it exists
                                                        if (currentRegion && summaries[currentRegion]) {
                                                            rows.push(<SummaryRow key={`summary-${currentRegion}`} label={`${currentRegion} TOTAL`} data={summaries[currentRegion]} />);
                                                        }

                                                        currentRegion = row.region;
                                                        rows.push(
                                                            <tr key={`header-${row.region}`} className="bg-slate-200 border-y border-slate-300">
                                                                <td colSpan={16} className="px-3 py-1 text-[11px] font-black text-slate-800 tracking-wider uppercase">{row.region} REGION</td>
                                                            </tr>
                                                        );
                                                    }

                                                    // Add data row
                                                    rows.push(
                                                        <tr key={`${idx}-${row.rtom}`} className="hover:bg-blue-50/40 border-b group transition-colors">
                                                            <td className="border border-slate-200 px-2 py-1 text-slate-600 text-[10px] uppercase">{row.province}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center font-bold text-slate-900">{row.rtom}</td>

                                                            <td className="border border-slate-200 px-1 py-1 text-center bg-blue-50/50 text-blue-700 font-bold">{row.inHandMorning.total}</td>
                                                            <td className="border border-slate-200 px-1 py-1 text-center bg-emerald-50/50 text-emerald-700 font-bold">{row.received.total}</td>
                                                            <td className="border border-slate-200 px-1 py-1 text-center bg-indigo-50 font-black text-indigo-900">{row.totalInHand}</td>

                                                            <td className="border border-slate-200 px-1 py-1 text-center group-hover:bg-white">{row.completed.create}</td>
                                                            <td className="border border-slate-200 px-1 py-1 text-center group-hover:bg-white">{row.completed.recon}</td>
                                                            <td className="border border-slate-200 px-1 py-1 text-center group-hover:bg-white">{row.completed.upgrade}</td>
                                                            <td className="border border-slate-200 px-1 py-1 text-center group-hover:bg-white">{row.completed.fnc}</td>
                                                            <td className="border border-slate-200 px-1 py-1 text-center group-hover:bg-white">{row.completed.or}</td>
                                                            <td className="border border-slate-200 px-1 py-1 text-center group-hover:bg-white">{row.completed.ml}</td>
                                                            <td className="border border-slate-200 px-1 py-1 text-center group-hover:bg-white">{row.completed.frl}</td>
                                                            <td className="border border-slate-200 px-1 py-1 text-center bg-green-100/50 font-black text-green-900">{row.completed.total}</td>

                                                            <td className="border border-slate-200 px-1 py-1 text-center bg-amber-50/50 text-amber-900 font-medium">{row.material.dw.toFixed(1)}</td>
                                                            <td className="border border-slate-200 px-1 py-1 text-center bg-rose-50/50 text-rose-900 font-medium">{row.returned.total}</td>
                                                            <td className="border border-slate-200 px-1 py-1 text-center bg-purple-50/50 text-purple-900 font-medium">{row.wiredOnly.total}</td>

                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-slate-100 font-black text-slate-900">{row.balance.total}</td>
                                                        </tr>
                                                    );
                                                });

                                                // Add last region summary
                                                if (currentRegion && summaries[currentRegion]) {
                                                    rows.push(<SummaryRow key={`summary-${currentRegion}`} label={`${currentRegion} TOTAL`} data={summaries[currentRegion]} />);
                                                }

                                                // Add grand total
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

                </div>
            </main>
        </div>
    );
}
