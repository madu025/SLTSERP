"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Edit2, Trash2, AlertTriangle, CheckSquare, Layers, Tag, Package, RotateCcw, ChevronRight, Target } from "lucide-react";

interface Item {
    id: string;
    code: string;
    sltCode?: string;
    name: string;
    commonName?: string;
    unit: string;
    type: 'SLT' | 'SLTS';
    category: string;
    minLevel?: string | number;
    unitPrice?: number;
    costPrice?: number;
}

interface ItemTableProps {
    items: Item[];
    isLoading: boolean;
    searchTerm: string;
    onSearchChange: (val: string) => void;
    categoryFilter: string;
    onCategoryFilterChange: (val: string) => void;
    selectedIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onToggleSelectAll: () => void;
    onEdit: (item: Item) => void;
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
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
                <div className="space-y-1">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Material Registry</h1>
                    <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 uppercase tracking-widest opacity-80">
                        <Package className="w-3.5 h-3.5" /> High-Fidelity Global Catalog
                    </p>
                </div>
                <Button size="sm" onClick={onAdd} className="h-11 px-8 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 transition-all hover:-translate-y-1">
                    <Plus className="w-4 h-4 mr-2" /> Register New Entity
                </Button>
            </div>

            <div className="bg-white rounded-[40px] border-none shadow-2xl shadow-slate-200/50 overflow-hidden flex flex-col min-h-[600px] border border-white/20">
                {/* TOOLBAR CONTROLLER */}
                {selectedIds.size > 0 ? (
                    <div className="px-10 py-6 border-b flex justify-between items-center bg-blue-600/5 animate-in slide-in-from-top-4 duration-500 scale-in shadow-inner">
                        <div className="flex items-center gap-8">
                            <div className="relative">
                                <span className="text-sm font-black text-blue-700 flex items-center gap-3">
                                    <CheckSquare className="w-5 h-5" />
                                    {selectedIds.size} ENTITIES TARGETED
                                </span>
                                <div className="absolute -bottom-1 left-8 w-1/2 h-0.5 bg-blue-400 rounded-full animate-pulse" />
                            </div>
                            
                            <div className="flex gap-3">
                                <Button onClick={() => onBulkEdit('TYPE')} variant="outline" className="h-10 bg-white border-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-sm transition-all hover:scale-105 active:scale-95">
                                    <Target className="w-3.5 h-3.5 mr-2" /> Sync Type
                                </Button>
                                <Button onClick={() => onBulkEdit('CATEGORY')} variant="outline" className="h-10 bg-white border-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-sm transition-all hover:scale-105 active:scale-95">
                                    <Tag className="w-3.5 h-3.5 mr-2" /> Recalibrate Cluster
                                </Button>

                                {selectedIds.size === 2 && (
                                    <Button onClick={onMerge} variant="outline" className="h-10 bg-emerald-600 border-none text-white hover:bg-emerald-700 font-black text-xs uppercase tracking-widest rounded-xl shadow-xl shadow-emerald-100 transition-all hover:scale-105 active:scale-95">
                                        <RotateCcw className="w-3.5 h-3.5 mr-2" /> Merge Duplicates
                                    </Button>
                                )}
                            </div>
                        </div>
                        <Button variant="ghost" onClick={onToggleSelectAll} className="h-10 px-6 rounded-xl text-blue-600 font-black text-xs uppercase hover:bg-white border-none">
                            Relinquish target(s)
                        </Button>
                    </div>
                ) : (
                    <div className="px-10 py-8 border-b flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-50/20">
                        <div className="flex flex-col md:flex-row items-center gap-4 flex-1 w-full">
                            <div className="relative flex-1 w-full max-w-md group">
                                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5 transition-colors group-focus-within:text-blue-500" />
                                <Input
                                    placeholder="Execute search by codename, serial or label..."
                                    value={searchTerm}
                                    onChange={e => onSearchChange(e.target.value)}
                                    className="pl-12 h-11 bg-white border-slate-100 rounded-2xl text-xs font-bold transition-all focus:ring-4 focus:ring-blue-100/50 shadow-sm"
                                />
                            </div>
                            <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
                                <SelectTrigger className="h-11 w-full md:w-[240px] bg-white border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm">
                                    <SelectValue placeholder="Cluster Selection" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-none shadow-2xl">
                                    <SelectItem value="ALL" className="text-xs font-bold">ALL CLUSTERS</SelectItem>
                                    {['CABLES', 'POLES', 'FIBER_ACCESSORIES', 'COPPER_ACCESSORIES', 'HARDWARE', 'EQUIPMENT', 'OTHERS'].map(c => (
                                        <SelectItem key={c} value={c} className="text-xs font-bold">{c.replace('_', ' ')}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-4 bg-slate-100/50 px-5 py-2.5 rounded-2xl border border-slate-100">
                             <div className="text-right">
                                <p className="text-[10px] font-black uppercase text-slate-400 opacity-60">Sequence Index</p>
                                <p className="text-xs font-black text-slate-900">{filteredItems.length} Entities</p>
                             </div>
                             <div className="h-8 w-[1px] bg-slate-200" />
                             <Layers className="w-5 h-5 text-slate-400" />
                        </div>
                    </div>
                )}

                {/* HIGH PERFORMANCE DATA GRID */}
                <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b sticky top-0 backdrop-blur-sm z-10 transition-all">
                            <tr>
                                <th className="px-10 py-6 w-[80px]">
                                    <div className="flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            className="appearance-none h-5 w-5 rounded-lg border-2 border-slate-200 checked:bg-slate-900 checked:border-slate-900 focus:outline-none transition-all cursor-pointer hover:border-slate-400 relative checked:after:content-['✓'] checked:after:absolute checked:after:text-white checked:after:text-xs checked:after:font-black checked:after:flex checked:after:items-center checked:after:justify-center checked:after:inset-0"
                                            checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                                            onChange={onToggleSelectAll}
                                        />
                                    </div>
                                </th>
                                <th className="px-6 py-6 min-w-[150px]">Sequence Code</th>
                                <th className="px-6 py-6 min-w-[280px]">Product Identity</th>
                                <th className="px-6 py-6">Unit / Specs</th>
                                <th className="px-6 py-6">Audit Status</th>
                                <th className="px-6 py-6 text-right">Settlement Rate</th>
                                <th className="px-10 py-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={7} className="px-10 py-8 bg-slate-50/20 h-[80px]">
                                            <div className="h-4 bg-slate-100 rounded-full w-full opacity-50" />
                                        </td>
                                    </tr>
                                ))
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-10 py-32 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-4 opacity-30">
                                            <Package className="w-16 h-16 stroke-[1]" />
                                            <p className="text-sm font-black uppercase tracking-widest">No matching entities found in the local index.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item) => (
                                    <tr key={item.id} className={`group hover:bg-slate-50/80 transition-all duration-300 ${selectedIds.has(item.id) ? 'bg-blue-50/30' : ''}`}>
                                        <td className="px-10 py-5">
                                            <div className="flex items-center justify-center">
                                                <input
                                                    type="checkbox"
                                                    className="appearance-none h-5 w-5 rounded-lg border-2 border-slate-200 checked:bg-blue-600 checked:border-blue-600 focus:outline-none transition-all cursor-pointer hover:border-blue-400 relative checked:after:content-['✓'] checked:after:absolute checked:after:text-white checked:after:text-xs checked:after:font-black checked:after:flex checked:after:items-center checked:after:justify-center checked:after:inset-0"
                                                    checked={selectedIds.has(item.id)}
                                                    onChange={() => onToggleSelect(item.id)}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-mono text-[11px] font-black p-1 bg-slate-100 rounded text-slate-600 px-2 tracking-tighter">{item.code}</span>
                                                {item.sltCode && <span className="text-[10px] font-black text-slate-400 opacity-60 tracking-wider">REF: {item.sltCode}</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="space-y-0.5">
                                                <p className="text-[13px] font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{item.name}</p>
                                                <p className="text-[10px] font-semibold text-slate-500 flex items-center gap-1.5 line-clamp-1 opacity-70 italic uppercase">
                                                    {item.commonName || 'Unspecified Classification'}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-1">
                                                <Badge variant="outline" className="w-fit text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-slate-200 text-slate-500 bg-white shadow-sm">
                                                    {item.unit} Scaling
                                                </Badge>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-60">{categoryLabel(item.category)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-2">
                                                    {item.type === 'SLT' ? (
                                                        <div className="h-5 px-3 rounded-full bg-blue-100 border border-blue-200 text-blue-600 text-[9px] font-bold flex items-center justify-center uppercase tracking-widest">Global Asset</div>
                                                    ) : (
                                                        <div className="h-5 px-3 rounded-full bg-purple-100 border border-purple-200 text-purple-600 text-[9px] font-bold flex items-center justify-center uppercase tracking-widest">Internal Resource</div>
                                                    )}
                                                </div>
                                                {item.minLevel ? (
                                                    <div className={`flex items-center gap-1.5 text-[10px] font-black ${Number(item.minLevel) > 0 ? 'text-orange-600' : 'text-slate-300'}`}>
                                                        <AlertTriangle className="w-3 h-3" /> THRESHOLD: {item.minLevel}
                                                    </div>
                                                ) : <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Monitoring Offline</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="space-y-1">
                                                <p className="text-sm font-black text-slate-900">LKR {item.unitPrice?.toLocaleString()}</p>
                                                <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest opacity-60">COST: {item.costPrice?.toLocaleString()}</p>
                                            </div>
                                        </td>
                                        <td className="px-10 py-5 text-right">
                                            <div className="flex justify-end items-center gap-4 opacity-0 group-hover:opacity-100 transition-all duration-300 scale-95 group-hover:scale-100">
                                                <button onClick={() => onEdit(item)} className="p-2.5 rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-200/50 transition-all group/btn active:scale-95">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => onDelete(item.id)} className="p-2.5 rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-red-600 hover:border-red-100 hover:shadow-xl hover:shadow-red-200/50 transition-all group/btn active:scale-95">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-10 py-6 border-t bg-slate-50/30 flex items-center justify-between">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        Live Registry Interface Active
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-60 italic">
                         Registry sequence synchronized at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </div>
        </div>
    );
}

