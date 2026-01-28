"use client";

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AuditItem {
    name: string;
    status: string;
    uuid?: string;
}

interface DetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedOrder: {
        soNum: string;
        sltsStatus: string;
        customerName: string;
        voiceNumber: string;
        serviceType: string;
        dp: string;
        status: string;
        orderType: string;
        package: string;
        techContact: string;
        sales: string;
        rtom: string;
        lea: string;
        iptv: string;
        woroTaskName: string;
        statusDate: string;
        createdAt: string;
        updatedAt: string;
        woroSeit: string;
        ftthInstSeit: string;
        completionMode?: string;
        address: string;
        scheduledDate?: string;
        scheduledTime?: string;
        comments?: string;
        ontSerialNumber?: string;
        iptvSerialNumbers?: string;
        dpDetails?: string;
        dropWireDistance?: number;
        forensicAudit?: {
            auditData: AuditItem[];
            voiceTestStatus: string | null;
        };
    } | null;
}

export default function DetailModal({ isOpen, onClose, selectedOrder }: DetailModalProps) {
    if (!selectedOrder) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Service Order Details</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    <DetailItem label="SO Number" value={selectedOrder.soNum} isMono />
                    <DetailItem label="SLTS Status" value={selectedOrder.sltsStatus} isBold />
                    <DetailItem label="Customer Name" value={selectedOrder.customerName} />
                    <DetailItem label="Voice Number" value={selectedOrder.voiceNumber} />
                    <DetailItem label="Service Type" value={selectedOrder.serviceType} />
                    <DetailItem label="DP" value={selectedOrder.dp} />
                    <DetailItem label="Status" value={selectedOrder.status} />
                    <DetailItem label="Order Type" value={selectedOrder.orderType} />
                    <DetailItem label="Package" value={selectedOrder.package} />
                    <DetailItem label="Tech Contact" value={selectedOrder.techContact} />
                    <DetailItem label="Sales Person" value={selectedOrder.sales} />
                    <DetailItem label="RTOM" value={selectedOrder.rtom} />
                    <DetailItem label="LEA" value={selectedOrder.lea} />
                    <DetailItem label="IPTV Number" value={selectedOrder.iptv} />
                    <DetailItem label="WORO Task" value={selectedOrder.woroTaskName} />
                    <DetailItem label="Received Date" value={selectedOrder.statusDate ? new Date(selectedOrder.statusDate).toLocaleDateString() : '-'} />
                    <DetailItem label="Imported Date" value={selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleDateString() : '-'} />
                    <DetailItem label="SEIT Number (OSP)" value={selectedOrder.woroSeit} />
                    <DetailItem label="SEIT Number (Inst)" value={selectedOrder.ftthInstSeit} />
                    {selectedOrder.completionMode && <DetailItem label="Completion Mode" value={selectedOrder.completionMode} />}

                    <div className="md:col-span-2">
                        <DetailItem label="Address" value={selectedOrder.address} />
                    </div>

                    {selectedOrder.scheduledDate && (
                        <div className="md:col-span-2 bg-slate-50 p-4 rounded-lg border border-slate-100">
                            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Scheduled Appointment</label>
                            <p className="text-sm text-slate-900 font-medium">
                                {new Date(selectedOrder.scheduledDate).toLocaleDateString()} at {selectedOrder.scheduledTime}
                            </p>
                        </div>
                    )}

                    {selectedOrder.comments && (
                        <div className="md:col-span-2 bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                            <label className="text-xs font-semibold text-yellow-600 uppercase block mb-1">Comments</label>
                            <p className="text-sm text-slate-900 whitespace-pre-wrap">{selectedOrder.comments}</p>
                        </div>
                    )}

                    {/* Completion Details */}
                    {selectedOrder.sltsStatus === 'COMPLETED' && (selectedOrder.ontSerialNumber || selectedOrder.iptvSerialNumbers || selectedOrder.dpDetails) && (
                        <div className="md:col-span-2 bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                            <label className="text-xs font-semibold text-emerald-700 uppercase block mb-3">Installation Infrastructure</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {selectedOrder.ontSerialNumber && (
                                    <div className="bg-white p-2 rounded border border-emerald-100">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold">ONT Serial</span>
                                        <p className="text-sm font-mono font-bold text-slate-900">{selectedOrder.ontSerialNumber}</p>
                                    </div>
                                )}
                                {selectedOrder.dropWireDistance && (
                                    <div className="bg-white p-2 rounded border border-emerald-100">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold">Drop Wire Distance</span>
                                        <p className="text-sm font-bold text-slate-900">{selectedOrder.dropWireDistance}m</p>
                                    </div>
                                )}
                                {selectedOrder.iptvSerialNumbers && (
                                    <div className="md:col-span-2 bg-white p-2 rounded border border-emerald-100">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold">STB Serials</span>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {selectedOrder.iptvSerialNumbers.startsWith('[')
                                                ? (JSON.parse(selectedOrder.iptvSerialNumbers) as string[]).map((serial: string, idx: number) => (
                                                    <span key={idx} className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded text-[11px] font-mono font-bold text-emerald-800">
                                                        {serial}
                                                    </span>
                                                ))
                                                : <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded text-[11px] font-mono font-bold text-emerald-800">{selectedOrder.iptvSerialNumbers}</span>
                                            }
                                        </div>
                                    </div>
                                )}
                                {selectedOrder.dpDetails && (
                                    <div className="md:col-span-2 bg-white p-2 rounded border border-emerald-100">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold">DP Details</span>
                                        <p className="text-sm text-slate-800 mt-0.5">{selectedOrder.dpDetails}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Forensic Photo Audit Section */}
                    {selectedOrder.forensicAudit && (
                        <div className="md:col-span-2 bg-slate-900 text-white p-5 rounded-xl border border-slate-800 shadow-xl overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                            </div>

                            <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                                    <h3 className="text-sm font-bold tracking-wider uppercase text-blue-400">Forensic Photo Audit</h3>
                                </div>
                                {selectedOrder.forensicAudit.voiceTestStatus && (
                                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${selectedOrder.forensicAudit.voiceTestStatus.toUpperCase().includes('PASS') ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                        Voice: {selectedOrder.forensicAudit.voiceTestStatus}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {selectedOrder.forensicAudit.auditData.map((item, idx) => {
                                    const isOptional = item.name?.toLowerCase().includes('feedback') || item.name?.toLowerCase().includes('additional');
                                    const isMissing = item.status === 'MISSING';

                                    return (
                                        <div key={idx} className={`flex flex-col p-2.5 rounded-lg border transition-all duration-200 ${isMissing ? (isOptional ? 'bg-slate-800/40 border-slate-700' : 'bg-red-500/5 border-red-500/20') : 'bg-emerald-500/5 border-emerald-500/20'}`}>
                                            <div className="flex items-start justify-between gap-2">
                                                <span className={`text-[11px] font-bold leading-tight ${isMissing ? (isOptional ? 'text-slate-400' : 'text-red-300') : 'text-emerald-300'}`}>
                                                    {item.name}
                                                    {isOptional && <span className="ml-1 text-[9px] opacity-60 font-normal">(Optional)</span>}
                                                </span>
                                                {isMissing ? (
                                                    <span className="text-red-500 shrink-0">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </span>
                                                ) : (
                                                    <span className="text-emerald-500 shrink-0">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                    </span>
                                                )}
                                            </div>
                                            {!isMissing && item.uuid && (
                                                <span className="text-[9px] font-mono text-slate-500 mt-1">UUID: {item.uuid}</span>
                                            )}
                                            {isMissing && !isOptional && (
                                                <span className="text-[9px] font-bold text-red-500/70 mt-1 uppercase tracking-tighter">Action Required</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center">
                                <span className="text-[10px] text-slate-500 italic">Last forensic sync: {new Date(selectedOrder.updatedAt).toLocaleString()}</span>
                                <div className="flex gap-4 text-[10px] font-bold">
                                    <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> <span className="text-emerald-500">UPLOADED</span></div>
                                    <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-red-500 rounded-full" /> <span className="text-red-500">MISSING</span></div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                <div className="flex justify-end pt-2">
                    <Button onClick={onClose} variant="secondary">Close</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function DetailItem({ label, value, isMono = false, isBold = false }: { label: string, value: string | null | undefined, isMono?: boolean, isBold?: boolean }) {
    return (
        <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
            <p className={`text-sm text-slate-900 mt-1 ${isMono ? 'font-mono' : ''} ${isBold ? 'font-bold' : ''}`}>
                {value || '-'}
            </p>
        </div>
    );
}
