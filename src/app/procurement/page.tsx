"use client";

import { useQuery } from "@tanstack/react-query";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    ShoppingCart,
    FileText,
    Clock,
    CheckCircle,
    TrendingUp,
    Package,
    Loader2
} from "lucide-react";

interface OverviewRequestItem {
    id: string;
    requestedQty: number;
    item?: {
        name: string;
        unit?: string | null;
    } | null;
}

interface OverviewRequest {
    id: string;
    requestNr: string;
    createdAt: string;
    toStoreId?: string | null;
    sourceType?: string | null;
    priority: string;
    status: string;
    workflowStage: string;
    procurementStatus?: string | null;
    poNumber?: string | null;
    items?: OverviewRequestItem[];
}

export default function ProcurementOverviewPage() {
    // Fetch all procurement requests for statistics
    const { data: allRequests = [], isLoading } = useQuery<OverviewRequest[]>({
        queryKey: ["procurement-overview"],
        queryFn: async () => {
            const res = await fetch("/api/inventory/requests");
            return res.json();
        }
    });

    // Calculate statistics
    const stats = {
        pendingPO: allRequests.filter((r: OverviewRequest) =>
            r.workflowStage === 'PROCUREMENT' && r.procurementStatus === 'PENDING'
        ).length,

        inProgress: allRequests.filter((r: OverviewRequest) =>
            r.workflowStage === 'PROCUREMENT' &&
            ['PO_CREATED', 'PO_SENT', 'PO_CONFIRMED'].includes(r.procurementStatus || '')
        ).length,

        readyForGRN: allRequests.filter((r: OverviewRequest) =>
            r.workflowStage === 'GRN_PENDING'
        ).length,

        completed: allRequests.filter((r: OverviewRequest) =>
            r.status === 'COMPLETED'
        ).length,

        sltRequests: allRequests.filter((r: OverviewRequest) =>
            r.sourceType === 'SLT' && r.workflowStage === 'PROCUREMENT'
        ).length,

        localPurchase: allRequests.filter((r: OverviewRequest) =>
            r.sourceType === 'LOCAL_PURCHASE' && r.workflowStage === 'PROCUREMENT'
        ).length,

        urgent: allRequests.filter((r: OverviewRequest) =>
            r.priority === 'URGENT' && r.workflowStage === 'PROCUREMENT'
        ).length,
    };

    // Recent activity (last 10 requests)
    const recentActivity = [...allRequests]
        .filter((r: OverviewRequest) => r.workflowStage === 'PROCUREMENT' || r.workflowStage === 'GRN_PENDING')
        .sort((a: OverviewRequest, b: OverviewRequest) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);

    const getStatusBadge = (request: OverviewRequest) => {
        if (request.procurementStatus === 'PENDING') {
            return <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-black px-2 py-0.5">Awaiting PO</Badge>;
        } else if (request.procurementStatus === 'PO_CREATED') {
            return <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-black px-2 py-0.5">PO Created</Badge>;
        } else if (request.procurementStatus === 'PO_SENT') {
            return <Badge className="bg-purple-50 text-purple-700 border border-purple-200 text-[9px] font-black px-2 py-0.5">PO Sent</Badge>;
        } else if (request.procurementStatus === 'PO_CONFIRMED') {
            return <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] font-black px-2 py-0.5">PO Confirmed</Badge>;
        } else if (request.procurementStatus === 'COMPLETED') {
            return <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black px-2 py-0.5">Ready for GRN</Badge>;
        }
        return <Badge variant="outline" className="text-[9px] font-bold">{request.status}</Badge>;
    };

    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50">
                    <div className="max-w-7xl mx-auto space-y-4">
                        {/* Header */}
                        <div className="space-y-0.5">
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">Procurement Overview</h1>
                            <p className="text-xs text-slate-500">Real-time procurement workflow insights and metrics</p>
                        </div>

                        {/* Key Metrics Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* Pending PO */}
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pending PO Creation</p>
                                        <p className="text-2xl font-black text-slate-900 mt-1">{stats.pendingPO}</p>
                                        <p className="text-[10px] text-slate-500 font-semibold mt-1">Awaiting purchase order</p>
                                    </div>
                                    <div className="h-10 w-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100 flex-shrink-0">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* In Progress */}
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">In Progress</p>
                                        <p className="text-2xl font-black text-slate-900 mt-1">{stats.inProgress}</p>
                                        <p className="text-[10px] text-slate-500 font-semibold mt-1">Active purchase orders</p>
                                    </div>
                                    <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 flex-shrink-0">
                                        <TrendingUp className="w-5 h-5" />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Ready for GRN */}
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ready for GRN</p>
                                        <p className="text-2xl font-black text-slate-900 mt-1">{stats.readyForGRN}</p>
                                        <p className="text-[10px] text-slate-500 font-semibold mt-1">Awaiting goods receipt</p>
                                    </div>
                                    <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 flex-shrink-0">
                                        <Package className="w-5 h-5" />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Completed */}
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Completed</p>
                                        <p className="text-2xl font-black text-slate-900 mt-1">{stats.completed}</p>
                                        <p className="text-[10px] text-slate-500 font-semibold mt-1">Total completed</p>
                                    </div>
                                    <div className="h-10 w-10 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-100 flex-shrink-0">
                                        <CheckCircle className="w-5 h-5" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Secondary Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* SLT Requests */}
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3.5 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">SLT Head Office</p>
                                        <p className="text-xl font-black text-blue-600 mt-1">{stats.sltRequests}</p>
                                    </div>
                                    <Badge variant="outline" className="text-[9px] font-bold border-blue-200 bg-blue-50/50 text-blue-700">Covering POs</Badge>
                                </CardContent>
                            </Card>

                            {/* Local Purchase */}
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3.5 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Local Purchase</p>
                                        <p className="text-xl font-black text-purple-600 mt-1">{stats.localPurchase}</p>
                                    </div>
                                    <Badge variant="outline" className="text-[9px] font-bold border-purple-200 bg-purple-50/50 text-purple-700">Regular POs</Badge>
                                </CardContent>
                            </Card>

                            {/* Urgent */}
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3.5 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Urgent Priority</p>
                                        <p className="text-xl font-black text-red-600 mt-1">{stats.urgent}</p>
                                    </div>
                                    <Badge className="text-[9px] font-bold border-red-200 bg-red-50 text-red-700 border">Needs Attention</Badge>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Recent Activity */}
                        <Card className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                            <CardHeader className="border-b border-slate-100 py-3.5 px-4 bg-slate-50/50">
                                <CardTitle className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-slate-500" />
                                    Recent Procurement Activity
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4">
                                {isLoading ? (
                                    <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                                        <span className="text-[10px] font-black uppercase tracking-wider animate-pulse">Loading Activity...</span>
                                    </div>
                                ) : recentActivity.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400 text-xs font-semibold">No recent activity</div>
                                ) : (
                                    <div className="space-y-2">
                                        {recentActivity.map((req: OverviewRequest) => (
                                            <div
                                                key={req.id}
                                                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100/60 transition-colors border border-slate-200/50"
                                            >
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-xs text-slate-800 font-mono">{req.requestNr}</span>
                                                        <Badge variant="outline" className={cn(
                                                            "text-[9px] font-bold border-none px-1.5 py-0",
                                                            req.sourceType === 'SLT' ? 'bg-indigo-50 text-indigo-700' : 'bg-sky-50 text-sky-700'
                                                        )}>
                                                            {req.sourceType === 'SLT' ? 'SLT Head Office' : 'Local Purchase'}
                                                        </Badge>
                                                        {req.priority === 'URGENT' && (
                                                            <Badge className="bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-black leading-none px-1.5 py-0">URGENT</Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-semibold mt-1">
                                                        {req.items?.length || 0} items •
                                                        Created {new Date(req.createdAt).toLocaleDateString()}
                                                        {req.poNumber && ` • PO: ${req.poNumber}`}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {getStatusBadge(req)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Quick Actions */}
                        <Card className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 border border-blue-100 rounded-xl overflow-hidden shadow-sm">
                            <CardHeader className="py-3 px-4 border-b border-blue-100 bg-white/40">
                                <CardTitle className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Quick Actions</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <a
                                        href="/procurement/orders"
                                        className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all group"
                                    >
                                        <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-100 transition-colors border border-blue-100/50 flex-shrink-0">
                                            <ShoppingCart className="w-4.5 h-4.5" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-xs text-slate-800">Manage Purchase Orders</div>
                                            <div className="text-[10px] text-slate-500 font-medium mt-0.5">Create and track procurement orders</div>
                                        </div>
                                    </a>

                                    <a
                                        href="/procurement/approvals"
                                        className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all group"
                                    >
                                        <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-100 transition-colors border border-emerald-100/50 flex-shrink-0">
                                            <CheckCircle className="w-4.5 h-4.5" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-xs text-slate-800">View Approvals</div>
                                            <div className="text-[10px] text-slate-500 font-medium mt-0.5">Manager approval and review queue</div>
                                        </div>
                                    </a>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}
