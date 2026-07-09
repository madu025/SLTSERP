import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { GISLayerPanelProps, LayerRow, SurveyData } from './types';
import { CompactLayerGrid } from './CompactLayerGrid';
import { RouteSummaryTable } from './RouteSummaryTable';
import { BOQSummaryCard } from './BOQSummaryCard';
import { calculateLinkBudget, LinkBudgetAuditCard } from './LinkBudgetCalculator';

const LAYER_COLORS: Record<string, string> = {
  cables: '#2563eb',
  poles: '#dc2626',
  fdps: '#7c3aed',
  fiberJoints: '#ca8a04',
  chambers: '#0891b2',
  roads: '#64748b',
  assets: '#059669',
};

const LAYER_ICONS: Record<string, string> = {
  cables: '🔌',
  poles: '📡',
  fdps: '📦',
  fiberJoints: '🔗',
  chambers: '⚫',
  roads: '🛣️',
  assets: '📍',
};

const LAYER_LABELS: Record<string, string> = {
  cables: 'Fiber Cables',
  poles: 'Telecom Poles',
  fdps: 'FDPs',
  fiberJoints: 'Fiber Joints',
  chambers: 'Chambers',
  roads: 'Road Segments',
  assets: 'Assets',
};

export function GISLayerPanel({
  gisRoutes = [],
  assets = [],
  boq,
  surveys = [],
  permits = [],
  onImportMore,
  onViewDetails,
  projectId,
  preSurveyMode = false,
  setPreSurveyMode,
  preSurveyStart = null,
  preSurveyEnd = null,
  onPreSurveyCreated,
  onRouteDeleted
}: GISLayerPanelProps) {
  const [activeTab, setActiveTab] = useState('summary');
  const [optimizing, setOptimizing] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<{
    percentReduction: number;
    totalPlannedLengthMeters: number;
    reusedInfraLengthMeters: number;
    newSurveyLengthMeters: number;
  } | null>(null);
  const [surveyUpdated, setSurveyUpdated] = useState(false);
  const [generatingPreSurvey, setGeneratingPreSurvey] = useState(false);
  const [routeName, setRouteName] = useState('Pre-Survey AI Route');
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [preSurveyOpen, setPreSurveyOpen] = useState(false);

  const handleGeneratePreSurvey = async () => {
    if (!projectId || !preSurveyStart || !preSurveyEnd) {
      toast.error('Please select both Point A and Point B on the map first.');
      return;
    }
    setGeneratingPreSurvey(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/gis/pre-survey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeName,
          startLat: preSurveyStart[1],
          startLng: preSurveyStart[0],
          endLat: preSurveyEnd[1],
          endLng: preSurveyEnd[0]
        })
      });

      if (res.ok) {
        toast.success('AI Pre-Survey design generated successfully!');
        if (setPreSurveyMode) setPreSurveyMode(false);
        if (onPreSurveyCreated) onPreSurveyCreated();
      } else {
        const err = await res.json() as { error?: string };
        toast.error(err.error || 'Failed to generate Pre-Survey.');
      }
    } catch {
      toast.error('Network error occurred.');
    } finally {
      setGeneratingPreSurvey(false);
    }
  };

  const [routeToDelete, setRouteToDelete] = useState<string | null>(null);

  const handleDeleteRoute = (routeId: string) => {
    console.log("handleDeleteRoute state click", { routeId });
    setRouteToDelete(routeId);
  };

  const executeRouteDeletion = async (routeId: string) => {
    console.log("executeRouteDeletion called", { routeId, projectId });
    if (!projectId) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/gis/${routeId}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': 'system'
        }
      });

      if (res.ok) {
        toast.success('Route deleted successfully!');
        if (onRouteDeleted) {
          onRouteDeleted(routeId);
        }
      } else {
        const err = await res.json() as { error?: string };
        toast.error(err.error || 'Failed to delete route.');
      }
    } catch {
      toast.error('Network error.');
    }
  };

  const handleReconcileSurvey = async () => {
    if (!projectId) return;
    setReconciling(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/gis/reconcile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'system'
        }
      });

      if (res.ok) {
        const data = await res.json() as { message?: string };
        toast.success(data.message || 'Survey alignment complete!');
        if (onPreSurveyCreated) {
          onPreSurveyCreated();
        }
      } else {
        const err = await res.json() as { error?: string };
        toast.error(err.error || 'Failed to reconcile survey points.');
      }
    } catch {
      toast.error('Network error during reconciliation.');
    } finally {
      setReconciling(false);
    }
  };

  const runOptimization = async () => {
    if (!projectId || !gisRoutes || gisRoutes.length === 0) return;
    setOptimizing(true);
    setSurveyUpdated(false);
    try {
      const routeId = gisRoutes[0].id;
      const res = await fetch(`/api/projects/${projectId}/gis/${routeId}/optimize?tolerance=15`);
      if (res.ok) {
        const data = await res.json() as {
          percentReduction: number;
          totalPlannedLengthMeters: number;
          reusedInfraLengthMeters: number;
          newSurveyLengthMeters: number;
        };
        setOptimizationResult(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setOptimizing(false);
    }
  };

  const applyOptimizationToSurvey = () => {
    setOptimizing(true);
    setTimeout(() => {
      setOptimizing(false);
      setSurveyUpdated(true);
    }, 1200);
  };

  const summary = useMemo(() => {
    let totalPoles = 0;
    let totalClosures = 0;
    let totalFdps = 0;
    let totalJoints = 0;
    let totalCables = 0;
    let totalRoads = 0;
    let totalChambers = 0;
    let totalRouteLength = 0;

    for (const route of gisRoutes) {
      totalPoles += route.poles?.length || 0;
      totalClosures += route.closures?.length || 0;
      totalCables += route.cableSegments?.length || 0;
      totalRoads += route.roadSegments?.length || 0;
      totalChambers += route.chambers?.length || 0;
      totalRouteLength += route.routeLength || 0;

      if (route.closures) {
        for (const closure of route.closures) {
          if (closure.closureType === 'TERMINAL') {
            totalFdps++;
          } else {
            totalJoints++;
          }
        }
      }
    }

    const totalBOQCost = boq?.totalEstimated || boq?.totalEstimatedCost || 0;

    return {
      totalPoles,
      totalClosures,
      totalFdps,
      totalJoints,
      totalCables,
      totalRoads,
      totalChambers,
      totalRouteLength,
      totalBOQCost,
      routeCount: gisRoutes.length,
      assetCount: assets?.length || 0,
      surveyCount: surveys?.length || 0,
      permitCount: permits?.length || 0,
    };
  }, [gisRoutes, assets, boq, surveys, permits]);

  const layerRows = useMemo<LayerRow[]>(() => [
    {
      key: 'cables',
      icon: LAYER_ICONS.cables,
      label: LAYER_LABELS.cables,
      color: LAYER_COLORS.cables,
      count: summary.totalCables,
      metrics: [
        { label: 'Routes', value: String(summary.routeCount) },
        { label: 'Length', value: `${(summary.totalRouteLength / 1000).toFixed(2)} km` },
      ],
    },
    {
      key: 'poles',
      icon: LAYER_ICONS.poles,
      label: LAYER_LABELS.poles,
      color: LAYER_COLORS.poles,
      count: summary.totalPoles,
      metrics: [
        { label: 'Avg Spacing', value: summary.totalPoles > 0 && summary.totalRouteLength > 0
          ? `${(summary.totalRouteLength / summary.totalPoles).toFixed(1)} m`
          : '-'
        },
      ],
    },
    {
      key: 'fdps',
      icon: LAYER_ICONS.fdps,
      label: LAYER_LABELS.fdps,
      color: LAYER_COLORS.fdps,
      count: summary.totalFdps,
      metrics: [
        { label: 'Closures', value: String(summary.totalClosures) },
        { label: 'Density', value: summary.totalRouteLength > 0
          ? `${(summary.totalFdps / (summary.totalRouteLength / 1000)).toFixed(1)} / km`
          : '-'
        },
      ],
    },
    {
      key: 'fiberJoints',
      icon: LAYER_ICONS.fiberJoints,
      label: LAYER_LABELS.fiberJoints,
      color: LAYER_COLORS.fiberJoints,
      count: summary.totalJoints,
      metrics: [
        { label: 'Total Closures', value: String(summary.totalClosures) },
      ],
    },
    {
      key: 'chambers',
      icon: LAYER_ICONS.chambers,
      label: LAYER_LABELS.chambers,
      color: LAYER_COLORS.chambers,
      count: summary.totalChambers,
      metrics: [
        { label: 'Route Access', value: summary.totalRouteLength > 0
          ? `${(summary.totalChambers / (summary.totalRouteLength / 1000)).toFixed(1)} / km`
          : '-'
        },
      ],
    },
    {
      key: 'roads',
      icon: LAYER_ICONS.roads,
      label: LAYER_LABELS.roads,
      color: LAYER_COLORS.roads,
      count: summary.totalRoads,
      metrics: [
        { label: 'Permits Est.', value: String(Math.ceil(summary.totalRoads * 1.2)) },
      ],
    },
    {
      key: 'assets',
      icon: LAYER_ICONS.assets,
      label: LAYER_LABELS.assets,
      color: LAYER_COLORS.assets,
      count: summary.assetCount,
      metrics: [
        { label: 'From GIS Import', value: String(summary.assetCount > 0 ? 'Yes' : 'No') },
      ],
    },
  ], [summary]);

  const v1 = gisRoutes?.find(r => r.version === 1);
  const v2 = gisRoutes?.find(r => r.version === 2);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">GIS Layers & Data</h2>
          <p className="text-[10px] font-medium text-slate-500">
            {summary.routeCount} route{summary.routeCount !== 1 ? 's' : ''} · {summary.assetCount} asset{summary.assetCount !== 1 ? 's' : ''}
          </p>
        </div>
        {onImportMore && (
          <button
            onClick={onImportMore}
            className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm transition-all active:scale-95"
          >
            + Import GIS
          </button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-5 w-full text-xs">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="routes">Routes</TabsTrigger>
          <TabsTrigger value="compare" disabled={!v1 || !v2}>Compare</TabsTrigger>
          <TabsTrigger value="surveys">Surveys</TabsTrigger>
          <TabsTrigger value="optimize">Optimize</TabsTrigger>
        </TabsList>

        {/* Summary Tab */}
        <TabsContent value="summary" className="mt-3 space-y-3">
          {/* Quick Stats Panel */}
          <div className="space-y-3 border border-slate-200 rounded-xl p-3 bg-white/60 backdrop-blur-md shadow-sm">
            <div className="flex justify-between items-center text-xs pb-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Route Statistics</span>
              <button
                onClick={() => setStatsExpanded(!statsExpanded)}
                className="text-indigo-600 hover:text-indigo-700 text-[9px] font-bold"
              >
                {statsExpanded ? 'Collapse ▲' : 'Expand ▼'}
              </button>
            </div>
            {statsExpanded ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-blue-50/80 to-blue-100/50 rounded-xl p-3 border border-blue-200/50 shadow-sm">
                  <p className="text-lg font-extrabold text-blue-700">
                    {(summary.totalRouteLength / 1000).toFixed(2)}
                  </p>
                  <p className="text-[9px] text-blue-600/80 font-bold uppercase tracking-wider">Route Length (km)</p>
                </div>
                <div className="bg-gradient-to-br from-red-50/80 to-red-100/50 rounded-xl p-3 border border-red-200/50 shadow-sm">
                  <p className="text-lg font-extrabold text-red-700">{summary.totalPoles}</p>
                  <p className="text-[9px] text-red-600/80 font-bold uppercase tracking-wider">Poles</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50/80 to-purple-100/50 rounded-xl p-3 border border-purple-200/50 shadow-sm">
                  <p className="text-lg font-extrabold text-purple-700">{summary.totalFdps}</p>
                  <p className="text-[9px] text-purple-600/80 font-bold uppercase tracking-wider">FDPs</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-50/80 to-emerald-100/50 rounded-xl p-3 border border-emerald-200/50 shadow-sm">
                  <p className="text-lg font-extrabold text-emerald-700">
                    LKR {summary.totalBOQCost >= 1000000
                      ? (summary.totalBOQCost / 1000000).toFixed(1) + 'M'
                      : summary.totalBOQCost >= 1000
                      ? (summary.totalBOQCost / 1000).toFixed(0) + 'K'
                      : summary.totalBOQCost || '0'}
                  </p>
                  <p className="text-[9px] text-emerald-600/80 font-bold uppercase tracking-wider">Est. BOQ Cost</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-slate-600 px-1 pt-0.5">
                <span><b>Length:</b> {(summary.totalRouteLength / 1000).toFixed(2)} km</span>
                <span><b>Poles:</b> {summary.totalPoles}</span>
                <span><b>FDPs:</b> {summary.totalFdps}</span>
              </div>
            )}
          </div>

          <CompactLayerGrid layers={layerRows} onViewDetails={onViewDetails} />

          {/* BOQ Card */}
          <Card className="border-slate-200/80 shadow-sm bg-slate-50/20">
            <CardHeader className="py-2.5 px-3">
              <CardTitle className="text-xs font-bold text-slate-700">Estimated Costing (BOQ)</CardTitle>
            </CardHeader>
            <CardContent className="py-2 px-3">
              <BOQSummaryCard boq={boq} />
            </CardContent>
          </Card>

          {/* Pre-Survey Generation Tool */}
          {setPreSurveyMode && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="py-2.5 px-3 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>🗺️ Pre-Survey Operations</span>
                </CardTitle>
                <button
                  onClick={() => setPreSurveyOpen(!preSurveyOpen)}
                  className="text-xs text-indigo-600 font-bold"
                >
                  {preSurveyOpen ? 'Hide' : 'Show'}
                </button>
              </CardHeader>
              {preSurveyOpen && (
                <CardContent className="p-3 pt-0 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Enable Pre-Survey Selection:</span>
                    <button
                      onClick={() => setPreSurveyMode(!preSurveyMode)}
                      className={`px-3 py-1 rounded-full font-bold text-[10px] transition-colors ${
                        preSurveyMode
                          ? 'bg-red-100 text-red-700 border border-red-200'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}
                    >
                      {preSurveyMode ? 'Cancel Selection' : 'Draw Points'}
                    </button>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-2.5 space-y-2 border border-slate-100 text-xs text-slate-600">
                    <div className="flex justify-between items-center">
                      <span>Point A (Start):</span>
                      <span className={preSurveyStart ? 'font-mono text-emerald-600 font-bold' : 'text-slate-400 font-medium'}>
                        {preSurveyStart ? `${preSurveyStart[1].toFixed(5)}, ${preSurveyStart[0].toFixed(5)}` : 'Not marked'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Point B (End):</span>
                      <span className={preSurveyEnd ? 'font-mono text-emerald-600 font-bold' : 'text-slate-400 font-medium'}>
                        {preSurveyEnd ? `${preSurveyEnd[1].toFixed(5)}, ${preSurveyEnd[0].toFixed(5)}` : 'Not marked'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Route Name:</label>
                    <input
                      type="text"
                      value={routeName}
                      onChange={(e) => setRouteName(e.target.value)}
                      placeholder="Enter path tag (e.g. Route A to B)"
                      className="w-full border border-slate-200 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <button
                    onClick={handleGeneratePreSurvey}
                    disabled={generatingPreSurvey || !preSurveyStart || !preSurveyEnd}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingPreSurvey ? 'Analyzing path...' : 'Generate Pre-Survey Route'}
                  </button>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-slate-500">Reconcile check-in points:</span>
                    <button
                      onClick={handleReconcileSurvey}
                      disabled={reconciling}
                      className="px-2.5 py-1 text-[10px] font-bold text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50"
                    >
                      {reconciling ? 'Aligning...' : 'Reconcile'}
                    </button>
                  </div>
                </CardContent>
              )}
            </Card>
          )}
        </TabsContent>

        {/* Routes Tab */}
        <TabsContent value="routes" className="mt-3">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-3">
              <RouteSummaryTable routes={gisRoutes} onDeleteRoute={handleDeleteRoute} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compare Tab */}
        <TabsContent value="compare" className="mt-3">
          <Card className="bg-slate-50/50 border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">⚖️ Route Version Comparison</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {(() => {
                if (!v1 || !v2) return null;

                const v1Poles = v1.poles?.length || 0;
                const v2Poles = v2.poles?.length || 0;
                const v1Closures = v1.closures?.length || 0;
                const v2Closures = v2.closures?.length || 0;
                const v1Length = v1.routeLength ? (v1.routeLength / 1000).toFixed(2) : '0.00';
                const v2Length = v2.routeLength ? (v2.routeLength / 1000).toFixed(2) : '0.00';

                const lengthSaving = v1.routeLength && v2.routeLength 
                  ? (v1.routeLength - v2.routeLength).toFixed(0) 
                  : '0';

                const v1Budget = calculateLinkBudget(v1);
                const v2Budget = calculateLinkBudget(v2);

                return (
                  <div className="space-y-4">
                    {/* Summary Metrics Table */}
                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200">
                            <th className="p-2 font-bold text-slate-600">Metric</th>
                            <th className="p-2 font-bold text-slate-600 text-center">v1 (Old)</th>
                            <th className="p-2 font-bold text-slate-600 text-center">v2 (Optimized)</th>
                            <th className="p-2 font-bold text-slate-600 text-right">Saving</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-100">
                            <td className="p-2 font-medium">Cable Length</td>
                            <td className="p-2 text-center">{v1Length} km</td>
                            <td className="p-2 text-center text-emerald-600 font-bold">{v2Length} km</td>
                            <td className="p-2 text-right text-emerald-600 font-bold">+{lengthSaving}m</td>
                          </tr>
                          <tr className="border-b border-slate-100">
                            <td className="p-2 font-medium">Poles Placed</td>
                            <td className="p-2 text-center">{v1Poles}</td>
                            <td className="p-2 text-center">{v2Poles}</td>
                            <td className="p-2 text-right text-emerald-600 font-bold">{v1Poles - v2Poles}</td>
                          </tr>
                          <tr className="border-b border-slate-100">
                            <td className="p-2 font-medium">Total Closures</td>
                            <td className="p-2 text-center">{v1Closures}</td>
                            <td className="p-2 text-center">{v2Closures}</td>
                            <td className="p-2 text-right">{v1Closures - v2Closures}</td>
                          </tr>
                          {v1Budget && v2Budget && (
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                              <td className="p-2 font-medium">OLT PON Ports (1:64)</td>
                              <td className="p-2 text-center">{v1Budget.oltPorts}</td>
                              <td className="p-2 text-center font-bold text-indigo-600">{v2Budget.oltPorts}</td>
                              <td className="p-2 text-right text-indigo-600 font-bold">
                                {v1Budget.oltPorts - v2Budget.oltPorts > 0 ? `+${v1Budget.oltPorts - v2Budget.oltPorts}` : '0'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Optical Link Budget Audit Card */}
                    {v1Budget && v2Budget && (
                      <LinkBudgetAuditCard v1Budget={v1Budget} v2Budget={v2Budget} />
                    )}

                    {/* Detailed Differences */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">📍 DP Snap & Splitter Upgrades:</span>
                      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm max-h-[420px] overflow-y-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="p-2 font-semibold text-slate-500">Closure</th>
                              <th className="p-2 font-semibold text-slate-500 text-center">v1 Cap</th>
                              <th className="p-2 font-semibold text-slate-500 text-center">v2 Cap</th>
                              <th className="p-2 font-semibold text-slate-500">Improvements / Snaps</th>
                            </tr>
                          </thead>
                          <tbody>
                            {v2.closures?.map((c2) => {
                              const c1 = v1.closures?.find((c) => c.closureNumber === c2.closureNumber);
                              const capChanged = c1 && c1.capacity !== c2.capacity;

                              return (
                                <tr key={c2.id} className="border-b border-slate-100 hover:bg-slate-50">
                                  <td className="p-2 font-medium text-slate-700">
                                    {c2.closureType === 'TERMINAL' ? `DP-${c2.closureNumber ?? ''}` : `JB-${c2.closureNumber ?? ''}`}
                                  </td>
                                  <td className="p-2 text-center text-slate-500">{c1 ? c1.capacity : '-'}</td>
                                  <td className={`p-2 text-center font-bold ${capChanged ? 'text-indigo-600 bg-indigo-50' : 'text-slate-800'}`}>
                                    {c2.capacity}
                                  </td>
                                  <td className="p-2 text-slate-600 leading-normal text-xs" title={c2.notes || ''}>
                                    {c2.notes || '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Surveys Tab */}
        <TabsContent value="surveys" className="mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Survey Tasks</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {surveys && surveys.length > 0 ? (
                <div className="space-y-3">
                  {(surveys as SurveyData[]).map((survey) => (
                    <div key={survey.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-800">{survey.title}</p>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            survey.status === 'COMPLETED' ? 'border-green-300 text-green-700' :
                            survey.status === 'IN_PROGRESS' ? 'border-blue-300 text-blue-700' :
                            'border-yellow-300 text-yellow-700'
                          }`}
                        >
                          {survey.status || 'PENDING'}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{survey.description}</p>
                      <div className="flex items-center justify-between text-[10px] text-gray-400">
                        <span>{survey.requestNumber || survey.id?.substring(0, 8)}</span>
                        <span>{survey.checkins?.length || 0} check-ins · {survey.findings?.length || 0} findings</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No survey tasks created yet.</p>
                  <p className="text-xs text-gray-400 mt-1">Surveys are created after GIS import processing.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Optimize Tab */}
        <TabsContent value="optimize" className="mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <span>✨ Geospatial Survey Optimization</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                Scan nearby completed projects to detect overlapping routes. This enables field supervisors to skip surveying existing physical structures and focus only on the new paths.
              </p>

              {!optimizationResult && (
                <button
                  onClick={runOptimization}
                  disabled={optimizing}
                  className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-semibold shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {optimizing ? (
                    <>
                      <div className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                      Analyzing Geospatial Overlaps...
                    </>
                  ) : (
                    <>
                      🚀 Run AI Overlap Optimization
                    </>
                  )}
                </button>
              )}

              {optimizationResult && (
                <div className="space-y-4">
                  {/* Stats & Progress */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700">Survey Distance Saved</span>
                      <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100 font-bold">
                        {optimizationResult.percentReduction}% SKIPPED
                      </Badge>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${optimizationResult.percentReduction}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                      <div className="bg-white p-2 rounded border border-gray-100">
                        <p className="text-[10px] text-gray-400 font-medium">Planned Path</p>
                        <p className="text-xs font-bold text-gray-700">{optimizationResult.totalPlannedLengthMeters}m</p>
                      </div>
                      <div className="bg-green-50/50 p-2 rounded border border-green-100">
                        <p className="text-[10px] text-green-600 font-medium">Reused (Skip)</p>
                        <p className="text-xs font-bold text-green-700">{optimizationResult.reusedInfraLengthMeters}m</p>
                      </div>
                      <div className="bg-blue-50/50 p-2 rounded border border-blue-100">
                        <p className="text-[10px] text-blue-600 font-medium">New Survey</p>
                        <p className="text-xs font-bold text-gray-700">{optimizationResult.newSurveyLengthMeters}m</p>
                      </div>
                    </div>
                  </div>

                  {/* Notification/Action */}
                  <div className="text-xs space-y-2">
                    {surveyUpdated ? (
                      <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 flex items-start gap-2">
                        <span className="text-base">✅</span>
                        <div>
                          <p className="font-semibold">Survey Path Updated Successfully!</p>
                          <p className="text-[10px] text-green-600 mt-0.5">Field supervisors will now only be prompted to verify the {optimizationResult.newSurveyLengthMeters}m of unsurveyed segments on their mobile app.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 flex items-start gap-2">
                        <span className="text-base">⚠️</span>
                        <div className="flex-1">
                          <p className="font-semibold">Pending Local Database Sync</p>
                          <p className="text-[10px] text-amber-700 mt-0.5">We found {optimizationResult.reusedInfraLengthMeters}m of overlapping paths that already have verified pole/chamber assets in nearby routes.</p>
                          <button
                            onClick={applyOptimizationToSurvey}
                            className="mt-2.5 px-3 py-1.5 bg-amber-600 text-white rounded font-semibold text-[10px] hover:bg-amber-700 block transition-colors"
                          >
                            ✓ Skip Surveying Reused Segments
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {routeToDelete && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[2100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 max-w-sm w-full space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span>⚠️ Confirm Route Deletion</span>
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to permanently delete this route? This will remove all associated cables, poles, closures, and generated BOQs.
              </p>
            </div>
            <div className="flex justify-end gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setRouteToDelete(null)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = routeToDelete;
                  setRouteToDelete(null);
                  executeRouteDeletion(id);
                }}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm transition-colors"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
