import React from 'react';
import { Badge } from '@/components/ui/badge';
import { RouteData, RouteClosure, RouteCableSegment } from './types';

// Helper to reconstruct the MST graph and find the longest path (meters)
export function findLongestPathMeters(closures: RouteClosure[], cables: RouteCableSegment[]): number {
  if (closures.length <= 1 || cables.length === 0) return 0;

  const feedPoint = closures.find(c => Number(c.closureNumber) === 0) || closures[0];

  const findNearestClosureNumber = (coord: [number, number]): number => {
    let minDist = Infinity;
    let nearest = closures[0];
    for (const c of closures) {
      const lon = Number(c.longitude ?? 0);
      const lat = Number(c.latitude ?? 0);
      const d = Math.pow(lon - coord[0], 2) + Math.pow(lat - coord[1], 2);
      if (d < minDist) {
        minDist = d;
        nearest = c;
      }
    }
    return Number(nearest.closureNumber ?? 0);
  };

  const adj = new Map<number, { to: number; dist: number }[]>();

  for (const cable of cables) {
    const props = cable.properties || {};
    const coords = props.coordinates || [];
    if (coords.length < 2) continue;
    const startNum = findNearestClosureNumber(coords[0]);
    const endNum = findNearestClosureNumber(coords[coords.length - 1]);

    if (startNum === endNum) continue;

    if (!adj.has(startNum)) adj.set(startNum, []);
    if (!adj.has(endNum)) adj.set(endNum, []);

    adj.get(startNum)!.push({ to: endNum, dist: cable.length || 0 });
    adj.get(endNum)!.push({ to: startNum, dist: cable.length || 0 });
  }

  const visited = new Set<number>();
  let maxPath = 0;

  const dfs = (curr: number, currentDist: number) => {
    visited.add(curr);
    if (currentDist > maxPath) maxPath = currentDist;

    const neighbors = adj.get(curr) || [];
    for (const edge of neighbors) {
      if (!visited.has(edge.to)) {
        dfs(edge.to, currentDist + edge.dist);
      }
    }
  };

  const feedPointNum = Number(feedPoint.closureNumber ?? 0);
  dfs(feedPointNum, 0);
  return maxPath;
}

export interface LinkBudgetStats {
  distKm: number;
  fiberLoss: number;
  splitLoss: number;
  connLoss: number;
  spliceLoss: number;
  totalLoss: number;
  rxPower: number;
  status: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'FAIL';
  oltPorts: number;
  totalSubscribers: number;
}

// Helper to calculate the full link budget
export function calculateLinkBudget(route: RouteData): LinkBudgetStats | null {
  const closures = route.closures || [];
  const cables = route.cableSegments || [];

  if (closures.length === 0) return null;

  const longestPathMeters = findLongestPathMeters(closures, cables);
  const distKm = longestPathMeters / 1000;

  // Fiber loss: 0.22 dB/km at 1490nm
  const fiberLoss = distKm * 0.22;
  // Splitting loss: 2-stage split (1:8 x 1:8)
  const splitLoss = 21.0;
  // Connector loss: 5 connectors * 0.3 dB
  const connLoss = 1.5;
  // Splice loss: 1 splice every 500m + 3 terminations
  const spliceCount = Math.floor(distKm * 2) + 3;
  const spliceLoss = spliceCount * 0.1;
  // Safety margin
  const safetyMargin = 2.5;

  const totalLoss = fiberLoss + splitLoss + connLoss + spliceLoss + safetyMargin;

  // Extract startDeviceType from metadata to calculate appropriate Rx Power
  const metadata = route.metadata 
    ? (typeof route.metadata === 'string' ? JSON.parse(route.metadata) : route.metadata) 
    : {};
  const deviceType = String(metadata.startDeviceType || 'OLT').toUpperCase();

  let launchPower = 4.0; // OLT default
  if (deviceType === 'FTC' || deviceType === 'CABINET') {
    launchPower = -7.0;
  } else if (deviceType === 'CLOSURE') {
    launchPower = -10.0;
  } else if (deviceType === 'JOINT') {
    launchPower = -12.0;
  } else if (deviceType === 'STUMP_CABLE') {
    launchPower = -14.0;
  }

  const rxPower = launchPower - totalLoss;

  let status: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'FAIL' = 'GOOD';
  if (rxPower < -27) {
    status = 'FAIL';
  } else if (rxPower < -24) {
    status = 'WARNING';
  } else if (rxPower >= -23 && rxPower <= -18) {
    status = 'EXCELLENT';
  }

  const totalSubscribers = closures
    .filter(c => c.closureType === 'TERMINAL')
    .reduce((sum, c) => sum + Number(c.capacity || 8), 0);
  const oltPorts = Math.ceil(totalSubscribers / 64);

  return {
    distKm,
    fiberLoss,
    splitLoss,
    connLoss,
    spliceLoss,
    totalLoss,
    rxPower,
    status,
    oltPorts,
    totalSubscribers
  };
}

