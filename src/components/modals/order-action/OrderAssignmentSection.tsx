"use client";

import React from "react";
import { Info } from "lucide-react";
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
        <div className="space-y-2.5">
            <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                    type="button"
                    onClick={() => onAssignmentTypeChange('CONTRACTOR')}
                    className={cn(
                        "flex-1 h-7 text-xs font-bold rounded transition-all flex items-center justify-center gap-2",
                        assignmentType === 'CONTRACTOR' 
                            ? "bg-blue-600 text-white shadow-sm" 
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    )}
                >
                    Assign Contractor
                </button>
                <button
                    type="button"
                    onClick={() => onAssignmentTypeChange('DIRECT_TEAM')}
                    className={cn(
                        "flex-1 h-7 text-xs font-bold rounded transition-all flex items-center justify-center gap-2",
                        assignmentType === 'DIRECT_TEAM' 
                            ? "bg-blue-600 text-white shadow-sm" 
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    )}
                >
                    Assign Direct Team
                </button>
            </div>

            {assignmentType === 'CONTRACTOR' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                        <Label className="text-[9px] font-bold text-slate-500 uppercase">Contractor</Label>
                        <Select value={selectedContractorId} onValueChange={onContractorChange}>
                            <SelectTrigger className="h-7 border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900">
                                <SelectValue placeholder="Select Contractor" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                                {contractors.map(c => (
                                    <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-0.5">
                        <Label className="text-[9px] font-bold text-slate-500 uppercase">Team</Label>
                        <Select value={selectedTeamId} onValueChange={onTeamChange} disabled={!selectedContractorId}>
                            <SelectTrigger className="h-7 border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900">
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
                <div className="space-y-0.5">
                    <Label className="text-[9px] font-bold text-slate-500 uppercase">Direct Team Name / Identifier</Label>
                    <Input 
                        placeholder="e.g. SLT Maintenance Team A" 
                        value={directTeamName}
                        onChange={(e) => onDirectTeamNameChange(e.target.value)}
                        className="h-7 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    />
                </div>
            )}
        </div>
    );
}
