import React from 'react';

interface ManualEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    formData: any;
    setFormData: (data: any) => void;
}

export default function ManualEntryModal({ isOpen, onClose, onSubmit, formData, setFormData }: ManualEntryModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-900">Add Service Order</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <form onSubmit={onSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">SO Number *</label>
                            <input
                                type="text"
                                required
                                value={formData.soNum}
                                onChange={e => setFormData({ ...formData, soNum: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Voice Number</label>
                            <input
                                type="text"
                                value={formData.voiceNumber}
                                onChange={e => setFormData({ ...formData, voiceNumber: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name</label>
                            <input
                                type="text"
                                value={formData.customerName}
                                onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tech Contact</label>
                            <input
                                type="text"
                                value={formData.techContact}
                                onChange={e => setFormData({ ...formData, techContact: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Status *</label>
                            <select
                                required
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                <option value="INPROGRESS">In Progress</option>
                                <option value="INSTALL_CLOSED">Install Closed</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Order Type</label>
                            <input
                                type="text"
                                value={formData.orderType}
                                onChange={e => setFormData({ ...formData, orderType: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Service Type</label>
                            <input
                                type="text"
                                value={formData.serviceType}
                                onChange={e => setFormData({ ...formData, serviceType: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Package</label>
                            <input
                                type="text"
                                value={formData.package}
                                onChange={e => setFormData({ ...formData, package: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">DP</label>
                            <input
                                type="text"
                                value={formData.dp}
                                onChange={e => setFormData({ ...formData, dp: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Sales Person</label>
                            <input
                                type="text"
                                value={formData.sales}
                                onChange={e => setFormData({ ...formData, sales: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                            <textarea
                                value={formData.address}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                                rows={2}
                                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl"
                        >
                            Add Service Order
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
