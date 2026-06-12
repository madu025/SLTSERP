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
        <div className="space-y-3 border p-3 rounded-lg bg-slate-50/50">
            <div className="flex items-center gap-2 mb-1 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span>Assignment Details</span>
            </div>

            <div className="flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 mb-2">
                <button
                    type="button"
                    onClick={() => onAssignmentTypeChange('CONTRACTOR')}
                    className={cn(
                        "flex-1 py-1 h-7 text-[10px] font-bold rounded-md transition-all",
                        assignmentType === 'CONTRACTOR' 
                            ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-900/5" 
                            : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    Contractor
                </button>
                <button
                    type="button"
                    onClick={() => onAssignmentTypeChange('DIRECT_TEAM')}
                    className={cn(
                        "flex-1 py-1 h-7 text-[10px] font-bold rounded-md transition-all",
                        assignmentType === 'DIRECT_TEAM' 
                            ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-900/5" 
                            : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    Direct SLT Team
                </button>
            </div>

            {assignmentType === 'CONTRACTOR' ? (
                <div className="space-y-2.5">
                    <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contractor</Label>
                        <Select value={selectedContractorId} onValueChange={onContractorChange}>
                            <SelectTrigger className="h-8 text-xs">
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
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Team</Label>
                        <Select value={selectedTeamId} onValueChange={onTeamChange} disabled={!selectedContractorId}>
                            <SelectTrigger className="h-8 text-xs">
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
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Direct Team Name / Identifier</Label>
                    <Input 
                        placeholder="e.g. SLT Maintenance Team A" 
                        value={directTeamName}
                        onChange={(e) => onDirectTeamNameChange(e.target.value)}
                        className="h-8 text-xs"
                    />
                </div>
            )}
        </div>
    );
}
