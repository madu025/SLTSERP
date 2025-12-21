import React from 'react';

interface DetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedOrder: any;
}

export default function DetailModal({ isOpen, onClose, selectedOrder }: DetailModalProps) {
    if (!isOpen || !selectedOrder) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white">
                    <h3 className="text-xl font-bold text-slate-900">Service Order Details</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">SO Number</label>
                            <p className="text-sm font-mono font-semibold text-slate-900">{selectedOrder?.soNum}</p>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">SLTS Status</label>
                            <p className="text-sm font-semibold text-slate-900">{selectedOrder?.sltsStatus}</p>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">Customer Name</label>
                            <p className="text-sm text-slate-900">{selectedOrder?.customerName || '-'}</p>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">Voice Number</label>
                            <p className="text-sm text-slate-900">{selectedOrder?.voiceNumber || '-'}</p>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">Service Type</label>
                            <p className="text-sm text-slate-900">{selectedOrder?.serviceType || '-'}</p>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">DP</label>
                            <p className="text-sm text-slate-900">{selectedOrder?.dp || '-'}</p>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">Status</label>
                            <p className="text-sm text-slate-900">{selectedOrder?.status}</p>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">Order Type</label>
                            <p className="text-sm text-slate-900">{selectedOrder?.orderType || '-'}</p>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">Package</label>
                            <p className="text-sm text-slate-900">{selectedOrder?.package || '-'}</p>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">Tech Contact</label>
                            <p className="text-sm text-slate-900">{selectedOrder?.techContact || '-'}</p>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">Sales Person</label>
                            <p className="text-sm text-slate-900">{selectedOrder?.sales || '-'}</p>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">RTOM</label>
                            <p className="text-sm text-slate-900">{selectedOrder?.rtom}</p>
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase">Address</label>
                            <p className="text-sm text-slate-900">{selectedOrder?.address || '-'}</p>
                        </div>
                        {selectedOrder?.scheduledDate && (
                            <div className="col-span-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Scheduled Appointment</label>
                                <p className="text-sm text-slate-900">
                                    {selectedOrder?.scheduledDate ? new Date(selectedOrder.scheduledDate).toLocaleDateString() : ''} at {selectedOrder?.scheduledTime}
                                </p>
                            </div>
                        )}
                        {selectedOrder?.comments && (
                            <div className="col-span-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Comments</label>
                                <p className="text-sm text-slate-900 whitespace-pre-wrap">{selectedOrder.comments}</p>
                            </div>
                        )}
                    </div>
                    <div className="pt-4">
                        <button
                            onClick={onClose}
                            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
