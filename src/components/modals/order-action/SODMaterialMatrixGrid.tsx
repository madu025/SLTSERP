"use client";

import React, { useMemo } from "react";
import { 
    Cable, 
    UtilityPole, 
    Wrench, 
    Boxes, 
    Zap, 
    PlusSquare, 
    Layers, 
    RotateCcw, 
    CheckCircle2, 
    AlertCircle,
    Hash
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
    SOD_STANDARD_MATRIX_CONFIG, 
    MATRIX_CATEGORIES, 
    SOD_QUICK_PRESETS,
    SODMatrixItemConfig 
} from "@/config/sod-matrix-config";

interface SODMaterialMatrixGridProps {
    matrixValues: Record<string, string>;
    onUpdateMatrixValue: (key: string, val: string) => void;
    onApplyPreset: (presetId: 'STANDARD' | 'POLE_1' | 'POLE_2' | 'CLEAR') => void;
    poleNumber: string;
    onUpdatePoleNumber: (val: string) => void;
    materialSource?: string;
    dropWireDistance?: number | null;
}

export function SODMaterialMatrixGrid({
    matrixValues,
    onUpdateMatrixValue,
    onApplyPreset,
    poleNumber,
    onUpdatePoleNumber,
    materialSource = 'SLT',
    dropWireDistance
}: SODMaterialMatrixGridProps) {

    // Metrics computation for live status
    const metrics = useMemo(() => {
        const f1 = parseFloat(matrixValues['F1'] || '0') || 0;
        const g1 = parseFloat(matrixValues['G1'] || '0') || 0;
        const wastage = parseFloat(matrixValues['FDW_WASTAGE'] || '0') || 0;
        const totalDw = f1 + g1;

        const pole56 = parseFloat(matrixValues['PLC_5_6_CE'] || '0') || 0;
        const pole67 = parseFloat(matrixValues['PLC_6_7_CE'] || '0') || 0;
        const pole8 = parseFloat(matrixValues['PLC_8'] || '0') || 0;
        const totalPoles = pole56 + pole67 + pole8;

        let activeCount = 0;
        Object.entries(matrixValues).forEach(([k, v]) => {
            if (k !== 'POLE_NUMBER' && parseFloat(v || '0') > 0) {
                activeCount++;
            }
        });

        return {
            totalDw,
            f1,
            g1,
            wastage,
            totalPoles,
            activeCount
        };
    }, [matrixValues]);

    const isPoleRequired = metrics.totalPoles > 0;
    const isPoleNumberMissing = isPoleRequired && !poleNumber.trim();

    return (
        <div className="space-y-4">
            {/* Quick Action Presets Bar */}
            <div className="bg-slate-50 dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shadow-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                        Quick Presets:
                    </span>
                    {SOD_QUICK_PRESETS.map((p) => {
                        const IconComponent = p.icon === 'Zap' ? Zap : p.icon === 'PlusSquare' ? PlusSquare : Layers;
                        return (
                            <Button
                                key={p.id}
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => onApplyPreset(p.id)}
                                title={p.description}
                                className="h-7 px-2.5 text-xs font-bold bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300 transition-all cursor-pointer shadow-xs"
                            >
                                <IconComponent className="w-3 h-3 mr-1 text-emerald-600 dark:text-emerald-400" />
                                {p.label}
                            </Button>
                        );
                    })}
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onApplyPreset('CLEAR')}
                    className="h-7 px-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Reset
                </Button>
            </div>

            {/* 4 Category Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {MATRIX_CATEGORIES.map((cat) => {
                    const catItems = SOD_STANDARD_MATRIX_CONFIG.filter((i) => i.category === cat.id);
                    const CategoryIcon = cat.id === 'CABLES' ? Cable : cat.id === 'POLES' ? UtilityPole : cat.id === 'HARDWARE' ? Wrench : Boxes;

                    return (
                        <div
                            key={cat.id}
                            className={cn(
                                "rounded-xl bg-white dark:bg-slate-900 border p-3 shadow-xs transition-all",
                                cat.borderClass
                            )}
                        >
                            {/* Card Category Header */}
                            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-1.5">
                                    <span className={cn("p-1 rounded-md border text-xs font-bold flex items-center gap-1", cat.badgeClass)}>
                                        <CategoryIcon className="w-3.5 h-3.5" />
                                        {cat.label}
                                    </span>
                                </div>
                                {cat.id === 'CABLES' && dropWireDistance ? (
                                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                        Header Dist: <b className="text-slate-800 dark:text-slate-200">{dropWireDistance}m</b>
                                    </span>
                                ) : null}
                                {cat.id === 'POLES' && metrics.totalPoles > 0 ? (
                                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                        {metrics.totalPoles} Pole(s) Erected
                                    </span>
                                ) : null}
                            </div>

                            {/* Items Keypad Matrix */}
                            <div className="space-y-1.5">
                                {catItems.map((item: SODMatrixItemConfig) => {
                                    if (item.isPoleNumber) {
                                        return (
                                            <div
                                                key={item.key}
                                                className={cn(
                                                    "p-2 rounded-lg border transition-all mt-2",
                                                    isPoleRequired
                                                        ? isPoleNumberMissing
                                                            ? "bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700"
                                                            : "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800"
                                                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                                                )}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                                        <Hash className="w-3 h-3 text-emerald-600" />
                                                        {item.name}
                                                        {isPoleRequired && (
                                                            <span className="text-rose-500 font-extrabold ml-0.5">* Required</span>
                                                        )}
                                                    </label>
                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                                        Header: {item.header}
                                                    </span>
                                                </div>
                                                <Input
                                                    type="text"
                                                    value={poleNumber}
                                                    onChange={(e) => onUpdatePoleNumber(e.target.value.toUpperCase())}
                                                    placeholder={item.placeholder}
                                                    disabled={!isPoleRequired}
                                                    className={cn(
                                                        "h-8 text-xs font-mono font-bold tracking-wider",
                                                        isPoleRequired && isPoleNumberMissing
                                                            ? "border-rose-400 focus-visible:ring-rose-400 bg-white"
                                                            : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                                                    )}
                                                />
                                            </div>
                                        );
                                    }

                                    const currentVal = matrixValues[item.key] || "";
                                    const hasValue = parseFloat(currentVal || "0") > 0;

                                    return (
                                        <div
                                            key={item.key}
                                            className={cn(
                                                "flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border transition-all duration-150",
                                                hasValue
                                                    ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 shadow-2xs"
                                                    : "bg-slate-50/40 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-850"
                                            )}
                                        >
                                            <div className="flex-1 min-w-0 pr-1">
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                                        {item.name}
                                                    </span>
                                                    <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 shrink-0 font-bold bg-white dark:bg-slate-800 px-1 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                                                        {item.header}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                                    Unit: {item.unit}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step={item.step || "1"}
                                                    value={currentVal}
                                                    placeholder={item.placeholder || "0"}
                                                    onFocus={(e) => e.target.select()}
                                                    onChange={(e) => onUpdateMatrixValue(item.key, e.target.value)}
                                                    className={cn(
                                                        "h-7 w-20 text-center font-mono font-bold text-xs transition-all",
                                                        hasValue
                                                            ? "bg-white dark:bg-slate-950 border-emerald-500 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/20"
                                                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:border-blue-400"
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Live Metrics & Summary Bar */}
            <div className="bg-slate-900 text-white p-3 rounded-xl shadow-md border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4 flex-wrap text-xs">
                    <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-slate-300">Active Items:</span>
                        <b className="text-white font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                            {metrics.activeCount} of {SOD_STANDARD_MATRIX_CONFIG.length - 1}
                        </b>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <Cable className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span className="text-slate-300">Total Drop Wire:</span>
                        <b className="text-cyan-300 font-mono">
                            {metrics.totalDw}m
                        </b>
                        <span className="text-[10px] text-slate-400 font-mono">
                            (F1: {metrics.f1}m | G1: {metrics.g1}m)
                        </span>
                    </div>

                    {metrics.totalPoles > 0 && (
                        <div className="flex items-center gap-1.5">
                            <UtilityPole className="w-4 h-4 text-amber-400 shrink-0" />
                            <span className="text-slate-300">Poles:</span>
                            <b className="text-amber-300 font-mono">
                                {metrics.totalPoles}
                            </b>
                            {poleNumber && (
                                <span className="text-[10px] text-amber-200 bg-amber-950/60 border border-amber-800 px-1.5 py-0.5 rounded font-mono">
                                    #{poleNumber}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {isPoleNumberMissing && (
                    <div className="flex items-center gap-1 text-xs text-rose-400 bg-rose-950/60 border border-rose-800 px-2 py-1 rounded-md animate-pulse font-bold">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        Pole Number Required!
                    </div>
                )}
            </div>
        </div>
    );
}
