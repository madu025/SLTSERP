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

            {/* Quick Access Block */}
            <div className="bg-slate-50 border rounded-xl p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
                {quickItems.map(({ label, item }) => {
                    const existingRow = rows.find(r => r.itemId === item.id);
                    const isDropWire = item.code === 'OSPFTA003';
                    const val = existingRow ? (isDropWire ? (existingRow.f1Qty || '') : (existingRow.usedQty || '')) : '';

                    return (
                        <div key={label} className="space-y-1.5">
                            <Label className="text-[11px] uppercase tracking-wider text-slate-500">{label}</Label>
                            <div className="relative group">
                                <Input 
                                    className="h-9 pr-8 bg-white transition-all focus:ring-emerald-500" 
                                    placeholder="Qty"
                                    value={val}
                                    onChange={(e) => {
                                        const index = rows.findIndex(r => r.itemId === item.id);
                                        if (index >= 0) {
                                            onUpdateRow(index, isDropWire ? 'f1Qty' : 'usedQty', e.target.value);
                                        }
                                    }}
                                />
                                <span className="absolute right-2 top-2 text-[10px] text-slate-400">{item.unit}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Detailed Usage Table */}
            <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium text-slate-600 w-[280px]">Item</th>
                            <th className="px-2 py-3 text-center font-medium text-slate-600">Usage</th>
                            <th className="px-2 py-3 text-center font-medium text-slate-600">Wastage</th>
                            <th className="px-2 py-3 text-center font-medium text-slate-600">Serial #</th>
                            <th className="px-2 py-3 text-center font-medium text-slate-600 w-[50px]"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {rows.map((row, idx) => {
                            const currentItem = items.find(i => i.id === row.itemId);
                            const isDW = currentItem?.code === 'OSPFTA003';
                            return (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <Select 
                                            value={row.itemId} 
                                            onValueChange={(val) => onUpdateRow(idx, 'itemId', val)}
                                        >
                                            <SelectTrigger className="h-9 border-slate-200">
                                                <SelectValue placeholder="Select Item" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {items.map(item => (
                                                    <SelectItem key={item.id} value={item.id}>
                                                        {item.code} - {item.name} ({item.unit})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    <td className="px-2 py-3">
                                        {isDW ? (
                                            <div className="flex gap-1">
                                                <Input 
                                                    placeholder="F1" 
                                                    value={row.f1Qty || ""} 
                                                    onChange={(e) => onUpdateRow(idx, 'f1Qty', e.target.value)}
                                                    className="h-9 text-center"
                                                />
                                                <Input 
                                                    placeholder="G1" 
                                                    value={row.g1Qty || ""} 
                                                    onChange={(e) => onUpdateRow(idx, 'g1Qty', e.target.value)}
                                                    className="h-9 text-center"
                                                />
                                            </div>
                                        ) : (
                                            <Input 
                                                placeholder="Qty" 
                                                value={row.usedQty || ""} 
                                                onChange={(e) => onUpdateRow(idx, 'usedQty', e.target.value)}
                                                className="h-9 text-center"
                                            />
                                        )}
                                    </td>
                                    <td className="px-2 py-3">
                                        <div className="flex flex-col gap-1">
                                            <Input 
                                                placeholder="Wastage" 
                                                value={row.wastageQty || ""} 
                                                onChange={(e) => onUpdateRow(idx, 'wastageQty', e.target.value)}
                                                className="h-9 text-center"
                                            />
                                            {currentItem?.maxWastagePercentage !== undefined && (
                                                <span className="text-[9px] text-slate-400 text-center">Max {currentItem.maxWastagePercentage}%</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-2 py-3">
                                        <Input 
                                            placeholder="Serial" 
                                            value={row.serialNumber || ""} 
                                            onChange={(e) => onUpdateRow(idx, 'serialNumber', e.target.value.toUpperCase())}
                                            className="h-9"
                                            disabled={currentItem?.hasSerial === false}
                                        />
                                    </td>
                                    <td className="px-2 py-3">
                                        <Button variant="ghost" size="icon" onClick={() => onRemoveRow(idx)} className="h-8 w-8 text-slate-400 hover:text-red-500">
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <div className="p-3 bg-slate-50/50 flex justify-center border-t">
                    <Button variant="ghost" size="sm" onClick={onAddRow} className="text-emerald-600 hover:bg-emerald-50">
                        <Plus className="w-4 h-4 mr-1" /> Add Additional Item
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
