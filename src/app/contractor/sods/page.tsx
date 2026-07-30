"use client";

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ClipboardList, QrCode, CheckCircle2, Layers, MapPin, Search, ChevronLeft, ChevronRight, Filter, Package, Zap, ChevronDown, ChevronUp, Cpu, RefreshCw, Bell, AlertTriangle } from "lucide-react";
import { toast } from 'sonner';

interface MaterialUsageItem {
    id: string;
    quantity: number;
    usageType: string;
    serialNumber?: string | null;
    item?: {
        id: string;
        code: string;
        name: string;
        unit: string;
    };
}

interface QCNotification {
    id: string;
    title: string;
    message: string;
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    isRead: boolean;
    createdAt: string;
    soNum?: string;
    teamName?: string;
}

interface SOD {
    id: string;
    soNum: string;
    customerName: string;
    address: string;
    voiceNumber: string;
    sltsStatus: string;
    dropWireDistance?: number;
    ontSerialNumber?: string;
    directTeam?: string;
    returnReason?: string | null;
    comments?: string | null;
    qcStatus?: string | null;
    qcDefects?: string[];
    qcComment?: string | null;
    team?: { id: string; name: string; sltCode?: string | null } | null;
    iptvSerials?: { serialNumber: string }[];
    materialUsage?: MaterialUsageItem[];
}

