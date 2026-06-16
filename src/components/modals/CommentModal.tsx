"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { MessageSquare, History } from "lucide-react";
import { DetailedServiceOrder, ServiceOrderComment } from "@/types/service-order";

const commentSchema = z.object({
    comment: z.string().min(1, "Comment cannot be empty"),
});

type CommentFormValues = z.infer<typeof commentSchema>;

interface CommentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (comment: string) => void;
    selectedOrder: DetailedServiceOrder | null;
    // We can allow passing initial comment if editing
    initialComment?: string;
}

export default function CommentModal({ isOpen, onClose, onSubmit, selectedOrder, initialComment = "" }: CommentModalProps) {
    const [history, setHistory] = React.useState<ServiceOrderComment[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);

    const form = useForm<CommentFormValues>({
        resolver: zodResolver(commentSchema),
        defaultValues: {
            comment: initialComment,
        },
    });

    // Reset form and fetch history when modal opens
    React.useEffect(() => {
        if (isOpen && selectedOrder?.soNum) {
            form.reset({ comment: initialComment });
            
            const fetchHistory = async () => {
                setIsLoadingHistory(true);
                try {
                    const res = await fetch(`/api/service-orders/core-data/${selectedOrder.soNum}`);
                    const json = await res.json();
                    if (json.success && json.data.commentsHistory) {
                        setHistory(json.data.commentsHistory);
                    }
                } catch (err) {
                    console.error("Failed to fetch comment history:", err);
                } finally {
                    setIsLoadingHistory(false);
                }
            };
            fetchHistory();
        } else if (!isOpen) {
            setHistory([]);
        }
    }, [isOpen, selectedOrder?.soNum, initialComment, form]);

    const handleSubmit = (values: CommentFormValues) => {
        onSubmit(values.comment);
        onClose();
    };

    if (!selectedOrder) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-rose-600" />
                        Add Internal Note
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 space-y-6 pb-6">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SO Number</span>
                            <span className="text-[11px] font-mono font-bold text-slate-900">{selectedOrder.soNum}</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-slate-100 pt-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</span>
                            <span className="text-[11px] font-bold text-slate-700 truncate max-w-[200px]">{selectedOrder.customerName}</span>
                        </div>
                    </div>

                    {/* Comment History Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <History className="w-3 h-3 text-slate-400" />
                                Previous Comments {history.length > 0 && `(${history.length})`}
                            </label>
                            {isLoadingHistory && <span className="text-[9px] animate-pulse text-blue-500 font-bold">FECHING...</span>}
                        </div>
                        
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                            {history.length > 0 ? (
                                history.map((c) => (
                                    <div key={c.id} className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
                                        <div className="flex justify-between items-start mb-1">
                                             <span className="text-[9px] font-black text-amber-700 uppercase tracking-tighter bg-amber-100/50 px-1.5 py-0.5 rounded">
                                                 {c.author?.name || 'System Auto'}
                                             </span>
                                             <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">
                                                 {new Date(c.createdAt).toLocaleDateString('en-GB')} {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                             </span>
                                         </div>
                                         <p className="text-[11px] text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                                             {c.comment}
                                         </p>
                                    </div>
                                ))
                            ) : !isLoadingHistory && (
                                <div className="py-6 text-center bg-slate-50/50 border border-dashed border-slate-200 rounded-xl">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">No previous comments found.</p>
                                </div>
                            )}

                            {/* Fallback to main comments field if nothing in history yet */}
                            {selectedOrder.comments && (!history || history.length === 0) && (
                                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                                    <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Legacy Note</label>
                                    <p className="text-[11px] text-slate-600 italic">{selectedOrder.comments}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="px-6 pb-6 border-t pt-4">
                    <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="comment"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Comment</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Enter your comment here..."
                                            rows={4}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex gap-3 justify-end pt-4">
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit">
                                Save Comment
                            </Button>
                        </div>
                    </form>
                </Form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
