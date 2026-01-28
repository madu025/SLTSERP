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
    Box,
    Camera,
    CheckCircle2,
    Clock,
    FileJson,
    History,
    Info,
    Package,
    RefreshCw,
    ShieldCheck,
    Smartphone,
    User,
    XCircle
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedOrder: (ServiceOrder & {
        woroSeit?: string | null;
        ftthInstSeit?: string | null;
        forensicAudit?: {
            auditData: AuditItem[];
            voiceTestStatus: string | null;
        };
    }) | null;
}

export default function DetailModal({ isOpen, onClose, selectedOrder }: DetailModalProps) {
    const [activeTab, setActiveTab] = useState("details");
    const [coreOrder, setCoreOrder] = useState<Record<string, unknown> | null>(selectedOrder as unknown as Record<string, unknown>);
    const [isLoadingCore, setIsLoadingCore] = useState(false);
    const [bridgeData, setBridgeData] = useState<Record<string, unknown> | null>(null);
    const [isLoadingBridge, setIsLoadingBridge] = useState(false);

    useEffect(() => {
        if (isOpen && selectedOrder?.soNum) {
            setCoreOrder(selectedOrder); // Reset to prop first
            const fetchCoreData = async () => {
                setIsLoadingCore(true);
                try {
                    const res = await fetch(`/api/service-orders/core-data/${selectedOrder.soNum}`);
                    const json = await res.json();
                    if (json.success) setCoreOrder(json.data);
                } catch (err) {
                    console.error("Core fetch error:", err);
                } finally {
                    setIsLoadingCore(false);
                }
            };
            fetchCoreData();

            if (activeTab === "inspector") {
                const fetchBridgeData = async () => {
                    setIsLoadingBridge(true);
                    try {
                        const res = await fetch(`/api/service-orders/bridge-data/${selectedOrder.soNum}`);
                        const data = await res.json();
                        if (data.success) setBridgeData(data.data);
                    } catch (err) {
                        console.error("Bridge fetch error:", err);
                    } finally {
                        setIsLoadingBridge(false);
                    }
                };
                fetchBridgeData();
            }
        }
    }, [isOpen, selectedOrder, activeTab]);

    if (!selectedOrder) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-4xl max-h-[95vh] p-0 overflow-hidden border-none shadow-2xl">
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

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="px-6 border-b">
                        <TabsList className="bg-transparent h-12 p-0 gap-6">
                            <TabsTrigger value="details" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-0 h-12 font-bold text-xs uppercase tracking-widest text-slate-500 data-[state=active]:text-slate-900">
                                <History className="w-3.5 h-3.5 mr-2" />
                                Standard Details
                            </TabsTrigger>
                            <TabsTrigger value="inspector" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none px-0 h-12 font-bold text-xs uppercase tracking-widest text-slate-500 data-[state=active]:text-indigo-600">
                                <Activity className="w-3.5 h-3.5 mr-2" />
                                Smart Inspector
                                <div className="ml-2 w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <ScrollArea className="h-[calc(90vh-140px)] w-full">
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
                                <DetailItem icon={<Clock className="w-3.5 h-3.5" />} label="Received Date" value={coreOrder?.statusDate ? new Date(coreOrder.statusDate).toLocaleDateString() : '-'} />
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
                                    <DetailItem icon={<Clock className="w-3.5 h-3.5" />} label="Completed Date" value={new Date(coreOrder.completedDate).toLocaleDateString()} isBold />
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
                                            {(coreOrder?.materialUsage as Array<Record<string, unknown>>)?.map((usage: Record<string, unknown>, i: number) => (
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
                                                        {(coreOrder as Record<string, unknown>)?.forensicAudit?.auditData?.filter((a: Record<string, unknown>) => a.status === 'UPLOADED').length || 0} / {(coreOrder as Record<string, unknown>)?.forensicAudit?.auditData?.length || 0}
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

                        {/* Tab 2: Smart Inspector (NEW) */}
                        <TabsContent value="inspector" className="p-6 m-0 outline-none relative min-h-[400px]">
                            {isLoadingBridge && (
                                <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                        <p className="text-xs font-bold text-slate-600 animate-pulse uppercase tracking-widest">Bridging Data...</p>
                                    </div>
                                </div>
                            )}
                            <div className="space-y-6">
                                {/* Header Info mimics Data Inspector */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <InspectorCard
                                        label="Portal User"
                                        value={bridgeData?.sltUser || "N/A"}
                                        icon={<User className="w-4 h-4" />}
                                        color="blue"
                                    />
                                    <InspectorCard
                                        label="Active Tab"
                                        value={bridgeData?.activeTab || "N/A"}
                                        icon={<Activity className="w-4 h-4" />}
                                        color="indigo"
                                    />
                                    <InspectorCard
                                        label="Selected Team"
                                        value={bridgeData?.scrapedData?.teamDetails?.name || bridgeData?.scrapedData?.selectedTeam || "N/A"}
                                        icon={<User className="w-4 h-4" />}
                                        color="blue"
                                    />
                                    <InspectorCard
                                        label="ONT Serial"
                                        value={selectedOrder.ontSerialNumber || "PENDING"}
                                        icon={<ShieldCheck className="w-4 h-4" />}
                                        color="emerald"
                                        isMono
                                    />
                                    <InspectorCard
                                        label="Voice Test"
                                        value={coreOrder?.forensicAudit?.voiceTestStatus || "NOT TESTED"}
                                        icon={<Smartphone className="w-4 h-4" />}
                                        color={coreOrder?.forensicAudit?.voiceTestStatus?.includes('PASS') ? 'emerald' : 'amber'}
                                    />
                                    <InspectorCard
                                        label="Portal S-Val"
                                        value={bridgeData?.scrapedData?.masterData?.['STATUS VALUE'] || "100000"}
                                        icon={<FileJson className="w-4 h-4" />}
                                        color="slate"
                                    />
                                    <InspectorCard
                                        label="Last Sync"
                                        value={bridgeData?.updatedAt ? new Date(bridgeData.updatedAt).toLocaleTimeString() : "Live"}
                                        icon={<Clock className="w-4 h-4" />}
                                        color="rose"
                                    />
                                </div>

                                {/* Materials Intelligence Section */}
                                <div className="bg-slate-900 rounded-xl p-5 border border-slate-800 shadow-xl overflow-hidden">
                                    <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
                                        <Box className="w-4 h-4 text-emerald-400" />
                                        <h3 className="text-sm font-black text-white uppercase tracking-wider">Materials Intelligence</h3>
                                        <span className="ml-auto text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">SMART VIEW</span>
                                    </div>
                                    <div className="space-y-2">
                                        {bridgeData?.scrapedData && (bridgeData.scrapedData as Record<string, unknown>).materialDetails ? (
                                            ((bridgeData.scrapedData as Record<string, unknown>).materialDetails as Array<{ NAME?: string; TYPE?: string; CODE?: string; QTY?: string; QUANTITY?: string }>).map((mat, i: number) => (
                                                <div key={i} className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-slate-700/50">
                                                    <span className="text-[11px] font-bold text-slate-300">{mat.NAME || mat.TYPE}</span>
                                                    <div className="flex gap-3 items-center">
                                                        <span className="text-[10px] text-slate-500 font-mono">{mat.CODE || i.toString().padStart(3, '0')}</span>
                                                        <span className="text-xs font-black text-emerald-400">{mat.QTY || mat.QUANTITY}</span>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-4">
                                                <p className="text-xs text-slate-500 italic">No materials scraped for this order yet.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Forensic Photo Audit View */}
                                <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 shadow-xl overflow-hidden relative">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                                        <Camera className="w-20 h-20" />
                                    </div>

                                    <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                                            <h3 className="text-sm font-black tracking-wider uppercase text-blue-400">Forensic Photo Audit</h3>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {coreOrder?.forensicAudit?.auditData && (coreOrder.forensicAudit.auditData as Array<Record<string, unknown>>).length > 0 ? (
                                            (coreOrder.forensicAudit.auditData as Array<Record<string, unknown>>).map((item: Record<string, unknown>, idx: number) => {
                                                const itemTyped = item as { name?: string; status?: string; uuid?: string };
                                                const isOptional = itemTyped.name?.toLowerCase().includes('feedback') || itemTyped.name?.toLowerCase().includes('additional');
                                                const isMissing = itemTyped.status === 'MISSING';

                                                return (
                                                    <div key={idx} className={`flex flex-col p-2.5 rounded-lg border transition-all duration-200 ${isMissing ? (isOptional ? 'bg-slate-800/40 border-slate-700' : 'bg-red-500/5 border-red-500/20') : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                                                        <div className="flex items-start justify-between gap-2">
                                                            <span className={`text-[11px] font-bold leading-tight ${isMissing ? (isOptional ? 'text-slate-400' : 'text-red-300') : 'text-emerald-300'}`}>
                                                                {itemTyped.name}
                                                            </span>
                                                            {isMissing ? (
                                                                <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                                                            ) : (
                                                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                                            )}
                                                        </div>
                                                        {!isMissing && itemTyped.uuid && (
                                                            <span className="text-[9px] font-mono text-slate-500 mt-1">UUID: {itemTyped.uuid}</span>
                                                        )}
                                                        {!isMissing && (
                                                            <span className="text-[9px] font-bold text-emerald-500/70 mt-1 uppercase tracking-tighter flex items-center gap-1">
                                                                <CheckCircle2 className="w-2 h-2" /> Uploaded
                                                            </span>
                                                        )}
                                                        {isMissing && (
                                                            <span className="text-[9px] font-bold text-red-500/70 mt-1 uppercase tracking-tighter flex items-center gap-1">
                                                                <XCircle className="w-2 h-2" /> Missing
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="col-span-3 text-center py-8">
                                                <p className="text-xs text-slate-500 italic">No forensic data found. Please run capture via SLT-ERP Addon.</p>
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

function InspectorCard({ label, value, icon, color, isMono = false }: { label: string, value: string, icon: React.ReactNode, color: string, isMono?: boolean }) {
    const colorMap: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        slate: 'bg-slate-50 text-slate-600 border-slate-100',
        rose: 'bg-rose-50 text-rose-600 border-rose-100',
    };

    return (
        <div className={`p-3 rounded-xl border ${colorMap[color] || colorMap.slate} flex flex-col gap-1 shadow-sm`}>
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider opacity-70">{label}</span>
                {icon}
            </div>
            <p className={`text-sm font-black truncate mt-1 ${isMono ? 'font-mono' : ''}`}>
                {value}
            </p>
        </div>
    );
}
