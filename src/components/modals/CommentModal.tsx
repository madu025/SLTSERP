import React from 'react';

interface CommentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    selectedOrder: any;
    commentText: string;
    setCommentText: (text: string) => void;
}

export default function CommentModal({ isOpen, onClose, onSubmit, selectedOrder, commentText, setCommentText }: CommentModalProps) {
    if (!isOpen || !selectedOrder) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-900">Add Comment</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <p className="text-sm text-slate-600 mb-4">SO Number: <span className="font-mono font-semibold">{selectedOrder.soNum}</span></p>
                        <p className="text-sm text-slate-600 mb-4">Customer: <span className="font-semibold">{selectedOrder.customerName}</span></p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Comment</label>
                        <textarea
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                            rows={4}
                            placeholder="Enter your comment here..."
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={onClose}
                            className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onSubmit}
                            className="flex-1 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl"
                        >
                            Save Comment
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
