"use client";

import { getCanonicalCategoryName } from "@/config/slt-scraped-aliases";
import { safeJsonParse } from '@/utils/safeJsonParse';
import React, { useState, useEffect, useMemo } from "react";
import { toast } from 'sonner';
import { Search, Save, Loader2, Plus, X, Edit2, GripVertical, Info, LayoutGrid, List, Layers, ChevronUp, ChevronDown, Link2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
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
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface InventoryItem {
    id: string;
    code: string;
    name: string;
    category?: string;
    unit?: string;
    commonName?: string;
    commonFor?: string[];
    importAliases?: string[];
    scrapedAliases?: string[];
    bomAliases?: string[];
    isOspFtth: boolean;
    type: string;
    isWastageAllowed?: boolean;
}

type AliasField = 'importAliases' | 'scrapedAliases' | 'bomAliases';

export function MaterialAssignment() {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [changes, setChanges] = useState<Record<string, Partial<InventoryItem>>>({});
    const [itemOrder, setItemOrder] = useState<string[]>([]);
    const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
    const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
    const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('table'); // Default to Category List View

    const [showAddExisting, setShowAddExisting] = useState(false);
    const [selectedItem, setSelectedItem] = useState<string>("");

    const [showEditDialog, setShowEditDialog] = useState(false);
    const [editingItem, setEditingItem] = useState<{ id: string; commonName: string; tags: string[] } | null>(null);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const [itemsRes, configRes] = await Promise.all([
                fetch(`/api/inventory/items?_t=${Date.now()}`, { cache: 'no-store' }),
                fetch(`/api/admin/system-config?_t=${Date.now()}`, { cache: 'no-store' })
            ]);

            if (itemsRes.ok) {
                const data = await itemsRes.json();
                const rawItems = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
                setItems(rawItems);
            }

            if (configRes.ok) {
                const configs = await configRes.json();
                const configArray = Array.isArray(configs) ? configs : (Array.isArray(configs?.data) ? configs.data : []);

                const catConfig = configArray.find((c: { key: string }) => c.key === 'OSP_CATEGORY_ORDER');
                if (catConfig?.value) {
                    const parsedCat = safeJsonParse<string[]>(catConfig.value, []);
                    if (Array.isArray(parsedCat)) setCategoryOrder(parsedCat);
                }

                const itemConfig = configArray.find((c: { key: string }) => c.key === 'OSP_ITEM_ORDER');
                if (itemConfig?.value) {
                    const parsedItem = safeJsonParse<string[]>(itemConfig.value, []);
                    if (Array.isArray(parsedItem)) setItemOrder(parsedItem);
                }
            }
        } catch (error) {
            console.error('[MATERIAL_ASSIGNMENT] Error fetching material items:', error);
            toast.error('Failed to load material codes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    // Unique common names for datalist
    const uniqueCommonNames = useMemo(() => {
        const names = new Set<string>();
        items.forEach(i => {
            const changedName = changes[i.id]?.commonName;
            const name = changedName !== undefined ? changedName : i.commonName;
            if (name) names.add(name);
        });
        return Array.from(names).sort();
    }, [items, changes]);

    // Group items into Category Pair Rows with Canonical Name Auto-Consolidation
    const mappedPairsMatrix = useMemo(() => {
        const matrix: Record<string, { commonName: string; sltItems: InventoryItem[]; companyItems: InventoryItem[] }> = {};
        
        items.forEach(item => {
            const isActive = changes[item.id]?.isOspFtth ?? item.isOspFtth;
            if (!isActive) return;

            const rawCName = (changes[item.id]?.commonName !== undefined ? changes[item.id]?.commonName : item.commonName) || item.name;
            const cName = getCanonicalCategoryName(rawCName, Object.keys(matrix));
            const itemType = changes[item.id]?.type ?? item.type;

            if (!matrix[cName]) {
                matrix[cName] = { commonName: cName, sltItems: [], companyItems: [] };
            }

            if (itemType === 'SLT') {
                matrix[cName].sltItems.push(item);
            } else {
                matrix[cName].companyItems.push(item);
            }
        });

        return matrix;
    }, [items, changes]);

    // Sorted Category Group list based on categoryOrder
    const sortedCategoryGroups = useMemo(() => {
        const groups = Object.values(mappedPairsMatrix);

        groups.sort((a, b) => {
            const idxA = categoryOrder.indexOf(a.commonName);
            const idxB = categoryOrder.indexOf(b.commonName);

            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;

            return a.commonName.localeCompare(b.commonName);
        });

        if (!search.trim()) return groups;
        const q = search.toLowerCase();
        return groups.filter(g =>
            g.commonName.toLowerCase().includes(q) ||
            g.sltItems.some(i => i.code.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)) ||
            g.companyItems.some(i => i.code.toLowerCase().includes(q) || i.name.toLowerCase().includes(q))
        );
    }, [mappedPairsMatrix, categoryOrder, search]);


    const activeItems = items.filter(item => {
        const isActive = changes[item.id]?.isOspFtth ?? item.isOspFtth;
        return isActive;
    }).filter(item =>
        item.code.toLowerCase().includes(search.toLowerCase()) ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.commonName && item.commonName.toLowerCase().includes(search.toLowerCase()))
    );

    const inactiveItems = items.filter(item => {
        const isActive = changes[item.id]?.isOspFtth ?? item.isOspFtth;
        return !isActive;
    });

    // High-Sensitivity Drag & Drop Handlers
    const handleCategoryDragStart = (e: React.DragEvent, cName: string) => {
        setDraggedCategory(cName);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", cName);
    };

    const handleCategoryDragOver = (e: React.DragEvent, targetName: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dragOverCategory !== targetName) {
            setDragOverCategory(targetName);
        }
    };

    const handleCategoryDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleCategoryDrop = (e: React.DragEvent, targetName: string) => {
        e.preventDefault();
        setDragOverCategory(null);
        if (!draggedCategory || draggedCategory === targetName) return;

        const currentOrder = [...categoryOrder];
        const allCategories = Object.keys(mappedPairsMatrix);

        allCategories.forEach(cat => {
            if (!currentOrder.includes(cat)) currentOrder.push(cat);
        });

        const fromIdx = currentOrder.indexOf(draggedCategory);
        const toIdx = currentOrder.indexOf(targetName);

        if (fromIdx > -1 && toIdx > -1) {
            currentOrder.splice(fromIdx, 1);
            currentOrder.splice(toIdx, 0, draggedCategory);
            setCategoryOrder(currentOrder);
            toast.success(`Moved Category "${draggedCategory}" to Row #${toIdx + 1}!`);
        }
        setDraggedCategory(null);
    };

    const moveCategory = (cName: string, direction: 'up' | 'down') => {
        const currentOrder = [...categoryOrder];
        const allCategories = Object.keys(mappedPairsMatrix);

        allCategories.forEach(cat => {
            if (!currentOrder.includes(cat)) currentOrder.push(cat);
        });

        const idx = currentOrder.indexOf(cName);
        if (idx === -1) return;

        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= currentOrder.length) return;

        currentOrder.splice(idx, 1);
        currentOrder.splice(targetIdx, 0, cName);
        setCategoryOrder(currentOrder);
        toast.info(`Moved "${cName}" to Row #${targetIdx + 1}`);
    };

    const handleChange = (id: string, updates: Partial<InventoryItem>) => {
        setChanges(prev => ({
            ...prev,
            [id]: { ...prev[id], ...updates }
        }));
    };

    const handleQuickAdd = (itemId: string, type: string) => {
        handleChange(itemId, { isOspFtth: true, type });
        setSelectedItem("");
        setShowAddExisting(false);
    };

    const handleEditClick = (item: InventoryItem) => {
        const current = changes[item.id] || {};
        setEditingItem({
            id: item.id,
            commonName: current.commonName ?? item.commonName ?? "",
            tags: current.commonFor ?? item.commonFor ?? []
        });
        setShowEditDialog(true);
    };

    const handleSaveEdit = () => {
        if (!editingItem) return;
        handleChange(editingItem.id, {
            commonName: editingItem.commonName || "",
            commonFor: editingItem.tags
        });
        setShowEditDialog(false);
        setEditingItem(null);
    };

    const handleAddCategoryAlias = (cName: string, field: AliasField, rawAlias: string) => {
        if (!rawAlias.trim()) return;
        const cleanAlias = rawAlias.trim().toUpperCase();
        const group = mappedPairsMatrix[cName];
        if (!group) return;

        const allItemsInGroup = [...group.sltItems, ...group.companyItems];
        const newChanges: Record<string, Partial<InventoryItem>> = { ...changes };

        allItemsInGroup.forEach(item => {
            const existing = newChanges[item.id]?.[field] ?? item[field] ?? [];
            if (!existing.includes(cleanAlias)) {
                newChanges[item.id] = {
                    ...newChanges[item.id],
                    [field]: [...existing, cleanAlias]
                };
            }
        });

        setChanges(newChanges);
        toast.success(`Added "${cleanAlias}" to category "${cName}"! Click 'Save' to apply.`);
    };

    const handleRemoveCategoryAlias = (cName: string, field: AliasField, aliasToRemove: string) => {
        const group = mappedPairsMatrix[cName];
        if (!group) return;

        const allItemsInGroup = [...group.sltItems, ...group.companyItems];
        const newChanges: Record<string, Partial<InventoryItem>> = { ...changes };

        allItemsInGroup.forEach(item => {
            const existing = newChanges[item.id]?.[field] ?? item[field] ?? [];
            if (existing.includes(aliasToRemove)) {
                newChanges[item.id] = {
                    ...newChanges[item.id],
                    [field]: existing.filter(a => a !== aliasToRemove)
                };
            }
        });

        setChanges(newChanges);
        toast.info(`Removed "${aliasToRemove}" from category "${cName}". Click 'Save' to apply.`);
    };

    const handleAutoMergeCategories = () => {
        const newChanges: Record<string, Partial<InventoryItem>> = { ...changes };
        const canonicalCategories: string[] = [];
        let mergedCount = 0;

        items.forEach(i => {
            if (!i.isOspFtth) return;
            const currentCName = (newChanges[i.id]?.commonName !== undefined ? newChanges[i.id]?.commonName : i.commonName) || i.name;
            const canonical = getCanonicalCategoryName(currentCName, canonicalCategories);

            if (!canonicalCategories.includes(canonical)) {
                canonicalCategories.push(canonical);
            }

            if (canonical !== currentCName) {
                newChanges[i.id] = {
                    ...newChanges[i.id],
                    commonName: canonical
                };
                mergedCount++;
            }
        });

        setChanges(newChanges);
        if (mergedCount > 0) {
            toast.success(`Auto-merged ${mergedCount} material items into unified Category Pairs! Click 'Save All Mappings' to commit.`);
        } else {
            toast.info("All Category Pair Names are already unified!");
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (Object.keys(changes).length > 0) {
                const updates = Object.entries(changes).map(([id, change]) => {
                    const original = items.find(i => i.id === id);
                    return {
                        id,
                        data: {
                            isOspFtth: change.isOspFtth ?? original?.isOspFtth,
                            type: change.type ?? original?.type,
                            commonName: change.commonName !== undefined ? change.commonName : original?.commonName,
                            commonFor: change.commonFor ?? original?.commonFor ?? [],
                            importAliases: change.importAliases ?? original?.importAliases ?? [],
                            scrapedAliases: change.scrapedAliases ?? original?.scrapedAliases ?? [],
                            bomAliases: change.bomAliases ?? original?.bomAliases ?? []
                        }
                    };
                });

                const res = await fetch("/api/inventory/items", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ updates })
                });
                if (!res.ok) throw new Error("Failed to update items");
            }

            await Promise.all([
                fetch("/api/admin/system-config", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ key: 'OSP_CATEGORY_ORDER', value: JSON.stringify(categoryOrder) })
                }),
                fetch("/api/admin/system-config", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ key: 'OSP_ITEM_ORDER', value: JSON.stringify(itemOrder) })
                })
            ]);

            await fetchItems();
            setChanges({});
            toast.success("Material Category Pair Mappings & Sequence saved successfully!");
        } catch (error) {
            console.error(error);
            toast.error("Error saving material code mappings.");
        } finally {
            setIsSaving(false);
        }
    };

    // Renders one alias-group editing cell (badges + add popover) for a category row
    const renderAliasCell = (
        group: { commonName: string; sltItems: InventoryItem[]; companyItems: InventoryItem[] },
        idx: number,
        field: AliasField,
        badgeClass: string,
        addLabel: string,
        placeholder: string
    ) => {
        const aliases = Array.from(new Set([
            ...group.sltItems.flatMap(i => (changes[i.id]?.[field] ?? i[field] ?? [])),
            ...group.companyItems.flatMap(i => (changes[i.id]?.[field] ?? i[field] ?? []))
        ]));

        return (
            <TableCell>
                <div className="flex flex-wrap gap-1 items-center max-w-[220px]">
                    {aliases.length > 0 ? (
                        aliases.map(alias => (
                            <Badge key={alias} variant="outline" className={cn("font-mono text-[10px] font-bold flex items-center gap-1 py-0.5", badgeClass)}>
                                {alias}
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleRemoveCategoryAlias(group.commonName, field, alias); }}
                                    className="hover:text-red-600 ml-0.5"
                                    title={`Remove ${alias}`}
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </Badge>
                        ))
                    ) : (
                        <span className="text-[11px] text-slate-400 italic">—</span>
                    )}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] text-slate-600 hover:bg-slate-100 font-bold">
                                <Plus className="w-3 h-3 mr-0.5" /> Add
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-60 p-3" align="start">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold">{addLabel}</Label>
                                <Input
                                    id={`input-${field}-${idx}`}
                                    placeholder={placeholder}
                                    className="h-8 text-xs font-mono"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleAddCategoryAlias(group.commonName, field, (e.target as HTMLInputElement).value);
                                            (e.target as HTMLInputElement).value = '';
                                        }
                                    }}
                                />
                                <p className="text-[10px] text-slate-500">Press Enter to add to every item in this group.</p>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </TableCell>
        );
    };

    if (loading) return <div className="p-8 text-center text-xs font-semibold text-slate-500">Loading material codes...</div>;

    return (
        <>
            <div className="space-y-6">
                {/* Visual Explanation Banner */}
                <div className="p-5 bg-gradient-to-r from-indigo-50 via-blue-50 to-emerald-50 rounded-2xl border border-indigo-200 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Layers className="w-5 h-5 text-indigo-600" />
                            <h3 className="text-sm font-extrabold text-indigo-950">
                                Reorderable Material Category List (SOD Completion Sequence)
                            </h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="bg-white p-1 rounded-xl border border-slate-200 flex items-center gap-1">
                                <Button
                                    size="sm"
                                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                                    onClick={() => setViewMode('table')}
                                    className={cn("h-7 px-2.5 text-xs font-bold", viewMode === 'table' && "bg-indigo-600 text-white")}
                                >
                                    <List className="w-3.5 h-3.5 mr-1" /> Category List View
                                </Button>
                                <Button
                                    size="sm"
                                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                                    onClick={() => setViewMode('grid')}
                                    className={cn("h-7 px-2.5 text-xs font-bold", viewMode === 'grid' && "bg-indigo-600 text-white")}
                                >
                                    <LayoutGrid className="w-3.5 h-3.5 mr-1" /> Grid Cards
                                </Button>
                            </div>
                        </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                        පහත <strong>Row #1, #2, #3... Category List එක</strong> මඟින් <strong>SOD Completion Sheet/Form Mode එකෙහිදී Materials සජීවීව Load වන අනුපිළිවෙල තීරණය කරයි.</strong>
                        <br />
                        ඕනෑම Row එකක් **Drag කර තවත් Row එකක් මතට Drop කිරීමෙන්** හෝ **▲ / ▼ ඊතල මඟින් (1-Click Arrow Swap)** අනුපිළිවෙල ඉතාමත් පිරිසිදුව වෙනස් කරන්න.
                    </p>
                </div>

                {/* Main Content Area: Reorderable Category List View */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <div className="p-6 border-b border-slate-100">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    Active SLT ↔ SLTS Material Category Pair List
                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-xs font-bold">
                                        {sortedCategoryGroups.length} Active Categories
                                    </Badge>
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Drag rows or use ▲/▼ arrows to reorder how material groups load during SOD completion.
                                </p>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                <Button
                                    size="sm"
                                    onClick={handleAutoMergeCategories}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 shadow-sm"
                                    title="Merge singular/plural and duplicate category name variants (Bolt & Nut <-> Bolt & Nuts, CAT 5E <-> Cable CAT5E, DW-RT <-> Drop Wire Retainer)"
                                >
                                    <Link2 className="w-4 h-4 mr-1.5" />
                                    Auto-Merge Duplicate Categories
                                </Button>

                                <Popover open={showAddExisting} onOpenChange={setShowAddExisting}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="border-emerald-200 text-emerald-700 h-9 text-xs font-bold">
                                            <Plus className="w-4 h-4 mr-1.5" />
                                            Add Item Code
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[400px] p-0" align="end">
                                        <Command>
                                            <CommandInput placeholder="Search material codes..." />
                                            <CommandEmpty>No materials found.</CommandEmpty>
                                            <CommandList className="max-h-[300px]">
                                                <CommandGroup heading="Inactive Materials">
                                                    {inactiveItems.map(item => (
                                                        <CommandItem
                                                            key={item.id}
                                                            onSelect={() => setSelectedItem(item.id)}
                                                        >
                                                            <div className="flex-1">
                                                                <div className="font-mono text-xs text-slate-500">{item.code}</div>
                                                                <div className="text-sm font-medium">{item.name}</div>
                                                            </div>
                                                            {selectedItem === item.id && (
                                                                <div className="flex gap-1">
                                                                    <Button
                                                                        size="sm"
                                                                        className="h-6 text-xs bg-blue-600"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleQuickAdd(item.id, 'SLT');
                                                                        }}
                                                                    >
                                                                        SLT Code
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        className="h-6 text-xs bg-emerald-600"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleQuickAdd(item.id, 'SLTS');
                                                                        }}
                                                                    >
                                                                        SLTS Code
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>

                                {(Object.keys(changes).length > 0 || categoryOrder.length > 0 || itemOrder.length > 0) && (
                                    <Button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 text-xs shadow-sm">
                                        {isSaving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                                        Save All Mappings
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="relative w-80">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Filter list by code or material name..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9 h-9 text-xs font-medium"
                                />
                            </div>
                        </div>

                        {/* CATEGORY ROW LIST VIEW (PRIMARY DEFAULT) */}
                        {viewMode === 'table' ? (
                            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow className="border-b border-slate-200">
                                            <TableHead className="w-[40px]"></TableHead>
                                            <TableHead className="w-[70px]">Order</TableHead>
                                            <TableHead className="w-[160px]">Common Name</TableHead>
                                            <TableHead>Item Codes (🔷 SLT / 🔶 SLTS)</TableHead>
                                            <TableHead>⚡ SLT Scraped Codes</TableHead>
                                            <TableHead>📋 SLT BOM Sheet Names</TableHead>
                                            <TableHead>🏷️ Other Aliases</TableHead>
                                            <TableHead className="w-[100px]">Pair Status</TableHead>
                                            <TableHead className="w-[90px] text-right">Reorder</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedCategoryGroups.map((group, idx) => {
                                            const isPairMapped = group.sltItems.length > 0 && group.companyItems.length > 0;
                                            const isDragging = draggedCategory === group.commonName;
                                            const isDragOver = dragOverCategory === group.commonName;

                                            return (
                                                <TableRow
                                                    key={group.commonName}
                                                    draggable
                                                    onDragStart={(e) => handleCategoryDragStart(e, group.commonName)}
                                                    onDragOver={(e) => handleCategoryDragOver(e, group.commonName)}
                                                    onDragLeave={handleCategoryDragLeave}
                                                    onDrop={(e) => handleCategoryDrop(e, group.commonName)}
                                                    className={cn(
                                                        "transition-all duration-150 cursor-move hover:bg-slate-50/80 border-b border-slate-100",
                                                        isDragging && "opacity-40 bg-indigo-50/40 border-dashed border-indigo-400",
                                                        isDragOver && "bg-indigo-50/80 border-indigo-400 ring-1 ring-indigo-500"
                                                    )}
                                                >
                                                    <TableCell className="px-2">
                                                        <div className="cursor-grab active:cursor-grabbing p-1.5 rounded-lg hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 transition-colors">
                                                            <GripVertical className="w-4 h-4" />
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-mono font-extrabold text-xs">
                                                            #{idx + 1}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="font-extrabold text-xs text-slate-900">
                                                        {group.commonName}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs">
                                                        <div className="space-y-1">
                                                            {group.sltItems.map(item => (
                                                                <div key={item.id} className="flex items-center gap-1.5">
                                                                    <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 font-bold">
                                                                        🔷 {item.code}
                                                                    </Badge>
                                                                    <span className="text-[11px] text-slate-600 font-sans font-medium truncate max-w-[160px]">{item.name}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => { e.stopPropagation(); handleEditClick(item); }}
                                                                        className="text-slate-400 hover:text-blue-600 ml-1"
                                                                    >
                                                                        <Edit2 className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                            {group.companyItems.map(item => (
                                                                <div key={item.id} className="flex items-center gap-1.5">
                                                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 font-bold">
                                                                        🔶 {item.code}
                                                                    </Badge>
                                                                    <span className="text-[11px] text-slate-600 font-sans font-medium truncate max-w-[160px]">{item.name}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => { e.stopPropagation(); handleEditClick(item); }}
                                                                        className="text-slate-400 hover:text-emerald-600 ml-1"
                                                                    >
                                                                        <Edit2 className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                            {group.sltItems.length === 0 && group.companyItems.length === 0 && (
                                                                <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    {renderAliasCell(group, idx, 'scrapedAliases', "bg-purple-50 text-purple-800 border-purple-200", "Add SLT Scraped Code", "e.g. DW-2C (from SLT extension)")}
                                                    {renderAliasCell(group, idx, 'bomAliases', "bg-sky-50 text-sky-800 border-sky-200", "Add SLT BOM Sheet Name", "e.g. DROP WIRE 2 CORE")}
                                                    {renderAliasCell(group, idx, 'importAliases', "bg-slate-100 text-slate-700 border-slate-300", "Add Other Alias", "e.g. F1, DWIRE")}
                                                    <TableCell>
                                                        {isPairMapped ? (
                                                            <Badge className="bg-emerald-600 text-white font-bold text-[10px]">
                                                                Mapped Pair ✅
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 font-bold text-[10px]">
                                                                Single Code ⚠️
                                                            </Badge>
                                                        )}
                                                    </TableCell>

                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button
                                                                type="button"
                                                                disabled={idx === 0}
                                                                onClick={() => moveCategory(group.commonName, 'up')}
                                                                className="p-1 hover:bg-slate-200 rounded text-slate-600 disabled:opacity-30"
                                                                title="Move Row Up"
                                                            >
                                                                <ChevronUp className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={idx === sortedCategoryGroups.length - 1}
                                                                onClick={() => moveCategory(group.commonName, 'down')}
                                                                className="p-1 hover:bg-slate-200 rounded text-slate-600 disabled:opacity-30"
                                                                title="Move Row Down"
                                                            >
                                                                <ChevronDown className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            /* GRID CARDS VIEW MODE */
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                {sortedCategoryGroups.map((group, idx) => {
                                    const isPairMapped = group.sltItems.length > 0 && group.companyItems.length > 0;
                                    const isDragging = draggedCategory === group.commonName;
                                    const isDragOver = dragOverCategory === group.commonName;

                                    return (
                                        <div
                                            key={group.commonName}
                                            draggable
                                            onDragStart={(e) => handleCategoryDragStart(e, group.commonName)}
                                            onDragOver={(e) => handleCategoryDragOver(e, group.commonName)}
                                            onDragLeave={handleCategoryDragLeave}
                                            onDrop={(e) => handleCategoryDrop(e, group.commonName)}
                                            className={cn(
                                                "p-5 rounded-2xl border bg-white transition-all duration-150 space-y-4 relative border-slate-200 hover:border-indigo-400 hover:shadow-md",
                                                isDragging && "opacity-40 border-dashed border-indigo-600 bg-indigo-50/30 scale-95 cursor-grabbing",
                                                isDragOver && "ring-2 ring-indigo-500 scale-[1.02] shadow-lg border-indigo-500 bg-indigo-50/40"
                                            )}
                                        >
                                            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <div className="cursor-grab active:cursor-grabbing p-1.5 rounded-lg hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 transition-colors">
                                                        <GripVertical className="w-4 h-4" />
                                                    </div>
                                                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-mono font-extrabold text-xs">
                                                        Card #{idx + 1}
                                                    </Badge>
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
                                                        <button
                                                            type="button"
                                                            disabled={idx === 0}
                                                            onClick={() => moveCategory(group.commonName, 'up')}
                                                            className="p-1 hover:bg-white rounded text-slate-500 hover:text-indigo-600 disabled:opacity-30"
                                                            title="Move Up"
                                                        >
                                                            <ChevronUp className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={idx === sortedCategoryGroups.length - 1}
                                                            onClick={() => moveCategory(group.commonName, 'down')}
                                                            className="p-1 hover:bg-white rounded text-slate-500 hover:text-indigo-600 disabled:opacity-30"
                                                            title="Move Down"
                                                        >
                                                            <ChevronDown className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>

                                                    {isPairMapped ? (
                                                        <Badge className="bg-emerald-600 text-white font-bold text-[10px] h-5 px-2">
                                                            Mapped Pair ✅
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 font-bold text-[10px] h-5 px-2">
                                                            Single Code ⚠️
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                                                    {group.commonName}
                                                </h3>
                                                <p className="text-[11px] text-slate-400 mt-0.5">Unified SOD Category Group</p>
                                            </div>

                                            <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono text-xs">
                                                <div className="flex items-start justify-between gap-2">
                                                    <span className="text-[10px] font-bold text-blue-700 uppercase shrink-0">SLT Code:</span>
                                                    <div className="text-right">
                                                        {group.sltItems.length > 0 ? (
                                                            group.sltItems.map(item => (
                                                                <div key={item.id} className="flex items-center gap-1 justify-end">
                                                                    <span className="font-bold text-blue-900">{item.code}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => { e.stopPropagation(); handleEditClick(item); }}
                                                                        className="text-slate-400 hover:text-blue-600"
                                                                    >
                                                                        <Edit2 className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <span className="text-[10px] text-slate-400 italic font-normal">Unassigned</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-start justify-between gap-2 border-t pt-1.5 border-slate-200/60">
                                                    <span className="text-[10px] font-bold text-emerald-700 uppercase shrink-0">SLTS Code:</span>
                                                    <div className="text-right">
                                                        {group.companyItems.length > 0 ? (
                                                            group.companyItems.map(item => (
                                                                <div key={item.id} className="flex items-center gap-1 justify-end">
                                                                    <span className="font-bold text-emerald-900">{item.code}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => { e.stopPropagation(); handleEditClick(item); }}
                                                                        className="text-slate-400 hover:text-emerald-600"
                                                                    >
                                                                        <Edit2 className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <span className="text-[10px] text-slate-400 italic font-normal">Unassigned</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Edit Material Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-slate-900">Map Common Group Name</DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Assign a Common Group Name to pair this Item Code with its SLT/SLTS counterpart.
                        </DialogDescription>
                    </DialogHeader>

                    {editingItem && (
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="commonName" className="text-xs font-bold text-slate-700">
                                    Common Group Name
                                    <span className="text-[11px] text-slate-400 font-normal ml-2">(e.g. "Drop Wire Cable", "ONT Router")</span>
                                </Label>
                                <Input
                                    id="commonName"
                                    value={editingItem.commonName || ''}
                                    onChange={(e) => setEditingItem({ ...editingItem, commonName: e.target.value })}
                                    placeholder="Select or type common group name..."
                                    list="common-names-list"
                                    className="h-9 text-xs font-bold"
                                />
                                <datalist id="common-names-list">
                                    {uniqueCommonNames.map(name => (
                                        <option key={name} value={name} />
                                    ))}
                                </datalist>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 space-y-1">
                                <p className="font-extrabold flex items-center gap-1.5">
                                    <Info className="w-4 h-4 text-blue-600" /> Mapping Tip:
                                </p>
                                <p className="text-[11px] text-blue-800 leading-normal">
                                    Giving the EXACT SAME Common Group Name (e.g. "Drop Wire Cable") to both an SLT Code and an SLTS Code links them as a <strong>Mapped Pair ✅</strong> in SOD Completion reports!
                                </p>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setShowEditDialog(false);
                                setEditingItem(null);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleSaveEdit} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                            Save Group Mapping
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
