import React from 'react';

interface DatePickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    pendingStatusChange: { orderId: string, newStatus: string, soNum: string };
    completedDateInput: string;
    setCompletedDateInput: (date: string) => void;
    voiceNumber: string | null;
}

export default function DatePickerModal({ isOpen, onClose, onConfirm, pendingStatusChange, completedDateInput, setCompletedDateInput, voiceNumber }: DatePickerModalProps) {
    if (!isOpen || !pendingStatusChange) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h3 className="text-xl font-bold text-slate-900">
                        {pendingStatusChange?.newStatus === 'COMPLETED' ? 'Mark as Completed' : 'Mark as Return'}
                    </h3>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <p className="text-sm text-slate-600 mb-2">SO Number: <span className="font-mono font-semibold">{pendingStatusChange?.soNum}</span></p>
                        <p className="text-sm text-slate-600 mb-4">Voice Number: <span className="font-semibold">{voiceNumber || '-'}</span></p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            {pendingStatusChange?.newStatus === 'COMPLETED' ? 'Completed' : 'Return'} Date *
                        </label>
                        <input
                            type="date"
                            value={completedDateInput}
                            onChange={e => setCompletedDateInput(e.target.value)}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            required
                        />
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs text-blue-800">
                            ℹ️ This date will be recorded as the {pendingStatusChange?.newStatus.toLowerCase()} date for this service order.
                        </p>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={onClose}
                            className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl"
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
