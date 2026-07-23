"use client";

import React, { useRef, useMemo } from "react";
import { format } from "date-fns";
import { 
    CalendarIcon, Trash2, CheckCircle2, Import
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Contractor, InventoryItem, MaterialUsageRow, OrderActionData } from "./types";
import { OrderAssignmentSection } from "./OrderAssignmentSection";
import { toast } from "sonner";

export interface CollectedCpe {
    deviceType: string;
    serialNumber: string;
    condition: string;
}

export interface ErectedPole {
    poleType: string;
    poleNumber: string;
}

interface OrderSheetModeProps {
    orderData?: OrderActionData;
    state: {
        date: Date | undefined;
        comment: string;
        materialStatus: string;
        ontSerialNumber: string;
        iptvSerials: string[];
        ontType: 'NEW' | 'EXISTING';
        stbType?: 'NEW' | 'EXISTING';
        phoneType?: 'NEW' | 'EXISTING';
        phoneSerialNumber?: string;
        extendedMaterialRows: MaterialUsageRow[];
        assignmentType: 'CONTRACTOR' | 'DIRECT_TEAM';
        selectedContractorId: string;
        selectedTeamId: string;
        directTeamName: string;
        dpDetails: string;
        erectedPoles: ErectedPole[];
        collectedCpes: CollectedCpe[];
        activeTab: string;
    };
    controls: {
        setDate: (d: Date | undefined) => void;
        setComment: (c: string) => void;
        setMaterialStatus: (s: string) => void;
        setOntSerialNumber: (s: string) => void;
        setIptvSerial: (index: number, val: string) => void;
        addIptvSerial: () => void;
        removeIptvSerial: (index: number) => void;
        setOntType: (t: 'NEW' | 'EXISTING') => void;
        setStbType?: (t: 'NEW' | 'EXISTING') => void;
        setPhoneType?: (t: 'NEW' | 'EXISTING') => void;
        setPhoneSerialNumber?: (s: string) => void;
        updateExtendedRow: (index: number, field: keyof MaterialUsageRow, val: string) => void;
        removeExtendedRow: (index: number) => void;
        addExtendedRow: () => void;
        quickAddMaterial: (item: InventoryItem) => void;
        setAssignmentType: (t: 'CONTRACTOR' | 'DIRECT_TEAM') => void;
        setSelectedContractorId: (id: string) => void;
        setSelectedTeamId: (id: string) => void;
        setDirectTeamName: (name: string) => void;
        setDpDetails: (dp: string) => void;
        addCollectedCpeWithType: (type: 'ONT' | 'STB' | 'PHONE') => void;
        updateCollectedCpeRow: (index: number, field: keyof CollectedCpe, val: string) => void;
        removeCollectedCpeRow: (index: number) => void;
        addErectedPoleRow: () => void;
        updateErectedPoleRow: (index: number, field: 'poleType' | 'poleNumber', val: string) => void;
        removeErectedPoleRow: (index: number) => void;
        handlePortalImport: () => void;
        applyPreset: (presetName: string) => void;
        confirm: () => void;
    };
    contractors: Contractor[];
    filteredItems: InventoryItem[];
    quickItems?: Array<{ label: string; item: InventoryItem }>;
    requiresIPTV: boolean;
    materialSource?: string;
    onClose: () => void;
}

function parsePoleType(typeStr: string) {
    if (!typeStr) {
        return { sizeType: 'PLC-5_6-CE', isSltProvided: false, isConcretePoured: false };
    }
    const parts = typeStr.split('|');
    if (parts.length === 1) {
        if (typeStr === 'SLTPL') {
            return { sizeType: 'PLC-5_6-CE', isSltProvided: true, isConcretePoured: false };
        }
        return { sizeType: typeStr, isSltProvided: false, isConcretePoured: false };
    }
    const sizeType = parts[0] || 'PLC-5_6-CE';
    const isSltProvided = parts[1] === 'SLT';
    const isConcretePoured = parts[2] === 'CONCRETE';
    return { sizeType, isSltProvided, isConcretePoured };
}

function serializePoleType(sizeType: string, isSltProvided: boolean, isConcretePoured: boolean) {
    return `${sizeType}|${isSltProvided ? 'SLT' : 'CONTRACTOR'}|${isConcretePoured ? 'CONCRETE' : 'NO_CONCRETE'}`;
}

