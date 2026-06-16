// ============================================================================
// GISMapView Component - Leaflet map visualization for GIS layers
// ============================================================================
// Enterprise-grade interactive map displaying cables, poles, FDPs, fiber joints,
// and road segments with popup info, layer controls, and auto-fit bounds.
// ============================================================================

'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Leaflet types
type LMap = any;
type LMarker = any;
type LPolyline = any;
type LCircleMarker = any;

interface GISMapViewProps {
  /** GIS route data from the API */
  gisRoutes?: any[];
  /** Project assets */
  assets?: any[];
  /** Width of the container (default: 100%) */
  width?: string;
  /** Height of the container (default: 600px) */
  height?: string;
}

interface LayerVisibility {
  cables: boolean;
  poles: boolean;
  fdps: boolean;
  fiberJoints: boolean;
  roads: boolean;
  assets: boolean;
}

const LAYER_COLORS: Record<string, string> = {
  cables: '#2563eb',     // Blue-600
  poles: '#dc2626',      // Red-600
  fdps: '#7c3aed',       // Violet-600
  fiberJoints: '#ca8a04', // Yellow-600
  roads: '#64748b',      // Slate-500
  assets: '#059669',     // Emerald-600
};

const LAYER_LABELS: Record<string, string> = {
  cables: 'Fiber Cables',
  poles: 'Telecom Poles',
  fdps: 'FDPs (Distribution Points)',
  fiberJoints: 'Fiber Joint Closures',
  roads: 'Road Segments',
  assets: 'Project Assets',
};

const LAYER_ICONS: Record<string, string> = {
  cables: '🔌',
  poles: '📡',
  fdps: '📦',
  fiberJoints: '🔗',
  roads: '🛣️',
  assets: '📍',
};

