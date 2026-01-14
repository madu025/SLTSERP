"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
    Download,
    RefreshCw,
    Search,
    CheckCircle2,
    XCircle,
    Clock,
    FileText,
    Check,
    Filter
} from "lucide-react";

export default function PatSodSyncPage() {
    const queryClient = useQueryClient();
    const [selectedRtomId, setSelectedRtomId] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [patFilter, setPatFilter] = useState("READY");
    const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
    const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));
    const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

    // Fetch OPMCs (RTOMs)
    const { data: opmcs = [] } = useQuery<any[]>({
        queryKey: ["opmcs"],
        queryFn: async () => {
            const res = await fetch("/api/opmcs");
            return res.json();
        }
    });

    useEffect(() => {
        if (opmcs.length > 0 && !selectedRtomId) {
            setSelectedRtomId(opmcs[0].id);
        }
    }, [opmcs, selectedRtomId]);

    // Fetch Completed SODs for PAT/Invoicing
    const { data: sodData, isLoading, refetch } = useQuery({
        queryKey: ["pat-sod-list", selectedRtomId, patFilter, selectedYear, selectedMonth, searchTerm],
        queryFn: async () => {
            if (!selectedRtomId) return { items: [] };
            const params = new URLSearchParams({
                rtomId: selectedRtomId,
                filter: 'completed',
                patFilter: patFilter,
                year: selectedYear,
                month: selectedMonth,
                search: searchTerm,
                limit: '200' // Show more for checking
            });
            const res = await fetch(`/api/service-orders?${params.toString()}`);
            return res.json();
        },
        enabled: !!selectedRtomId
    });

    const orders = sodData?.items || [];

    const handleSync = async () => {
        const opmc = opmcs.find(o => o.id === selectedRtomId);
        if (!opmc) return;

        const toastId = toast.loading(`Syncing PAT results for ${opmc.rtom}...`);
        try {
            const res = await fetch("/api/service-orders/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rtomId: selectedRtomId, rtom: opmc.rtom })
            });
            const data = await res.json();
            toast.success(`Sync Complete: ${data.updated} orders updated with latest PAT results`, { id: toastId });
            refetch();
        } catch (error) {
            toast.error("Sync failed", { id: toastId });
        }
    };

    const handleDownloadCSV = () => {
        if (orders.length === 0) {
            toast.error("No data to download");
            return;
        }

        const headers = [
            "SO Number", "Voice Number", "RTOM", "Package", "Completed Date",
            "SLTS PAT", "OPMC PAT", "HO PAT", "Invoicable",
            "Distance (m)", "Revenue (LKR)", "Contractor Pay (LKR)", "Material Cost (LKR)", "Net Profit (LKR)"
        ];

        const rows = orders.map((o: any) => {
            const matCost = o.materialUsage?.reduce((sum: number, mu: any) => sum + (mu.quantity * (mu.costPrice || 0)), 0) || 0;
            const netProfit = (o.isInvoicable ? (o.revenueAmount || 0) : 0) - (o.contractorAmount || 0) - matCost;
            return [
                `"${o.soNum}"`,
                `"${o.voiceNumber || ''}"`,
                `"${o.rtom}"`,
                `"${o.serviceType || ''}"`,
                `"${o.completedDate ? new Date(o.completedDate).toLocaleDateString() : ''}"`,
                `"${o.sltsPatStatus || 'PENDING'}"`,
                `"${o.opmcPatStatus || 'PENDING'}"`,
                `"${o.hoPatStatus || 'PENDING'}"`,
                `"${o.isInvoicable ? 'YES' : 'NO'}"`,
                o.dropWireDistance || 0,
                o.revenueAmount || 0,
                o.contractorAmount || 0,
                matCost,
                netProfit
            ];
        });

        const csvContent = [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `PAT_SOD_Export_${selectedYear}_${selectedMonth}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("CSV Downloaded");
    };

    const toggleOrderSelection = (id: string) => {
        setSelectedOrders(prev =>
            prev.includes(id) ? prev.filter(oid => oid !== id) : [...prev, id]
        );
    };

    const toggleAll = () => {
        if (selectedOrders.length === orders.length) setSelectedOrders([]);
        else setSelectedOrders(orders.map((o: any) => o.id));
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <Header />

                <main className="p-6 overflow-y-auto">
                    <div className="max-w-7xl mx-auto space-y-6">

                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">PAT SOD (Invoicing Sync)</h1>
                                <p className="text-sm text-slate-500 mt-1">Verify and sync completed SODs with SLT PAT results for invoicing.</p>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={handleSync} variant="outline" className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50">
                                    <RefreshCw className="w-4 h-4" /> Sync PAT
                                </Button>
                                <Button onClick={handleDownloadCSV} disabled={orders.length === 0} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                                    <Download className="w-4 h-4" /> Download List
                                </Button>
                            </div>
                        </div>

                        {/* Filters Card */}
                        <Card className="border-slate-200 shadow-sm">
                            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">RTOM</label>
                                    <Select value={selectedRtomId} onValueChange={setSelectedRtomId}>
                                        <SelectTrigger className="h-9"><SelectValue placeholder="All RTOMs" /></SelectTrigger>
                                        <SelectContent>
                                            {opmcs.map(o => <SelectItem key={o.id} value={o.id}>{o.rtom} - {o.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Year</label>
                                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {[2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Month</label>
                                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                <SelectItem key={m} value={String(m)}>
                                                    {new Date(0, m - 1).toLocaleString('default', { month: 'long' })}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">PAT Status</label>
                                    <Select value={patFilter} onValueChange={setPatFilter}>
                                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="READY">Ready for Invoice (Pass)</SelectItem>
                                            <SelectItem value="HO_PASS">HO Passed Only</SelectItem>
                                            <SelectItem value="PENDING">Pending (Still Open)</SelectItem>
                                            <SelectItem value="HO_REJECTED">HO Rejected</SelectItem>
                                            <SelectItem value="ALL">All Completed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Search</label>
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                        <Input
                                            placeholder="SO Number..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-9 h-9"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Card className="border-slate-200 shadow-sm bg-blue-50/20">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Completed SODs</p>
                                        <p className="text-2xl font-bold text-slate-900">{orders.length}</p>
                                        <p className="text-[10px] text-slate-400 font-medium">Potential Rev: Rs. {orders.reduce((sum: number, o: any) => sum + (o.revenueAmount || 0), 0).toLocaleString()}</p>
                                    </div>
                                    <FileText className="w-8 h-8 text-blue-200" />
                                </CardContent>
                            </Card>
                            <Card className="border-slate-200 shadow-sm bg-emerald-50/20">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">PAT Approved Revenue</p>
                                        <p className="text-2xl font-bold text-emerald-700">
                                            Rs. {orders.filter((o: any) => o.isInvoicable).reduce((sum: number, o: any) => sum + (o.revenueAmount || 0), 0).toLocaleString()}
                                        </p>
                                        <p className="text-[10px] text-emerald-600/60 font-medium">{orders.filter((o: any) => o.isInvoicable).length} Approved SODs</p>
                                    </div>
                                    <CheckCircle2 className="w-8 h-8 text-emerald-200" />
                                </CardContent>
                            </Card>
                            <Card className="border-slate-200 shadow-sm bg-rose-50/20">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">Material Cost (Snapshot)</p>
                                        <p className="text-2xl font-bold text-rose-700">
                                            Rs. {orders.reduce((sum: number, o: any) => {
                                                const matCost = o.materialUsage?.reduce((mSum: number, mu: any) => mSum + (mu.quantity * (mu.costPrice || 0)), 0) || 0;
                                                return sum + matCost;
                                            }, 0).toLocaleString()}
                                        </p>
                                        <p className="text-[10px] text-rose-600/60 font-medium">Internal Cost to SLTS</p>
                                    </div>
                                    <Clock className="w-8 h-8 text-rose-200" />
                                </CardContent>
                            </Card>
                            <Card className="border-slate-200 shadow-sm bg-indigo-50/20">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Projected Profit</p>
                                        <p className="text-2xl font-bold text-indigo-700">
                                            Rs. {orders.reduce((sum: number, o: any) => {
                                                const rev = o.isInvoicable ? (o.revenueAmount || 0) : 0;
                                                const pay = o.contractorAmount || 0;
                                                const matCost = o.materialUsage?.reduce((mSum: number, mu: any) => mSum + (mu.quantity * (mu.costPrice || 0)), 0) || 0;
                                                return sum + (rev - pay - matCost);
                                            }, 0).toLocaleString()}
                                        </p>
                                        <p className="text-[10px] text-indigo-600/60 font-medium">After Contractor & Material</p>
                                    </div>
                                    <RefreshCw className="w-8 h-8 text-indigo-200" />
                                </CardContent>
                            </Card>
                        </div>

                        {/* Data Table */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                                        <tr>
                                            <th className="px-4 py-3 w-10">
                                                <Checkbox checked={selectedOrders.length === orders.length && orders.length > 0} onCheckedChange={toggleAll} />
                                            </th>
                                            <th className="px-4 py-3">SO Details</th>
                                            <th className="px-4 py-3">Completed On</th>
                                            <th className="px-4 py-3">PAT Status (SLTS/HO)</th>
                                            <th className="px-4 py-3">Finance Split (Rev / Cost)</th>
                                            <th className="px-4 py-3 text-center">Invoicable</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {isLoading ? (
                                            <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Loading orders...</td></tr>
                                        ) : orders.length === 0 ? (
                                            <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No orders found matching filters.</td></tr>
                                        ) : orders.map((order: any) => {
                                            const matCost = order.materialUsage?.reduce((sum: number, mu: any) => sum + (mu.quantity * (mu.costPrice || 0)), 0) || 0;
                                            return (
                                                <tr key={order.id} className={`hover:bg-slate-50/80 transition-colors ${selectedOrders.includes(order.id) ? 'bg-blue-50/30' : ''}`}>
                                                    <td className="px-4 py-3">
                                                        <Checkbox checked={selectedOrders.includes(order.id)} onCheckedChange={() => toggleOrderSelection(order.id)} />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-bold text-slate-900">{order.soNum}</div>
                                                        <div className="text-[10px] text-slate-500 uppercase">{order.voiceNumber || 'No Voice'} | {order.serviceType}</div>
                                                        <div className="text-[11px] text-slate-700 truncate max-w-[200px]">{order.customerName}</div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2 text-slate-600">
                                                            <Clock className="w-3.5 h-3.5" />
                                                            {order.completedDate ? new Date(order.completedDate).toLocaleDateString() : '-'}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex gap-1.5 flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase w-8">SLTS:</span>
                                                                <Badge variant="outline" className={`text-[10px] h-5 py-0 ${order.sltsPatStatus === 'PASS' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'}`}>
                                                                    {order.sltsPatStatus || 'PENDING'}
                                                                </Badge>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase w-8">HO:</span>
                                                                <Badge variant="outline" className={`text-[10px] h-5 py-0 ${order.hoPatStatus === 'PASS' ? 'bg-blue-50 text-blue-700' :
                                                                    order.hoPatStatus === 'REJECTED' ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-500'}`}>
                                                                    {order.hoPatStatus || 'PENDING'}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="space-y-0.5 min-w-[140px]">
                                                            <div className="flex justify-between text-[11px]">
                                                                <span className="text-slate-500">Revenue:</span>
                                                                <span className={`font-bold ${order.isInvoicable ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                                    Rs. {order.revenueAmount?.toLocaleString()}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between text-[11px]">
                                                                <span className="text-slate-500">Contractor:</span>
                                                                <span className="font-bold text-rose-500">Rs. {order.contractorAmount?.toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex justify-between text-[11px]">
                                                                <span className="text-slate-500">Material Cost:</span>
                                                                <span className="font-bold text-amber-600">Rs. {matCost.toLocaleString()}</span>
                                                            </div>
                                                            <div className="pt-0.5 mt-0.5 border-t border-slate-100 flex justify-between text-[10px]">
                                                                <span className="font-bold uppercase text-slate-400">Net Profit:</span>
                                                                <span className={`font-bold ${((order.isInvoicable ? order.revenueAmount : 0) - order.contractorAmount - matCost) > 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                                                                    Rs. {((order.isInvoicable ? (order.revenueAmount || 0) : 0) - (order.contractorAmount || 0) - matCost).toLocaleString()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {order.isInvoicable ? (
                                                            <div className="flex flex-col items-center gap-1">
                                                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                                                <span className="text-[9px] font-bold text-emerald-600 uppercase">Ready</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-1 opacity-50">
                                                                <Clock className="w-5 h-5 text-slate-400" />
                                                                <span className="text-[9px] font-bold text-slate-500 uppercase">Wait</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {selectedOrders.length > 0 && (
                            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white px-6 py-3 rounded-full shadow-2xl border border-slate-200 flex items-center gap-4 animate-in slide-in-from-bottom-10 duration-500 z-50">
                                <span className="text-sm font-bold text-slate-700">{selectedOrders.length} Orders Selected</span>
                                <div className="w-[1px] h-6 bg-slate-200" />
                                <Button variant="outline" size="sm" onClick={() => setSelectedOrders([])}>Clear</Button>
                                <Button size="sm" className="bg-blue-600">Mark as Invoiced (Coming Soon)</Button>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
