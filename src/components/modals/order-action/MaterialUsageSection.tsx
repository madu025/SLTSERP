"use client";

import React from "react";
import { Plus, X, RotateCcw, Activity, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MaterialUsageRow, InventoryItem } from "./types";

interface MaterialUsageSectionProps {
    rows: MaterialUsageRow[];
    onAddRow: () => void;
    onQuickAdd: (item: InventoryItem) => void;
    onUpdateRow: (index: number, field: keyof MaterialUsageRow, value: string) => void;
    onRemoveRow: (index: number) => void;
    onPortalImport: () => void;
    onApplyPreset: (type: 'STANDARD' | 'CLEAR') => void;
    items: InventoryItem[];
    quickItems: Array<{ label: string; item: InventoryItem }>;
    materialSource: string;
}

export function MaterialUsageSection({
    rows,
    onAddRow,
    onQuickAdd,
    onUpdateRow,
    onRemoveRow,
    onPortalImport,
    onApplyPreset,
    items,
    quickItems,
    materialSource
}: MaterialUsageSectionProps) {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium text-slate-800 text-sm">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    <span>Material Usage & Consumption</span>
                </div>
                <div className="flex gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={onPortalImport}
                        className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Portal Sync
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => onApplyPreset('STANDARD')}
                        className="h-8 text-slate-500 hover:text-emerald-700"
                    >
                        Apply Standard FTTH
                    </Button>
                </div>
            </div>

            {/* Quick Add Shortcuts */}
            <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">Quick Add Items</span>
                <div className="flex flex-wrap gap-2 bg-slate-50/50 p-4 border border-slate-200/60 rounded-xl">
                    {quickItems.map(({ label, item }) => (
                        <Button
                            key={label}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onQuickAdd(item)}
                            className="h-8 text-xs hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors bg-white font-bold"
                        >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            {label}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Detailed Usage Table */}
            <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b">
                        <tr className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                            <th className="px-3 py-2 text-left w-[360px]">Item</th>
                            <th className="px-2 py-2 text-center w-[110px]">Usage</th>
                            <th className="px-2 py-2 text-center w-[340px]">Wastage & Reason</th>
                            <th className="px-2 py-2 text-center w-[170px]">Serial #</th>
                            <th className="px-2 py-2 text-center w-[40px]"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {rows.map((row, idx) => {
                            const currentItem = items.find(i => i.id === row.itemId);
                            const isDW = currentItem?.code === 'OSPFTA003';
                            return (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-3 py-1.5 w-[360px]">
                                        <Select 
                                            value={row.itemId} 
                                            onValueChange={(val) => onUpdateRow(idx, 'itemId', val)}
                                        >
                                            <SelectTrigger className="h-8 border-slate-200 text-xs">
                                                <SelectValue placeholder="Select Item" />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-[250px]">
                                                {items.map(item => (
                                                    <SelectItem key={item.id} value={item.id} className="text-xs">
                                                        {item.code} - {item.name} ({item.unit})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    <td className="px-2 py-1.5 w-[110px]">
                                        {isDW ? (
                                            <div className="flex gap-1">
                                                <Input 
                                                    placeholder="F1" 
                                                    value={row.f1Qty || ""} 
                                                    onChange={(e) => onUpdateRow(idx, 'f1Qty', e.target.value)}
                                                    className="h-8 text-center text-xs"
                                                />
                                                <Input 
                                                    placeholder="G1" 
                                                    value={row.g1Qty || ""} 
                                                    onChange={(e) => onUpdateRow(idx, 'g1Qty', e.target.value)}
                                                    className="h-8 text-center text-xs"
                                                />
                                            </div>
                                        ) : (
                                            <Input 
                                                placeholder="Qty" 
                                                value={row.usedQty || ""} 
                                                onChange={(e) => onUpdateRow(idx, 'usedQty', e.target.value)}
                                                className="h-8 text-center text-xs"
                                            />
                                        )}
                                    </td>
                                    <td className="px-2 py-1.5 w-[340px]">
                                        <div className="flex items-center gap-1.5">
                                            <Input 
                                                placeholder="Wastage" 
                                                value={row.wastageQty || ""} 
                                                onChange={(e) => onUpdateRow(idx, 'wastageQty', e.target.value)}
                                                className="h-8 w-20 text-center text-xs bg-red-50/10 dark:bg-red-950/5 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350"
                                                disabled={currentItem?.isWastageAllowed === false}
                                            />
                                            <Input 
                                                placeholder="Wastage Reason" 
                                                value={row.wastageReason || ""} 
                                                onChange={(e) => onUpdateRow(idx, 'wastageReason', e.target.value)}
                                                className="h-8 flex-1 text-xs bg-slate-50/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350"
                                                disabled={currentItem?.isWastageAllowed === false}
                                            />
                                        </div>
                                        {currentItem?.maxWastagePercentage !== undefined && currentItem?.isWastageAllowed !== false && (
                                            <span className="text-[8px] text-slate-400 text-center leading-none mt-0.5 block">Max {currentItem.maxWastagePercentage}% allowed</span>
                                        )}
                                    </td>
                                    <td className="px-2 py-1.5 w-[170px]">
                                        <Input 
                                            placeholder="Serial Number" 
                                            value={row.serialNumber || ""} 
                                            onChange={(e) => onUpdateRow(idx, 'serialNumber', e.target.value.toUpperCase())}
                                            className="h-8 text-xs font-mono"
                                            disabled={currentItem?.hasSerial === false}
                                        />
                                    </td>
                                    <td className="px-2 py-1.5 text-center w-[40px]">
                                        <Button variant="ghost" size="icon" onClick={() => onRemoveRow(idx)} className="h-8 w-8 text-slate-400 hover:text-red-500 rounded-md">
                                            <X className="w-3.5 h-3.5" />
                                        </Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <div className="p-2 bg-slate-50/30 flex justify-center border-t">
                    <Button variant="ghost" size="sm" onClick={onAddRow} className="text-emerald-600 hover:bg-emerald-50 h-8 text-[11px] font-bold">
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Additional Item
                    </Button>
                </div>
            </div>
            {materialSource === 'SLTS' && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-800 text-xs">
                    <Info className="w-4 h-4" />
                    <span>Company Materials: Valid charges will be applied based on consumption.</span>
                </div>
            )}
        </div>
    );
}
