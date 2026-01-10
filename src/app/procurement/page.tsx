"use client";

import { useQuery } from "@tanstack/react-query";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    ShoppingCart,
    FileText,
    Clock,
    CheckCircle,
    AlertCircle,
    TrendingUp,
    Package,
    DollarSign
} from "lucide-react";

export default function ProcurementOverviewPage() {
    // Fetch all procurement requests for statistics
    const { data: allRequests = [], isLoading } = useQuery({
        queryKey: ["procurement-overview"],
        queryFn: async () => {
            const res = await fetch("/api/inventory/requests");
            return res.json();
        }
    });

    // Calculate statistics
    const stats = {
        pendingPO: allRequests.filter((r: any) =>
            r.workflowStage === 'PROCUREMENT' && r.procurementStatus === 'PENDING'
        ).length,

        inProgress: allRequests.filter((r: any) =>
            r.workflowStage === 'PROCUREMENT' &&
            ['PO_CREATED', 'PO_SENT', 'PO_CONFIRMED'].includes(r.procurementStatus)
        ).length,

        readyForGRN: allRequests.filter((r: any) =>
            r.workflowStage === 'GRN_PENDING'
        ).length,

        completed: allRequests.filter((r: any) =>
            r.status === 'COMPLETED'
        ).length,

        sltRequests: allRequests.filter((r: any) =>
            r.sourceType === 'SLT' && r.workflowStage === 'PROCUREMENT'
        ).length,

        localPurchase: allRequests.filter((r: any) =>
            r.sourceType === 'LOCAL_PURCHASE' && r.workflowStage === 'PROCUREMENT'
        ).length,

        urgent: allRequests.filter((r: any) =>
            r.priority === 'URGENT' && r.workflowStage === 'PROCUREMENT'
        ).length,
    };

    // Recent activity (last 10 requests)
    const recentActivity = [...allRequests]
        .filter((r: any) => r.workflowStage === 'PROCUREMENT' || r.workflowStage === 'GRN_PENDING')
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);

    const getStatusBadge = (request: any) => {
        if (request.procurementStatus === 'PENDING') {
            return <Badge className="bg-orange-100 text-orange-700">Awaiting PO</Badge>;
        } else if (request.procurementStatus === 'PO_CREATED') {
            return <Badge className="bg-blue-100 text-blue-700">PO Created</Badge>;
        } else if (request.procurementStatus === 'PO_SENT') {
            return <Badge className="bg-purple-100 text-purple-700">PO Sent</Badge>;
        } else if (request.procurementStatus === 'PO_CONFIRMED') {
            return <Badge className="bg-indigo-100 text-indigo-700">PO Confirmed</Badge>;
        } else if (request.procurementStatus === 'COMPLETED') {
            return <Badge className="bg-green-100 text-green-700">Ready for GRN</Badge>;
        }
        return <Badge variant="outline">{request.status}</Badge>;
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {/* Header */}
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Procurement Overview</h1>
                            <p className="text-slate-500">Real-time procurement workflow insights and metrics</p>
                        </div>

                        {/* Key Metrics Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Pending PO */}
                            <Card className="border-l-4 border-l-orange-500">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-orange-500" />
                                        Pending PO Creation
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold text-slate-900">{stats.pendingPO}</div>
                                    <p className="text-xs text-slate-500 mt-1">Awaiting purchase order</p>
                                </CardContent>
                            </Card>

                            {/* In Progress */}
                            <Card className="border-l-4 border-l-blue-500">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-blue-500" />
                                        In Progress
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold text-slate-900">{stats.inProgress}</div>
                                    <p className="text-xs text-slate-500 mt-1">Active purchase orders</p>
                                </CardContent>
                            </Card>

                            {/* Ready for GRN */}
                            <Card className="border-l-4 border-l-green-500">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                        <Package className="w-4 h-4 text-green-500" />
                                        Ready for GRN
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold text-slate-900">{stats.readyForGRN}</div>
                                    <p className="text-xs text-slate-500 mt-1">Awaiting goods receipt</p>
                                </CardContent>
                            </Card>

                            {/* Completed */}
                            <Card className="border-l-4 border-l-slate-500">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-slate-500" />
                                        Completed
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold text-slate-900">{stats.completed}</div>
                                    <p className="text-xs text-slate-500 mt-1">Total completed</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Secondary Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* SLT Requests */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-slate-600">SLT Head Office</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-baseline gap-2">
                                        <div className="text-2xl font-bold text-blue-600">{stats.sltRequests}</div>
                                        <Badge variant="outline" className="text-xs">Covering POs</Badge>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Local Purchase */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-slate-600">Local Purchase</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-baseline gap-2">
                                        <div className="text-2xl font-bold text-purple-600">{stats.localPurchase}</div>
                                        <Badge variant="outline" className="text-xs">Regular POs</Badge>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Urgent */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-red-500" />
                                        Urgent Priority
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-baseline gap-2">
                                        <div className="text-2xl font-bold text-red-600">{stats.urgent}</div>
                                        <Badge className="bg-red-100 text-red-700 text-xs">Needs attention</Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Recent Activity */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <FileText className="w-5 h-5" />
                                    Recent Procurement Activity
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="text-center p-8 text-slate-500">Loading...</div>
                                ) : recentActivity.length === 0 ? (
                                    <div className="text-center p-8 text-slate-500">No recent activity</div>
                                ) : (
                                    <div className="space-y-3">
                                        {recentActivity.map((req: any) => (
                                            <div
                                                key={req.id}
                                                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                                            >
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-sm">{req.requestNr}</span>
                                                        <Badge variant="outline" className="text-xs">
                                                            {req.sourceType === 'SLT' ? 'SLT' : 'Local'}
                                                        </Badge>
                                                        {req.priority === 'URGENT' && (
                                                            <Badge className="bg-red-500 text-xs">URGENT</Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-1">
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
                        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                            <CardHeader>
                                <CardTitle className="text-lg">Quick Actions</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <a
                                        href="/procurement/orders"
                                        className="flex items-center gap-3 p-4 bg-white rounded-lg border border-blue-200 hover:border-blue-400 hover:shadow-md transition-all group"
                                    >
                                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                                            <ShoppingCart className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-sm">Manage Purchase Orders</div>
                                            <div className="text-xs text-slate-500">Create and track POs</div>
                                        </div>
                                    </a>

                                    <a
                                        href="/procurement/approvals"
                                        className="flex items-center gap-3 p-4 bg-white rounded-lg border border-blue-200 hover:border-blue-400 hover:shadow-md transition-all group"
                                    >
                                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                                            <CheckCircle className="w-5 h-5 text-green-600" />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-sm">View Approvals</div>
                                            <div className="text-xs text-slate-500">Manager approval queue</div>
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
