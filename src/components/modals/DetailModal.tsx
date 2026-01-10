"use client";

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedOrder: any;
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
                            <label className="text-xs font-semibold text-emerald-700 uppercase block mb-2">Installation Details</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {selectedOrder.ontSerialNumber && (
                                    <div>
                                        <span className="text-xs text-slate-500 font-medium">ONT Serial:</span>
                                        <p className="text-sm font-mono font-bold text-slate-900">{selectedOrder.ontSerialNumber}</p>
                                    </div>
                                )}
                                {selectedOrder.iptvSerialNumbers && (
                                    <div className="md:col-span-2">
                                        <span className="text-xs text-slate-500 font-medium">STB Serials:</span>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {JSON.parse(selectedOrder.iptvSerialNumbers).map((serial: string, idx: number) => (
                                                <span key={idx} className="px-2 py-1 bg-white border border-emerald-300 rounded text-xs font-mono font-semibold text-slate-800">
                                                    {serial}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {selectedOrder.dpDetails && (
                                    <div className="md:col-span-2">
                                        <span className="text-xs text-slate-500 font-medium">DP Details:</span>
                                        <p className="text-sm text-slate-900 mt-1 whitespace-pre-wrap">{selectedOrder.dpDetails}</p>
                                    </div>
                                )}
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
