"use client";

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    ShoppingCart, 
    AlertTriangle, 
    Truck, 
    FileText, 
    CheckCircle2, 
    ArrowUpRight, 
    Clock, 
    Building2, 
    Package, 
    Calendar, 
    Layers,
    PlusCircle,
    BadgeCheck
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface LowStockItem {
    quantity: number;
    item?: { id: string; name: string; code?: string | null; unit?: string | null } | null;
    store?: { id: string; name: string } | null;
}

interface PendingRequest {
    id: string;
    requestNr: string;
    priority: string;
    createdAt: string;
    status: string;
    workflowStage: string;
    requestedBy?: { id: string; name: string } | null;
    toStore?: { id: string; name: string } | null;
    _count?: { items: number };
}

interface ActivePO {
    id: string;
    requestNr: string;
    poNumber?: string | null;
    vendor?: string | null;
    expectedDelivery?: string | null;
    procurementStatus?: string | null;
    createdAt: string;
    requestedBy?: { id: string; name: string } | null;
    _count?: { items: number };
}

interface ProcurementTelemetry {
    pendingPRNs: number;
    openPOs: number;
    completedPOs: number;
    pendingGRNs: number;
    lowStockItems: LowStockItem[];
    recentPendingRequests: PendingRequest[];
    recentActivePOs: ActivePO[];
    updatedAt?: string;
}

