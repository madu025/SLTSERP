"use client";

import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { CalendarIcon, Plus, X, Save, ChevronsUpDown, Check, AlertCircle, Users, CheckCircle2, XCircle, Clock, Info, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
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

interface OrderActionModalProps {
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
        materialStatus?: string;
        teamId?: string;
        directTeamName?: string;
        opmcPatStatus?: string;
        sltsPatStatus?: string;
        hoPatStatus?: string;
        dropWireDistance?: number;
        wiredOnly?: boolean;
        delayReasons?: {
            ontShortage: boolean;
            stbShortage: boolean;
            nokia: boolean;
            system: boolean;
            opmc: boolean;
            cxDelay: boolean;
            sameDay: boolean;
            polePending: boolean;
        };
        stbShortage?: boolean;
        ontShortage?: boolean;
        materialUsage?: Array<{
            itemId: string;
            quantity: string;
            usageType: string;
            comment?: string;
        }>;
        completionMode?: 'ONLINE' | 'OFFLINE';
        photoUrls?: string[];
    }) => void;
    title?: string;
    isReturn?: boolean;
    isComplete?: boolean;
    orderData?: {
        id: string; // Added for type safety
        package?: string | null;
        serviceType?: string | null; // Added
        orderType?: string | null;   // Added
        iptv?: string | null;
        dp?: string | null;
        voiceNumber?: string | null;
        contractorId?: string | null;
        comments?: string | null;
        teamId?: string | null;
        completedDate?: string | null;
        ontSerialNumber?: string | null;
        directTeam?: string | null;
        completionMode?: string | null;

        iptvSerialNumbers?: string[] | null;
        opmcPatStatus?: string | null;
        sltsPatStatus?: string | null;
        hoPatStatus?: string | null;
        materialUsage?: Array<{
            itemId: string;
            quantity: number | string;
            usageType: string;
        }> | null;
    };
    contractors?: Array<{
        id: string;
        name: string;
        teams?: Array<{ id: string; name: string; sltCode?: string }>;
    }>;
    items?: Array<{ id: string; name: string; code: string; unit: string; commonFor?: string[]; commonName?: string; isOspFtth?: boolean; type?: string; maxWastagePercentage?: number; isWastageAllowed?: boolean; }>;
    showExtendedFields?: boolean;
    materialSource?: string;
    itemSortOrder?: string[];
}

