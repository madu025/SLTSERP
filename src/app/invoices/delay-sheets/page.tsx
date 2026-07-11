'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    FileText,
    Download,
    Search,
    RefreshCw,
    Clock,
    AlertCircle,
    Package,
    UserCheck,
    HelpCircle
} from 'lucide-react';
import { generateDelaySheetPDF } from '@/utils/pdfGenerator';
import { toast } from 'sonner';

interface DelayedOrder {
    id: string;
    soNum: string;
    voiceNumber: string;
    rtom: string;
    opmcName: string;
    customerName: string;
    address: string;
    status: string;
    sltsStatus: string;
    receivedDate: string;
    statusDate: string;
    stbShortage: boolean;
    ontShortage: boolean;
    ontType: string | null;
    reasons: string[];
    comments: string;
    contractorName: string;
}

interface Stats {
    total: number;
    ontShortage: number;
    stbShortage: number;
    cxDelay: number;
    other: number;
}

export default function DelaySheetsPage() {
    const [month, setMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [selectedRtom, setSelectedRtom] = useState('ALL');
    const [rtoms, setRtoms] = useState<string[]>([]);
    const [orders, setOrders] = useState<DelayedOrder[]>([]);
    const [stats, setStats] = useState<Stats>({
        total: 0,
        ontShortage: 0,
        stbShortage: 0,
        cxDelay: 0,
        other: 0
    });
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [userRole, setUserRole] = useState<string | null>(null);

    // Get User Role on mount
    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const u = JSON.parse(userStr);
                setUserRole(u.role);
            } catch (e) {
                console.error(e);
            }
        }
    }, []);

    const fetchDelayData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/invoices/delay-sheets?month=${month}&rtom=${selectedRtom}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to fetch delay sheet data');
            
            setOrders(data.orders || []);
            setStats(data.stats || { total: 0, ontShortage: 0, stbShortage: 0, cxDelay: 0, other: 0 });
            setRtoms(data.rtoms || []);
        } catch (err: any) {
            toast.error(err.message || 'Error fetching delay sheets');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDelayData();
    }, [month, selectedRtom]); // eslint-disable-line react-hooks/exhaustive-deps

    // Client-side search filtering
    const filteredOrders = useMemo(() => {
        if (!searchQuery) return orders;
        const q = searchQuery.toLowerCase();
        return orders.filter(
            o =>
                o.soNum.toLowerCase().includes(q) ||
                o.voiceNumber.toLowerCase().includes(q) ||
                o.customerName.toLowerCase().includes(q) ||
                o.contractorName.toLowerCase().includes(q) ||
                o.rtom.toLowerCase().includes(q) ||
                o.comments.toLowerCase().includes(q) ||
                o.reasons.some(r => r.toLowerCase().includes(q))
        );
    }, [orders, searchQuery]);

    // Handle PDF Download
    const handleDownloadPDF = () => {
        if (filteredOrders.length === 0) {
            toast.warning('No delayed orders to print.');
            return;
        }
        toast.info('Generating PDF document...');
        generateDelaySheetPDF(month, selectedRtom, filteredOrders);
        toast.success('PDF generated successfully!');
    };

    // Handle CSV Export
    const handleDownloadCSV = () => {
        if (filteredOrders.length === 0) {
            toast.warning('No data to export.');
            return;
        }

        const headers = ["SO Number", "Circuit/Voice Number", "RTOM", "OPMC", "Contractor", "Customer Name", "Received Date", "Reasons", "Comments"];
        const rows = filteredOrders.map(o => [
            o.soNum,
            o.voiceNumber,
            o.rtom,
            o.opmcName,
            o.contractorName,
            o.customerName,
            o.receivedDate,
            o.reasons.join(" | "),
            o.comments.replace(/,/g, ' ')
        ]);

        const csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Delay_Sheet_${month}_${selectedRtom}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('CSV exported successfully!');
    };

    return (
        <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header />
                <main className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Header bar */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                        <div>
                            <div className="flex items-center gap-2.5">
                                <span className="p-2 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20">
                                    <Clock className="w-5 h-5" />
                                </span>
                                <h1 className="text-2xl font-black tracking-tight text-white">Month-End Delay Sheets</h1>
                            </div>
                            <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                                Review and generate hard copy signed logs for delayed Service Provisioning connection orders to SLT.
                            </p>
                        </div>

                        {/* Controls */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="month-select" className="text-[10px] uppercase font-bold text-slate-400">Target Month</Label>
                                <Input
                                    id="month-select"
                                    type="month"
                                    value={month}
                                    onChange={(e) => setMonth(e.target.value)}
                                    className="bg-slate-900 border-slate-700 text-white rounded-lg h-9 w-40 text-xs"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="rtom-select" className="text-[10px] uppercase font-bold text-slate-400">RTOM Filter</Label>
                                <select
                                    id="rtom-select"
                                    value={selectedRtom}
                                    onChange={(e) => setSelectedRtom(e.target.value)}
                                    className="bg-slate-900 border border-slate-700 text-white rounded-lg h-9 px-3 w-36 text-xs focus:ring-1 focus:ring-indigo-500"
                                >
                                    <option value="ALL">All RTOMs</option>
                                    {rtoms.map(r => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-end h-full pt-6">
                                <Button
                                    onClick={fetchDelayData}
                                    variant="outline"
                                    className="border-slate-700 hover:bg-slate-800 text-slate-200 h-9 px-3"
                                    disabled={loading}
                                >
                                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Stats Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-md hover:border-slate-700 transition-all duration-300">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Delayed</p>
                                    <p className="text-2xl font-black text-white">{stats.total}</p>
                                </div>
                                <span className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/20">
                                    <AlertCircle className="w-5 h-5" />
                                </span>
                            </CardContent>
                        </Card>

                        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-md hover:border-slate-700 transition-all duration-300">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">ONT Shortage</p>
                                    <p className="text-2xl font-black text-amber-500">{stats.ontShortage}</p>
                                </div>
                                <span className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20">
                                    <Package className="w-5 h-5" />
                                </span>
                            </CardContent>
                        </Card>

                        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-md hover:border-slate-700 transition-all duration-300">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">STB Shortage</p>
                                    <p className="text-2xl font-black text-indigo-400">{stats.stbShortage}</p>
                                </div>
                                <span className="p-2.5 bg-indigo-500/10 text-indigo-450 rounded-xl border border-indigo-500/20">
                                    <Package className="w-5 h-5" />
                                </span>
                            </CardContent>
                        </Card>

                        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-md hover:border-slate-700 transition-all duration-300">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Customer Delay</p>
                                    <p className="text-2xl font-black text-sky-400">{stats.cxDelay}</p>
                                </div>
                                <span className="p-2.5 bg-sky-500/10 text-sky-500 rounded-xl border border-sky-500/20">
                                    <UserCheck className="w-5 h-5" />
                                </span>
                            </CardContent>
                        </Card>

                        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-md hover:border-slate-700 transition-all duration-300">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Other Delays</p>
                                    <p className="text-2xl font-black text-teal-400">{stats.other}</p>
                                </div>
                                <span className="p-2.5 bg-teal-500/10 text-teal-500 rounded-xl border border-teal-500/20">
                                    <HelpCircle className="w-5 h-5" />
                                </span>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Table Filters & Download bar */}
                    <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-sm">
                        {/* Search */}
                        <div className="relative w-full md:max-w-xs">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                            <Input
                                placeholder="Search delay sheets..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-slate-900 border-slate-700/80 text-white rounded-xl text-xs h-9"
                            />
                        </div>

                        {/* Downloads */}
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <Button
                                onClick={handleDownloadCSV}
                                variant="outline"
                                className="flex-1 md:flex-initial h-9 border-slate-700 hover:bg-slate-800 hover:text-white gap-2 text-xs font-bold"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>Export CSV</span>
                            </Button>
                            <Button
                                onClick={handleDownloadPDF}
                                className="flex-1 md:flex-initial h-9 bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2 text-xs shadow-md shadow-amber-900/20"
                            >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Download PDF (Sign Copy)</span>
                            </Button>
                        </div>
                    </div>

                    {/* Delay Sheets Table */}
                    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-lg">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" />
                                <p className="text-slate-400 text-xs">Loading delayed connections database...</p>
                            </div>
                        ) : filteredOrders.length === 0 ? (
                            <div className="text-center py-16">
                                <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                                <h3 className="text-white font-bold text-sm">No Delayed Orders Found</h3>
                                <p className="text-slate-500 text-[11px] mt-1">No delayed service orders match the selected month and filters.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider">
                                            <th className="p-4 w-12 text-center">#</th>
                                            <th className="p-4">SO Number</th>
                                            <th className="p-4">Circuit No.</th>
                                            <th className="p-4">RTOM</th>
                                            <th className="p-4">Customer Name</th>
                                            <th className="p-4">Received Date</th>
                                            <th className="p-4">Delay Reasons</th>
                                            <th className="p-4">Contractor</th>
                                            <th className="p-4">Remarks / Comments</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                        {filteredOrders.map((o, idx) => (
                                            <tr key={o.id} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="p-4 text-center text-slate-500">{idx + 1}</td>
                                                <td className="p-4 font-mono font-bold text-indigo-400">{o.soNum}</td>
                                                <td className="p-4 font-mono text-slate-300">{o.voiceNumber}</td>
                                                <td className="p-4">
                                                    <Badge variant="outline" className="bg-slate-950 border-slate-800 text-slate-400 text-[10px]">
                                                        {o.rtom}
                                                    </Badge>
                                                </td>
                                                <td className="p-4 text-slate-200 font-medium">{o.customerName}</td>
                                                <td className="p-4 text-slate-400">{o.receivedDate}</td>
                                                <td className="p-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {o.reasons.map(r => (
                                                            <Badge
                                                                key={r}
                                                                className={`text-[9px] px-1.5 py-0.5 rounded-md ${
                                                                    r === 'ONT Shortage' || r === 'STB Shortage'
                                                                        ? 'bg-rose-500/10 text-rose-450 border border-rose-500/20'
                                                                        : r === 'Customer Delay'
                                                                        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                                                                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                                }`}
                                                            >
                                                                {r}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-slate-400">{o.contractorName}</td>
                                                <td className="p-4 text-slate-300 max-w-xs truncate" title={o.comments}>
                                                    {o.comments}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
