"use client";

import React from "react";
import { CheckCircle2, Monitor, Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DeviceSerialSectionProps {
    ontType: 'NEW' | 'EXISTING';
    onOntTypeChange: (type: 'NEW' | 'EXISTING') => void;
    ontSerialNumber: string;
    onOntSerialNumberChange: (val: string) => void;
    stbType?: 'NEW' | 'EXISTING';
    onStbTypeChange?: (type: 'NEW' | 'EXISTING') => void;
    iptvSerials: string[];
    onIptvSerialChange: (index: number, val: string) => void;
    requiresIPTV: boolean;
    onAddIptvSerial?: () => void;
    onRemoveIptvSerial?: (index: number) => void;
    phoneType?: 'NEW' | 'EXISTING';
    onPhoneTypeChange?: (type: 'NEW' | 'EXISTING') => void;
    phoneSerialNumber?: string;
    onPhoneSerialNumberChange?: (val: string) => void;
}

export function DeviceSerialSection({
    ontType,
    onOntTypeChange,
    ontSerialNumber,
    onOntSerialNumberChange,
    stbType = 'NEW',
    onStbTypeChange,
    iptvSerials,
    onIptvSerialChange,
    requiresIPTV,
    onAddIptvSerial,
    onRemoveIptvSerial,
    phoneType = 'NEW',
    onPhoneTypeChange,
    phoneSerialNumber = '',
    onPhoneSerialNumberChange
}: DeviceSerialSectionProps) {
    const showSTBSection = requiresIPTV || iptvSerials.length > 0 || Boolean(onAddIptvSerial);

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-2 mb-1 text-slate-700 font-bold text-xs uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Device Installation Details</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ONT Router */}
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

                {/* STB IPTV */}
                {showSTBSection && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold text-slate-550 uppercase tracking-widest">IPTV / STB Installation</Label>
                            {onAddIptvSerial && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={onAddIptvSerial}
                                    className="h-6 px-2 text-[10px] gap-1 border-blue-200 text-blue-600 hover:bg-blue-50"
                                >
                                    <Plus className="w-3 h-3" />
                                    <span>Add STB Serial</span>
                                </Button>
                            )}
                        </div>

                        {onStbTypeChange && (
                            <div className="flex p-0.5 bg-slate-100/50 rounded-lg border border-slate-200 mb-2">
                                <button
                                    type="button"
                                    onClick={() => onStbTypeChange('NEW')}
                                    className={cn(
                                        "flex-1 py-1 text-xs font-bold rounded-md transition-all",
                                        stbType === 'NEW' 
                                            ? "bg-white text-purple-600 shadow-sm ring-1 ring-slate-900/5" 
                                            : "text-slate-500 hover:text-slate-750"
                                    )}
                                >
                                    New Unit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onStbTypeChange('EXISTING')}
                                    className={cn(
                                        "flex-1 py-1 text-xs font-bold rounded-md transition-all",
                                        stbType === 'EXISTING' 
                                            ? "bg-white text-purple-600 shadow-sm ring-1 ring-slate-900/5" 
                                            : "text-slate-500 hover:text-slate-750"
                                    )}
                                >
                                    Existing / Reuse
                                </button>
                            </div>
                        )}

                        {iptvSerials.length === 0 ? (
                            <div className="text-[11px] text-slate-400 italic p-2 border border-dashed rounded-md text-center">
                                No STB serials added. Click &quot;Add STB Serial&quot; to enter manually.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {iptvSerials.map((serial, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5">
                                        <div className="relative flex-1">
                                            <Monitor className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                            <Input 
                                                placeholder={`Enter STB Serial #${idx + 1}`}
                                                value={serial}
                                                onChange={(e) => onIptvSerialChange(idx, e.target.value.toUpperCase())}
                                                className="pl-9 bg-white h-9 text-xs font-mono"
                                            />
                                        </div>
                                        {onRemoveIptvSerial && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onRemoveIptvSerial(idx)}
                                                className="h-9 w-9 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Phone / Voice Installation */}
                {onPhoneTypeChange && (
                    <div className="space-y-3">
                        <Label className="text-xs font-bold text-slate-550 uppercase tracking-widest">Phone / Voice Instrument</Label>
                        <div className="flex p-0.5 bg-slate-100/50 rounded-lg border border-slate-200">
                            <button
                                type="button"
                                onClick={() => onPhoneTypeChange('NEW')}
                                className={cn(
                                    "flex-1 py-1.5 text-xs font-bold rounded-md transition-all",
                                    phoneType === 'NEW' 
                                        ? "bg-white text-emerald-600 shadow-sm ring-1 ring-slate-900/5" 
                                        : "text-slate-500 hover:text-slate-750"
                                )}
                            >
                                New Unit
                            </button>
                            <button
                                type="button"
                                onClick={() => onPhoneTypeChange('EXISTING')}
                                className={cn(
                                    "flex-1 py-1.5 text-xs font-bold rounded-md transition-all",
                                    phoneType === 'EXISTING' 
                                        ? "bg-white text-emerald-600 shadow-sm ring-1 ring-slate-900/5" 
                                        : "text-slate-500 hover:text-slate-750"
                                )}
                            >
                                Existing / Reuse
                            </button>
                        </div>
                        {onPhoneSerialNumberChange && (
                            <Input 
                                placeholder="Enter Phone Instrument Serial (Optional)" 
                                value={phoneSerialNumber}
                                onChange={(e) => onPhoneSerialNumberChange(e.target.value.toUpperCase())}
                                className="bg-white h-9 text-xs font-mono"
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