interface LinkBudgetAuditCardProps {
  v1Budget: LinkBudgetStats;
  v2Budget: LinkBudgetStats;
}

export function LinkBudgetAuditCard({ v1Budget, v2Budget }: LinkBudgetAuditCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
          ⚡ Optical Link Budget Audit (1490nm)
        </span>
        <div className="flex gap-2">
          <Badge className={
            v1Budget.status === 'FAIL' ? 'bg-red-100 text-red-700' :
            v1Budget.status === 'WARNING' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
          }>
            v1: {v1Budget.rxPower.toFixed(2)} dBm ({v1Budget.status})
          </Badge>
          <Badge className={
            v2Budget.status === 'FAIL' ? 'bg-red-100 text-red-700' :
            v2Budget.status === 'WARNING' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
          }>
            v2: {v2Budget.rxPower.toFixed(2)} dBm ({v2Budget.status})
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs border-t border-slate-100 pt-2.5">
        <div className="space-y-1.5 border-r border-slate-100 pr-3">
          <span className="font-bold text-slate-500 text-[10px] uppercase block">v1 (Old Run) Link Specs</span>
          <div className="flex justify-between">
            <span className="text-slate-400">Max Fiber Distance:</span>
            <span className="font-medium text-slate-700">{v1Budget.distKm.toFixed(3)} km</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Fiber Loss (0.22dB/km):</span>
            <span className="font-medium text-slate-700">{v1Budget.fiberLoss.toFixed(2)} dB</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Total Splitting Loss:</span>
            <span className="font-medium text-slate-700">{v1Budget.splitLoss.toFixed(1)} dB</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Connectors & Splices:</span>
            <span className="font-medium text-slate-700">{(v1Budget.connLoss + v1Budget.spliceLoss).toFixed(2)} dB</span>
          </div>
          <div className="flex justify-between font-semibold border-t border-slate-100/50 pt-1 text-[11px]">
            <span className="text-slate-700">Total Path Loss:</span>
            <span className="text-slate-800">{v1Budget.totalLoss.toFixed(2)} dB</span>
          </div>
        </div>

        <div className="space-y-1.5 pl-1">
          <span className="font-bold text-slate-500 text-[10px] uppercase block text-emerald-600">v2 (Optimized) Link Specs</span>
          <div className="flex justify-between">
            <span className="text-slate-400">Max Fiber Distance:</span>
            <span className="font-medium text-slate-700">{v2Budget.distKm.toFixed(3)} km</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Fiber Loss (0.22dB/km):</span>
            <span className="font-medium text-emerald-600">{v2Budget.fiberLoss.toFixed(2)} dB</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Total Splitting Loss:</span>
            <span className="font-medium text-slate-700">{v2Budget.splitLoss.toFixed(1)} dB</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Connectors & Splices:</span>
            <span className="font-medium text-slate-700">{(v2Budget.connLoss + v2Budget.spliceLoss).toFixed(2)} dB</span>
          </div>
          <div className="flex justify-between font-semibold border-t border-slate-100/50 pt-1 text-[11px] text-emerald-600">
            <span className="text-emerald-700">Total Path Loss:</span>
            <span className="text-emerald-800">{v2Budget.totalLoss.toFixed(2)} dB</span>
          </div>
        </div>
      </div>

      {v2Budget.status === 'FAIL' && (
        <div className="bg-red-50 text-red-700 text-[10px] rounded p-2 border border-red-100">
          ⚠️ <b>Link Budget Violation:</b> Total optical attenuation exceeds 26 dB limit (Rule 86). Expected received signal power is below -27 dBm. Please check DP placement or reduce splitter levels.
        </div>
      )}
    </div>
  );
}
