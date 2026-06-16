"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
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

interface ScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
    selectedOrder: any;
}

export default function ScheduleModal({ isOpen, onClose, onSubmit, selectedOrder }: ScheduleModalProps) {
    const form = useForm<ScheduleFormValues>({
        resolver: zodResolver(scheduleSchema),
        defaultValues: {
            contactNumber: selectedOrder?.techContact || selectedOrder?.contactNumber || "",
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
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Schedule Appointment</DialogTitle>
                </DialogHeader>

                <div className="mb-4 space-y-1">
                    <div className="text-sm text-slate-600 grid grid-cols-3 gap-2">
                        <span className="font-semibold">SO Number:</span>
                        <span className="col-span-2 font-mono text-slate-900">{selectedOrder.soNum}</span>
                        <span className="font-semibold">Customer:</span>
                        <span className="col-span-2 text-slate-900 truncate">{selectedOrder.customerName}</span>
                    </div>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">

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

                        <div className="flex gap-3 justify-end pt-4">
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
