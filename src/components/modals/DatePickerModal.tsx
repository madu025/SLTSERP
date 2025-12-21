"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (date: string) => void;
    title?: string;
}

export default function DatePickerModal({ isOpen, onClose, onConfirm, title = "Select Date" }: DatePickerModalProps) {
    const [date, setDate] = useState<Date | undefined>(undefined);

    useEffect(() => {
        if (isOpen) {
            setDate(undefined); // Reset date when opening
        }
    }, [isOpen]);

    const handleConfirm = () => {
        if (date) {
            // ISO string (YYYY-MM-DD or full ISO)
            onConfirm(date.toISOString());
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-4">
                    <p className="text-sm text-slate-500">
                        Please select the completion/return date for this order.
                    </p>
                    <div className="grid place-items-center border rounded-md p-4">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={setDate}
                            initialFocus
                        />
                    </div>
                    <Button onClick={handleConfirm} disabled={!date} className="w-full">
                        Confirm Date
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
