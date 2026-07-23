'use client';

import Link from 'next/link';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { LayoutDashboard, ShieldAlert, X, RefreshCw, Sparkles, Activity, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface DashboardFiltersProps {
    user: { name: string; role: string } | null;
    selectedRegion: string;
    selectedRtom: string;
    onRegionChange: (val: string) => void;
    onRtomChange: (val: string) => void;
    onClearFilters: () => void;
    canFilterGlobally: boolean;
    availableRegions?: string[];
    availableRtoms: string[];
    patRejectedCount: number;
    isAreaCoordinator: boolean;
    isLoading: boolean;
}

export function DashboardFilters({
    user,
    selectedRegion,
    selectedRtom,
    onRegionChange,
    onRtomChange,
    onClearFilters,
    canFilterGlobally,
    availableRegions,
    availableRtoms,
    patRejectedCount,
    isAreaCoordinator,
    isLoading
}: DashboardFiltersProps) {
    const hasFilters = selectedRegion !== 'ALL' || selectedRtom !== 'ALL';

    const scopeLabel = selectedRtom !== 'ALL'
        ? selectedRtom
        : selectedRegion !== 'ALL'
            ? selectedRegion
            : isAreaCoordinator
                ? 'your assigned areas'
                : 'all RTOMs';

    return (
        <div className="space-y-4">
            {/* ── Page Header ─────────────────────────────── */}
            <div className="glass-panel p-4 md:p-6 rounded-3xl border border-border/50 bg-gradient-to-r from-card via-card/90 to-primary/5 shadow-xl relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-dark shadow-md shadow-primary/20 flex items-center justify-center shrink-0">
                        <LayoutDashboard className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground">
                                Welcome, {user?.name ?? 'User'}
                            </h1>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                <Activity className="w-3 h-3 animate-pulse" /> Live ERP
                            </span>
                        </div>
                        <p className="text-muted-foreground text-xs md:text-sm font-medium mt-0.5">
                            Executive operations cockpit for <span className="font-bold text-primary">{scopeLabel}</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap relative z-10">
                    {/* Region filter */}
                    {canFilterGlobally && (
                        <Select
                            value={selectedRegion}
                            onValueChange={(val) => {
                                onRegionChange(val);
                                onRtomChange('ALL');
                            }}
                        >
                            <SelectTrigger
                                aria-label="Filter by region"
                                className="h-9 w-[145px] text-xs font-bold rounded-xl border border-border/50 bg-background/80 text-foreground hover:bg-background transition-all shadow-sm focus:ring-2 focus:ring-primary/40"
                            >
                                <SelectValue placeholder="All Regions" />
                            </SelectTrigger>
                            <SelectContent className="border border-border/50 bg-card/95 text-foreground backdrop-blur-2xl">
                                <SelectItem value="ALL" className="text-xs font-bold">All Regions</SelectItem>
                                {availableRegions?.map(r => (
                                    <SelectItem key={r} value={r} className="text-xs font-semibold">{r}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    {/* RTOM filter */}
                    <Select
                        value={selectedRtom}
                        onValueChange={(val) => onRtomChange(val)}
                    >
                        <SelectTrigger
                            aria-label="Filter by RTOM"
                            className="h-9 w-[145px] text-xs font-bold rounded-xl border border-border/50 bg-background/80 text-foreground hover:bg-background transition-all shadow-sm focus:ring-2 focus:ring-primary/40"
                        >
                            <SelectValue placeholder="All RTOMs" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 border border-border/50 bg-card/95 text-foreground backdrop-blur-2xl">
                            <SelectItem value="ALL" className="text-xs font-bold">All RTOMs</SelectItem>
                            {availableRtoms.map(r => (
                                <SelectItem key={r} value={r} className="text-xs font-semibold">{r}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Export Executive PDF button */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.print()}
                        className="h-9 px-3 text-xs font-bold rounded-xl border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-all shadow-sm"
                    >
                        <Printer className="w-3.5 h-3.5 mr-1.5" /> Export PDF
                    </Button>

                    {hasFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClearFilters}
                            className="h-9 px-3 text-xs text-rose-500 hover:text-rose-600 font-bold bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/15 rounded-xl transition-all"
                        >
                            <X className="w-3.5 h-3.5 mr-1" /> Clear
                        </Button>
                    )}
                </div>
            </div>

            {/* ── PAT Rejection Alert Banner ──────────────── */}
            {patRejectedCount > 0 && (
                <Link
                    href="/service-orders/pat"
                    className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border border-rose-500/30 rounded-2xl text-rose-500 hover:bg-rose-500/15 transition-all group shadow-md"
                >
                    <span className="relative flex h-3 w-3 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                    </span>
                    <ShieldAlert className="w-5 h-5 shrink-0 animate-bounce" />
                    <span className="text-xs md:text-sm font-black">
                        {patRejectedCount} PAT rejection{patRejectedCount > 1 ? 's' : ''} require immediate operational review
                    </span>
                    <span className="ml-auto text-xs font-black uppercase tracking-wider opacity-80 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                        Review Now →
                    </span>
                </Link>
            )}
        </div>
    );
}

export default DashboardFilters;
