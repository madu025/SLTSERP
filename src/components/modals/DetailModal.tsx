"use client";

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServiceOrder, AuditItem } from "@/types/service-order";
import {
    Activity,
    AlertTriangle,
    Box,
    Camera,
    CheckCircle2,
    CheckCheck,
    Clock,
    Database,
    FileJson,
    History,
    Info,
    Layers,
    Package,
    RefreshCw,
    ShieldCheck,
    Smartphone,
    User
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// Define the shape of the extended ServiceOrder
export type DetailedServiceOrder = ServiceOrder & {
    woroSeit?: string | null;
    ftthInstSeit?: string | null;
    team?: { name: string } | null;
    directTeam?: string | null;
    forensicAudit?: {
        auditData: AuditItem[];
        voiceTestStatus: string | null;
    };
};

// Define the shape of the Bridge Data (Scraped Data)
export interface BridgeData {
    sltUser?: string;
    activeTab?: string;
    updatedAt?: string;
    url?: string;
    scrapedData?: {
        teamDetails?: Record<string, string | number | boolean | null | undefined>;
        selectedTeam?: string;
        masterData?: Record<string, string | number | boolean | null | undefined>;
        materialDetails?: {
            ITEM?: string;
            NAME?: string;
            TYPE?: string;
            CODE?: string;
            QTY?: string | number;
            QUANTITY?: string | number;
        }[];
    };
}

interface DetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedOrder: DetailedServiceOrder | null;
}

