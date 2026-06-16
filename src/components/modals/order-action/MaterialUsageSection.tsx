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
            <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
                {quickItems.map(({ label, item }) => {
                    const existingRow = rows.find(r => r.itemId === item.id);
                    const isDropWire = item.code === 'OSPFTA003';
                    const val = existingRow ? (isDropWire ? (existingRow.f1Qty || '') : (existingRow.usedQty || '')) : '';

                    return (
                        <div key={label} className="space-y-1">
                            <Label className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block truncate" title={label}>{label}</Label>
                            <div className="flex gap-1 items-center group">
                                <div className="relative flex-1">
                                    <Input 
                                        className="h-8 pr-6 bg-white transition-all focus:ring-emerald-500 text-xs" 
                                        placeholder="Used"
                                        value={val}
                                        onChange={(e) => {
                                            const index = rows.findIndex(r => r.itemId === item.id);
                                            if (index >= 0) {
                                                onUpdateRow(index, isDropWire ? 'f1Qty' : 'usedQty', e.target.value);
                                            }
                                        }}
                                    />
                                    <span className="absolute right-1 top-2 text-[8px] font-black text-slate-400 uppercase">{item.unit}</span>
                                </div>
                                <div className="w-12">
                                    <Input 
                                        className="h-8 px-1 bg-red-50/30 border-red-100 focus:ring-red-500 text-[10px] text-center font-bold" 
                                        placeholder="W" 
                                        title="Wastage Qty"
                                        value={existingRow?.wastageQty || ''}
                                        onChange={(e) => {
                                            const index = rows.findIndex(r => r.itemId === item.id);
                                            if (index >= 0) onUpdateRow(index, 'wastageQty', e.target.value);
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Detailed Usage Table */}
            <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b">
                        <tr className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                            <th className="px-3 py-2 text-left w-[240px]">Item</th>
                            <th className="px-2 py-2 text-center w-[120px]">Usage</th>
                            <th className="px-2 py-2 text-center w-[160px]">Wastage / Reason</th>
                            <th className="px-2 py-2 text-center">Serial #</th>
                            <th className="px-2 py-2 text-center w-[40px]"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {rows.map((row, idx) => {
                            const currentItem = items.find(i => i.id === row.itemId);
                            const isDW = currentItem?.code === 'OSPFTA003';
                            return (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-3 py-1.5">
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
                                    <td className="px-2 py-1.5">
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
                                    <td className="px-2 py-1.5">
                                        <div className="flex flex-col gap-1">
                                            <Input 
                                                placeholder="Wastage" 
                                                value={row.wastageQty || ""} 
                                                onChange={(e) => onUpdateRow(idx, 'wastageQty', e.target.value)}
                                                className="h-7 text-center text-[10px] font-bold bg-red-50/20 border-red-50"
                                            />
                                            <Input 
                                                placeholder="Reason" 
                                                value={row.wastageReason || ""} 
                                                onChange={(e) => onUpdateRow(idx, 'wastageReason', e.target.value)}
                                                className="h-6 text-[9px] px-1.5 italic bg-slate-50 border-none rounded-md"
                                            />
                                            {currentItem?.maxWastagePercentage !== undefined && (
                                                <span className="text-[8px] text-slate-400 text-center leading-none">Max {currentItem.maxWastagePercentage}%</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-2 py-1.5">
                                        <Input 
                                            placeholder="Serial" 
                                            value={row.serialNumber || ""} 
                                            onChange={(e) => onUpdateRow(idx, 'serialNumber', e.target.value.toUpperCase())}
                                            className="h-8 text-xs font-mono"
                                            disabled={currentItem?.hasSerial === false}
                                        />
                                    </td>
                                    <td className="px-2 py-1.5 text-center">
                                        <Button variant="ghost" size="icon" onClick={() => onRemoveRow(idx)} className="h-7 w-7 text-slate-400 hover:text-red-500 rounded-md">
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
