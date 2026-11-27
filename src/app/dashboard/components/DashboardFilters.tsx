'use client';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { X, Printer, RefreshCw } from 'lucide-react';
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
    isAreaCoordinator: boolean;
    isLoading: boolean;
    isRefreshing?: boolean;
    onRefresh?: () => void;
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
    isAreaCoordinator,
    isLoading,
    isRefreshing = false,
    onRefresh
}: DashboardFiltersProps) {
    const hasFilters = selectedRegion !== 'ALL' || selectedRtom !== 'ALL';

    const scopeLabel = selectedRtom !== 'ALL'
        ? selectedRtom
        : selectedRegion !== 'ALL'
            ? selectedRegion
            : isAreaCoordinator
                ? 'your assigned areas'
                : 'all RTOMs';

    const roleLabel = user?.role ? user.role.toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : null;
    const trigger = 'dash-select h-9 w-[150px]';

    return (
        <header className="dash-panel flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
                <h1 style={{ fontFamily: 'var(--dash-display)', fontWeight: 700, fontSize: '1.5rem', lineHeight: 1.2 }}>
                    Welcome, {user?.name ?? 'User'}
                </h1>
                <p style={{ color: 'var(--dash-ink-2)', fontSize: '0.9375rem' }}>
                    {roleLabel ? `${roleLabel}. ` : ''}Figures for <strong style={{ color: 'var(--dash-ink)' }}>{scopeLabel}</strong>.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Dashboard filters">
                {canFilterGlobally && (
                    <Select value={selectedRegion} onValueChange={(val) => { onRegionChange(val); onRtomChange('ALL'); }}>
                        <SelectTrigger aria-label="Filter by region" className={trigger}><SelectValue placeholder="All regions" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All regions</SelectItem>
                            {availableRegions?.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                    </Select>
                )}
                <Select value={selectedRtom} onValueChange={(val) => onRtomChange(val)}>
                    <SelectTrigger aria-label="Filter by RTOM" className={trigger}><SelectValue placeholder="All RTOMs" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                        <SelectItem value="ALL">All RTOMs</SelectItem>
                        {availableRtoms.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                </Select>
                {hasFilters && (
                    <Button variant="ghost" size="sm" onClick={onClearFilters} className="dash-button h-9">
                        <X className="mr-1 h-4 w-4" aria-hidden="true" /> Clear filters
                    </Button>
                )}
                {onRefresh && (
                    <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={isLoading || isRefreshing} className="dash-button h-9">
                        <RefreshCw className={`mr-1.5 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
                        {isRefreshing ? 'Refreshing' : 'Refresh'}
                    </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => window.print()} className="dash-button h-9">
                    <Printer className="mr-1.5 h-4 w-4" aria-hidden="true" /> Print
                </Button>
            </div>
        </header>
    );
}

export default DashboardFilters;
