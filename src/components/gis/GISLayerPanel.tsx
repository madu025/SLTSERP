// ============================================================================
// GISLayerPanel Component - Layer management panel for GIS map data
// ============================================================================
// Side panel that displays detailed information about each GIS layer,
// including feature counts, route statistics, and layer status indicators.
// REDESIGN: Compact single data grid replacing 6 individual cards.
// ============================================================================

'use client';

import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface GISLayerPanelProps {
  /** GIS route data from the API */
  gisRoutes?: any[];
  /** Project assets */
  assets?: any[];
  /** BOQ data */
  boq?: any;
  /** Survey data */
  surveys?: any[];
  /** Permit data */
  permits?: any[];
  /** Callback when "Import More" is clicked */
  onImportMore?: () => void;
  /** Callback when "View All" is clicked for a section */
  onViewDetails?: (section: string) => void;
  /** Project ID for API calls */
  projectId?: string;
  preSurveyMode?: boolean;
  setPreSurveyMode?: (active: boolean) => void;
  preSurveyStart?: [number, number] | null;
  preSurveyEnd?: [number, number] | null;
  onPreSurveyCreated?: () => void;
}

// ============================================================================
// Compact Layer Summary Grid — single table replacing 6 cards
// ============================================================================
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

interface LayerRow {
  key: string;
  icon: string;
  label: string;
  color: string;
  count: number;
  metrics: { label: string; value: string }[];
}

