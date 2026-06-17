// ============================================================================
// GISMapView Component — OpenLayers map visualization for GIS layers
// ============================================================================
// Enterprise-grade interactive map displaying cables, poles, FDPs, fiber joints,
// and road segments with popup info, layer controls, and auto-fit bounds.
// Built on OpenLayers 10 for Vector Tiles, WMS/WFS, PostGIS-ready architecture.
// ============================================================================

'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Overlay from 'ol/Overlay';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';
import { defaults as defaultControls, FullScreen } from 'ol/control';

interface GISMapViewProps {
  gisRoutes?: any[];
  assets?: any[];
  width?: string;
  height?: string;
  fullscreen?: boolean;
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
  cables: '#2563eb',
  poles: '#dc2626',
  fdps: '#7c3aed',
  fiberJoints: '#ca8a04',
  roads: '#64748b',
  assets: '#059669',
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

// ============================================================================
// Style helpers
// ============================================================================

function createPolylineStyle(color: string, weight: number, opacity: number, dashArray?: string) {
  return new Style({
    stroke: new Stroke({ color, width: weight, lineDash: dashArray ? dashArray.split(',').map(Number) : undefined }),
  });
}

function createCircleStyle(color: string, radius: number, fillOpacity: number, dashArray?: string) {
  return new Style({
    image: new CircleStyle({
      radius,
      fill: new Fill({ color: hexToRgba(color, fillOpacity) }),
      stroke: new Stroke({ color, width: 2, lineDash: dashArray ? dashArray.split(',').map(Number) : undefined }),
    }),
  });
}

function createHoverPolylineStyle(color: string) {
  return new Style({ stroke: new Stroke({ color, width: 5 }) });
}

function createHoverCircleStyle(color: string, radius: number) {
  return new Style({
    image: new CircleStyle({ radius, fill: new Fill({ color: hexToRgba(color, 0.9) }), stroke: new Stroke({ color, width: 2 }) }),
  });
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function createPopupOverlay(html: string): Overlay {
  const element = document.createElement('div');
  element.innerHTML = html;
  element.style.cssText = `
    background: white; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    padding: 12px; min-width: 220px; max-width: 320px;
    font-family: system-ui, sans-serif; font-size: 13px; color: #1f2937;
  `;
  const closeBtn = document.createElement('span');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = 'position: absolute; top: 6px; right: 10px; cursor: pointer; font-size: 16px; color: #9ca3af; line-height: 1;';
  closeBtn.onclick = () => { element.style.display = 'none'; };
  element.appendChild(closeBtn);
  return new Overlay({ element, autoPan: { animation: { duration: 250 } }, offset: [0, -10], positioning: 'bottom-center', stopEvent: false });
}

// ============================================================================
// Main Component
// ============================================================================

export function GISMapView({ gisRoutes = [], assets = [], width = '100%', height = '600px', fullscreen = false }: GISMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const popupRef = useRef<Overlay | null>(null);
  const layerSourcesRef = useRef<Record<string, VectorSource>>({});
  const vectorLayersRef = useRef<Record<string, VectorLayer<VectorSource>>>({});
  const [mapReady, setMapReady] = useState(false);
  const [visibility, setVisibility] = useState<LayerVisibility>({
    cables: true, poles: true, fdps: true, fiberJoints: true, roads: true, assets: true,
  });

  const layerStyles = useMemo(() => ({
    cables: createPolylineStyle(LAYER_COLORS.cables, 3, 0.8),
    cablesHover: createHoverPolylineStyle(LAYER_COLORS.cables),
    poles: createCircleStyle(LAYER_COLORS.poles, 8, 0.6),
    polesHover: createHoverCircleStyle(LAYER_COLORS.poles, 10),
    fdps: createCircleStyle(LAYER_COLORS.fdps, 10, 0.6),
    fdpsHover: createHoverCircleStyle(LAYER_COLORS.fdps, 12),
    fiberJoints: createCircleStyle(LAYER_COLORS.fiberJoints, 7, 0.6),
    fiberJointsHover: createHoverCircleStyle(LAYER_COLORS.fiberJoints, 9),
    roads: createPolylineStyle(LAYER_COLORS.roads, 2, 0.5, '8,6'),
    roadsHover: createHoverPolylineStyle(LAYER_COLORS.roads),
    assets: createCircleStyle(LAYER_COLORS.assets, 6, 0.7, '2,2'),
    assetsHover: createHoverCircleStyle(LAYER_COLORS.assets, 8),
  }), []);

  // --- Initialize map once ---
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = new Map({
      target: mapContainerRef.current,
      layers: [new TileLayer({ source: new OSM({ attributions: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }) })],
      view: new View({ center: fromLonLat([80.7718, 7.8731]), zoom: 8, maxZoom: 21 }),
      controls: defaultControls().extend([new FullScreen()]),
    });
    mapRef.current = map;
    setMapReady(true);
    requestAnimationFrame(() => map.updateSize());
    return () => { map.setTarget(undefined); mapRef.current = null; };
  }, []);

