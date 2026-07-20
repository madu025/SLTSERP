"use client";

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Sparkles, 
  MapPin, 
  Layers, 
  AlertTriangle, 
  Search, 
  TrendingUp, 
  Activity, 
  Filter 
} from 'lucide-react';
import { GISValidatorService, GISAnomaly } from '@/lib/gis/gis-ai-validator';

interface GISRouteData {
  id: string;
  projectId: string;
  name: string;
  versionType: string;
  routeLength: number | null;
  geojsonData: any;
  project: {
    name: string;
    projectCode: string;
  };
}

// Map Centering Controller
function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

// ─── Map Resize Handler to prevent grey map/disappearance ─────────────────────
function MapResizeHandler() {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
      const resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      const container = map.getContainer();
      if (container) {
        resizeObserver.observe(container);
      }
      return () => {
        clearTimeout(timer);
        resizeObserver.disconnect();
      };
    }

    return () => clearTimeout(timer);
  }, [map]);

  return null;
}

export default function NationalInfraMap() {
  const [routes, setRoutes] = useState<GISRouteData[]>([]);
  const [filteredRoutes, setFilteredRoutes] = useState<GISRouteData[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<GISRouteData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [mapCenter, setMapCenter] = useState<[number, number]>([7.8731, 80.7718]); // Center of Sri Lanka
  const [mapZoom, setMapZoom] = useState(8);
  const [anomalies, setAnomalies] = useState<GISAnomaly[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbStats, setDbStats] = useState({
    polesCount: 0,
    chambersCount: 0,
    closuresCount: 0,
    totalCableLength: 0
  });

  useEffect(() => {
    const fetchMapData = async () => {
      try {
        const res = await fetch('/api/gis/map-data');
        if (res.ok) {
          const data = await res.json();
          if (data && data.routes) {
            setRoutes(data.routes);
            setFilteredRoutes(data.routes);
            if (data.stats) {
              setDbStats(data.stats);
            }
          } else {
            const rList = Array.isArray(data) ? data : [];
            setRoutes(rList);
            setFilteredRoutes(rList);
          }
        }
      } catch (err) {
        console.error("Failed to load national map data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMapData();
  }, []);

  // Filter & Search Logic
  useEffect(() => {
    let result = routes;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.project.name.toLowerCase().includes(q) || 
        r.project.projectCode.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q)
      );
    }
    if (filterType !== 'ALL') {
      result = result.filter(r => r.versionType === filterType);
    }
    setFilteredRoutes(result);
  }, [searchQuery, filterType, routes]);

  // Handle Project Selection and trigger AI Anomaly Detection
  const handleSelectRoute = (route: GISRouteData) => {
    setSelectedRoute(route);
    
    // Anomaly AI check
    if (route.geojsonData) {
      const detected = GISValidatorService.detectGISAnomalies(route.geojsonData);
      setAnomalies(detected);

      // Find first coordinate to center map
      const features = route.geojsonData.features || [];
      const firstFeature = features.find((f: any) => f.geometry?.coordinates);
      if (firstFeature) {
        const geom = firstFeature.geometry;
        if (geom.type === 'Point') {
          setMapCenter([geom.coordinates[1], geom.coordinates[0]]);
        } else if (geom.type === 'LineString' && geom.coordinates.length > 0) {
          setMapCenter([geom.coordinates[0][1], geom.coordinates[0][0]]);
        }
        setMapZoom(15);
      }
    } else {
      setAnomalies([]);
    }
  };

  // Summarize stats using DB-level aggregates as primary (fallback to client-side count if 0)
  const displayPolesCount = dbStats.polesCount || routes.reduce((sum, r) => {
    const features = r.geojsonData?.features || [];
    return sum + features.filter((f: any) => f.geometry?.type === 'Point' && (f.properties?.layer || f.properties?.Layer || '').toUpperCase().includes('POLE')).length;
  }, 0);

  const displayCableLength = dbStats.totalCableLength || routes.reduce((sum, r) => sum + (r.routeLength || 0), 0);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* ─── Sidebar Panel (Left) ───────────────────────────────────────────────── */}
      <div className="w-full lg:w-96 bg-slate-950 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold tracking-wider text-slate-200">SRI LANKA CABLE MAP</h2>
          </div>
          <p className="text-xs text-slate-400">Interactive overview of all active telecommunication infrastructure projects.</p>
        </div>

        {/* Dynamic AI Analytics Cards */}
        <div className="p-3 grid grid-cols-2 gap-2 bg-slate-950">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider">Total Poles</span>
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-base font-bold text-slate-100">{displayPolesCount}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider">Cable Dist</span>
              <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <p className="text-base font-bold text-slate-100">{(displayCableLength / 1000).toFixed(1)} km</p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="p-3 border-b border-slate-800 bg-slate-950 flex flex-col gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input 
              type="text" 
              placeholder="Search project code/name..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            <select 
              value={filterType} 
              onChange={e => setFilterType(e.target.value)}
              className="bg-transparent text-xs text-slate-300 w-full focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Versions</option>
              <option value="PLANNED" className="bg-slate-900">Planned Map</option>
              <option value="AS_BUILT" className="bg-slate-900">As-Built Survey</option>
              <option value="FIELD_CHANGE" className="bg-slate-900">Field Changes</option>
            </select>
          </div>
        </div>

        {/* Projects List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2 no-scrollbar">
          {isLoading ? (
            <p className="text-center text-xs text-slate-500 py-8">Loading map assets...</p>
          ) : filteredRoutes.length === 0 ? (
            <p className="text-center text-xs text-slate-500 py-8">No matching projects found.</p>
          ) : (
            filteredRoutes.map(r => (
              <div 
                key={r.id} 
                onClick={() => handleSelectRoute(r)}
                className={`p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                  selectedRoute?.id === r.id 
                    ? 'bg-slate-900 border-indigo-500/50 shadow-lg shadow-indigo-500/10' 
                    : 'bg-slate-950 border-slate-800/80 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">{r.project.projectCode}</span>
                  <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full uppercase">{r.versionType}</span>
                </div>
                <h4 className="text-xs font-bold text-slate-200 truncate">{r.project.name}</h4>
                <p className="text-[10px] text-slate-400 mt-1">Route Name: {r.name}</p>
                <p className="text-[10px] text-slate-400">Length: {r.routeLength ? `${(r.routeLength / 1000).toFixed(2)} km` : 'N/A'}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ─── Map & AI Anomalies Panel (Right) ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col relative bg-slate-900">
        
        {/* Floating AI Anomaly Panel */}
        {selectedRoute && anomalies.length > 0 && (
          <div className="absolute top-4 right-4 z-[999] w-80 bg-slate-950/95 border border-red-500/30 rounded-xl p-3 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-1.5 text-red-400 mb-2">
              <AlertTriangle className="w-4 h-4" />
              <h4 className="text-xs font-bold tracking-wider uppercase">AI Geospatial Alerts</h4>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
              {anomalies.map((a, i) => (
                <div key={i} className="p-2 bg-red-950/20 border border-red-500/10 rounded-lg text-[10px] text-red-200 flex flex-col gap-0.5">
                  <span className="font-bold text-red-400">{a.type}</span>
                  <span>{a.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected Project Overview Bar */}
        {selectedRoute && (
          <div className="absolute top-4 left-4 z-[999] bg-slate-950/90 border border-slate-800 rounded-xl p-3 shadow-xl flex items-center gap-3 backdrop-blur-sm">
            <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
            <div>
              <h3 className="text-xs font-bold text-slate-200">{selectedRoute.project.name}</h3>
              <p className="text-[10px] text-slate-400">Length: {selectedRoute.routeLength ? `${selectedRoute.routeLength.toFixed(1)}m` : 'N/A'} | Anomalies: {anomalies.length}</p>
            </div>
          </div>
        )}

        {/* Leaflet Map rendering */}
        <div className="flex-1 h-full w-full z-0">
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: '100%', width: '100%' }}
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapRecenter center={mapCenter} />
            <MapResizeHandler />

            {/* Render all routes */}
            {filteredRoutes.map((r) => {
              const features = r.geojsonData?.features || [];
              const isSelected = selectedRoute?.id === r.id;
              const lineColor = isSelected ? '#6366f1' : '#334155';
              const lineWeight = isSelected ? 4 : 2;
              const lineOpacity = isSelected ? 0.9 : 0.6;

              return features.flatMap((f: any, idx: number) => {
                const geom = f.geometry;
                if (!geom) return [];
                const props = f.properties || {};
                const layerName = (props.layer || props.Layer || props.LAYER || props.layerType || '').toUpperCase();

                // ── LineString ────────────────────────────────────
                if (geom.type === 'LineString' && Array.isArray(geom.coordinates)) {
                  const path: [number, number][] = geom.coordinates.map((c: any) => [c[1], c[0]]);
                  return [(
                    <Polyline key={`line-${r.id}-${idx}`} positions={path} color={lineColor} weight={lineWeight} opacity={lineOpacity}>
                      <Popup>
                        <div className="text-xs font-bold text-slate-900">{r.project.name}</div>
                        <div className="text-[10px] text-slate-700">Route: {r.name}</div>
                        {props.cable_type && <div className="text-[10px] text-slate-600">Cable: {props.cable_type}</div>}
                        {props.fiber_count && <div className="text-[10px] text-slate-600">Fibers: {props.fiber_count}F</div>}
                        {props.installation_method && <div className="text-[10px] text-slate-600">Method: {props.installation_method}</div>}
                        {props.length && <div className="text-[10px] text-slate-600">Length: {parseFloat(props.length).toFixed(1)}m</div>}
                      </Popup>
                    </Polyline>
                  )];
                }

                // ── MultiLineString (QGIS exports) ────────────────
                if (geom.type === 'MultiLineString' && Array.isArray(geom.coordinates)) {
                  return geom.coordinates.map((segment: any[], segIdx: number) => {
                    const path: [number, number][] = segment.map((c: any) => [c[1], c[0]]);
                    return (
                      <Polyline key={`mline-${r.id}-${idx}-${segIdx}`} positions={path} color={lineColor} weight={lineWeight} opacity={lineOpacity}>
                        <Popup>
                          <div className="text-xs font-bold text-slate-900">{r.project.name}</div>
                          <div className="text-[10px] text-slate-700">Route: {r.name} (segment {segIdx + 1})</div>
                          {props.cable_type && <div className="text-[10px] text-slate-600">Cable: {props.cable_type}</div>}
                          {props.fiber_count && <div className="text-[10px] text-slate-600">Fibers: {props.fiber_count}F</div>}
                        </Popup>
                      </Polyline>
                    );
                  });
                }

                // ── Point Assets ──────────────────────────────────
                if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
                  const lat = geom.coordinates[1];
                  const lng = geom.coordinates[0];

                  // Color-coded by asset type
                  let fillColor = '#f59e0b'; // default: amber for FDP/Joint
                  let radius = 5;
                  let assetLabel = 'Asset';

                  if (layerName.includes('FEED')) {
                    fillColor = '#10b981'; radius = 7; assetLabel = 'Feed Point';
                  } else if (layerName.includes('POLE')) {
                    fillColor = '#10b981'; radius = 4; assetLabel = 'Pole';
                  } else if (layerName.includes('CHAMBER')) {
                    fillColor = '#3b82f6'; radius = 6; assetLabel = 'Chamber';
                  } else if (layerName.includes('MANHOLE')) {
                    fillColor = '#8b5cf6'; radius = 6; assetLabel = 'Manhole';
                  } else if (layerName.includes('ODF')) {
                    fillColor = '#ec4899'; radius = 5; assetLabel = 'ODF';
                  } else if (layerName.includes('FDP') || layerName.includes('CLOSURE')) {
                    fillColor = '#f59e0b'; radius = 5; assetLabel = 'FDP/Closure';
                  } else if (layerName.includes('HANDHOLE')) {
                    fillColor = '#06b6d4'; radius = 5; assetLabel = 'Handhole';
                  }

                  return [(
                    <CircleMarker
                      key={`point-${r.id}-${idx}`}
                      center={[lat, lng]}
                      radius={radius}
                      fillColor={fillColor}
                      color="#0f172a"
                      weight={1}
                      fillOpacity={isSelected ? 0.95 : 0.5}
                    >
                      <Popup>
                        <div className="text-xs font-bold text-slate-900">{assetLabel}</div>
                        {props.pole_number && <div className="text-[10px] text-slate-700">No: {props.pole_number}</div>}
                        {props.pole_type && <div className="text-[10px] text-slate-600">Type: {props.pole_type}</div>}
                        {props.height && <div className="text-[10px] text-slate-600">Height: {props.height}m</div>}
                        {props.capacity && <div className="text-[10px] text-slate-600">Capacity: {props.capacity}</div>}
                        <div className="text-[10px] text-slate-500 mt-1">{lat.toFixed(6)}, {lng.toFixed(6)}</div>
                      </Popup>
                    </CircleMarker>
                  )];
                }

                return [];
              });
            })}

            {/* Render AI Anomalies dynamically as warning markers */}
            {selectedRoute && anomalies.map((a, i) => (
              <CircleMarker
                key={`anomaly-${i}`}
                center={a.coordinates}
                radius={8}
                fillColor="#ef4444"
                color="#7f1d1d"
                weight={2}
                fillOpacity={0.8}
              >
                <Popup>
                  <div className="text-xs font-bold text-red-600">{a.type}</div>
                  <div className="text-[10px] text-slate-800">{a.message}</div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        {/* Map Legend */}
        <div className="absolute bottom-4 left-4 z-[999] bg-slate-950/90 border border-slate-800 rounded-xl p-3 shadow-xl backdrop-blur-sm">
          <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-2">Legend</p>
          <div className="space-y-1">
            {[
              { color: '#6366f1', label: 'Selected Cable Route', shape: 'line' },
              { color: '#334155', label: 'Cable Route', shape: 'line' },
              { color: '#10b981', label: 'Pole', shape: 'circle' },
              { color: '#3b82f6', label: 'Chamber', shape: 'circle' },
              { color: '#8b5cf6', label: 'Manhole', shape: 'circle' },
              { color: '#ec4899', label: 'ODF', shape: 'circle' },
              { color: '#f59e0b', label: 'FDP / Closure', shape: 'circle' },
              { color: '#ef4444', label: 'AI Anomaly', shape: 'circle' },
            ].map(({ color, label, shape }) => (
              <div key={label} className="flex items-center gap-2">
                {shape === 'line' ? (
                  <div className="w-5 h-0.5 rounded" style={{ backgroundColor: color }} />
                ) : (
                  <div className="w-2.5 h-2.5 rounded-full border border-slate-900" style={{ backgroundColor: color }} />
                )}
                <span className="text-[9px] text-slate-300">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

