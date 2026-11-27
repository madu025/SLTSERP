"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import GatePanel from "@/components/purchase/GatePanel";
import PurchaseRoute from "@/components/purchase/PurchaseRoute";
import { requestGate, isWholeUnit, type GateCheck } from "@/lib/purchase-flow-gates";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

interface InventoryItem {
    id: string;
    code: string;
    name: string;
    unit: string;
    category: string;
    type?: string;
}

interface RequestItem {
    itemId: string;
    requestedQty: string;
    remarks: string;
    make: string;
    model: string;
    suggestedVendor: string;
    isCustom?: boolean;
    customName?: string;
}

interface StoreOption {
    id: string;
    name: string;
    type: string;
}

interface StockItem {
    itemId: string;
    quantity: number;
}

interface CreateRequestPayload {
    fromStoreId: string;
    toStoreId: string | null;
    requestedById: string;
    priority: string;
    requiredDate: string;
    sourceType: string;
    projectTypes: string[];
    maintenanceMonths: string;
    irNumber: string | null;
    purpose: string;
    sltReferenceId: string | null;
    items: {
        itemId: string;
        requestedQty: number;
        remarks: string;
        make: string;
        model: string;
        suggestedVendor: string;
        isCustom?: boolean;
        customName?: string;
    }[];
}

