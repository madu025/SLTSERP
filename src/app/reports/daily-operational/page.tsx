"use client";

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Calendar as CalendarIcon } from "lucide-react";

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
            Object.keys(row.completed).forEach(k => grandTotal.completed[k] += row.completed[k]);
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
        <tr className={isGrandTotal ? "bg-yellow-200 font-bold border-t-4 border-slate-600" : "bg-yellow-100 font-bold border-t-2 border-slate-400"}>
            <td colSpan={3} className="border border-slate-300 px-2 py-2 text-center">{label}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.regularTeams}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.teamsWorked}</td>

            <td className="border border-slate-300 px-2 py-1 text-center">{data.inHandMorning.nc}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.inHandMorning.rl}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.inHandMorning.data}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.inHandMorning.total}</td>

            <td className="border border-slate-300 px-2 py-1 text-center">{data.received.nc}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.received.rl}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.received.data}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.received.total}</td>

            <td className="border border-slate-300 px-2 py-1 text-center">{data.totalInHand}</td>

            <td className="border border-slate-300 px-2 py-1 text-center">{data.completed.create}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.completed.recon}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.completed.upgrade}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.completed.fnc}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.completed.or}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.completed.ml}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.completed.frl}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.completed.data}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.completed.total}</td>

            <td className="border border-slate-300 px-2 py-1 text-center">{data.material.dw}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.material.pole56}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.material.pole67}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.material.pole80}</td>

            <td className="border border-slate-300 px-2 py-1 text-center">{data.returned.nc}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.returned.rl}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.returned.data}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.returned.total}</td>

            <td className="border border-slate-300 px-2 py-1 text-center">{data.wiredOnly.nc}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.wiredOnly.rl}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.wiredOnly.data}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.wiredOnly.total}</td>

            <td className="border border-slate-300 px-2 py-1 text-center">{data.delays.ontShortage}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.delays.stbShortage}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.delays.nokia}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.delays.system}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.delays.opmc}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.delays.cxDelay}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.delays.sameDay}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.delays.polePending}</td>

            <td className="border border-slate-300 px-2 py-1 text-center">{data.balance.nc}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.balance.rl}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.balance.data}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.balance.total}</td>

            <td className="border border-slate-300 px-2 py-1 text-center">{data.shortages.stb}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{data.shortages.ont}</td>
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
                            <p className="text-slate-500">Comprehensive daily performance tracking with progressive summaries</p>
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
                                className="gap-2"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                            <Button className="gap-2 bg-slate-900 hover:bg-slate-800">
                                <Download className="w-4 h-4" /> Export Excel
                            </Button>
                        </div>
                    </div>

                    {/* Main Report Table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                                {/* Table headers - same as before */}
                                <thead className="bg-slate-800 text-white sticky top-0">
                                    <tr>
                                        <th rowSpan={2} className="border border-slate-600 px-2 py-2 font-semibold">Region</th>
                                        <th rowSpan={2} className="border border-slate-600 px-2 py-2 font-semibold">Province</th>
                                        <th rowSpan={2} className="border border-slate-600 px-2 py-2 font-semibold">RTOM</th>
                                        <th rowSpan={2} className="border border-slate-600 px-2 py-2 font-semibold">Regular Teams</th>
                                        <th rowSpan={2} className="border border-slate-600 px-2 py-2 font-semibold">Teams Worked</th>

                                        <th colSpan={4} className="border border-slate-600 px-2 py-2 font-semibold bg-blue-700">In Hand SOD (Morning)</th>
                                        <th colSpan={4} className="border border-slate-600 px-2 py-2 font-semibold bg-emerald-700">Received SOD</th>
                                        <th rowSpan={2} className="border border-slate-600 px-2 py-2 font-semibold bg-indigo-700">Total In Hand</th>

                                        <th colSpan={9} className="border border-slate-600 px-2 py-2 font-semibold bg-green-700">Completed</th>
                                        <th colSpan={4} className="border border-slate-600 px-2 py-2 font-semibold bg-amber-700">Material Usage</th>
                                        <th colSpan={4} className="border border-slate-600 px-2 py-2 font-semibold bg-rose-700">Returned</th>
                                        <th colSpan={4} className="border border-slate-600 px-2 py-2 font-semibold bg-purple-700">Wired Only</th>

                                        <th colSpan={8} className="border border-slate-600 px-2 py-2 font-semibold bg-orange-700">Delay Reasons</th>
                                        <th colSpan={4} className="border border-slate-600 px-2 py-2 font-semibold bg-slate-700">Balance</th>
                                        <th colSpan={2} className="border border-slate-600 px-2 py-2 font-semibold bg-red-700">Shortages</th>
                                    </tr>
                                    <tr>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-blue-600">NC</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-blue-600">RL</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-blue-600">DATA</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-blue-600">Total</th>

                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-emerald-600">NC</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-emerald-600">RL</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-emerald-600">DATA</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-emerald-600">Total</th>

                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-green-600">Create</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-green-600">Re-Con</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-green-600">Upgrade</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-green-600">F-NC</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-green-600">OR</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-green-600">ML</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-green-600">F-RL</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-green-600">DATA</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-green-600">Total</th>

                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-amber-600">DW</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-amber-600">Pole 5.6</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-amber-600">Pole 6.7</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-amber-600">Pole 8.0</th>

                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-rose-600">NC</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-rose-600">RL</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-rose-600">DATA</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-rose-600">Total</th>

                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-purple-600">NC</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-purple-600">RL</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-purple-600">DATA</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-purple-600">Total</th>

                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-orange-600">ONT Short</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-orange-600">STB Short</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-orange-600">Nokia</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-orange-600">System</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-orange-600">OPMC</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-orange-600">CX Delay</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-orange-600">Same Day</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-orange-600">Pole Pend</th>

                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-slate-600">NC</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-slate-600">RL</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-slate-600">DATA</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-slate-600">Total</th>

                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-red-600">STB</th>
                                        <th className="border border-slate-600 px-2 py-1 text-[10px] bg-red-600">ONT</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white">
                                    {reportData.length === 0 ? (
                                        <tr>
                                            <td colSpan={50} className="text-center py-8 text-slate-400">
                                                {loading ? 'Loading...' : 'No data available for selected date'}
                                            </td>
                                        </tr>
                                    ) : (
                                        <>
                                            {(() => {
                                                let currentRegion = '';
                                                const rows: any[] = [];

                                                reportData.forEach((row: any, idx: number) => {
                                                    // Add region summary before changing region
                                                    if (currentRegion && currentRegion !== row.region) {
                                                        rows.push(<SummaryRow key={`summary-${currentRegion}`} label={`${currentRegion} - TOTAL`} data={summaries[currentRegion]} />);
                                                    }

                                                    currentRegion = row.region;

                                                    // Add data row (same as before - keeping existing row structure)
                                                    rows.push(
                                                        <tr key={idx} className="hover:bg-slate-50 border-b">
                                                            <td className="border border-slate-200 px-2 py-1 text-center">{row.region}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center">{row.province}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center font-medium">{row.rtom}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center">{row.regularTeams}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center">{row.teamsWorked}</td>

                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-blue-50">{row.inHandMorning.nc}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-blue-50">{row.inHandMorning.rl}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-blue-50">{row.inHandMorning.data}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-blue-100 font-semibold">{row.inHandMorning.total}</td>

                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-emerald-50">{row.received.nc}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-emerald-50">{row.received.rl}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-emerald-50">{row.received.data}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-emerald-100 font-semibold">{row.received.total}</td>

                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-indigo-100 font-bold">{row.totalInHand}</td>

                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-green-50">{row.completed.create}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-green-50">{row.completed.recon}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-green-50">{row.completed.upgrade}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-green-50">{row.completed.fnc}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-green-50">{row.completed.or}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-green-50">{row.completed.ml}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-green-50">{row.completed.frl}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-green-50">{row.completed.data}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-green-100 font-semibold">{row.completed.total}</td>

                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-amber-50">{row.material.dw}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-amber-50">{row.material.pole56}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-amber-50">{row.material.pole67}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-amber-50">{row.material.pole80}</td>

                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-rose-50">{row.returned.nc}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-rose-50">{row.returned.rl}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-rose-50">{row.returned.data}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-rose-100 font-semibold">{row.returned.total}</td>

                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-purple-50">{row.wiredOnly.nc}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-purple-50">{row.wiredOnly.rl}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-purple-50">{row.wiredOnly.data}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-purple-100 font-semibold">{row.wiredOnly.total}</td>

                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-orange-50">{row.delays.ontShortage}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-orange-50">{row.delays.stbShortage}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-orange-50">{row.delays.nokia}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-orange-50">{row.delays.system}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-orange-50">{row.delays.opmc}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-orange-50">{row.delays.cxDelay}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-orange-50">{row.delays.sameDay}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-orange-50">{row.delays.polePending}</td>

                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-slate-50">{row.balance.nc}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-slate-50">{row.balance.rl}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-slate-50">{row.balance.data}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-slate-100 font-bold">{row.balance.total}</td>

                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-red-50">{row.shortages.stb}</td>
                                                            <td className="border border-slate-200 px-2 py-1 text-center bg-red-50">{row.shortages.ont}</td>
                                                        </tr>
                                                    );
                                                });

                                                // Add last region summary
                                                if (currentRegion && summaries[currentRegion]) {
                                                    rows.push(<SummaryRow key={`summary-${currentRegion}`} label={`${currentRegion} - TOTAL`} data={summaries[currentRegion]} />);
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
