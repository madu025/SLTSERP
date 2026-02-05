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

            if (activeTab === "inspector") {
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

                                {/* Material Usage moved to Smart Inspector tab to avoid duplication */}

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

                                <div className="flex items-center justify-between border-b border-indigo-100 pb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
                                            <Activity className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-black uppercase text-slate-800 tracking-tight leading-none">Intelligence Inspector</h2>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Portal Bridge Analysis</p>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleSync}
                                        disabled={isSyncing || !bridgeData}
                                        className="h-8 text-[10px] font-black uppercase bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm"
                                    >
                                        {isSyncing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                        Sync & Persist Data
                                    </Button>
                                </div>

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

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] uppercase font-black text-slate-400 flex items-center gap-2 font-mono">
                                            <Database className="w-3.5 h-3.5 text-amber-500" /> Unified Material Usage
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Action Modal Sync: Active</span>
                                    </div>

                                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[11px]">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-100">
                                                        <th className="px-5 py-2 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Material Item</th>
                                                        <th className="px-5 py-2 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                                                        <th className="px-5 py-2 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Quantity</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {coreOrder?.materialUsage && coreOrder.materialUsage.length > 0 ? (
                                                        coreOrder.materialUsage.map((usage, i) => (
                                                            <tr key={usage.itemId + i} className="hover:bg-slate-50/50 transition-colors">
                                                                <td className="px-5 py-3">
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold text-slate-800">{usage.item?.name || 'Unknown'}</span>
                                                                        <span className="text-[9px] font-mono text-slate-400 uppercase">{usage.item?.code || 'NO-CODE'} {usage.serialNumber ? `• SN: ${usage.serialNumber}` : ''}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-5 py-3">
                                                                    <Badge variant="outline" className={cn(
                                                                        "text-[8px] font-black uppercase px-1.5 py-0 border-none",
                                                                        usage.usageType === 'PORTAL_SYNC' ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
                                                                    )}>
                                                                        {usage.usageType === 'PORTAL_SYNC' ? 'Portal Sync' : usage.usageType}
                                                                    </Badge>
                                                                </td>
                                                                <td className="px-5 py-3 text-right">
                                                                    <span className="font-black text-slate-900">{usage.quantity}</span>
                                                                    <span className="ml-1 text-[9px] font-bold text-slate-400 uppercase">{usage.item?.unit || 'Nos'}</span>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <>
                                                            {/* Fallback to live bridge data if nothing persisted yet */}
                                                            {bridgeData?.scrapedData?.materialDetails && bridgeData.scrapedData.materialDetails.length > 0 ? (
                                                                bridgeData.scrapedData.materialDetails.map((mat, i) => (
                                                                    <tr key={i} className="hover:bg-amber-50/10 transition-colors bg-amber-50/5">
                                                                        <td className="px-5 py-3 font-bold text-slate-700">
                                                                            {mat.NAME || mat.ITEM || 'Portal Material'}
                                                                            <span className="block text-[8px] text-amber-500 uppercase font-black tracking-tighter mt-0.5">PENDING SYNC</span>
                                                                        </td>
                                                                        <td className="px-5 py-3">
                                                                            <Badge variant="outline" className="text-[8px] font-black uppercase px-1.5 py-0 bg-white text-slate-400 border-slate-200">UNSAVED</Badge>
                                                                        </td>
                                                                        <td className="px-5 py-3 text-right">
                                                                            <span className="font-black text-amber-600">{mat.QTY || mat.QUANTITY}</span>
                                                                        </td>
                                                                    </tr>
                                                                ))
                                                            ) : (
                                                                <tr>
                                                                    <td colSpan={3} className="px-5 py-8 text-center text-slate-400 italic font-medium">No materials captured from portal or added manually.</td>
                                                                </tr>
                                                            )}
                                                        </>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* Forensic Photo Audit View (Purple/Slate Theme) */}
                                <div className="space-y-4">
                                    <span className="text-[10px] uppercase font-black text-slate-400 flex items-center gap-2 font-mono">
                                        <Layers className="w-3.5 h-3.5 text-purple-500" /> Forensic Photo Audit Intelligence
                                    </span>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {coreOrder?.forensicAudit?.auditData && coreOrder.forensicAudit.auditData.length > 0 ? (
                                            <>
                                                <AuditGridCategory
                                                    title="Category A: Drop Wire & FDP"
                                                    items={coreOrder.forensicAudit.auditData}
                                                    filter={['dw', 'fdp', 'wire', 'card', 'label', 'brand']}
                                                />
                                                <AuditGridCategory
                                                    title="Category B: Rosette & Premise"
                                                    items={coreOrder.forensicAudit.auditData}
                                                    filter={['rosette', 'power', 'premise', 'hook', 'outside']}
                                                />
                                                <AuditGridCategory
                                                    title="Category C: ONT & Performance"
                                                    items={coreOrder.forensicAudit.auditData}
                                                    filter={['ont', 'rear', 'wiring', 'wifi', 'strength', 'speed']}
                                                />
                                                <AuditGridCategory
                                                    title="Category D: Pole Infographics"
                                                    items={coreOrder.forensicAudit.auditData}
                                                    filter={['pole', 'l-hook', 'span', 'path', 'sketch', 'upper', 'lower']}
                                                />
                                                <AuditGridCategory
                                                    title="Category E: Team & Feedback"
                                                    items={coreOrder.forensicAudit.auditData}
                                                    filter={['customer', 'feedback', 'request', 'team', 'additional']}
                                                    isFullWidth
                                                />
                                            </>
                                        ) : (
                                            <div className="col-span-full flex flex-col items-center justify-center py-10 bg-white rounded-xl border border-dashed border-slate-200">
                                                <p className="text-xs text-slate-400 font-medium italic">No forensic audit data available.</p>
                                            </div>
                                        )}
                                    </div>
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

function AuditGridCategory({ title, items, filter, isFullWidth = false }: { title: string, items: AuditItem[], filter: string[], isFullWidth?: boolean }) {
    const categoryItems = items.filter(item =>
        filter.some(f => item.name?.toLowerCase().includes(f))
    );

    if (categoryItems.length === 0) return null;

    return (
        <div className={cn("space-y-3", isFullWidth && "md:col-span-2")}>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-indigo-50 pb-2">{title}</h4>
            <div className="space-y-1.5">
                {categoryItems.map((item, idx) => {
                    const isMissing = item.status === 'MISSING';
                    return (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-indigo-200 transition-all group">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-700 truncate max-w-[150px]">{item.name}</span>
                                {!isMissing && item.uuid && <span className="text-[8px] font-mono text-indigo-400 italic">ID: {item.uuid}</span>}
                            </div>
                            <Badge
                                variant={isMissing ? 'destructive' : 'default'}
                                className={cn(
                                    "text-[8px] font-black uppercase px-1.5 py-0 rounded",
                                    !isMissing && "bg-emerald-500 hover:bg-emerald-600"
                                )}
                            >
                                {isMissing ? 'MISSING' : 'OK'}
                            </Badge>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