export default function MaterialRequestPage() {
    const queryClient = useQueryClient();

    // Header State
    const [selectedStore, setSelectedStore] = useState<string>("");
    const [sourceType, setSourceType] = useState<string>("SLT");
    const [priority, setPriority] = useState<string>("MEDIUM");
    const [requiredDate, setRequiredDate] = useState<string>(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    });

    // Reason / Project State
    const [projectTypes, setProjectTypes] = useState<string[]>([]);
    const [maintenanceMonths, setMaintenanceMonths] = useState<string>("");
    const [otherReason, setOtherReason] = useState("");
    const [irNumber, setIrNumber] = useState(""); // IR Number for SLT requests

    // Attachment State
    const [attachmentUrl, setAttachmentUrl] = useState<string>("");
    const [isUploading, setIsUploading] = useState<boolean>(false);

    const [requestItems, setRequestItems] = useState<RequestItem[]>([]);

    // --- QUERIES ---
    const { data: stores = [] } = useQuery({
        queryKey: ["stores"],
        queryFn: async () => {
            const res = await fetch("/api/stores?page=1&limit=1000");
            const data = await res.json();
            return Array.isArray(data) ? data : (data.stores || []);
        }
    });

    const { data: items = [] } = useQuery<InventoryItem[]>({
        queryKey: ["inventory-items"],
        queryFn: async () => {
            const res = await fetch("/api/inventory/items?page=1&limit=1000");
            const data = await res.json();
            return Array.isArray(data) ? data : (data.items || []);
        }
    });

    // Auto-select logged-in user's assigned store
    useEffect(() => {
        if (!stores.length) return;
        const storedUser = localStorage.getItem('user');
        if (!storedUser) return;
        try {
            const userObj = JSON.parse(storedUser);
            const userStoreId = userObj.assignedStoreId;
            if (userStoreId && stores.some((s: StoreOption) => s.id === userStoreId)) {
                setSelectedStore(userStoreId);
                const store = stores.find((s: StoreOption) => s.id === userStoreId);
                if (store?.type === 'SUB') {
                    setSourceType('MAIN_STORE');
                } else if (store?.type === 'MAIN') {
                    setSourceType('SLT');
                }
            } else {
                // If user has no assigned store (e.g. Unassigned Stores Manager), require explicit store selection
                setSelectedStore("");
            }
        } catch (e) {
            console.error("Failed to parse user from localStorage", e);
        }
    }, [stores]);

    const { data: currentStocks = [] } = useQuery({
        queryKey: ["current-stock", selectedStore],
        queryFn: async () => {
            if (!selectedStore) return [];
            const res = await fetch(`/api/inventory/stock?storeId=${selectedStore}`, { cache: 'no-store' });
            const data = await res.json();
            return Array.isArray(data) ? data : (data.stock || data.data || []);
        },
        enabled: !!selectedStore
    });

    const { data: pendingBalances = [] } = useQuery({
        queryKey: ["pending-balances", selectedStore],
        queryFn: async () => {
            if (!selectedStore) return [];
            const res = await fetch(`/api/inventory/requests/pending-balances?storeId=${selectedStore}`);
            const data = await res.json();
            return data.success ? data.data : [];
        },
        enabled: !!selectedStore
    });

    const getCurrentStock = (itemId: string) => {
        const stock = currentStocks.find((s: StockItem) => s.itemId === itemId);
        return stock ? stock.quantity : 0;
    };

    // --- MUTATION ---
    const createRequestMutation = useMutation({
        mutationFn: async (data: CreateRequestPayload) => {
            const res = await fetch("/api/inventory/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            const resData = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(resData.error || resData.message || `Server error (${res.status})`);
            }
            return resData;
        },
        onSuccess: (data) => {
            toast.success(`Request ${data.requestNr || ''} submitted to the Stores Manager`);
            queryClient.invalidateQueries({ queryKey: ["material-requests"] });
            // Reset
            setRequestItems([]);
            setPriority("MEDIUM");
            setProjectTypes([]);
            setMaintenanceMonths("");
            setOtherReason("");
            setIrNumber("");
            setSourceType("SLT");
            setAttachmentUrl("");
            // Keep Store and Date
        },
        onError: (err: Error) => toast.error(err.message || "Failed to create request")
    });

    // --- HANDLERS ---
    const addNewRow = () => {
        setRequestItems([...requestItems, { itemId: "", requestedQty: "", remarks: "", make: "", model: "", suggestedVendor: "", isCustom: false, customName: "" }]);
    };

    const removeItem = (index: number) => {
        setRequestItems(requestItems.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: keyof RequestItem, value: string | boolean) => {
        const updated = [...requestItems];
        const item = updated[index] as unknown as Record<string, string | boolean | undefined>;
        item[field as string] = value;
        setRequestItems(updated);
    };

    const toggleProject = (type: string) => {
        if (projectTypes.includes(type)) setProjectTypes(projectTypes.filter(t => t !== type));
        else setProjectTypes([...projectTypes, type]);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setIsUploading(true);
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) throw new Error("Upload failed");
            const data = await res.json();
            setAttachmentUrl(data.url);
            toast.success("Memo approval attached successfully!");
        } catch {
            toast.error("Failed to upload memo document");
        } finally {
            setIsUploading(false);
        }
    };

    // ---- the checks of this screen: the same rules the server applies (lib/purchase-flow-gates.ts) ----
    const isPurchase = ['LOCAL_PURCHASE', 'EMERGENCY_LOCAL', 'SLT', 'PROCUREMENT', 'LOCAL'].includes(sourceType);
    const purposeDesc = [
        ...projectTypes,
        maintenanceMonths ? `Maintenance: ${maintenanceMonths}` : '',
        otherReason ? `Other: ${otherReason}` : ''
    ].filter(Boolean).join(', ');
    const lineOf = (item: RequestItem) => {
        const meta = items.find((i) => i.id === item.itemId);
        return {
            key: item.isCustom ? `custom:${(item.customName ?? '').trim().toLowerCase()}` : item.itemId,
            name: item.isCustom ? (item.customName || 'unregistered item') : (meta?.name ?? 'item'),
            unit: item.isCustom ? null : meta?.unit ?? null,
            quantity: parseFloat(item.requestedQty),
        };
    };
    const chosenLines = requestItems.filter((i) => i.itemId || (i.isCustom && i.customName));
    const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
    const checks: GateCheck[] = [
        ...requestGate({ storeChosen: !!selectedStore, purpose: purposeDesc, requiredDate: requiredDate || null, today, lines: chosenLines.map(lineOf) }),
        ...(sourceType === 'EMERGENCY_LOCAL' ? [{ key: 'memo', ok: !!attachmentUrl, text: attachmentUrl ? 'Memo approval attached' : 'Attach the memo approval (needed for an emergency purchase)' }] : []),
    ];
    const qtyError = (item: RequestItem) => {
        if (!(item.itemId || (item.isCustom && item.customName))) return null;
        const l = lineOf(item);
        if (!(l.quantity > 0)) return 'Enter a quantity above zero';
        if (isWholeUnit(l.unit) && !Number.isInteger(l.quantity)) return `Whole numbers only (${l.unit})`;
        return null;
    };
    const duplicateKeys = (() => {
        const seen = new Set<string>(); const dup = new Set<string>();
        for (const i of chosenLines) { const k = lineOf(i).key; if (seen.has(k)) dup.add(k); seen.add(k); }
        return dup;
    })();
    const sortedItems = [...items].sort((a, b) => (a.type === 'SLT') === (b.type === 'SLT') ? a.name.localeCompare(b.name) : a.type === 'SLT' ? -1 : 1);
    const selectedStoreType = stores.find((s: StoreOption) => s.id === selectedStore)?.type;
    const nextPerson = sourceType === 'MAIN_STORE' ? 'the Stores Manager (internal transfer)' : 'the Stores Manager';

    const handleSubmit = () => {
        const user = localStorage.getItem('user');
        if (!user) { toast.error("Sign in again: your session has ended"); return; }
        if (checks.some((c) => !c.ok)) return;

        const mainStore = stores.find((s: StoreOption) => s.type === 'MAIN');
        const targetToStoreId = sourceType === 'MAIN_STORE' ? (mainStore?.id || null) : null;
        createRequestMutation.mutate({
            fromStoreId: selectedStore,
            toStoreId: targetToStoreId,
            requestedById: JSON.parse(user).id,
            priority,
            requiredDate,
            sourceType,
            projectTypes,
            maintenanceMonths,
            irNumber: sourceType === 'SLT' ? irNumber : null,
            purpose: purposeDesc,
            sltReferenceId: attachmentUrl || null,
            items: chosenLines.map(item => ({
                itemId: item.isCustom ? 'custom' : item.itemId,
                requestedQty: parseFloat(item.requestedQty),
                remarks: item.remarks,
                make: item.make,
                model: item.model,
                suggestedVendor: item.suggestedVendor,
                isCustom: item.isCustom,
                customName: item.isCustom ? item.customName : undefined
            }))
        });
    };

    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="pf pf-page flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="max-w-7xl mx-auto flex flex-col gap-4">
                        <div className="pf-title">
                            <h1>New material request</h1>
                            <p>{isPurchase ? 'A purchase through HO: the Stores Manager reviews it first.' : 'A transfer from the main store.'}</p>
                        </div>
                        {isPurchase && <PurchaseRoute station="REQUEST" note="After you submit, it goes to the Stores Manager." />}

                        {pendingBalances.length > 0 && (
                            <div className="pf-note" role="note">
                                <strong>{pendingBalances.length} item(s) of this store are still waiting from earlier requests.</strong> Check them before asking again:
                                <ul className="mt-1 list-disc pl-5">
                                    {pendingBalances.slice(0, 6).map((b: { itemName: string; itemCode: string; requestNr: string; balanceQty: number }, i: number) => (
                                        <li key={i}>{b.itemName} ({b.itemCode}): {b.balanceQty} still to come on {b.requestNr}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="pf-layout">
                            <div className="pf-steps">
                                {/* 1. where from and when */}
                                <section className="pf-step" aria-labelledby="mr-1">
                                    <div className="pf-step-title" id="mr-1"><b>1</b>Store and source</div>
                                    <p className="pf-step-note">The store that needs the items, where they come from, and by when.</p>
                                    <div className="pf-grid">
                                        <div className="pf-field">
                                            <label htmlFor="mr-store">Requesting store</label>
                                            <select id="mr-store" className="pf-input" aria-invalid={requestItems.length > 0 && !selectedStore} value={selectedStore} onChange={e => {
                                                const newStoreId = e.target.value;
                                                setSelectedStore(newStoreId);
                                                const store = stores.find((s: StoreOption) => s.id === newStoreId);
                                                if (store?.type === 'SUB' && sourceType === 'SLT') setSourceType('MAIN_STORE');
                                                else if (store?.type === 'MAIN' && sourceType === 'MAIN_STORE') setSourceType('SLT');
                                            }}>
                                                <option value="">Select store...</option>
                                                {stores.map((s: StoreOption) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="pf-field">
                                            <label htmlFor="mr-source">Source</label>
                                            <select id="mr-source" className="pf-input" value={sourceType} onChange={e => setSourceType(e.target.value)}>
                                                {selectedStoreType === 'MAIN' && <option value="SLT">SLT (Head Office)</option>}
                                                {selectedStoreType === 'SUB' && <option value="MAIN_STORE">Main store (internal transfer)</option>}
                                                <option value="LOCAL_PURCHASE">Local purchase (vendor)</option>
                                                <option value="EMERGENCY_LOCAL">Emergency local purchase (memo needed)</option>
                                            </select>
                                        </div>
                                        <div className="pf-field">
                                            <label htmlFor="mr-date">Needed by</label>
                                            <input id="mr-date" type="date" min={today} className="pf-input" aria-invalid={!requiredDate || requiredDate < today} value={requiredDate} onChange={e => setRequiredDate(e.target.value)} />
                                            {requiredDate && requiredDate < today && <span className="pf-err">Choose today or later</span>}
                                        </div>
                                        <div className="pf-field">
                                            <label htmlFor="mr-priority">Priority</label>
                                            <select id="mr-priority" className="pf-input" value={priority} onChange={e => setPriority(e.target.value)}>
                                                <option value="MEDIUM">Normal</option>
                                                <option value="HIGH">High</option>
                                                <option value="URGENT">Urgent</option>
                                            </select>
                                        </div>
                                        {sourceType === 'SLT' && (
                                            <div className="pf-field">
                                                <label htmlFor="mr-ir">IR number (optional)</label>
                                                <input id="mr-ir" className="pf-input" placeholder="IR-2024-001" value={irNumber} onChange={e => setIrNumber(e.target.value)} />
                                            </div>
                                        )}
                                        <div className="pf-field">
                                            <label htmlFor="mr-memo">Memo approval {sourceType === 'EMERGENCY_LOCAL' ? '(required)' : '(optional)'}</label>
                                            <input id="mr-memo" type="file" accept="application/pdf,image/*" className="pf-input py-1" aria-invalid={sourceType === 'EMERGENCY_LOCAL' && !attachmentUrl} onChange={handleFileUpload} disabled={isUploading} />
                                            <span className="pf-hint">{isUploading ? 'Uploading...' : attachmentUrl ? 'Memo attached' : 'PDF or image'}</span>
                                        </div>
                                    </div>
                                </section>

                                {/* 2. what for */}
                                <section className="pf-step" aria-labelledby="mr-2">
                                    <div className="pf-step-title" id="mr-2"><b>2</b>What the items are for</div>
                                    <p className="pf-step-note">Tick the work, or write the purpose.</p>
                                    <div className="pf-choices" role="group" aria-label="Work">
                                        {[['OSP_FTTH', 'OSP FTTH'], ['OSP_PSTN', 'OSP PSTN'], ['OSP_PEOTV', 'OSP PEOTV'], ['OSP_HRB', 'OSP HRB']].map(([v, l]) => (
                                            <label key={v}><input type="checkbox" className="pf-check" checked={projectTypes.includes(v)} onChange={() => toggleProject(v)} />{l}</label>
                                        ))}
                                    </div>
                                    <div className="pf-choices mt-3" role="radiogroup" aria-label="Stock for maintenance">
                                        <span className="pf-label">Stock for maintenance:</span>
                                        {['1M', '2M', '3M'].map(m => (
                                            <label key={m}><input type="radio" name="maint" className="pf-check" checked={maintenanceMonths === m} onChange={() => setMaintenanceMonths(m)} />{m.replace('M', ' month' + (m === '1M' ? '' : 's'))}</label>
                                        ))}
                                    </div>
                                    <div className="pf-field mt-3">
                                        <label htmlFor="mr-other">Other purpose</label>
                                        <input id="mr-other" className="pf-input" aria-invalid={requestItems.length > 0 && purposeDesc.trim().length < 3} placeholder="For example: new connections in Kandy town" value={otherReason} onChange={e => setOtherReason(e.target.value)} />
                                    </div>
                                </section>

                                {/* 3. the items */}
                                <section className="pf-step" aria-labelledby="mr-3">
                                    <div className="pf-step-title" id="mr-3"><b>3</b>Items</div>
                                    <p className="pf-step-note">One line per item. Items counted in Nos take whole numbers.</p>
                                    <div className="overflow-x-auto">
                                        <table className="pf-table">
                                            <thead><tr><th>Item</th><th className="num">In store</th><th>Quantity</th><th>Make</th><th>Model</th><th>Suggested vendor</th><th>Remarks</th><th><span className="sr-only">Remove</span></th></tr></thead>
                                            <tbody>
                                                {requestItems.map((item, idx) => {
                                                    const meta = items.find((i) => i.id === item.itemId);
                                                    const err = qtyError(item);
                                                    const dup = (item.itemId || item.customName) && duplicateKeys.has(lineOf(item).key);
                                                    return (
                                                        <tr key={idx}>
                                                            <td style={{ minWidth: '16rem' }}>
                                                                {item.isCustom ? (
                                                                    <input className="pf-input" aria-label="Unregistered item name" placeholder="Name of the unregistered item" value={item.customName} onChange={e => updateItem(idx, 'customName', e.target.value)} />
                                                                ) : (
                                                                    <select className="pf-input" aria-label="Item" aria-invalid={!!dup} value={item.itemId} onChange={e => updateItem(idx, 'itemId', e.target.value)}>
                                                                        <option value="">Select item...</option>
                                                                        {sortedItems.map(i => <option key={i.id} value={i.id}>{i.name} ({i.code})</option>)}
                                                                    </select>
                                                                )}
                                                                <label className="mt-1 inline-flex items-center gap-1 text-xs" style={{ color: 'var(--pf-ink-2)' }}>
                                                                    <input type="checkbox" className="pf-check" checked={item.isCustom || false} onChange={(e) => { updateItem(idx, 'isCustom', e.target.checked); updateItem(idx, 'itemId', e.target.checked ? 'custom' : ''); }} />
                                                                    Not in the item list
                                                                </label>
                                                                {dup && <div className="pf-err">Listed twice: put the total on one line</div>}
                                                            </td>
                                                            <td className="num">{item.itemId && !item.isCustom ? getCurrentStock(item.itemId) : '-'}</td>
                                                            <td>
                                                                <span className="inline-flex items-center">
                                                                    <input type="number" min={0} step={isWholeUnit(meta?.unit) ? 1 : 'any'} aria-label="Quantity" aria-invalid={!!err} className="pf-input pf-qty" value={item.requestedQty} onChange={e => updateItem(idx, 'requestedQty', e.target.value)} />
                                                                    <span className="pf-unit">{meta?.unit ?? ''}</span>
                                                                </span>
                                                                {err && <div className="pf-err">{err}</div>}
                                                            </td>
                                                            <td><input className="pf-input" aria-label="Make" value={item.make} onChange={e => updateItem(idx, 'make', e.target.value)} /></td>
                                                            <td><input className="pf-input" aria-label="Model" value={item.model} onChange={e => updateItem(idx, 'model', e.target.value)} /></td>
                                                            <td><input className="pf-input" aria-label="Suggested vendor" value={item.suggestedVendor} onChange={e => updateItem(idx, 'suggestedVendor', e.target.value)} /></td>
                                                            <td><input className="pf-input" aria-label="Remarks" value={item.remarks} onChange={e => updateItem(idx, 'remarks', e.target.value)} /></td>
                                                            <td><button type="button" className="pf-icon-btn" aria-label={`Remove line ${idx + 1}`} onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4" /></button></td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    <button type="button" className="pf-add" onClick={addNewRow}><Plus className="mr-1 inline h-4 w-4" />Add new item line</button>
                                </section>
                            </div>

                            <GatePanel checks={checks} action={`Submit request to ${nextPerson.replace(' (internal transfer)', '')}`} onAction={handleSubmit} busy={createRequestMutation.isPending} testId="mr-submit" />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