export function OrderSheetMode({
    orderData,
    state,
    controls,
    contractors,
    filteredItems,
    requiresIPTV,
    onClose
}: OrderSheetModeProps) {
    const gridContainerRef = useRef<HTMLDivElement>(null);
    const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
    const yesterdayStr = useMemo(() => format(new Date(Date.now() - 86400000), "yyyy-MM-dd"), []);

    // Grid cell keydown navigation handler
    const handleGridKeyDown = (e: React.KeyboardEvent<HTMLElement>, row: number, col: number) => {
        // Ctrl + Enter to submit order directly
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            controls.confirm();
            return;
        }

        const isArrowUp = e.key === 'ArrowUp';
        const isArrowDown = e.key === 'ArrowDown';
        const isEnter = e.key === 'Enter';

        if (isArrowUp || isArrowDown || isEnter) {
            const targetRow = isArrowUp ? row - 1 : row + 1;
            const selector = `[data-sheet-row="${targetRow}"][data-sheet-col="${col}"], [data-sheet-row="${targetRow}"] input, [data-sheet-row="${targetRow}"] select`;
            const nextEl = gridContainerRef.current?.querySelector<HTMLElement>(selector);

            if (nextEl) {
                e.preventDefault();
                nextEl.focus();
                if (nextEl instanceof HTMLInputElement) {
                    nextEl.select();
                }
            }
        }
    };

    // Fast multi-line serial number paste handler
    const handleIptvPaste = (e: React.ClipboardEvent<HTMLInputElement>, startIdx: number) => {
        const pastedText = e.clipboardData.getData('text');
        if (!pastedText) return;

        const serials = pastedText
            .split(/[\r\n\t,]+/)
            .map(s => s.trim())
            .filter(Boolean);

        if (serials.length > 1) {
            e.preventDefault();
            serials.forEach((serial, i) => {
                const targetIdx = startIdx + i;
                if (targetIdx >= state.iptvSerials.length) {
                    controls.addIptvSerial();
                }
                controls.setIptvSerial(targetIdx, serial);
            });
            toast.success(`Pasted ${serials.length} STB serial numbers!`);
        }
    };

    return (
        <div ref={gridContainerRef} className="flex flex-col h-full bg-slate-100 dark:bg-slate-950 font-sans text-xs select-none">
            {/* Main Spreadsheet Grid Container */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                
                {/* SECTION 1: ASSIGNMENT & DATE SPREADSHEET CARD */}
                <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg shadow-sm overflow-hidden">
                    <div className="bg-slate-800 text-white px-3 py-1 font-bold uppercase tracking-wider text-[10px] flex items-center justify-between">
                        <span>1. Assignment & Date Controls</span>
                        <span className="text-[9px] text-slate-400 font-mono">Row Group #01</span>
                    </div>

                    <div className="p-2 grid grid-cols-1 md:grid-cols-3 gap-2 bg-slate-50/50 dark:bg-slate-900/50">
                        {/* Cell 1: Date with Custom Date Picker Popover */}
                        <div className="bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-800 space-y-1">
                            <label className="text-[9px] font-bold text-slate-500 uppercase block">Completion Date</label>
                            <div className="flex gap-1">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={state.date && format(state.date, "yyyy-MM-dd") === todayStr ? "default" : "outline"}
                                    onClick={() => controls.setDate(new Date())}
                                    className="h-7 text-xs flex-1 font-bold px-1"
                                    data-sheet-row={1}
                                    data-sheet-col={1}
                                    onKeyDown={(e) => handleGridKeyDown(e, 1, 1)}
                                >
                                    Today
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={state.date && format(state.date, "yyyy-MM-dd") === yesterdayStr ? "default" : "outline"}
                                    onClick={() => {
                                        const d = new Date();
                                        d.setDate(d.getDate() - 1);
                                        controls.setDate(d);
                                    }}
                                    className="h-7 text-xs flex-1 font-bold px-1"
                                    data-sheet-row={1}
                                    data-sheet-col={2}
                                    onKeyDown={(e) => handleGridKeyDown(e, 1, 2)}
                                >
                                    Yesterday
                                </Button>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="h-7 text-xs flex-1 font-semibold justify-start text-left px-1.5"
                                        >
                                            <CalendarIcon className="mr-1 h-3 w-3 text-blue-500 shrink-0" />
                                            <span className="truncate">{state.date ? format(state.date, "MMM dd") : "Custom"}</span>
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 z-50">
                                        <Calendar mode="single" selected={state.date} onSelect={controls.setDate} />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        {/* Cell 2: Assignment */}
                        <div className="bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-800 space-y-1">
                            <label className="text-[9px] font-bold text-slate-500 uppercase block">Team / Contractor</label>
                            <OrderAssignmentSection
                                assignmentType={state.assignmentType}
                                onAssignmentTypeChange={controls.setAssignmentType}
                                selectedContractorId={state.selectedContractorId}
                                onContractorChange={controls.setSelectedContractorId}
                                selectedTeamId={state.selectedTeamId}
                                onTeamChange={controls.setSelectedTeamId}
                                directTeamName={state.directTeamName}
                                onDirectTeamNameChange={controls.setDirectTeamName}
                                contractors={contractors}
                            />
                        </div>

                        {/* Cell 3: DP Details */}
                        <div className="bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-800 space-y-1">
                            <label className="text-[9px] font-bold text-slate-500 uppercase block">Distribution Point (DP)</label>
                            <Input 
                                value={state.dpDetails}
                                onChange={e => controls.setDpDetails(e.target.value)}
                                placeholder="e.g. DP-NCH-0501"
                                className="h-7 text-xs font-mono bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                data-sheet-row={1}
                                data-sheet-col={3}
                                onKeyDown={(e) => handleGridKeyDown(e, 1, 3)}
                            />
                        </div>
                    </div>
                </div>

                {/* SECTION 2: DEVICE & SERIAL NUMBERS SPREADSHEET GRID */}
                <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg shadow-sm overflow-hidden">
                    <div className="bg-slate-800 text-white px-3 py-1 font-bold uppercase tracking-wider text-[10px] flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <span>2. Device Serials & CPE Fast Input</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                            <Button 
                                type="button" 
                                size="sm" 
                                variant="secondary" 
                                onClick={controls.addIptvSerial}
                                className="h-5 text-[9px] font-bold px-1.5 bg-purple-600 text-white hover:bg-purple-500"
                            >
                                + STB Serial
                            </Button>
                            <Button 
                                type="button" 
                                size="sm" 
                                variant="secondary" 
                                onClick={() => controls.addCollectedCpeWithType('ONT')}
                                className="h-5 text-[9px] font-bold px-1.5 bg-indigo-600 text-white hover:bg-indigo-500"
                            >
                                + Old CPE
                            </Button>
                        </div>
                    </div>

                    <div className="p-2 space-y-2">
                        {/* ONT Serial Input */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded border border-slate-200 dark:border-slate-800">
                            <div>
                                <label className="text-[9px] font-extrabold text-slate-600 dark:text-slate-300 uppercase block mb-0.5">
                                    ONT (Router) Serial Number
                                </label>
                                <Input 
                                    value={state.ontSerialNumber}
                                    onChange={e => controls.setOntSerialNumber(e.target.value.toUpperCase())}
                                    placeholder="Enter/paste ONT serial..."
                                    className="h-7 text-xs font-mono font-bold uppercase bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                                    data-sheet-row={2}
                                    data-sheet-col={1}
                                    onKeyDown={(e) => handleGridKeyDown(e, 2, 1)}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-full">
                                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">ONT Type</label>
                                    <div className="flex gap-1">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={state.ontType === 'NEW' ? 'default' : 'outline'}
                                            onClick={() => controls.setOntType('NEW')}
                                            className="h-7 text-xs flex-1 font-bold"
                                        >
                                            New Unit
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={state.ontType === 'EXISTING' ? 'default' : 'outline'}
                                            onClick={() => controls.setOntType('EXISTING')}
                                            className="h-7 text-xs flex-1 font-bold"
                                        >
                                            Existing / Re-use
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* IPTV / STB Serials Grid - Always visible in Section 2 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded border border-slate-200 dark:border-slate-800">
                            <div>
                                <div className="flex items-center justify-between mb-0.5">
                                    <label className="text-[9px] font-extrabold text-purple-700 dark:text-purple-400 uppercase block">
                                        STB (IPTV) Serial Number(s)
                                    </label>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={controls.addIptvSerial}
                                        className="h-4 text-[9px] font-bold text-purple-600 hover:text-purple-700 hover:bg-purple-50 p-0 px-1"
                                    >
                                        + Add STB Row
                                    </Button>
                                </div>
                                <div className="space-y-1">
                                    {(state.iptvSerials.length > 0 ? state.iptvSerials : [""]).map((serial, idx) => (
                                        <div key={idx} className="flex gap-1 items-center">
                                            {state.iptvSerials.length > 1 && (
                                                <span className="text-[10px] font-mono text-slate-400 w-4">#{idx + 1}</span>
                                            )}
                                            <Input 
                                                value={serial}
                                                onChange={e => controls.setIptvSerial(idx, e.target.value.toUpperCase())}
                                                onPaste={e => handleIptvPaste(e, idx)}
                                                placeholder={`Enter/paste STB serial #${idx + 1}...`}
                                                className="h-7 text-xs font-mono font-bold uppercase bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                                                data-sheet-row={3 + idx}
                                                data-sheet-col={1}
                                                onKeyDown={(e) => handleGridKeyDown(e, 3 + idx, 1)}
                                            />
                                            {state.iptvSerials.length > 1 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => controls.removeIptvSerial(idx)}
                                                    className="h-6 w-6 text-rose-500 hover:bg-rose-50 rounded shrink-0"
                                                >
                                                    ✕
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-full">
                                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">STB Instrument Type</label>
                                    <div className="flex gap-1">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={(state.stbType || 'NEW') === 'NEW' ? 'default' : 'outline'}
                                            onClick={() => controls.setStbType && controls.setStbType('NEW')}
                                            className={cn(
                                                "h-7 text-xs flex-1 font-bold",
                                                (state.stbType || 'NEW') === 'NEW' && "bg-purple-600 hover:bg-purple-700 text-white"
                                            )}
                                        >
                                            New Unit
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={(state.stbType || 'NEW') === 'EXISTING' ? 'default' : 'outline'}
                                            onClick={() => controls.setStbType && controls.setStbType('EXISTING')}
                                            className={cn(
                                                "h-7 text-xs flex-1 font-bold",
                                                (state.stbType || 'NEW') === 'EXISTING' && "bg-purple-600 hover:bg-purple-700 text-white"
                                            )}
                                        >
                                            Existing / Re-use
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Phone / Voice Instrument Installation - Only show if controlled or needed */}
                        {controls.setPhoneType && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded border border-slate-200 dark:border-slate-800">
                                <div>
                                    <label className="text-[9px] font-extrabold text-emerald-700 dark:text-emerald-400 uppercase block mb-0.5">
                                        Phone / Voice Instrument Serial
                                    </label>
                                    <Input 
                                        value={state.phoneSerialNumber || ''}
                                        onChange={e => controls.setPhoneSerialNumber && controls.setPhoneSerialNumber(e.target.value.toUpperCase())}
                                        placeholder="Phone serial number (optional)..."
                                        className="h-7 text-xs font-mono font-bold uppercase bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-full">
                                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">Phone Instrument Type</label>
                                        <div className="flex gap-1">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={(state.phoneType || 'NEW') === 'NEW' ? 'default' : 'outline'}
                                                onClick={() => controls.setPhoneType && controls.setPhoneType('NEW')}
                                                className="h-7 text-xs flex-1 font-bold"
                                            >
                                                New Phone
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={(state.phoneType || 'NEW') === 'EXISTING' ? 'default' : 'outline'}
                                                onClick={() => controls.setPhoneType && controls.setPhoneType('EXISTING')}
                                                className="h-7 text-xs flex-1 font-bold"
                                            >
                                                Re-use Phone
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* CPE Recovery (Collected Faulty Devices) - Only show if populated */}
                        {state.collectedCpes.length > 0 && (
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded border border-slate-200 dark:border-slate-800 space-y-1">
                                <div className="flex items-center justify-between">
                                    <label className="text-[9px] font-extrabold text-slate-700 dark:text-slate-200 uppercase block">
                                        Collected Old CPE Recovery
                                    </label>
                                    <div className="flex gap-1">
                                        <Button type="button" variant="outline" size="sm" className="h-5 text-[9px] font-bold px-1" onClick={() => controls.addCollectedCpeWithType('ONT')}>+ ONT</Button>
                                        <Button type="button" variant="outline" size="sm" className="h-5 text-[9px] font-bold px-1" onClick={() => controls.addCollectedCpeWithType('STB')}>+ STB</Button>
                                        <Button type="button" variant="outline" size="sm" className="h-5 text-[9px] font-bold px-1" onClick={() => controls.addCollectedCpeWithType('PHONE')}>+ Phone</Button>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    {state.collectedCpes.map((cpe, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-1 items-center bg-white dark:bg-slate-900 p-1 rounded border border-slate-200 dark:border-slate-800">
                                            <div className="col-span-3">
                                                <select
                                                    value={cpe.deviceType}
                                                    onChange={e => controls.updateCollectedCpeRow(idx, 'deviceType', e.target.value)}
                                                    className="w-full h-6 px-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[10px] font-bold"
                                                >
                                                    <option value="ONT">ONT (Router)</option>
                                                    <option value="STB">STB (Set-Top)</option>
                                                    <option value="PHONE">Phone (Landline)</option>
                                                </select>
                                            </div>
                                            <div className="col-span-6">
                                                <Input
                                                    placeholder="Old Device Serial"
                                                    value={cpe.serialNumber}
                                                    onChange={e => controls.updateCollectedCpeRow(idx, 'serialNumber', e.target.value.toUpperCase())}
                                                    className="h-6 text-xs font-mono uppercase bg-white dark:bg-slate-900"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <select
                                                    value={cpe.condition}
                                                    onChange={e => controls.updateCollectedCpeRow(idx, 'condition', e.target.value)}
                                                    className="w-full h-6 px-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[10px]"
                                                >
                                                    <option value="FAULTY">Faulty</option>
                                                    <option value="WORKING">Working</option>
                                                </select>
                                            </div>
                                            <div className="col-span-1 text-center">
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-5 w-5 text-rose-500 hover:bg-rose-50 rounded" 
                                                    onClick={() => controls.removeCollectedCpeRow(idx)}
                                                >
                                                    ✕
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* SECTION 3: MATERIALS USAGE & INFRASTRUCTURE SPREADSHEET TABLE */}
                <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg shadow-sm overflow-hidden">
                    <div className="bg-slate-800 text-white px-3 py-1 font-bold uppercase tracking-wider text-[10px] flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <span>3. Material Usage & Infrastructure Table</span>
                        </span>
                        <div className="flex gap-1">
                            <Button 
                                type="button" 
                                size="sm" 
                                variant="secondary" 
                                onClick={controls.handlePortalImport}
                                className="h-5 text-[9px] font-bold px-1.5 bg-indigo-600 text-white hover:bg-indigo-500 flex items-center gap-1"
                            >
                                <Import className="w-2.5 h-2.5" />
                                Portal
                            </Button>
                            <Button 
                                type="button" 
                                size="sm" 
                                variant="secondary" 
                                onClick={() => controls.applyPreset('STANDARD')}
                                className="h-5 text-[9px] font-bold px-1.5 bg-slate-700 text-white hover:bg-slate-600"
                            >
                                Preset: Standard
                            </Button>
                            <Button 
                                type="button" 
                                size="sm" 
                                variant="secondary" 
                                onClick={controls.addErectedPoleRow}
                                className="h-5 text-[9px] font-bold px-1.5 bg-emerald-600 text-white hover:bg-emerald-500"
                            >
                                + Add Pole
                            </Button>
                            <Button 
                                type="button" 
                                size="sm" 
                                variant="secondary" 
                                onClick={controls.addExtendedRow}
                                className="h-5 text-[9px] font-bold px-1.5 bg-blue-600 text-white hover:bg-blue-500"
                            >
                                + Add Material Row
                            </Button>
                        </div>
                    </div>

                    <div className="p-2 space-y-2">
                        {/* Erected Poles Grid - Inside Material Usage Section */}
                        {state.erectedPoles && state.erectedPoles.length > 0 && (
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded border border-slate-200 dark:border-slate-800 space-y-1">
                                <div className="flex items-center justify-between">
                                    <label className="text-[9px] font-extrabold text-emerald-700 dark:text-emerald-400 uppercase">
                                        Erected Poles Record
                                    </label>
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-5 text-[9px] font-bold text-emerald-700 border-emerald-300 hover:bg-emerald-50 px-1.5"
                                        onClick={controls.addErectedPoleRow}
                                    >
                                        + Add Pole
                                    </Button>
                                </div>

                                <div className="space-y-1">
                                    {state.erectedPoles.map((pole, pIdx) => {
                                        const { sizeType, isSltProvided, isConcretePoured } = parsePoleType(pole.poleType);
                                        return (
                                            <div key={pIdx} className="flex flex-col sm:flex-row gap-1 items-start sm:items-center bg-white dark:bg-slate-900 p-1 rounded border border-slate-200 dark:border-slate-800 w-full">
                                                <div className="w-full sm:w-[130px]">
                                                    <Select
                                                        value={sizeType}
                                                        onValueChange={(val) => controls.updateErectedPoleRow(pIdx, 'poleType', serializePoleType(val, isSltProvided, isConcretePoured))}
                                                    >
                                                        <SelectTrigger className="h-6 text-[10px] bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                                                            <SelectValue placeholder="Select Pole" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="PLC-5_6-CE" className="text-xs">5.6m Concrete</SelectItem>
                                                            <SelectItem value="PLC-6_7-CE" className="text-xs">6.7m Concrete</SelectItem>
                                                            <SelectItem value="PLC-8" className="text-xs">8.0m Concrete</SelectItem>
                                                            <SelectItem value="PLC-GI" className="text-xs">GI Pole</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="w-full sm:flex-1">
                                                    <Input
                                                        value={pole.poleNumber}
                                                        onChange={(e) => controls.updateErectedPoleRow(pIdx, 'poleNumber', e.target.value.toUpperCase())}
                                                        placeholder="Pole Serial"
                                                        className="h-6 text-xs font-mono bg-white dark:bg-slate-950"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2 pl-1 sm:pl-0">
                                                    <label className="flex items-center gap-1 cursor-pointer select-none">
                                                        <Checkbox
                                                            checked={isSltProvided}
                                                            onCheckedChange={(checked) => controls.updateErectedPoleRow(pIdx, 'poleType', serializePoleType(sizeType, !!checked, isConcretePoured))}
                                                            className="w-3 h-3"
                                                        />
                                                        <span className="text-[9px] font-bold uppercase text-slate-500">SLT</span>
                                                    </label>
                                                    <label className="flex items-center gap-1 cursor-pointer select-none">
                                                        <Checkbox
                                                            checked={isConcretePoured}
                                                            onCheckedChange={(checked) => controls.updateErectedPoleRow(pIdx, 'poleType', serializePoleType(sizeType, isSltProvided, !!checked))}
                                                            className="w-3 h-3"
                                                        />
                                                        <span className="text-[9px] font-bold uppercase text-slate-500">Concrete</span>
                                                    </label>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => controls.removeErectedPoleRow(pIdx)}
                                                    className="h-6 w-6 text-slate-400 hover:text-red-500 rounded"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 text-[9px] uppercase font-bold tracking-wider">
                                    <th className="p-1.5 border-r border-slate-200 dark:border-slate-700 w-8 text-center">#</th>
                                    <th className="p-1.5 border-r border-slate-200 dark:border-slate-700">Material Item</th>
                                    <th className="p-1.5 border-r border-slate-200 dark:border-slate-700 w-16 text-right">Used Qty</th>
                                    <th className="p-1.5 border-r border-slate-200 dark:border-slate-700 w-24 text-right bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">Drop Wire F1 (m)</th>
                                    <th className="p-1.5 border-r border-slate-200 dark:border-slate-700 w-24 text-right bg-amber-50/50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">Drop Wire G1 (m)</th>
                                    <th className="p-1.5 border-r border-slate-200 dark:border-slate-700 w-20 text-right">Wastage Qty</th>
                                    <th className="p-1.5 border-r border-slate-200 dark:border-slate-700">Serial Number</th>
                                    <th className="p-1.5 w-8 text-center">Del</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-xs">
                                {state.extendedMaterialRows.map((row, rIdx) => {
                                    const baseRowIndex = 10 + rIdx;
                                    const selectedItem = filteredItems.find(i => i.id === row.itemId);
                                    const itemCodeLower = (selectedItem?.code || '').toLowerCase();
                                    const itemNameLower = (selectedItem?.name || '').toLowerCase();
                                    const itemCommonLower = (selectedItem?.commonName || '').toLowerCase();

                                    const isDW = Boolean(selectedItem && (
                                        selectedItem.code === 'OSPFTA003' || 
                                        selectedItem.code === 'OSP-HC-CBL-DW' || 
                                        (
                                            (itemNameLower.includes('drop wire') || itemNameLower.includes('drop cable') || itemCommonLower.includes('drop wire')) &&
                                            !itemNameLower.includes('retainer') &&
                                            !itemNameLower.includes('clamp') &&
                                            !itemCodeLower.includes('retner')
                                        )
                                    ));

                                    const isRowPopulated = Boolean(
                                        (row.usedQty && parseFloat(row.usedQty) > 0) ||
                                        (row.f1Qty && parseFloat(row.f1Qty) > 0) ||
                                        (row.g1Qty && parseFloat(row.g1Qty) > 0) ||
                                        (row.wastageQty && parseFloat(row.wastageQty) > 0) ||
                                        (row.serialNumber && row.serialNumber.trim() !== '')
                                    );

                                    return (
                                        <tr 
                                            key={rIdx} 
                                            className={cn(
                                                "transition-colors duration-150",
                                                isRowPopulated 
                                                    ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-l-4 border-l-emerald-500" 
                                                    : "hover:bg-blue-50/30 dark:hover:bg-blue-950/20"
                                            )}
                                        >
                                            <td className="p-1 text-center font-bold">
                                                <span className={cn(
                                                    "inline-flex items-center justify-center min-w-[22px] h-5 px-1 rounded text-[11px] font-bold font-mono transition-all",
                                                    isRowPopulated
                                                        ? "bg-emerald-600 text-white shadow-sm"
                                                        : "text-slate-400"
                                                )}>
                                                    {isRowPopulated ? `✓ ${rIdx + 1}` : rIdx + 1}
                                                </span>
                                            </td>
                                            <td className="p-1 border-r border-slate-200 dark:border-slate-800">
                                                <select
                                                    value={row.itemId}
                                                    onChange={e => controls.updateExtendedRow(rIdx, 'itemId', e.target.value)}
                                                    className={cn(
                                                        "w-full h-7 px-1.5 border rounded font-sans text-xs focus:ring-1 focus:ring-blue-500 font-medium transition-colors",
                                                        isRowPopulated 
                                                            ? "bg-emerald-50/90 border-emerald-300 dark:bg-emerald-950/60 dark:border-emerald-800 font-semibold text-emerald-950 dark:text-emerald-100" 
                                                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                                    )}
                                                    data-sheet-row={baseRowIndex}
                                                    data-sheet-col={1}
                                                    onKeyDown={(e) => handleGridKeyDown(e, baseRowIndex, 1)}
                                                >
                                                    <option value="">Select Item...</option>
                                                    {filteredItems.map(item => (
                                                        <option key={item.id} value={item.id}>
                                                            {item.code} - {item.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            {/* Used Qty: Editable for normal items, Auto-Calculated/Disabled for Drop Wire */}
                                            <td className="p-1 border-r border-slate-200 dark:border-slate-800">
                                                <Input
                                                    type="number"
                                                    disabled={isDW}
                                                    value={isDW ? ((parseFloat(row.f1Qty || '0') + parseFloat(row.g1Qty || '0')) || '') : row.usedQty}
                                                    onChange={e => !isDW && controls.updateExtendedRow(rIdx, 'usedQty', e.target.value)}
                                                    placeholder={isDW ? "N/A" : "0"}
                                                    className={cn(
                                                        "h-7 text-xs text-right font-mono transition-colors",
                                                        isDW
                                                            ? "bg-slate-100 dark:bg-slate-950 text-slate-400 opacity-60 cursor-not-allowed font-bold"
                                                            : (isRowPopulated && row.usedQty && parseFloat(row.usedQty) > 0
                                                                ? "bg-emerald-100/80 border-emerald-400 dark:bg-emerald-900/60 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 font-bold shadow-xs"
                                                                : "bg-white dark:bg-slate-900")
                                                    )}
                                                    data-sheet-row={baseRowIndex}
                                                    data-sheet-col={2}
                                                    onKeyDown={(e) => handleGridKeyDown(e, baseRowIndex, 2)}
                                                />
                                            </td>
                                            {/* Drop Wire F1 (Auto Sync): ONLY enabled for Drop Wire items */}
                                            <td className="p-1 border-r border-slate-200 dark:border-slate-800 bg-blue-50/30 dark:bg-blue-950/20">
                                                {isDW ? (
                                                    <Input
                                                        type="number"
                                                        value={row.f1Qty}
                                                        onChange={e => controls.updateExtendedRow(rIdx, 'f1Qty', e.target.value)}
                                                        placeholder="0"
                                                        className={cn(
                                                            "h-7 text-xs text-right font-mono transition-colors",
                                                            row.f1Qty && parseFloat(row.f1Qty) > 0
                                                                ? "bg-blue-100/80 border-blue-400 dark:bg-blue-900/60 dark:border-blue-700 text-blue-900 dark:text-blue-100 font-bold shadow-xs"
                                                                : "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold"
                                                        )}
                                                        data-sheet-row={baseRowIndex}
                                                        data-sheet-col={3}
                                                        onKeyDown={(e) => handleGridKeyDown(e, baseRowIndex, 3)}
                                                    />
                                                ) : (
                                                    <div className="h-7 flex items-center justify-center text-slate-300 text-[10px] font-mono select-none">-</div>
                                                )}
                                            </td>
                                            {/* Drop Wire G1 (Manual Contractor): ONLY enabled for Drop Wire items */}
                                            <td className="p-1 border-r border-slate-200 dark:border-slate-800 bg-amber-50/30 dark:bg-amber-950/20">
                                                {isDW ? (
                                                    <Input
                                                        type="number"
                                                        value={row.g1Qty}
                                                        onChange={e => controls.updateExtendedRow(rIdx, 'g1Qty', e.target.value)}
                                                        placeholder="0"
                                                        className={cn(
                                                            "h-7 text-xs text-right font-mono transition-colors",
                                                            row.g1Qty && parseFloat(row.g1Qty) > 0
                                                                ? "bg-amber-100/80 border-amber-400 dark:bg-amber-900/60 dark:border-amber-700 text-amber-900 dark:text-amber-100 font-bold shadow-xs"
                                                                : "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 font-bold"
                                                        )}
                                                        data-sheet-row={baseRowIndex}
                                                        data-sheet-col={4}
                                                        onKeyDown={(e) => handleGridKeyDown(e, baseRowIndex, 4)}
                                                    />
                                                ) : (
                                                    <div className="h-7 flex items-center justify-center text-slate-300 text-[10px] font-mono select-none">-</div>
                                                )}
                                            </td>
                                            {/* Wastage Qty */}
                                            <td className="p-1 border-r border-slate-200 dark:border-slate-800">
                                                <Input
                                                    type="number"
                                                    value={row.wastageQty}
                                                    onChange={e => controls.updateExtendedRow(rIdx, 'wastageQty', e.target.value)}
                                                    placeholder="0"
                                                    className={cn(
                                                        "h-7 text-xs text-right font-mono transition-colors",
                                                        isRowPopulated && row.wastageQty && parseFloat(row.wastageQty) > 0
                                                            ? "bg-amber-100/80 border-amber-400 text-amber-900 font-bold shadow-xs"
                                                            : "bg-white dark:bg-slate-900 text-amber-600"
                                                    )}
                                                    data-sheet-row={baseRowIndex}
                                                    data-sheet-col={5}
                                                    onKeyDown={(e) => handleGridKeyDown(e, baseRowIndex, 5)}
                                                />
                                            </td>
                                            {/* Serial Number */}
                                            <td className="p-1 border-r border-slate-200 dark:border-slate-800">
                                                <Input
                                                    value={row.serialNumber}
                                                    onChange={e => controls.updateExtendedRow(rIdx, 'serialNumber', e.target.value.toUpperCase())}
                                                    placeholder="Serial No..."
                                                    className={cn(
                                                        "h-7 text-xs font-mono uppercase transition-colors",
                                                        isRowPopulated && row.serialNumber && row.serialNumber.trim() !== ''
                                                            ? "bg-emerald-100/80 border-emerald-400 dark:bg-emerald-900/60 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 font-bold shadow-xs"
                                                            : "bg-white dark:bg-slate-900"
                                                    )}
                                                    data-sheet-row={baseRowIndex}
                                                    data-sheet-col={6}
                                                    onKeyDown={(e) => handleGridKeyDown(e, baseRowIndex, 6)}
                                                />
                                            </td>
                                            <td className="p-1 text-center">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => controls.removeExtendedRow(rIdx)}
                                                    className="h-6 w-6 text-rose-500 hover:bg-rose-50 rounded"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    </div>
                </div>

            </div>

            {/* STICKY FOOTER: NOTES & ALWAYS VISIBLE COMPLETE ACTION BUTTON */}
            <div className="bg-white dark:bg-slate-900 border-t border-slate-300 dark:border-slate-800 p-2 space-y-2 shadow-lg shrink-0 z-20">
                <div className="flex items-center gap-2">
                    <Textarea 
                        value={state.comment}
                        onChange={e => controls.setComment(e.target.value)}
                        placeholder="Completion Notes / Comments..."
                        className="h-8 min-h-[32px] text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex-1 py-1"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                        <Button variant="outline" onClick={onClose} className="h-8 px-3 text-xs font-bold">
                            Cancel
                        </Button>
                        <Button 
                            onClick={controls.confirm}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 h-8 text-xs font-black uppercase tracking-wider shadow-sm"
                        >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            {orderData?.sltsStatus === 'COMPLETED' ? 'Update' : 'Complete Order'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