  // --- Invalidate size on dimension / fullscreen change ---
  useEffect(() => {
    if (!mapRef.current) return;
    const timeout = setTimeout(() => { mapRef.current?.updateSize(); }, 50);
    return () => clearTimeout(timeout);
  }, [width, height, fullscreen]);

  // --- Popup overlay ---
  useEffect(() => {
    if (!mapRef.current) return;
    const popup = createPopupOverlay('');
    mapRef.current.addOverlay(popup);
    popupRef.current = popup;
    const handleClick = (evt: any) => {
      const map = mapRef.current;
      if (!map) return;
      const feature = map.forEachFeatureAtPixel(evt.pixel, (f: any) => f);
      if (feature) {
        const html = feature.get('popupHtml');
        if (html && popup.getElement()) { popup.getElement()!.innerHTML = html; popup.setPosition(evt.coordinate); popup.getElement()!.style.display = ''; }
      } else {
        if (popup.getElement()) popup.getElement()!.style.display = 'none';
      }
    };
    mapRef.current.on('click', handleClick);
    return () => { mapRef.current?.un('click', handleClick); };
  }, [mapReady]);

  // --- Hover (pointermove) for highlight ---
  const hoverFeatureRef = useRef<Feature | null>(null);
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const map = mapRef.current;
    const handlePointerMove = (evt: any) => {
      if (hoverFeatureRef.current) {
        const prev = hoverFeatureRef.current;
        const prevLayerKey = prev.get('layerKey');
        if (prevLayerKey) {
          const hoverStyleKey = (prevLayerKey + 'Hover') as keyof typeof layerStyles;
          if (layerStyles[hoverStyleKey]) { prev.setStyle(undefined); }
        }
        hoverFeatureRef.current = null;
      }
      const feature = map.forEachFeatureAtPixel(evt.pixel, (f: any) => f);
      if (feature) {
        const layerKey = feature.get('layerKey');
        if (layerKey) {
          const hoverStyleKey = (layerKey + 'Hover') as keyof typeof layerStyles;
          if (layerStyles[hoverStyleKey]) { feature.setStyle(layerStyles[hoverStyleKey]); hoverFeatureRef.current = feature; }
        }
      }
      map.getTargetElement().style.cursor = feature ? 'pointer' : '';
    };
    map.on('pointermove', handlePointerMove);
    return () => { map.un('pointermove', handlePointerMove); };
  }, [mapReady, layerStyles]);

  // --- Process GIS data → populate vector layers ---
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const map = mapRef.current;
    Object.values(vectorLayersRef.current).forEach((layer) => { if (layer) map.removeLayer(layer); });
    Object.values(layerSourcesRef.current).forEach((src) => src.clear());

    const sources: Record<string, VectorSource> = {
      cables: new VectorSource(), poles: new VectorSource(), fdps: new VectorSource(),
      fiberJoints: new VectorSource(), roads: new VectorSource(), assets: new VectorSource(),
    };
    const allExtents: any[] = [];
    layerSourcesRef.current = sources;

    function addFeature(sourceKey: string, geom: any, popupHtml: string, layerKey: string) {
      const feature = new Feature({ geometry: geom });
      feature.set('popupHtml', popupHtml);
      feature.set('layerKey', layerKey);
      sources[sourceKey].addFeature(feature);
      allExtents.push(geom.getExtent());
    }

    function cablePopup(seg: any, route: any) {
      return `
        <div style="font-family: sans-serif; min-width: 200px;">
          <h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">🔌 Cable Segment #${seg.segmentNumber || '?'}</h3>
          <table style="width:100%; font-size: 12px; border-collapse: collapse;">
            <tr><td style="padding: 2px 4px; color: #666;">Length</td><td style="padding: 2px 4px; font-weight: 500;">${seg.length ? seg.length.toFixed(2) + ' m' : 'N/A'}</td></tr>
            <tr><td style="padding: 2px 4px; color: #666;">Type</td><td style="padding: 2px 4px; font-weight: 500;">${seg.cableType || route.cableType || 'N/A'}</td></tr>
            <tr><td style="padding: 2px 4px; color: #666;">Fiber Count</td><td style="padding: 2px 4px; font-weight: 500;">${seg.fiberCount || '?'}F</td></tr>
            <tr><td style="padding: 2px 4px; color: #666;">Route</td><td style="padding: 2px 4px; font-weight: 500;">${route.name || 'N/A'}</td></tr>
          </table>
        </div>`;
    }

    for (const route of gisRoutes) {
      // --- CABLES (with pole-reference fallback) ---
      if (route.cableSegments?.length) {
        const poleCoordMap: Record<string, [number, number]> = {};
        if (route.poles) {
          for (const p of route.poles) {
            const lat = p.latitude ?? p.lat;
            const lng = p.longitude ?? p.lon ?? p.lng;
            if (lat != null && lng != null) poleCoordMap[p.id] = [lng, lat];
          }
        }
        for (const seg of route.cableSegments) {
          let cableCoords: Array<[number, number]> | null = null;
          if (seg.coordinates?.length) {
            cableCoords = seg.coordinates;
          } else if (seg.fromPoleId && seg.toPoleId) {
            const fromC = poleCoordMap[seg.fromPoleId];
            const toC = poleCoordMap[seg.toPoleId];
            if (fromC && toC) cableCoords = [fromC, toC];
          }
          if (cableCoords) {
            const coords = cableCoords.map((c: any) => fromLonLat([c[0], c[1]]));
            const line = new LineString(coords);
            addFeature('cables', line, cablePopup(seg, route), 'cables');
          }
        }
      }

      // Geometry-based cables fallback
      if (route.geometry) {
        try {
          const geom = typeof route.geometry === 'string' ? JSON.parse(route.geometry) : route.geometry;
          if (geom?.coordinates?.length) {
            const coords = geom.coordinates.map((c: number[]) => fromLonLat([c[0], c[1]]));
            const line = new LineString(coords);
            const html = `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">🔌 Route: ${route.name}</h3><p style="font-size: 12px; color: #666;">Length: ${route.routeLength ? route.routeLength.toFixed(2) + ' m' : 'N/A'}</p></div>`;
            addFeature('cables', line, html, 'cables');
          }
        } catch (e) { /* ignore */ }
      }

      // --- POLES ---
      if (route.poles?.length) {
        for (const pole of route.poles) {
          const lat = pole.latitude ?? pole.lat;
          const lng = pole.longitude ?? pole.lon ?? pole.lng;
          if (lat == null || lng == null) continue;
          const point = new Point(fromLonLat([lng, lat]));
          const html = `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">📡 Pole #${pole.poleNumber || '?'}</h3><table style="width:100%; font-size: 12px; border-collapse: collapse;"><tr><td style="padding: 2px 4px; color: #666;">GPS</td><td style="padding: 2px 4px; font-weight: 500;">${lat.toFixed(6)}, ${lng.toFixed(6)}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Type</td><td style="padding: 2px 4px; font-weight: 500;">${pole.poleType || 'CONCRETE'}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Height</td><td style="padding: 2px 4px; font-weight: 500;">${pole.height || 9}m</td></tr><tr><td style="padding: 2px 4px; color: #666;">Status</td><td style="padding: 2px 4px; font-weight: 500;">${pole.status || 'PLANNED'}</td></tr></table></div>`;
          addFeature('poles', point, html, 'poles');
        }
      }

      // --- CLOSURES (FDPS + Fiber Joints) ---
      if (route.closures?.length) {
        for (const closure of route.closures) {
          const lat = closure.latitude ?? closure.lat;
          const lng = closure.longitude ?? closure.lon ?? closure.lng;
          if (lat == null || lng == null) continue;
          const isFDP = closure.closureType === 'TERMINAL';
          const layerKey = isFDP ? 'fdps' : 'fiberJoints';
          const typeName = isFDP ? 'FDP' : 'Fiber Joint';
          const icon = isFDP ? '📦' : '🔗';
          const point = new Point(fromLonLat([lng, lat]));
          const html = `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">${icon} ${typeName} #${closure.closureNumber || '?'}</h3><table style="width:100%; font-size: 12px; border-collapse: collapse;"><tr><td style="padding: 2px 4px; color: #666;">GPS</td><td style="padding: 2px 4px; font-weight: 500;">${lat.toFixed(6)}, ${lng.toFixed(6)}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Type</td><td style="padding: 2px 4px; font-weight: 500;">${closure.closureType || 'N/A'}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Capacity</td><td style="padding: 2px 4px; font-weight: 500;">${closure.capacity || '?'}</td></tr><tr><td style="padding: 2px 4px; color: #666; max-width: 150px; word-break: break-word;">Notes</td><td style="padding: 2px 4px; font-weight: 500;">${closure.notes || '-'}</td></tr></table></div>`;
          addFeature(layerKey, point, html, layerKey);
        }
      }

      // --- ROADS ---
      if (route.roadSegments?.length) {
        for (const road of route.roadSegments) {
          if (road.coordinates?.length) {
            const coords = road.coordinates.map((c: any) => fromLonLat([c[0], c[1]]));
            const line = new LineString(coords);
            const html = `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">🛣️ ${road.roadName || 'Road Segment'}</h3><table style="width:100%; font-size: 12px; border-collapse: collapse;"><tr><td style="padding: 2px 4px; color: #666;">Length</td><td style="padding: 2px 4px; font-weight: 500;">${road.length ? road.length.toFixed(2) + ' m' : 'N/A'}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Authority</td><td style="padding: 2px 4px; font-weight: 500;">${road.authority || road.roadType || 'N/A'}</td></tr></table></div>`;
            addFeature('roads', line, html, 'roads');
          }
        }
      }
    }

    // --- ASSETS ---
    if (assets?.length) {
      const assetColors: Record<string, string> = { CABLE: LAYER_COLORS.cables, POLE: LAYER_COLORS.poles, FDP: LAYER_COLORS.fdps, FIBER_JOINT: LAYER_COLORS.fiberJoints };
      for (const asset of assets) {
        const lat = asset.latitude ?? asset.lat;
        const lng = asset.longitude ?? asset.lon ?? asset.lng;
        if (lat == null || lng == null) continue;
        const color = assetColors[asset.assetType] || LAYER_COLORS.assets;
        const point = new Point(fromLonLat([lng, lat]));
        const feature = new Feature({ geometry: point });
        feature.set('layerKey', 'assets');
        feature.set('popupHtml', `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">📍 ${asset.assetName || asset.assetCode || 'Asset'}</h3><table style="width:100%; font-size: 12px; border-collapse: collapse;"><tr><td style="padding: 2px 4px; color: #666;">Code</td><td style="padding: 2px 4px; font-weight: 500;">${asset.assetCode || 'N/A'}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Type</td><td style="padding: 2px 4px; font-weight: 500;">${asset.assetType || 'N/A'}</td></tr><tr><td style="padding: 2px 4px; color: #666;">GPS</td><td style="padding: 2px 4px; font-weight: 500;">${lat.toFixed(6)}, ${lng.toFixed(6)}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Status</td><td style="padding: 2px 4px; font-weight: 500;">${asset.status || 'ACTIVE'}</td></tr></table></div>`);
        feature.setStyle(createCircleStyle(color, 6, 0.7, '2,2'));
        sources.assets.addFeature(feature);
        allExtents.push(point.getExtent());
      }
    }

    // Create vector layers and add to map
    const vectorLayers: Record<string, VectorLayer<VectorSource>> = {};
    const layerDefs: { key: string; style: any }[] = [
      { key: 'cables', style: layerStyles.cables }, { key: 'poles', style: layerStyles.poles },
      { key: 'fdps', style: layerStyles.fdps }, { key: 'fiberJoints', style: layerStyles.fiberJoints },
      { key: 'roads', style: layerStyles.roads },
    ];
    for (const { key, style } of layerDefs) {
      const vl = new VectorLayer({ source: sources[key], style, visible: visibility[key as keyof LayerVisibility] });
      vl.set('layerKey', key);
      map.addLayer(vl);
      vectorLayers[key] = vl;
    }
    // Assets layer
    {
      const key = 'assets';
      const vl = new VectorLayer({ source: sources[key], visible: visibility[key as keyof LayerVisibility] });
      vl.set('layerKey', key);
      map.addLayer(vl);
      vectorLayers[key] = vl;
    }
    vectorLayersRef.current = vectorLayers;

    if (allExtents.length > 0) {
      const overallExtent = allExtents.reduce((acc, ext) => [
        Math.min(acc[0], ext[0]), Math.min(acc[1], ext[1]), Math.max(acc[2], ext[2]), Math.max(acc[3], ext[3]),
      ], allExtents[0]);
      map.getView().fit(overallExtent, { padding: [50, 50], maxZoom: 16, duration: 500 });
    }
    setTimeout(() => map.updateSize(), 100);
  }, [mapReady, gisRoutes, assets]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Sync visibility state to layers ---
  useEffect(() => {
    const layers = vectorLayersRef.current;
    for (const [key, visible] of Object.entries(visibility)) {
      const layer = layers[key];
      if (layer) layer.setVisible(visible);
    }
  }, [visibility]);

  const countFeatures = useMemo(() => {
    const sources = layerSourcesRef.current;
    return {
      cables: sources.cables?.getFeatures().length || 0, poles: sources.poles?.getFeatures().length || 0,
      fdps: sources.fdps?.getFeatures().length || 0, fiberJoints: sources.fiberJoints?.getFeatures().length || 0,
      roads: sources.roads?.getFeatures().length || 0, assets: sources.assets?.getFeatures().length || 0,
    };
  }, [gisRoutes, assets]);

  const toggleLayer = useCallback((layer: keyof LayerVisibility) => {
    setVisibility((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }, []);
  const showAllLayers = useCallback(() => {
    setVisibility({ cables: true, poles: true, fdps: true, fiberJoints: true, roads: true, assets: true });
  }, []);
  const hideAllLayers = useCallback(() => {
    setVisibility({ cables: false, poles: false, fdps: false, fiberJoints: false, roads: false, assets: false });
  }, []);

  return (
    <div className="relative" style={{ width, height }}>
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg z-10">
          <div className="text-center space-y-3">
            <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-gray-500">Loading map...</p>
          </div>
        </div>
      )}
      {mapReady && gisRoutes.length === 0 && !assets?.length && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 rounded-lg z-10 backdrop-blur-sm">
          <div className="text-center space-y-3 p-8">
            <p className="text-4xl">🗺️</p>
            <p className="text-base font-medium text-gray-700">No GIS Data Available</p>
            <p className="text-sm text-gray-500 max-w-sm">Import GIS files to visualize routes, poles, cables and other telecom infrastructure on the map.</p>
          </div>
        </div>
      )}
      {mapReady && (
        <div className="absolute top-3 right-3 z-[1000] bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Layers</h3>
            <div className="flex gap-1">
              <button onClick={showAllLayers} className="text-[10px] text-blue-600 hover:text-blue-800 font-medium px-1.5 py-0.5 rounded hover:bg-blue-50">All</button>
              <button onClick={hideAllLayers} className="text-[10px] text-gray-500 hover:text-gray-700 font-medium px-1.5 py-0.5 rounded hover:bg-gray-100">None</button>
            </div>
          </div>
          <div className="space-y-1">
            {Object.keys(visibility).map((key) => {
              const layerKey = key as keyof LayerVisibility;
              const c = countFeatures[layerKey];
              const count = c || (key === 'assets' ? assets?.length || 0 : 0);
              return (
                <label key={key} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer group">
                  <input type="checkbox" checked={visibility[layerKey]} onChange={() => toggleLayer(layerKey)} className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: LAYER_COLORS[key] }} />
                  <span className="flex-1 text-xs text-gray-700 group-hover:text-gray-900">{LAYER_ICONS[key]} {LAYER_LABELS[key]}</span>
                  <span className="text-[10px] text-gray-400 font-medium">{count > 0 ? count : '-'}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full rounded-lg border border-gray-200" style={{ minHeight: height }} />
    </div>
  );
}