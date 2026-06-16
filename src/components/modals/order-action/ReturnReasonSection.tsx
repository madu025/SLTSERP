"use client";

import React from "react";
import { AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const RETURN_REASONS = [
    "CANCELLED BY SLT",
    "CANNOT CONTACT CUSTOMER",
    "CUSTOMER NOT READY",
    "FAULTY OSP NW",
    "LINE NOT READY",
    "LOW SNR",
    "NO OSP NW/PRIMARY/SECONDARY",
    "NO PORTS",
    "NO TEAM CAPACITY",
    "OSS DATA ERROR",
    "OVER DISTANCE",
    "POLE COUNT EXCEEDS AND OVER DISTANCE",
    "POLE COUNTS EXCEEDS THAN ALLOWABLE",
    "POLE ERECTION PROBLEM",
    "REFUSED BY CUSTOMER",
    "THIRD PARTY OBSTRUCTIONS",
    "POWER LEVEL ISSUE",
    "Other"
];

interface ReturnReasonSectionProps {
    reason: string;
    onReasonChange: (val: string) => void;
    customReason: string;
    onCustomReasonChange: (val: string) => void;
}

export function ReturnReasonSection({
    reason,
    onReasonChange,
    customReason,
    onCustomReasonChange
}: ReturnReasonSectionProps) {
    return (
        <div className="space-y-4 border p-4 rounded-lg bg-red-50/30 border-red-100">
            <div className="flex items-center gap-2 mb-2 text-red-800 font-medium">
                <AlertCircle className="w-4 h-4" />
                <span>Return Information</span>
            </div>

            <div className="space-y-2">
                <Label>Reason for Return</Label>
                <Select value={reason} onValueChange={onReasonChange}>
                    <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                        {RETURN_REASONS.map(r => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {reason === "Other" && (
                <div className="space-y-2">
                    <Label>Specific Reason</Label>
                    <Textarea 
                        placeholder="Please describe the specific reason for return..." 
                        value={customReason}
                        onChange={(e) => onCustomReasonChange(e.target.value)}
                        className="bg-white"
                    />
                </div>
            )}
        </div>
    );
}
