// ============================================================================
// GISMapView Component — OpenLayers map visualization for GIS layers
// ============================================================================
// Enterprise-grade interactive map displaying cables, poles, FDPs, fiber joints,
// chambers, and road segments with popup info, layer controls, auto-fit bounds,
// and a distance measurement tool for pole-to-pole distance in meters.
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
import Polygon from 'ol/geom/Polygon';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style';
import { defaults as defaultControls, FullScreen } from 'ol/control';
import { getDistance } from 'ol/sphere';
import Draw from 'ol/interaction/Draw';
import Translate from 'ol/interaction/Translate';
import { type AutoPlanResult, type PlannedClosure } from '@/services/GISAutoPlanService';

// ─── Measurement tool types ────────────────────────────────────────────────
interface MeasurePoint {
  lonLat: [number, number]; // [lon, lat] in EPSG:4326
  pixel: [number, number];
}

interface GISPoleData {
  id: string;
  poleNumber?: string;
  poleType?: string;
  height?: number;
  status?: string;
  latitude?: number;
  lat?: number;
  longitude?: number;
  lon?: number;
  lng?: number;
}

interface GISClosureData {
  id: string;
  closureNumber?: string;
  closureType?: string;
  capacity?: string;
  notes?: string;
  latitude?: number;
  lat?: number;
  longitude?: number;
  lon?: number;
  lng?: number;
  properties?: Record<string, unknown> | null;
}

interface GISChamberData {
  id: string;
  chamberNumber?: string;
  chamberType?: string;
  status?: string;
  notes?: string;
  latitude?: number;
  lat?: number;
  longitude?: number;
  lon?: number;
  lng?: number;
}

interface GISCableSegmentData {
  id: string;
  segmentNumber?: number;
  length?: number;
  cableType?: string;
  fiberCount?: number;
  fromPoleId?: string;
  toPoleId?: string;
  coordinates?: [number, number][];
  properties?: Record<string, unknown>;
}

interface GISRoadSegmentData {
  id: string;
  roadName?: string;
  length?: number;
  roadType?: string;
  authority?: string;
  coordinates?: [number, number][];
}

export interface GISRouteData {
  id: string;
  name: string;
  version?: number;
  versionType?: string;
  isActive?: boolean;
  routeLength?: number;
  cableSegments?: GISCableSegmentData[];
  poles?: GISPoleData[];
  closures?: GISClosureData[];
  chambers?: GISChamberData[];
  roadSegments?: GISRoadSegmentData[];
  geometry?: unknown;
  cableType?: string;
  generatedBOQs?: unknown[];
}

export interface GISAssetData {
  id: string;
  assetName?: string;
  assetCode?: string;
  assetType?: string;
  status?: string;
  latitude?: number;
  lat?: number;
  longitude?: number;
  lon?: number;
  lng?: number;
}

// ─── Distance measurement style helpers ────────────────────────────────────
const MEASURE_STYLE = new Style({
  fill: new Fill({ color: 'rgba(255, 255, 255, 0.2)' }),
  stroke: new Stroke({ color: '#f59e0b', width: 3, lineDash: [8, 4] }),
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: '#f59e0b' }),
    stroke: new Stroke({ color: '#ffffff', width: 2 }),
  }),
});

const MEASURE_SEGMENT_STYLE = new Style({
  stroke: new Stroke({ color: '#f59e0b', width: 3, lineDash: [8, 4] }),
});

interface GISMapViewProps {
  gisRoutes?: GISRouteData[];
  assets?: GISAssetData[];
  width?: string;
  height?: string;
  fullscreen?: boolean;
  preSurveyMode?: boolean;
  onPreSurveyPointsSelected?: (start: [number, number], end: [number, number]) => void;
  projectId?: string;
  onRouteSaved?: () => void;
}

interface LayerVisibility {
  cables: boolean;
  poles: boolean;
  fdps: boolean;
  fiberJoints: boolean;
  chambers: boolean;
  roads: boolean;
  assets: boolean;
}

const LAYER_COLORS: Record<string, string> = {
  cables: '#2563eb',
  poles: '#dc2626',
  fdps: '#7c3aed',
  fiberJoints: '#ca8a04',
  chambers: '#0891b2',
  roads: '#64748b',
  assets: '#059669',
};

