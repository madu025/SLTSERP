"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

const scheduleSchema = z.object({
    contactNumber: z.string().optional(),
    date: z.date({
        message: "Appointment date is required.",
    }),
    time: z.string().min(1, "Appointment time is required"),
});

type ScheduleFormValues = z.infer<typeof scheduleSchema>;

import { DetailedServiceOrder } from "@/types/service-order";

interface ScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { date: string; time: string; contactNumber?: string }) => void;
    selectedOrder: DetailedServiceOrder | null;
}

export default function ScheduleModal({ isOpen, onClose, onSubmit, selectedOrder }: ScheduleModalProps) {
    const form = useForm<ScheduleFormValues>({
        resolver: zodResolver(scheduleSchema),
        defaultValues: {
            contactNumber: selectedOrder?.techContact || "",
            time: "",
        },
    });

    useEffect(() => {
        if (isOpen && selectedOrder) {
            form.reset({
                contactNumber: selectedOrder.techContact || selectedOrder.voiceNumber || "",
                time: selectedOrder.scheduledTime || "",
                date: selectedOrder.scheduledDate ? new Date(selectedOrder.scheduledDate) : undefined,
            });
        }
    }, [isOpen, selectedOrder, form]);

    const handleSubmit = (values: ScheduleFormValues) => {
        onSubmit({
            date: values.date.toISOString(),
            time: values.time,
            contactNumber: values.contactNumber
        });
        onClose();
    };

    if (!selectedOrder) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent 
                showCloseButton={false}
                className="fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full w-[30vw] md:w-[30vw] sm:w-full !max-w-none flex flex-col !p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none text-foreground"
            >
                <div className="relative p-6 pb-4 flex-shrink-0 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-800/60">
                    <div className="absolute top-0 right-0 p-5">
                        <button 
                            type="button"
                            onClick={onClose} 
                            className="p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <DialogTitle className="text-base font-extrabold text-slate-900 dark:text-white">Schedule Appointment</DialogTitle>
                </div>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-grow overflow-hidden text-xs">
                        <div className="flex-grow overflow-y-auto p-6 space-y-4">
                            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl space-y-2 border border-slate-200/60 dark:border-slate-800/60">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SO Number</span>
                                    <span className="text-[11px] font-mono font-bold text-slate-900">{selectedOrder.soNum}</span>
                                </div>
                                <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</span>
                                    <span className="text-[11px] font-bold text-slate-700 truncate max-w-[150px]">{selectedOrder.customerName}</span>
                                </div>
                            </div>

                        <FormField
                            control={form.control}
                            name="contactNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Contact Number</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter contact number" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="date"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Appointment Date *</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full pl-3 text-left font-normal",
                                                        !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    {field.value ? (
                                                        format(field.value, "PPP")
                                                    ) : (
                                                        <span>Pick a date</span>
                                                    )}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={field.onChange}
                                                disabled={(date) =>
                                                    date < new Date(new Date().setHours(0, 0, 0, 0))
                                                }
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="time"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Appointment Time *</FormLabel>
                                    <FormControl>
                                        <Input type="time" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        </div>
                        <div className="flex gap-3 justify-end p-5 border-t border-border/40 bg-slate-50 dark:bg-slate-900/20 shrink-0">
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit">
                                Schedule
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
