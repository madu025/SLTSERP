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

  useEffect(() => {
    const fetchMapData = async () => {
      try {
        const res = await fetch('/api/gis/map-data');
        if (res.ok) {
          const data = await res.json();
          setRoutes(data);
          setFilteredRoutes(data);
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

  // Summarize stats
  const totalPolesCount = routes.reduce((sum, r) => {
    const features = r.geojsonData?.features || [];
    return sum + features.filter((f: any) => f.geometry?.type === 'Point' && (f.properties?.layer || f.properties?.Layer || '').toUpperCase().includes('POLE')).length;
  }, 0);

  const totalCableLength = routes.reduce((sum, r) => sum + (r.routeLength || 0), 0);

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
            <p className="text-base font-bold text-slate-100">{totalPolesCount}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider">Cable Dist</span>
              <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <p className="text-base font-bold text-slate-100">{(totalCableLength / 1000).toFixed(1)} km</p>
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

            {/* Render all routes */}
            {filteredRoutes.map((r) => {
              const features = r.geojsonData?.features || [];
              const isSelected = selectedRoute?.id === r.id;

              return features.map((f: any, idx: number) => {
                const geom = f.geometry;
                if (!geom) return null;

                // Render Cable routes
                if (geom.type === 'LineString' && Array.isArray(geom.coordinates)) {
                  const path: [number, number][] = geom.coordinates.map((c: any) => [c[1], c[0]]);
                  return (
                    <Polyline
                      key={`line-${r.id}-${idx}`}
                      positions={path}
                      color={isSelected ? '#6366f1' : '#334155'}
                      weight={isSelected ? 4 : 2}
                      opacity={isSelected ? 0.9 : 0.6}
                    >
                      <Popup>
                        <div className="text-xs font-bold text-slate-900">{r.project.name}</div>
                        <div className="text-[10px] text-slate-600">Cable Route: {r.name}</div>
                      </Popup>
                    </Polyline>
                  );
                }

                // Render Pole coordinates
                if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
                  const lat = geom.coordinates[1];
                  const lng = geom.coordinates[0];
                  const layerName = (f.properties?.layer || f.properties?.Layer || '').toUpperCase();
                  const isPole = layerName.includes('POLE');

                  return (
                    <CircleMarker
                      key={`point-${r.id}-${idx}`}
                      center={[lat, lng]}
                      radius={isPole ? 4 : 5}
                      fillColor={isPole ? '#10b981' : '#f59e0b'}
                      color="#0f172a"
                      weight={1}
                      fillOpacity={isSelected ? 0.9 : 0.4}
                    >
                      <Popup>
                        <div className="text-xs font-bold text-slate-900">{isPole ? 'Pole' : 'FDP/Joint'}</div>
                        <div className="text-[10px] text-slate-600">Coordinates: {lat.toFixed(6)}, {lng.toFixed(6)}</div>
                      </Popup>
                    </CircleMarker>
                  );
                }

                return null;
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
      </div>
    </div>
  );
}