const LAYER_LABELS: Record<string, string> = {
  cables: 'Fiber Cables',
  poles: 'Telecom Poles',
  fdps: 'FDPs (Distribution Points)',
  fiberJoints: 'Fiber Joint Closures',
  chambers: 'Chambers (MH/HH)',
  roads: 'Road Segments',
  assets: 'Project Assets',
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

export function GISMapView({
  gisRoutes = [],
  assets = [],
  width = '100%',
  height = '600px',
  fullscreen = false,
  preSurveyMode = false,
  onPreSurveyPointsSelected,
  projectId,
  onRouteSaved
}: GISMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const popupRef = useRef<Overlay | null>(null);
  const layerSourcesRef = useRef<Record<string, VectorSource>>({});
  const vectorLayersRef = useRef<Record<string, VectorLayer<VectorSource>>>({});
  const [mapReady, setMapReady] = useState(false);
  const [preSurveyStart, setPreSurveyStart] = useState<[number, number] | null>(null);
  const [preSurveyEnd, setPreSurveyEnd] = useState<[number, number] | null>(null);
  const preSurveySourceRef = useRef<VectorSource | null>(null);
  const preSurveyLayerRef = useRef<VectorLayer | null>(null);
  const [visibility, setVisibility] = useState<LayerVisibility>({
    cables: true, poles: true, fdps: true, fiberJoints: true, chambers: true, roads: true, assets: true,
  });

  // ─── Distance Measurement State ──────────────────────────────────────
  const [measureActive, setMeasureActive] = useState(false);
  const measurePointsRef = useRef<MeasurePoint[]>([]);
  const measureSourceRef = useRef<VectorSource | null>(null);
  const measureLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const measureTooltipRef = useRef<Overlay | null>(null);
  const measureOverlayRef = useRef<HTMLDivElement | null>(null);
  const [totalDistance, setTotalDistance] = useState<number | null>(null);
  const [lastSegmentDistance, setLastSegmentDistance] = useState<number | null>(null);
  const [measurePointsCount, setMeasurePointsCount] = useState<number>(0);

  // ─── AI Auto-Plan State ──────────────────────────────────────────────
  const [autoPlanActive, setAutoPlanActive] = useState(false);
  const [autoPlanLoading, setAutoPlanLoading] = useState(false);
  const [autoPlanSummary, setAutoPlanSummary] = useState<AutoPlanResult['summary'] | null>(null);
  const [autoPlanData, setAutoPlanData] = useState<AutoPlanResult | null>(null);
  const [routeName, setRouteName] = useState('AI Planned Route');
  const [savingPlan, setSavingPlan] = useState(false);
  const [drawnPolygon, setDrawnPolygon] = useState<[number, number][] | null>(null);
  
  const autoPlanSourceRef = useRef<VectorSource | null>(null);
  const autoPlanLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const autoPlanDrawRef = useRef<Draw | null>(null);
  const translateInteractionRef = useRef<Translate | null>(null);

    // ─── Clear measurement ────────────────────────────────────────────────
  const clearMeasure = useCallback(() => {
    measurePointsRef.current = [];
    setTotalDistance(null);
    setLastSegmentDistance(null);
    setMeasurePointsCount(0);
    if (measureSourceRef.current) measureSourceRef.current.clear();
    if (measureTooltipRef.current) {
      const el = measureTooltipRef.current.getElement();
      if (el) el.style.display = 'none';
    }
  }, []);

  // ─── Toggle measurement mode ──────────────────────────────────────────
  const toggleMeasure = useCallback(() => {
    setMeasureActive((prev) => {
      if (prev) clearMeasure();
      return !prev;
    });
  }, [clearMeasure]);

  const layerStyles = useMemo(() => ({
    cables: createPolylineStyle(LAYER_COLORS.cables, 3, 0.8),
    cablesHover: createHoverPolylineStyle(LAYER_COLORS.cables),
    poles: createCircleStyle(LAYER_COLORS.poles, 8, 0.6),
    polesHover: createHoverCircleStyle(LAYER_COLORS.poles, 10),
    fdps: createCircleStyle(LAYER_COLORS.fdps, 10, 0.6),
    fdpsHover: createHoverCircleStyle(LAYER_COLORS.fdps, 12),
    fiberJoints: createCircleStyle(LAYER_COLORS.fiberJoints, 7, 0.6),
    fiberJointsHover: createHoverCircleStyle(LAYER_COLORS.fiberJoints, 9),
    chambers: createCircleStyle(LAYER_COLORS.chambers, 6, 0.7, '2,2'),
    chambersHover: createHoverCircleStyle(LAYER_COLORS.chambers, 8),
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

    // ─── Initialize measurement layer ──────────────────────────────────
    const mSource = new VectorSource();
    measureSourceRef.current = mSource;
    const mLayer = new VectorLayer({ source: mSource, style: MEASURE_STYLE, zIndex: 1000 });
    measureLayerRef.current = mLayer;
    map.addLayer(mLayer);

    // ─── Initialize pre-survey layer ──────────────────────────────────
    const pSource = new VectorSource();
    preSurveySourceRef.current = pSource;
    const pLayer = new VectorLayer({
      source: pSource,
      style: new Style({
        fill: new Fill({ color: 'rgba(59, 130, 246, 0.2)' }),
        stroke: new Stroke({ color: '#f59e0b', width: 4, lineDash: [6, 4] }),
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({ color: '#ef4444' }),
          stroke: new Stroke({ color: '#ffffff', width: 2.5 })
        })
      }),
      zIndex: 1001
    });
    preSurveyLayerRef.current = pLayer;
    map.addLayer(pLayer);

    // ─── Initialize auto-plan layer ──────────────────────────────────
    const apSource = new VectorSource();
    autoPlanSourceRef.current = apSource;
    const apLayer = new VectorLayer({
      source: apSource,
      style: new Style({
        fill: new Fill({ color: 'rgba(249, 115, 22, 0.15)' }),
        stroke: new Stroke({ color: '#f97316', width: 3, lineDash: [6, 4] }),
      }),
      zIndex: 1002
    });
    autoPlanLayerRef.current = apLayer;
    map.addLayer(apLayer);

    // ─── Measurement tooltip overlay ───────────────────────────────────
    const tooltipEl = document.createElement('div');
    tooltipEl.style.cssText = `
      background: rgba(15, 23, 42, 0.92); color: #fbbf24; font-family: system-ui, sans-serif;
      font-size: 12px; font-weight: 700; padding: 6px 10px; border-radius: 8px;
      border: 1.5px solid #f59e0b; box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      white-space: nowrap; pointer-events: none; display: none;
    `;
    measureOverlayRef.current = tooltipEl;
    const mTooltip = new Overlay({ element: tooltipEl, offset: [0, -20], positioning: 'bottom-center' });
    measureTooltipRef.current = mTooltip;
    map.addOverlay(mTooltip);

    requestAnimationFrame(() => {
      setMapReady(true);
      map.updateSize();
      // Force tile refresh by triggering multiple size updates
      setTimeout(() => map.updateSize(), 200);
      setTimeout(() => map.updateSize(), 500);
    });
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
    const handleClick = (evt: import('ol/MapBrowserEvent').default<PointerEvent | KeyboardEvent | WheelEvent>) => {
      const map = mapRef.current;
      if (!map) return;
      const feature = map.forEachFeatureAtPixel(evt.pixel, (f: import('ol/Feature').FeatureLike) => f) as Feature | undefined;
      if (feature) {
        const html = feature.get('popupHtml') as string;
        if (html && popup.getElement()) { popup.getElement()!.innerHTML = html; popup.setPosition(evt.coordinate); popup.getElement()!.style.display = ''; }
      } else {
        if (popup.getElement()) popup.getElement()!.style.display = 'none';
      }
    };
    mapRef.current.on('click', handleClick);
    return () => { mapRef.current?.un('click', handleClick); };
  }, [mapReady]);

  // ─── Measurement click handler ───────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const map = mapRef.current;

    const handleMeasureClick = (evt: import('ol/MapBrowserEvent').default<PointerEvent | KeyboardEvent | WheelEvent>) => {
      if (!measureActive) return;
      const lonLat = toLonLat(evt.coordinate) as [number, number];
      const pixel = evt.pixel as [number, number];
      const points = measurePointsRef.current;
      const source = measureSourceRef.current;
      if (!source) return;

      points.push({ lonLat, pixel });
      setMeasurePointsCount(points.length);

      if (points.length === 1) {
        // First point: show a marker
        const pt = new Point(evt.coordinate);
        const f = new Feature({ geometry: pt });
        f.setStyle(MEASURE_STYLE);
        source.addFeature(f);
        // Show tooltip "Click next point"
        if (measureOverlayRef.current && measureTooltipRef.current) {
          measureOverlayRef.current.innerHTML = '📏 Click next point to measure';
          measureOverlayRef.current.style.display = '';
          measureTooltipRef.current.setPosition(evt.coordinate);
        }
      } else if (points.length >= 2) {
        // Draw line segment
        const prev = points[points.length - 2];
        const prevCoord = fromLonLat(prev.lonLat);
        const currCoord = evt.coordinate;
        const lineStr = new LineString([prevCoord, currCoord]);
        const segFeature = new Feature({ geometry: lineStr });
        segFeature.setStyle(MEASURE_SEGMENT_STYLE);
        source.addFeature(segFeature);

        // Calculate distances
        const segmentMeters = getDistance(prev.lonLat, lonLat);
        setLastSegmentDistance(segmentMeters);

        // Total distance
        let total = 0;
        for (let i = 1; i < points.length; i++) {
          total += getDistance(points[i - 1].lonLat, points[i].lonLat);
        }
        setTotalDistance(total);

        // Add end point marker
        const pt = new Point(currCoord);
        const f = new Feature({ geometry: pt });
        f.setStyle(MEASURE_STYLE);
        source.addFeature(f);

        // Update tooltip with segment distance
        if (measureOverlayRef.current && measureTooltipRef.current) {
          measureOverlayRef.current.innerHTML = `📏 Seg: <b>${segmentMeters.toFixed(2)} m</b><br>📐 Total: <b>${total.toFixed(2)} m</b><br><span style="font-size:9px;opacity:0.7">Click to continue | Double-click to finish</span>`;
          measureOverlayRef.current.style.display = '';
          measureTooltipRef.current.setPosition(currCoord);
        }
      }
    };

    const handleMeasureDblClick = () => {
      if (!measureActive) return;
      const points = measurePointsRef.current;
      if (points.length < 2) return;

      // Finalize measurement
      setMeasureActive(false);
      const source = measureSourceRef.current;
      if (source) {
        // Remove existing features and draw final consolidated line
        source.clear();

        const coords = points.map(p => fromLonLat(p.lonLat));
        const finalLine = new LineString(coords);
        const finalFeature = new Feature({ geometry: finalLine });
        finalFeature.setStyle(new Style({
          stroke: new Stroke({ color: '#f59e0b', width: 4, lineDash: [10, 5] }),
          image: new CircleStyle({
            radius: 5,
            fill: new Fill({ color: '#f59e0b' }),
            stroke: new Stroke({ color: '#ffffff', width: 2 }),
          }),
        }));
        source.addFeature(finalFeature);

        // Add endpoint markers
        if (points.length > 0) {
          const startPt = new Point(fromLonLat(points[0].lonLat));
          const startF = new Feature({ geometry: startPt });
          startF.setStyle(MEASURE_STYLE);
          source.addFeature(startF);

          const endPt = new Point(fromLonLat(points[points.length - 1].lonLat));
          const endF = new Feature({ geometry: endPt });
          endF.setStyle(new Style({
            image: new CircleStyle({
              radius: 7,
              fill: new Fill({ color: '#ef4444' }),
              stroke: new Stroke({ color: '#ffffff', width: 2 }),
            }),
          }));
          source.addFeature(endF);
        }
      }

      // Show final tooltip
      if (measureOverlayRef.current && measureTooltipRef.current && points.length > 0) {
        const lastCoord = fromLonLat(points[points.length - 1].lonLat);
        let total = 0;
        for (let i = 1; i < points.length; i++) {
          total += getDistance(points[i - 1].lonLat, points[i].lonLat);
        }
        measureOverlayRef.current.innerHTML = `📐 Total: <b>${total.toFixed(2)} m</b> (${points.length} points)`;
        measureOverlayRef.current.style.display = '';
        measureOverlayRef.current.style.background = 'rgba(15, 23, 42, 0.95)';
        measureOverlayRef.current.style.border = '2px solid #ef4444';
        measureTooltipRef.current.setPosition(lastCoord);
      }
    };

    // Register measurement events
    map.on('click', handleMeasureClick);
    map.on('dblclick', handleMeasureDblClick);
    return () => {
      map.un('click', handleMeasureClick);
      map.un('dblclick', handleMeasureDblClick);
    };
  }, [mapReady, measureActive]);

  // ─── Pre-Survey click handler ─────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const map = mapRef.current;

    const handlePreSurveyClick = (evt: import('ol/MapBrowserEvent').default<PointerEvent | KeyboardEvent | WheelEvent>) => {
      if (!preSurveyMode) return;
      
      const lonLat = toLonLat(evt.coordinate) as [number, number]; // [lng, lat]
      const source = preSurveySourceRef.current;
      if (!source) return;

      if (!preSurveyStart || (preSurveyStart && preSurveyEnd)) {
        // First click (or reset): set start point
        setPreSurveyStart(lonLat);
        setPreSurveyEnd(null);
        source.clear();

        const startPt = new Point(evt.coordinate);
        const startFeature = new Feature({ geometry: startPt });
        startFeature.setStyle(new Style({
          image: new CircleStyle({
            radius: 8,
            fill: new Fill({ color: '#ef4444' }), // Red for Start
            stroke: new Stroke({ color: '#ffffff', width: 2 })
          })
        }));
        source.addFeature(startFeature);
      } else {
        // Second click: set end point
        setPreSurveyEnd(lonLat);

        const endPt = new Point(evt.coordinate);
        const endFeature = new Feature({ geometry: endPt });
        endFeature.setStyle(new Style({
          image: new CircleStyle({
            radius: 8,
            fill: new Fill({ color: '#3b82f6' }), // Blue for End
            stroke: new Stroke({ color: '#ffffff', width: 2 })
          })
        }));
        source.addFeature(endFeature);

        // Draw line between Start and End
        const startCoord = fromLonLat(preSurveyStart);
        const endCoord = evt.coordinate;
        const line = new LineString([startCoord, endCoord]);
        const lineFeature = new Feature({ geometry: line });
        lineFeature.setStyle(new Style({
          stroke: new Stroke({ color: '#f59e0b', width: 4, lineDash: [8, 4] })
        }));
        source.addFeature(lineFeature);

        // Fire callback to parent
        if (onPreSurveyPointsSelected) {
          onPreSurveyPointsSelected(preSurveyStart, lonLat);
        }
      }
    };

    map.on('click', handlePreSurveyClick);
    return () => {
      map.un('click', handlePreSurveyClick);
    };
  }, [mapReady, preSurveyMode, preSurveyStart, preSurveyEnd, onPreSurveyPointsSelected]);

  // --- Hover (pointermove) for highlight ---
  const hoverFeatureRef = useRef<Feature | null>(null);
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const map = mapRef.current;
    const handlePointerMove = (evt: import('ol/MapBrowserEvent').default<PointerEvent | KeyboardEvent | WheelEvent>) => {
      if (hoverFeatureRef.current) {
        const prev = hoverFeatureRef.current;
        const prevLayerKey = prev.get('layerKey');
        if (prevLayerKey) {
          const hoverStyleKey = (prevLayerKey + 'Hover') as keyof typeof layerStyles;
          if (layerStyles[hoverStyleKey]) {
            const orig = prev.get('customStyle') as Style | undefined;
            prev.setStyle(orig || undefined);
          }
        }
        hoverFeatureRef.current = null;
      }
      const feature = map.forEachFeatureAtPixel(evt.pixel, (f: import('ol/Feature').FeatureLike) => f) as Feature | undefined;
      if (feature) {
        const layerKey = feature.get('layerKey');
        if (layerKey) {
          const hoverStyleKey = (layerKey + 'Hover') as keyof typeof layerStyles;
          if (layerStyles[hoverStyleKey]) {
            let hoverStyle = layerStyles[hoverStyleKey];
            const customColor = feature.get('customColor') as string | undefined;
            if (customColor) {
              hoverStyle = createHoverCircleStyle(customColor, 10);
            }
            feature.setStyle(hoverStyle);
            hoverFeatureRef.current = feature;
          }
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
      fiberJoints: new VectorSource(), chambers: new VectorSource(), roads: new VectorSource(), assets: new VectorSource(),
    };
    const allExtents: import('ol/extent').Extent[] = [];
    layerSourcesRef.current = sources;

    function addFeature(
      sourceKey: string, 
      geom: import('ol/geom/Geometry').default, 
      popupHtml: string, 
      layerKey: string,
      customStyle?: Style,
      customColor?: string,
      featureId?: string | number
    ) {
      const feature = new Feature({ geometry: geom });
      if (featureId !== undefined) {
        feature.set('index', featureId);
      }
      feature.set('popupHtml', popupHtml);
      feature.set('layerKey', layerKey);
      if (customStyle) {
        feature.setStyle(customStyle);
        feature.set('customStyle', customStyle);
      }
      if (customColor) {
        feature.set('customColor', customColor);
      }
      sources[sourceKey].addFeature(feature);
      allExtents.push(geom.getExtent());
    }

    function cablePopup(seg: GISCableSegmentData, route: GISRouteData) {
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
      // --- CABLES (with unified node map fallback: poles + chambers + closures) ---
      if (route.cableSegments?.length) {
        // Build unified node coordinate map
        const nodeCoordMap: Record<string, [number, number]> = {};
        if (route.poles) {
          for (const p of route.poles) {
            const lat = p.latitude ?? p.lat;
            const lng = p.longitude ?? p.lon ?? p.lng;
            if (lat != null && lng != null) nodeCoordMap[p.id] = [lng, lat];
          }
        }
        if (route.chambers) {
          for (const ch of route.chambers) {
            const lat = ch.latitude ?? ch.lat;
            const lng = ch.longitude ?? ch.lon ?? ch.lng;
            if (lat != null && lng != null) nodeCoordMap[ch.id] = [lng, lat];
          }
        }
        if (route.closures) {
          for (const cl of route.closures) {
            const lat = cl.latitude ?? cl.lat;
            const lng = cl.longitude ?? cl.lon ?? cl.lng;
            if (lat != null && lng != null) nodeCoordMap[cl.id] = [lng, lat];
          }
        }
        for (const seg of route.cableSegments) {
          let cableCoords: Array<[number, number]> | null = null;
          // Try properties.coordinates first (from ingestion serialization)
          if (Array.isArray(seg.properties?.coordinates) && seg.properties.coordinates.length >= 2) {
            cableCoords = seg.properties.coordinates;
          } else if (Array.isArray(seg.coordinates) && seg.coordinates.length >= 2) {
            cableCoords = seg.coordinates;
          } else if (seg.fromPoleId && seg.toPoleId) {
            const fromC = nodeCoordMap[seg.fromPoleId];
            const toC = nodeCoordMap[seg.toPoleId];
            if (fromC && toC) cableCoords = [fromC, toC];
          }
          if (cableCoords) {
            const coords = cableCoords.map((c: [number, number]) => fromLonLat([c[0], c[1]]));
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
        } catch { /* ignore */ }
      }

      // --- POLES ---
      if (route.poles?.length) {
        for (const pole of route.poles) {
          const lat = pole.latitude ?? pole.lat;
          const lng = pole.longitude ?? pole.lon ?? pole.lng;
          if (lat == null || lng == null) continue;
          const point = new Point(fromLonLat([lng, lat]));
          const html = `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">📡 Pole #${pole.poleNumber || '?'}</h3><table style="width:100%; font-size: 12px; border-collapse: collapse;"><tr><td style="padding: 2px 4px; color: #666;">GPS</td><td style="padding: 2px 4px; font-weight: 500;">${lat.toFixed(6)}, ${lng.toFixed(6)}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Type</td><td style="padding: 2px 4px; font-weight: 500;">${pole.poleType || 'CONCRETE'}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Height</td><td style="padding: 2px 4px; font-weight: 500;">${pole.height || 9}m</td></tr><tr><td style="padding: 2px 4px; color: #666;">Status</td><td style="padding: 2px 4px; font-weight: 500;">${pole.status || 'PLANNED'}</td></tr></table></div>`;
          
          const isExisting = pole.status === 'VERIFIED' || pole.status === 'INSTALLED';
          const isNew = pole.status === 'PLANNED';
          
          let customStyle: Style | undefined = undefined;
          let customColor: string | undefined = undefined;
          
          if (isExisting) {
            customColor = '#f97316'; // Orange for existing poles, matching QGIS
            customStyle = createCircleStyle(customColor, 8, 0.6);
          } else if (isNew) {
            customColor = '#2563eb'; // Blue for new poles, matching QGIS
            customStyle = createCircleStyle(customColor, 8, 0.6);
          }
          
          addFeature('poles', point, html, 'poles', customStyle, customColor);
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
          
          const props = (closure.properties as Record<string, unknown>) || {};
          const dpName = (props.Name || props.name || props.FDP_Name || props.dp_name || props.dpName || props.FDP_Code || props.Code || props.code || props.FJ_Name || props.joint_name || '') as string;
          
          const point = new Point(fromLonLat([lng, lat]));
          
          // Setup title text containing DP Name if present
          const titleText = dpName ? `${icon} ${dpName}` : `${icon} ${typeName} #${closure.closureNumber || '?'}`;
          
          const html = `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">${titleText}</h3><table style="width:100%; font-size: 12px; border-collapse: collapse;">${dpName ? `<tr><td style="padding: 2px 4px; color: #666;">Name</td><td style="padding: 2px 4px; font-weight: 500;">${dpName}</td></tr>` : ''}<tr><td style="padding: 2px 4px; color: #666;">GPS</td><td style="padding: 2px 4px; font-weight: 500;">${lat.toFixed(6)}, ${lng.toFixed(6)}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Type</td><td style="padding: 2px 4px; font-weight: 500;">${closure.closureType || 'N/A'}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Capacity</td><td style="padding: 2px 4px; font-weight: 500;">${closure.capacity || '?'}</td></tr><tr><td style="padding: 2px 4px; color: #666; max-width: 150px; word-break: break-word;">Notes</td><td style="padding: 2px 4px; font-weight: 500;">${closure.notes || '-'}</td></tr></table></div>`;
          
          let customStyle: Style | undefined = undefined;
          if (dpName) {
            const baseColor = isFDP ? LAYER_COLORS.fdps : LAYER_COLORS.fiberJoints;
            const radius = isFDP ? 10 : 7;
            customStyle = new Style({
              image: new CircleStyle({
                radius,
                fill: new Fill({ color: hexToRgba(baseColor, 0.6) }),
                stroke: new Stroke({ color: baseColor, width: 2 })
              }),
              text: new Text({
                text: dpName,
                font: 'bold 11px system-ui, sans-serif',
                fill: new Fill({ color: '#1f2937' }),
                stroke: new Stroke({ color: '#ffffff', width: 3 }),
                offsetY: -15,
                textAlign: 'center'
              })
            });
          }

          addFeature(layerKey, point, html, layerKey, customStyle, isFDP ? LAYER_COLORS.fdps : LAYER_COLORS.fiberJoints);
        }
      }

      // --- CHAMBERS ---
      if (route.chambers?.length) {
        for (const ch of route.chambers) {
          const lat = ch.latitude ?? ch.lat;
          const lng = ch.longitude ?? ch.lon ?? ch.lng;
          if (lat == null || lng == null) continue;
          const point = new Point(fromLonLat([lng, lat]));
          const html = `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">⚫ Chamber #${ch.chamberNumber || '?'}</h3><table style="width:100%; font-size: 12px; border-collapse: collapse;"><tr><td style="padding: 2px 4px; color: #666;">GPS</td><td style="padding: 2px 4px; font-weight: 500;">${lat.toFixed(6)}, ${lng.toFixed(6)}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Type</td><td style="padding: 2px 4px; font-weight: 500;">${ch.chamberType || 'N/A'}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Status</td><td style="padding: 2px 4px; font-weight: 500;">${ch.status || 'PLANNED'}</td></tr><tr><td style="padding: 2px 4px; color: #666; max-width: 150px; word-break: break-word;">Notes</td><td style="padding: 2px 4px; font-weight: 500;">${ch.notes || '-'}</td></tr></table></div>`;
          addFeature('chambers', point, html, 'chambers');
        }
      }

      // --- ROADS ---
      if (route.roadSegments?.length) {
        for (const road of route.roadSegments) {
          if (road.coordinates?.length) {
            const coords = road.coordinates.map((c: [number, number]) => fromLonLat([c[0], c[1]]));
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
        const color = (asset.assetType ? assetColors[asset.assetType] : undefined) || LAYER_COLORS.assets;
        const point = new Point(fromLonLat([lng, lat]));
        const feature = new Feature({ geometry: point });
        feature.set('layerKey', 'assets');
        feature.set('popupHtml', `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">📍 ${asset.assetName || asset.assetCode || 'Asset'}</h3><table style="width:100%; font-size: 12px; border-collapse: collapse;"><tr><td style="padding: 2px 4px; color: #666;">Code</td><td style="padding: 2px 4px; font-weight: 500;">${asset.assetCode || 'N/A'}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Type</td><td style="padding: 2px 4px; font-weight: 500;">${asset.assetType || 'N/A'}</td></tr><tr><td style="padding: 2px 4px; color: #666;">GPS</td><td style="padding: 2px 4px; font-weight: 500;">${lat.toFixed(6)}, ${lng.toFixed(6)}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Status</td><td style="padding: 2px 4px; font-weight: 500;">${asset.status || 'ACTIVE'}</td></tr></table></div>`);
        feature.setStyle(createCircleStyle(color, 6, 0.7, '2,2'));
        sources.assets.addFeature(feature);
        allExtents.push(point.getExtent());
      }
    }

    // --- AI PLANNED ELEMENTS ---
    if (autoPlanData) {
      // Render planned closures (FDPs and Joints)
      if (autoPlanData.closures) {
        for (const cl of autoPlanData.closures) {
          const lat = cl.latitude;
          const lng = cl.longitude;
          const point = new Point(fromLonLat([lng, lat]));
          const isFDP = cl.closureType === 'TERMINAL';
          const layerKey = isFDP ? 'fdps' : 'fiberJoints';
          const icon = isFDP ? '📦' : '🔗';
          
          const titleText = `Planned DP-${cl.index}`;
          const html = `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #f97316;">🤖 ${icon} Planned Closure #${cl.index}</h3><table style="width:100%; font-size: 12px; border-collapse: collapse;"><tr><td style="padding: 2px 4px; color: #666;">Type</td><td style="padding: 2px 4px; font-weight: 500;">${cl.closureType}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Capacity</td><td style="padding: 2px 4px; font-weight: 500;">${cl.capacity}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Notes</td><td style="padding: 2px 4px; font-weight: 500;">${cl.notes}</td></tr></table></div>`;
          
          const baseColor = '#f97316'; // orange color for planned items
          const customStyle = new Style({
            image: new CircleStyle({
              radius: isFDP ? 10 : 7,
              fill: new Fill({ color: hexToRgba(baseColor, 0.7) }),
              stroke: new Stroke({ color: '#ea580c', width: 2 })
            }),
            text: new Text({
              text: titleText,
              font: 'bold 11px system-ui, sans-serif',
              fill: new Fill({ color: '#1f2937' }),
              stroke: new Stroke({ color: '#ffffff', width: 3 }),
              offsetY: -15,
              textAlign: 'center'
            })
          });

          addFeature(layerKey, point, html, layerKey, customStyle, baseColor, cl.index);
        }
      }

      // Render planned poles
      if (autoPlanData.poles) {
        for (const pole of autoPlanData.poles) {
          const lat = pole.latitude;
          const lng = pole.longitude;
          const point = new Point(fromLonLat([lng, lat]));
          const html = `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #f97316;">🤖 📡 Planned Pole #${pole.index}</h3><table style="width:100%; font-size: 12px; border-collapse: collapse;"><tr><td style="padding: 2px 4px; color: #666;">Height</td><td style="padding: 2px 4px; font-weight: 500;">${pole.height}m</td></tr><tr><td style="padding: 2px 4px; color: #666;">Type</td><td style="padding: 2px 4px; font-weight: 500;">${pole.poleType}</td></tr></table></div>`;
          const baseColor = '#f97316';
          const customStyle = new Style({
            image: new CircleStyle({
              radius: 8,
              fill: new Fill({ color: hexToRgba(baseColor, 0.7) }),
              stroke: new Stroke({ color: '#ea580c', width: 2 })
            })
          });
          addFeature('poles', point, html, 'poles', customStyle, baseColor, pole.index);
        }
      }

      // Render planned cables
      if (autoPlanData.cables) {
        for (const cable of autoPlanData.cables) {
          const coords = cable.coordinates.map((c: [number, number]) => fromLonLat([c[0], c[1]]));
          const line = new LineString(coords);
          const html = `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #f97316;">🤖 🔌 Planned Cable #${cable.index}</h3><table style="width:100%; font-size: 12px; border-collapse: collapse;"><tr><td style="padding: 2px 4px; color: #666;">Length</td><td style="padding: 2px 4px; font-weight: 500;">${cable.length.toFixed(2)} m</td></tr><tr><td style="padding: 2px 4px; color: #666;">Fiber Count</td><td style="padding: 2px 4px; font-weight: 500;">${cable.fiberCount}F</td></tr></table></div>`;
          const baseColor = '#f97316';
          const customStyle = new Style({
            stroke: new Stroke({ color: baseColor, width: 3, lineDash: [6, 4] })
          });
          addFeature('cables', line, html, 'cables', customStyle, baseColor);
        }
      }
    }

    // Create vector layers and add to map
    const vectorLayers: Record<string, VectorLayer<VectorSource>> = {};
    const layerDefs: { key: string; style: Style }[] = [
      { key: 'cables', style: layerStyles.cables }, { key: 'poles', style: layerStyles.poles },
      { key: 'fdps', style: layerStyles.fdps }, { key: 'fiberJoints', style: layerStyles.fiberJoints },
      { key: 'chambers', style: layerStyles.chambers }, { key: 'roads', style: layerStyles.roads },
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
      // Defer fit to allow the DOM to settle
      setTimeout(() => {
        map.getView().fit(overallExtent, { padding: [60, 60, 60, 60], maxZoom: 17, duration: 800 });
        map.updateSize();
      }, 100);
    } else {
      // No data - reset to Sri Lanka
      map.getView().setCenter(fromLonLat([80.7718, 7.8731]));
      map.getView().setZoom(8);
    }
    setTimeout(() => map.updateSize(), 100);
    setTimeout(() => map.updateSize(), 400);
  }, [mapReady, gisRoutes, assets, autoPlanData]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Sync visibility state to layers ---
  useEffect(() => {
    const layers = vectorLayersRef.current;
    for (const [key, visible] of Object.entries(visibility)) {
      const layer = layers[key];
      if (layer) layer.setVisible(visible);
    }
  }, [visibility]);

  // --- Auto-update map size when container resize occurs ---
  useEffect(() => {
    if (!mapRef.current || !mapContainerRef.current) return;
    const map = mapRef.current;
    const observer = new ResizeObserver(() => {
      map.updateSize();
    });
    observer.observe(mapContainerRef.current);
    return () => {
      observer.disconnect();
    };
  }, [mapReady]);

  // --- Initialize translate interaction for drag & drop ---
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const map = mapRef.current;

    if (translateInteractionRef.current) {
      map.removeInteraction(translateInteractionRef.current);
      translateInteractionRef.current = null;
    }

    if (autoPlanData) {
      const apLayers = [
        vectorLayersRef.current?.poles,
        vectorLayersRef.current?.fdps,
        vectorLayersRef.current?.fiberJoints,
      ].filter(Boolean) as VectorLayer<VectorSource>[];

      const translate = new Translate({
        layers: apLayers,
      });

      translate.on('translateend', async (evt) => {
        const feature = evt.features.getArray()[0];
        if (!feature) return;

        const geom = feature.getGeometry();
        if (geom instanceof Point) {
          const coords = toLonLat(geom.getCoordinates()) as [number, number];
          const layerKey = feature.get('layerKey') as string;
          const index = feature.get('index');

          let updatedClosures: PlannedClosure[] = [];
          const isPole = layerKey === 'poles';

          setAutoPlanData((prev) => {
            if (!prev) return null;

            if (layerKey === 'fdps' || layerKey === 'fiberJoints') {
              updatedClosures = prev.closures.map((c) => {
                if (c.index === index || Math.hypot(c.longitude - coords[0], c.latitude - coords[1]) < 0.001) {
                  return { ...c, longitude: coords[0], latitude: coords[1] };
                }
                return c;
              });
              return { ...prev, closures: updatedClosures };
            } else if (isPole) {
              const updatedPoles = prev.poles.map((p) => {
                if (p.index === index || Math.hypot(p.longitude - coords[0], p.latitude - coords[1]) < 0.001) {
                  return { ...p, longitude: coords[0], latitude: coords[1] };
                }
                return p;
              });
              return { ...prev, poles: updatedPoles };
            }

            return prev;
          });

          if (isPole || updatedClosures.length === 0) return;

          // Call API to re-plan with the updated closures array
          setAutoPlanLoading(true);
          try {
            const res = await fetch('/api/gis/auto-plan', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                polygon: drawnPolygon,
                customClosures: updatedClosures
              })
            });

            if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error || 'Failed to re-route');
            }

            const updatedPlan = (await res.json()) as AutoPlanResult;
            setAutoPlanSummary(updatedPlan.summary);
            setAutoPlanData(updatedPlan);

          } catch (err: unknown) {
            console.error(err);
            const msg = err instanceof Error ? err.message : 'Error re-routing plan';
            alert(msg);
          } finally {
            setAutoPlanLoading(false);
          }
        }
      });

      map.addInteraction(translate);
      translateInteractionRef.current = translate;
    }

    return () => {
      if (translateInteractionRef.current && mapRef.current) {
        mapRef.current.removeInteraction(translateInteractionRef.current);
      }
    };
  }, [mapReady, autoPlanData, drawnPolygon]);

  // ─── AI Auto-Plan Functions ──────────────────────────────────────────
  const clearAutoPlan = useCallback(() => {
    setAutoPlanSummary(null);
    setAutoPlanData(null);
    if (autoPlanSourceRef.current) autoPlanSourceRef.current.clear();
  }, []);

  const startAutoPlanDraw = useCallback(() => {
    const map = mapRef.current;
    const source = autoPlanSourceRef.current;
    if (!map || !source) return;

    source.clear();

    const draw = new Draw({
      source: source,
      type: 'Polygon',
    });

    autoPlanDrawRef.current = draw;
    map.addInteraction(draw);

    draw.on('drawend', async (evt) => {
      const feature = evt.feature;
      const geometry = feature.getGeometry();
      if (geometry && geometry instanceof Polygon) {
        const coords = geometry.getCoordinates()[0].map((coord) => {
          return toLonLat(coord) as [number, number];
        });

        setDrawnPolygon(coords);
        map.removeInteraction(draw);
        autoPlanDrawRef.current = null;
        setAutoPlanActive(false);

        setAutoPlanLoading(true);
        try {
          const res = await fetch('/api/gis/auto-plan', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ polygon: coords }),
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to generate layout');
          }

          const plan = (await res.json()) as AutoPlanResult;
          setAutoPlanSummary(plan.summary);
          setAutoPlanData(plan);

        } catch (err: unknown) {
          console.error(err);
          const msg = err instanceof Error ? err.message : 'Error creating AI plan';
          alert(msg);
        } finally {
          setAutoPlanLoading(false);
        }
      }
    });
  }, []);

  const toggleAutoPlan = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    setAutoPlanActive((prev) => {
      if (prev) {
        if (autoPlanDrawRef.current) {
          map.removeInteraction(autoPlanDrawRef.current);
          autoPlanDrawRef.current = null;
        }
        return false;
      } else {
        if (measureActive) clearMeasure();
        startAutoPlanDraw();
        return true;
      }
    });
  }, [measureActive, clearMeasure, startAutoPlanDraw]);

  const handleSavePlan = async () => {
    if (!projectId) {
      alert('Error: Project ID is missing from map context.');
      return;
    }
    if (!routeName.trim()) {
      alert('Please enter a valid Route Name.');
      return;
    }
    if (!autoPlanData) {
      alert('Error: No active planning data to save.');
      return;
    }

    setSavingPlan(true);
    try {
      const res = await fetch('/api/gis/auto-plan/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          routeName,
          poles: autoPlanData.poles,
          closures: autoPlanData.closures,
          cables: autoPlanData.cables,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save route plan');
      }

      const data = await res.json();
      alert(data.message);
      
      // Clear draft states
      clearAutoPlan();

      // Trigger refetch callback in parent project page if defined
      if (onRouteSaved) {
        onRouteSaved();
      }

    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Error saving route plan';
      alert(msg);
    } finally {
      setSavingPlan(false);
    }
  };

  const countFeatures = useMemo(() => {
    let cables = 0;
    let poles = 0;
    let fdps = 0;
    let fiberJoints = 0;
    let chambers = 0;
    let roads = 0;
    const assetsCount = assets?.length || 0;

    for (const route of gisRoutes) {
      cables += route.cableSegments?.length || 0;
      poles += route.poles?.length || 0;
      chambers += route.chambers?.length || 0;
      roads += route.roadSegments?.length || 0;
      if (route.closures) {
        for (const cl of route.closures) {
          if (cl.closureType === 'TERMINAL') {
            fdps++;
          } else {
            fiberJoints++;
          }
        }
      }
    }

    return {
      cables,
      poles,
      fdps,
      fiberJoints,
      chambers,
      roads,
      assets: assetsCount
    };
  }, [gisRoutes, assets]);

  const toggleLayer = useCallback((layer: keyof LayerVisibility) => {
    setVisibility((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }, []);
  const showAllLayers = useCallback(() => {
    setVisibility({ cables: true, poles: true, fdps: true, fiberJoints: true, chambers: true, roads: true, assets: true });
  }, []);
  const hideAllLayers = useCallback(() => {
    setVisibility({ cables: false, poles: false, fdps: false, fiberJoints: false, chambers: false, roads: false, assets: false });
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
      {mapReady && gisRoutes.length === 0 && !assets?.length && !preSurveyMode && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 rounded-lg z-10 backdrop-blur-sm">
          <div className="text-center space-y-3 p-8">
            <p className="text-4xl">🗺️</p>
            <p className="text-base font-medium text-gray-700">No GIS Data Available</p>
            <p className="text-sm text-gray-500 max-w-sm">Import GIS files to visualize routes, poles, cables and other telecom infrastructure on the map.</p>
          </div>
        </div>
      )}

      {/* ─── Pre-Survey AI Panel ─────────────────────────────────────────── */}
      {preSurveyMode && (
        <div className="absolute top-3 left-3 z-[1000] bg-slate-900/90 text-white rounded-lg shadow-lg border border-slate-700 p-3.5 max-w-[320px] backdrop-blur-sm transition-all">
          <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span>🤖 AI Pre-Survey Mode Active</span>
          </div>
          <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">
            {!preSurveyStart ? (
              "👉 Click anywhere on the map to set the starting location (Point A)."
            ) : !preSurveyEnd ? (
              "👉 Now click another point to set the ending location (Point B)."
            ) : (
              "✅ Point A and Point B selected! Click 'Generate AI Pre-Survey' on the sidebar."
            )}
          </p>
          {preSurveyStart && (
            <div className="mt-2.5 text-[10px] text-slate-400 space-y-1 border-t border-slate-800 pt-2">
              <div className="flex justify-between">
                <span>Start Point A:</span>
                <span className="font-mono text-amber-300">{preSurveyStart[1].toFixed(5)}, {preSurveyStart[0].toFixed(5)}</span>
              </div>
              {preSurveyEnd && (
                <div className="flex justify-between">
                  <span>End Point B:</span>
                  <span className="font-mono text-blue-300">{preSurveyEnd[1].toFixed(5)}, {preSurveyEnd[0].toFixed(5)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {/* ─── Floating Controls Panel ──────────────────────────────────────── */}
      {mapReady && (
        <div className="absolute top-3 right-3 z-[1000] bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px] max-w-[280px]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Layers</h3>
            <div className="flex gap-1">
              <button onClick={showAllLayers} className="text-[10px] text-blue-600 hover:text-blue-800 font-medium px-1.5 py-0.5 rounded hover:bg-blue-50">All</button>
              <button onClick={hideAllLayers} className="text-[10px] text-gray-500 hover:text-gray-700 font-medium px-1.5 py-0.5 rounded hover:bg-gray-100">None</button>
            </div>
          </div>
          <div className="space-y-1 mb-3">
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

          {autoPlanData && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-orange-50 border border-orange-100 mb-3">
              <span className="w-3 h-3 rounded-sm flex-shrink-0 bg-orange-500" />
              <span className="flex-1 text-[10px] font-semibold text-orange-700">🤖 AI Planned Draft Layout</span>
            </div>
          )}

          {/* ─── Distance Measurement Tool ─────────────────────────────────── */}
          <div className="border-t border-gray-100 pt-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                📏 Distance Tool
              </span>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={toggleMeasure}
                className={`flex-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-md transition-all ${
                  measureActive
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-700'
                }`}
              >
                {measureActive ? '📏 Measuring...' : '📏 Measure Distance'}
              </button>
              <button
                onClick={clearMeasure}
                className="text-[10px] font-semibold px-2 py-1.5 rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                disabled={measureActive}
              >
                Clear
              </button>
            </div>
            {measureActive && (
              <p className="text-[9px] text-amber-600 font-medium mt-1.5 leading-tight">
                Click points on the map to measure. Double-click to finish.
              </p>
            )}
            {totalDistance !== null && !measureActive && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-[10px] text-amber-800 font-bold">
                  📐 Last Measurement: {totalDistance.toFixed(2)} m
                </p>
                {lastSegmentDistance !== null && (
                  <p className="text-[9px] text-amber-600 font-medium">
                    Last segment: {lastSegmentDistance.toFixed(2)} m
                    {/* total pole count */}
                    {measurePointsCount > 0 && ` · ${measurePointsCount} points`}
                  </p>
                )}
              </div>
            )}
            <p className="text-[9px] text-gray-400 mt-1.5 leading-tight">
              Measure pole-to-pole or any point distances in meters for cable path planning.
            </p>
          </div>

          {/* ─── AI Auto-Planner Tool ────────────────────────────────────────── */}
          <div className="border-t border-gray-100 pt-2.5 mt-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                🤖 AI Auto-Planner
              </span>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={toggleAutoPlan}
                disabled={autoPlanLoading}
                className={`flex-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-md transition-all ${
                  autoPlanActive
                    ? 'bg-orange-600 text-white shadow-md shadow-orange-200 animate-pulse'
                    : 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-700'
                }`}
              >
                {autoPlanLoading ? '⚡ Querying OSM...' : autoPlanActive ? '✍️ Draw Area...' : '🤖 Draw & Auto-Plan'}
              </button>
              {(autoPlanData || autoPlanActive) && (
                <button
                  onClick={clearAutoPlan}
                  className="text-[10px] font-semibold px-2 py-1.5 rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                  disabled={autoPlanLoading}
                >
                  Clear
                </button>
              )}
            </div>
            {autoPlanActive && (
              <p className="text-[9px] text-orange-600 font-medium mt-1.5 leading-tight">
                Click map vertices to draw a polygon. Double-click to complete and auto-generate the plan.
              </p>
            )}
            
            {/* Auto-Plan Summary Dashboard */}
            {autoPlanSummary && (
              <div className="mt-2.5 bg-orange-50/50 border border-orange-100 rounded-lg p-2.5 space-y-2">
                <p className="text-[10px] text-orange-800 font-bold flex items-center gap-1">
                  📐 Generated Layout Draft
                </p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-600 border-t border-orange-100/50 pt-1.5">
                  <div className="flex justify-between">
                    <span>Homes SDU:</span>
                    <strong className="text-slate-800">{autoPlanSummary.sduCount}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>MDU / Schools:</span>
                    <strong className="text-slate-800">{autoPlanSummary.mduCount}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>FDPs (1:8):</span>
                    <strong className="text-slate-800">{autoPlanSummary.fdpCount}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>New Poles:</span>
                    <strong className="text-slate-800">{autoPlanSummary.poleCount}</strong>
                  </div>
                </div>
                <div className="flex justify-between text-[10px] text-slate-600 border-t border-orange-100/50 pt-1 pb-1.5">
                  <span>Total Cable:</span>
                  <strong className="text-orange-700">{autoPlanSummary.totalCableLength.toFixed(0)} meters</strong>
                </div>
                
                {/* Route Name Input and Save Button */}
                <div className="border-t border-orange-100/50 pt-2 space-y-2">
                  <label className="block text-[10px] font-semibold text-slate-600">Route Name:</label>
                  <input
                    type="text"
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    className="w-full text-xs px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white text-slate-800"
                    placeholder="Enter route name..."
                    disabled={savingPlan}
                  />
                  <button
                    onClick={handleSavePlan}
                    disabled={savingPlan}
                    className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold text-xs py-1.5 px-3 rounded shadow transition-colors flex items-center justify-center gap-1"
                  >
                    {savingPlan ? '💾 Saving Plan...' : '💾 Save Route Plan'}
                  </button>
                </div>

                <div className="text-[9px] text-slate-400 font-medium leading-normal mt-1 border-t border-orange-100/50 pt-1.5">
                  💡 Drag & Drop FDPs/Poles to customize layout before saving.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Map container - must have explicit height for tiles to render */}
      <div
        ref={mapContainerRef}
        className="rounded-lg border border-gray-200 overflow-hidden"
        style={{ width: '100%', height, minHeight: '300px', display: 'block', position: 'relative' }}
      />
    </div>
  );
}