export default function ProcurementSection({ rtom = 'ALL' }: { rtom?: string }) {
    const { data, isLoading, error } = useQuery<ProcurementTelemetry>({
        queryKey: ['dashboard-procurement-telemetry', rtom],
        queryFn: async () => {
            const res = await fetch(`/api/dashboard/procurement?rtom=${rtom}&_t=${Date.now()}`);
            if (!res.ok) {
                // Fallback to direct inventory & requests if endpoint fallback is needed
                const [inventoryRes, reqRes] = await Promise.all([
                    fetch(`/api/dashboard/inventory?rtom=${rtom}`).then(r => r.ok ? r.json() : { lowStockItems: [], pendingGRNs: 0 }),
                    fetch(`/api/inventory/requests?workflowStage=PROCUREMENT_PROCESSING,PROCUREMENT`).then(r => r.ok ? r.json() : [])
                ]);

                const pendingPRNs = Array.isArray(reqRes) ? reqRes.filter((r: { procurementStatus?: string }) => !r.procurementStatus || r.procurementStatus === 'PENDING').length : 0;
                const openPOs = Array.isArray(reqRes) ? reqRes.filter((r: { procurementStatus?: string }) => ['PO_CREATED', 'PO_SENT', 'PO_CONFIRMED'].includes(r.procurementStatus || '')).length : 0;

                return {
                    pendingPRNs,
                    openPOs,
                    completedPOs: 0,
                    pendingGRNs: inventoryRes.pendingGRNs || 0,
                    lowStockItems: inventoryRes.lowStockItems || [],
                    recentPendingRequests: Array.isArray(reqRes) ? reqRes.slice(0, 5) : [],
                    recentActivePOs: []
                };
            }
            return res.json();
        },
        staleTime: 2 * 60 * 1000,
        refetchInterval: 30 * 1000,
    });

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array(4).fill(0).map((_, i) => (
                        <Skeleton key={i} className="h-28 rounded-2xl" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
                    <Skeleton className="h-72 rounded-2xl" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs font-semibold">
                Failed to load real-time procurement telemetry data.
            </div>
        );
    }

    const pendingPRNs = data?.pendingPRNs || 0;
    const openPOs = data?.openPOs || 0;
    const completedPOs = data?.completedPOs || 0;
    const pendingGRNs = data?.pendingGRNs || 0;
    const lowStockItems = data?.lowStockItems || [];
    const recentPendingRequests = data?.recentPendingRequests || [];
    const recentActivePOs = data?.recentActivePOs || [];

    const getPriorityBadge = (priority: string) => {
        switch (priority?.toUpperCase()) {
            case 'URGENT':
                return <Badge className="bg-rose-500 text-white font-mono text-[10px] animate-pulse">URGENT</Badge>;
            case 'HIGH':
                return <Badge className="bg-amber-500 text-white font-mono text-[10px]">HIGH</Badge>;
            case 'MEDIUM':
                return <Badge variant="secondary" className="font-mono text-[10px]">MEDIUM</Badge>;
            default:
                return <Badge variant="outline" className="font-mono text-[10px]">NORMAL</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            {/* 1. Executive Telemetry Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Pending Requisitions */}
                <Link href="/procurement/orders?tab=PENDING" className="group">
                    <Card className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/30 dark:border-amber-500/20 shadow-sm hover:shadow-md transition-all rounded-2xl cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-5">
                            <CardTitle className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                Pending PRNs (Awaiting PO)
                            </CardTitle>
                            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                                <FileText className="w-4 h-4" />
                            </div>
                        </CardHeader>
                        <CardContent className="pb-4 px-5 flex justify-between items-end">
                            <div>
                                <div className="text-3xl font-black text-amber-900 dark:text-amber-200">
                                    {pendingPRNs}
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Requisitions ready for PO creation</p>
                            </div>
                            <ArrowUpRight className="w-4 h-4 text-amber-600 dark:text-amber-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                        </CardContent>
                    </Card>
                </Link>

                {/* Open Purchase Orders */}
                <Link href="/procurement/orders?tab=IN_PROGRESS" className="group">
                    <Card className="bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border-indigo-500/30 dark:border-indigo-500/20 shadow-sm hover:shadow-md transition-all rounded-2xl cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-5">
                            <CardTitle className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                                Open Purchase Orders
                            </CardTitle>
                            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                                <ShoppingCart className="w-4 h-4" />
                            </div>
                        </CardHeader>
                        <CardContent className="pb-4 px-5 flex justify-between items-end">
                            <div>
                                <div className="text-3xl font-black text-indigo-900 dark:text-indigo-200">
                                    {openPOs}
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">POs issued &amp; vendor in-progress</p>
                            </div>
                            <ArrowUpRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                        </CardContent>
                    </Card>
                </Link>

                {/* Pending GRNs Intake */}
                <Link href="/procurement/orders?tab=COMPLETED" className="group">
                    <Card className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/30 dark:border-emerald-500/20 shadow-sm hover:shadow-md transition-all rounded-2xl cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-5">
                            <CardTitle className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                GRN Warehouse Intake
                            </CardTitle>
                            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                                <Truck className="w-4 h-4" />
                            </div>
                        </CardHeader>
                        <CardContent className="pb-4 px-5 flex justify-between items-end">
                            <div>
                                <div className="text-3xl font-black text-emerald-900 dark:text-emerald-200">
                                    {pendingGRNs}
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Shipments ready for store receipt</p>
                            </div>
                            <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                        </CardContent>
                    </Card>
                </Link>

                {/* Critical Stock Outages Alert */}
                <Card className="bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border-rose-500/30 dark:border-rose-500/20 shadow-sm rounded-2xl">
                    <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-5">
                        <CardTitle className="text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                            Stock Outage Risk Items
                        </CardTitle>
                        <div className="p-2 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 animate-pulse">
                            <AlertTriangle className="w-4 h-4" />
                        </div>
                    </CardHeader>
                    <CardContent className="pb-4 px-5 flex justify-between items-end">
                        <div>
                            <div className="text-3xl font-black text-rose-900 dark:text-rose-200">
                                {lowStockItems.length}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Materials at/below threshold level</p>
                        </div>
                        <Badge variant="destructive" className="font-mono text-[10px] font-bold">
                            {lowStockItems.length > 0 ? 'Action Required' : 'Healthy'}
                        </Badge>
                    </CardContent>
                </Card>
            </div>

            {/* 2. Visual Procurement Workflow Pipeline Status Bar */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden bg-slate-900 text-white">
                <CardHeader className="py-3.5 px-5 border-b border-slate-800 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-400" />
                        <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-200">
                            Procurement Lifecycle Pipeline &amp; Stage Flow
                        </CardTitle>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">Real-time status breakdown</span>
                </CardHeader>
                <CardContent className="p-5">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-500/30 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-amber-400 font-mono">Stage 1 • PRN Requisitions</span>
                                <p className="text-lg font-black text-white mt-0.5">{pendingPRNs} <span className="text-xs font-normal text-slate-400">PRNs Pending</span></p>
                            </div>
                            <FileText className="w-5 h-5 text-amber-400 opacity-80" />
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-950 border border-indigo-500/30 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-indigo-400 font-mono">Stage 2 • Issued POs</span>
                                <p className="text-lg font-black text-white mt-0.5">{openPOs} <span className="text-xs font-normal text-slate-400">POs Active</span></p>
                            </div>
                            <ShoppingCart className="w-5 h-5 text-indigo-400 opacity-80" />
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/30 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-emerald-400 font-mono">Stage 3 • GRN Receipts</span>
                                <p className="text-lg font-black text-white mt-0.5">{pendingGRNs} <span className="text-xs font-normal text-slate-400">GRNs Pending</span></p>
                            </div>
                            <Truck className="w-5 h-5 text-emerald-400 opacity-80" />
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-950 border border-cyan-500/30 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-cyan-400 font-mono">Stage 4 • Fulfilled</span>
                                <p className="text-lg font-black text-white mt-0.5">{completedPOs} <span className="text-xs font-normal text-slate-400">POs Completed</span></p>
                            </div>
                            <BadgeCheck className="w-5 h-5 text-cyan-400 opacity-80" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 3. Action Center: Pending PRNs & Active PO Stream */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Requisitions Awaiting PO Creation (2 Cols) */}
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-slate-100 dark:border-slate-800">
                        <div>
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Clock className="w-4 h-4 text-amber-500" />
                                Action Required: Approved PRNs Awaiting PO Creation
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">Approved stock requests queued for vendor sourcing &amp; Purchase Order issuing</p>
                        </div>
                        <Link href="/procurement/orders?tab=PENDING" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                            View All ({pendingPRNs}) <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                    </CardHeader>
                    <CardContent className="p-0">
                        {recentPendingRequests.length === 0 ? (
                            <div className="text-center text-muted-foreground py-12 text-xs flex flex-col items-center gap-1.5">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-80" />
                                All pending requisitions processed! No PRNs waiting for PO creation.
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                {recentPendingRequests.map((req) => (
                                    <div key={req.id} className="p-4 hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition flex items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold text-xs text-foreground">{req.requestNr}</span>
                                                {getPriorityBadge(req.priority)}
                                                <span className="text-[11px] text-muted-foreground font-mono">
                                                    • {req._count?.items || 0} material item(s)
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Building2 className="w-3 h-3 text-slate-400" />
                                                    {req.toStore?.name || 'Main Warehouse'}
                                                </span>
                                                <span>•</span>
                                                <span>Requested by: <strong className="text-foreground">{req.requestedBy?.name || 'Store Officer'}</strong></span>
                                                <span>•</span>
                                                <span className="font-mono text-[11px]">{new Date(req.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        <Link 
                                            href={`/procurement/orders?tab=PENDING`} 
                                            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition flex items-center gap-1 shrink-0 shadow-sm hover:shadow"
                                        >
                                            <PlusCircle className="w-3.5 h-3.5" />
                                            Process PO
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Right: Active Open PO Tracker Stream (1 Col) */}
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
                    <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-slate-100 dark:border-slate-800">
                        <div>
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <ShoppingCart className="w-4 h-4 text-indigo-500" />
                                In-Flight PO Tracker
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">Active POs pending vendor delivery</p>
                        </div>
                        <Link href="/procurement/orders?tab=IN_PROGRESS" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                            All POs
                        </Link>
                    </CardHeader>
                    <CardContent className="p-0">
                        {recentActivePOs.length === 0 ? (
                            <div className="text-center text-muted-foreground py-12 text-xs flex flex-col items-center gap-1.5">
                                <Package className="w-8 h-8 text-slate-400 opacity-60" />
                                No active POs currently in progress.
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                {recentActivePOs.map((po) => (
                                    <div key={po.id} className="p-4 hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                                                PO #{po.poNumber || po.requestNr}
                                            </span>
                                            <Badge variant="outline" className="font-mono text-[10px] text-indigo-600 border-indigo-300 dark:border-indigo-800">
                                                {po.procurementStatus?.replace('_', ' ') || 'ACTIVE'}
                                            </Badge>
                                        </div>
                                        <p className="text-xs font-medium text-foreground truncate">
                                            Vendor: <span className="font-bold text-slate-700 dark:text-slate-300">{po.vendor || 'Supplier Unspecified'}</span>
                                        </p>
                                        <div className="flex justify-between items-center text-[11px] text-muted-foreground font-mono">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3 text-slate-400" />
                                                Due: {po.expectedDelivery ? new Date(po.expectedDelivery).toLocaleDateString() : 'Pending'}
                                            </span>
                                            <span>{po._count?.items || 0} line item(s)</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* 4. Critical Stock Shortages (Emergency Local Procurement Sourcing) */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-slate-100 dark:border-slate-800">
                    <div>
                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-rose-700 dark:text-rose-400">
                            <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
                            Critical Warehouse Stock Outages (Emergency Local Procurement Candidates)
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">Warehouse materials at or below minimum threshold level requiring urgent local PO creation</p>
                    </div>
                    <Link href="/procurement/orders" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-1">
                        Procurement Processing <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                </CardHeader>
                <CardContent className="p-6">
                    {lowStockItems.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8 text-xs flex flex-col items-center gap-1">
                            <CheckCircle2 className="w-6 h-6 text-emerald-500 opacity-80" />
                            No critical stock shortages. Warehouse inventory levels are healthy.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {lowStockItems.map((stock, i) => (
                                <div key={i} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3">
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-bold text-xs text-foreground truncate">{stock.item?.name || 'Unknown Material'}</span>
                                        <span className="text-[11px] text-muted-foreground font-mono truncate">
                                            {stock.store?.name || 'Main Warehouse'} • Code: {stock.item?.code || 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-end shrink-0 gap-1">
                                        <Badge variant="destructive" className="px-2.5 py-0.5 text-xs font-mono font-bold">
                                            {stock.quantity} {stock.item?.unit || 'qty'} left
                                        </Badge>
                                        <Link href={`/procurement/orders`} className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                                            + Create PO
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
