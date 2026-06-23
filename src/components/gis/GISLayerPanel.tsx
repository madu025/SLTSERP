// ============================================================================
// GISLayerPanel Component - Layer management panel for GIS map data
// ============================================================================
// Side panel that displays detailed information about each GIS layer,
// including feature counts, route statistics, and layer status indicators.
// REDESIGN: Compact single data grid replacing 6 individual cards.
// ============================================================================

'use client';

import React, { useState, useMemo } from 'react';
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
}: GISLayerPanelProps) {
  const [activeTab, setActiveTab] = useState('summary');

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

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100 border border-gray-200">
          <TabsTrigger value="summary" className="text-xs">Layers</TabsTrigger>
          <TabsTrigger value="routes" className="text-xs">Routes</TabsTrigger>
          <TabsTrigger value="boq" className="text-xs">BOQ</TabsTrigger>
          <TabsTrigger value="surveys" className="text-xs">Surveys</TabsTrigger>
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
      </Tabs>
    </div>
  );
}