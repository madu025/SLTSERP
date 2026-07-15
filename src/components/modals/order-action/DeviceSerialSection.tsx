"use client";

import React from "react";
import { CheckCircle2, Monitor } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DeviceSerialSectionProps {
    ontType: 'NEW' | 'EXISTING';
    onOntTypeChange: (type: 'NEW' | 'EXISTING') => void;
    ontSerialNumber: string;
    onOntSerialNumberChange: (val: string) => void;
    iptvSerials: string[];
    onIptvSerialChange: (index: number, val: string) => void;
    requiresIPTV: boolean;
}

export function DeviceSerialSection({
    ontType,
    onOntTypeChange,
    ontSerialNumber,
    onOntSerialNumberChange,
    iptvSerials,
    onIptvSerialChange,
    requiresIPTV
}: DeviceSerialSectionProps) {
    return (
        <div className="space-y-5">
            <div className="flex items-center gap-2 mb-1 text-slate-700 font-bold text-xs uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Device Installation Details</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                    <Label className="text-xs font-bold text-slate-550 uppercase tracking-widest">ONT / Router Installation</Label>
                    <div className="flex p-0.5 bg-slate-100/50 rounded-lg border border-slate-200">
                        <button
                            type="button"
                            onClick={() => onOntTypeChange('NEW')}
                            className={cn(
                                "flex-1 py-1.5 text-xs font-bold rounded-md transition-all",
                                ontType === 'NEW' 
                                    ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-900/5" 
                                    : "text-slate-500 hover:text-slate-750"
                            )}
                        >
                            New Unit
                        </button>
                        <button
                            type="button"
                            onClick={() => onOntTypeChange('EXISTING')}
                            className={cn(
                                "flex-1 py-1.5 text-xs font-bold rounded-md transition-all",
                                ontType === 'EXISTING' 
                                    ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-900/5" 
                                    : "text-slate-500 hover:text-slate-750"
                            )}
                        >
                            Existing / Reuse
                        </button>
                    </div>
                    <Input 
                        placeholder="Enter ONT/Router Serial Number" 
                        value={ontSerialNumber}
                        onChange={(e) => onOntSerialNumberChange(e.target.value.toUpperCase())}
                        className="bg-white h-9 text-xs font-mono"
                    />
                </div>

                {requiresIPTV && (
                    <div className="space-y-3">
                        <Label className="text-xs font-bold text-slate-550 uppercase tracking-widest">IPTV / STB Installation</Label>
                        <div className="space-y-2">
                            {iptvSerials.map((serial, idx) => (
                                <div key={idx} className="relative">
                                    <Monitor className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                    <Input 
                                        placeholder={`Enter STB Serial #${idx + 1}`}
                                        value={serial}
                                        onChange={(e) => onIptvSerialChange(idx, e.target.value.toUpperCase())}
                                        className="pl-9 bg-white h-9 text-xs font-mono"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
