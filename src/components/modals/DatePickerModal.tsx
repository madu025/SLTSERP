"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

const RETURN_REASONS = [
    "Customer Not Ready",
    "Address Not Found",
    "Cable Problem",
    "Weather Issue",
    "Other"
];

interface DatePickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: {
        date: string;
        comment?: string;
        reason?: string;
        ontSerialNumber?: string;
        ontType?: 'NEW' | 'EXISTING';
        iptvSerialNumbers?: string[];
        dpDetails?: string;
        contractorId?: string;
        teamId?: string;
        materialUsage?: Array<{
            itemId: string;
            quantity: string;
            usageType: 'USED' | 'WASTAGE';
            comment?: string;
        }>;
    }) => void;
    title?: string;
    isReturn?: boolean;
    isComplete?: boolean;
    orderData?: {
        package?: string | null;
        iptv?: string | null;
        dp?: string | null;
        voiceNumber?: string | null;
    };
    contractors?: Array<{
        id: string;
        name: string;
        teams?: Array<{ id: string; name: string }>;
    }>;
    items?: Array<{ id: string; name: string; code: string; unit: string }>;
}

export default function DatePickerModal({
    isOpen,
    onClose,
    onConfirm,
    title = "Select Date",
    isReturn = false,
    isComplete = false,
    orderData,
    contractors = [],
    items = []
}: DatePickerModalProps) {
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [comment, setComment] = useState("");
    const [reason, setReason] = useState("");
    const [customReason, setCustomReason] = useState("");

    // Completion fields
    const [ontType, setOntType] = useState<'NEW' | 'EXISTING'>('NEW');
    const [ontSerialNumber, setOntSerialNumber] = useState("");
    const [iptvSerials, setIptvSerials] = useState<string[]>([]);
    const [dpDetails, setDpDetails] = useState("");
    const [selectedContractorId, setSelectedContractorId] = useState("");
    const [selectedTeamId, setSelectedTeamId] = useState("");

    // Material Usage State
    const [materialUsage, setMaterialUsage] = useState<Array<{
        itemId: string;
        quantity: string;
        usageType: 'USED' | 'WASTAGE';
        comment: string;
    }>>([]);

    // Get teams for selected contractor
    const selectedContractor = contractors.find(c => c.id === selectedContractorId);
    const availableTeams = selectedContractor?.teams || [];

    useEffect(() => {
        if (isOpen) {
            setDate(undefined);
            setComment("");
            setReason("");
            setCustomReason("");
            setOntType('NEW');
            setOntSerialNumber("");
            setIptvSerials([]);
            setDpDetails(orderData?.dp || "");
            setMaterialUsage([]);
        }
    }, [isOpen, orderData]);

    // Calculate required IPTV serials count based on package type
    const iptvCount = orderData?.iptv ? parseInt(orderData.iptv) : 0;
    const packageName = orderData?.package?.toUpperCase() || '';

    // Check if package requires IPTV serials
    const requiresIPTV = isComplete && (
        packageName.includes('VOICE_IPTV') ||
        packageName.includes('VOICE_INT_IPTV')
    ) && iptvCount > 0;

    // Initialize IPTV serial fields
    useEffect(() => {
        if (requiresIPTV && iptvSerials.length === 0) {
            setIptvSerials(Array(iptvCount).fill(''));
        }
    }, [requiresIPTV, iptvCount]);

    const handleIPTVSerialChange = (index: number, value: string) => {
        const newSerials = [...iptvSerials];
        newSerials[index] = value;
        setIptvSerials(newSerials);
    };

    // Material Helpers
    const addMaterialRow = () => {
        setMaterialUsage([...materialUsage, { itemId: '', quantity: '', usageType: 'USED', comment: '' }]);
    };

    const removeMaterialRow = (idx: number) => {
        setMaterialUsage(materialUsage.filter((_, i) => i !== idx));
    };

    const updateMaterialRow = (idx: number, field: string, value: string) => {
        const newUsage = [...materialUsage];
        (newUsage[idx] as any)[field] = value;
        setMaterialUsage(newUsage);
    };

    const handleConfirm = () => {
        if (!date) return;

        // Validation for completion
        if (isComplete) {
            if (!selectedContractorId) {
                alert("Please select the contractor who completed this order");
                return;
            }
            if (availableTeams.length > 0 && !selectedTeamId) {
                alert("Please select the team that completed this order");
                return;
            }
            if (!ontSerialNumber.trim()) {
                alert("ONT Serial Number is required for completion");
                return;
            }
            if (requiresIPTV && iptvSerials.some(s => !s.trim())) {
                alert(`Please enter all ${iptvCount} STB Serial Numbers`);
                return;
            }
        }

        const finalReason = reason === "Other" ? customReason : reason;

        onConfirm({
            date: date.toISOString(),
            comment,
            reason: finalReason,
            ontSerialNumber: isComplete ? ontSerialNumber : undefined,
            ontType: isComplete ? ontType : undefined,
            iptvSerialNumbers: isComplete && requiresIPTV ? iptvSerials : undefined,
            dpDetails: isComplete ? dpDetails : undefined,
            contractorId: isComplete ? selectedContractorId : undefined,
            teamId: isComplete ? selectedTeamId : undefined,
            materialUsage: isComplete ? materialUsage.filter(m => m.itemId && parseFloat(m.quantity) > 0) : undefined
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-4">

                    {/* Date Picker - Compact Version */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Date *</label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !date && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={setDate}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Completion Fields */}
                    {isComplete && (
                        <div className="space-y-4 border-t pt-4">
                            <h3 className="text-sm font-bold text-slate-800">Installation Details</h3>

                            {/* Package & DP Info Display */}
                            <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <span className="font-semibold text-blue-700">Voice Number:</span>
                                        <p className="text-slate-800 font-medium mt-0.5 font-mono">{orderData?.voiceNumber || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <span className="font-semibold text-blue-700">Package:</span>
                                        <p className="text-slate-800 font-medium mt-0.5">{orderData?.package || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <span className="font-semibold text-blue-700">IPTV Count:</span>
                                        <p className="text-slate-800 font-medium mt-0.5">{orderData?.iptv || '0'}</p>
                                    </div>
                                    <div>
                                        <span className="font-semibold text-blue-700">DP:</span>
                                        <p className="text-slate-800 font-medium mt-0.5">{orderData?.dp || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Contractor Selection */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Completed By (Contractor) *</Label>
                                <Select
                                    value={selectedContractorId}
                                    onValueChange={(value) => {
                                        setSelectedContractorId(value);
                                        setSelectedTeamId(""); // Reset team when contractor changes
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select contractor..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {contractors.map((contractor) => (
                                            <SelectItem key={contractor.id} value={contractor.id}>
                                                {contractor.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Team Selection (shown only when contractor is selected) */}
                            {selectedContractorId && availableTeams.length > 0 && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Team *</Label>
                                    <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select team..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableTeams.map((team) => (
                                                <SelectItem key={team.id} value={team.id}>
                                                    {team.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* ONT Serial Number */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">ONT Serial Number *</Label>
                                <div className="flex gap-2">
                                    <Select value={ontType} onValueChange={(v) => setOntType(v as 'NEW' | 'EXISTING')}>
                                        <SelectTrigger className="w-[140px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NEW">New ONT</SelectItem>
                                            <SelectItem value="EXISTING">Existing ONT</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        placeholder="Enter ONT Serial Number"
                                        value={ontSerialNumber}
                                        onChange={(e) => setOntSerialNumber(e.target.value.toUpperCase())}
                                        className="flex-1 font-mono"
                                    />
                                </div>
                            </div>

                            {/* STB Serial Numbers (if applicable) */}
                            {requiresIPTV && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">STB Serial Numbers * ({iptvCount} required)</Label>
                                    <div className="space-y-2">
                                        {Array.from({ length: iptvCount }).map((_, idx) => (
                                            <Input
                                                key={idx}
                                                placeholder={`STB Serial #${idx + 1}`}
                                                value={iptvSerials[idx] || ''}
                                                onChange={(e) => handleIPTVSerialChange(idx, e.target.value.toUpperCase())}
                                                className="font-mono"
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Material Usage Tracking */}
                            <div className="space-y-2 border-t pt-2 mt-2">
                                <div className="flex justify-between items-center">
                                    <Label className="text-sm font-medium">Material Usage</Label>
                                    <Button type="button" variant="outline" size="sm" onClick={addMaterialRow} className="h-6 text-xs">
                                        <Plus className="w-3 h-3 mr-1" /> Add Item
                                    </Button>
                                </div>
                                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                    {materialUsage.map((row, idx) => (
                                        <div key={idx} className="flex gap-2 items-start border p-2 rounded bg-slate-50">
                                            <div className="flex-1 space-y-1">
                                                <Select value={row.itemId} onValueChange={(v) => updateMaterialRow(idx, 'itemId', v)}>
                                                    <SelectTrigger className="h-8 text-xs bg-white">
                                                        <SelectValue placeholder="Select Material" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {items.map((item) => (
                                                            <SelectItem key={item.id} value={item.id}>
                                                                {item.code} - {item.name} ({item.unit})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="w-24 space-y-1">
                                                <Select value={row.usageType} onValueChange={(v) => updateMaterialRow(idx, 'usageType', v)}>
                                                    <SelectTrigger className="h-8 text-xs bg-white">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="USED">USED</SelectItem>
                                                        <SelectItem value="WASTAGE">WASTED</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="w-20 space-y-1">
                                                <Input
                                                    placeholder="Qty"
                                                    type="number"
                                                    className="h-8 text-xs bg-white"
                                                    value={row.quantity}
                                                    onChange={(e) => updateMaterialRow(idx, 'quantity', e.target.value)}
                                                />
                                            </div>
                                            <Button type="button" variant="ghost" size="sm" onClick={() => removeMaterialRow(idx)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50">
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    {materialUsage.length === 0 && (
                                        <div className="text-xs text-slate-400 text-center py-2 italic">No materials added</div>
                                    )}
                                </div>
                            </div>

                            {/* DP Details */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">DP Details (Optional)</Label>
                                <Textarea
                                    placeholder="Enter additional DP details or modifications..."
                                    value={dpDetails}
                                    onChange={(e) => setDpDetails(e.target.value)}
                                    rows={2}
                                    className="text-xs"
                                />
                            </div>
                        </div>
                    )}

                    {/* Return Reason Dropdown (Only if Return) */}
                    {isReturn && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Return Reason</label>
                            <Select value={reason} onValueChange={setReason}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Reason" />
                                </SelectTrigger>
                                <SelectContent>
                                    {RETURN_REASONS.map((r) => (
                                        <SelectItem key={r} value={r}>{r}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {reason === "Other" && (
                                <Input
                                    placeholder="Type specific reason..."
                                    value={customReason}
                                    onChange={(e) => setCustomReason(e.target.value)}
                                />
                            )}
                        </div>
                    )}

                    {/* Comment Area */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Comment (Optional)</label>
                        <Textarea
                            placeholder="Add any additional notes..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={3}
                        />
                    </div>

                    <Button onClick={handleConfirm} disabled={!date} className="w-full">
                        Confirm {isComplete ? 'Completion' : isReturn ? 'Return' : ''}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