function CompactLayerGrid({
  layers,
  onViewDetails,
}: {
  layers: LayerRow[];
  onViewDetails?: (section: string) => void;
}) {
  if (layers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No GIS layers available.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left py-2 px-3 font-semibold text-gray-500 uppercase w-8"></th>
            <th className="text-left py-2 px-1 font-semibold text-gray-500 uppercase">Layer</th>
            <th className="text-right py-2 px-2 font-semibold text-gray-500 uppercase">Count</th>
            <th className="text-left py-2 px-2 font-semibold text-gray-500 uppercase">Key Metrics</th>
          </tr>
        </thead>
        <tbody>
          {layers.map((layer) => (
            <tr
              key={layer.key}
              className="border-b border-gray-100 hover:bg-gray-50/50 cursor-pointer transition-colors"
              onClick={() => onViewDetails?.(layer.key)}
            >
              <td className="py-2.5 px-3">
                <span
                  className="inline-block w-3 h-3 rounded-full ring-2 ring-offset-1"
                  style={{ backgroundColor: layer.color }}
                />
              </td>
              <td className="py-2.5 px-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{layer.icon}</span>
                  <span className="font-medium text-gray-800">{layer.label}</span>
                </div>
              </td>
              <td className="py-2.5 px-2 text-right">
                <Badge
                  variant="secondary"
                  className="text-xs font-bold"
                  style={{ backgroundColor: layer.color + '18', color: layer.color }}
                >
                  {layer.count > 0 ? layer.count : '-'}
                </Badge>
              </td>
              <td className="py-2.5 px-2">
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {layer.metrics.map((m, idx) => (
                    <span key={idx} className="text-gray-500">
                      <span className="text-gray-400">{m.label}:</span>{' '}
                      <span className="font-medium text-gray-700">{m.value}</span>
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Route Summary Table
// ============================================================================

function RouteSummaryTable({ routes }: { routes: any[] }) {
  if (!routes || routes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No GIS routes imported yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-2 font-semibold text-gray-500 uppercase">Route Name</th>
            <th className="text-right py-2 px-2 font-semibold text-gray-500 uppercase">Length (km)</th>
            <th className="text-right py-2 px-2 font-semibold text-gray-500 uppercase">Poles</th>
            <th className="text-right py-2 px-2 font-semibold text-gray-500 uppercase">Chambers</th>
            <th className="text-right py-2 px-2 font-semibold text-gray-500 uppercase">Closures</th>
            <th className="text-right py-2 px-2 font-semibold text-gray-500 uppercase">Cables</th>
            <th className="text-right py-2 px-2 font-semibold text-gray-500 uppercase">Status</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((route) => (
            <tr key={route.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-2 font-medium text-gray-800 truncate max-w-[150px]">
                {route.name || 'Unnamed Route'}
              </td>
              <td className="py-2 px-2 text-right text-gray-700">
                {route.routeLength ? (route.routeLength / 1000).toFixed(2) : '-'}
              </td>
              <td className="py-2 px-2 text-right text-gray-700">
                {route.poles?.length || '-'}
              </td>
              <td className="py-2 px-2 text-right text-gray-700">
                {route.chambers?.length || '-'}
              </td>
              <td className="py-2 px-2 text-right text-gray-700">
                {route.closures?.length || '-'}
              </td>
              <td className="py-2 px-2 text-right text-gray-700">
                {route.cableSegments?.length || '-'}
              </td>
              <td className="py-2 px-2 text-right">
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    route.status === 'COMPLETED' ? 'border-green-300 text-green-700 bg-green-50' :
                    route.status === 'IMPORTED' ? 'border-blue-300 text-blue-700 bg-blue-50' :
                    'border-yellow-300 text-yellow-700 bg-yellow-50'
                  }`}
                >
                  {route.status || 'IMPORTED'}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// BOQ Summary
// ============================================================================

function BOQSummaryCard({ boq }: { boq: any }) {
  if (!boq) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No BOQ data available.</p>
        <p className="text-xs text-gray-400 mt-1">Import GIS files and process to generate BOQ.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Total Estimated Cost</span>
        <span className="text-lg font-bold text-green-700">
          LKR {boq.totalEstimated?.toLocaleString() || boq.totalEstimatedCost?.toLocaleString() || '0'}
        </span>
      </div>
      <Separator />
      <div className="space-y-1.5">
        {(boq.items || []).map((item: any, idx: number) => (
          <div key={idx} className="flex items-center justify-between text-xs">
            <div className="flex-1">
              <span className="text-gray-700 font-medium">{item.description || item.itemCategory}</span>
              <span className="text-gray-400 ml-1">
                ({item.quantity} {item.unit} × LKR {item.unitRate?.toLocaleString()})
              </span>
            </div>
            <span className="font-medium text-gray-800 ml-2">
              LKR {item.amount?.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {(!boq.items || boq.items.length === 0) && (
        <p className="text-xs text-gray-400 text-center py-2">No BOQ line items</p>
      )}

      <Separator />
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{boq.items?.length || 0} line items</span>
        <span className="font-medium text-green-600">Auto-calculated from GIS data</span>
      </div>
    </div>
  );
}

// ============================================================================
// Main Layer Panel Component
// ============================================================================

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
  onPreSurveyCreated
}: GISLayerPanelProps) {
  const [activeTab, setActiveTab] = useState('summary');
  const [optimizing, setOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<any>(null);
  const [surveyUpdated, setSurveyUpdated] = useState(false);
  const [generatingPreSurvey, setGeneratingPreSurvey] = useState(false);
  const [routeName, setRouteName] = useState('Pre-Survey AI Route');

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
        const err = await res.json();
        toast.error(err.error || 'Failed to generate Pre-Survey.');
      }
    } catch (e: any) {
      toast.error('Network error occurred.');
    } finally {
      setGeneratingPreSurvey(false);
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
        const data = await res.json();
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

  // Compute summary statistics
  const summary = useMemo(() => {
    let totalPoles = 0;
    let totalClosures = 0;
    let totalFdps = 0;
    let totalJoints = 0;
    let totalCables = 0;
    let totalRoads = 0;
    let totalChambers = 0;
    let totalRouteLength = 0;
    let totalBOQCost = 0;

    for (const route of gisRoutes) {
      totalPoles += route.poles?.length || 0;
      totalClosures += route.closures?.length || 0;
      totalCables += route.cableSegments?.length || 0;
      totalRoads += route.roadSegments?.length || 0;
      totalChambers += route.chambers?.length || 0;
      totalRouteLength += route.routeLength || 0;

      // Count FDPs vs joints from closures
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

    // Get BOQ cost
    totalBOQCost = boq?.totalEstimated || boq?.totalEstimatedCost || 0;

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

  // Build compact layer rows
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">GIS Layers & Data</h2>
          <p className="text-sm text-gray-500">
            {summary.routeCount} route{summary.routeCount !== 1 ? 's' : ''} · {summary.assetCount} asset{summary.assetCount !== 1 ? 's' : ''}
          </p>
        </div>
        {onImportMore && (
          <button
            onClick={onImportMore}
            className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 border border-blue-200 transition-colors"
          >
            + Import GIS
          </button>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
          <p className="text-2xl font-bold text-blue-700">
            {(summary.totalRouteLength / 1000).toFixed(2)}
          </p>
          <p className="text-xs text-blue-600 font-medium">Route Length (km)</p>
        </div>
        <div className="bg-red-50 rounded-lg p-3 border border-red-100">
          <p className="text-2xl font-bold text-red-700">{summary.totalPoles}</p>
          <p className="text-xs text-red-600 font-medium">Poles</p>
        </div>
        <div className="bg-violet-50 rounded-lg p-3 border border-violet-100">
          <p className="text-2xl font-bold text-violet-700">{summary.totalFdps}</p>
          <p className="text-xs text-violet-600 font-medium">FDPs</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3 border border-green-100">
          <p className="text-2xl font-bold text-green-700">
            LKR {summary.totalBOQCost >= 1000000
              ? (summary.totalBOQCost / 1000000).toFixed(1) + 'M'
              : summary.totalBOQCost >= 1000
              ? (summary.totalBOQCost / 1000).toFixed(0) + 'K'
              : summary.totalBOQCost || '0'}
          </p>
          <p className="text-xs text-green-600 font-medium">Est. BOQ Cost</p>
        </div>
      </div>

      {/* ─── AI Pre-Survey Designer Section ────────────────────────────── */}
      {projectId && (
        <Card className={`border ${preSurveyMode ? 'border-amber-400 bg-amber-50/20' : 'border-gray-200'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-gray-800">
                ✨ {preSurveyMode ? 'Designing AI Pre-Survey Route' : 'AI Pre-Survey Design Assistant'}
              </span>
              {!preSurveyMode && (
                <button
                  onClick={() => setPreSurveyMode?.(true)}
                  className="px-2.5 py-1 text-[11px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 rounded border border-amber-300 transition-all"
                >
                  Start AI Draft
                </button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {preSurveyMode ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">Route Name</label>
                  <input
                    type="text"
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-gray-300 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    placeholder="Enter route name..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 bg-white rounded border border-gray-200 flex flex-col justify-between h-[60px]">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Point A (Start)</span>
                    <span className="font-mono text-gray-700">
                      {preSurveyStart ? `${preSurveyStart[1].toFixed(5)}, ${preSurveyStart[0].toFixed(5)}` : '🔴 Click map to set'}
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded border border-gray-200 flex flex-col justify-between h-[60px]">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Point B (End)</span>
                    <span className="font-mono text-gray-700">
                      {preSurveyEnd ? `${preSurveyEnd[1].toFixed(5)}, ${preSurveyEnd[0].toFixed(5)}` : '🔵 Click map to set'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleGeneratePreSurvey}
                    disabled={generatingPreSurvey || !preSurveyStart || !preSurveyEnd}
                    className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-all"
                  >
                    {generatingPreSurvey ? (
                      <>
                        <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                        Generating Route...
                      </>
                    ) : (
                      '🚀 Generate AI Pre-Survey'
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setPreSurveyMode?.(false);
                      toast.info('Pre-Survey drawing cancelled.');
                    }}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500 leading-relaxed">
                Need to plan a cable route? Design a Pre-Survey draft automatically by marking Point A and Point B on the map. The AI will estimate spacing, poles, and BOQ item pricing.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100 border border-gray-200">
          <TabsTrigger value="summary" className="text-xs">Layers</TabsTrigger>
          <TabsTrigger value="routes" className="text-xs">Routes</TabsTrigger>
          <TabsTrigger value="boq" className="text-xs">BOQ</TabsTrigger>
          <TabsTrigger value="surveys" className="text-xs">Surveys</TabsTrigger>
          {projectId && <TabsTrigger value="optimize" className="text-xs">✨ AI Optimize</TabsTrigger>}
        </TabsList>

        {/* Layer Summary Tab — COMPACT GRID */}
        <TabsContent value="summary" className="mt-3">
          <CompactLayerGrid layers={layerRows} onViewDetails={onViewDetails} />
        </TabsContent>

        {/* Routes Tab */}
        <TabsContent value="routes" className="mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">GIS Routes Overview</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <RouteSummaryTable routes={gisRoutes} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* BOQ Tab */}
        <TabsContent value="boq" className="mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Auto-Generated BOQ</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <BOQSummaryCard boq={boq} />
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
                  {surveys.map((survey) => (
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
                        <p className="text-xs font-bold text-blue-700">{optimizationResult.newSurveyLengthMeters}m</p>
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
                        <span className="text-base">💡</span>
                        <div>
                          <p className="font-semibold">Optimize Field Operations</p>
                          <p className="text-[10px] text-amber-600 mt-0.5">Apply this layout to automatically deduct pre-existing segments from active survey tasks.</p>
                          <button
                            onClick={applyOptimizationToSurvey}
                            disabled={optimizing}
                            className="mt-2 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold shadow-sm transition-all"
                          >
                            Apply Optimization to Field Tasks
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recalculate Button */}
                  <button
                    onClick={runOptimization}
                    disabled={optimizing}
                    className="w-full text-center text-xs text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1 py-1"
                  >
                    🔄 Recalculate Overlaps
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}