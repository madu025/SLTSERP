'use client';

/**
 * DashboardFilters – page header for the dashboard.
 *
 * Renders the “Welcome, {user}” heading with the scope subtitle, the
 * region / RTOM filter dropdowns, a clear-filters button, and the PAT
 * rejection alert banner. Extracted from `src/app/dashboard/page.tsx`
 * so the page component can stay focused on data orchestration.
 */

import Link from 'next/link';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { LayoutDashboard, ShieldAlert, X } from 'lucide-react';

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
        <>
            {/* ── Page Header ─────────────────────────────── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <LayoutDashboard className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-foreground leading-tight">
                            Welcome, {user?.name ?? 'User'}
                        </h1>
                        <p className="text-muted-foreground text-xs md:text-sm">
                            Performance overview for <span className="font-semibold text-foreground">{scopeLabel}</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
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
                                className="h-8 w-[140px] text-xs font-bold rounded-lg border border-border/40 bg-card/60 text-foreground hover:bg-card/85 transition-colors focus:ring-1 focus:ring-primary/45"
                            >
                                <SelectValue placeholder="All Regions" />
                            </SelectTrigger>
                            <SelectContent className="border border-border/40 bg-card/95 text-foreground backdrop-blur-xl">
                                <SelectItem value="ALL">All Regions</SelectItem>
                                {availableRegions?.map(r => (
                                    <SelectItem key={r} value={r}>{r}</SelectItem>
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
                            className="h-8 w-[140px] text-xs font-bold rounded-lg border border-border/40 bg-card/60 text-foreground hover:bg-card/85 transition-colors focus:ring-1 focus:ring-primary/45"
                        >
                            <SelectValue placeholder="All RTOMs" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 border border-border/40 bg-card/95 text-foreground backdrop-blur-xl">
                            <SelectItem value="ALL">All RTOMs</SelectItem>
                            {availableRtoms.map(r => (
                                <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {hasFilters && (
                        <button
                            onClick={onClearFilters}
                            className="h-8 px-3 inline-flex items-center gap-1 text-[10px] text-rose-500 hover:text-rose-600 font-bold uppercase tracking-wider bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/15 rounded-lg transition-all duration-200"
                        >
                            <X className="w-3 h-3" />
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* ── PAT Rejection Alert Banner ──────────────── */}
            {patRejectedCount > 0 && (
                <Link
                    href="/service-orders/pat"
                    className="flex items-center gap-3 px-4 py-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-rose-500 hover:bg-rose-500/15 transition-colors group"
                >
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                    </span>
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-bold">
                        {patRejectedCount} PAT rejection{patRejectedCount > 1 ? 's' : ''} need attention
                    </span>
                    <span className="ml-auto text-xs font-bold uppercase tracking-wider opacity-70 group-hover:opacity-100 transition-opacity">
                        Review →
                    </span>
                </Link>
            )}
        </>
    );
}

export default DashboardFilters;
