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
import { MessageSquare, Info } from "lucide-react";

const commentSchema = z.object({
    comment: z.string().min(1, "Comment cannot be empty"),
});

type CommentFormValues = z.infer<typeof commentSchema>;

interface CommentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (comment: string) => void;
    selectedOrder: any;
    // We can allow passing initial comment if editing
    initialComment?: string;
}

export default function CommentModal({ isOpen, onClose, onSubmit, selectedOrder, initialComment = "" }: CommentModalProps) {
    const form = useForm<CommentFormValues>({
        resolver: zodResolver(commentSchema),
        defaultValues: {
            comment: initialComment,
        },
    });

    // Reset form when modal opens
    React.useEffect(() => {
        if (isOpen) {
            form.reset({ comment: initialComment });
        }
    }, [isOpen, initialComment, form]);

    const handleSubmit = (values: CommentFormValues) => {
        onSubmit(values.comment);
        onClose();
    };

    if (!selectedOrder) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-rose-600" />
                        Add Internal Note
                    </DialogTitle>
                </DialogHeader>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 mb-4">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SO Number</span>
                        <span className="text-[11px] font-mono font-bold text-slate-900">{selectedOrder.soNum}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-100 pt-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</span>
                        <span className="text-[11px] font-bold text-slate-700 truncate max-w-[200px]">{selectedOrder.customerName}</span>
                    </div>
                </div>

                {selectedOrder.comments && (
                    <div className="mb-6 p-3 bg-amber-50 border border-amber-100 rounded-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-1 opacity-10">
                            <Info className="w-6 h-6 text-amber-900" />
                        </div>
                        <label className="text-[9px] font-black text-amber-700 uppercase block mb-1">Previous/Current Note</label>
                        <p className="text-[11px] text-slate-600 line-clamp-3 leading-snug">{selectedOrder.comments}</p>
                    </div>
                )}

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
            </DialogContent>
        </Dialog>
    );
}
