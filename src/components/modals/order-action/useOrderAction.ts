"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
    const [stbType, setStbType] = useState<'NEW' | 'EXISTING'>('NEW');
    const [stbTypes, setStbTypes] = useState<Array<'NEW' | 'EXISTING'>>([]);
    const [iptvSerials, setIptvSerials] = useState<string[]>([]);
    const [phoneType, setPhoneType] = useState<'NEW' | 'EXISTING'>('NEW');
    const [phoneSerialNumber, setPhoneSerialNumber] = useState("");
    const [dpDetails, setDpDetails] = useState("");
    const [erectedPoles, setErectedPoles] = useState<Array<{ poleType: string; poleNumber: string; }>>([]);
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
    const [activeTab, setActiveTab] = useState<'details' | 'materials' | 'cpe' | 'finish'>('details');
    const [wiredOnly, setWiredOnly] = useState(false);
    const [stbShortage, setStbShortage] = useState(false);
    const [ontShortage, setOntShortage] = useState(false);
    const [delayReasons, setDelayReasons] = useState({
        ontShortage: false, stbShortage: false, nokia: false, system: false, opmc: false, cxDelay: false, sameDay: false, polePending: false
    });
    const [collectedCpes, setCollectedCpes] = useState<Array<{ deviceType: string; serialNumber: string; condition: string }>>([]);

    const [prevOrderId, setPrevOrderId] = useState<string | null>(null);
    // Track which orderId has already had portal auto-fetch performed
    const portalFetchedRef = useRef<string | null>(null);

    // Reset and Initial Sync - only runs when orderId changes, NOT dependent on items
    useEffect(() => {
        if (!isOpen) {
            setPrevOrderId(null);
            portalFetchedRef.current = null; // Reset portal fetch guard on modal close
            return;
        }
        if (!orderData || orderData.id === prevOrderId) return;

        setPrevOrderId(orderData.id);
        
        // Basic fields
        setDate(orderData.completedDate ? new Date(orderData.completedDate) : undefined);
        setDpDetails(orderData.dpDetails || orderData.dp || "");
        setErectedPoles(orderData.erectedPoles || []);
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
                const targetItemId = m.itemId || (m as any).item?.id || "";
                if (!targetItemId) return;
                const qtyStr = String(m.quantity);
                const existing = rows.find(r => r.itemId === targetItemId);
                const isUsedType = ['USED', 'PORTAL_SYNC'].includes(m.usageType);
                if (existing) {
                    if (isUsedType) existing.usedQty = qtyStr;
                    else if (m.usageType === 'USED_F1') existing.f1Qty = qtyStr;
                    else if (m.usageType === 'USED_G1') existing.g1Qty = qtyStr;
                    else if (m.usageType === 'WASTAGE') { existing.wastageQty = qtyStr; existing.wastageReason = m.comment || ""; }
                    if (m.serialNumber && !existing.serialNumber) existing.serialNumber = m.serialNumber;
                } else {
                    rows.push({
                        itemId: targetItemId,
                        usedQty: isUsedType ? qtyStr : "",
                        f1Qty: m.usageType === 'USED_F1' ? qtyStr : "",
                        g1Qty: m.usageType === 'USED_G1' ? qtyStr : "",
                        wastageQty: m.usageType === 'WASTAGE' ? qtyStr : "",
                        wastageReason: m.usageType === 'WASTAGE' ? (m.comment || "") : "",
                        serialNumber: m.serialNumber || ""
                    });
                }
            });
        }

        // Group OSP_FTTH items by commonName (Category Group Name) for clean, non-duplicated representation
        const groupedMap = new Map<string, InventoryItem>();
        items.forEach(item => {
            if (!item.isOspFtth) return;
            const groupName = item.commonName || item.name;
            if (!groupedMap.has(groupName)) {
                const groupItems = items.filter(i => (i.commonName || i.name) === groupName);
                const activeSource = materialSource === 'SLT' ? 'SLT' : 'SLTS';
                const bestItem = groupItems.find(i => i.type === activeSource) || groupItems[0];
                groupedMap.set(groupName, bestItem);
            }
        });

        // AUTO-ADD 1 row per Category Group if missing
        groupedMap.forEach((bestItem, groupName) => {
            const hasExistingForGroup = rows.some(r => {
                const rowItem = items.find(i => i.id === r.itemId);
                return (rowItem?.commonName || rowItem?.name) === groupName;
            });

            if (!hasExistingForGroup) {
                let usedQty = "";
                let f1Qty = "";
                const lowerGroup = groupName.toLowerCase();
                if ((lowerGroup.includes("drop wire") || lowerGroup.includes("drop cable")) && orderData.dropWireDistance) {
                    f1Qty = String(orderData.dropWireDistance);
                }
                rows.push({
                    itemId: bestItem.id,
                    usedQty,
                    f1Qty,
                    g1Qty: "",
                    wastageQty: "",
                    wastageReason: "",
                    serialNumber: ""
                });
            }
        });
        
        // Sort rows strictly matching the configured items order (categoryOrder / itemSortOrder)
        rows.sort((a, b) => {
            const idxA = items.findIndex(i => i.id === a.itemId);
            const idxB = items.findIndex(i => i.id === b.itemId);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return 0;
        });

        setExtendedMaterialRows(rows);

        const iptvCount = orderData.iptv ? parseInt(orderData.iptv) : 0;
        const initialSerials = orderData.iptvSerials?.map(s => s.serialNumber);
        setIptvSerials(initialSerials && initialSerials.length > 0 ? initialSerials : (iptvCount > 0 ? Array(iptvCount).fill('') : ['']));

        setCollectedCpes(orderData.collectedCpes || []);

    }, [isOpen, orderData, prevOrderId]);

    // --- SEPARATE EFFECT: Auto-portal-sync fires ONLY when items are ready ---
    // This solves the race condition where items=[]) on first render
    // causing the portal fetch to complete but find no inventory matches.
    useEffect(() => {
        if (!isOpen || !orderData || !orderData.soNum || items.length === 0) return;
        if (orderData.materialUsage && orderData.materialUsage.length > 0) return;
        // Guard: only fetch once per orderId even if items re-renders
        if (portalFetchedRef.current === orderData.id) return;
        portalFetchedRef.current = orderData.id;

        fetch(`/api/service-orders/bridge-sync?soNum=${orderData.soNum}`)
            .then(r => r.json())
            .then(resJson => {
                const payload = resJson.data || resJson;
                const materialDetails = payload.materialDetails || [];
                if (payload.success && materialDetails.length > 0) {
                    const newRows: MaterialUsageRow[] = [];
                    const hasSpecificPoleSpec = materialDetails.some((m: any) => {
                        const str = String(m.ITEM || m.TYPE || m.NAME || "").toUpperCase();
                        return str.includes("PL-C") || str.includes("6.7") || str.includes("5.6") || str.includes("8.0") || str.includes("L18") || str.includes("L22") || str.includes("L26");
                    });

                    const filteredMaterials = materialDetails.filter((m: any) => {
                        const itemStr = String(m.ITEM || "").toUpperCase().trim();
                        const typeStr = String(m.TYPE || "").toUpperCase().trim();
                        const isGenericPoleHeader = itemStr === 'POLES' || itemStr === 'NUMBER OF POLES' || itemStr === 'GRID_MATERIAL' || typeStr === 'NUMBER OF POLES';
                        if (hasSpecificPoleSpec && isGenericPoleHeader) return false;
                        return true;
                    });

                    filteredMaterials.forEach((pm: any) => {
                        const itemKey = (pm.ITEM || "").toUpperCase().trim();
                        const typeKey = (pm.TYPE || "").toUpperCase().trim();
                        const codeKey = (pm.CODE || "").toUpperCase().trim();
                        const nameKey = (pm.NAME || "").toUpperCase().trim();
                        const qty = String(pm.QTY || "0");
                        const serial = pm.SERIAL || "";

                        const searchKeys = [itemKey, typeKey, codeKey, nameKey].filter(Boolean);
                        // 1. Exact match first
                        let matchedItem = items.find(i => {
                            const iCode = (i.code || "").toUpperCase();
                            const iName = (i.name || "").toUpperCase();
                            const iCommon = (i.commonName || "").toUpperCase();
                            const aliases = (i.importAliases || []).map(a => a.toUpperCase());
                            return searchKeys.some(sk => iCode === sk || iName === sk || iCommon === sk || aliases.includes(sk));
                        });

                        // 2. Strict Pole spec matching (prevents PL-C-6.7 matching 5.6m pole)
                        if (!matchedItem && searchKeys.some(sk => sk.includes("POLE") || sk.includes("PL-C"))) {
                            matchedItem = items.find(i => {
                                const iCommon = (i.commonName || i.name || "").toLowerCase();
                                if (!iCommon.includes("pole")) return false;
                                if (searchKeys.some(sk => sk.includes("6.7") || sk.includes("L22"))) return iCommon.includes("6.7");
                                if (searchKeys.some(sk => sk.includes("5.6") || sk.includes("L18"))) return iCommon.includes("5.6");
                                if (searchKeys.some(sk => sk.includes("8") || sk.includes("L26"))) return iCommon.includes("8");
                                return true;
                            });
                        }

                        // 3. Substring fallback matching for non-pole items
                        if (!matchedItem) {
                            matchedItem = items.find(i => {
                                const iCode = (i.code || "").toUpperCase();
                                const iName = (i.name || "").toUpperCase();
                                return searchKeys.some(sk => sk.length > 4 && (iCode.includes(sk) || (iName.length > 4 && sk.includes(iName))));
                            });
                        }

                        if (matchedItem) {
                            const groupName = matchedItem.commonName || matchedItem.name;
                            const groupItems = items.filter(i => (i.commonName || i.name) === groupName);
                            const activeSource = materialSource === 'SLT' ? 'SLT' : 'SLTS';
                            const bestGroupItem = groupItems.find(i => i.type === activeSource) || matchedItem;
                            const lowerName = groupName.toLowerCase();
                            const isDropWire = lowerName.includes("drop wire") || lowerName.includes("drop cable");

                            let finalQty = qty;
                            if (lowerName.includes("pole") && materialDetails) {
                                const totalPolesObj = materialDetails.find((d: any) => (d.ITEM === 'POLES' || d.TYPE === 'NUMBER OF POLES'));
                                if (totalPolesObj && totalPolesObj.QTY) {
                                    finalQty = String(totalPolesObj.QTY);
                                }
                            }

                            newRows.push({
                                itemId: bestGroupItem.id,
                                usedQty: isDropWire ? "" : finalQty,
                                f1Qty: isDropWire ? finalQty : "",
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
                                const nrItem = items.find(i => i.id === nr.itemId);
                                const existingIdx = combined.findIndex(r => {
                                    if (r.itemId === nr.itemId) return true;
                                    const rItem = items.find(i => i.id === r.itemId);
                                    if (rItem && nrItem) {
                                        return (rItem.commonName || rItem.name) === (nrItem.commonName || nrItem.name);
                                    }
                                    return false;
                                });

                                if (existingIdx >= 0) {
                                    combined[existingIdx] = {
                                        ...combined[existingIdx],
                                        usedQty: nr.usedQty || combined[existingIdx].usedQty,
                                        f1Qty: nr.f1Qty || combined[existingIdx].f1Qty,
                                        serialNumber: nr.serialNumber || combined[existingIdx].serialNumber
                                    };
                                } else {
                                    combined.push(nr);
                                }
                            });
                            return combined;
                        });
                    }
                }
            }).catch(err => console.warn('[AUTO_PORTAL_SYNC_ERR]', err));

    }, [isOpen, orderData, items, materialSource]);

    const handlePortalImport = useCallback(async () => {
        if (!orderData?.soNum || !items.length) return;
        const loadingToast = toast.loading("Connecting to Monitoring System...");
        try {
            const res = await fetch(`/api/service-orders/bridge-sync?soNum=${orderData.soNum}`);
            const resJson = await res.json();
            const data = resJson.data || resJson;
            const materialDetails = data.materialDetails || [];
            
            if (data.success && materialDetails.length > 0) {
                const newRows: MaterialUsageRow[] = [];
                const hasSpecificPoleSpec = materialDetails.some((m: any) => {
                    const str = String(m.ITEM || m.TYPE || m.NAME || "").toUpperCase();
                    return str.includes("PL-C") || str.includes("6.7") || str.includes("5.6") || str.includes("8.0") || str.includes("L18") || str.includes("L22") || str.includes("L26");
                });

                const filteredMaterials = materialDetails.filter((m: any) => {
                    const itemStr = String(m.ITEM || "").toUpperCase().trim();
                    const typeStr = String(m.TYPE || "").toUpperCase().trim();
                    const isGenericPoleHeader = itemStr === 'POLES' || itemStr === 'NUMBER OF POLES' || itemStr === 'GRID_MATERIAL' || typeStr === 'NUMBER OF POLES';
                    if (hasSpecificPoleSpec && isGenericPoleHeader) return false;
                    return true;
                });

                filteredMaterials.forEach((pm: any) => {
                    const itemKey = (pm.ITEM || "").toUpperCase().trim();
                    const typeKey = (pm.TYPE || "").toUpperCase().trim();
                    const codeKey = (pm.CODE || "").toUpperCase().trim();
                    const nameKey = (pm.NAME || "").toUpperCase().trim();
                    const qty = String(pm.QTY || "0");
                    const serial = pm.SERIAL || "";

                    const searchKeys = [itemKey, typeKey, codeKey, nameKey].filter(Boolean);

                    // 1. Exact match first
                    let matchedItem = items.find(i => {
                        const iCode = (i.code || "").toUpperCase();
                        const iName = (i.name || "").toUpperCase();
                        const iCommon = (i.commonName || "").toUpperCase();
                        const aliases = (i.importAliases || []).map(a => a.toUpperCase());
                        return searchKeys.some(sk => iCode === sk || iName === sk || iCommon === sk || aliases.includes(sk));
                    });

                    // 2. Strict Pole spec matching (prevents PL-C-6.7 matching 5.6m pole)
                    if (!matchedItem && searchKeys.some(sk => sk.includes("POLE") || sk.includes("PL-C"))) {
                        matchedItem = items.find(i => {
                            const iCommon = (i.commonName || i.name || "").toLowerCase();
                            if (!iCommon.includes("pole")) return false;
                            if (searchKeys.some(sk => sk.includes("6.7") || sk.includes("L22"))) return iCommon.includes("6.7");
                            if (searchKeys.some(sk => sk.includes("5.6") || sk.includes("L18"))) return iCommon.includes("5.6");
                            if (searchKeys.some(sk => sk.includes("8") || sk.includes("L26"))) return iCommon.includes("8");
                            return true;
                        });
                    }

                    // 3. Substring fallback matching for non-pole items
                    if (!matchedItem) {
                        matchedItem = items.find(i => {
                            const iCode = (i.code || "").toUpperCase();
                            const iName = (i.name || "").toUpperCase();
                            return searchKeys.some(sk => sk.length > 4 && (iCode.includes(sk) || (iName.length > 4 && sk.includes(iName))));
                        });
                    }

                    // If matched, find the target item for the active material source in that Common Group
                    if (matchedItem) {
                        const groupName = matchedItem.commonName || matchedItem.name;
                        const groupItems = items.filter(i => (i.commonName || i.name) === groupName);
                        const activeSource = materialSource === 'SLT' ? 'SLT' : 'SLTS';
                        const bestGroupItem = groupItems.find(i => i.type === activeSource) || matchedItem;

                        const lowerName = groupName.toLowerCase();
                        const isDropWire = lowerName.includes("drop wire") || lowerName.includes("drop cable");

                        // If portal sent total POLES quantity in raw details, use total POLES count for Pole item
                        let finalQty = qty;
                        if (lowerName.includes("pole") && data.materialDetails) {
                            const totalPolesObj = data.materialDetails.find((d: any) => (d.ITEM === 'POLES' || d.TYPE === 'NUMBER OF POLES'));
                            if (totalPolesObj && totalPolesObj.QTY) {
                                finalQty = String(totalPolesObj.QTY);
                            }
                        }

                        newRows.push({
                            itemId: bestGroupItem.id,
                            usedQty: isDropWire ? "" : finalQty,
                            f1Qty: isDropWire ? finalQty : "",
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
                            const nrItem = items.find(i => i.id === nr.itemId);
                            const existingIdx = combined.findIndex(r => {
                                if (r.itemId === nr.itemId) return true;
                                const rItem = items.find(i => i.id === r.itemId);
                                if (rItem && nrItem) {
                                    return (rItem.commonName || rItem.name) === (nrItem.commonName || nrItem.name);
                                }
                                return false;
                            });

                            if (existingIdx >= 0) {
                                combined[existingIdx] = {
                                    ...combined[existingIdx],
                                    usedQty: nr.usedQty || combined[existingIdx].usedQty,
                                    f1Qty: nr.f1Qty || combined[existingIdx].f1Qty,
                                    serialNumber: nr.serialNumber || combined[existingIdx].serialNumber
                                };
                            } else {
                                combined.push(nr);
                            }
                        });
                        return combined;
                    });
                    toast.success(`Synced ${newRows.length} material categories from SLT Portal!`);
                } else {
                    toast.info("No matching material categories found in Portal records");
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

    const applyPreset = (type: 'STANDARD' | 'CLEAR' | string) => {
        if (type === 'CLEAR') {
            setExtendedMaterialRows([]);
            return;
        }
        if (type === 'STANDARD') {
            const presetRows: MaterialUsageRow[] = [];
            items.forEach(item => {
                if (item.isOspFtth) {
                    let usedQty = "";
                    let f1Qty = "";
                    const lowerName = (item.commonName || item.name || "").toLowerCase();
                    if (lowerName.includes("drop wire") || lowerName.includes("drop cable")) {
                        f1Qty = "50";
                    } else if (lowerName.includes("ont") || lowerName.includes("router")) {
                        usedQty = "1";
                    } else if (lowerName.includes("rosette") || lowerName.includes("atb")) {
                        usedQty = "1";
                    } else if (lowerName.includes("fast connector")) {
                        usedQty = "2";
                    }
                    presetRows.push({
                        itemId: item.id,
                        usedQty,
                        f1Qty,
                        g1Qty: "",
                        wastageQty: "",
                        wastageReason: "",
                        serialNumber: ""
                    });
                }
            });
            setExtendedMaterialRows(presetRows);
            toast.success("Applied Standard FTTH Material Preset!");
        }
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
            erectedPoles: erectedPoles.filter(p => p.poleNumber.trim() !== ""),
            completionMode,
            collectedCpes: collectedCpes.filter(c => c.serialNumber.trim() !== "")
        });
    };

    const quickAddMaterial = (item: InventoryItem) => {
        const isDropWire = item.code === 'OSPFTA003';
        const field = isDropWire ? 'f1Qty' : 'usedQty';
        
        setExtendedMaterialRows(prev => {
            const existingIdx = prev.findIndex(r => r.itemId === item.id);
            if (existingIdx >= 0) {
                const currentVal = parseFloat(prev[existingIdx][field] || '0');
                const increment = isDropWire ? 10 : 1;
                const updated = [...prev];
                updated[existingIdx] = {
                    ...updated[existingIdx],
                    [field]: String(currentVal + increment)
                };
                return updated;
            } else {
                return [
                    ...prev,
                    {
                        itemId: item.id,
                        usedQty: isDropWire ? "" : "1",
                        f1Qty: isDropWire ? "10" : "",
                        g1Qty: "",
                        wastageQty: "",
                        wastageReason: "",
                        serialNumber: ""
                    }
                ];
            }
        });
        toast.success(`Added ${item.name}`);
    };

    return {
        state: {
            date, comment, reason, customReason, ontType, ontSerialNumber, stbType, stbTypes, iptvSerials,
            phoneType, phoneSerialNumber, dpDetails, materialStatus, selectedContractorId, selectedTeamId,
            opmcPatStatus, sltsPatStatus, hoPatStatus, completionMode, assignmentType, directTeamName,
            extendedMaterialRows, activeTab, wiredOnly, stbShortage, ontShortage, delayReasons,
            collectedCpes, erectedPoles
        },
        controls: {
            setDate, setComment, setReason, setCustomReason, setOntType, setOntSerialNumber, setStbType,
            setStbRowType: (idx: number, type: 'NEW' | 'EXISTING') => {
                const t = [...stbTypes]; t[idx] = type; setStbTypes(t);
            },
            setPhoneType, setPhoneSerialNumber,
            setIptvSerial: (idx: number, val: string) => {
                const s = [...iptvSerials]; s[idx] = val; setIptvSerials(s);
            },
            addIptvSerial: () => {
                setIptvSerials([...iptvSerials, ""]);
                setStbTypes([...stbTypes, 'NEW']);
            },
            removeIptvSerial: (idx: number) => {
                setIptvSerials(iptvSerials.filter((_, i) => i !== idx));
                setStbTypes(stbTypes.filter((_, i) => i !== idx));
            },

            setDpDetails, setMaterialStatus, setSelectedContractorId, setSelectedTeamId,
            setOpmcPatStatus, setSltsPatStatus, setHoPatStatus, setCompletionMode,
            setAssignmentType, setDirectTeamName, setActiveTab, setWiredOnly, setStbShortage, setOntShortage,
            setDelayReasons,
            addExtendedRow: () => setExtendedMaterialRows([...extendedMaterialRows, { itemId: '', usedQty: '', wastageQty: '', wastageReason: '', serialNumber: '' }]),
            quickAddMaterial,
            updateExtendedRow: (idx: number, field: keyof MaterialUsageRow, value: string) => {
                const r = [...extendedMaterialRows]; r[idx] = { ...r[idx], [field]: value }; setExtendedMaterialRows(r);
            },
            removeExtendedRow: (idx: number) => setExtendedMaterialRows(extendedMaterialRows.filter((_, i) => i !== idx)),
            addCollectedCpeRow: () => setCollectedCpes([...collectedCpes, { deviceType: 'ONT', serialNumber: '', condition: 'FAULTY' }]),
            addCollectedCpeWithType: (type: 'ONT' | 'STB' | 'PHONE') => setCollectedCpes([...collectedCpes, { deviceType: type, serialNumber: '', condition: 'FAULTY' }]),
            updateCollectedCpeRow: (idx: number, field: 'deviceType' | 'serialNumber' | 'condition', value: string) => {
                const c = [...collectedCpes];
                c[idx] = { ...c[idx], [field]: value };
                setCollectedCpes(c);
            },
            removeCollectedCpeRow: (idx: number) => setCollectedCpes(collectedCpes.filter((_, i) => i !== idx)),
            addErectedPoleRow: () => setErectedPoles([...erectedPoles, { poleType: 'PLC-5_6-CE', poleNumber: '' }]),
            updateErectedPoleRow: (idx: number, field: 'poleType' | 'poleNumber', value: string) => {
                const p = [...erectedPoles];
                p[idx] = { ...p[idx], [field]: value };
                setErectedPoles(p);
            },
            removeErectedPoleRow: (idx: number) => setErectedPoles(erectedPoles.filter((_, i) => i !== idx)),
            handlePortalImport,
            applyPreset,
            confirm
        }
    };
}
