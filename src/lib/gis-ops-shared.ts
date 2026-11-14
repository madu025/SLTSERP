/** Client-safe types and rules for the operations layer of the national map. */

export type PinLevel = 'critical' | 'warning' | 'ok';

export interface OpsProjectPin {
    projectId: string;
    name: string;
    projectCode: string;
    status: string;
    lat: number;
    lng: number;
    /** Where the position came from: the project's surveyed poles, or its recorded assets. */
    source: 'POLES' | 'ASSETS';
    pointCount: number;
    delayed: boolean;
    overBudget: boolean;
    spi: number | null;
    level: PinLevel;
    reasons: string[];
}

export interface OpsBacklogMarker {
    rtom: string;
    open: number;
    over14: number;
    lat: number;
    lng: number;
    /** Positions are the mean of that RTOM's located projects, not a surveyed location. */
    approximate: true;
}

export interface OpsOverlay {
    pins: OpsProjectPin[];
    backlog: OpsBacklogMarker[];
    /** How many active projects exist in the caller's scope, and how many of them could be placed on the map. */
    coverage: { activeProjects: number; located: number };
    notes: string[];
}

/** Colour and ranking of a pin from its project signals (late, over budget, low SPI). */
export function pinLevel(input: { delayed: boolean; overBudget: boolean; spi: number | null }, spiThreshold = 0.85): { level: PinLevel; reasons: string[] } {
    const reasons: string[] = [];
    if (input.delayed) reasons.push('Past planned end date');
    if (input.overBudget) reasons.push('Over budget');
    if (input.spi !== null && input.spi < spiThreshold) reasons.push(`Behind schedule (SPI ${input.spi.toFixed(2)})`);
    const level: PinLevel = input.delayed || input.overBudget ? 'critical' : reasons.length > 0 ? 'warning' : 'ok';
    return { level, reasons };
}

export const PIN_COLOR: Record<PinLevel, string> = { critical: '#ef4444', warning: '#f59e0b', ok: '#10b981' };

/** Mean position of a set of points; null when there are none. */
export function centroid(points: { lat: number; lng: number }[]): { lat: number; lng: number } | null {
    if (points.length === 0) return null;
    const lat = points.reduce((a, p) => a + p.lat, 0) / points.length;
    const lng = points.reduce((a, p) => a + p.lng, 0) / points.length;
    return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

/** A coordinate inside Sri Lanka's bounding box; anything else is bad data and is not drawn. */
export function isPlausibleLocation(lat: number, lng: number): boolean {
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 5.5 && lat <= 10 && lng >= 79 && lng <= 82.2;
}
