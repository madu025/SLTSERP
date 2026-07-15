"use client";

import React from "react";
import { Users, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Contractor {
    id: string;
    name: string;
    teams?: Array<{ id: string; name: string; sltCode?: string }>;
}

interface OrderAssignmentSectionProps {
    assignmentType: 'CONTRACTOR' | 'DIRECT_TEAM';
    onAssignmentTypeChange: (type: 'CONTRACTOR' | 'DIRECT_TEAM') => void;
    selectedContractorId: string;
    onContractorChange: (id: string) => void;
    selectedTeamId: string;
    onTeamChange: (id: string) => void;
    directTeamName: string;
    onDirectTeamNameChange: (name: string) => void;
    contractors: Contractor[];
}

export function OrderAssignmentSection({
    assignmentType,
    onAssignmentTypeChange,
    selectedContractorId,
    onContractorChange,
    selectedTeamId,
    onTeamChange,
    directTeamName,
    onDirectTeamNameChange,
    contractors
}: OrderAssignmentSectionProps) {
    const selectedContractor = contractors.find(c => c.id === selectedContractorId);
    const availableTeams = selectedContractor?.teams || [];

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-2 mb-1 text-slate-650 font-bold text-xs uppercase tracking-wider">
                <Users className="w-4 h-4 text-blue-500" />
                <span>Assignment Details</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                <button
                    type="button"
                    onClick={() => onAssignmentTypeChange('CONTRACTOR')}
                    className={cn(
                        "flex flex-col items-start p-4 rounded-xl border text-left transition-all hover:bg-slate-50/50",
                        assignmentType === 'CONTRACTOR' 
                            ? "border-blue-600 bg-blue-50/30 ring-1 ring-blue-600" 
                            : "border-slate-200 bg-white"
                    )}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", assignmentType === 'CONTRACTOR' ? "border-blue-600 text-blue-600" : "border-slate-300")}>
                            {assignmentType === 'CONTRACTOR' && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                        </div>
                        <span className="text-xs font-bold text-slate-800">Assign Contractor</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium">Outsource the work to an external registered contractor team.</p>
                </button>

                <button
                    type="button"
                    onClick={() => onAssignmentTypeChange('DIRECT_TEAM')}
                    className={cn(
                        "flex flex-col items-start p-4 rounded-xl border text-left transition-all hover:bg-slate-50/50",
                        assignmentType === 'DIRECT_TEAM' 
                            ? "border-blue-600 bg-blue-50/30 ring-1 ring-blue-600" 
                            : "border-slate-200 bg-white"
                    )}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", assignmentType === 'DIRECT_TEAM' ? "border-blue-600 text-blue-600" : "border-slate-300")}>
                            {assignmentType === 'DIRECT_TEAM' && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                        </div>
                        <span className="text-xs font-bold text-slate-800">Assign Direct Team</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium">Assign to an internal SLT regional maintenance or OPMC team.</p>
                </button>
            </div>

            {assignmentType === 'CONTRACTOR' ? (
                <div className="space-y-4">
                    <div className="space-y-1">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Contractor</Label>
                        <Select value={selectedContractorId} onValueChange={onContractorChange}>
                            <SelectTrigger className="h-9 border-slate-200 text-xs">
                                <SelectValue placeholder="Select Contractor" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                                {contractors.map(c => (
                                    <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Team</Label>
                        <Select value={selectedTeamId} onValueChange={onTeamChange} disabled={!selectedContractorId}>
                            <SelectTrigger className="h-9 border-slate-200 text-xs">
                                <SelectValue placeholder={availableTeams.length > 0 ? "Select Team" : "No Teams found"} />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                                {availableTeams.map(t => (
                                    <SelectItem key={t.id} value={t.id} className="text-xs">
                                        {t.name} {t.sltCode ? `(${t.sltCode})` : ""}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {selectedTeamId && availableTeams.find(t => t.id === selectedTeamId) && !availableTeams.find(t => t.id === selectedTeamId)?.sltCode && (
                            <div className="flex items-center gap-1 text-[9px] text-red-500 mt-0.5 leading-none">
                                <Info className="w-2.5 h-2.5" />
                                <span>Team lacks SLT Verification Code</span>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Direct Team Name / Identifier</Label>
                    <Input 
                        placeholder="e.g. SLT Maintenance Team A" 
                        value={directTeamName}
                        onChange={(e) => onDirectTeamNameChange(e.target.value)}
                        className="h-9 text-xs"
                    />
                </div>
            )}
        </div>
    );
}