export function GISMapView({
  gisRoutes = [],
  assets = [],
  width = '100%',
  height = '600px',
}: GISMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const layersRef = useRef<Record<string, any[]>>({});
  const [leaflet, setLeaflet] = useState<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<LayerVisibility>({
    cables: true,
    poles: true,
    fdps: true,
    fiberJoints: true,
    roads: true,
    assets: true,
  });

  // Dynamically import Leaflet on mount
  useEffect(() => {
    let mounted = true;

    async function loadLeaflet() {
      try {
        const L = await import('leaflet');
        await import('leaflet/dist/leaflet.css');

        if (mounted) {
          setLeaflet(L);
        }
      } catch (err: any) {
        console.error('Failed to load Leaflet:', err);
        if (mounted) {
          setLoadError('Failed to load map library. Please check your internet connection.');
        }
      }
    }

    loadLeaflet();
    return () => { mounted = false; };
  }, []);

  // Initialize map once Leaflet is loaded
  useEffect(() => {
    if (!leaflet || !mapContainerRef.current || mapRef.current) return;

    try {
      // Fix Leaflet default icon paths (webpack/vite issue)
      delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = leaflet.map(mapContainerRef.current, {
        center: [7.8731, 80.7718], // Sri Lanka center
        zoom: 8,
        zoomControl: true,
        attributionControl: true,
      });

      // Add OpenStreetMap tile layer
      leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      setMapReady(true);
    } catch (err: any) {
      console.error('Failed to initialize map:', err);
      setLoadError('Failed to initialize map.');
    }
  }, [leaflet]);

  // Process GIS data and add layers to map
  useEffect(() => {
    if (!leaflet || !mapRef.current || !mapReady) return;

    const map = mapRef.current;

    // Clear existing layers
    Object.values(layersRef.current).forEach((layerGroup: any) => {
      layerGroup.forEach((layer: any) => {
        if (layer && layer.remove) {
          map.removeLayer(layer);
        }
      });
    });
    layersRef.current = {};

    const allBounds: any[] = [];
    const newLayers: Record<string, any[]> = {
      cables: [],
      poles: [],
      fdps: [],
      fiberJoints: [],
      roads: [],
      assets: [],
    };

    try {
      // Process each GIS route
      for (const route of gisRoutes) {
        // --- CABLES (Polyline) ---
        if (route.cableSegments && route.cableSegments.length > 0) {
          let routeCoords: [number, number][] = [];

          for (const seg of route.cableSegments) {
            // If segment has coordinates array, plot them
            if (seg.coordinates && Array.isArray(seg.coordinates)) {
              const segCoords: [number, number][] = seg.coordinates.map(
                (c: any) => [c[1], c[0]] as [number, number]
              );
              if (segCoords.length > 0) {
                const polyline = leaflet.polyline(segCoords, {
                  color: LAYER_COLORS.cables,
                  weight: 3,
                  opacity: 0.8,
                }).addTo(map);

                polyline.bindPopup(`
                  <div style="font-family: sans-serif; min-width: 200px;">
                    <h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">🔌 Cable Segment #${seg.segmentNumber || seg.index || '?'}</h3>
                    <table style="width:100%; font-size: 12px; border-collapse: collapse;">
                      <tr><td style="padding: 2px 4px; color: #666;">Length</td><td style="padding: 2px 4px; font-weight: 500;">${seg.length ? seg.length.toFixed(2) + ' m' : 'N/A'}</td></tr>
                      <tr><td style="padding: 2px 4px; color: #666;">Type</td><td style="padding: 2px 4px; font-weight: 500;">${seg.cableType || route.cableType || 'N/A'}</td></tr>
                      <tr><td style="padding: 2px 4px; color: #666;">Fiber Count</td><td style="padding: 2px 4px; font-weight: 500;">${seg.fiberCount || route.fiberCount || '?'}F</td></tr>
                      <tr><td style="padding: 2px 4px; color: #666;">Route</td><td style="padding: 2px 4px; font-weight: 500;">${route.name || 'N/A'}</td></tr>
                    </table>
                  </div>
                `, { maxWidth: 300 });

                polyline.on('mouseover', () => polyline.setStyle({ weight: 5, opacity: 1 }));
                polyline.on('mouseout', () => polyline.setStyle({ weight: 3, opacity: 0.8 }));

                newLayers.cables.push(polyline);
                segCoords.forEach((c) => allBounds.push(c));
                routeCoords.push(...segCoords);
              }
            }
          }

          // If no coordinates on segments but route has geometry, try from route
          if (routeCoords.length === 0 && route.geometry) {
            try {
              const geom = typeof route.geometry === 'string' ? JSON.parse(route.geometry) : route.geometry;
              if (geom && geom.coordinates) {
                const coords: [number, number][] = geom.coordinates.map(
                  (c: number[]) => [c[1], c[0]] as [number, number]
                );
                if (coords.length > 0) {
                  const polyline = leaflet.polyline(coords, {
                    color: LAYER_COLORS.cables,
                    weight: 3,
                    opacity: 0.8,
                  }).addTo(map);

                  polyline.bindPopup(`
                    <div style="font-family: sans-serif; min-width: 200px;">
                      <h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">🔌 Route: ${route.name}</h3>
                      <p style="font-size: 12px; color: #666;">Length: ${route.routeLength ? route.routeLength.toFixed(2) + ' m' : 'N/A'}</p>
                    </div>
                  `, { maxWidth: 300 });

                  newLayers.cables.push(polyline);
                  coords.forEach((c) => allBounds.push(c));
                }
              }
            } catch (e) { /* ignore geometry parse errors */ }
          }
        }

        // --- POLES (CircleMarkers) ---
        if (route.poles && route.poles.length > 0) {
          for (const pole of route.poles) {
            const lat = pole.latitude || pole.lat;
            const lng = pole.longitude || pole.lon || pole.lng;
            if (lat == null || lng == null) continue;

            const marker = leaflet.circleMarker([lat, lng], {
              radius: 8,
              color: LAYER_COLORS.poles,
              fillColor: LAYER_COLORS.poles,
              fillOpacity: 0.6,
              weight: 2,
            }).addTo(map);

            marker.bindPopup(`
              <div style="font-family: sans-serif; min-width: 200px;">
                <h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">📡 Pole #${pole.poleNumber || pole.index || '?'}</h3>
                <table style="width:100%; font-size: 12px; border-collapse: collapse;">
                  <tr><td style="padding: 2px 4px; color: #666;">GPS</td><td style="padding: 2px 4px; font-weight: 500;">${lat.toFixed(6)}, ${lng.toFixed(6)}</td></tr>
                  <tr><td style="padding: 2px 4px; color: #666;">Type</td><td style="padding: 2px 4px; font-weight: 500;">${pole.poleType || 'CONCRETE'}</td></tr>
                  <tr><td style="padding: 2px 4px; color: #666;">Height</td><td style="padding: 2px 4px; font-weight: 500;">${pole.height || 9}m</td></tr>
                  <tr><td style="padding: 2px 4px; color: #666;">Status</td><td style="padding: 2px 4px; font-weight: 500;">${pole.status || 'PLANNED'}</td></tr>
                </table>
              </div>
            `, { maxWidth: 300 });

            marker.on('mouseover', () => marker.setStyle({ radius: 10, fillOpacity: 0.9 }));
            marker.on('mouseout', () => marker.setStyle({ radius: 8, fillOpacity: 0.6 }));

            newLayers.poles.push(marker);
            allBounds.push([lat, lng]);
          }
        }

        // --- FDPS and FIBER JOINTS (Closures) ---
        if (route.closures && route.closures.length > 0) {
          for (const closure of route.closures) {
            const lat = closure.latitude || closure.lat;
            const lng = closure.longitude || closure.lon || closure.lng;
            if (lat == null || lng == null) continue;

            const isFDP = closure.closureType === 'TERMINAL';
            const layerKey = isFDP ? 'fdps' : 'fiberJoints';
            const color = isFDP ? LAYER_COLORS.fdps : LAYER_COLORS.fiberJoints;
            const icon = isFDP ? '📦' : '🔗';
            const typeName = isFDP ? 'FDP' : 'Fiber Joint';

            const marker = leaflet.circleMarker([lat, lng], {
              radius: isFDP ? 10 : 7,
              color,
              fillColor: color,
              fillOpacity: 0.6,
              weight: 2,
            }).addTo(map);

            marker.bindPopup(`
              <div style="font-family: sans-serif; min-width: 200px;">
                <h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">${icon} ${typeName} #${closure.closureNumber || closure.index || '?'}</h3>
                <table style="width:100%; font-size: 12px; border-collapse: collapse;">
                  <tr><td style="padding: 2px 4px; color: #666;">GPS</td><td style="padding: 2px 4px; font-weight: 500;">${lat.toFixed(6)}, ${lng.toFixed(6)}</td></tr>
                  <tr><td style="padding: 2px 4px; color: #666;">Type</td><td style="padding: 2px 4px; font-weight: 500;">${closure.closureType || 'N/A'}</td></tr>
                  <tr><td style="padding: 2px 4px; color: #666;">Capacity</td><td style="padding: 2px 4px; font-weight: 500;">${closure.capacity || '?'}</td></tr>
                  <tr><td style="padding: 2px 4px; color: #666;">Notes</td><td style="padding: 2px 4px; font-weight: 500; max-width: 150px; word-break: break-word;">${closure.notes || '-'}</td></tr>
                </table>
              </div>
            `, { maxWidth: 300 });

            marker.on('mouseover', () => marker.setStyle({ radius: isFDP ? 12 : 9, fillOpacity: 0.9 }));
            marker.on('mouseout', () => marker.setStyle({ radius: isFDP ? 10 : 7, fillOpacity: 0.6 }));

            newLayers[layerKey].push(marker);
            allBounds.push([lat, lng]);
          }
        }

        // --- ROADS (from route if available) ---
        if (route.roadSegments && route.roadSegments.length > 0) {
          for (const road of route.roadSegments) {
            if (road.coordinates && road.coordinates.length > 0) {
              const coords: [number, number][] = road.coordinates.map(
                (c: any) => [c[1], c[0]] as [number, number]
              );

              const polyline = leaflet.polyline(coords, {
                color: LAYER_COLORS.roads,
                weight: 2,
                opacity: 0.5,
                dashArray: '8, 6',
              }).addTo(map);

              polyline.bindPopup(`
                <div style="font-family: sans-serif; min-width: 200px;">
                  <h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">🛣️ ${road.roadName || 'Road Segment'}</h3>
                  <table style="width:100%; font-size: 12px; border-collapse: collapse;">
                    <tr><td style="padding: 2px 4px; color: #666;">Length</td><td style="padding: 2px 4px; font-weight: 500;">${road.length ? road.length.toFixed(2) + ' m' : 'N/A'}</td></tr>
                    <tr><td style="padding: 2px 4px; color: #666;">Authority</td><td style="padding: 2px 4px; font-weight: 500;">${road.authority || road.roadType || 'N/A'}</td></tr>
                  </table>
                </div>
              `, { maxWidth: 300 });

              newLayers.roads.push(polyline);
              coords.forEach((c) => allBounds.push(c));
            }
          }
        }
      }

      // --- ASSETS (Custom markers) ---
      if (assets && assets.length > 0) {
        for (const asset of assets) {
          const lat = asset.latitude || asset.lat;
          const lng = asset.longitude || asset.lon || asset.lng;
          if (lat == null || lng == null) continue;

          // Use a special marker color based on asset type
          const assetColors: Record<string, string> = {
            CABLE: '#2563eb',
            POLE: '#dc2626',
            FDP: '#7c3aed',
            FIBER_JOINT: '#ca8a04',
          };
          const color = assetColors[asset.assetType] || LAYER_COLORS.assets;

          const marker = leaflet.circleMarker([lat, lng], {
            radius: 6,
            color,
            fillColor: color,
            fillOpacity: 0.7,
            weight: 2,
            dashArray: '2, 2',
          }).addTo(map);

          marker.bindPopup(`
            <div style="font-family: sans-serif; min-width: 200px;">
              <h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">📍 ${asset.assetName || asset.assetCode || 'Asset'}</h3>
              <table style="width:100%; font-size: 12px; border-collapse: collapse;">
                <tr><td style="padding: 2px 4px; color: #666;">Code</td><td style="padding: 2px 4px; font-weight: 500;">${asset.assetCode || 'N/A'}</td></tr>
                <tr><td style="padding: 2px 4px; color: #666;">Type</td><td style="padding: 2px 4px; font-weight: 500;">${asset.assetType || 'N/A'}</td></tr>
                <tr><td style="padding: 2px 4px; color: #666;">GPS</td><td style="padding: 2px 4px; font-weight: 500;">${lat.toFixed(6)}, ${lng.toFixed(6)}</td></tr>
                <tr><td style="padding: 2px 4px; color: #666;">Status</td><td style="padding: 2px 4px; font-weight: 500;">${asset.status || 'ACTIVE'}</td></tr>
              </table>
            </div>
          `, { maxWidth: 300 });

          newLayers.assets.push(marker);
          allBounds.push([lat, lng]);
        }
      }
    } catch (err) {
      console.error('Error processing GIS layers:', err);
    }

    layersRef.current = newLayers;

    // Fit map to bounds if there is data
    if (allBounds.length > 0) {
      try {
        const bounds = leaflet.latLngBounds(allBounds);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        }
      } catch (e) { /* ignore bounds error */ }
    }

    // Apply visibility settings
    applyVisibility(map, newLayers, visibility);

    return () => {
      // Cleanup layers on unmount or data change
      if (map) {
        Object.values(newLayers).forEach((layerGroup: any[]) => {
          layerGroup.forEach((layer: any) => {
            if (layer && layer.remove) {
              map.removeLayer(layer);
            }
          });
        });
      }
    };
  }, [leaflet, mapReady, gisRoutes, assets]);

  // Apply visibility toggles
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const currentLayers = layersRef.current;

    Object.entries(visibility).forEach(([key, visible]) => {
      const layers = currentLayers[key] || [];
      layers.forEach((layer: any) => {
        if (layer && layer.setStyle) {
          if (key === 'cables' || key === 'roads') {
            // Polylines: toggle by adding/removing
            if (visible && !map.hasLayer(layer)) {
              layer.addTo(map);
            } else if (!visible && map.hasLayer(layer)) {
              map.removeLayer(layer);
            }
          } else {
            // CircleMarkers: toggle by adding/removing
            if (visible && !map.hasLayer(layer)) {
              layer.addTo(map);
            } else if (!visible && map.hasLayer(layer)) {
              map.removeLayer(layer);
            }
          }
        }
      });
    });
  }, [visibility, mapReady, leaflet]);

  const toggleLayer = useCallback((layer: keyof LayerVisibility) => {
    setVisibility((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  const showAllLayers = useCallback(() => {
    setVisibility({
      cables: true,
      poles: true,
      fdps: true,
      fiberJoints: true,
      roads: true,
      assets: true,
    });
  }, []);

  const hideAllLayers = useCallback(() => {
    setVisibility({
      cables: false,
      poles: false,
      fdps: false,
      fiberJoints: false,
      roads: false,
      assets: false,
    });
  }, []);

  const countFeatures = useMemo(() => ({
    cables: layersRef.current.cables?.length || 0,
    poles: layersRef.current.poles?.length || 0,
    fdps: layersRef.current.fdps?.length || 0,
    fiberJoints: layersRef.current.fiberJoints?.length || 0,
    roads: layersRef.current.roads?.length || 0,
    assets: layersRef.current.assets?.length || 0,
  }), [gisRoutes, assets]);

  return (
    <div className="relative" style={{ width, height }}>
      {/* Loading State */}
      {!leaflet && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg z-10">
          <div className="text-center space-y-3">
            <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-gray-500">Loading map...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 rounded-lg z-10">
          <div className="text-center space-y-3 p-6">
            <p className="text-3xl">🗺️</p>
            <p className="text-sm font-medium text-red-700">{loadError}</p>
            <p className="text-xs text-red-500">Please try refreshing the page.</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {leaflet && mapReady && gisRoutes.length === 0 && !assets?.length && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 rounded-lg z-10 backdrop-blur-sm">
          <div className="text-center space-y-3 p-8">
            <p className="text-4xl">🗺️</p>
            <p className="text-base font-medium text-gray-700">No GIS Data Available</p>
            <p className="text-sm text-gray-500 max-w-sm">
              Import GIS files to visualize routes, poles, cables and other telecom infrastructure on the map.
            </p>
          </div>
        </div>
      )}

      {/* Layer Control Panel (overlay on map) */}
      {leaflet && mapReady && (
        <div className="absolute top-3 right-3 z-[1000] bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Layers</h3>
            <div className="flex gap-1">
              <button
                onClick={showAllLayers}
                className="text-[10px] text-blue-600 hover:text-blue-800 font-medium px-1.5 py-0.5 rounded hover:bg-blue-50"
                title="Show all layers"
              >
                All
              </button>
              <button
                onClick={hideAllLayers}
                className="text-[10px] text-gray-500 hover:text-gray-700 font-medium px-1.5 py-0.5 rounded hover:bg-gray-100"
                title="Hide all layers"
              >
                None
              </button>
            </div>
          </div>
          <div className="space-y-1">
            {Object.keys(visibility).map((key) => {
              const layerKey = key as keyof LayerVisibility;
              const layerCount = countFeatures[layerKey] || gisRoutes.reduce((sum: number, route: any) => {
                if (key === 'cables') return sum + (route.cableSegments?.length || 0);
                if (key === 'poles') return sum + (route.poles?.length || 0);
                if (key === 'fdps') return sum + (route.closures?.filter((c: any) => c.closureType === 'TERMINAL')?.length || 0);
                if (key === 'fiberJoints') return sum + (route.closures?.filter((c: any) => c.closureType !== 'TERMINAL')?.length || 0);
                if (key === 'roads') return sum + (route.roadSegments?.length || 0);
                return sum;
              }, 0) || (key === 'assets' ? assets?.length || 0 : 0);

              return (
                <label
                  key={key}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={visibility[layerKey]}
                    onChange={() => toggleLayer(layerKey)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: LAYER_COLORS[key] }}
                  />
                  <span className="flex-1 text-xs text-gray-700 group-hover:text-gray-900">
                    {LAYER_ICONS[key]} {LAYER_LABELS[key]}
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">
                    {layerCount > 0 ? layerCount : '-'}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Map Container */}
      <div
        ref={mapContainerRef}
        className="w-full h-full rounded-lg border border-gray-200"
        style={{ minHeight: height }}
      />
    </div>
  );
}

/** Helper to apply visibility to all layers without triggering a re-render cycle */
function applyVisibility(map: LMap, layers: Record<string, any[]>, visibility: LayerVisibility) {
  Object.entries(visibility).forEach(([key, visible]) => {
    const layerGroup = layers[key] || [];
    layerGroup.forEach((layer: any) => {
      if (layer && layer.addTo && layer.remove) {
        try {
          if (visible) {
            if (!map.hasLayer(layer)) layer.addTo(map);
          } else {
            if (map.hasLayer(layer)) map.removeLayer(layer);
          }
        } catch (e) { /* ignore layer errors */ }
      }
    });
  });
}
