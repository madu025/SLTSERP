"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Eye, Search, X } from "lucide-react";
import {
    Dialog,
    DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import GatePanel from "@/components/purchase/GatePanel";
import PurchaseRoute from "@/components/purchase/PurchaseRoute";
import { approvalGate, purchaseStation } from "@/lib/purchase-flow-gates";
import { RBAC_PERMISSIONS } from "@/config/rbac-permissions";

/** The step a request waits at, and who it goes to next. */
const STEP_OF: Record<string, { name: string; next: string }> = {
    STORES_MANAGER_APPROVAL: { name: 'Stores Manager review', next: 'the OSP Manager' },
    OSP_MANAGER_APPROVAL: { name: 'OSP Manager approval', next: 'Procurement' },
    HOS_APPROVAL: { name: 'Head of Section approval', next: 'Procurement' },
    ARM_APPROVAL: { name: 'Area Manager approval', next: 'the main store for release' },
};
const SOURCE_LABEL: Record<string, string> = { LOCAL_PURCHASE: 'local purchase', EMERGENCY_LOCAL: 'emergency local purchase', SLT: 'SLT (Head Office)', MAIN_STORE: 'main store transfer' };

interface ApprovalRequestItem {
    id: string;
    itemId?: string | null;
    requestedQty: number;
    approvedQty?: number | null;
    make?: string | null;
    model?: string | null;
    item?: {
        id: string;
        name: string;
        code?: string | null;
        unit?: string | null;
    } | null;
}

interface ApprovalRequest {
    id: string;
    requestNr: string;
    createdAt: string;
    requiredDate?: string | null;
    toStoreId?: string | null;
    sourceType?: string | null;
    purpose?: string | null;
    remarks?: string | null;
    priority: string;
    status: string;
    workflowStage: string;
    managerAction?: string | null;
    requestedById?: string | null;
    storesManagerApprovedById?: string | null;
    armApprovedById?: string | null;
    procurementDocsSubmittedAt?: string | null;
    sltReferenceId?: string | null;
    projectTypes?: string[] | null;
    requestedBy?: {
        id: string;
        name: string;
    } | null;
    items?: ApprovalRequestItem[];
}

export default function ApprovalsPage() {
    const queryClient = useQueryClient();
    const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
    const [remarks, setRemarks] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [priorityFilter, setPriorityFilter] = useState("ALL");
    const [typeFilter, setTypeFilter] = useState("ALL");
    const [activeTab, setActiveTab] = useState("PENDING");

    // States for quantity editing and warehouse stocks
    const [approvedQuantities, setApprovedQuantities] = useState<Record<string, number>>({});
    const [decision, setDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
    const [actionError, setActionError] = useState<string | null>(null);
    // who is acting: segregation of duties is shown before typing (the server checks the same)
    const [me] = useState<{ id: string | null; isAdmin: boolean }>(() => {
        if (typeof window === 'undefined') return { id: null, isAdmin: false };
        try {
            const u = JSON.parse(localStorage.getItem('user') || '{}');
            return { id: u.id ?? null, isAdmin: Array.isArray(u.permissions) && u.permissions.includes(RBAC_PERMISSIONS.ADMIN_RBAC) };
        } catch { return { id: null, isAdmin: false }; }
    });
    const [stockLevels, setStockLevels] = useState<Record<string, number>>({});

    // Fetch Requests with filtering
    const { data: rawRequests = [], isLoading } = useQuery<ApprovalRequest[]>({
        queryKey: ["approvals", activeTab],
        queryFn: async () => {
            let url = "";
            if (activeTab === "PENDING") {
                // PENDING: approval queue resolved dynamically from ProcessGatePolicy
                // (MATERIAL_REQUEST gates) on the server — no hardcoded stage list here
                url = `/api/inventory/requests?awaitingApproval=true&status=PENDING&_t=${Date.now()}`;
            } else {
                // HISTORY: Show ALL approved/rejected requests (procurement + internal transfers)
                // This gives managers a unified view of all their approval decisions
                url = `/api/inventory/requests?status=APPROVED,REJECTED&_t=${Date.now()}`;
            }
            const res = await fetch(url, { cache: 'no-store' });
            const json = await res.json();
            if (Array.isArray(json)) return json;
            if (json && Array.isArray(json.data)) return json.data;
            return [];
        }
    });

    const requests = Array.isArray(rawRequests) ? rawRequests : [];

    // Opening a request starts the approved quantities at the requested ones (set by openRequest); the store's stock is fetched here
    useEffect(() => {
        if (!selectedRequest?.toStoreId) return;
        let live = true;
        fetch(`/api/inventory/stock?storeId=${selectedRequest.toStoreId}&_t=${Date.now()}`, { cache: 'no-store' })
            .then(res => {
                if (!res.ok) throw new Error("Failed to fetch stock levels");
                return res.json();
            })
            .then((data: Array<{ itemId: string; quantity: number }>) => {
                const levels: Record<string, number> = {};
                data.forEach(stock => { levels[stock.itemId] = stock.quantity; });
                if (live) setStockLevels(levels);
            })
            .catch(() => { if (live) setStockLevels({}); });
        return () => { live = false; };
    }, [selectedRequest]);
    const openRequest = (req: ApprovalRequest) => {
        setSelectedRequest(req);
        setApprovedQuantities(Object.fromEntries((req.items ?? []).map((it) => [it.id, Number(it.requestedQty)])));
        setStockLevels({});
        setRemarks('');
        setDecision('APPROVE');
        setActionError(null);
    };

    const approveMutation = useMutation({
        mutationFn: async ({ id, action, remarks, items }: { id: string, action: string, remarks?: string, items?: { id: string, approvedQty: number }[] }) => {
            const res = await fetch("/api/inventory/requests", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestId: id, action, remarks, items })
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(String(json?.error?.message ?? json?.error ?? json?.message ?? `The action failed (${res.status})`).replace(/^[A-Z_]+: /, ''));
            return json;
        },
        onSuccess: (_d, v) => {
            toast.success(v.action === 'REJECT' ? 'Request rejected; the requester is told' : 'Approved and sent on');
            queryClient.invalidateQueries({ queryKey: ["approvals"] });
            setSelectedRequest(null);
            setRemarks("");
        },
        onError: (e: Error) => setActionError(e.message)
    });

    const handleAction = (id: string, action: 'APPROVE' | 'REJECT', remarks?: string, items?: { id: string, approvedQty: number }[]) => {
        approveMutation.mutate({ id, action, remarks, items });
    };

    const filteredRequests = requests.filter((req: ApprovalRequest) => {
        // Search query filter
        const matchesSearch = 
            !searchQuery ||
            req.requestNr?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            req.purpose?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            req.requestedBy?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            req.projectTypes?.some((pt: string) => pt.toLowerCase().includes(searchQuery.toLowerCase()));

        // Priority filter
        const matchesPriority = 
            priorityFilter === "ALL" || 
            req.priority === priorityFilter;

        // Type filter
        const matchesType = 
            typeFilter === "ALL" ||
            (typeFilter === "INTERNAL" && req.toStoreId) ||
            (typeFilter === "PROCUREMENT" && !req.toStoreId);

        return matchesSearch && matchesPriority && matchesType;
    });

    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50">
                    <div className="max-w-7xl mx-auto space-y-4">
                        
                        {/* Page Header & Tabs */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="space-y-0.5">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Procurement Approvals</h1>
                                <p className="text-xs text-slate-500">
                                    Review and process pending contractor OSP procurement and internal store requisitions.
                                </p>
                            </div>
                            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200/60 w-fit">
                                <button
                                    onClick={() => {
                                        setActiveTab("PENDING");
                                        setSelectedRequest(null);
                                    }}
                                    className={cn(
                                        "px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded transition-all cursor-pointer",
                                        activeTab === "PENDING" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    Pending Actions
                                </button>
                                <button
                                    onClick={() => {
                                        setActiveTab("HISTORY");
                                        setSelectedRequest(null);
                                    }}
                                    className={cn(
                                        "px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded transition-all cursor-pointer",
                                        activeTab === "HISTORY" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    Approval History
                                </button>
                            </div>
                        </div>

                        {/* Search & Filter Toolbar */}
                        <div className="erp-toolbar flex-col sm:flex-row justify-between gap-3 bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm">
                            <div className="flex flex-1 flex-col sm:flex-row items-center gap-2 w-full">
                                <div className="relative w-full sm:w-80 group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                    <Input
                                        placeholder="Search by Req No, purpose, requested by..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="h-8 pl-9 bg-slate-50 border-none focus-visible:ring-1 focus-visible:ring-blue-200 rounded-lg text-xs"
                                    />
                                </div>
                                <div className="w-full sm:w-40">
                                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                                        <SelectTrigger className="h-8 bg-slate-50 border-none text-xs rounded-lg">
                                            <SelectValue placeholder="Priority: All" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">Priority: All</SelectItem>
                                            <SelectItem value="NORMAL">Normal</SelectItem>
                                            <SelectItem value="URGENT">Urgent</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-full sm:w-44">
                                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                                        <SelectTrigger className="h-8 bg-slate-50 border-none text-xs rounded-lg">
                                            <SelectValue placeholder="Type: All" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">Type: All</SelectItem>
                                            <SelectItem value="PROCUREMENT">Procurement Only</SelectItem>
                                            <SelectItem value="INTERNAL">Internal Transfer Only</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {(searchQuery || priorityFilter !== "ALL" || typeFilter !== "ALL") && (
                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            setSearchQuery("");
                                            setPriorityFilter("ALL");
                                            setTypeFilter("ALL");
                                        }}
                                        className="h-8 text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all rounded-lg px-3 flex items-center gap-1.5"
                                    >
                                        <X className="w-3 h-3" />
                                        Reset Filters
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Requests Table */}
                        <div className="erp-table-container bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            {isLoading ? (
                                <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
                                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                                    <p className="text-[10px] font-black uppercase tracking-wider animate-pulse">Loading Requests...</p>
                                </div>
                            ) : filteredRequests.length === 0 ? (
                                <div className="py-20 flex flex-col items-center justify-center bg-white text-slate-400">
                                    <Eye className="w-10 h-10 opacity-20 mb-3" />
                                    <p className="text-xs font-bold">No requests found matching the criteria.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="px-4 py-2 w-32 font-mono">Req No</th>
                                                <th>Date</th>
                                                <th>Source / Type</th>
                                                {activeTab === "HISTORY" && <th>Status</th>}
                                                <th>Project / Purpose</th>
                                                <th className="text-center">Items</th>
                                                <th>Priority</th>
                                                <th className="text-right pr-6 w-28">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredRequests.map((req: ApprovalRequest) => (
                                                <tr key={req.id} className="hover:bg-slate-50/50 transition-colors duration-150">
                                                    <td className="px-4 py-1.5 font-mono font-semibold text-slate-700">{req.requestNr}</td>
                                                    <td className="px-3 py-1.5 text-slate-500 font-medium">
                                                        {new Date(req.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-3 py-1.5">
                                                        <Badge variant="outline" className={cn(
                                                            "text-[9px] px-1.5 py-0 border-none font-bold",
                                                            req.toStoreId ? 'bg-indigo-50 text-indigo-700' : 'bg-sky-50 text-sky-700'
                                                        )}>
                                                            {req.toStoreId ? 'Internal Transfer' : (req.sourceType || 'Procurement')}
                                                        </Badge>
                                                    </td>
                                                    {activeTab === "HISTORY" && (
                                                        <td className="px-3 py-1.5">
                                                            <Badge className={cn(
                                                                "border-none px-1.5 py-0.2 text-[9px] font-black leading-none",
                                                                req.status === 'REJECTED' ? 'bg-red-50 text-red-700' :
                                                                req.workflowStage === 'REQUEST' ? 'bg-amber-50 text-amber-700' :
                                                                'bg-emerald-50 text-emerald-700'
                                                            )}>
                                                                {req.status === 'REJECTED' ? 'REJECTED' : req.managerAction === 'APPROVED' ? 'APPROVED' : 'PENDING'}
                                                            </Badge>
                                                        </td>
                                                    )}
                                                    <td className="px-3 py-1.5 max-w-[200px] truncate font-medium text-slate-700" title={req.projectTypes?.join(', ') || req.purpose || undefined}>
                                                        {req.projectTypes && req.projectTypes.length > 0 ? req.projectTypes[0] : 'General'}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-center text-slate-600 font-semibold">{req.items?.length || 0}</td>
                                                    <td className="px-3 py-1.5">
                                                        <Badge className={cn(
                                                            "text-[9px] px-1.5 py-0 border-none font-bold",
                                                            req.priority === 'URGENT' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'
                                                        )}>
                                                            {req.priority}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right pr-6">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => openRequest(req)}
                                                            aria-label={`Open ${req.requestNr}`}
                                                            className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Page Level Controlled Request Details Drawer - Premium Enterprise Redesign */}
            <Dialog open={!!selectedRequest} onOpenChange={(open) => { if (!open) setSelectedRequest(null); }}>
                <DialogContent 
                    showCloseButton={false}
                    className="fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full w-[min(1180px,94vw)] !max-w-none flex flex-col !p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none"
                >
                    {selectedRequest && (() => {
                        const r = selectedRequest;
                        const step = STEP_OF[r.workflowStage] ?? { name: 'Approval', next: 'the next step' };
                        const lines = (r.items ?? []).map((it) => ({ id: it.id, name: it.item?.name ?? 'Item', unit: it.item?.unit ?? '', requested: Number(it.requestedQty), approved: approvedQuantities[it.id] ?? Number(it.requestedQty) }));
                        const pendingHere = activeTab === 'PENDING' && r.status === 'PENDING';
                        const checks = approvalGate({
                            actorId: me.id, requesterId: r.requestedBy?.id ?? r.requestedById ?? null, earlierSignerIds: [r.storesManagerApprovedById, r.armApprovedById],
                            waitingHere: pendingHere, rejecting: decision === 'REJECT', reason: remarks, lines, isAdmin: me.isAdmin,
                        });
                        const isPurchase = !r.toStoreId;
                        return (
                            <div className="pf flex h-full min-h-0 flex-col" style={{ background: 'var(--pf-paper)' }}>
                                <div className="relative border-b px-6 pb-4 pt-5" style={{ background: 'var(--pf-panel)', borderColor: 'var(--pf-line)' }}>
                                    <button onClick={() => setSelectedRequest(null)} aria-label="Close" className="absolute right-4 top-4 rounded-full p-2 hover:bg-slate-100"><X className="h-4 w-4" /></button>
                                    <h2 className="text-[1.375rem] font-bold leading-tight">{step.name}: {r.requestNr}</h2>
                                    <p className="mt-0.5 text-sm" style={{ color: 'var(--pf-ink-2)' }}>
                                        Raised by {r.requestedBy?.name ?? 'unknown'} on {new Date(r.createdAt).toLocaleDateString('en-GB')}{r.requiredDate ? `, needed by ${new Date(r.requiredDate).toLocaleDateString('en-GB')}` : ''}{r.priority && r.priority !== 'MEDIUM' && r.priority !== 'NORMAL' ? `, ${r.priority.toLowerCase()} priority` : ''}
                                    </p>
                                </div>
                                <div className="flex-1 overflow-y-auto p-5">
                                    <div className="flex flex-col gap-4">
                                        {isPurchase && <PurchaseRoute station={purchaseStation(r)} />}
                                        <div className="pf-layout">
                                            <div className="pf-steps">
                                                <section className="pf-step" aria-labelledby="ap-1">
                                                    <div className="pf-step-title" id="ap-1"><b>1</b>Check the request</div>
                                                    <p className="pf-step-note">{r.purpose ? `For: ${r.purpose.replace(/_/g, ' ')}.` : 'No purpose was given.'}{r.sourceType ? ` Source: ${SOURCE_LABEL[r.sourceType] ?? r.sourceType}.` : ''}</p>
                                                    <div className="overflow-x-auto">
                                                        <table className="pf-table">
                                                            <thead><tr><th>Item</th><th className="num">In store</th><th className="num">Requested</th><th>Approve</th></tr></thead>
                                                            <tbody>
                                                                {lines.map((l) => {
                                                                    const over = l.approved > l.requested + 1e-9 || l.approved < 0;
                                                                    return (
                                                                        <tr key={l.id}>
                                                                            <td className="font-semibold">{l.name}</td>
                                                                            <td className="num">{stockLevels[(r.items ?? []).find((x) => x.id === l.id)?.itemId ?? ''] ?? '-'}</td>
                                                                            <td className="num">{l.requested}<span className="pf-unit">{l.unit}</span></td>
                                                                            <td>
                                                                                <span className="inline-flex items-center">
                                                                                    <input type="number" min={0} step="any" aria-label={`Approved quantity ${l.name}`} aria-invalid={over} disabled={decision === 'REJECT' || !pendingHere} className="pf-input pf-qty" value={l.approved} onChange={(e) => setApprovedQuantities({ ...approvedQuantities, [l.id]: parseFloat(e.target.value) || 0 })} />
                                                                                    <span className="pf-unit">{l.unit}</span>
                                                                                </span>
                                                                                {over && <div className="pf-err">At most {l.requested}</div>}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                    {r.sltReferenceId && <p className="mt-2 text-sm">Memo approval: <a className="underline" style={{ color: 'var(--pf-route)' }} href={r.sltReferenceId} target="_blank" rel="noreferrer">open the attachment</a></p>}
                                                </section>

                                                <section className="pf-step" aria-labelledby="ap-2">
                                                    <div className="pf-step-title" id="ap-2"><b>2</b>Your decision</div>
                                                    <p className="pf-step-note">Approve sends it to {step.next}. Reject closes it and tells the requester why.</p>
                                                    <div className="pf-choices" role="radiogroup" aria-label="Decision">
                                                        <label><input type="radio" className="pf-check" name="decision" checked={decision === 'APPROVE'} onChange={() => setDecision('APPROVE')} disabled={!pendingHere} />Approve</label>
                                                        <label><input type="radio" className="pf-check" name="decision" checked={decision === 'REJECT'} onChange={() => setDecision('REJECT')} disabled={!pendingHere} />Reject</label>
                                                    </div>
                                                    <div className="pf-field mt-3">
                                                        <label htmlFor="ap-reason">{decision === 'REJECT' ? 'Why it is rejected' : 'Comments (needed when you reduce a quantity)'}</label>
                                                        <textarea id="ap-reason" rows={3} maxLength={500} className="pf-input" aria-invalid={checks.some((c) => c.key === 'reason' && !c.ok)} value={remarks} onChange={(e) => setRemarks(e.target.value)} disabled={!pendingHere} />
                                                    </div>
                                                    {r.remarks && <p className="mt-2 text-sm" style={{ color: 'var(--pf-ink-2)' }}>Earlier comments: &ldquo;{r.remarks}&rdquo;</p>}
                                                    {actionError && <p className="pf-err mt-2" role="alert">{actionError}</p>}
                                                </section>
                                            </div>

                                            <GatePanel
                                                checks={checks}
                                                action={decision === 'REJECT' ? 'Reject and tell the requester' : `Approve and send to ${step.next}`}
                                                busy={approveMutation.isPending}
                                                testId="ap-go"
                                                onAction={() => {
                                                    setActionError(null);
                                                    if (decision === 'REJECT') { handleAction(r.id, 'REJECT', remarks); return; }
                                                    handleAction(r.id, 'APPROVE', remarks, lines.map((l) => ({ id: l.id, approvedQty: l.approved })));
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </div>
    );
}