export default function DetailModal({ isOpen, onClose, selectedOrder }: DetailModalProps) {
    const [activeTab, setActiveTab] = useState("details");

    // Initialize with prop, strictly typed
    const [coreOrder, setCoreOrder] = useState<DetailedServiceOrder | null>(selectedOrder);
    const [isLoadingCore, setIsLoadingCore] = useState(false);

    const [bridgeData, setBridgeData] = useState<BridgeData | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        if (isOpen && selectedOrder?.soNum) {
            setCoreOrder(selectedOrder); // Reset to prop first
            const fetchCoreData = async () => {
                setIsLoadingCore(true);
                try {
                    const res = await fetch(`/api/service-orders/core-data/${selectedOrder.soNum}`);
                    const json = await res.json();
                    if (json.success) setCoreOrder(json.data as DetailedServiceOrder);
                } catch (err) {
                    console.error("Core fetch error:", err);
                } finally {
                    setIsLoadingCore(false);
                }
            };
            fetchCoreData();

            if (activeTab === "inspector" || activeTab === "summary") {
                const fetchBridgeData = async () => {
                    try {
                        const res = await fetch(`/api/service-orders/bridge-data/${selectedOrder.soNum}`);
                        const data = await res.json();
                        if (data.success) setBridgeData(data.data as BridgeData);
                    } catch (err) {
                        console.error("Bridge fetch error:", err);
                    }
                };
                fetchBridgeData();
            }
        }
    }, [isOpen, selectedOrder, activeTab]);

    const handleSync = async () => {
        if (!bridgeData || !coreOrder?.soNum) return;

        setIsSyncing(true);
        try {
            const payload = {
                ...bridgeData.scrapedData,
                soNum: coreOrder.soNum,
                currentUser: bridgeData.sltUser,
                url: bridgeData.url,
                activeTab: bridgeData.activeTab
            };

            const res = await fetch('/api/service-orders/bridge-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            if (result.success) {
                // Refresh core data after sync
                const coreRes = await fetch(`/api/service-orders/core-data/${coreOrder.soNum}`);
                const coreJson = await coreRes.json();
                if (coreJson.success) setCoreOrder(coreJson.data as DetailedServiceOrder);
            } else {
                alert("Sync failed: " + result.message);
            }
        } catch (err) {
            console.error("Sync error:", err);
            alert("Sync failed. Check console for details.");
        } finally {
            setIsSyncing(false);
        }
    };

    if (!selectedOrder) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-4xl h-[90vh] p-0 overflow-hidden border-none shadow-2xl flex flex-col">
                <DialogHeader className="p-6 pb-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                                <Box className="w-5 h-5 text-blue-600" />
                                {coreOrder?.soNum || selectedOrder.soNum}
                                {isLoadingCore && <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />}
                            </DialogTitle>
                            <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">
                                {coreOrder?.customerName || selectedOrder.customerName || "Service Order Details"}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Badge variant={(coreOrder?.sltsStatus || selectedOrder.sltsStatus) === 'COMPLETED' ? "default" : "secondary"} className={(coreOrder?.sltsStatus || selectedOrder.sltsStatus) === 'COMPLETED' ? "bg-emerald-500 text-white border-none font-bold" : "font-bold"}>
                                {coreOrder?.sltsStatus || selectedOrder.sltsStatus}
                            </Badge>
                        </div>
                    </div>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                    <div className="px-6 border-b">
                        <TabsList className="bg-transparent h-12 p-0 gap-6">
                            <TabsTrigger value="details" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-0 h-12 font-bold text-xs uppercase tracking-widest text-slate-500 data-[state=active]:text-slate-900">
                                <History className="w-3.5 h-3.5 mr-2" />
                                Standard Details
                            </TabsTrigger>
                            <TabsTrigger value="inspector" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none px-0 h-12 font-bold text-xs uppercase tracking-widest text-slate-500 data-[state=active]:text-indigo-600">
                                <Activity className="w-3.5 h-3.5 mr-2" />
                                Smart Inspector
                            </TabsTrigger>
                            <TabsTrigger value="summary" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-emerald-600 rounded-none px-0 h-12 font-bold text-xs uppercase tracking-widest text-slate-500 data-[state=active]:text-emerald-600">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                                Smart Summary
                                <div className="ml-2 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <ScrollArea className="flex-1 w-full">
                        {/* Tab 1: Standard Details */}
                        <TabsContent value="details" className="p-6 m-0 outline-none">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <DetailItem icon={<Info className="w-3.5 h-3.5" />} label="SO Number" value={coreOrder?.soNum} isMono />
                                <DetailItem icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="SLTS Status" value={coreOrder?.sltsStatus} isBold />
                                <DetailItem icon={<User className="w-3.5 h-3.5" />} label="Customer Name" value={coreOrder?.customerName} />
                                <DetailItem icon={<Smartphone className="w-3.5 h-3.5" />} label="Voice Number" value={coreOrder?.voiceNumber} />
                                <DetailItem icon={<Package className="w-3.5 h-3.5" />} label="Service Type" value={coreOrder?.serviceType} />
                                <DetailItem icon={<Box className="w-3.5 h-3.5" />} label="DP" value={coreOrder?.dp} />
                                <DetailItem icon={<Activity className="w-3.5 h-3.5" />} label="Status" value={coreOrder?.status} />
                                <DetailItem icon={<FileJson className="w-3.5 h-3.5" />} label="Order Type" value={coreOrder?.orderType} />
                                <DetailItem icon={<Package className="w-3.5 h-3.5" />} label="Package" value={coreOrder?.package} />
                                <DetailItem icon={<Smartphone className="w-3.5 h-3.5" />} label="Tech Contact" value={coreOrder?.techContact} />
                                <DetailItem icon={<User className="w-3.5 h-3.5" />} label="Sales Person" value={coreOrder?.sales} />
                                <DetailItem icon={<Box className="w-3.5 h-3.5" />} label="RTOM" value={coreOrder?.rtom} />
                                <DetailItem icon={<Box className="w-3.5 h-3.5" />} label="LEA" value={coreOrder?.lea} />
                                <DetailItem icon={<Smartphone className="w-3.5 h-3.5" />} label="IPTV Number" value={coreOrder?.iptv} />
                                <DetailItem icon={<FileJson className="w-3.5 h-3.5" />} label="WORO Task" value={coreOrder?.woroTaskName} />
                                <DetailItem icon={<Clock className="w-3.5 h-3.5" />} label="Status Date" value={coreOrder?.statusDate ? new Date(coreOrder.statusDate).toLocaleDateString() : '-'} />
                                <DetailItem icon={<Clock className="w-3.5 h-3.5" />} label="Received Date" value={coreOrder?.receivedDate ? new Date(coreOrder.receivedDate).toLocaleDateString() : (coreOrder?.statusDate ? new Date(coreOrder.statusDate).toLocaleDateString() : '-')} />
                                <DetailItem icon={<Clock className="w-3.5 h-3.5" />} label="Imported Date" value={coreOrder?.createdAt ? new Date(coreOrder.createdAt).toLocaleDateString() : '-'} />
                                <DetailItem icon={<ShieldCheck className="w-3.5 h-3.5" />} label="SEIT (OSP)" value={coreOrder?.woroSeit} />
                                <DetailItem icon={<ShieldCheck className="w-3.5 h-3.5" />} label="SEIT (Inst)" value={coreOrder?.ftthInstSeit} />
                                {coreOrder?.contractor?.name && (
                                    <DetailItem icon={<ShieldCheck className="w-3.5 h-3.5" />} label="Contractor" value={coreOrder.contractor.name} isBold />
                                )}
                                {coreOrder?.directTeam && (
                                    <DetailItem icon={<User className="w-3.5 h-3.5" />} label="Execution Team" value={coreOrder.directTeam} />
                                )}
                                {coreOrder?.completionMode && <DetailItem icon={<Activity className="w-3.5 h-3.5" />} label="Completion Mode" value={coreOrder.completionMode} />}

                                {coreOrder?.completedDate && (
                                    <DetailItem
                                        icon={<Clock className="w-3.5 h-3.5" />}
                                        label={coreOrder.sltsStatus === 'RETURN' ? "Returned Date" : "Completed Date"}
                                        value={`${new Date(coreOrder.completedDate).toLocaleDateString()} ${new Date(coreOrder.completedDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                        isBold
                                    />
                                )}
                                {(coreOrder?.sltsStatus === 'RETURN' || coreOrder?.status?.includes('RETURN')) && !coreOrder?.completedDate && coreOrder?.statusDate && (
                                    <DetailItem
                                        icon={<Clock className="w-3.5 h-3.5" />}
                                        label="Return Date (SLT)"
                                        value={new Date(coreOrder.statusDate).toLocaleDateString()}
                                        isBold
                                    />
                                )}
                                <div className="md:col-span-2 lg:col-span-3">
                                    <DetailItem icon={<Box className="w-3.5 h-3.5" />} label="Address" value={coreOrder?.address} />
                                </div>

                                {coreOrder?.scheduledDate && (
                                    <div className="md:col-span-2 lg:col-span-3 bg-slate-50 p-4 rounded-lg border border-slate-100 flex items-start gap-4">
                                        <div className="p-2 bg-blue-100 rounded-full text-blue-600">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Scheduled Appointment</label>
                                            <p className="text-sm text-slate-900 font-bold">
                                                {new Date(coreOrder.scheduledDate).toLocaleDateString()} at {coreOrder.scheduledTime}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {coreOrder?.comments && (
                                    <div className="md:col-span-2 lg:col-span-3 bg-yellow-50/50 p-4 rounded-lg border border-yellow-100">
                                        <label className="text-xs font-bold text-yellow-700 uppercase block mb-1 flex items-center gap-1">
                                            <Info className="w-3 h-3" />
                                            System & User Comments
                                        </label>
                                        <p className="text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed">{coreOrder.comments}</p>
                                    </div>
                                )}

                                {/* NEW: Serials Display in Standard View */}
                                {(coreOrder?.ontSerialNumber || coreOrder?.dpDetails || coreOrder?.iptvSerialNumbers) && (
                                    <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-900 rounded-xl border border-slate-800 text-white">
                                        <div>
                                            <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">ONT Serial Number</label>
                                            <p className="text-xs font-mono font-bold text-emerald-400">{coreOrder.ontSerialNumber || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">IPTV Serials</label>
                                            <p className="text-xs font-mono font-bold text-blue-400">{coreOrder.iptvSerialNumbers || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">DP Details</label>
                                            <p className="text-xs font-bold text-slate-300">{coreOrder.dpDetails || 'N/A'}</p>
                                        </div>
                                    </div>
                                )}

                                {/* NEW: Core Database Material Usage Display */}
                                {coreOrder?.materialUsage && coreOrder.materialUsage.length > 0 && (
                                    <div className="md:col-span-2 lg:col-span-3">
                                        <div className="flex items-center gap-2 mb-3 mt-2">
                                            <Box className="w-3.5 h-3.5 text-blue-600" />
                                            <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Database Material Usage</h3>
                                            <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold">VERIFIED</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {coreOrder.materialUsage.map((usage, i) => (
                                                <div key={i} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm hover:border-blue-200 transition-colors">
                                                    <div className="min-w-0">
                                                        <p className="text-[11px] font-bold text-slate-800 truncate">{usage.item?.name || 'Unknown Item'}</p>
                                                        <p className="text-[9px] text-slate-400 font-mono uppercase">
                                                            {usage.item?.code || 'NO-CODE'} • {usage.usageType}
                                                            {usage.usageType === 'PORTAL_SYNC' && " (Synced)"}
                                                        </p>
                                                    </div>
                                                    <Badge variant="secondary" className="bg-slate-100 text-slate-800 font-black text-[10px] border-none shrink-0">
                                                        {usage.quantity} {usage.item?.unit}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* NEW: Forensic Audit Summary in Standard View */}
                                {coreOrder?.forensicAudit && (
                                    <div className="md:col-span-2 lg:col-span-3">
                                        <div className="flex items-center gap-2 mb-3 mt-2">
                                            <Camera className="w-3.5 h-3.5 text-indigo-600" />
                                            <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Forensic Photo Audit</h3>
                                            <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-bold">CAPTURE STATUS</span>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap gap-4 items-center justify-between">
                                            <div className="flex gap-4">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-slate-400 uppercase font-black">Photos Captured</span>
                                                    <span className="text-sm font-black text-slate-900">
                                                        {coreOrder.forensicAudit?.auditData?.filter(a => a.status === 'UPLOADED').length || 0} / {coreOrder.forensicAudit?.auditData?.length || 0}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col border-l pl-4">
                                                    <span className="text-[10px] text-slate-400 uppercase font-black">Voice Test</span>
                                                    <Badge variant="outline" className={`mt-0.5 font-bold ${coreOrder.forensicAudit.voiceTestStatus?.includes('PASS') ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                                                        {coreOrder.forensicAudit.voiceTestStatus || 'NOT TESTED'}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <Button variant="outline" size="sm" onClick={() => setActiveTab('inspector')} className="h-7 text-[10px] font-black uppercase border-slate-300 hover:bg-slate-100">
                                                View Full Report
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="inspector" className="p-0 m-0 outline-none min-h-[500px] bg-slate-50/50">
                            <div className="p-6 space-y-8 animate-in fade-in duration-300">

                                {/* Core Information Grid (Mimics Smart View) */}
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="flex flex-col p-3 rounded-lg border border-slate-200 bg-white shadow-sm">
                                        <span className="text-[10px] uppercase font-black text-slate-400 mb-1">SO Number</span>
                                        <span className="text-xs font-black text-blue-600 tracking-tight">{coreOrder?.soNum || "N/A"}</span>
                                    </div>
                                    <div className="flex flex-col p-3 rounded-lg border border-slate-200 bg-white shadow-sm">
                                        <span className="text-[10px] uppercase font-black text-slate-400 mb-1">Portal User</span>
                                        <span className="text-xs font-bold text-slate-800">{bridgeData?.sltUser || "N/A"}</span>
                                    </div>
                                    <div className="flex flex-col p-3 rounded-lg border border-slate-200 bg-white shadow-sm">
                                        <span className="text-[10px] uppercase font-black text-slate-400 mb-1">Active Tab</span>
                                        <span className="text-xs font-bold text-slate-800 uppercase">{bridgeData?.activeTab || "N/A"}</span>
                                    </div>
                                    <div className="flex flex-col p-3 rounded-lg border border-slate-200 bg-white shadow-sm">
                                        <span className="text-[10px] uppercase font-black text-slate-400 mb-1">Selected Team</span>
                                        <span className="text-xs font-bold text-blue-600">{bridgeData?.scrapedData?.teamDetails?.['SELECTED TEAM'] || coreOrder?.team?.name || coreOrder?.directTeam || "NOT SELECTED"}</span>
                                    </div>
                                    <div className="flex flex-col p-3 rounded-lg border border-slate-200 bg-white shadow-sm">
                                        <span className="text-[10px] uppercase font-black text-slate-400 mb-1">ONT Serial</span>
                                        <span className="text-xs font-bold text-purple-600 font-mono tracking-tighter">
                                            {coreOrder?.ontSerialNumber || bridgeData?.scrapedData?.masterData?.['ONT_ROUTER_SERIAL_NUMBER'] || bridgeData?.scrapedData?.masterData?.['ONT_ROUTER_SERIAL_NUMBER_'] || "PENDING"}
                                        </span>
                                    </div>
                                    <div className="flex flex-col p-3 rounded-lg border border-slate-200 bg-white shadow-sm">
                                        <span className="text-[10px] uppercase font-black text-slate-400 mb-1">Portal S-VAL</span>
                                        <span className="text-xs font-bold text-slate-700 font-mono">
                                            {bridgeData?.scrapedData?.masterData?.['STATUS VALUE'] || bridgeData?.scrapedData?.masterData?.['SVAL_HIDDEN'] || "101000"}
                                        </span>
                                    </div>

                                    {/* IPTV Extractions (Dynamic) */}
                                    {(() => {
                                        const master = bridgeData?.scrapedData?.masterData || {};
                                        const iptvKeys = Object.keys(master).filter(k => k.toLowerCase().includes('iptv_cpe_serial_number') || k.toLowerCase().includes('stb_serial'));

                                        if (iptvKeys.length > 0) {
                                            return iptvKeys.map((k, i) => (
                                                <div key={i} className="flex flex-col p-3 rounded-lg border border-slate-200 bg-white shadow-sm">
                                                    <span className="text-[10px] uppercase font-black text-slate-400 mb-1">{k.replace(/_HIDDEN/g, '').replace(/_/g, ' ')}</span>
                                                    <span className="text-xs font-bold text-purple-600 font-mono tracking-tighter">{String(master[k])}</span>
                                                </div>
                                            ));
                                        }

                                        // Fallback to core order if no bridge data
                                        const coreIptv = coreOrder?.iptvSerialNumbers ? (Array.isArray(coreOrder.iptvSerialNumbers) ? coreOrder.iptvSerialNumbers : [coreOrder.iptvSerialNumbers]) : [];
                                        return coreIptv.map((s, i) => (
                                            <div key={i} className="flex flex-col p-3 rounded-lg border border-slate-200 bg-white shadow-sm">
                                                <span className="text-[10px] uppercase font-black text-slate-400 mb-1">IPTV CPE Serial {i + 1}</span>
                                                <span className="text-xs font-bold text-purple-600 font-mono tracking-tighter">{s}</span>
                                            </div>
                                        ));
                                    })()}

                                    <div className="flex flex-col p-3 rounded-lg border border-emerald-100 bg-emerald-50/50 shadow-sm">
                                        <span className="text-[10px] uppercase font-black text-emerald-600/60 mb-1">Voice Test Audit</span>
                                        <span className="text-[10px] font-black text-emerald-600 bg-white px-2 py-0.5 rounded border border-emerald-100 w-fit">
                                            {coreOrder?.forensicAudit?.voiceTestStatus === 'PASS' ? '✅ TEST PASSED' : '⌛ NOT TESTED'}
                                        </span>
                                    </div>
                                </div>

                                {/* High-Priority Forensic Warnings */}
                                {(() => {
                                    const warnings: string[] = [];
                                    const master = bridgeData?.scrapedData?.masterData || {};

                                    if (master['POLES'] === 'NUMBER OF POLES') warnings.push("Poles count field is still at default placeholder.");

                                    Object.entries(master).forEach(([k, v]) => {
                                        if (typeof v === 'string' && v.includes('SELECT MATERIAL')) {
                                            warnings.push(`${k.replace('_HIDDEN', '').replace(/_/g, ' ')} selection is missing!`);
                                        }
                                    });

                                    if (warnings.length === 0) return null;

                                    return (
                                        <div className="space-y-3">
                                            <span className="text-[10px] uppercase font-black text-rose-500 flex items-center gap-2">
                                                <AlertTriangle className="w-3.5 h-3.5" /> High-Priority Issues ({warnings.length})
                                            </span>
                                            <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl space-y-2">
                                                {warnings.map((w, i) => (
                                                    <div key={i} className="flex items-start gap-2 text-[11px] font-bold text-rose-700">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1 flex-shrink-0" />
                                                        {w}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Materials Intelligence Section (Amber Theme) */}
                                <div className="space-y-3">
                                    <span className="text-[10px] uppercase font-black text-slate-400 flex items-center gap-2 font-mono">
                                        <Database className="w-3.5 h-3.5 text-amber-500" /> Materials Intelligence
                                    </span>
                                    <div className="bg-amber-50/20 border border-amber-100 rounded-xl overflow-hidden shadow-sm">
                                        <div className="bg-white/50 overflow-x-auto">
                                            <table className="w-full text-[11px]">
                                                <tbody className="divide-y divide-amber-100/50">
                                                    {bridgeData?.scrapedData?.materialDetails && bridgeData.scrapedData.materialDetails.length > 0 ? (
                                                        bridgeData.scrapedData.materialDetails.map((mat, i) => (
                                                            <tr key={i} className="hover:bg-white transition-colors">
                                                                <td className="px-5 py-2.5 font-bold text-slate-700">{mat.ITEM || mat.TYPE || mat.NAME}</td>
                                                                <td className="px-5 py-2.5 text-slate-400 font-medium">{mat.CODE || i.toString().padStart(3, '0')}</td>
                                                                <td className="px-5 py-2.5 text-right">
                                                                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200 text-[10px] font-black rounded-full px-2.5">
                                                                        {mat.QTY || mat.QUANTITY}
                                                                    </Badge>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan={3} className="px-5 py-6 text-center text-slate-400 italic font-medium">No materials intelligence captured for this stream.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* Forensic Photo Audit View (Purple/Slate Theme) */}
                                <div className="space-y-4">
                                    <span className="text-[10px] uppercase font-black text-slate-400 flex items-center gap-2 font-mono">
                                        <Layers className="w-3.5 h-3.5 text-purple-500" /> Forensic Photo Audit
                                    </span>

                                    <div className="grid grid-cols-1 gap-2">
                                        {coreOrder?.forensicAudit?.auditData && coreOrder.forensicAudit.auditData.length > 0 ? (
                                            coreOrder.forensicAudit.auditData.map((item, idx) => {
                                                const isMissing = item.status === 'MISSING';

                                                return (
                                                    <div key={idx} className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-slate-300 transition-all group">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-[11px] font-extrabold text-slate-700 leading-tight">
                                                                {item.name}
                                                            </span>
                                                            {!isMissing && item.uuid && (
                                                                <span className="text-[9px] font-mono text-slate-400">UUID: {item.uuid}</span>
                                                            )}
                                                        </div>
                                                        <Badge
                                                            variant={isMissing ? 'destructive' : 'default'}
                                                            className={cn(
                                                                "text-[9px] font-black uppercase rounded-lg px-2 py-0.5 tracking-tighter",
                                                                !isMissing && "bg-emerald-500 hover:bg-emerald-600"
                                                            )}
                                                        >
                                                            {isMissing ? '❌ Missing' : '✅ Uploaded'}
                                                        </Badge>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-10 bg-white rounded-xl border border-dashed border-slate-200">
                                                <p className="text-xs text-slate-400 font-medium italic">No forensic audit data available.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* Tab 3: Smart Summary (Point-wise View) */}
                        <TabsContent value="summary" className="p-0 m-0 outline-none">
                            <div className="bg-white">
                                <div className="bg-emerald-600 px-6 py-4 text-white">
                                    <h2 className="text-lg font-black uppercase tracking-tight">Service Order - Restructured & Cleaned Summary</h2>
                                    <p className="text-[10px] opacity-80 font-bold uppercase tracking-widest">Point-wise Analytical View</p>
                                </div>

                                <div className="p-8 space-y-12">
                                    {/* 1. Basic Service Order Details */}
                                    <section>
                                        <h3 className="text-sm font-black text-slate-900 border-b-2 border-slate-900 pb-2 mb-4 uppercase tracking-wider flex items-center justify-between">
                                            <span>1. Basic Service Order Details</span>
                                            <Badge className="bg-slate-900 text-white border-none text-[10px]">CORE DATA</Badge>
                                        </h3>
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3">
                                                <SummaryItem label="Service Order Number" value={coreOrder?.soNum} isBold />
                                                <SummaryItem label="Installation Type" value={coreOrder?.serviceType} />
                                                <SummaryItem label="Status" value={coreOrder?.sltsStatus || coreOrder?.status} color="emerald" />
                                                <SummaryItem label="Mobile Team" value={String(bridgeData?.scrapedData?.teamDetails?.name || bridgeData?.scrapedData?.selectedTeam || "N/A")} />
                                                <SummaryItem label="Drop Wire Length" value={bridgeData?.scrapedData?.masterData?.['Drop Wire Length'] ? `${bridgeData.scrapedData.masterData['Drop Wire Length']} meters` : "N/A"} />
                                                <SummaryItem label="Drop Wire Type" value={String(bridgeData?.scrapedData?.masterData?.['Drop Wire Type'] || "N/A")} />
                                                <SummaryItem label="Number of Poles" value={String(bridgeData?.scrapedData?.masterData?.['Number of Poles'] || "0")} />
                                            </div>

                                            {/* Pole Types Sub-list */}
                                            {bridgeData?.scrapedData?.materialDetails?.some(m => m.NAME?.toLowerCase().includes('pole') || m.NAME?.startsWith('PL-')) && (
                                                <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Pole Types Identified:</p>
                                                    <ul className="space-y-1">
                                                        {bridgeData.scrapedData.materialDetails
                                                            .filter(m => m.NAME?.toLowerCase().includes('pole') || m.NAME?.startsWith('PL-'))
                                                            .map((p, i) => (
                                                                <li key={i} className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                                                    <div className="w-1 h-1 bg-slate-400 rounded-full" />
                                                                    {p.QTY || p.QUANTITY} × {p.NAME}
                                                                </li>
                                                            ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Voice Service Sub-section */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-slate-100 border-dashed">
                                                <SummaryItem label="Voice Service" value={coreOrder?.voiceNumber ? `CREATE (${coreOrder.status})` : "N/A"} />
                                                {coreOrder?.forensicAudit?.voiceTestStatus && (
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Voice Test Details:</p>
                                                        <div className="text-xs space-y-0.5">
                                                            <p className="font-bold text-slate-700">Test Type: DURATION (Passed)</p>
                                                            <p className="text-slate-500">Status: <span className="text-emerald-600 font-black italic">{coreOrder.forensicAudit.voiceTestStatus}</span></p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </section>

                                    {/* 2. Serial Numbers */}
                                    <section>
                                        <h3 className="text-sm font-black text-slate-900 border-b-2 border-slate-900 pb-2 mb-4 uppercase tracking-wider flex items-center justify-between">
                                            <span>2. Serial Numbers (Wenama List Karala)</span>
                                            <Badge className="bg-indigo-600 text-white border-none text-[10px]">EQUIPMENT</Badge>
                                        </h3>
                                        <div className="space-y-4">
                                            <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100 border-dashed">
                                                <SummaryItem label="ONT Router Serial Number" value={coreOrder?.ontSerialNumber} isMono color="indigo" />
                                            </div>
                                            {/* Potential Pole Serials from Audit Data or Scraping */}
                                            {(() => {
                                                const forensicPoles = coreOrder?.forensicAudit?.auditData?.filter(a => a.name?.toLowerCase().includes('pole') && a.uuid) || [];
                                                // Also look into scraped masterData for keys like "Serial Number 1", "SerialNumber_1", "Pole 1 Serial"
                                                const scrapedPoles = bridgeData?.scrapedData?.masterData ? Object.entries(bridgeData.scrapedData.masterData)
                                                    .filter(([key, val]) => (key.toLowerCase().includes('serial') && key.toLowerCase().includes('pole')) || (key.toLowerCase().startsWith('serial number') && val))
                                                    .map(([key, val]) => ({ name: key, uuid: val })) : [];

                                                const allPoles = [...scrapedPoles, ...forensicPoles];

                                                if (allPoles.length === 0) return null;

                                                return (
                                                    <div className="space-y-3 mt-4">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pole Serial Numbers (Identified):</p>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                            {allPoles.map((p, i) => (
                                                                <div key={i} className="bg-white px-3 py-2 rounded-lg border border-slate-200 border-dashed flex justify-between items-center">
                                                                    <span className="text-[10px] font-bold text-slate-500 truncate mr-2">{p.name || `Pole ${i + 1}`}:</span>
                                                                    <span className="text-xs font-black font-mono text-indigo-600">{p.uuid}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </section>

                                    {/* 3. Materials Used */}
                                    <section>
                                        <h3 className="text-sm font-black text-slate-900 border-b-2 border-slate-900 pb-2 mb-4 uppercase tracking-wider flex items-center justify-between">
                                            <span>3. Materials Used</span>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-[10px] font-black uppercase border-emerald-600 text-emerald-600 hover:bg-emerald-600 hover:text-white gap-2 transition-all duration-300"
                                                    onClick={handleSync}
                                                    disabled={isSyncing || !bridgeData}
                                                >
                                                    {isSyncing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                                    Sync to ERP
                                                </Button>
                                                <Badge className="bg-emerald-600 text-white border-none text-[10px]">INVENTORY</Badge>
                                            </div>
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                                            <div>
                                                <SummaryItem label="Drop Wire" value={bridgeData?.scrapedData?.masterData?.['Drop Wire Length'] ? `${bridgeData.scrapedData.masterData['Drop Wire Length']} meters (${bridgeData.scrapedData.masterData['Drop Wire Type'] || 'FTTH-DW'})` : "N/A"} />
                                                <SummaryItem label="Poles" value={bridgeData?.scrapedData?.masterData?.['Number of Poles'] ? `${bridgeData.scrapedData.masterData['Number of Poles']} (Total Poles)` : "0"} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    Grid Materials Checklist:
                                                    <span className="h-[1px] flex-1 bg-slate-100" />
                                                </p>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {bridgeData?.scrapedData?.materialDetails && bridgeData.scrapedData.materialDetails.length > 0 ? (
                                                        bridgeData.scrapedData.materialDetails
                                                            .filter(m => !(m.NAME?.toLowerCase().includes('drop wire') || m.NAME?.toLowerCase().includes('cable')))
                                                            .map((m, i) => (
                                                                <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 px-1 transition-colors group">
                                                                    <div className="flex items-center gap-2">
                                                                        {coreOrder?.materialUsage?.some(mu => mu.usageType === 'PORTAL_SYNC' && (mu.item?.code === m.CODE || mu.item?.name === m.NAME)) ? (
                                                                            <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                                                                        ) : (
                                                                            <div className="w-3.5 h-3.5 rounded-full border border-slate-200" />
                                                                        )}
                                                                        <span className="font-bold text-slate-600">{m.NAME || m.TYPE || m.CODE}</span>
                                                                        {(() => {
                                                                            const syncedMat = coreOrder?.materialUsage?.find(mu => mu.usageType === 'PORTAL_SYNC' && (mu.item?.code === m.CODE || mu.item?.name === m.NAME));
                                                                            if (!syncedMat) return null;
                                                                            return (
                                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                                    <span className="text-[8px] font-black bg-emerald-100 text-emerald-600 px-1 rounded uppercase tracking-tighter">Portal Sync</span>
                                                                                    {syncedMat.serialNumber && (
                                                                                        <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                                                                            SN: {syncedMat.serialNumber}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                    <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{m.QTY || m.QUANTITY}</span>
                                                                </div>
                                                            ))
                                                    ) : (
                                                        <p className="text-xs text-slate-400 italic">No inventory sequence detected.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    {/* 4. Categorized Audit Photos */}
                                    <section>
                                        <h3 className="text-sm font-black text-slate-900 border-b-2 border-slate-900 pb-2 mb-6 uppercase tracking-wider flex items-center justify-between">
                                            <span>4. Uploaded Images (Categorized)</span>
                                            <Badge className="bg-indigo-600 text-white border-none text-[10px]">AUDIT COMPLETE</Badge>
                                        </h3>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {/* Category A: FDP & Wire */}
                                            <AuditCategory
                                                id="A"
                                                title="Drop Wire & FDP Related"
                                                items={coreOrder?.forensicAudit?.auditData || []}
                                                filter={['dw', 'fdp', 'wire', 'card', 'label', 'brand']}
                                            />
                                            {/* Category B: Rosette */}
                                            <AuditCategory
                                                id="B"
                                                title="Rosette & Premise Related"
                                                items={coreOrder?.forensicAudit?.auditData || []}
                                                filter={['rosette', 'power', 'premise', 'hook', 'outside view']}
                                            />
                                            {/* Category C: ONT */}
                                            <AuditCategory
                                                id="C"
                                                title="ONT & Performance"
                                                items={coreOrder?.forensicAudit?.auditData || []}
                                                filter={['ont', 'rear', 'wiring', 'wifi', 'strength', 'speed']}
                                            />
                                            {/* Category D: Pole */}
                                            <AuditCategory
                                                id="D"
                                                title="Pole Related"
                                                items={coreOrder?.forensicAudit?.auditData || []}
                                                filter={['pole', 'l-hook', 'span', 'path', 'sketch', 'upper', 'lower']}
                                            />
                                            {/* Category E: Team & Feedback */}
                                            <AuditCategory
                                                id="E"
                                                title="Customer & Team"
                                                items={coreOrder?.forensicAudit?.auditData || []}
                                                filter={['customer', 'feedback', 'request', 'team', 'additional']}
                                                isLast
                                            />
                                        </div>
                                    </section>

                                    {/* 5. Additional Metadata */}
                                    <section className="bg-slate-900 rounded-2xl p-6 text-white overflow-hidden relative">
                                        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                                            <ShieldCheck className="w-32 h-32" />
                                        </div>
                                        <h3 className="text-xs font-black text-blue-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                                            5. Additional Metadata & Signature
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                                            <div>
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Record Generation Timestamp</p>
                                                <p className="text-xs font-mono text-slate-300">
                                                    {coreOrder?.createdAt ? new Date(coreOrder.createdAt).toISOString() : new Date().toISOString()}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Current Reviewer Context</p>
                                                <p className="text-xs font-bold text-blue-300">
                                                    {bridgeData?.sltUser || "Nisha Hiruni"} - SLTS Intelligence Suite
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Active Tab Reference</p>
                                                <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                                                    {bridgeData?.activeTab || "SERVICE ORDER"}
                                                </p>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        </TabsContent>
                    </ScrollArea>
                </Tabs>

                <div className="p-4 border-t flex justify-between items-center bg-slate-50">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                        PHOENIX ERP v4.1.0 • Forensic Capture Suite
                    </p>
                    <div className="flex gap-2">
                        <Button onClick={onClose} variant="secondary" size="sm" className="h-8 text-xs font-bold">DISMISS</Button>
                        <Button variant="default" size="sm" className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700">PRINT REPORT</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog >
    );
}

function SummaryItem({ label, value, isMono = false, isBold = false, color = 'slate' }: { label: string, value: string | null | undefined, isMono?: boolean, isBold?: boolean, color?: 'slate' | 'emerald' | 'indigo' }) {
    const colorClass = color === 'emerald' ? 'text-emerald-600' : color === 'indigo' ? 'text-indigo-600' : 'text-slate-900';
    return (
        <div className="space-y-0.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{label}</label>
            <p className={`text-xs ${colorClass} ${isMono ? 'font-mono' : ''} ${isBold ? 'font-black uppercase tracking-tight' : 'font-bold'}`}>
                {value || 'N/A'}
            </p>
        </div>
    );
}

function AuditCategory({ id, title, items, filter, isLast = false }: { id: string, title: string, items: AuditItem[], filter: string[], isLast?: boolean }) {
    const categoryItems = items.filter(item =>
        filter.some(f => item.name?.toLowerCase().includes(f))
    );

    return (
        <div className={`space-y-3 ${isLast ? 'md:col-span-2' : ''}`}>
            <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-2">
                <span className="text-xs font-black text-slate-300">{id}.</span>
                <h4 className="text-[11px] font-black text-slate-600 uppercase tracking-widest">{title}</h4>
            </div>
            <div className="space-y-1.5">
                {categoryItems.length > 0 ? (
                    categoryItems.map((item, i) => (
                        <div key={i} className="flex justify-between items-center group">
                            <span className="text-[11px] font-bold text-slate-500 group-hover:text-slate-900 transition-colors">
                                {item.name || 'Unknown Photo'}
                            </span>
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-mono ${item.status === 'UPLOADED' ? 'text-emerald-500' : 'text-red-400 italic'}`}>
                                    {item.status === 'UPLOADED' ? (item.uuid || 'SUCCESS') : '(Missing)'}
                                </span>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-[10px] text-slate-300 italic">No matching images uploaded for this category.</p>
                )}
            </div>
        </div>
    );
}

function DetailItem({ icon, label, value, isMono = false, isBold = false }: { icon?: React.ReactNode, label: string, value: string | null | undefined, isMono?: boolean, isBold?: boolean }) {
    return (
        <div className="space-y-1">
            <div className="flex items-center gap-1.5 opacity-60">
                {icon}
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</label>
            </div>
            <p className={`text-[13px] text-slate-900 leading-tight ${isMono ? 'font-mono' : ''} ${isBold ? 'font-extrabold' : 'font-semibold'}`}>
                {value || '-'}
            </p>
        </div>
    );
}

