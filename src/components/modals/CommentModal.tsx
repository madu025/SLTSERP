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
                    <DialogTitle>Add Comment</DialogTitle>
                </DialogHeader>

                <div className="mb-4 space-y-1">
                    <p className="text-sm text-slate-600">
                        SO Number: <span className="font-mono font-semibold text-slate-900">{selectedOrder.soNum}</span>
                    </p>
                    <p className="text-sm text-slate-600">
                        Customer: <span className="font-semibold text-slate-900">{selectedOrder.customerName}</span>
                    </p>
                </div>

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
