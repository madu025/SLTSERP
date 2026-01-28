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
    const [bridgeData, setBridgeData] = useState<any>(null);
    const [isLoadingBridge, setIsLoadingBridge] = useState(false);

    useEffect(() => {
        if (isOpen && selectedOrder?.soNum && activeTab === "inspector") {
            setIsLoadingBridge(true);
            fetch(`/api/service-orders/bridge-data/${selectedOrder.soNum}`)
                .then(res => res.json())
                .then(res => {
                    if (res.success) setBridgeData(res.data);
                })
                .catch(err => console.error("Bridge fetch error:", err))
                .finally(() => setIsLoadingBridge(false));
        }
    }, [isOpen, selectedOrder?.soNum, activeTab]);

    if (!selectedOrder) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-4xl max-h-[95vh] p-0 overflow-hidden border-none shadow-2xl">
                <DialogHeader className="p-6 pb-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                                <Box className="w-5 h-5 text-blue-600" />
                                {selectedOrder.soNum}
                            </DialogTitle>
                            <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">
                                {selectedOrder.customerName || "Service Order Details"}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Badge variant={selectedOrder.sltsStatus === 'COMPLETED' ? "success" : "secondary"} className="font-bold">
                                {selectedOrder.sltsStatus}
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
                                <DetailItem icon={<Info className="w-3.5 h-3.5" />} label="SO Number" value={selectedOrder.soNum} isMono />
                                <DetailItem icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="SLTS Status" value={selectedOrder.sltsStatus} isBold />
                                <DetailItem icon={<User className="w-3.5 h-3.5" />} label="Customer Name" value={selectedOrder.customerName} />
                                <DetailItem icon={<Smartphone className="w-3.5 h-3.5" />} label="Voice Number" value={selectedOrder.voiceNumber} />
                                <DetailItem icon={<Package className="w-3.5 h-3.5" />} label="Service Type" value={selectedOrder.serviceType} />
                                <DetailItem icon={<Box className="w-3.5 h-3.5" />} label="DP" value={selectedOrder.dp} />
                                <DetailItem icon={<Activity className="w-3.5 h-3.5" />} label="Status" value={selectedOrder.status} />
                                <DetailItem icon={<FileJson className="w-3.5 h-3.5" />} label="Order Type" value={selectedOrder.orderType} />
                                <DetailItem icon={<Package className="w-3.5 h-3.5" />} label="Package" value={selectedOrder.package} />
                                <DetailItem icon={<Smartphone className="w-3.5 h-3.5" />} label="Tech Contact" value={selectedOrder.techContact} />
                                <DetailItem icon={<User className="w-3.5 h-3.5" />} label="Sales Person" value={selectedOrder.sales} />
                                <DetailItem icon={<Box className="w-3.5 h-3.5" />} label="RTOM" value={selectedOrder.rtom} />
                                <DetailItem icon={<Box className="w-3.5 h-3.5" />} label="LEA" value={selectedOrder.lea} />
                                <DetailItem icon={<Smartphone className="w-3.5 h-3.5" />} label="IPTV Number" value={selectedOrder.iptv} />
                                <DetailItem icon={<FileJson className="w-3.5 h-3.5" />} label="WORO Task" value={selectedOrder.woroTaskName} />
                                <DetailItem icon={<Clock className="w-3.5 h-3.5" />} label="Received Date" value={selectedOrder.statusDate ? new Date(selectedOrder.statusDate).toLocaleDateString() : '-'} />
                                <DetailItem icon={<Clock className="w-3.5 h-3.5" />} label="Imported Date" value={selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleDateString() : '-'} />
                                <DetailItem icon={<ShieldCheck className="w-3.5 h-3.5" />} label="SEIT (OSP)" value={selectedOrder.woroSeit} />
                                <DetailItem icon={<ShieldCheck className="w-3.5 h-3.5" />} label="SEIT (Inst)" value={selectedOrder.ftthInstSeit} />
                                {selectedOrder.completionMode && <DetailItem icon={<Activity className="w-3.5 h-3.5" />} label="Completion Mode" value={selectedOrder.completionMode} />}

                                <div className="md:col-span-2 lg:col-span-3">
                                    <DetailItem icon={<Box className="w-3.5 h-3.5" />} label="Address" value={selectedOrder.address} />
                                </div>

                                {selectedOrder.scheduledDate && (
                                    <div className="md:col-span-2 lg:col-span-3 bg-slate-50 p-4 rounded-lg border border-slate-100 flex items-start gap-4">
                                        <div className="p-2 bg-blue-100 rounded-full text-blue-600">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Scheduled Appointment</label>
                                            <p className="text-sm text-slate-900 font-bold">
                                                {new Date(selectedOrder.scheduledDate).toLocaleDateString()} at {selectedOrder.scheduledTime}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {selectedOrder.comments && (
                                    <div className="md:col-span-2 lg:col-span-3 bg-yellow-50/50 p-4 rounded-lg border border-yellow-100">
                                        <label className="text-xs font-bold text-yellow-700 uppercase block mb-1 flex items-center gap-1">
                                            <Info className="w-3 h-3" />
                                            System & User Comments
                                        </label>
                                        <p className="text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed">{selectedOrder.comments}</p>
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        {/* Tab 2: Smart Inspector (NEW) */}
                        <TabsContent value="inspector" className="p-6 m-0 outline-none">
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
                                        label="ONT Serial"
                                        value={selectedOrder.ontSerialNumber || "PENDING"}
                                        icon={<ShieldCheck className="w-4 h-4" />}
                                        color="emerald"
                                        isMono
                                    />
                                    <InspectorCard
                                        label="Voice Test"
                                        value={selectedOrder.forensicAudit?.voiceTestStatus || "NOT TESTED"}
                                        icon={<Smartphone className="w-4 h-4" />}
                                        color={selectedOrder.forensicAudit?.voiceTestStatus?.includes('PASS') ? 'emerald' : 'amber'}
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
                                        {bridgeData?.scrapedData?.materialDetails ? (
                                            bridgeData.scrapedData.materialDetails.map((mat: any, i: number) => (
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
                                        {selectedOrder.forensicAudit?.auditData.map((item, idx) => {
                                            const isOptional = item.name?.toLowerCase().includes('feedback') || item.name?.toLowerCase().includes('additional');
                                            const isMissing = item.status === 'MISSING';

                                            return (
                                                <div key={idx} className={`flex flex-col p-2.5 rounded-lg border transition-all duration-200 ${isMissing ? (isOptional ? 'bg-slate-800/40 border-slate-700' : 'bg-red-500/5 border-red-500/20') : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                                                    <div className="flex items-start justify-between gap-2">
                                                        <span className={`text-[11px] font-bold leading-tight ${isMissing ? (isOptional ? 'text-slate-400' : 'text-red-300') : 'text-emerald-300'}`}>
                                                            {item.name}
                                                        </span>
                                                        {isMissing ? (
                                                            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                                                        ) : (
                                                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                                        )}
                                                    </div>
                                                    {!isMissing && item.uuid && (
                                                        <span className="text-[9px] font-mono text-slate-500 mt-1">UUID: {item.uuid}</span>
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
                                        }) || (
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
        </Dialog>
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
