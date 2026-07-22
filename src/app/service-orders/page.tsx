"use client";

import React, { useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { RefreshCw, Plus, Layers, Filter, Search, Calendar, FileSpreadsheet, AlertCircle, ChevronUp, ChevronDown, Download, X } from "lucide-react";
import { toast } from "sonner";
import { ServiceOrder } from "@/types/service-order";
import { OrderActionData, Contractor, InventoryItem, OrderCompletionData } from "@/components/modals/order-action/types";

interface OPMC {
    id: string;
    rtom: string;
    name?: string;
}

import { useSODOperations } from "./hooks/useSODOperations";
import { useSODTable } from "./hooks/useSODTable";
import { SODSummary } from "./components/SODSummary";
import { SODSheetTable } from "./components/SODSheetTable";

const ManualEntryModal = dynamic(() => import("@/components/modals/ManualEntryModal"), { ssr: false });
const ScheduleModal = dynamic(() => import("@/components/modals/ScheduleModal"), { ssr: false });
const CommentModal = dynamic(() => import("@/components/modals/CommentModal"), { ssr: false });
const DetailModal = dynamic(() => import("@/components/modals/DetailModal"), { ssr: false });
const OrderActionModal = dynamic(() => import("@/components/modals/OrderActionModal"), { ssr: false });
const ExcelImportModal = dynamic(() => import("@/components/modals/ExcelImportModal"), { ssr: false });


function ServiceOrdersContent({ filterType = 'pending', pageTitle = 'Service Orders' }: { filterType?: 'pending' | 'completed' | 'return'; pageTitle?: string; }) {
    const queryClient = useQueryClient();
    const searchParams = useSearchParams();
    const urlSearch = searchParams.get('search');
    const urlRtom = searchParams.get('rtom');

    const hasSetDefault = React.useRef(false);

    // Filter State
    const [selectedRtomId, setSelectedRtomId] = useState<string>("");
    const [selectedRtom, setSelectedRtom] = useState<string>("");
    const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth() + 1));
    const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
    const [searchTerm, setSearchTerm] = useState(urlSearch || "");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(urlSearch || "");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const PAGE_LIMIT = 50;

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 400);
        return () => clearTimeout(handler);
    }, [searchTerm]);
    const [showMetrics, setShowMetrics] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('sod_show_metrics') !== 'false';
        }
        return true;
    });
    const [statusFilter, setStatusFilter] = useState(filterType === 'completed' ? 'ALL' : 'DEFAULT');
    const [patFilter, setPatFilter] = useState(pageTitle === 'Invoicable Service Orders' ? 'READY' : "ALL");
    const [matFilter, setMatFilter] = useState("ALL");
    const [sortConfig, setSortConfig] = useState<{ key: keyof ServiceOrder; direction: "asc" | "desc" } | null>({
        key: filterType === 'completed' ? 'completedDate' : (filterType === 'return' ? 'statusDate' : 'createdAt'),
        direction: "desc"
    });

    // Modals State
    const [showManualModal, setShowManualModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showActionModal, setShowActionModal] = useState(false);
    const [showExcelModal, setShowExcelModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);

    const clearSodNotifications = React.useCallback(async () => {
        if (!selectedRtomId) return;
        try {
            await fetch(`/api/notifications?link=/service-orders&opmcId=${selectedRtomId}&_t=${Date.now()}`, {
                method: 'PATCH'
            });
            window.dispatchEvent(new Event('slts-notification'));
        } catch (err) {
            console.error("Failed to clear SOD notifications:", err);
        }
    }, [selectedRtomId]);

    useEffect(() => {
        clearSodNotifications();
    }, [filterType, clearSodNotifications]);

    useEffect(() => {
        const handleNotification = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail) {
                clearSodNotifications();
            }
        };
        window.addEventListener('slts-notification', handleNotification);
        return () => window.removeEventListener('slts-notification', handleNotification);
    }, [clearSodNotifications]);

    // --- HOOKS ---
    const { syncMutation, addOrderMutation, updateStatusMutation, scheduleMutation, commentMutation } = useSODOperations(selectedRtomId, selectedRtom);

    // Fetch OPMCs for context
    const { data: opmcs = [] } = useQuery<OPMC[]>({
        queryKey: ["opmcs"],
        queryFn: async () => {
             const storedUser = localStorage.getItem('user');
             if (!storedUser) return [];
             const user = JSON.parse(storedUser) as { role: string; username: string };
             const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
             if (isAdmin) {
                 const res = await fetch("/api/opmcs");
                 return (await res.json()) as OPMC[];
             }
             const res = await fetch("/api/users?page=1&limit=1000");
             const data = (await res.json()) as { users: { username: string; accessibleOpmcs: OPMC[] }[] };
             const currentUser = data.users.find((u) => u.username === user.username);
             return currentUser?.accessibleOpmcs?.map((o) => ({ id: o.id, rtom: o.rtom, name: o.name || '' })) || [];
        }
    });

    const { data: qData, isLoading: isLoadingOrders, isError, refetch } = useQuery<{ items: ServiceOrder[], summary: { totalSod: number, contractorAssigned: number, appointments: number, statusBreakdown: Record<string, number> }, meta?: { total: number, totalPages: number, page: number } }>({
        queryKey: ["service-orders", selectedRtomId, filterType, selectedMonth, selectedYear, debouncedSearchTerm, statusFilter, patFilter, matFilter, currentPage, sortConfig],
        queryFn: async () => {
            if (!selectedRtomId) return { items: [], summary: { totalSod: 0, contractorAssigned: 0, appointments: 0, statusBreakdown: {} } };
            const monthParam = filterType === 'pending' ? '' : `&month=${selectedMonth}`;
            const yearParam = filterType === 'pending' ? '' : `&year=${selectedYear}`;
            const searchParam = debouncedSearchTerm ? `&search=${encodeURIComponent(debouncedSearchTerm)}` : '';
            const statusParam = statusFilter ? `&statusFilter=${statusFilter}` : '';
            const patParam = patFilter ? `&patFilter=${patFilter}` : '';
            const matParam = matFilter ? `&matFilter=${matFilter}` : '';

            const res = await fetch(`/api/service-orders?rtomId=${selectedRtomId}&filter=${filterType}${monthParam}${yearParam}${searchParam}${statusParam}${patParam}${matParam}&page=${currentPage}&limit=${PAGE_LIMIT}&_t=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache'
                }
            });
            const json = await res.json();
            if (json.meta) {
                setTotalPages(json.meta.totalPages || 1);
                setTotalItems(json.meta.total || 0);
            }
            return json as { items: ServiceOrder[], summary: { totalSod: number, contractorAssigned: number, appointments: number, statusBreakdown: Record<string, number> }, meta?: { total: number, totalPages: number, page: number } };
        },
        enabled: !!selectedRtomId
    });

    const { data: contractors = [] } = useQuery<Contractor[]>({
        queryKey: ["contractors", selectedRtomId],
        queryFn: async () => {
            if (!selectedRtomId) return [];
            const res = await fetch(`/api/contractors?rtomId=${selectedRtomId}`);
            const json = (await res.json()) as Record<string, unknown>;
            const actualData = (json?.success && json?.data ? json.data : json) as Record<string, unknown>;
            return (actualData?.contractors || []) as Contractor[];
        },
        enabled: !!selectedRtomId
    });

    const { data: inventoryItems = [] } = useQuery<InventoryItem[]>({
        queryKey: ["inventory-items"],
        queryFn: async () => {
             const res = await fetch("/api/inventory/items?page=1&limit=1000");
             const data = (await res.json()) as { items: InventoryItem[] };
             return (data.items || []) as InventoryItem[];
        }
    });

    const { data: systemConfigs = {} } = useQuery<Record<string, string>>({
        queryKey: ["system-configs"],
        queryFn: async () => {
            const res = await fetch("/api/admin/system-config");
            return await res.json() as Record<string, string>;
        }
    });

    const serviceOrders: ServiceOrder[] = Array.isArray(qData?.items) ? qData!.items : [];
    const summary = qData?.summary || { totalSod: 0, contractorAssigned: 0, appointments: 0, statusBreakdown: {} };
    
    // Explicit array cast for safety
    const safeOpmcs: OPMC[] = React.useMemo(() => Array.isArray(opmcs) ? opmcs : [], [opmcs]);

    const { selectedIds, setSelectedIds, toggleSelect, toggleAll, isAllSelected } = useSODTable(serviceOrders);

    useEffect(() => {
        // Only set default if one isn't already set and we have OPMCs
        if (safeOpmcs.length > 0 && !selectedRtomId && !hasSetDefault.current) {
            const matchedOpmc = urlRtom ? safeOpmcs.find(o => o.rtom === urlRtom) : null;
            const defaultOpmc = matchedOpmc || safeOpmcs[0];
            hasSetDefault.current = true;
            // Use setTimeout to avoid synchronous setState warning and cascading renders
            setTimeout(() => {
                setSelectedRtomId(defaultOpmc.id);
                setSelectedRtom(defaultOpmc.rtom);
            }, 0);
        }
    }, [safeOpmcs, selectedRtomId, urlRtom]);

    useEffect(() => {
        if (urlSearch && urlSearch !== searchTerm) {
            setTimeout(() => {
                setSearchTerm(urlSearch);
            }, 0);
        }
    }, [urlSearch, searchTerm]);

    useEffect(() => {
        if (urlRtom && safeOpmcs.length > 0) {
            const matchedOpmc = safeOpmcs.find(o => o.rtom === urlRtom);
            if (matchedOpmc && matchedOpmc.id !== selectedRtomId) {
                setTimeout(() => {
                    setSelectedRtomId(matchedOpmc.id);
                    setSelectedRtom(matchedOpmc.rtom);
                }, 0);
            }
        }
    }, [urlRtom, safeOpmcs, selectedRtomId]);

    const handleOpmcChange = (value: string) => {
        const opmc = safeOpmcs.find(o => o.id === value);
        if (opmc) {
            setSelectedRtomId(value);
            setSelectedRtom(opmc.rtom);
        }
    };

    useEffect(() => {
        if (!refetch) return;
        const handleSync = (e: Event) => {
            const customEvt = e as CustomEvent<{ soNum?: string }>;
            console.log("Extension Sync Success detected for", customEvt.detail?.soNum, ", refreshing orders...");
            refetch();
        };
        window.addEventListener('SLT_BRIDGE_SYNC_SUCCESS', handleSync);
        return () => window.removeEventListener('SLT_BRIDGE_SYNC_SUCCESS', handleSync);
    }, [refetch]);

    const handleBulkAction = async (action: string) => {
        if (selectedIds.size === 0) return;
        const ids = Array.from(selectedIds);
        toast.info(`Applying ${action} to ${ids.length} orders...`);
        try {
            const userId = localStorage.getItem("erp_user_id") || "";
            if (action === 'ASSIGN') {
                // Bulk assign: set sltsStatus to ASSIGNED
                await Promise.all(ids.map(id =>
                    fetch("/api/service-orders", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json", "x-user-id": userId },
                        body: JSON.stringify({ id, sltsStatus: "INPROGRESS" })
                    })
                ));
                toast.success(`${ids.length} orders marked as In Progress`);
            } else if (action === 'COMPLETE') {
                await Promise.all(ids.map(id =>
                    fetch("/api/service-orders", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json", "x-user-id": userId },
                        body: JSON.stringify({ id, sltsStatus: "COMPLETED", completedDate: new Date().toISOString() })
                    })
                ));
                toast.success(`${ids.length} orders marked as Completed`);
            } else if (action === 'DELETE') {
                await Promise.all(ids.map(id =>
                    fetch("/api/service-orders", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json", "x-user-id": userId },
                        body: JSON.stringify({ id, sltsStatus: "RETURN", returnReason: "Bulk removal" })
                    })
                ));
                toast.success(`${ids.length} orders marked as Return`);
            }
            queryClient.invalidateQueries({ queryKey: ["service-orders"] });
        } catch {
            toast.error(`Bulk ${action} failed`);
        }
    };

    const handleBulkCopy = () => {
        const selected = serviceOrders.filter(o => selectedIds.has(o.id));
        const formattedText = selected.map(order => {
            let text = `Voice Number: ${order.voiceNumber || 'N/A'}\n`;
            text += `Customer Name: ${order.customerName || 'N/A'}\n`;
            if (order.address) text += `Address: ${order.address}\n`;
            if (order.dp) text += `DP: ${order.dp}\n`;
            if (order.comments) text += `Comments: ${order.comments}\n`;
            return text.trim();
        }).join('\n\n------------------------\n\n');

        navigator.clipboard.writeText(formattedText).then(() => {
            toast.success(`${selected.length} orders copied to clipboard`);
        }).catch(() => {
            toast.error("Failed to copy to clipboard");
        });
    };

    const handleExportCSV = () => {
        if (serviceOrders.length === 0) { toast.error("No data to export"); return; }
        const headers = ["SO Number", "Customer", "Voice Number", "Status", "SLTS Status", "Contractor", "LEA", "Package", "Completed Date", "Revenue", "Contractor Amount"];
        const rows = serviceOrders.map(o => [
            o.soNum, o.customerName || "", o.voiceNumber || "", o.status, o.sltsStatus,
            o.contractor?.name || o.directTeam || "", o.lea || "", o.package || "",
            o.completedDate ? new Date(o.completedDate).toLocaleDateString('en-GB') : "",
            o.revenueAmount ?? "", o.contractorAmount ?? ""
        ]);
        const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `SOD_${filterType}_${selectedRtom}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${serviceOrders.length} orders`);
    };

    const requestSort = (key: keyof ServiceOrder) => {
        let direction: "asc" | "desc" = "asc";
        if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
        setSortConfig({ key, direction });
    };

    return (
        <div className="h-screen flex bg-background text-foreground overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="flex-none px-5 py-1 space-y-1">
                        {showMetrics && (
                            <div className="pt-1">
                                <SODSummary filterType={filterType} summary={summary} missingCount={serviceOrders.filter((o: ServiceOrder) => o.comments?.includes('[MISSING FROM SYNC')).length} />
                            </div>
                        )}

                        <div className="bg-card px-3 py-1.5 rounded-xl border border-border/40 shadow-sm flex flex-wrap xl:flex-nowrap gap-2 items-center justify-between">
                             <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap flex-1 min-w-0">
                                 <div className="flex items-center gap-1.5 shrink-0">
                                     <Layers className="w-4 h-4 text-primary" />
                                     <span className="text-sm font-bold text-foreground whitespace-nowrap tracking-tight">{pageTitle}</span>
                                     <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => { const newVal = !showMetrics; setShowMetrics(newVal); localStorage.setItem('sod_show_metrics', String(newVal)); }} title={showMetrics ? "Hide Summary Metrics" : "Show Summary Metrics"}>
                                         {showMetrics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                     </Button>
                                 </div>

                                 <div className="flex items-center gap-1.5 px-2 py-0.5 bg-muted/60 rounded-lg border border-border/20 shrink-0">
                                     <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                                     <Select value={selectedRtomId} onValueChange={handleOpmcChange}>
                                         <SelectTrigger className="h-7 border-none bg-transparent w-[110px] focus:ring-0 shadow-none font-bold text-xs"><SelectValue placeholder="RTOM" /></SelectTrigger>
                                         <SelectContent>
                                             {safeOpmcs.length > 0 ? safeOpmcs.map(o => <SelectItem key={o.id} value={o.id} className="text-xs">{o.rtom}</SelectItem>) : <SelectItem value="error" disabled>No RTOMs Available</SelectItem>}
                                         </SelectContent>
                                     </Select>
                                 </div>

                                 {/* Date Range Picker for completed/return views */}
                                 {filterType !== 'pending' && (
                                     <div className="flex items-center gap-1 px-2 py-0.5 bg-muted/60 rounded-lg border border-border/20 shrink-0">
                                         <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                                         <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setCurrentPage(1); }}>
                                             <SelectTrigger className="h-7 border-none bg-transparent w-[76px] focus:ring-0 shadow-none text-xs font-bold"><SelectValue /></SelectTrigger>
                                             <SelectContent>
                                                 {['1','2','3','4','5','6','7','8','9','10','11','12'].map(m => <SelectItem key={m} value={m} className="text-xs">{new Date(2000, Number(m)-1).toLocaleString('default', { month: 'short' })}</SelectItem>)}
                                             </SelectContent>
                                         </Select>
                                         <Select value={selectedYear} onValueChange={(v) => { setSelectedYear(v); setCurrentPage(1); }}>
                                             <SelectTrigger className="h-7 border-none bg-transparent w-[88px] focus:ring-0 shadow-none text-xs font-bold"><SelectValue /></SelectTrigger>
                                             <SelectContent>
                                                 {['2024','2025','2026'].map(y => <SelectItem key={y} value={y} className="text-xs">{y}</SelectItem>)}
                                             </SelectContent>
                                         </Select>
                                     </div>
                                 )}

                                 <div className="relative flex items-center min-w-[200px] flex-1">
                                     <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                     <Input placeholder="Search orders, customers, numbers..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="h-7 pl-8 bg-muted/30 border-border/40 text-xs" />
                                 </div>
                             </div>

                             <div className="flex items-center gap-1.5 shrink-0">
                                 {/* Status Filter (Only needed for Pending Dispatcher Grid) */}
                                 {filterType === 'pending' && (
                                     <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                                         <SelectTrigger className="h-7 w-[125px] border-border/40 bg-card text-xs font-semibold"><SelectValue /></SelectTrigger>
                                         <SelectContent>
                                             <SelectItem value="DEFAULT" className="text-xs">Filter by Status</SelectItem>
                                             <SelectItem value="ALL" className="text-xs">Show All</SelectItem>
                                             <SelectItem value="ASSIGNED" className="text-xs">Assigned</SelectItem>
                                             <SelectItem value="INPROGRESS" className="text-xs">In Progress</SelectItem>
                                             <SelectItem value="OFFLINE" className="text-xs text-slate-500 font-bold dark:text-slate-400">Offline</SelectItem>
                                             <SelectItem value="PROV_CLOSED" className="text-xs">Prov Closed</SelectItem>
                                             <SelectItem value="INSTALL_CLOSED" className="text-xs">Install Closed</SelectItem>
                                             <SelectItem value="RETURN" className="text-xs text-rose-500 font-bold dark:text-rose-400">Returned/Issues</SelectItem>
                                         </SelectContent>
                                     </Select>
                                 )}

                                 {/* PAT Filter (Only shown on dedicated PAT Status Monitor or Invoicable SOD pages) */}
                                 {(pageTitle?.includes('PAT') || pageTitle?.includes('Invoicable')) && (
                                     <Select value={patFilter} onValueChange={(v) => { setPatFilter(v); setCurrentPage(1); }}>
                                         <SelectTrigger className="h-7 w-[95px] border-border/40 bg-card text-xs font-semibold"><SelectValue placeholder="PAT" /></SelectTrigger>
                                         <SelectContent>
                                             <SelectItem value="ALL" className="text-xs">All PAT</SelectItem>
                                             <SelectItem value="READY" className="text-xs text-emerald-500 font-bold">Invoicable</SelectItem>
                                             <SelectItem value="OPMC_REJECTED" className="text-xs text-rose-500">OPMC Rejected</SelectItem>
                                             <SelectItem value="HO_REJECTED" className="text-xs text-rose-500">HO Rejected</SelectItem>
                                             <SelectItem value="HO_PASS" className="text-xs text-emerald-500">HO Passed</SelectItem>
                                             <SelectItem value="PENDING" className="text-xs text-amber-500">PAT Pending</SelectItem>
                                         </SelectContent>
                                     </Select>
                                 )}

                                 {/* Material Filter */}
                                 <Select value={matFilter} onValueChange={(v) => { setMatFilter(v); setCurrentPage(1); }}>
                                     <SelectTrigger className="h-7 w-[115px] border-border/40 bg-card text-xs font-semibold"><SelectValue placeholder="Material" /></SelectTrigger>
                                     <SelectContent>
                                         <SelectItem value="ALL" className="text-xs">All Material</SelectItem>
                                         <SelectItem value="PENDING" className="text-xs text-amber-500">Mat Pending</SelectItem>
                                         <SelectItem value="COMPLETED" className="text-xs text-emerald-500">Mat Done</SelectItem>
                                     </SelectContent>
                                 </Select>

                                 {/* Clear Filters */}
                                 {(statusFilter !== 'DEFAULT' || patFilter !== 'ALL' || matFilter !== 'ALL') && (
                                     <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-rose-500" onClick={() => { setStatusFilter(filterType === 'completed' ? 'ALL' : 'DEFAULT'); setPatFilter(pageTitle === 'Invoicable Service Orders' ? 'READY' : 'ALL'); setMatFilter('ALL'); setCurrentPage(1); }} title="Clear all filters">
                                         <X className="w-3.5 h-3.5" />
                                     </Button>
                                 )}

                                 {/* CSV Export */}
                                 <Button variant="outline" size="sm" className="h-7 px-2.5 border-blue-500/20 text-blue-500 bg-blue-500/5 hover:bg-blue-500/10 shadow-sm" onClick={handleExportCSV} title="Export CSV">
                                     <Download className="w-3.5 h-3.5" />
                                 </Button>

                                 <div className="h-4 w-px bg-border/60 mx-0.5" />

                                 {/* Action Icons */}
                                 <Button variant="outline" size="sm" className="h-7 px-2.5 shadow-sm border-border/40 hover:bg-muted" onClick={() => syncMutation.mutate()} disabled={!selectedRtomId || syncMutation.isPending} title="Update from Portal">
                                     <RefreshCw className={`w-3.5 h-3.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                                 </Button>
                                 {filterType === 'pending' && <Button size="sm" className="h-7 px-2.5 bg-primary hover:bg-primary-dark text-white font-semibold shadow-sm" onClick={() => setShowManualModal(true)} disabled={!selectedRtomId} title="Manual Entry"><Plus className="w-3.5 h-3.5" /></Button>}
                                 {filterType === 'pending' && <Button variant="outline" size="sm" className="h-7 px-2.5 border-emerald-500/20 text-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10 shadow-sm" onClick={() => setShowExcelModal(true)} title="Excel Import"><FileSpreadsheet className="w-3.5 h-3.5" /></Button>}
                             </div>
                        </div>
                    </div>

                    <div className="flex-1 mx-5 mb-2 bg-card rounded-xl border border-border/40 shadow-sm flex flex-col min-h-0 overflow-hidden relative">
                        {/* Bulk Action Overlay */}
                        {selectedIds.size > 0 && (
                            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 dark:bg-slate-800 text-white px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
                                <span className="text-sm font-bold border-r border-slate-700 pr-4">{selectedIds.size} Selected</span>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="sm" className="h-8 px-3 text-xs font-bold uppercase hover:bg-slate-700/60 text-white rounded-full" onClick={() => handleBulkAction('ASSIGN')}>Assign Team</Button>
                                    <Button variant="ghost" size="sm" className="h-8 px-3 text-xs font-bold uppercase hover:bg-slate-700/60 text-emerald-400 rounded-full" onClick={() => handleBulkAction('COMPLETE')}>Complete</Button>
                                    <Button variant="ghost" size="sm" className="h-8 px-3 text-xs font-bold uppercase hover:bg-slate-700/60 text-blue-400 rounded-full" onClick={handleBulkCopy}>Copy</Button>
                                    {Array.from(selectedIds).every(id => serviceOrders.find(o => o.id === id)?.isManualEntry) && (
                                        <Button variant="ghost" size="sm" className="h-8 px-3 text-xs font-bold uppercase hover:bg-slate-700/60 text-rose-400 rounded-full" onClick={() => handleBulkAction('DELETE')}>Remove</Button>
                                    )}
                                    <button onClick={() => setSelectedIds(new Set())} className="ml-2 p-1.5 hover:bg-slate-700 rounded-full transition-colors" title="Clear selection"><X className="w-4 h-4" /></button>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-auto custom-scrollbar flex flex-col">
                            {isLoadingOrders ? (
                                /* Professional Skeleton Loading */
                                <div className="flex-1 p-4 space-y-2" aria-busy="true" aria-label="Loading service orders">
                                    {Array.from({ length: 12 }).map((_, i) => (
                                        <div key={i} className="flex items-center gap-3 animate-pulse">
                                            <div className="w-4 h-4 rounded bg-muted/80" />
                                            <div className="w-24 h-3.5 rounded bg-muted/80" />
                                            <div className="w-20 h-3.5 rounded bg-muted/60" />
                                            <div className="flex-1 h-3.5 rounded bg-muted/50" />
                                            <div className="w-16 h-3.5 rounded bg-muted/60" />
                                            <div className="w-20 h-3.5 rounded bg-muted/40" />
                                            <div className="w-14 h-3.5 rounded bg-muted/60" />
                                        </div>
                                    ))}
                                    <p className="text-center text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest pt-4">Loading Service Orders...</p>
                                </div>
                            ) : isError ? (
                                /* Professional Error State */
                                <div className="flex items-center justify-center h-full flex-1">
                                    <div className="text-center max-w-[280px]">
                                        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                                            <AlertCircle className="w-7 h-7 text-rose-500" />
                                        </div>
                                        <h3 className="text-sm font-bold text-foreground mb-1">Failed to Load Orders</h3>
                                        <p className="text-xs text-muted-foreground mb-4">Something went wrong while fetching service orders. Please check your connection and try again.</p>
                                        <Button variant="outline" size="sm" className="h-8 px-4 text-xs font-semibold gap-2" onClick={() => refetch()}>
                                            <RefreshCw className="w-3.5 h-3.5" /> Retry
                                        </Button>
                                    </div>
                                </div>
                            ) : serviceOrders.length === 0 ? (
                                /* Professional Empty State */
                                <div className="flex items-center justify-center h-full flex-1">
                                    <div className="text-center max-w-[300px]">
                                        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-muted/60 border border-border/40 flex items-center justify-center">
                                            <Layers className="w-7 h-7 text-muted-foreground/40" />
                                        </div>
                                        <h3 className="text-sm font-bold text-foreground mb-1">No Service Orders</h3>
                                        <p className="text-xs text-muted-foreground">No orders match the current filters. Try adjusting your search criteria or selecting a different RTOM.</p>
                                    </div>
                                </div>
                            ) : (
                                <SODSheetTable
                                    orders={serviceOrders}
                                    filterType={filterType}
                                    contractors={contractors}
                                    selectedIds={selectedIds}
                                    toggleSelect={toggleSelect}
                                    toggleAll={toggleAll}
                                    isAllSelected={isAllSelected}
                                    onSort={requestSort}
                                    sortConfig={sortConfig}
                                    onUpdateField={async (id, data) => {
                                        return updateStatusMutation.mutateAsync({ id, ...data });
                                    }}
                                    onOpenModal={(order, type) => {
                                        setSelectedOrder(order);
                                        if (type === 'detail') setShowDetailModal(true);
                                        if (type === 'schedule') setShowScheduleModal(true);
                                        if (type === 'comment') setShowCommentModal(true);
                                        if (type === 'action') setShowActionModal(true);
                                    }}
                                />
                            )}
                        </div>

                        {/* Pagination Controls */}
                        {totalItems > 0 && (
                            <div className="flex-none px-4 py-2.5 border-t border-border/40 flex items-center justify-between bg-muted/20">
                                <span className="text-[11px] font-medium text-muted-foreground">
                                    Showing <span className="font-bold text-foreground">{((currentPage - 1) * PAGE_LIMIT) + 1}</span>–<span className="font-bold text-foreground">{Math.min(currentPage * PAGE_LIMIT, totalItems)}</span> of <span className="font-bold text-foreground">{totalItems}</span> orders
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <Button variant="outline" size="sm" className="h-7 px-3 text-[11px] font-semibold rounded-lg" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>← Prev</Button>
                                    <span className="px-3 py-1 text-[11px] font-bold text-foreground bg-primary/10 rounded-lg border border-primary/20 min-w-[52px] text-center">{currentPage} / {totalPages}</span>
                                    <Button variant="outline" size="sm" className="h-7 px-3 text-[11px] font-semibold rounded-lg" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next →</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <ManualEntryModal isOpen={showManualModal} onClose={() => setShowManualModal(false)} onSubmit={(data) => addOrderMutation.mutate(data)} />
                <ScheduleModal isOpen={showScheduleModal} onClose={() => setShowScheduleModal(false)} onSubmit={(data) => scheduleMutation.mutate({ orderId: selectedOrder?.id as string, data })} selectedOrder={selectedOrder} />
                <CommentModal isOpen={showCommentModal} onClose={() => setShowCommentModal(false)} onSubmit={(comment) => commentMutation.mutate({ orderId: selectedOrder?.id as string, comment })} selectedOrder={selectedOrder} />
                <DetailModal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} selectedOrder={selectedOrder} />
                <OrderActionModal 
                    isOpen={showActionModal} 
                    onClose={() => setShowActionModal(false)} 
                    orderData={selectedOrder as unknown as OrderActionData} 
                    contractors={contractors}
                    items={inventoryItems}
                    materialSource={systemConfigs['OSP_MATERIAL_SOURCE'] || 'SLT'}
                    onConfirm={(data: OrderCompletionData) => { 
                        if (selectedOrder?.id) {
                            const mutationData = { 
                                ...data, 
                                id: selectedOrder.id,
                                sltsStatus: 'COMPLETED',
                                completedDate: data.completedDate || data.date
                            };
                            updateStatusMutation.mutate(mutationData); 
                        }
                        setShowActionModal(false); 
                    }} 
                    title={'COMPLETE ORDER'} 
                    isComplete 
                />
                <ExcelImportModal isOpen={showExcelModal} onClose={() => setShowExcelModal(false)} onImportSuccess={() => queryClient.invalidateQueries({ queryKey: ["service-orders"] })} />
            </main>
        </div>
    );
}

interface ServiceOrdersPageProps {
    filterType?: "pending" | "completed" | "return";
    pageTitle?: string;
}

export default function ServiceOrdersPage(props: ServiceOrdersPageProps) {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background text-foreground text-xs font-medium">Loading Service Orders...</div>}>
            <ServiceOrdersContent {...props} />
        </Suspense>
    );
}
