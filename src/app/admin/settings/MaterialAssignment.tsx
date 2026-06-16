"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search, Save, Loader2, Plus, X, Edit2, Tag, GripVertical } from "lucide-react";
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
    isOspFtth: boolean;
    type: string;
    isWastageAllowed?: boolean;
}

interface EditingItem {
    id: string;
    commonName: string;
    tags: string[];
}

export function MaterialAssignment() {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [changes, setChanges] = useState<Record<string, Partial<InventoryItem>>>({});
    const [itemOrder, setItemOrder] = useState<string[]>([]); // New state for order
    const [draggedId, setDraggedId] = useState<string | null>(null);

    const [showAddExisting, setShowAddExisting] = useState(false);
    const [selectedItem, setSelectedItem] = useState<string>("");

    const [showEditDialog, setShowEditDialog] = useState(false);
    const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
    const [tagInput, setTagInput] = useState("");

    // Memoize unique common names for suggestions
    const uniqueCommonNames = useMemo(() => {
        const names = new Set<string>();
        items.forEach(i => {
            // Check both original items and pending changes
            const changedName = changes[i.id]?.commonName;
            const name = changedName !== undefined ? changedName : i.commonName;
            if (name) names.add(name);
        });
        return Array.from(names).sort();
    }, [items, changes]);

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        try {
            const [resItems, resConfig] = await Promise.all([
                fetch("/api/inventory/items"),
                fetch("/api/admin/system-config")
            ]);

            const data = await resItems.json();
            const config = await resConfig.json();

            if (Array.isArray(data)) {
                setItems(data);
            }
            if (config['OSP_ITEM_ORDER']) {
                try {
                    setItemOrder(JSON.parse(config['OSP_ITEM_ORDER']));
                } catch (e) { console.error("Failed to parse order", e); }
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setLoading(false);
        }
    };

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

    activeItems.sort((a, b) => {
        const idxA = itemOrder.indexOf(a.id);
        const idxB = itemOrder.indexOf(b.id);

        // If both present in custom order, sort by index
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;

        // Fallback to name
        const nameA = (changes[a.id]?.commonName ?? a.commonName ?? a.name).toLowerCase();
        const nameB = (changes[b.id]?.commonName ?? b.commonName ?? b.name).toLowerCase();
        return nameA.localeCompare(nameB);
    });

    // DnD Handling
    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedId(id);
        e.dataTransfer.effectAllowed = "move";
        // Ghost image transparency if needed
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedId || draggedId === targetId) return;

        // Reorder itemOrder array
        const currentOrder = [...itemOrder];

        // Ensure both IDs are in the array (handle un-ordered items)
        if (!currentOrder.includes(draggedId)) currentOrder.push(draggedId);
        if (!currentOrder.includes(targetId)) currentOrder.push(targetId);

        const fromIdx = currentOrder.indexOf(draggedId);
        const toIdx = currentOrder.indexOf(targetId);

        currentOrder.splice(fromIdx, 1);
        currentOrder.splice(toIdx, 0, draggedId);

        setItemOrder(currentOrder);
        setDraggedId(null);

        // Mark as having changes so Save button appears?
        // Actually we might need a separate "Order Changed" state or just check diff?
        // Easy hack: set a fake change or just rely on 'itemOrder' existing.
        // But the Save Button condition checks `Object.keys(changes).length > 0`.
        // I will update Save Button condition slightly.
    };

    const handleOrderChange = (id: string, newPosStr: string) => {
        const newPos = parseInt(newPosStr);
        if (isNaN(newPos)) return; // Or handle empty string to remove order?

        const currentOrder = [...itemOrder];

        // Ensure current item is tracked
        if (!currentOrder.includes(id)) currentOrder.push(id);

        const oldIdx = currentOrder.indexOf(id);
        if (oldIdx > -1) currentOrder.splice(oldIdx, 1);

        let targetIdx = newPos - 1;
        if (targetIdx < 0) targetIdx = 0;
        if (targetIdx > currentOrder.length) targetIdx = currentOrder.length;

        currentOrder.splice(targetIdx, 0, id);

        setItemOrder(currentOrder);
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

    const handleAddTag = () => {
        if (!editingItem || !tagInput.trim()) return;
        const tag = tagInput.trim().toUpperCase();
        if (!editingItem.tags.includes(tag)) {
            setEditingItem({
                ...editingItem,
                tags: [...editingItem.tags, tag]
            });
        }
        setTagInput("");
    };

    const handleRemoveTag = (tag: string) => {
        if (!editingItem) return;
        setEditingItem({
            ...editingItem,
            tags: editingItem.tags.filter(t => t !== tag)
        });
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

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Save Item changes
            if (Object.keys(changes).length > 0) {
                const updates = Object.entries(changes).map(([id, change]) => {
                    const original = items.find(i => i.id === id);
                    return {
                        id,
                        isOspFtth: change.isOspFtth ?? original?.isOspFtth,
                        type: change.type ?? original?.type,
                        commonName: change.commonName !== undefined ? change.commonName : original?.commonName,
                        tags: change.commonFor ?? original?.commonFor ?? []
                    };
                });

                await fetch("/api/inventory/items", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ updates })
                });
            }

            // Save Order Config
            await fetch("/api/admin/system-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: 'OSP_ITEM_ORDER', value: JSON.stringify(itemOrder) })
            });

            await fetchItems();
            setChanges({});
            alert("Changes saved!");
        } catch (error) {
            console.error(error);
            alert("Error saving changes.");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <>
            <div className="bg-white rounded-lg border shadow-sm mt-6">
                <div className="p-6 border-b">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h2 className="text-lg font-semibold">OSP FTTH Material Assignment</h2>
                            <p className="text-sm text-slate-500 mt-1">
                                Manage materials for Quick Add in SOD Completion.
                            </p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <Popover open={showAddExisting} onOpenChange={setShowAddExisting}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="border-emerald-200 text-emerald-700">
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Existing
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0" align="end">
                                    <Command>
                                        <CommandInput placeholder="Search materials..." />
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
                                                                    SLT
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    className="h-6 text-xs bg-emerald-600"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleQuickAdd(item.id, 'SLTS');
                                                                    }}
                                                                >
                                                                    Company
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

                            {(Object.keys(changes).length > 0 || itemOrder.length > 0) && (
                                <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600">
                                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                    Save
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold text-slate-900">Quick Add Materials (main)</h3>
                            <p className="text-xs text-slate-500">{activeItems.length} materials enabled</p>
                        </div>
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 h-9"
                            />
                        </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="w-[40px]"></TableHead>
                                        <TableHead className="w-[60px]">Order</TableHead>
                                        <TableHead className="w-[120px]">Code</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead className="w-[140px]">Common Name</TableHead>
                                        <TableHead className="w-[80px]">Wastage</TableHead>
                                        <TableHead className="w-[120px]">Source</TableHead>
                                        <TableHead className="w-[120px]">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {activeItems.map(item => {
                                        const current = changes[item.id] || {};
                                        const currentType = current.type ?? item.type;
                                        const commonName = current.commonName !== undefined ? current.commonName : item.commonName;
                                        const tags = current.commonFor ?? item.commonFor ?? [];
                                        const isChanged = changes[item.id] !== undefined;

                                        return (
                                            <TableRow
                                                key={item.id}
                                                className={cn(isChanged && "bg-blue-50/30", "group/row")}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, item.id)}
                                                onDragOver={handleDragOver}
                                                onDrop={(e) => handleDrop(e, item.id)}
                                            >
                                                <TableCell className="px-2">
                                                    <div className="cursor-move p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-500">
                                                        <GripVertical className="w-4 h-4" />
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        className="h-7 w-12 text-center px-1"
                                                        value={itemOrder.indexOf(item.id) !== -1 ? itemOrder.indexOf(item.id) + 1 : ''}
                                                        onChange={(e) => handleOrderChange(item.id, e.target.value)}
                                                    />
                                                </TableCell>
                                                <TableCell className="font-mono text-xs font-medium text-slate-600">
                                                    {item.code}
                                                </TableCell>
                                                <TableCell className="text-sm">{item.name}</TableCell>
                                                <TableCell className="text-xs text-slate-600">
                                                    {commonName || <span className="text-slate-400 italic">None</span>}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex justify-center">
                                                        <Checkbox
                                                            checked={current.isWastageAllowed ?? item.isWastageAllowed ?? true}
                                                            onCheckedChange={(checked) => handleChange(item.id, { isWastageAllowed: !!checked })}
                                                            className="data-[state=checked]:bg-blue-600 border-slate-300"
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Select
                                                        value={currentType === 'SLT' ? 'SLT' : 'SLTS'}
                                                        onValueChange={(val) => handleChange(item.id, { type: val })}
                                                    >
                                                        <SelectTrigger className="h-7 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="SLT">SLT</SelectItem>
                                                            <SelectItem value="SLTS">Company</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 px-2 text-xs"
                                                            onClick={() => handleEditClick(item)}
                                                        >
                                                            <Edit2 className="w-3 h-3" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
                                                            onClick={() => handleChange(item.id, { isOspFtth: false })}
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Material Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Edit Material Details</DialogTitle>
                        <DialogDescription>
                            Set common name and tags for reporting and grouping.
                        </DialogDescription>
                    </DialogHeader>

                    {editingItem && (
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="commonName">
                                    Common Name
                                    <span className="text-xs text-slate-500 ml-2">(Group Header)</span>
                                </Label>
                                <Input
                                    id="commonName"
                                    value={editingItem.commonName || ''}
                                    onChange={(e) => setEditingItem({ ...editingItem, commonName: e.target.value })}
                                    placeholder="Select or type common name..."
                                    list="common-names-list"
                                />
                                <datalist id="common-names-list">
                                    {uniqueCommonNames.map(name => (
                                        <option key={name} value={name} />
                                    ))}
                                </datalist>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800">
                                <p className="font-semibold mb-1">Grouping Example:</p>
                                <ul className="list-disc list-inside space-y-0.5">
                                    <li>Give the same Common Name (e.g. "Drop Wire") to both SLT and Company items to group them together.</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowEditDialog(false);
                                setEditingItem(null);
                                setTagInput("");
                            }}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleSaveEdit} className="bg-blue-600">
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
