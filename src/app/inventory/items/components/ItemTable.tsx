"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Edit2, Trash2, AlertTriangle, CheckSquare, Layers, Tag, Package, RotateCcw, Target } from "lucide-react";
import { InventoryItem } from "@/types/inventory";

interface ItemTableProps {
    items: InventoryItem[];
    isLoading: boolean;
    searchTerm: string;
    onSearchChange: (val: string) => void;
    categoryFilter: string;
    onCategoryFilterChange: (val: string) => void;
    selectedIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onToggleSelectAll: () => void;
    onEdit: (item: InventoryItem) => void;
    onDelete: (id: string) => void;
    onAdd: () => void;
    onBulkEdit: (type: 'CATEGORY' | 'JOB_TYPE' | 'TYPE') => void;
    onMerge: () => void;
}

export function ItemTable({
    items, isLoading, searchTerm, onSearchChange, categoryFilter, onCategoryFilterChange,
    selectedIds, onToggleSelect, onToggleSelectAll, onEdit, onDelete, onAdd, onBulkEdit, onMerge
}: ItemTableProps) {

    const filteredItems = items.filter((i) =>
        (categoryFilter === "ALL" || i.category === categoryFilter) &&
        (i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            i.code.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const categoryLabel = (cat: string) => cat ? cat.replace(/_/g, ' ') : '-';

    return (
        <div className="space-y-4">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="space-y-0.5">
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">Item Master List</h1>
                    <p className="text-xs text-slate-500">Manage all inventory materials and parts</p>
                </div>
                <Button size="sm" onClick={onAdd} className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm">
                    <Plus className="w-3.5 h-3.5" /> Add New Item
                </Button>
            </div>

            <div className="erp-table-container flex flex-col bg-white overflow-hidden">
                {/* TOOLBAR CONTROLLER */}
                {selectedIds.size > 0 ? (
                    <div className="px-4 py-2 border-b flex justify-between items-center bg-blue-50/50 animate-in slide-in-from-top-4 duration-300">
                        <div className="flex items-center gap-4">
                            <span className="text-xs font-bold text-blue-700 flex items-center gap-2">
                                <CheckSquare className="w-4 h-4" />
                                {selectedIds.size} selected
                            </span>
                            
                            <div className="flex gap-2">
                                <Button onClick={() => onBulkEdit('TYPE')} variant="outline" size="sm" className="h-7 px-2.5 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-[11px] rounded-md border border-slate-200">
                                    <Target className="w-3 h-3 mr-1 text-slate-400" /> Change Type
                                </Button>
                                <Button onClick={() => onBulkEdit('CATEGORY')} variant="outline" size="sm" className="h-7 px-2.5 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-[11px] rounded-md border border-slate-200">
                                    <Tag className="w-3 h-3 mr-1 text-slate-400" /> Change Category
                                </Button>

                                {selectedIds.size === 2 && (
                                    <Button onClick={onMerge} variant="outline" size="sm" className="h-7 px-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-semibold text-[11px] rounded-md">
                                        <RotateCcw className="w-3 h-3 mr-1" /> Merge Duplicates
                                    </Button>
                                )}
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={onToggleSelectAll} className="h-7 px-3 text-slate-500 font-semibold text-xs hover:text-slate-700">
                            Deselect All
                        </Button>
                    </div>
                ) : (
                    <div className="px-4 py-3 border-b flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/40">
                        <div className="flex flex-col md:flex-row items-center gap-3 flex-1 w-full">
                            <div className="relative flex-1 w-full max-w-md">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                                <Input
                                    placeholder="Search by name or code..."
                                    value={searchTerm}
                                    onChange={e => onSearchChange(e.target.value)}
                                    className="pl-9 h-8 bg-white border-slate-200 rounded-lg text-xs font-medium"
                                />
                            </div>
                            <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
                                <SelectTrigger className="h-8 w-full md:w-[200px] bg-white border-slate-200 rounded-lg text-xs font-semibold text-slate-700">
                                    <SelectValue placeholder="Filter by Category" />
                                </SelectTrigger>
                                <SelectContent className="rounded-lg border border-slate-200">
                                    <SelectItem value="ALL" className="text-xs font-medium">All Categories</SelectItem>
                                    {['CABLES', 'POLES', 'FIBER_ACCESSORIES', 'COPPER_ACCESSORIES', 'HARDWARE', 'EQUIPMENT', 'OTHERS'].map(c => (
                                        <SelectItem key={c} value={c} className="text-xs font-medium">{c.replace('_', ' ')}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-3 px-3 py-1 bg-slate-100/60 rounded-lg border border-slate-100 text-xs font-medium text-slate-600">
                             <span>{filteredItems.length} items found</span>
                             <Layers className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                    </div>
                )}

                {/* HIGH PERFORMANCE DATA GRID */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[900px] text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-2 w-[40px] text-center">
                                    <input
                                        type="checkbox"
                                        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                                        onChange={onToggleSelectAll}
                                    />
                                </th>
                                <th className="px-3 py-2 font-semibold">Item Code</th>
                                <th className="px-3 py-2 font-semibold min-w-[250px]">Item Name / Description</th>
                                <th className="px-3 py-2 font-semibold">Unit of Measure</th>
                                <th className="px-3 py-2 font-semibold">Item Type</th>
                                <th className="px-3 py-2 font-semibold text-right">Unit Price</th>
                                <th className="px-4 py-2 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={7} className="px-4 py-3 h-10">
                                            <div className="h-3 bg-slate-100 rounded w-full opacity-60" />
                                        </td>
                                    </tr>
                                ))
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-16 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2 opacity-50">
                                            <Package className="w-10 h-10 stroke-[1.5]" />
                                            <p className="text-xs font-semibold">No items found matching your search.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item) => (
                                    <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors duration-150 ${selectedIds.has(item.id) ? 'bg-blue-50/20' : ''}`}>
                                        <td className="px-4 py-1.5 text-center">
                                            <input
                                                type="checkbox"
                                                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                checked={selectedIds.has(item.id)}
                                                onChange={() => onToggleSelect(item.id)}
                                            />
                                        </td>
                                        <td className="px-3 py-1.5">
                                            <div className="flex flex-col">
                                                <span className="font-mono text-[11px] font-semibold text-slate-700">{item.code}</span>
                                                {item.sltCode && <span className="text-[9px] text-slate-400">REF: {item.sltCode}</span>}
                                            </div>
                                        </td>
                                        <td className="px-3 py-1.5">
                                            <div className="space-y-0.5">
                                                <p className="font-semibold text-slate-900 text-xs tracking-tight">{item.name}</p>
                                                <p className="text-[10px] text-slate-500 line-clamp-1 italic">
                                                    {item.commonName || 'No common name'}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-3 py-1.5">
                                            <div className="flex flex-col">
                                                <Badge variant="outline" className="w-fit text-[9px] font-semibold uppercase px-1.5 py-0 border-slate-200 text-slate-600 bg-white">
                                                    {item.unit}
                                                </Badge>
                                                <span className="text-[9px] text-slate-400 mt-0.5">{categoryLabel(item.category)}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-1.5">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-1">
                                                    {item.type === 'SLT' ? (
                                                        <span className="inline-flex items-center px-1.5 py-0.25 rounded text-[9px] font-medium bg-blue-50 text-blue-700 border border-blue-100">SLT</span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-1.5 py-0.25 rounded text-[9px] font-medium bg-purple-50 text-purple-700 border border-purple-100">SLTS</span>
                                                    )}
                                                </div>
                                                 {item.minLevel ? (
                                                     <div className={`flex items-center gap-1 text-[9px] font-medium ${Number(item.minLevel) > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                                         <AlertTriangle className="w-2.5 h-2.5" /> min: {Number(item.minLevel)}
                                                     </div>
                                                 ) : null}
                                             </div>
                                         </td>
                                         <td className="px-3 py-1.5 text-right font-mono">
                                             <div className="space-y-0.5">
                                                 <p className="font-semibold text-slate-900">LKR {Number(item.unitPrice)?.toLocaleString()}</p>
                                                 <p className="text-[9px] text-slate-400">Cost: {Number(item.costPrice)?.toLocaleString()}</p>
                                             </div>
                                         </td>
                                        <td className="px-4 py-1.5 text-right">
                                            <div className="flex justify-end items-center gap-1">
                                                <Button size="icon" variant="ghost" onClick={() => onEdit(item)} className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md">
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button size="icon" variant="ghost" onClick={() => onDelete(item.id)} className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-4 py-2 border-t bg-slate-50/50 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                    <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Connected to Inventory Database
                    </div>
                    <div>
                         Last updated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </div>
        </div>
    );
}

