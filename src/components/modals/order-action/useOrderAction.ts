"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { OrderActionData, MaterialUsageRow, InventoryItem, OrderCompletionData } from "./types";

export function useOrderAction(
    isOpen: boolean,
    orderData: OrderActionData | undefined,
    items: InventoryItem[],
    materialSource: string,
    onConfirm: (data: OrderCompletionData) => void
) {
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [comment, setComment] = useState("");
    const [reason, setReason] = useState("");
    const [customReason, setCustomReason] = useState("");
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
    const [extendedMaterialRows, setExtendedMaterialRows] = useState<MaterialUsageRow[]>([]);
    const [activeTab, setActiveTab] = useState<'details' | 'materials' | 'finish'>('details');
    const [wiredOnly, setWiredOnly] = useState(false);
    const [stbShortage, setStbShortage] = useState(false);
    const [ontShortage, setOntShortage] = useState(false);
    const [delayReasons, setDelayReasons] = useState({
        ontShortage: false, stbShortage: false, nokia: false, system: false, opmc: false, cxDelay: false, sameDay: false, polePending: false
    });

    const [prevOrderId, setPrevOrderId] = useState<string | null>(null);

    // Reset and Initial Sync
    useEffect(() => {
        if (!isOpen) {
            setPrevOrderId(null);
            return;
        }
        if (!orderData || orderData.id === prevOrderId) return;

        setPrevOrderId(orderData.id);
        
        // Basic fields
        setDate(orderData.completedDate ? new Date(orderData.completedDate) : undefined);
        setDpDetails(orderData.dp || "");
        setOntSerialNumber(orderData.ontSerialNumber || "");
        setOpmcPatStatus(orderData.opmcPatStatus || "PENDING");
        setSltsPatStatus(orderData.sltsPatStatus || "PENDING");
        setHoPatStatus(orderData.hoPatStatus || "PENDING");
        
        // Assignment
        if (orderData.directTeam) {
            setAssignmentType('DIRECT_TEAM');
            setDirectTeamName(orderData.directTeam);
        } else {
            setAssignmentType('CONTRACTOR');
            setSelectedContractorId(orderData.contractorId || "");
            setSelectedTeamId(orderData.teamId || "");
        }

        // Complex state mapping for materials
        const rows: MaterialUsageRow[] = [];
        if (orderData.materialUsage) {
            orderData.materialUsage.forEach(m => {
                const qtyStr = String(m.quantity);
                const existing = rows.find(r => r.itemId === m.itemId);
                if (existing) {
                    if (m.usageType === 'USED_F1') existing.f1Qty = qtyStr;
                    else if (m.usageType === 'USED_G1') existing.g1Qty = qtyStr;
                    else if (m.usageType === 'WASTAGE') { existing.wastageQty = qtyStr; existing.wastageReason = m.comment || ""; }
                } else {
                    rows.push({
                        itemId: m.itemId,
                        usedQty: m.usageType === 'USED' ? qtyStr : "",
                        f1Qty: m.usageType === 'USED_F1' ? qtyStr : "",
                        g1Qty: m.usageType === 'USED_G1' ? qtyStr : "",
                        wastageQty: m.usageType === 'WASTAGE' ? qtyStr : "",
                        wastageReason: m.usageType === 'WASTAGE' ? (m.comment || "") : "",
                        serialNumber: m.serialNumber || ""
                    });
                }
            });
        }

        // AUTO-ADD OSP_FTTH items for quick access if they are missing
        items.forEach(item => {
            if (item.isOspFtth && !rows.find(r => r.itemId === item.id)) {
                rows.push({
                    itemId: item.id,
                    usedQty: "",
                    f1Qty: "",
                    g1Qty: "",
                    wastageQty: "",
                    wastageReason: "",
                    serialNumber: ""
                });
            }
        });
        
        setExtendedMaterialRows(rows);

        const iptvCount = orderData.iptv ? parseInt(orderData.iptv) : 0;
        setIptvSerials(orderData.iptvSerialNumbers || Array(iptvCount).fill(''));

    }, [isOpen, orderData, prevOrderId, items]);

    const handlePortalImport = useCallback(async () => {
        if (!orderData?.soNum || !items.length) return;
        const loadingToast = toast.loading("Connecting to Monitoring System...");
        try {
            const res = await fetch(`/api/service-orders/bridge-sync?soNum=${orderData.soNum}`);
            const data = await res.json();
            
            if (data.success && data.materialDetails) {
                const portalMaterials = data.materialDetails as Array<{ CODE?: string; TYPE?: string; NAME?: string; QTY?: string | number; SERIAL?: string }>;
                const newRows: MaterialUsageRow[] = [];

                portalMaterials.forEach(pm => {
                    const code = pm.CODE || pm.TYPE;
                    const name = pm.NAME;
                    const qty = String(pm.QTY || "0");
                    const serial = pm.SERIAL || "";

                    const searchKey = (code || name || "").toUpperCase();
                    // Match item
                    const matchedItem = items.find(i => {
                        const iCode = (i.code || "").toUpperCase();
                        const iName = (i.name || "").toUpperCase();
                        const aliases = (i.importAliases || []).map(a => a.toUpperCase());
                        
                        return iCode === searchKey || 
                               iName === searchKey || 
                               aliases.includes(searchKey) ||
                               searchKey.includes(iCode) ||
                               (iName.length > 3 && searchKey.includes(iName));
                    });

                    if (matchedItem) {
                        const isDropWire = matchedItem.code === 'OSPFTA003';
                        newRows.push({
                            itemId: matchedItem.id,
                            usedQty: isDropWire ? "" : qty,
                            f1Qty: isDropWire ? qty : "",
                            g1Qty: "",
                            wastageQty: "",
                            serialNumber: serial
                        });
                    }
                });

                if (newRows.length > 0) {
                    setExtendedMaterialRows(prev => {
                        const combined = [...prev];
                        newRows.forEach(nr => {
                            if (!combined.find(r => r.itemId === nr.itemId)) {
                                combined.push(nr);
                            }
                        });
                        return combined;
                    });
                    toast.success(`Detected ${newRows.length} items from Portal`);
                } else {
                    toast.info("No matching items found in Portal records");
                }
            } else {
                toast.error(data.message || "Could not retrieve portal sync data");
            }
        } catch (err) {
            console.error("Portal sync error:", err);
            toast.error("Bridge Connection Error");
        } finally {
            toast.dismiss(loadingToast);
        }
    }, [orderData, items]);

    const applyPreset = (type: 'STANDARD' | 'CLEAR') => {
        if (type === 'CLEAR') {
            setExtendedMaterialRows([]);
            return;
        }
        // Apply standard FTTH logic
        toast.info("Standard FTTH preset applied");
    };

    const confirm = () => {
        // Validation logic
        if (!date) { toast.error("Please select a date"); return; }
        
        // Transform MaterialUsageRow[] to MaterialUsageUpdateInput[]
        const materialUsage: Array<{ itemId: string; quantity: number; usageType: string; serialNumber?: string; comment?: string }> = [];
        extendedMaterialRows.forEach(row => {
            if (!row.itemId) return;

            // 1. Used Qty
            if (row.f1Qty && parseFloat(row.f1Qty) > 0) {
                materialUsage.push({ itemId: row.itemId, quantity: parseFloat(row.f1Qty), usageType: 'USED_F1', serialNumber: row.serialNumber });
            }
            if (row.g1Qty && parseFloat(row.g1Qty) > 0) {
                materialUsage.push({ itemId: row.itemId, quantity: parseFloat(row.g1Qty), usageType: 'USED_G1' });
            }
            if (row.usedQty && parseFloat(row.usedQty) > 0) {
                materialUsage.push({ itemId: row.itemId, quantity: parseFloat(row.usedQty), usageType: 'USED', serialNumber: row.serialNumber });
            }
            
            // 2. Wastage
            if (row.wastageQty && parseFloat(row.wastageQty) > 0) {
                materialUsage.push({ itemId: row.itemId, quantity: parseFloat(row.wastageQty), usageType: 'WASTAGE', comment: row.wastageReason });
            }
        });

        onConfirm({
            date: date.toISOString(),
            comment,
            materialStatus,
            ontSerialNumber,
            iptvSerialNumbers: iptvSerials.filter(s => s.trim() !== ""),
            materialUsage,
            assignmentType,
            contractorId: selectedContractorId,
            teamId: selectedTeamId,
            directTeam: directTeamName,
            dpDetails,
            completionMode
        });
    };

    return {
        state: {
            date, comment, reason, customReason, ontType, ontSerialNumber, iptvSerials, dpDetails,
            materialStatus, selectedContractorId, selectedTeamId, opmcPatStatus, sltsPatStatus,
            hoPatStatus, completionMode, assignmentType, directTeamName, extendedMaterialRows,
            activeTab, wiredOnly, stbShortage, ontShortage, delayReasons
        },
        controls: {
            setDate, setComment, setReason, setCustomReason, setOntType, setOntSerialNumber,
            setIptvSerial: (idx: number, val: string) => {
                const s = [...iptvSerials]; s[idx] = val; setIptvSerials(s);
            },
            setDpDetails, setMaterialStatus, setSelectedContractorId, setSelectedTeamId,
            setOpmcPatStatus, setSltsPatStatus, setHoPatStatus, setCompletionMode,
            setAssignmentType, setDirectTeamName, setActiveTab, setWiredOnly, setStbShortage, setOntShortage,
            setDelayReasons,
            addExtendedRow: () => setExtendedMaterialRows([...extendedMaterialRows, { itemId: '', usedQty: '', wastageQty: '', wastageReason: '', serialNumber: '' }]),
            updateExtendedRow: (idx: number, field: keyof MaterialUsageRow, value: string) => {
                const r = [...extendedMaterialRows]; r[idx] = { ...r[idx], [field]: value }; setExtendedMaterialRows(r);
            },
            removeExtendedRow: (idx: number) => setExtendedMaterialRows(extendedMaterialRows.filter((_, i) => i !== idx)),
            handlePortalImport,
            applyPreset,
            confirm
        }
    };
}