export default function OrderActionModal({
    isOpen,
    onClose,
    onConfirm,
    title = "Select Date",
    isReturn = false,
    isComplete = false,
    orderData,
    contractors = [],
    items = [],
    showExtendedFields = false,
    materialSource = 'SLT',
    itemSortOrder = []
}: OrderActionModalProps) {
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [comment, setComment] = useState("");
    const [reason, setReason] = useState("");
    const [customReason, setCustomReason] = useState("");

    // Completion fields
    const [ontType, setOntType] = useState<'NEW' | 'EXISTING'>('NEW');
    const [ontSerialNumber, setOntSerialNumber] = useState("");
    const [iptvSerials, setIptvSerials] = useState<string[]>([]);
    const [dpDetails, setDpDetails] = useState("");
    const [materialStatus, setMaterialStatus] = useState<string>("PENDING");
    const [selectedContractorId, setSelectedContractorId] = useState("");
    const [selectedTeamId, setSelectedTeamId] = useState("");
    const [opmcPatStatus, setOpmcPatStatus] = useState<string>("PENDING");
    const [sltsPatStatus, setSltsPatStatus] = useState<string>("PENDING");
    const [hoPatStatus, setHoPatStatus] = useState<string>("PENDING");
    const [completionMode, setCompletionMode] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
    const [assignmentType, setAssignmentType] = useState<'CONTRACTOR' | 'DIRECT_TEAM'>('CONTRACTOR');
    const [directTeamName, setDirectTeamName] = useState("");

    // Validation helper
    const isAssignmentValid = () => {
        if (assignmentType === 'CONTRACTOR') return !!selectedContractorId;
        return directTeamName.trim().length >= 3;
    };

    // Item Filtering State
    const [itemFilter, setItemFilter] = useState<string>("ALL");
    const [prevOrderId, setPrevOrderId] = useState<string | null>(null);

    // Daily Operational Report Fields
    const [wiredOnly, setWiredOnly] = useState(false);
    const [delayReasons, setDelayReasons] = useState({
        ontShortage: false,
        stbShortage: false,
        nokia: false,
        system: false,
        opmc: false,
        cxDelay: false,
        sameDay: false,
        polePending: false
    });
    const [stbShortage, setStbShortage] = useState(false);
    const [ontShortage, setOntShortage] = useState(false);

    // Material Usage State (Moved to top)
    const [materialUsage, setMaterialUsage] = useState<Array<{
        itemId: string;
        quantity: string;
        usageType: 'USED' | 'WASTAGE';
        comment: string;
    }>>([]);

    // Extended Material View State (Moved to top)
    const [extendedMaterialRows, setExtendedMaterialRows] = useState<Array<{
        itemId: string;
        usedQty: string;
        wastageQty: string;
        f1Qty?: string;
        g1Qty?: string;
        wastageReason?: string;
        serialNumber?: string;
    }>>([]);

    // Tab Navigation State (Moved to top)
    const [activeTab, setActiveTab] = useState<'details' | 'materials' | 'finish'>('details');

    // Wizard Step State - (Retired for now)
    // const [step, setStep] = useState(1);


    // Auto-detect filter based on order
    // Start of sync
    // Reset state when modal closes to ensure fresh init on next open
    if (!isOpen && prevOrderId !== null) {
        setPrevOrderId(null);
    }

    // Initial sync
    if (isOpen && orderData && orderData.id !== prevOrderId) {
        setPrevOrderId(orderData.id);
        // 1. Reset/Pre-fill Item Filter
        const pkg_p = (orderData.package || "").toUpperCase();
        const sType_p = (orderData.serviceType || "").toUpperCase();
        let targetFilter = "ALL";
        if (pkg_p.includes("FIBER") || pkg_p.includes("FTTH") || sType_p.includes("FTTH")) {
            targetFilter = "FTTH";
        } else if (pkg_p.includes("PEO") || sType_p.includes("IPTV")) {
            targetFilter = "FTTH";
        } else if (pkg_p.includes("MEGALINE") || pkg_p.includes("VOICE") || sType_p.includes("PSTN")) {
            targetFilter = "PSTN";
        }
        setItemFilter(targetFilter);

        // 2. Pre-fill Date
        if (orderData.completedDate) {
            setDate(new Date(orderData.completedDate));
        } else {
            setDate(undefined);
        }

        // 3. Reset simple strings
        setComment("");
        setReason("");
        setCustomReason("");
        setOntType('NEW');

        // 4. Pre-fill Serials
        setOntSerialNumber(orderData.ontSerialNumber || "");

        const iptvSerialsData = orderData.iptvSerialNumbers
            ? (Array.isArray(orderData.iptvSerialNumbers) ? orderData.iptvSerialNumbers : [orderData.iptvSerialNumbers])
            : [];

        const iptvCount_val = orderData.iptv ? parseInt(orderData.iptv) : 0;
        const isComplete_local = title?.toUpperCase().includes("COMPLETE");
        const isReturn_local = title?.toUpperCase().includes("RETURN");
        const useExtended_local = showExtendedFields || (isComplete_local && !isReturn_local);

        if (useExtended_local && iptvCount_val > 0 && iptvSerialsData.length === 0) {
            setIptvSerials(Array(iptvCount_val).fill(''));
        } else {
            setIptvSerials(iptvSerialsData);
        }

        setDpDetails(orderData.dp || "");

        // 5. Pre-fill Material Usage
        if (orderData.materialUsage && orderData.materialUsage.length > 0) {
            const grouped: Record<string, { used: string, wastage: string }> = {};
            orderData.materialUsage.forEach(m => {
                const mid = m.itemId;
                if (!grouped[mid]) grouped[mid] = { used: "", wastage: "" };
                if (m.usageType === 'USED') grouped[mid].used = String(m.quantity);
                if (m.usageType === 'WASTAGE') grouped[mid].wastage = String(m.quantity);
            });

            const rows = Object.entries(grouped).map(([itemId, qtys]) => ({
                itemId,
                usedQty: qtys.used,
                wastageQty: qtys.wastage,
                f1Qty: '', g1Qty: '', wastageReason: '', serialNumber: ''
            }));

            setExtendedMaterialRows(rows);
            setMaterialUsage(orderData.materialUsage.map(m => ({
                itemId: m.itemId,
                quantity: String(m.quantity),
                usageType: (m.usageType === 'WASTAGE' ? 'WASTAGE' : 'USED') as 'USED' | 'WASTAGE',
                comment: ''
            })));
            setMaterialStatus(orderData.comments?.includes('[MATERIAL_COMPLETED]') ? 'COMPLETED' : 'PENDING');
        } else {
            setExtendedMaterialRows([]);
            setMaterialUsage([]);
            setMaterialStatus('PENDING');
        }

        // 6. Assignment
        setOpmcPatStatus(orderData.opmcPatStatus || 'PENDING');
        setSltsPatStatus(orderData.sltsPatStatus || 'PENDING');
        setHoPatStatus(orderData.hoPatStatus || 'PENDING');

        if (orderData.directTeam) {
            setAssignmentType('DIRECT_TEAM');
            setDirectTeamName(orderData.directTeam);
            setSelectedContractorId("");
            setSelectedTeamId("");
        } else if (orderData.contractorId) {
            setAssignmentType('CONTRACTOR');
            setSelectedContractorId(orderData.contractorId);
            setSelectedTeamId(orderData.teamId || "");
        } else {
            setAssignmentType('CONTRACTOR');
            setSelectedContractorId("");
            setSelectedTeamId("");
        }

        // 7. Mode
        setCompletionMode(orderData.completionMode as 'ONLINE' | 'OFFLINE' | null || (orderData.orderType?.toUpperCase().includes('MODIFY-LOCATION') ? 'OFFLINE' : 'ONLINE'));
    }

    // Filter Items Logic
    const getFilteredItems = () => {
        if (itemFilter === 'ALL') return items;
        return items.filter(i => {
            let tags = i.commonFor as string | string[] | null | undefined;
            if (!tags || (Array.isArray(tags) && tags.length === 0)) return true; // Include if no tags

            // Handle Postgres raw string array format "{tag1,tag2}" or plain string "FTTH"
            if (typeof tags === 'string') {
                const clean = tags.replace(/[{}"\\]/g, ''); // Remove braces and quotes
                if (!clean) return true;
                tags = clean.split(',').map(t => t.trim());
            }

            // At this point, tags should be an array of strings (or we treat it as such)
            if (!Array.isArray(tags)) return false;

            const upperTags = (tags as string[]).map((t: string) => t.toUpperCase());
            const filter = itemFilter.toUpperCase();

            return upperTags.includes(filter) ||
                upperTags.includes('ALL') ||
                upperTags.includes('OTHERS') ||
                (['FTTH', 'PSTN'].includes(filter) && (upperTags.includes('OSP') || i.isOspFtth));
        });
    };

    const filteredItems = getFilteredItems();


    // Preset Helper
    const applyMaterialPreset = (type: 'STANDARD' | 'CLEAR') => {
        if (type === 'CLEAR') {
            setExtendedMaterialRows([]);
            return;
        }

        const newRows = [...extendedMaterialRows];
        const updateOrAdd = (code: string, field: string, value: string) => {
            const item = items.find(i => i.code === code);
            if (!item) return;
            const existingIdx = newRows.findIndex(r => r.itemId === item.id);
            if (existingIdx >= 0) {
                (newRows[existingIdx] as Record<string, string>)[field] = value;
            } else {
                const newRow = { itemId: item.id, usedQty: '', wastageQty: '', f1Qty: '', g1Qty: '', wastageReason: '', serialNumber: '' };
                (newRow as Record<string, string>)[field] = value;
                newRows.push(newRow);
            }
        };

        if (type === 'STANDARD') {
            updateOrAdd('OSPFTA003', 'f1Qty', '40');
            updateOrAdd('OSPFTA003', 'g1Qty', '10');
            // Try to find OTO and Patch Cord by common name if codes vary
            const oto = items.find(i => i.commonName?.toUpperCase().includes('OTO') || i.name.toUpperCase().includes('OTO'));
            const pc = items.find(i => i.commonName?.toUpperCase().includes('PATCH CORD') || i.name.toUpperCase().includes('PATCH CORD'));
            const conn = items.find(i => i.commonName?.toUpperCase().includes('CONNECTOR') || i.name.toUpperCase().includes('CONNECTOR'));

            if (oto) updateOrAdd(oto.code, 'usedQty', '1');
            if (pc) updateOrAdd(pc.code, 'usedQty', '1');
            if (conn) updateOrAdd(conn.code, 'usedQty', '2');
        }

        setExtendedMaterialRows(newRows);
        (toast as unknown as { info: (m: string) => void })?.info(`${type === 'STANDARD' ? 'Standard' : 'Fresh'} materials applied`);
    };


    const addExtendedRow = () => {
        setExtendedMaterialRows([...extendedMaterialRows, { itemId: '', usedQty: '', wastageQty: '', f1Qty: '', g1Qty: '', wastageReason: '', serialNumber: '' }]);
    };

    const updateExtendedRow = (idx: number, field: string, value: string) => {
        const rows = [...extendedMaterialRows];
        (rows[idx] as Record<string, string | undefined>)[field] = value;
        setExtendedMaterialRows(rows);
    };

    const removeExtendedRow = (idx: number) => {
        setExtendedMaterialRows(extendedMaterialRows.filter((_, i) => i !== idx));
    };

    // Quick Add Logic for Common Items
    const handleQuickAdd = (itemId: string, field: string, qty: string) => {
        const existingIdx = extendedMaterialRows.findIndex(r => r.itemId === itemId);
        if (existingIdx >= 0) {
            updateExtendedRow(existingIdx, field, qty);
        } else {
            // Add new row
            const initialRow = { itemId, usedQty: '', wastageQty: '', f1Qty: '', g1Qty: '', wastageReason: '', serialNumber: '' };
            (initialRow as Record<string, string | undefined>)[field] = qty;
            setExtendedMaterialRows([...extendedMaterialRows, initialRow]);
        }
    };

    const getQuickQty = (itemId: string, field: string) => {
        const row = extendedMaterialRows.find(r => r.itemId === itemId);
        return row ? (row as Record<string, string | undefined>)[field] : '';
    };

    // Identify Common Items dynamically with Priority Logic
    const quickItems = useMemo(() => {
        // 1. Get all candidates assigned to OSP FTTH
        const candidates = items.filter(i => i.isOspFtth);

        // 2. Group by Common Name
        const groups: Record<string, typeof items[0][]> = {};
        candidates.forEach(i => {
            const key = (i.commonName || i.name || "").trim();
            if (!key) return;
            if (!groups[key]) groups[key] = [];
            groups[key].push(i);
        });

        // 3. Select Best Item per Group
        const result = Object.entries(groups).map(([label, groupItems]) => {
            // Priority A: Matches System Config Source (SLT or COMPANY)
            let best = groupItems.find(i =>
                (materialSource === 'SLT' && i.type === 'SLT') ||
                (materialSource !== 'SLT' && i.type !== 'SLT')
            );

            // Priority B: Fallback to COMPANY (SLTS) if Source is SLT but item not found (e.g. Accessories)
            if (!best) {
                best = groupItems.find(i => i.type !== 'SLT');
            }

            // Priority C: Any
            if (!best) best = groupItems[0];

            return { label, item: best };
        });

        // 4. Sort Result by Admin Preference (itemSortOrder)
        return result.sort((a, b) => {
            // Find min sort index for group A (check all variants in group)
            const groupA = groups[a.label] || [];
            let idxA = 99999;
            for (const item of groupA) {
                const i = itemSortOrder.indexOf(item.id);
                if (i !== -1 && i < idxA) idxA = i;
            }

            // Find min sort index for group B
            const groupB = groups[b.label] || [];
            let idxB = 99999;
            for (const item of groupB) {
                const i = itemSortOrder.indexOf(item.id);
                if (i !== -1 && i < idxB) idxB = i;
            }

            // If both have explicit order
            if (idxA !== 99999 && idxB !== 99999) return idxA - idxB;
            if (idxA !== 99999) return -1; // A comes first
            if (idxB !== 99999) return 1;  // B comes first

            // Fallback to alphabetical
            return a.label.localeCompare(b.label);
        });
    }, [items, materialSource, itemSortOrder]);

    // Get teams for selected contractor
    const selectedContractor = contractors.find(c => c.id === selectedContractorId);
    const availableTeams = selectedContractor?.teams || [];


    // Calculate required IPTV serials count based on package type
    const iptvCount = orderData?.iptv ? parseInt(orderData.iptv) : 0;

    // Check if package requires IPTV serials
    const useExtendedView = showExtendedFields || (isComplete && !isReturn);
    const requiresIPTV = useExtendedView && iptvCount > 0;


    const handleConfirm = () => {
        if (!date) return;

        if (isComplete && materialStatus !== 'PENDING') {
            // We need to check combined usage for items (since Quick Add rows are in extendedMaterialRows)
            for (const row of extendedMaterialRows) {
                if (!row.itemId) continue;
                const item = items.find(i => i.id === row.itemId);
                if (!item) continue;

                const maxPerc = item.maxWastagePercentage ?? 0;
                const isWastageAllowed = item.isWastageAllowed ?? true;
                if (!isWastageAllowed) continue; // Should not happen if UI is correct

                // Calculate Usage
                let usage = 0;
                if (row.f1Qty || row.g1Qty) {
                    usage = (parseFloat(row.f1Qty || '0') || 0) + (parseFloat(row.g1Qty || '0') || 0);
                } else {
                    usage = parseFloat(row.usedQty || '0') || 0;
                }

                // Calculate Wastage
                const wastage = parseFloat(row.wastageQty || '0') || 0;

                // Validate
                if (wastage > 0) {
                    if (maxPerc <= 0) {
                        alert(`Item ${item.code} - ${item.name} does not allow wastage (Max 0%). Please correct.`);
                        return;
                    }
                    const limit = usage * (maxPerc / 100);
                    if (wastage > limit + 0.001) { // 0.001 tolerance
                        if (!row.wastageReason || row.wastageReason.trim().length < 5) {
                            alert(`Wastage for ${item.code} exceeds the allowed limit of ${maxPerc}% (${limit.toFixed(2)}m).\n\nYou must provide a valid reason (min 5 chars) to proceed.`);
                            return;
                        }
                    }
                }
            }
        }

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
            if (assignmentType === 'CONTRACTOR' && selectedTeamId) {
                const team = availableTeams.find(t => t.id === selectedTeamId);
                if (!team?.sltCode) {
                    alert("Selected team does not have an SLT Identification Code. This team cannot be assigned to SOD jobs.");
                    return;
                }
            }
            if (!wiredOnly) {
                if (!ontSerialNumber.trim()) {
                    alert("ONT Serial Number is required for completion");
                    return;
                }
                if (requiresIPTV && iptvSerials.some(s => !s.trim())) {
                    alert(`Please enter all ${iptvCount} STB Serial Numbers`);
                    return;
                }
            }
        }

        const finalReason = reason === "Other" ? customReason : reason;

        onConfirm({
            date: date.toISOString(),
            materialStatus,
            comment,
            reason: finalReason,
            ontSerialNumber: isComplete ? ontSerialNumber : undefined,
            ontType: isComplete ? ontType : undefined,
            iptvSerialNumbers: isComplete && requiresIPTV ? iptvSerials : undefined,
            dpDetails: isComplete ? dpDetails : undefined,
            contractorId: isComplete && assignmentType === 'CONTRACTOR' ? selectedContractorId : undefined,
            teamId: isComplete && assignmentType === 'CONTRACTOR' ? selectedTeamId : undefined,
            directTeamName: isComplete && assignmentType === 'DIRECT_TEAM' ? directTeamName : undefined,
            opmcPatStatus: isComplete ? opmcPatStatus : undefined,
            sltsPatStatus: isComplete ? sltsPatStatus : undefined,
            hoPatStatus: isComplete ? hoPatStatus : undefined,
            dropWireDistance: isComplete ? (() => {
                const dwRow = extendedMaterialRows.find(r => items.find(i => i.id === r.itemId)?.code === 'OSPFTA003');
                if (dwRow) {
                    return parseFloat(dwRow.f1Qty || '0') + parseFloat(dwRow.g1Qty || '0');
                }
                return 0;
            })() : undefined,
            wiredOnly: isComplete ? wiredOnly : undefined,
            delayReasons: isComplete ? delayReasons : undefined,
            stbShortage: isComplete ? stbShortage : undefined,
            ontShortage: isComplete ? ontShortage : undefined,
            materialUsage: isComplete ? (
                showExtendedFields
                    ? extendedMaterialRows.flatMap(row => {
                        const materialUsageItems = [];
                        if (row.itemId) {
                            // If F1 or G1 is present
                            if (row.f1Qty && parseFloat(row.f1Qty) > 0) materialUsageItems.push({ itemId: row.itemId, quantity: row.f1Qty, usageType: 'USED_F1' });
                            if (row.g1Qty && parseFloat(row.g1Qty) > 0) materialUsageItems.push({ itemId: row.itemId, quantity: row.g1Qty, usageType: 'USED_G1' });

                            // Standard 'Used'
                            if ((!row.f1Qty && !row.g1Qty) && row.usedQty && parseFloat(row.usedQty) > 0) {
                                materialUsageItems.push({
                                    itemId: row.itemId,
                                    quantity: row.usedQty,
                                    usageType: 'USED' as const,
                                    serialNumber: row.serialNumber
                                });
                            }

                            const item = items.find(i => i.id === row.itemId);
                            const maxPerc = item?.maxWastagePercentage || 0;
                            const wastage = parseFloat(row.wastageQty || '0') || 0;

                            // Calculate usage (F1+G1 for Drop Wire, usedQty for others)
                            let usage = 0;
                            if (row.f1Qty || row.g1Qty) {
                                usage = (parseFloat(row.f1Qty || '0') || 0) + (parseFloat(row.g1Qty || '0') || 0);
                            } else {
                                usage = (parseFloat(row.usedQty || '0') || 0);
                            }

                            const wastagePercent = usage > 0 ? (wastage / usage) * 100 : 0;
                            const exceedsLimit = maxPerc > 0 && wastage > (usage * (maxPerc / 100)) + 0.001;

                            if (row.wastageQty && parseFloat(row.wastageQty) > 0) {
                                materialUsageItems.push({
                                    itemId: row.itemId,
                                    quantity: row.wastageQty,
                                    usageType: 'WASTAGE' as const,
                                    comment: row.wastageReason || undefined,
                                    wastagePercent,
                                    exceedsLimit
                                });
                            }
                        }
                        return materialUsageItems;
                    })
                    : materialUsage.filter(m => m.itemId && parseFloat(m.quantity) > 0)
            ) : undefined,
            completionMode
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent
                className={cn(
                    "overflow-hidden flex flex-col p-0 gap-0 transition-all duration-200",
                    useExtendedView
                        ? (activeTab === 'materials' || activeTab === 'finish' ? "sm:max-w-7xl h-[90vh]" : "sm:max-w-2xl h-[90vh]")
                        : "sm:max-w-lg max-h-[90vh]"
                )}
            >
                <DialogHeader className="px-6 py-4 border-b shrink-0 bg-white">
                    <DialogTitle className="text-xl font-extrabold text-slate-900 tracking-tight">{title}</DialogTitle>
                    {useExtendedView && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
                            <div className="flex flex-col gap-1 p-2 rounded-lg bg-slate-50 border border-slate-100">
                                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Voice</span>
                                <span className="text-sm font-mono font-bold text-slate-800">{orderData?.voiceNumber || 'N/A'}</span>
                            </div>
                            <div className="flex flex-col gap-1 p-2 rounded-lg bg-slate-50 border border-slate-100">
                                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Pkg</span>
                                <span className="text-sm font-bold text-slate-800 truncate" title={orderData?.package || 'N/A'}>{orderData?.package || 'N/A'}</span>
                            </div>
                            <div className="flex flex-col gap-1 p-2 rounded-lg bg-slate-50 border border-slate-100">
                                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">IPTV</span>
                                <span className="text-sm font-bold text-slate-800">{orderData?.iptv || '0'}</span>
                            </div>
                            <div className="flex flex-col gap-1 p-2 rounded-lg bg-slate-50 border border-slate-100">
                                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">DP</span>
                                <span className="text-sm font-bold text-slate-800">{orderData?.dp || 'N/A'}</span>
                            </div>
                        </div>
                    )}
                </DialogHeader>

                <div className={cn(
                    "flex-1 min-h-0 bg-white flex flex-col",
                    useExtendedView ? "overflow-hidden p-0" : "overflow-y-auto px-6 py-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent"
                )}>
                    <div className={cn(
                        "mx-auto transition-all w-full flex flex-col h-full",
                        showExtendedFields ? "max-w-none" : ""
                    )}>

                        {/* Date Picker - Compact Version - Hide if Extended View is active */}
                        {!useExtendedView && (
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
                        )}

                        {useExtendedView && (
                            <div className="flex flex-col h-full w-full bg-slate-50/30">
                                {/* TAB HEADER */}
                                <div className="flex items-center px-6 bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                                    <button
                                        onClick={() => setActiveTab('details')}
                                        className={cn(
                                            "px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all",
                                            activeTab === 'details'
                                                ? "border-blue-600 text-blue-600 bg-blue-50/50"
                                                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                        )}
                                    >
                                        <span className="text-slate-400 font-mono mr-2">01</span> Job Details
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (activeTab === 'details' || isAssignmentValid()) {
                                                setActiveTab('materials');
                                            } else {
                                                alert("Please complete the Assignment details first.");
                                            }
                                        }}
                                        className={cn(
                                            "px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all",
                                            activeTab === 'materials'
                                                ? "border-blue-600 text-blue-600 bg-blue-50/50"
                                                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                        )}
                                    >
                                        <span className="text-slate-400 font-mono mr-2">02</span> Material Usage
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (isAssignmentValid()) {
                                                setActiveTab('finish');
                                            } else {
                                                alert("Please complete the Assignment details first.");
                                            }
                                        }}
                                        className={cn(
                                            "px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all",
                                            activeTab === 'finish'
                                                ? "border-blue-600 text-blue-600 bg-blue-50/50"
                                                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                        )}
                                    >
                                        <span className="text-slate-400 font-mono mr-2">03</span> Finalize
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6">
                                    {/* TAB 1: JOB DETAILS */}
                                    {activeTab === 'details' && (
                                        <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-left-4 duration-300">
                                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-8">

                                                {/* SECTION 01: JOB DETAILS */}
                                                <div className="space-y-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">01</div>
                                                        <h3 className="text-base font-extrabold text-slate-800 uppercase tracking-tight">Job Details</h3>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                        {/* LEFT COLUMN: Date & Mode */}
                                                        <div className="space-y-6">
                                                            <div className="space-y-2">
                                                                <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Completion Date</Label>
                                                                <Popover>
                                                                    <PopoverTrigger asChild>
                                                                        <Button variant={"outline"} className={cn("w-full h-11 justify-start text-left font-semibold border-slate-200 hover:bg-slate-50", !date && "text-muted-foreground")}>
                                                                            <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" />
                                                                            {date ? format(date, "PPP") : <span>Pick a date</span>}
                                                                        </Button>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-auto p-0" align="start">
                                                                        <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                                                                    </PopoverContent>
                                                                </Popover>
                                                            </div>

                                                            <div className="space-y-3">
                                                                <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Completion Mode</Label>
                                                                <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setCompletionMode('ONLINE')}
                                                                        className={cn("flex-1 py-2.5 text-xs font-bold rounded-lg transition-all", completionMode === 'ONLINE' ? "bg-white text-blue-600 shadow-md ring-1 ring-slate-900/5" : "text-slate-500 hover:text-slate-700")}
                                                                    >
                                                                        Online (iShamp)
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setCompletionMode('OFFLINE')}
                                                                        className={cn("flex-1 py-2.5 text-xs font-bold rounded-lg transition-all", completionMode === 'OFFLINE' ? "bg-white text-blue-600 shadow-md ring-1 ring-slate-900/5" : "text-slate-500 hover:text-slate-700")}
                                                                    >
                                                                        Offline
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* RIGHT COLUMN: Assignment */}
                                                        <div className="space-y-6 border-l border-slate-100 pl-0 md:pl-8">
                                                            <div className="space-y-2">
                                                                <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Assignment Type</Label>
                                                                <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setAssignmentType('CONTRACTOR')}
                                                                        className={cn("flex-1 py-2.5 text-xs font-bold rounded-lg transition-all", assignmentType === 'CONTRACTOR' ? "bg-white text-blue-600 shadow-md ring-1 ring-slate-900/5" : "text-slate-500 hover:text-slate-700")}
                                                                    >
                                                                        CONTRACTOR
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setAssignmentType('DIRECT_TEAM')}
                                                                        className={cn("flex-1 py-2.5 text-xs font-bold rounded-lg transition-all", assignmentType === 'DIRECT_TEAM' ? "bg-white text-blue-600 shadow-md ring-1 ring-slate-900/5" : "text-slate-500 hover:text-slate-700")}
                                                                    >
                                                                        DIRECT TEAM
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {assignmentType === 'CONTRACTOR' ? (
                                                                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                                                    <div className="space-y-1.5">
                                                                        <Label className="text-[10px] text-slate-400 font-bold uppercase ml-1">Pick Contractor</Label>
                                                                        <Select value={selectedContractorId} onValueChange={(v) => { setSelectedContractorId(v); setSelectedTeamId(""); }}>
                                                                            <SelectTrigger className="bg-white h-11 text-sm border-slate-200 focus:ring-blue-500 font-medium"><SelectValue placeholder="Pick Contractor" /></SelectTrigger>
                                                                            <SelectContent>{contractors.map(c => <SelectItem key={c.id} value={c.id} className="text-sm">{c.name}</SelectItem>)}</SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <div className="space-y-1.5">
                                                                        <Label className="text-[10px] text-slate-400 font-bold uppercase ml-1">Select Team</Label>
                                                                        <Select value={selectedTeamId} onValueChange={setSelectedTeamId} disabled={!selectedContractorId}>
                                                                            <SelectTrigger className="bg-white h-11 text-sm border-slate-200 focus:ring-blue-500 font-medium"><SelectValue placeholder="Select Team" /></SelectTrigger>
                                                                            <SelectContent>
                                                                                {availableTeams.length > 0 ? (
                                                                                    availableTeams.map(t => (
                                                                                        <SelectItem key={t.id} value={t.id} className="text-sm">
                                                                                            {t.name} {t.sltCode ? `[${t.sltCode}]` : '(No SLT Code)'}
                                                                                        </SelectItem>
                                                                                    ))
                                                                                ) : (
                                                                                    <div className="p-2 text-xs text-slate-400 text-center italic">No teams registered</div>
                                                                                )}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                                                                    <Label className="text-[10px] text-slate-400 font-bold uppercase ml-1 mb-1 block">Team Name</Label>
                                                                    <div className="relative">
                                                                        <Users className="absolute left-3 top-3 w-4 h-4 text-slate-300" />
                                                                        <Input
                                                                            value={directTeamName}
                                                                            onChange={(e) => setDirectTeamName(e.target.value)}
                                                                            placeholder="Select Team (Direct Name)"
                                                                            className="bg-white pl-9 h-11 text-sm border-slate-200 focus:border-blue-500 focus:ring-blue-500 shadow-sm font-medium"
                                                                        />
                                                                    </div>
                                                                    <p className="text-[10px] text-slate-400 mt-2 ml-1 italic">* Use for internal staff teams.</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 2: MATERIALS - 3 COLUMN LAYOUT */}
                                    {/* TAB 2: MATERIALS */}
                                    {activeTab === 'materials' && (
                                        <div className="max-w-none space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 pb-10">

                                            {/* PRESETS BAR */}
                                            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Presets:</span>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 text-[11px] font-bold border-blue-200 text-blue-600 hover:bg-blue-50"
                                                        onClick={() => applyMaterialPreset('STANDARD')}
                                                    >
                                                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                                        STANDARD FTTH
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 text-[11px] font-bold text-rose-500 hover:bg-rose-50"
                                                        onClick={() => applyMaterialPreset('CLEAR')}
                                                    >
                                                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                                                        RESET ALL
                                                    </Button>
                                                </div>
                                                <div className="hidden md:flex items-center gap-1 text-[10px] text-slate-400 italic">
                                                    <Info className="w-3 h-3" />
                                                    Click presets for quick-filling common items
                                                </div>
                                            </div>

                                            {/* HERO SECTION: DROP WIRE */}
                                            {quickItems.filter((q) => q.item.code === 'OSPFTA003').map((q) => {
                                                const maxWastage = q.item.maxWastagePercentage ?? 0;
                                                const f1 = parseFloat(getQuickQty(q.item.id, 'f1Qty') || '0');
                                                const g1 = parseFloat(getQuickQty(q.item.id, 'g1Qty') || '0');
                                                const w = parseFloat(getQuickQty(q.item.id, 'wastageQty') || '0');
                                                const limit = (f1 + g1) * (maxWastage / 100);
                                                const exceededBy = w - limit;
                                                const isWastageExceeded = maxWastage > 0 && w > limit + 0.001;

                                                return (
                                                    <div key={q.label} className={cn("bg-white border rounded-xl p-5 shadow-sm ring-1 ring-slate-900/5 transition-all duration-300", isWastageExceeded ? "border-rose-200 ring-rose-500/10" : "border-slate-200")}>
                                                        <div className="flex flex-col md:flex-row md:items-center gap-6">
                                                            <div className="md:w-[28%] border-r border-slate-100 pr-4">
                                                                <h4 className="text-base font-extrabold text-slate-800 uppercase tracking-tight">Fiber DROP Wire</h4>
                                                                <div className="flex items-center gap-2 mt-1.5">
                                                                    <code className="text-[11px] font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-100 text-slate-500 font-medium">{q.item.code}</code>
                                                                    {maxWastage > 0 && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">Max {maxWastage}%</span>}
                                                                </div>
                                                            </div>

                                                            <div className="flex-1 grid grid-cols-3 gap-6">
                                                                <div className="space-y-1.5">
                                                                    <label className="text-[10px] uppercase font-bold text-slate-400 block text-center tracking-wider">F1 (To House)</label>
                                                                    <Input type="number" placeholder="0"
                                                                        className="h-11 text-center font-mono text-lg font-medium border-slate-200 focus:border-blue-500 focus:ring-blue-500 bg-white shadow-sm"
                                                                        value={getQuickQty(q.item.id, 'f1Qty')}
                                                                        onChange={(e) => handleQuickAdd(q.item.id, 'f1Qty', e.target.value)}
                                                                    />
                                                                    <div className="flex justify-center gap-1 mt-1.5">
                                                                        {['30', '40', '50', '60'].map(v => (
                                                                            <button
                                                                                key={v}
                                                                                onClick={() => handleQuickAdd(q.item.id, 'f1Qty', v)}
                                                                                className="px-1.5 py-0.5 text-[9px] font-bold bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded border border-slate-200 transition-colors"
                                                                            >
                                                                                {v}m
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <label className="text-[10px] uppercase font-bold text-slate-400 block text-center tracking-wider">G1 (Inside)</label>
                                                                    <Input type="number" placeholder="0"
                                                                        className="h-11 text-center font-mono text-lg font-medium border-slate-200 focus:border-blue-500 focus:ring-blue-500 bg-white shadow-sm"
                                                                        value={getQuickQty(q.item.id, 'g1Qty')}
                                                                        onChange={(e) => handleQuickAdd(q.item.id, 'g1Qty', e.target.value)}
                                                                    />
                                                                    <div className="flex justify-center gap-1 mt-1.5">
                                                                        {['5', '10', '15', '20'].map(v => (
                                                                            <button
                                                                                key={v}
                                                                                onClick={() => handleQuickAdd(q.item.id, 'g1Qty', v)}
                                                                                className="px-1.5 py-0.5 text-[9px] font-bold bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded border border-slate-200 transition-colors"
                                                                            >
                                                                                {v}m
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-1.5 relative">
                                                                    <label className="text-[10px] uppercase font-bold text-rose-400 block text-center tracking-wider">Wastage (m)</label>
                                                                    <Input type="number" placeholder="0"
                                                                        className={cn("h-11 text-center font-mono text-lg font-medium shadow-sm transition-colors", isWastageExceeded ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500 bg-rose-50 text-rose-700" : "border-rose-200 focus:border-rose-500 focus:ring-rose-500 bg-rose-50/30 text-rose-700")}
                                                                        value={getQuickQty(q.item.id, 'wastageQty')}
                                                                        onChange={(e) => handleQuickAdd(q.item.id, 'wastageQty', e.target.value)}
                                                                    />
                                                                    {isWastageExceeded && (
                                                                        <div className="absolute -bottom-6 left-0 right-0 text-center">
                                                                            <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200 shadow-sm animate-in zoom-in duration-300">
                                                                                Exceeded by {exceededBy.toFixed(1)}m
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {isWastageExceeded && (
                                                            <div className="mt-8 pt-4 border-t border-rose-100 animate-in fade-in slide-in-from-top-2 duration-300">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="bg-rose-100 p-2 rounded-lg text-rose-600 shrink-0">
                                                                        <AlertCircle className="w-4 h-4" />
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <Label className="text-[10px] uppercase font-bold text-rose-900 mb-1 block">Specify Reason for Excessive Wastage</Label>
                                                                        <Input
                                                                            placeholder="Briefly explain why wastage exceeded the limit..."
                                                                            className="h-9 text-xs border-rose-200 focus:border-rose-500 focus:ring-rose-500 bg-rose-50/20"
                                                                            value={getQuickQty(q.item.id, 'wastageReason')}
                                                                            onChange={(e) => handleQuickAdd(q.item.id, 'wastageReason', e.target.value)}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            {/* GRID SECTION: POLES & ACCESSORIES */}
                                            {/* GRID SECTION: COMMON MATERIALS */}
                                            {(() => {
                                                const commonItems = quickItems.filter((q) => q.item.code !== 'OSPFTA003');
                                                const chunkSize = Math.ceil(commonItems.length / 3);
                                                const leftItems = commonItems.slice(0, chunkSize);
                                                const centerItems = commonItems.slice(chunkSize, chunkSize * 2);
                                                const rightItems = commonItems.slice(chunkSize * 2);

                                                const renderTable = (itemsToRender: typeof quickItems) => (
                                                    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden ring-1 ring-slate-900/5">
                                                        <table className="w-full">
                                                            <thead className="bg-slate-50 border-b border-slate-100">
                                                                <tr>
                                                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[40%]">Item Description</th>
                                                                    <th className="px-1 py-2 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[18%]">Qty</th>
                                                                    <th className="px-1 py-2 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[22%]">Wastage</th>
                                                                    <th className="px-1 py-2 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[20%]">Serial</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {itemsToRender.map((q) => {
                                                                    const maxPerc = q.item.maxWastagePercentage ?? 0;
                                                                    const used = parseFloat(getQuickQty(q.item.id, 'usedQty') || '0');
                                                                    const wastage = parseFloat(getQuickQty(q.item.id, 'wastageQty') || '0');
                                                                    const limit = used * (maxPerc / 100);
                                                                    const exceeded = maxPerc > 0 && wastage > limit + 0.001;
                                                                    const exceededBy = wastage - limit;

                                                                    return (
                                                                        <tr key={q.label} className={cn("group transition-colors", exceeded ? "bg-rose-50/50 hover:bg-rose-50" : "hover:bg-slate-50")}>
                                                                            <td className="px-3 py-2">
                                                                                <div className="font-semibold text-slate-700 text-[11px] leading-tight">{q.label}</div>
                                                                                <div className="text-[9px] text-slate-400 font-mono mt-0.5 scale-90 origin-left">{q.item.code}</div>
                                                                                {exceeded && (
                                                                                    <div className="mt-1 flex items-center gap-1 animate-in fade-in">
                                                                                        <AlertCircle className="w-2.5 h-2.5 text-rose-500" />
                                                                                        <span className="text-[9px] font-bold text-rose-600">Exceeded by {exceededBy.toFixed(1)}m</span>
                                                                                    </div>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-1 py-2 text-center">
                                                                                <div className="flex items-center justify-center gap-1.5">
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            const cur = parseInt(getQuickQty(q.item.id, 'usedQty') || '0');
                                                                                            if (cur > 0) handleQuickAdd(q.item.id, 'usedQty', String(cur - 1));
                                                                                        }}
                                                                                        className="w-5 h-5 flex items-center justify-center bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded text-xs transition-colors"
                                                                                    >
                                                                                        -
                                                                                    </button>
                                                                                    <Input className="h-7 w-12 text-center font-mono text-xs border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                                                                                        placeholder="0"
                                                                                        value={getQuickQty(q.item.id, 'usedQty')}
                                                                                        onChange={(e) => handleQuickAdd(q.item.id, 'usedQty', e.target.value)}
                                                                                    />
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            const cur = parseInt(getQuickQty(q.item.id, 'usedQty') || '0');
                                                                                            handleQuickAdd(q.item.id, 'usedQty', String(cur + 1));
                                                                                        }}
                                                                                        className="w-5 h-5 flex items-center justify-center bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded text-xs transition-colors"
                                                                                    >
                                                                                        +
                                                                                    </button>
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-1 py-2 text-center">
                                                                                {q.item.isWastageAllowed ?? true ? (
                                                                                    <div className="flex flex-col items-center gap-1 py-1">
                                                                                        <Input className={cn("h-7 w-12 mx-auto text-center font-mono text-xs shadow-sm transition-colors", exceeded ? "border-rose-400 focus:border-rose-500 bg-rose-50 text-rose-700" : "border-slate-100 bg-slate-50")}
                                                                                            placeholder="-"
                                                                                            value={getQuickQty(q.item.id, 'wastageQty')}
                                                                                            onChange={(e) => handleQuickAdd(q.item.id, 'wastageQty', e.target.value)}
                                                                                        />
                                                                                        {exceeded && (
                                                                                            <Input
                                                                                                placeholder="Reason?"
                                                                                                className="h-6 w-20 text-[9px] border-rose-200 focus:border-rose-400 focus:ring-rose-400 bg-white shadow-xs"
                                                                                                value={getQuickQty(q.item.id, 'wastageReason')}
                                                                                                onChange={(e) => handleQuickAdd(q.item.id, 'wastageReason', e.target.value)}
                                                                                            />
                                                                                        )}
                                                                                    </div>
                                                                                ) : <div className="text-center text-slate-300 text-[10px]">-</div>}
                                                                            </td>
                                                                            <td className="px-1 py-2 text-center">
                                                                                <Input className="h-7 w-12 mx-auto text-center font-mono text-[10px] border-slate-200 focus:border-blue-500 bg-white"
                                                                                    placeholder="SN"
                                                                                    value={getQuickQty(q.item.id, 'serialNumber')}
                                                                                    onChange={(e) => handleQuickAdd(q.item.id, 'serialNumber', e.target.value)}
                                                                                />
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                );

                                                return (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                        {renderTable(leftItems)}
                                                        {renderTable(centerItems)}
                                                        {renderTable(rightItems)}
                                                    </div>
                                                );
                                            })()}

                                            {/* ADDITIONAL MATERIALS TABLE */}
                                            <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                                                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                                                    <h3 className="text-sm font-semibold text-slate-800">Additional Materials</h3>
                                                    <Button size="sm" variant="outline" onClick={addExtendedRow} className="h-7 text-xs bg-white hover:bg-slate-50 border-slate-300 text-slate-700">
                                                        <Plus className="w-3 h-3 mr-1" /> Add New Row
                                                    </Button>
                                                </div>
                                                <div className="p-0 overflow-x-auto">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-slate-50/50 text-slate-500 font-medium border-b">
                                                            <tr>
                                                                <th className="px-4 py-2 text-left w-10">#</th>
                                                                <th className="px-4 py-2 text-left w-[35%]">Item Description</th>
                                                                <th className="px-4 py-2 text-left w-[18%]">Used Qty</th>
                                                                <th className="px-4 py-2 text-left w-[18%]">Wastage</th>
                                                                <th className="px-4 py-2 text-left w-[18%]">Serial #</th>
                                                                <th className="px-4 py-2 text-center w-10"></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {extendedMaterialRows.map((row, idx) => {
                                                                const isQuickItem = quickItems.some((q) => q.item.id === row.itemId);
                                                                if (isQuickItem) return null;

                                                                const item = items.find(i => i.id === row.itemId);
                                                                const maxPerc = (item?.maxWastagePercentage ?? 0);
                                                                const usedQty = parseFloat(row.usedQty || '0');
                                                                const wastageQty = parseFloat(row.wastageQty || '0');
                                                                const limit = usedQty * (maxPerc / 100);
                                                                const blocked = maxPerc > 0 && wastageQty > limit + 0.001;
                                                                const exceededBy = wastageQty - limit;
                                                                return (
                                                                    <tr key={idx} className={cn("group transition-colors", blocked ? "bg-rose-50/30" : "hover:bg-slate-50")}>
                                                                        <td className="px-4 py-2 text-center text-slate-400">{idx + 1}</td>
                                                                        <td className="px-4 py-2">
                                                                            <MaterialCombobox items={filteredItems} value={row.itemId} onChange={(v) => updateExtendedRow(idx, 'itemId', v)} />
                                                                            {item && maxPerc > 0 && <div className="text-[9px] text-slate-400 mt-1">Max: {maxPerc}% ({limit.toFixed(2)})</div>}
                                                                        </td>
                                                                        <td className="px-4 py-2">
                                                                            <Input type="number" placeholder="0" className="h-8 text-right font-mono" value={row.usedQty} onChange={e => updateExtendedRow(idx, 'usedQty', e.target.value)} />
                                                                        </td>
                                                                        <td className="px-4 py-2 relative">
                                                                            {item?.isWastageAllowed ?? true ? (
                                                                                <div className="flex flex-col gap-1.5 py-1">
                                                                                    <div className="relative">
                                                                                        <Input type="number" placeholder="0" className={cn("h-8 text-right font-mono transition-colors", blocked ? "bg-rose-50 text-rose-700 border-rose-300" : "")} value={row.wastageQty} onChange={e => updateExtendedRow(idx, 'wastageQty', e.target.value)} />
                                                                                        {blocked && (
                                                                                            <div className="absolute -top-4 right-0 text-[10px] text-rose-600 font-bold bg-white px-1 border border-rose-200 rounded shadow-sm">
                                                                                                + {exceededBy.toFixed(2)}m
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                    {blocked && (
                                                                                        <Input
                                                                                            placeholder="Reason for excessive wastage..."
                                                                                            className="h-7 text-[10px] border-rose-200 focus:border-rose-400 focus:ring-rose-400 bg-white"
                                                                                            value={row.wastageReason}
                                                                                            onChange={e => updateExtendedRow(idx, 'wastageReason', e.target.value)}
                                                                                        />
                                                                                    )}
                                                                                </div>
                                                                            ) : <span className="text-slate-300 text-xs text-center block">-</span>}
                                                                        </td>
                                                                        <td className="px-4 py-2">
                                                                            <Input placeholder="Serial #" className="h-8 text-xs font-mono" value={row.serialNumber} onChange={e => updateExtendedRow(idx, 'serialNumber', e.target.value)} />
                                                                        </td>
                                                                        <td className="px-4 py-2 text-center">
                                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500" onClick={() => removeExtendedRow(idx)}><X className="w-4 h-4" /></Button>
                                                                        </td>
                                                                    </tr>
                                                                )
                                                            })}

                                                            {(!extendedMaterialRows.length || !extendedMaterialRows.some(row => !quickItems.some((q) => q.item.id === row.itemId))) && (
                                                                <tr>
                                                                    <td colSpan={5} className="py-6 text-center text-slate-400 italic text-xs">No additional items added.</td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 3: FINISH */}
                                    {activeTab === 'finish' && (
                                        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-6">
                                                <div className="space-y-4">
                                                    <div className="flex items-start gap-3 p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                                                        <Checkbox id="mat-complete" checked={materialStatus === 'COMPLETED'} onCheckedChange={(c) => setMaterialStatus(c ? 'COMPLETED' : 'PENDING')} className="mt-0.5 border-emerald-500 text-emerald-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:text-white" />
                                                        <div>
                                                            <Label htmlFor="mat-complete" className="text-sm font-bold text-emerald-900 cursor-pointer">Mark Order as Fully Completed</Label>
                                                            <p className="text-xs text-emerald-700 mt-0.5">This will finalize the material entry and close the order step.</p>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-bold text-slate-500 uppercase">Internal Check (SLTS PAT)</Label>
                                                            <div className="flex items-center gap-2 h-9 px-3 bg-white rounded-md border border-slate-200">
                                                                <Checkbox
                                                                    id="slts-pat-pass"
                                                                    checked={sltsPatStatus === 'PAT_PASSED'}
                                                                    onCheckedChange={(c) => setSltsPatStatus(c ? 'PAT_PASSED' : 'PENDING')}
                                                                />
                                                                <Label htmlFor="slts-pat-pass" className={cn(
                                                                    "text-xs font-bold uppercase",
                                                                    sltsPatStatus === 'PAT_PASSED' ? "text-emerald-600" : "text-slate-400"
                                                                )}>
                                                                    {sltsPatStatus === 'PAT_PASSED' ? 'PAT PASSED' : 'PENDING CHECK'}
                                                                </Label>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-bold text-slate-500 uppercase">SLT PAT (Head Office)</Label>
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex items-center gap-2 h-9 px-3 bg-white rounded-md border border-slate-200">
                                                                    {hoPatStatus === 'PAT_PASSED' ? (
                                                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                                    ) : hoPatStatus === 'REJECTED' || opmcPatStatus === 'REJECTED' ? (
                                                                        <XCircle className="w-4 h-4 text-red-500" />
                                                                    ) : (
                                                                        <Clock className="w-4 h-4 text-amber-500" />
                                                                    )}
                                                                    <span className={cn(
                                                                        "text-xs font-bold uppercase",
                                                                        hoPatStatus === 'PAT_PASSED' ? "text-emerald-600" :
                                                                            (hoPatStatus === 'REJECTED' || opmcPatStatus === 'REJECTED') ? "text-red-600" : "text-amber-600"
                                                                    )}>
                                                                        {hoPatStatus === 'PAT_PASSED' ? 'PAT_PASSED' :
                                                                            hoPatStatus === 'REJECTED' ? 'HO REJECTED' :
                                                                                opmcPatStatus === 'REJECTED' ? 'OPMC REJECTED' : 'PENDING'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {sltsPatStatus !== 'PAT_PASSED' && (
                                                            <div className="col-span-2 flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-100 rounded-md">
                                                                <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                                                                <span className="text-[10px] font-bold text-rose-700 uppercase">
                                                                    Invoicing Blocked: Internal (SLTS) PAT must PASS for Part A Payment eligibility.
                                                                </span>
                                                            </div>
                                                        )}
                                                        {sltsPatStatus === 'PAT_PASSED' && hoPatStatus !== 'PAT_PASSED' && (
                                                            <div className="col-span-2 flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-md">
                                                                <Info className="w-3.5 h-3.5 text-amber-500" />
                                                                <span className="text-[10px] font-bold text-amber-700 uppercase">
                                                                    Part A Ready: Connection is Invoicable. Part B will be eligible after HO PAT PASS.
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* SPECIAL CIRCUMSTANCES (OPERATIONAL REPORTING) */}
                                                    <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-100 space-y-4">
                                                        <div className="flex items-center gap-2">
                                                            <AlertCircle className="w-4 h-4 text-amber-500" />
                                                            <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Special Circumstances</h4>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div className="flex items-center space-x-2">
                                                                <Checkbox id="wired-only" checked={wiredOnly} onCheckedChange={(v) => setWiredOnly(!!v)} />
                                                                <Label htmlFor="wired-only" className="text-[11px] font-semibold text-amber-900 cursor-pointer">Wired Only (Pending Equipment)</Label>
                                                            </div>
                                                            <div className="flex items-center space-x-2">
                                                                <Checkbox id="ont-short" checked={ontShortage} onCheckedChange={(v) => setOntShortage(!!v)} />
                                                                <Label htmlFor="ont-short" className="text-[11px] font-semibold text-amber-900 cursor-pointer">ONT Shortage</Label>
                                                            </div>
                                                            <div className="flex items-center space-x-2">
                                                                <Checkbox id="stb-short" checked={stbShortage} onCheckedChange={(v) => setStbShortage(!!v)} />
                                                                <Label htmlFor="stb-short" className="text-[11px] font-semibold text-amber-900 cursor-pointer">STB Shortage</Label>
                                                            </div>
                                                            <div className="flex items-center space-x-2">
                                                                <Checkbox id="cx-delay" checked={delayReasons.cxDelay} onCheckedChange={(v) => setDelayReasons({ ...delayReasons, cxDelay: !!v })} />
                                                                <Label htmlFor="cx-delay" className="text-[11px] font-semibold text-amber-900 cursor-pointer">Customer Delay</Label>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label className="text-sm font-medium text-slate-700">Completion Notes / Comments</Label>
                                                        <Textarea
                                                            value={comment}
                                                            onChange={e => setComment(e.target.value)}
                                                            placeholder="Add specific details about standard usage, variations, or site conditions..."
                                                            className="min-h-[120px] resize-y bg-white"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* FOOTER */}
                                <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center z-20">
                                    <Button variant="ghost" onClick={onClose} className="text-slate-500 hover:text-slate-800">Cancel</Button>
                                    <div className="flex gap-3">
                                        {activeTab === 'materials' && <Button variant="outline" onClick={() => setActiveTab('details')}>Back</Button>}
                                        {activeTab === 'finish' && <Button variant="outline" onClick={() => setActiveTab('materials')}>Back</Button>}

                                        {activeTab === 'details' && (
                                            <Button
                                                onClick={() => {
                                                    if (isAssignmentValid()) setActiveTab('materials');
                                                    else alert("Please select a Contractor or enter a Direct Team name.");
                                                }}
                                                className="bg-blue-600 hover:bg-blue-700"
                                            >
                                                Next: Materials
                                            </Button>
                                        )}
                                        {activeTab === 'materials' && <Button onClick={() => setActiveTab('finish')} className="bg-blue-600 hover:bg-blue-700">Next: Finalize</Button>}
                                        {activeTab === 'finish' && (
                                            <Button
                                                onClick={() => {
                                                    if (isAssignmentValid()) handleConfirm();
                                                    else {
                                                        setActiveTab('details');
                                                        alert("Assignment details are required to complete the order.");
                                                    }
                                                }}
                                                disabled={!date}
                                                className="bg-emerald-600 hover:bg-emerald-700 w-40 shadow-sm"
                                            >
                                                <Save className="w-4 h-4 mr-2" /> Complete Order
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}







                        {/* Return Reason Dropdown (Only if Return) */}
                        {(useExtendedView || !isComplete) && isReturn && (
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
                        {!useExtendedView && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Comment (Optional)</label>
                                <Textarea
                                    placeholder="Add any additional notes..."
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    rows={3}
                                />
                            </div>
                        )}

                        {!useExtendedView && (
                            <Button onClick={handleConfirm} disabled={!date} className="w-full mt-6">
                                {isComplete ? "Confirm Completion" : isReturn ? "Confirm Return" : "Save Updates"}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent >
        </Dialog >
    );
}
// Helper Component for Material Selection
interface ComboboxItem {
    id: string;
    code: string;
    name: string;
    commonName?: string | null;
}

function MaterialCombobox({ items, value, onChange, inputRef }: { items: ComboboxItem[], value: string, onChange: (val: string) => void, inputRef?: React.RefObject<HTMLButtonElement | null> }) {
    const [open, setOpen] = useState(false);
    const selectedItem = items.find(i => i.id === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button ref={inputRef} variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-8 text-xs font-normal border-slate-200 bg-white px-2 hover:bg-slate-50">
                    {selectedItem ? (
                        <span className="truncate">{selectedItem.code} - {(selectedItem.commonName || selectedItem.name)}</span>
                    ) : (
                        <span className="text-slate-400">Select material...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search code or name..." className="h-8 text-xs" />
                    <CommandList>
                        <CommandEmpty>No item found.</CommandEmpty>
                        <CommandGroup className="max-h-[200px] overflow-y-auto">
                            {items.map((item) => (
                                <CommandItem
                                    key={item.id}
                                    value={item.code + " " + item.name + " " + (item.commonName || "")}
                                    onSelect={() => {
                                        onChange(item.id === value ? "" : item.id);
                                        setOpen(false);
                                    }}
                                    className="text-xs"
                                >
                                    <Check className={cn("mr-2 h-3 w-3", value === item.id ? "opacity-100" : "opacity-0")} />
                                    <div className="flex flex-col">
                                        <span className="font-semibold">{item.code}</span>
                                        <span className="text-slate-500 text-[10px]">{item.commonName || item.name}</span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