interface SODsResponse {
    sods: SOD[];
    teams?: { id: string; name: string; sltCode?: string | null }[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

interface StockItem {
    id: string;
    quantity: number;
    item: {
        id: string;
        code: string;
        name: string;
        unit: string;
        category?: string;
    };
}

interface StockResponse {
    stockItems: StockItem[];
}

export default function ContractorSODsPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [activeStatus, setActiveStatus] = useState<string>('INPROGRESS'); // Default to INPROGRESS for task execution focus
    const [selectedTeamId, setSelectedTeamId] = useState<string>('ALL');
    const [expandedSods, setExpandedSods] = useState<Record<string, boolean>>({});
    const [selectedSOD, setSelectedSOD] = useState<SOD | null>(null);
    const [dropWireMeters, setDropWireMeters] = useState<number>(0);
    const [ontSerial, setOntSerial] = useState('');

    const toggleExpand = (id: string) => {
        setExpandedSods((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    // Debounce search input to avoid spamming backend on every keystroke
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1); // Reset to first page on search
        }, 350);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    // Helper function to build contractor headers
    const getAuthHeaders = () => {
        const contractorUser = typeof window !== 'undefined' ? (localStorage.getItem('contractor_user') || localStorage.getItem('user')) : null;
        const contractorToken = typeof window !== 'undefined' ? (localStorage.getItem('contractor_token') || localStorage.getItem('token')) : null;
        const selectedContractorId = typeof window !== 'undefined' ? localStorage.getItem('selected_contractor_id') : null;

        const headers: Record<string, string> = {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        };
        if (contractorToken) {
            headers['Authorization'] = `Bearer ${contractorToken}`;
        }
        if (contractorUser) {
            try {
                const u = JSON.parse(contractorUser);
                if (u.id) headers['x-user-id'] = u.id;
                if (u.role) headers['x-user-role'] = u.role;
                if (u.contractorId) headers['x-contractor-id'] = u.contractorId;
            } catch {}
        }
        if (selectedContractorId) {
            headers['x-contractor-id'] = selectedContractorId;
        }
        return headers;
    };

    const [showNotifications, setShowNotifications] = useState(false);

    // Fetch live QC Defect Notifications for contractor/team
    const { data: notificationData } = useQuery({
        queryKey: ['contractor-qc-notifications', selectedTeamId],
        queryFn: async () => {
            const teamParam = selectedTeamId === 'ALL' ? '' : `&teamId=${selectedTeamId}`;
            const res = await fetch(`/api/contractor-portal/notifications?unreadOnly=false${teamParam}&_t=${Date.now()}`, {
                headers: getAuthHeaders()
            });
            if (!res.ok) return { notifications: [], unreadCount: 0 };
            const json = await res.json();
            return json.data || json;
        },
        refetchInterval: 5000 // Real-time 5s live polling for instant notifications
    });

    // Fetch Contractor Assigned SODs with server-side filters & pagination
    const { data: responseData, isLoading } = useQuery<SODsResponse>({
        queryKey: ['contractor-assigned-sods', debouncedSearch, activeStatus, selectedTeamId, currentPage],
        queryFn: async () => {
            const statusParam = activeStatus === 'ALL' ? '' : `&status=${activeStatus}`;
            const teamParam = selectedTeamId === 'ALL' ? '' : `&teamId=${selectedTeamId}`;
            const res = await fetch(`/api/contractor-portal/sods?page=${currentPage}&search=${encodeURIComponent(debouncedSearch)}${statusParam}${teamParam}&_t=${Date.now()}`, {
                headers: getAuthHeaders()
            });
            if (!res.ok) return { sods: [], teams: [], total: 0, page: 1, limit: 50, totalPages: 0 };
            const json = await res.json();
            return json.data || json;
        },
        refetchInterval: 5000 // Real-time 5s live sync for field SOD execution
    });

    // Fetch Live Contractor van stock to resolve Drop Wire and ONT Item IDs dynamically
    const { data: stockData } = useQuery<StockResponse>({
        queryKey: ['contractor-van-stock-sod-complete'],
        queryFn: async () => {
            const res = await fetch(`/api/contractor-portal/stock?_t=${Date.now()}`, {
                headers: getAuthHeaders()
            });
            if (!res.ok) return { stockItems: [] };
            const json = await res.json();
            return json.data || json;
        },
        refetchInterval: 5000
    });

    // Complete SOD Mutation
    const completeSodMutation = useMutation({
        mutationFn: async (payload: {
            id: string;
            sltsStatus: string;
            completedDate: string;
            dropWireDistance: number;
            ontSerialNumber?: string;
            materialUsage: { itemId: string; quantity: string; usageType: string; serialNumber?: string }[];
        }) => {
            const res = await fetch('/api/contractor-portal/sods', {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || err.error || 'Failed to complete Service Order');
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success(`Successfully completed Service Order & deducted materials from In-Hand Stock!`);
            queryClient.invalidateQueries({ queryKey: ['contractor-assigned-sods'] });
            queryClient.invalidateQueries({ queryKey: ['contractor-van-stock'] });
            queryClient.invalidateQueries({ queryKey: ['contractor-van-stock-sod-complete'] });
            queryClient.invalidateQueries({ queryKey: ['contractor-my-dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['contractor-qc-notifications'] });
            setSelectedSOD(null);
        },
        onError: (err: Error) => {
            toast.error(err.message);
        }
    });

    // Mark Notification as Read Mutation (Optimistic Update)
    const markNotifReadMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch('/api/contractor-portal/notifications', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify({ id })
            });
            if (!res.ok) throw new Error('Failed to mark notification as read');
            return res.json();
        },
        onMutate: async (id: string) => {
            await queryClient.cancelQueries({ queryKey: ['contractor-qc-notifications', selectedTeamId] });
            const previousNotifs = queryClient.getQueryData(['contractor-qc-notifications', selectedTeamId]);
            queryClient.setQueryData(['contractor-qc-notifications', selectedTeamId], (old: any) => {
                if (!old) return old;
                const notifs = (old.notifications || []).map((n: QCNotification) =>
                    n.id === id ? { ...n, isRead: true } : n
                );
                const unreadCount = Math.max(0, (old.unreadCount || 0) - 1);
                return { ...old, notifications: notifs, unreadCount };
            });
            return { previousNotifs };
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['contractor-qc-notifications'] });
        }
    });

    // Mark All Notifications as Read Mutation (Optimistic Update)
    const markAllNotifReadMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/contractor-portal/notifications', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify({
                    markAll: true,
                    teamId: selectedTeamId === 'ALL' ? undefined : selectedTeamId
                })
            });
            if (!res.ok) throw new Error('Failed to mark all notifications as read');
            return res.json();
        },
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ['contractor-qc-notifications', selectedTeamId] });
            const previousNotifs = queryClient.getQueryData(['contractor-qc-notifications', selectedTeamId]);
            queryClient.setQueryData(['contractor-qc-notifications', selectedTeamId], (old: any) => {
                if (!old) return old;
                const notifs = (old.notifications || []).map((n: QCNotification) => ({ ...n, isRead: true }));
                return { ...old, notifications: notifs, unreadCount: 0 };
            });
            return { previousNotifs };
        },
        onSuccess: () => {
            toast.success('All notifications marked as read');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['contractor-qc-notifications'] });
        }
    });

    const [dropWireError, setDropWireError] = useState('');

    const handleSaveMaterials = () => {
        if (!selectedSOD) return;

        // Validate drop wire distance
        if (!dropWireMeters || dropWireMeters <= 0) {
            setDropWireError('Drop wire distance must be greater than 0 meters.');
            return;
        }
        setDropWireError('');

        // Resolve drop wire and ONT item IDs dynamically from van stock catalog
        const stockItems = stockData?.stockItems || [];
        const dropWireItem = stockItems.find((s) => 
            (s.item.code || '').toUpperCase().includes('DW') || 
            (s.item.code || '').toUpperCase().includes('CBL-2F') ||
            (s.item.name || '').toUpperCase().includes('DROP WIRE')
        );
        const ontItem = stockItems.find((s) => 
            (s.item.code || '').toUpperCase().includes('ONT') || 
            (s.item.code || '').toUpperCase().includes('ONU') ||
            (s.item.name || '').toUpperCase().includes('ONT') ||
            (s.item.name || '').toUpperCase().includes('ROUTER')
        );

        if (!dropWireItem) {
            toast.error("Drop wire item not found in your van stock catalog!");
            return;
        }

        const materialUsage: { itemId: string; quantity: string; usageType: string; serialNumber?: string }[] = [
            {
                itemId: dropWireItem.item.id,
                quantity: String(dropWireMeters),
                usageType: 'USED'
            }
        ];

        if (ontSerial) {
            if (!ontItem) {
                toast.error("ONT device item not found in your van stock catalog!");
                return;
            }
            materialUsage.push({
                itemId: ontItem.item.id,
                quantity: '1',
                usageType: 'USED',
                serialNumber: ontSerial
            });
        }

        completeSodMutation.mutate({
            id: selectedSOD.id,
            sltsStatus: 'COMPLETED',
            completedDate: new Date().toISOString(),
            dropWireDistance: Number(dropWireMeters),
            ontSerialNumber: ontSerial || undefined,
            materialUsage
        });
    };

    const sodList = responseData?.sods || [];
    const teamsList = responseData?.teams || [];
    const totalPages = responseData?.totalPages || 0;

    const [isScanning, setIsScanning] = useState(false);

    const handleSimulateScan = () => {
        const scannedSerial = `ONT-2026-X${Math.floor(100 + Math.random() * 900)}`;
        setOntSerial(scannedSerial);
        setIsScanning(false);
        toast.success(`Barcode Scanned Successfully: ${scannedSerial}`);
    };

    return (
        <div className="space-y-5">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 p-5 rounded-2xl border border-slate-800 gap-4 shadow-lg">
                <div>
                    <h1 className="text-xl font-black text-white flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-blue-400" />
                        Field SOD Execution & Material Logging
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">Filter by assigned Team, inspect consumed installation materials, and view QC defect alerts.</p>
                </div>
                
                {/* Search & Team Filter Toolbar */}
                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                    {/* Notification Bell Button */}
                    <button
                        type="button"
                        onClick={() => setShowNotifications(true)}
                        className="relative p-2 bg-slate-950 hover:bg-slate-850 rounded-xl border border-slate-800 text-slate-300 transition-all cursor-pointer"
                        title="QC Defect Alerts & Notifications"
                    >
                        <Bell className="w-4 h-4 text-amber-400" />
                        {(notificationData?.unreadCount || 0) > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white font-mono font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center animate-bounce shadow-md">
                                {notificationData.unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Team Filter Dropdown */}
                    <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
                        <Filter className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-slate-400 font-bold uppercase text-[10px]">Team:</span>
                        <select
                            value={selectedTeamId}
                            onChange={(e) => {
                                setSelectedTeamId(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
                        >
                            <option value="ALL" className="bg-slate-900 text-white">All Teams ({teamsList.length})</option>
                            {teamsList.map((t) => (
                                <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                                    ⚡ {t.name}
                                </option>
                            ))}
                        </select>
                    </div>

                        {/* Search Input */}
                        <div className="relative flex-1 md:w-60">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search SO or voice no..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-9 pl-8 pr-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Status Filter Tabs */}
                <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 overflow-x-auto">
                    {[
                        { id: 'ALL', label: 'All Orders' },
                        { id: 'INPROGRESS', label: 'In Progress' },
                        { id: 'INSTALL_CLOSED', label: 'Install Closed' },
                        { id: 'COMPLETED', label: 'Completed' },
                        { id: 'RETURN', label: 'Returned' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveStatus(tab.id);
                                setCurrentPage(1);
                            }}
                            className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                                activeStatus === tab.id
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Main Data View Container */}
                {isLoading ? (
                    <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span>Loading assigned SODs...</span>
                    </div>
                ) : sodList.length === 0 ? (
                    <div className="p-10 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400 space-y-2">
                        <ClipboardList className="w-10 h-10 mx-auto text-slate-600 opacity-50" />
                        <h4 className="text-sm font-bold text-slate-200">No Service Orders Found</h4>
                        <p className="text-xs text-slate-400">There are no field SODs matching the selected status and team filter.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* MOBILE APP TOUCH LIST VIEW (< 768px Screen Viewports) */}
                        <div className="block md:hidden space-y-3">
                            {sodList.map((sod, idx) => {
                                const teamName = sod.team?.name || sod.directTeam || 'Unassigned';
                                const materials = sod.materialUsage || [];
                                const isExpanded = !!expandedSods[sod.id];

                                return (
                                    <div 
                                        key={sod.id}
                                        className={`bg-slate-900/90 border rounded-2xl overflow-hidden transition-all shadow-md active:scale-[0.99] ${
                                            isExpanded ? 'border-blue-500/60 shadow-blue-900/20' : 'border-slate-800'
                                        }`}
                                    >
                                        {/* Mobile Main Touchable Header */}
                                        <div 
                                            onClick={() => toggleExpand(sod.id)}
                                            className="p-4 flex flex-col gap-2.5 cursor-pointer bg-slate-900"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-[10px] text-slate-500 font-bold">#{(currentPage - 1) * 50 + idx + 1}</span>
                                                    <span className="font-mono font-black text-blue-400 text-base">{sod.soNum}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {sod.qcStatus === 'QC_DEFECT_FLAGGED' && (
                                                        <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded-full bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse flex items-center gap-1">
                                                            <AlertTriangle className="w-3 h-3" /> QC Defect
                                                        </span>
                                                    )}
                                                    <span className={`px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full border ${
                                                        sod.sltsStatus === 'INSTALL_CLOSED' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
                                                        sod.sltsStatus === 'COMPLETED' ? 'bg-purple-500/20 text-purple-400 border-purple-500/40' :
                                                        sod.sltsStatus === 'RETURN' ? 'bg-red-500/20 text-red-400 border-red-500/40' :
                                                        'bg-blue-500/20 text-blue-400 border-blue-500/40'
                                                    }`}>
                                                        {sod.sltsStatus}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
                                                <div className="font-mono text-slate-300">
                                                    Voice: <strong className="text-white">{sod.voiceNumber || '-'}</strong>
                                                </div>
                                                <div className="flex items-center gap-1.5 font-mono text-[11px]">
                                                    <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                                        DW: {sod.dropWireDistance || 0}m
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-1">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                                    <Zap className="w-3 h-3 text-amber-400" />
                                                    {teamName}
                                                </span>
                                                <div className="flex items-center gap-1 text-[11px] text-blue-400 font-bold">
                                                    <span>{isExpanded ? 'Hide Details' : 'View Details & Materials'}</span>
                                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Mobile Expandable Details Drawer */}
                                        {isExpanded && (
                                            <div className="p-4 bg-slate-950/90 border-t border-slate-800 space-y-3 text-xs">
                                                {/* QC Inspection Defect Warning Box */}
                                                {(sod.qcStatus === 'QC_DEFECT_FLAGGED' || sod.qcComment || (sod.qcDefects && sod.qcDefects.length > 0)) && (
                                                    <div className="bg-red-950/60 p-3.5 rounded-xl border border-red-500/50 space-y-2">
                                                        <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase tracking-wider border-b border-red-500/30 pb-1">
                                                            <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
                                                            QC Officer Inspection Defect Alert
                                                        </div>
                                                        {sod.qcComment && (
                                                            <p className="text-[11px] text-red-200 font-sans leading-relaxed">
                                                                <strong>QC Comment:</strong> {sod.qcComment}
                                                            </p>
                                                        )}
                                                        {sod.qcDefects && sod.qcDefects.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 pt-1">
                                                                {sod.qcDefects.map((def: string, dIdx: number) => (
                                                                    <span key={dIdx} className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded border border-red-500/30 font-mono font-bold">
                                                                        ⚠️ {def}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Used Materials */}
                                                <div className="bg-slate-900 p-3 rounded-xl border border-slate-850 space-y-2">
                                                    <div className="flex items-center justify-between text-blue-400 font-bold text-[11px] uppercase pb-1 border-b border-slate-800">
                                                        <span className="flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Consumed Materials</span>
                                                        <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full text-[10px] font-mono">{materials.length} Items</span>
                                                    </div>
                                                    {materials.length > 0 ? (
                                                        <div className="space-y-1.5">
                                                            {materials.map((m) => (
                                                                <div key={m.id} className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-850 text-[11px]">
                                                                    <div>
                                                                        <span className="font-bold text-slate-200 block">{m.item?.name || m.item?.code || 'Item'}</span>
                                                                        {m.serialNumber && <span className="text-[10px] font-mono text-blue-400">S/N: {m.serialNumber}</span>}
                                                                    </div>
                                                                    <span className="font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                                                        {m.quantity} {m.item?.unit || ''}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-[11px] text-slate-500 italic">No installation materials logged yet.</p>
                                                    )}
                                                </div>

                                                {/* Installed CPE & Serials */}
                                                <div className="bg-slate-900 p-3 rounded-xl border border-slate-850 space-y-2">
                                                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px] uppercase pb-1 border-b border-slate-800">
                                                        <Cpu className="w-3.5 h-3.5" /> Installed CPE & Serials
                                                    </div>
                                                    <div className="space-y-1.5 text-[11px]">
                                                        <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-850">
                                                            <span className="text-slate-400 font-bold">ONT Router Serial:</span>
                                                            <span className="font-mono text-emerald-400 font-bold">{sod.ontSerialNumber || 'Not Logged'}</span>
                                                        </div>
                                                        {sod.iptvSerials && sod.iptvSerials.length > 0 && (
                                                            <div className="bg-slate-950 p-2 rounded-lg border border-slate-850 space-y-1">
                                                                <span className="text-slate-400 font-bold block">IPTV STB Serials ({sod.iptvSerials.length}):</span>
                                                                {sod.iptvSerials.map((stb, sIdx) => (
                                                                    <span key={sIdx} className="font-mono text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 block text-[10px]">
                                                                        STB #{sIdx+1}: {stb.serialNumber}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Collected CPE & Location */}
                                                <div className="bg-slate-900 p-3 rounded-xl border border-slate-850 space-y-2">
                                                    <div className="flex items-center gap-1.5 text-purple-400 font-bold text-[11px] uppercase pb-1 border-b border-slate-800">
                                                        <RefreshCw className="w-3.5 h-3.5" /> Collected CPE & Info
                                                    </div>
                                                    <div className="space-y-1.5 text-[11px]">
                                                        <div className="bg-slate-950 p-2 rounded-lg border border-slate-850">
                                                            <span className="text-slate-400 font-bold block">Customer:</span>
                                                            <span className="text-slate-100 font-bold">{sod.customerName || 'N/A'}</span>
                                                        </div>
                                                        <div className="bg-slate-950 p-2 rounded-lg border border-slate-850">
                                                            <span className="text-slate-400 font-bold block">Address:</span>
                                                            <span className="text-slate-300">{sod.address || 'Address N/A'}</span>
                                                        </div>
                                                        {sod.returnReason && (
                                                            <div className="bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                                                                <span className="text-red-400 font-bold block">Return CPE / Reason:</span>
                                                                <span className="text-red-300">{sod.returnReason}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Log Material Action Button */}
                                                {sod.sltsStatus === 'INPROGRESS' && (
                                                    <Button
                                                        onClick={() => {
                                                            setSelectedSOD(sod);
                                                            setDropWireMeters(sod.dropWireDistance || 0);
                                                            setOntSerial(sod.ontSerialNumber || '');
                                                        }}
                                                        className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold h-11 rounded-xl flex items-center justify-center gap-2 shadow-lg"
                                                    >
                                                        <Layers className="w-4 h-4" /> Log Installation Materials
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* DESKTOP HIGH DENSITY DATA TABLE (>= 768px Screen Viewports) */}
                        <div className="hidden md:block bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs text-slate-300 border-collapse">
                                    <thead className="bg-slate-950/90 text-slate-400 uppercase text-[10px] font-black tracking-wider border-b border-slate-800">
                                        <tr>
                                            <th className="py-3 px-3 w-8 text-center"></th>
                                            <th className="py-3 px-3 w-10 text-center">#</th>
                                            <th className="py-3 px-4">SO Number</th>
                                            <th className="py-3 px-4">Voice / TP No</th>
                                            <th className="py-3 px-4 text-center">Assigned Team</th>
                                            <th className="py-3 px-4 text-center">Status</th>
                                            <th className="py-3 px-4 text-center">Drop Wire (DW)</th>
                                            <th className="py-3 px-4 font-mono">ONT Serial</th>
                                            <th className="py-3 px-4 text-right pr-6">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60 font-sans">
                                        {sodList.map((sod, idx) => {
                                            const teamName = sod.team?.name || sod.directTeam || 'Unassigned';
                                            const materials = sod.materialUsage || [];
                                            const isExpanded = !!expandedSods[sod.id];

                                            return (
                                                <React.Fragment key={sod.id}>
                                                    {/* Main Table Row */}
                                                    <tr 
                                                        onClick={() => toggleExpand(sod.id)}
                                                        className={`hover:bg-slate-850/70 transition-colors cursor-pointer ${
                                                            isExpanded ? 'bg-slate-850/90 border-l-4 border-l-blue-500' : ''
                                                        }`}
                                                    >
                                                        <td className="py-3 px-3 text-center text-slate-500">
                                                            {isExpanded ? (
                                                                <ChevronUp className="w-4 h-4 text-blue-400" />
                                                            ) : (
                                                                <ChevronDown className="w-4 h-4 text-slate-500" />
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3 text-center font-mono text-slate-500 font-bold">
                                                            {(currentPage - 1) * 50 + idx + 1}
                                                        </td>
                                                        <td className="py-3 px-4 font-mono font-bold text-blue-400 text-sm">
                                                            {sod.soNum}
                                                        </td>
                                                        <td className="py-3 px-4 font-mono font-bold text-slate-200">
                                                            {sod.voiceNumber || '-'}
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                                                <Zap className="w-3 h-3 text-amber-400" />
                                                                {teamName}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            <span className={`inline-block px-2.5 py-1 text-[10px] font-black uppercase rounded-lg border ${
                                                                sod.sltsStatus === 'INSTALL_CLOSED' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
                                                                sod.sltsStatus === 'COMPLETED' ? 'bg-purple-500/20 text-purple-400 border-purple-500/40' :
                                                                sod.sltsStatus === 'RETURN' ? 'bg-red-500/20 text-red-400 border-red-500/40' :
                                                                'bg-blue-500/20 text-blue-400 border-blue-500/40'
                                                            }`}>
                                                                {sod.sltsStatus}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 text-center font-mono">
                                                            <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                                                {sod.dropWireDistance || 0} m
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 font-mono text-slate-300">
                                                            {sod.ontSerialNumber ? (
                                                                <span className="text-blue-300 font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                                                                    {sod.ontSerialNumber}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-500 italic text-[11px]">-</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4 text-right pr-6" onClick={(e) => e.stopPropagation()}>
                                                            {sod.sltsStatus === 'INPROGRESS' && (
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setSelectedSOD(sod);
                                                                        setDropWireMeters(sod.dropWireDistance || 0);
                                                                        setOntSerial(sod.ontSerialNumber || '');
                                                                    }}
                                                                    className="bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold h-8 px-3 rounded-lg flex items-center gap-1.5 shadow-md ml-auto"
                                                                >
                                                                <Layers className="w-3.5 h-3.5" />
                                                                Log Materials
                                                            </Button>
                                                        )}
                                                    </td>
                                                </tr>

                                                {/* Expandable Details Row */}
                                                {isExpanded && (
                                                    <tr className="bg-slate-950/90 border-b border-slate-800">
                                                        <td colSpan={9} className="p-4 sm:p-5 text-slate-300">
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                                                {/* Column 1: Used Materials */}
                                                                <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-2">
                                                                    <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wider pb-1 border-b border-slate-800">
                                                                        <Package className="w-4 h-4 text-blue-400" />
                                                                        Used Materials ({materials.length})
                                                                    </div>
                                                                    {materials.length > 0 ? (
                                                                        <div className="space-y-1.5 pt-1">
                                                                            {materials.map((m) => (
                                                                                <div key={m.id} className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-850 text-[11px]">
                                                                                    <div>
                                                                                        <span className="font-bold text-slate-200">{m.item?.name || m.item?.code || 'Item'}</span>
                                                                                        {m.serialNumber && (
                                                                                            <span className="text-[10px] font-mono text-blue-400 block">S/N: {m.serialNumber}</span>
                                                                                        )}
                                                                                    </div>
                                                                                    <span className="font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                                                                        {m.quantity} {m.item?.unit || ''}
                                                                                    </span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-[11px] text-slate-500 italic pt-1">No installation materials logged yet.</p>
                                                                    )}
                                                                </div>

                                                                {/* Column 2: Installed CPE & Serials */}
                                                                <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-2">
                                                                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider pb-1 border-b border-slate-800">
                                                                        <Cpu className="w-4 h-4 text-emerald-400" />
                                                                        Installed CPE & Serials
                                                                    </div>
                                                                    <div className="space-y-2 text-[11px] pt-1">
                                                                        <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-850">
                                                                            <span className="text-slate-400 font-bold">ONT Router Serial:</span>
                                                                            <span className="font-mono text-emerald-400 font-bold">
                                                                                {sod.ontSerialNumber || 'Not Logged'}
                                                                            </span>
                                                                        </div>
                                                                        
                                                                        {sod.iptvSerials && sod.iptvSerials.length > 0 && (
                                                                            <div className="bg-slate-950 p-2 rounded-lg border border-slate-850 space-y-1">
                                                                                <span className="text-slate-400 font-bold block">IPTV STB Serials ({sod.iptvSerials.length}):</span>
                                                                                <div className="space-y-1">
                                                                                    {sod.iptvSerials.map((stb, sIdx) => (
                                                                                        <span key={sIdx} className="font-mono text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 block text-[10px]">
                                                                                            STB #{sIdx+1}: {stb.serialNumber}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-850">
                                                                            <span className="text-slate-400 font-bold">Drop Wire Span:</span>
                                                                            <span className="font-mono text-amber-400 font-bold">
                                                                                {sod.dropWireDistance || 0} Meters
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Column 3: Collected CPE & Customer Location */}
                                                                <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-2">
                                                                    <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-wider pb-1 border-b border-slate-800">
                                                                        <RefreshCw className="w-4 h-4 text-purple-400" />
                                                                        Collected CPE & Customer Info
                                                                    </div>
                                                                    <div className="space-y-1.5 text-[11px] pt-1">
                                                                        <div className="bg-slate-950 p-2 rounded-lg border border-slate-850">
                                                                            <span className="text-slate-400 font-bold block">Customer Name:</span>
                                                                            <span className="text-slate-100 font-bold">{sod.customerName || 'N/A'}</span>
                                                                        </div>
                                                                        <div className="bg-slate-950 p-2 rounded-lg border border-slate-850">
                                                                            <span className="text-slate-400 font-bold block flex items-center gap-1">
                                                                                <MapPin className="w-3 h-3 text-slate-500" /> Address:
                                                                            </span>
                                                                            <span className="text-slate-300">{sod.address || 'Address N/A'}</span>
                                                                        </div>
                                                                        {sod.returnReason && (
                                                                            <div className="bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                                                                                <span className="text-red-400 font-bold block">Return Reason / Return CPE:</span>
                                                                                <span className="text-red-300">{sod.returnReason}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                        <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
                            <span className="text-xs text-slate-400 font-mono">
                                Page <span className="text-white font-bold">{currentPage}</span> of <span className="text-white font-bold">{totalPages}</span>
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    className="bg-slate-950 border-slate-850 text-slate-200 text-xs h-8 rounded-lg px-3 flex items-center gap-1"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    className="bg-slate-950 border-slate-850 text-slate-200 text-xs h-8 rounded-lg px-3 flex items-center gap-1"
                                >
                                    Next <ChevronRight className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        </div>
                    )}

            {/* Material Logging Modal */}
            <Dialog open={!!selectedSOD} onOpenChange={() => setSelectedSOD(null)}>
                <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle>Log SOD Field Materials</DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs">
                            Enter Drop Wire meters and scan ONT serial number installed on site.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedSOD && (
                        <div className="space-y-4 py-2 text-xs">
                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 font-mono">
                                <div className="flex justify-between text-slate-400">
                                    <span>SO Number:</span>
                                    <span className="text-blue-400 font-bold">{selectedSOD.soNum}</span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>Customer:</span>
                                    <span className="text-white truncate">{selectedSOD.customerName}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-slate-400 font-bold mb-1">Drop Wire Span Distance (Meters)</label>
                                <input
                                    type="number"
                                    placeholder="Enter distance in meters (e.g. 45)"
                                    value={dropWireMeters || ''}
                                    onChange={(e) => {
                                        setDropWireMeters(Number(e.target.value));
                                        if (Number(e.target.value) > 0) setDropWireError('');
                                    }}
                                    className={`w-full h-10 px-3 bg-slate-950 border rounded-xl text-slate-200 focus:outline-none text-xs font-mono transition-colors ${
                                        dropWireError ? 'border-red-500 focus:border-red-400' : 'border-slate-800 focus:border-blue-500'
                                    }`}
                                />
                                {dropWireError && (
                                    <p className="text-[10px] text-red-400 mt-1 font-bold flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" /> {dropWireError}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-slate-400 font-bold mb-1 flex justify-between items-center">
                                    <span>ONT Serial Number</span>
                                    <button
                                        type="button"
                                        onClick={() => setIsScanning(true)}
                                        className="text-[10px] text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 font-bold flex items-center gap-1 transition-all"
                                    >
                                        <QrCode className="w-3 h-3" /> Camera Barcode Scan
                                    </button>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Scan barcode or type serial (e.g. ONT2026X99)"
                                    value={ontSerial}
                                    onChange={(e) => setOntSerial(e.target.value)}
                                    className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 text-xs font-mono uppercase"
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedSOD(null)} className="border-slate-800 text-slate-300 text-xs">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveMaterials}
                            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                        >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Save Material Attachments
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Interactive Mobile Camera Barcode / QR Code Scanner Modal */}
            <Dialog open={isScanning} onOpenChange={setIsScanning}>
                <DialogContent className="bg-slate-950 border-amber-500/40 text-white w-[92vw] max-w-sm p-4 rounded-2xl shadow-2xl text-center">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-bold text-amber-400 flex items-center justify-center gap-2">
                            <QrCode className="w-4 h-4" /> ONT Barcode Camera Scanner
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 text-[10px]">
                            Align ONT router barcode within the camera frame scanner viewfinder.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Camera Scanner Simulation Viewfinder Box */}
                    <div className="relative w-full h-44 bg-slate-900 rounded-xl border-2 border-dashed border-amber-500/50 flex flex-col items-center justify-center space-y-2 overflow-hidden my-2">
                        <div className="w-36 h-20 border-2 border-emerald-400 rounded-lg relative flex items-center justify-center animate-pulse">
                            <span className="text-[10px] text-emerald-400 font-mono">ALIGN BARCODE</span>
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-emerald-400 animate-bounce" />
                        </div>
                        <span className="text-[9px] text-slate-400">Camera active • Auto-detecting 1D/2D barcodes</span>
                    </div>

                    <Button
                        onClick={handleSimulateScan}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold h-10 rounded-xl shadow-lg"
                    >
                        <QrCode className="w-4 h-4 mr-1" /> Capture & Scan Barcode
                    </Button>
                </DialogContent>
            </Dialog>

            {/* QC Defect Notifications Modal */}
            <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
                <DialogContent className="bg-slate-900 border-slate-800 text-white w-[92vw] max-w-md p-5 rounded-2xl shadow-2xl space-y-4">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <DialogTitle className="text-base font-bold text-amber-400 flex items-center gap-2">
                                <Bell className="w-5 h-5 text-amber-400" />
                                QC Defect Alerts
                            </DialogTitle>
                            {(notificationData?.unreadCount || 0) > 0 && (
                                <button
                                    onClick={() => markAllNotifReadMutation.mutate()}
                                    disabled={markAllNotifReadMutation.isPending}
                                    className="text-[10px] font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/30 transition-all cursor-pointer flex items-center gap-1"
                                >
                                    <CheckCircle2 className="w-3 h-3 text-amber-400" />
                                    Mark All Read
                                </button>
                            )}
                        </div>
                        <DialogDescription className="text-slate-400 text-xs">
                            QC Officers audit records and notify missing photos or quality issues.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
                        {notificationData?.notifications && notificationData.notifications.length > 0 ? (
                            notificationData.notifications.map((notif: QCNotification) => (
                                <div 
                                    key={notif.id} 
                                    className={`p-3.5 rounded-xl border text-xs space-y-2 transition-all ${
                                        notif.isRead
                                            ? 'bg-slate-950/60 border-slate-800/80 opacity-60'
                                            : notif.severity === 'CRITICAL' 
                                                ? 'bg-red-950/70 border-red-500/50 shadow-md' 
                                                : 'bg-amber-950/40 border-amber-500/40 shadow-md'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {!notif.isRead && (
                                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Unread" />
                                            )}
                                            <span className="font-mono font-bold text-amber-300 text-xs flex items-center gap-1.5">
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                                {notif.title}
                                            </span>
                                        </div>
                                        <span className="text-[9px] font-mono text-slate-400">
                                            {new Date(notif.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>

                                    <p className="text-[11px] text-slate-200 font-sans leading-relaxed">
                                        {notif.message}
                                    </p>

                                    <div className="flex justify-end pt-1">
                                        {!notif.isRead ? (
                                            <button
                                                onClick={() => markNotifReadMutation.mutate(notif.id)}
                                                disabled={markNotifReadMutation.isPending}
                                                className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-0.5 rounded-md border border-emerald-500/30 flex items-center gap-1 transition-all cursor-pointer"
                                            >
                                                <CheckCircle2 className="w-3 h-3" /> Mark as Read
                                            </button>
                                        ) : (
                                            <span className="text-[9px] font-mono text-slate-500 flex items-center gap-1">
                                                ✓ Read
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-8 text-center text-slate-400 space-y-1">
                                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 opacity-60" />
                                <p className="text-xs font-bold text-slate-300">No Defect Alerts</p>
                                <p className="text-[11px] text-slate-500">Your contractor team has no pending QC photo defects.</p>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button 
                            onClick={() => setShowNotifications(false)}
                            className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold h-9 rounded-xl"
                        >
                            Close Notifications
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
