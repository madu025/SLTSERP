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
import XYZ from 'ol/source/XYZ';
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
import Modify from 'ol/interaction/Modify';
import Collection from 'ol/Collection';
import { type AutoPlanResult, type PlannedClosure } from '@/services/GISAutoPlanService';
import {
  LAYER_COLORS,
  LAYER_LABELS,
  LAYER_ICONS,
  hexToRgba,
  createCircleStyle,
  createHoverCircleStyle,
  createHoverPolylineStyle,
  getLayerStyles,
  type LayerVisibility,
  getCableColorByFiberCount
} from './utils/mapStyles';
import { auditOSPLayout, generateOSPReasoning } from './utils/mapAuditor';

export {
  LAYER_COLORS,
  LAYER_LABELS,
  LAYER_ICONS,
  type LayerVisibility
};
import {
  getCablePopupHtml,
  getRoutePopupHtml,
  getGeoJsonCablePopupHtml,
  getGeoJsonPointPopupHtml,
  getPolePopupHtml,
  getClosurePopupHtml,
  getChamberPopupHtml,
  getRoadPopupHtml,
  getAssetPopupHtml,
  getPlannedFeedPointPopupHtml,
  getPlannedClosurePopupHtml,
  getPlannedPolePopupHtml,
  getPlannedCablePopupHtml,
  getSelectedFeedPointPopupHtml,
  getPinnedStartDevicePopupHtml
} from './utils/mapPopups';
import { GISMapLegend } from './components/GISMapLegend';
import { GISAutoPlanModal, isPointInPolygon } from './components/GISAutoPlanModal';
import { GISSidebarPanel } from './components/GISSidebarPanel';
import { useGISMeasurement } from './hooks/useGISMeasurement';

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
  status?: string;
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
  geojsonData?: unknown;
  cableType?: string;
  generatedBOQs?: unknown[];
  metadata?: unknown;
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
  preSurveyStart?: [number, number] | null;
  preSurveyEnd?: [number, number] | null;
  setPreSurveyStart?: (pt: [number, number] | null) => void;
  setPreSurveyEnd?: (pt: [number, number] | null) => void;
  layerVisibility?: LayerVisibility;
  onLayerVisibilityChange?: (visibility: LayerVisibility) => void;
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
  return new Overlay({ element, autoPan: { animation: { duration: 250 } }, offset: [0, -10], positioning: 'bottom-center', stopEvent: true });
}

const calculatePathLength = (coords: [number, number][]): number => {
  let len = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    len += getDistance(coords[i], coords[i + 1]);
  }
  return len;
};

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
  onRouteSaved,
  preSurveyStart = null,
  preSurveyEnd = null,
  setPreSurveyStart = () => {},
  setPreSurveyEnd = () => {},
  layerVisibility: layerVisibilityProp
}: GISMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const popupRef = useRef<Overlay | null>(null);
  const layerSourcesRef = useRef<Record<string, VectorSource>>({});
  const vectorLayersRef = useRef<Record<string, VectorLayer<VectorSource>>>({});
  const [mapReady, setMapReady] = useState(false);
  const preSurveySourceRef = useRef<VectorSource | null>(null);
  const preSurveyLayerRef = useRef<VectorLayer | null>(null);
  const [editingCableId, setEditingCableId] = useState<string | null>(null);
  const [selectedCableFeature, setSelectedCableFeature] = useState<Feature | null>(null);
  const [savingCableGeometry, setSavingCableGeometry] = useState(false);
  const originalCoordsRef = useRef<[number, number][]>([]);
  const [localVisibility] = useState<LayerVisibility>({
    cables: true, poles: true, fdps: true, fiberJoints: true, chambers: true, roads: true, assets: true,
  });

  const visibility = layerVisibilityProp || localVisibility;





  // ─── AI Auto-Plan State ──────────────────────────────────────────────
  const [toolMode, setToolMode] = useState<'PLAN' | 'MEASURE'>('PLAN');
  const [autoPlanActive, setAutoPlanActive] = useState(false);
  const [autoPlanLoading, setAutoPlanLoading] = useState(false);
  const [autoPlanSummary, setAutoPlanSummary] = useState<AutoPlanResult['summary'] | null>(null);
  const [autoPlanData, setAutoPlanData] = useState<AutoPlanResult | null>(null);
  const autoPlanDataRef = useRef(autoPlanData);
  useEffect(() => {
    autoPlanDataRef.current = autoPlanData;
  }, [autoPlanData]);

  const complianceReport = useMemo(() => {
    return auditOSPLayout(autoPlanData);
  }, [autoPlanData]);

  const ospReasoning = useMemo(() => {
    return generateOSPReasoning(autoPlanData);
  }, [autoPlanData]);
  const [feedPointCoord, setFeedPointCoord] = useState<[number, number] | null>(null);
  const [feedPointSelectActive, setFeedPointSelectActive] = useState(false);

  // Initialize feedPointCoord from active route loaded from database on page load
  useEffect(() => {
    if (!mapReady || gisRoutes.length === 0) return;
    const activeRoute = gisRoutes.find((r) => r.isActive) || gisRoutes[0];
    if (activeRoute?.closures) {
      const fp = activeRoute.closures.find((c) => Number(c.closureNumber) === 0);
      if (fp) {
        const lat = fp.latitude ?? fp.lat;
        const lng = fp.longitude ?? fp.lon ?? fp.lng;
        if (lat != null && lng != null) {
          setFeedPointCoord([lng, lat]);
        }
      } else {
        setFeedPointCoord(null);
      }
    }
  }, [gisRoutes, mapReady]);
  const [routeName, setRouteName] = useState('AI Planned Route');
  const [savingPlan, setSavingPlan] = useState(false);
  const [drawnPolygon, setDrawnPolygon] = useState<[number, number][] | null>(null);
  const [splitterRatio, setSplitterRatio] = useState<string>('1:8');
  const [pendingPolygon, setPendingPolygon] = useState<[number, number][] | null>(null);
  const [startDeviceType, setStartDeviceType] = useState<string>('OLT');
  const [selectedExistingDevice, setSelectedExistingDevice] = useState<{ id: string; name: string; type: string; lat: number; lon: number } | null>(null);
  const [isCreateNewDevice, setIsCreateNewDevice] = useState<boolean>(true);
  const [customStartDeviceCoord, setCustomStartDeviceCoord] = useState<[number, number] | null>(null);
  const [pinningStartDevice, setPinningStartDevice] = useState(false);
  
  const [mapType, setMapType] = useState<'osm' | 'google_satellite' | 'google_hybrid'>('osm');
  const baseLayerRef = useRef<TileLayer | null>(null);
  
  // ─── AI Optimization & Audit State ─────────────────────────────────────
  const [aiAuditLoading, setAiAuditLoading] = useState(false);
  const [aiAuditWarnings, setAiAuditWarnings] = useState<string[] | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<{ index: number; latitude: number; longitude: number; reason: string }[] | null>(null);
  
  const autoPlanSourceRef = useRef<VectorSource | null>(null);
  const autoPlanLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const autoPlanDrawRef = useRef<Draw | null>(null);
  const translateInteractionRef = useRef<Translate | null>(null);

  // ─── Distance Measurement State & Hook ──────────────────────────────
  const [measureActive, setMeasureActive] = useState(false);
  const {
    totalDistance,
    lastSegmentDistance,
    clearMeasure,
    toggleMeasure
  } = useGISMeasurement({
    mapReady,
    mapRef,
    measureActive,
    setMeasureActive,
    setAutoPlanActive,
    autoPlanDrawRef
  });

  // Register window callbacks for manual slack loop actions
  useEffect(() => {
    const win = window as unknown as {
      addSlackLoopToSegment?: (segmentId: string) => Promise<void>;
      addSlackLoopToDraftSegment?: (index: number) => void;
      startEditPole?: (index: number) => void;
      savePoleDetails?: (index: number, height: number, poleType: string) => void;
      startEditClosure?: (index: number) => void;
      saveClosureDetails?: (index: number, closureType: string, capacity: number, notes: string) => void;
      startEditCable?: (index: number) => void;
      saveCableDetails?: (index: number, cableType: string, fiberCount: number) => void;
    };

    win.addSlackLoopToSegment = async (segmentId: string) => {
      try {
        const res = await fetch(`/api/gis/cable-segment/slack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segmentId })
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to add slack loop');
        }
        alert('Tension slack loop added (+20m). BOQ regenerated.');
        if (onRouteSaved) {
          onRouteSaved();
        }
        if (popupRef.current) {
          popupRef.current.getElement()!.style.display = 'none';
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        alert(msg);
      }
    };

    win.addSlackLoopToDraftSegment = (index: number) => {
      setAutoPlanData((prev) => {
        if (!prev || !prev.cables) return prev;
        const updatedCables = prev.cables.map((c) => {
          if (c.index === index) {
            const currentLoops = ((c as unknown as Record<string, unknown>).slackLoops as number) || 0;
            return {
              ...c,
              length: c.length + 20.0,
              slackLoops: currentLoops + 1
            };
          }
          return c;
        });

        const totalCableLength = updatedCables.reduce((acc, c) => acc + c.length, 0);
        const updatedSummary = {
          ...prev.summary,
          totalCableLength
        };

        setAutoPlanSummary(updatedSummary);
        return {
          ...prev,
          cables: updatedCables,
          summary: updatedSummary
        };
      });

      if (popupRef.current) {
        popupRef.current.getElement()!.style.display = 'none';
      }
    };

    win.startEditPole = (index: number) => {
      const popupEl = popupRef.current?.getElement();
      if (!popupEl) return;

      const pole = autoPlanDataRef.current?.poles?.find((p) => p.index === index);
      if (!pole) return;

      popupEl.innerHTML = `
        <div style="font-family: sans-serif; min-width: 220px; padding: 4px;">
          <h3 style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #2563eb;">✏️ Edit Pole #${pole.index}</h3>
          <div style="margin-bottom: 6px;">
            <label style="font-size: 10px; color: #666; display: block; margin-bottom: 2px;">Height</label>
            <select id="edit-pole-height-${index}" style="width: 100%; font-size: 12px; padding: 3px; border: 1px solid #ccc; border-radius: 4px;">
              <option value="8" ${pole.height === 8 ? 'selected' : ''}>8m (Road Crossing)</option>
              <option value="9" ${pole.height === 9 ? 'selected' : ''}>9m (Standard)</option>
              <option value="11" ${pole.height === 11 ? 'selected' : ''}>11m</option>
              <option value="13" ${pole.height === 13 ? 'selected' : ''}>13m</option>
            </select>
          </div>
          <div style="margin-bottom: 10px;">
            <label style="font-size: 10px; color: #666; display: block; margin-bottom: 2px;">Type</label>
            <select id="edit-pole-type-${index}" style="width: 100%; font-size: 12px; padding: 3px; border: 1px solid #ccc; border-radius: 4px;">
              <option value="CONCRETE" ${(pole.poleType as string) === 'CONCRETE' ? 'selected' : ''}>CONCRETE</option>
              <option value="STEEL" ${(pole.poleType as string) === 'STEEL' ? 'selected' : ''}>STEEL</option>
              <option value="GI_PIPE" ${(pole.poleType as string) === 'GI_PIPE' ? 'selected' : ''}>GI PIPE</option>
            </select>
          </div>
          <button onclick="window.savePoleDetails(${pole.index}, parseInt(document.getElementById('edit-pole-height-${index}').value, 10), document.getElementById('edit-pole-type-${index}').value)" style="width: 100%; background: #10b981; color: white; border: none; padding: 6px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;">💾 Save Changes</button>
        </div>
      `;
    };

    win.savePoleDetails = (index: number, height: number, poleType: string) => {
      setAutoPlanData((prev) => {
        if (!prev || !prev.poles) return prev;
        const updatedPoles = prev.poles.map((p) => {
          if (p.index === index) {
            return { ...p, height, poleType: poleType as 'CONCRETE' };
          }
          return p;
        });
        return { ...prev, poles: updatedPoles };
      });
      if (popupRef.current) {
        popupRef.current.getElement()!.style.display = 'none';
      }
    };

    win.startEditClosure = (index: number) => {
      const popupEl = popupRef.current?.getElement();
      if (!popupEl) return;

      const cl = autoPlanDataRef.current?.closures?.find((c) => c.index === index);
      if (!cl) return;

      popupEl.innerHTML = `
        <div style="font-family: sans-serif; min-width: 220px; padding: 4px;">
          <h3 style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #2563eb;">✏️ Edit Closure #${cl.index}</h3>
          <div style="margin-bottom: 6px;">
            <label style="font-size: 10px; color: #666; display: block; margin-bottom: 2px;">Closure/Joint Type</label>
            <select id="edit-cl-type-${index}" style="width: 100%; font-size: 12px; padding: 3px; border: 1px solid #ccc; border-radius: 4px;">
              <option value="TERMINAL" ${(cl.closureType as string) === 'TERMINAL' ? 'selected' : ''}>FDP (Fiber Distribution Point)</option>
              <option value="DOME" ${(cl.closureType as string) === 'DOME' ? 'selected' : ''}>Dome Joint Closure</option>
              <option value="INLINE" ${(cl.closureType as string) === 'INLINE' ? 'selected' : ''}>Inline Joint Closure</option>
              <option value="JOINT_BOX" ${(cl.closureType as string) === 'JOINT_BOX' ? 'selected' : ''}>Joint Box (JB)</option>
            </select>
          </div>
          <div style="margin-bottom: 6px;">
            <label style="font-size: 10px; color: #666; display: block; margin-bottom: 2px;">Capacity</label>
            <select id="edit-cl-capacity-${index}" style="width: 100%; font-size: 12px; padding: 3px; border: 1px solid #ccc; border-radius: 4px;">
              <option value="8" ${cl.capacity === 8 ? 'selected' : ''}>8 Core</option>
              <option value="12" ${cl.capacity === 12 ? 'selected' : ''}>12 Core</option>
              <option value="16" ${cl.capacity === 16 ? 'selected' : ''}>16 Core</option>
              <option value="24" ${cl.capacity === 24 ? 'selected' : ''}>24 Core</option>
              <option value="48" ${cl.capacity === 48 ? 'selected' : ''}>48 Core</option>
              <option value="96" ${cl.capacity === 96 ? 'selected' : ''}>96 Core</option>
            </select>
          </div>
          <div style="margin-bottom: 10px;">
            <label style="font-size: 10px; color: #666; display: block; margin-bottom: 2px;">Notes</label>
            <input type="text" id="edit-cl-notes-${index}" value="${cl.notes || ''}" style="width: 100%; font-size: 12px; padding: 4px 3px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <button onclick="window.saveClosureDetails(${cl.index}, document.getElementById('edit-cl-type-${index}').value, parseInt(document.getElementById('edit-cl-capacity-${index}').value, 10), document.getElementById('edit-cl-notes-${index}').value)" style="width: 100%; background: #10b981; color: white; border: none; padding: 6px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;">💾 Save Changes</button>
        </div>
      `;
    };

    win.saveClosureDetails = (index: number, closureType: string, capacity: number, notes: string) => {
      setAutoPlanData((prev) => {
        if (!prev || !prev.closures) return prev;
        const updatedClosures = prev.closures.map((c) => {
          if (c.index === index) {
            return { ...c, closureType: closureType as ('TERMINAL' | 'DOME'), capacity, notes };
          }
          return c;
        });
        return { ...prev, closures: updatedClosures };
      });
      if (popupRef.current) {
        popupRef.current.getElement()!.style.display = 'none';
      }
    };

    win.startEditCable = (index: number) => {
      const popupEl = popupRef.current?.getElement();
      if (!popupEl) return;

      const cable = autoPlanDataRef.current?.cables?.find((c) => c.index === index);
      if (!cable) return;

      popupEl.innerHTML = `
        <div style="font-family: sans-serif; min-width: 220px; padding: 4px;">
          <h3 style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #2563eb;">✏️ Edit Cable #${cable.index}</h3>
          <div style="margin-bottom: 6px;">
            <label style="font-size: 10px; color: #666; display: block; margin-bottom: 2px;">Cable Type</label>
            <select id="edit-cable-type-${index}" style="width: 100%; font-size: 12px; padding: 3px; border: 1px solid #ccc; border-radius: 4px;">
              <option value="ADSS" ${(cable.cableType as string) === 'ADSS' ? 'selected' : ''}>ADSS (Aerial)</option>
              <option value="UNDERGROUND" ${(cable.cableType as string) === 'UNDERGROUND' ? 'selected' : ''}>UNDERGROUND</option>
              <option value="ARMORED" ${(cable.cableType as string) === 'ARMORED' ? 'selected' : ''}>ARMORED</option>
              <option value="DROP" ${(cable.cableType as string) === 'DROP' ? 'selected' : ''}>DROP CABLE</option>
            </select>
          </div>
          <div style="margin-bottom: 10px;">
            <label style="font-size: 10px; color: #666; display: block; margin-bottom: 2px;">Fiber Count</label>
            <select id="edit-cable-fibers-${index}" style="width: 100%; font-size: 12px; padding: 3px; border: 1px solid #ccc; border-radius: 4px;">
              <option value="4" ${cable.fiberCount === 4 ? 'selected' : ''}>4 Core (4F)</option>
              <option value="8" ${cable.fiberCount === 8 ? 'selected' : ''}>8 Core (8F)</option>
              <option value="12" ${cable.fiberCount === 12 ? 'selected' : ''}>12 Core (12F)</option>
              <option value="24" ${cable.fiberCount === 24 ? 'selected' : ''}>24 Core (24F)</option>
              <option value="48" ${cable.fiberCount === 48 ? 'selected' : ''}>48 Core (48F)</option>
              <option value="96" ${cable.fiberCount === 96 ? 'selected' : ''}>96 Core (96F)</option>
            </select>
          </div>
          <button onclick="window.saveCableDetails(${cable.index}, document.getElementById('edit-cable-type-${index}').value, parseInt(document.getElementById('edit-cable-fibers-${index}').value, 10))" style="width: 100%; background: #10b981; color: white; border: none; padding: 6px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;">💾 Save Changes</button>
        </div>
      `;
    };

    win.saveCableDetails = (index: number, cableType: string, fiberCount: number) => {
      setAutoPlanData((prev) => {
        if (!prev || !prev.cables) return prev;
        const updatedCables = prev.cables.map((c) => {
          if (c.index === index) {
            return { ...c, cableType: cableType as 'ADSS', fiberCount };
          }
          return c;
        });
        return { ...prev, cables: updatedCables };
      });
      if (popupRef.current) {
        popupRef.current.getElement()!.style.display = 'none';
      }
    };

    return () => {
      delete win.addSlackLoopToSegment;
      delete win.addSlackLoopToDraftSegment;
      delete win.startEditPole;
      delete win.savePoleDetails;
      delete win.startEditClosure;
      delete win.saveClosureDetails;
      delete win.startEditCable;
      delete win.saveCableDetails;
    };
  }, [onRouteSaved]);

  // Automatically trigger auto-plan layout regeneration when splitter ratio or feed point changes
  useEffect(() => {
    if (!drawnPolygon || autoPlanLoading) return;

    const triggerReplan = async () => {
      setAutoPlanLoading(true);
      try {
        const res = await fetch('/api/gis/auto-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            polygon: drawnPolygon,
            customClosures: (() => {
              if (!autoPlanData?.closures) return undefined;
              const hasFP = autoPlanData.closures.some(c => c.index === 0);
              if (hasFP) {
                return autoPlanData.closures.map(c => 
                  c.index === 0 && feedPointCoord 
                    ? { ...c, latitude: feedPointCoord[1], longitude: feedPointCoord[0] } 
                    : c
                );
              } else if (feedPointCoord) {
                return [
                  {
                    index: 0,
                    closureType: 'DOME' as const,
                    latitude: feedPointCoord[1],
                    longitude: feedPointCoord[0],
                    capacity: 8,
                    status: 'PLANNED' as const,
                    notes: 'Feed Point',
                  },
                  ...autoPlanData.closures
                ];
              }
              return autoPlanData.closures;
            })(),
            splitterRatio,
            feedPoint: feedPointCoord ? { lat: feedPointCoord[1], lon: feedPointCoord[0] } : undefined
          })
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to regenerate layout');
        }

        const plan = (await res.json()) as AutoPlanResult;
        setAutoPlanSummary(plan.summary);
        setAutoPlanData(plan);
      } catch (err: unknown) {
        console.error(err);
        const msg = err instanceof Error ? err.message : 'Error updating auto plan settings';
        alert(msg);
      } finally {
        setAutoPlanLoading(false);
      }
    };

    triggerReplan();
  }, [splitterRatio, feedPointCoord]); // eslint-disable-line react-hooks/exhaustive-deps



  const layerStyles = useMemo(() => getLayerStyles(), []);

  // --- Initialize map once ---
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const baseLayer = new TileLayer({
      source: new OSM({ attributions: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' })
    });
    baseLayerRef.current = baseLayer;

    const map = new Map({
      target: mapContainerRef.current,
      layers: [baseLayer],
      view: new View({ center: fromLonLat([80.7718, 7.8731]), zoom: 8, maxZoom: 21 }),
      controls: defaultControls().extend([new FullScreen()]),
    });
    mapRef.current = map;

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

    requestAnimationFrame(() => {
      setMapReady(true);
      map.updateSize();
      // Force tile refresh by triggering multiple size updates
      setTimeout(() => map.updateSize(), 200);
      setTimeout(() => map.updateSize(), 500);
    });
    return () => { map.setTarget(undefined); mapRef.current = null; };
  }, []);

  // --- Handle base layer switcher ---
  useEffect(() => {
    if (!baseLayerRef.current) return;
    if (mapType === 'osm') {
      baseLayerRef.current.setSource(new OSM({ attributions: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }));
    } else if (mapType === 'google_satellite') {
      baseLayerRef.current.setSource(new XYZ({
        url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        attributions: 'Map data &copy;2026 Google'
      }));
    } else if (mapType === 'google_hybrid') {
      baseLayerRef.current.setSource(new XYZ({
        url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        attributions: 'Map data &copy;2026 Google'
      }));
    }
  }, [mapType]);

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
      
      if (selectedCableFeature) return;

      const feature = map.forEachFeatureAtPixel(evt.pixel, (f: import('ol/Feature').FeatureLike) => f) as Feature | undefined;
      if (feature) {
        const layerKey = feature.get('layerKey') as string;
        const segmentId = feature.get('index') as string | undefined;

        if (layerKey === 'cables' && segmentId) {
          setEditingCableId(segmentId);
          setSelectedCableFeature(feature);
          const geom = feature.getGeometry();
          if (geom instanceof LineString) {
            originalCoordsRef.current = geom.getCoordinates() as [number, number][];
          }
          if (popup.getElement()) popup.getElement()!.style.display = 'none';
          return;
        }

        const html = feature.get('popupHtml') as string;
        if (html && popup.getElement()) { popup.getElement()!.innerHTML = html; popup.setPosition(evt.coordinate); popup.getElement()!.style.display = ''; }
      } else {
        if (popup.getElement()) popup.getElement()!.style.display = 'none';
      }
    };
    mapRef.current.on('click', handleClick);
    return () => { mapRef.current?.un('click', handleClick); };
  }, [mapReady, selectedCableFeature]);



  // --- Sync pre-survey features on map with state props ---
  useEffect(() => {
    const source = preSurveySourceRef.current;
    if (!source || !mapReady) return;

    source.clear();

    if (preSurveyStart) {
      const startCoord = fromLonLat(preSurveyStart);
      const startPt = new Point(startCoord);
      const startFeature = new Feature({ geometry: startPt });
      startFeature.setStyle(new Style({
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({ color: '#ef4444' }), // Red for Start
          stroke: new Stroke({ color: '#ffffff', width: 2.5 })
        })
      }));
      source.addFeature(startFeature);

      if (preSurveyEnd) {
        const endCoord = fromLonLat(preSurveyEnd);
        const endPt = new Point(endCoord);
        const endFeature = new Feature({ geometry: endPt });
        endFeature.setStyle(new Style({
          image: new CircleStyle({
            radius: 8,
            fill: new Fill({ color: '#3b82f6' }), // Blue for End
            stroke: new Stroke({ color: '#ffffff', width: 2.5 })
          })
        }));
        source.addFeature(endFeature);

        // Draw line between Start and End
        const line = new LineString([startCoord, endCoord]);
        const lineFeature = new Feature({ geometry: line });
        lineFeature.setStyle(new Style({
          stroke: new Stroke({ color: '#f59e0b', width: 4, lineDash: [8, 4] })
        }));
        source.addFeature(lineFeature);
      }
    }
  }, [preSurveyStart, preSurveyEnd, mapReady]);

  // ─── Pre-Survey click handler ─────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const map = mapRef.current;

    const handlePreSurveyClick = (evt: import('ol/MapBrowserEvent').default<PointerEvent | KeyboardEvent | WheelEvent>) => {
      if (!preSurveyMode) return;
      
      const lonLat = toLonLat(evt.coordinate) as [number, number]; // [lng, lat]

      if (!preSurveyStart || (preSurveyStart && preSurveyEnd)) {
        // First click (or reset): set start point
        setPreSurveyStart(lonLat);
        setPreSurveyEnd(null);
      } else {
        // Second click: set end point
        setPreSurveyEnd(lonLat);

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
  }, [mapReady, preSurveyMode, preSurveyStart, preSurveyEnd, onPreSurveyPointsSelected, setPreSurveyStart, setPreSurveyEnd]);

  // ─── Feed Point Selection Interaction ──────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapReady || !feedPointSelectActive) return;
    const map = mapRef.current;

    const handleFeedPointClick = (evt: import('ol/MapBrowserEvent').default<PointerEvent | KeyboardEvent | WheelEvent>) => {
      const lonLat = toLonLat(evt.coordinate) as [number, number]; // [lng, lat]
      setFeedPointCoord(lonLat);
      setFeedPointSelectActive(false); // Turn off selection mode after click
    };

    map.on('click', handleFeedPointClick);
    return () => {
      map.un('click', handleFeedPointClick);
    };
  }, [mapReady, feedPointSelectActive]);

  useEffect(() => {
    if (!mapRef.current || !mapReady || !pinningStartDevice) return;
    const map = mapRef.current;

    const handlePinClick = (evt: import('ol/MapBrowserEvent').default<PointerEvent | KeyboardEvent | WheelEvent>) => {
      const lonLat = toLonLat(evt.coordinate) as [number, number];
      setCustomStartDeviceCoord(lonLat);
      setPinningStartDevice(false);
    };

    map.on('click', handlePinClick);
    return () => {
      map.un('click', handlePinClick);
    };
  }, [mapReady, pinningStartDevice]);

  // ─── Cable Modification Interaction ──────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapReady || !selectedCableFeature) return;
    const map = mapRef.current;

    const modifyInteraction = new Modify({
      features: new Collection([selectedCableFeature]),
    });

    map.addInteraction(modifyInteraction);

    const vertexSource = new VectorSource();
    const vertexLayer = new VectorLayer({
      source: vertexSource,
      style: new Style({
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: '#ffffff' }),
          stroke: new Stroke({ color: '#818cf8', width: 2 }),
        }),
      }),
    });
    map.addLayer(vertexLayer);

    const updateVertexFeatures = () => {
      vertexSource.clear();
      const geom = selectedCableFeature.getGeometry();
      if (geom instanceof LineString) {
        const coords = geom.getCoordinates();
        coords.forEach((coord) => {
          vertexSource.addFeature(new Feature({ geometry: new Point(coord) }));
        });
      }
    };

    updateVertexFeatures();

    modifyInteraction.on('modifyend', () => {
      updateVertexFeatures();
    });

    return () => {
      map.removeInteraction(modifyInteraction);
      map.removeLayer(vertexLayer);
    };
  }, [mapReady, selectedCableFeature]);

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
              if (layerKey === 'cables') {
                hoverStyle = createHoverPolylineStyle(customColor);
              } else {
                hoverStyle = createHoverCircleStyle(customColor, 10);
              }
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

    if (autoPlanSourceRef.current) {
      autoPlanSourceRef.current.clear();
    }
    const polygonToRender = pendingPolygon || drawnPolygon;
    if (polygonToRender && polygonToRender.length > 0 && autoPlanSourceRef.current) {
      const coords = polygonToRender.map((c) => fromLonLat(c));
      const geom = new Polygon([coords]);
      const feature = new Feature({ geometry: geom });
      autoPlanSourceRef.current.addFeature(feature);
      allExtents.push(geom.getExtent());
    }

    if (gisRoutes.length > 0 && !drawnPolygon) {
      const activeRoute = gisRoutes.find((r) => r.isActive) || gisRoutes[0];
      const savedMetadata = activeRoute?.metadata as Record<string, unknown> | null;
      const savedPolygon = savedMetadata?.polygon as [number, number][] | null;

      if (savedPolygon && Array.isArray(savedPolygon) && savedPolygon.length > 0) {
        setDrawnPolygon(savedPolygon);
      } else {
        const lons: number[] = [];
        const lats: number[] = [];

        for (const route of gisRoutes) {
          if (route.poles) {
            route.poles.forEach((p) => {
              const lon = p.longitude ?? p.lon ?? p.lng;
              const lat = p.latitude ?? p.lat;
              if (lon != null && lat != null) {
                lons.push(lon);
                lats.push(lat);
              }
            });
          }
          if (route.closures) {
            route.closures.forEach((c) => {
              const lon = c.longitude ?? c.lon ?? c.lng;
              const lat = c.latitude ?? c.lat;
              if (lon != null && lat != null) {
                lons.push(lon);
                lats.push(lat);
              }
            });
          }
        }

        if (lons.length > 0 && lats.length > 0) {
          const minLon = Math.min(...lons) - 0.005;
          const maxLon = Math.max(...lons) + 0.005;
          const minLat = Math.min(...lats) - 0.005;
          const maxLat = Math.max(...lats) + 0.005;

          const bboxPolygon: [number, number][] = [
            [minLon, minLat],
            [maxLon, minLat],
            [maxLon, maxLat],
            [minLon, maxLat],
            [minLon, minLat],
          ];
          setDrawnPolygon(bboxPolygon);
        }
      }
    }

    function addFeature(
      sourceKey: string, 
      geom: import('ol/geom/Geometry').default, 
      popupHtml: string, 
      layerKey: string,
      customStyle?: Style | Style[] | ((feature: import('ol/Feature').FeatureLike, resolution: number) => Style | Style[]),
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



    for (const route of gisRoutes) {
      if (autoPlanData && route.versionType === 'PLANNED') {
        continue;
      }
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

            const fiberText = seg.fiberCount ? `${seg.fiberCount}F` : '';
            const labelText = fiberText;
            const segmentColor = getCableColorByFiberCount(seg.fiberCount);
            
            const cableStyleFunction = (feature: import('ol/Feature').FeatureLike) => {
              const styles = [
                new Style({
                  stroke: new Stroke({ color: segmentColor, width: 3.5 }),
                  text: new Text({
                    text: labelText,
                    font: 'bold 10px system-ui, sans-serif',
                    fill: new Fill({ color: '#0f172a' }),
                    stroke: new Stroke({ color: '#ffffff', width: 3 }),
                    placement: 'line',
                    repeat: 1,
                    textAlign: 'center',
                    textBaseline: 'middle'
                  })
                })
              ];
 
              const geometry = feature.getGeometry() as LineString;
              const coordinates = geometry.getCoordinates();
              if (coordinates.length >= 2) {
                for (let i = 0; i < coordinates.length - 1; i++) {
                  const p1 = coordinates[i];
                  const p2 = coordinates[i + 1];
                  const lonLat1 = toLonLat(p1);
                  const lonLat2 = toLonLat(p2);
                  const dist = getDistance(lonLat1, lonLat2);
 
                  const midPoint = [
                    (p1[0] + p2[0]) / 2,
                    (p1[1] + p2[1]) / 2
                  ];
 
                  styles.push(new Style({
                    geometry: new Point(midPoint),
                    text: new Text({
                      text: `${dist.toFixed(0)}m`,
                      font: 'bold 9px system-ui, sans-serif',
                      fill: new Fill({ color: '#ef4444' }), // Bold red for high visibility span distances
                      stroke: new Stroke({ color: '#ffffff', width: 2.5 }),
                      textAlign: 'center',
                      textBaseline: 'middle',
                      offsetY: -10
                    })
                  }));
                }
              }
              return styles;
            };
 
            addFeature('cables', line, getCablePopupHtml(seg, route), 'cables', cableStyleFunction, segmentColor, seg.id);
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
            const html = getRoutePopupHtml(route);
            addFeature('cables', line, html, 'cables');
          }
        } catch { /* ignore */ }
      }

      // GeoJSON data fallback for AI-generated pre-survey routes and imports
      const geojson = route.geojsonData as Record<string, unknown> | null | undefined;
      if (!route.cableSegments?.length && !route.geometry && geojson && Array.isArray(geojson.features)) {
        try {
          const features = geojson.features as {
            geometry?: { type: string; coordinates: unknown };
            properties?: { layer?: string; Layer?: string };
          }[];
          for (const feature of features) {
            if (!feature || !feature.geometry) continue;
            const geomType = feature.geometry.type;
            const coords = feature.geometry.coordinates;
            const layerName = (feature.properties?.layer || feature.properties?.Layer || '').toUpperCase();
            const displayLayer = layerName.includes('FDP') ? 'fdps' : layerName.includes('FIBER_JOINT') ? 'fiberJoints' : layerName.includes('POLE') ? 'poles' : 'cables';

            if (geomType === 'LineString' && Array.isArray(coords) && coords.length > 1) {
              const lineCoords = (coords as [number, number][]).map((c) => fromLonLat([c[0], c[1]]));
              const line = new LineString(lineCoords);
              const html = getGeoJsonCablePopupHtml(route, layerName);
              addFeature('cables', line, html, 'cables');
            } else if (geomType === 'Point' && Array.isArray(coords) && coords.length === 2) {
              const pointCoords = coords as [number, number];
              const point = new Point(fromLonLat([pointCoords[0], pointCoords[1]]));
              const label = layerName || 'POINT';
              const html = getGeoJsonPointPopupHtml(label, pointCoords);
              addFeature(displayLayer, point, html, displayLayer);
            }
          }
        } catch {
          // ignore invalid geojson fallback
        }
      }

      // --- POLES ---
      if (route.poles?.length) {
        for (const pole of route.poles) {
          const lat = pole.latitude ?? pole.lat;
          const lng = pole.longitude ?? pole.lon ?? pole.lng;
          if (lat == null || lng == null) continue;
          const point = new Point(fromLonLat([lng, lat]));
          const html = getPolePopupHtml(pole, lat, lng);
          
          const isExisting = pole.status === 'VERIFIED' || pole.status === 'INSTALLED';
          const isNew = pole.status === 'PLANNED';
          
          let customStyle: Style | undefined = undefined;
          let customColor: string | undefined = undefined;
          const labelText = pole.poleNumber ? `P-${pole.poleNumber}` : '';
          
          if (isExisting) {
            customColor = '#f97316'; // Orange for existing poles, matching QGIS
            customStyle = new Style({
              image: new CircleStyle({
                radius: 6,
                fill: new Fill({ color: customColor }),
                stroke: new Stroke({ color: '#ffffff', width: 1.5 })
              }),
              text: new Text({
                text: labelText,
                font: 'bold 9px system-ui, sans-serif',
                fill: new Fill({ color: '#7c2d12' }),
                stroke: new Stroke({ color: '#ffffff', width: 2.5 }),
                offsetY: 12,
                textAlign: 'center'
              })
            });
          } else if (isNew) {
            customColor = '#2563eb'; // Blue for new poles, matching QGIS
            customStyle = new Style({
              image: new CircleStyle({
                radius: 6,
                fill: new Fill({ color: customColor }),
                stroke: new Stroke({ color: '#ffffff', width: 1.5 })
              }),
              text: new Text({
                text: labelText,
                font: 'bold 9px system-ui, sans-serif',
                fill: new Fill({ color: '#1e3a8a' }),
                stroke: new Stroke({ color: '#ffffff', width: 2.5 }),
                offsetY: 12,
                textAlign: 'center'
              })
            });
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
          
          const isFeedPoint = Number(closure.closureNumber) === 0;
          const isFDP = closure.closureType === 'TERMINAL' && !isFeedPoint;
          const layerKey = isFDP ? 'fdps' : 'fiberJoints';
          const typeName = isFeedPoint ? 'Feed Point' : isFDP ? 'FDP' : 'Fiber Joint';
          const icon = isFeedPoint ? '📍' : isFDP ? '📦' : '🔗';
          
          const props = (closure.properties as Record<string, unknown>) || {};
          const dpName = (props.Name || props.name || props.FDP_Name || props.dp_name || props.dpName || props.FDP_Code || props.Code || props.code || props.FJ_Name || props.joint_name || '') as string;
          
          const point = new Point(fromLonLat([lng, lat]));
          
          // Setup title text containing DP Name if present
          const titleText = isFeedPoint
            ? 'FEED POINT'
            : dpName 
            ? `${icon} ${dpName}` 
            : `${icon} ${typeName} #${closure.closureNumber || '?'}`;
          
          const html = isFeedPoint
            ? getPlannedFeedPointPopupHtml({ ...closure, index: closure.closureNumber })
            : getClosurePopupHtml(closure, lat, lng, titleText, dpName);
          
          let customStyle: Style | undefined = undefined;
          if (isFeedPoint) {
            const baseColor = '#10b981';
            customStyle = new Style({
              image: new CircleStyle({
                radius: 12,
                fill: new Fill({ color: hexToRgba(baseColor, 0.75) }),
                stroke: new Stroke({ color: '#059669', width: 2 })
              }),
              text: new Text({
                text: 'FEED POINT',
                font: 'bold 10px system-ui, sans-serif',
                fill: new Fill({ color: '#064e3b' }),
                stroke: new Stroke({ color: '#ffffff', width: 3 }),
                offsetY: -18,
                textAlign: 'center'
              })
            });
          } else if (dpName) {
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

          addFeature(layerKey, point, html, layerKey, customStyle, isFeedPoint ? '#10b981' : isFDP ? LAYER_COLORS.fdps : LAYER_COLORS.fiberJoints);
        }
      }

      // --- CHAMBERS ---
      if (route.chambers?.length) {
        for (const ch of route.chambers) {
          const lat = ch.latitude ?? ch.lat;
          const lng = ch.longitude ?? ch.lon ?? ch.lng;
          if (lat == null || lng == null) continue;
          const point = new Point(fromLonLat([lng, lat]));
          const html = getChamberPopupHtml(ch, lat, lng);
          addFeature('chambers', point, html, 'chambers');
        }
      }

      // --- ROADS ---
      if (route.roadSegments?.length) {
        for (const road of route.roadSegments) {
          if (road.coordinates?.length) {
            const coords = road.coordinates.map((c: [number, number]) => fromLonLat([c[0], c[1]]));
            const line = new LineString(coords);
            const html = getRoadPopupHtml(road);
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
        feature.set('popupHtml', getAssetPopupHtml(asset, lat, lng));
        feature.setStyle(createCircleStyle(color, 6, 0.7, '2,2'));
        sources.assets.addFeature(feature);
        allExtents.push(point.getExtent());
      }
    }

    // --- AI PLANNED ELEMENTS ---
    if (autoPlanData) {
      // Render planned closures (FDPs, Joints, and Feed Point)
      if (autoPlanData.closures) {
        for (const cl of autoPlanData.closures) {
          const lat = cl.latitude;
          const lng = cl.longitude;
          const point = new Point(fromLonLat([lng, lat]));
          const isFeedPoint = cl.index === 0;
          const isFDP = cl.closureType === 'TERMINAL' && !isFeedPoint;
          
          const layerKey = isFDP ? 'fdps' : 'fiberJoints';
          const icon = isFeedPoint ? '📍' : isFDP ? '📦' : '🔗';
          
          const titleText = isFeedPoint 
            ? 'FEED POINT' 
            : isFDP 
            ? `Planned DP-${cl.index}` 
            : `Joint Box (JB-${cl.index})`;
            
          const html = isFeedPoint
            ? getPlannedFeedPointPopupHtml(cl)
            : getPlannedClosurePopupHtml(cl, icon, isFDP);
          
          const baseColor = isFeedPoint ? '#10b981' : isFDP ? '#f97316' : '#ca8a04';
          const customStyle = new Style({
            image: new CircleStyle({
              radius: isFeedPoint ? 12 : isFDP ? 10 : 8,
              fill: new Fill({ color: hexToRgba(baseColor, 0.75) }),
              stroke: new Stroke({ color: isFeedPoint ? '#059669' : isFDP ? '#ea580c' : '#a16207', width: 2 })
            }),
            text: new Text({
              text: titleText,
              font: 'bold 10px system-ui, sans-serif',
              fill: new Fill({ color: isFeedPoint ? '#064e3b' : isFDP ? '#1f2937' : '#713f12' }),
              stroke: new Stroke({ color: '#ffffff', width: 3 }),
              offsetY: isFeedPoint ? -18 : -15,
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
          const html = getPlannedPolePopupHtml(pole);
          const baseColor = '#2563eb'; // Blue for planned poles (consistent with NEW pole convention)
          const customStyle = new Style({
            image: new CircleStyle({
              radius: 6,
              fill: new Fill({ color: baseColor }),
              stroke: new Stroke({ color: '#ffffff', width: 1.5 })
            }),
            text: new Text({
              text: `P-${pole.index} (${pole.height}m)`,
              font: 'bold 9px system-ui, sans-serif',
              fill: new Fill({ color: '#1e3a8a' }),
              stroke: new Stroke({ color: '#ffffff', width: 2.5 }),
              offsetY: 12,
              textAlign: 'center'
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
          const html = getPlannedCablePopupHtml(cable);
          const baseColor = getCableColorByFiberCount(cable.fiberCount);
          // Style function that draws cable line + blue dot markers at each vertex
          const cableStyleFn = (feature: import('ol/Feature').FeatureLike) => {
            const styles: Style[] = [
              new Style({
                stroke: new Stroke({ color: baseColor, width: 4, lineDash: [] }),
                text: new Text({
                  text: `(${cable.cableType || 'ADSS'} - ${cable.fiberCount}F)`,
                  font: 'bold 10px system-ui, sans-serif',
                  fill: new Fill({ color: '#0f172a' }),
                  stroke: new Stroke({ color: '#ffffff', width: 3 }),
                  placement: 'line',
                  repeat: 1,
                  textAlign: 'center',
                  textBaseline: 'middle'
                })
              })
            ];
            // Add blue dot markers at each cable vertex point (showing cable routing path)
            const geometry = feature.getGeometry() as LineString;
            const coordinates = geometry.getCoordinates();
            const vertexDotColor = '#2563eb'; // Blue dots for cable vertices
            for (let i = 0; i < coordinates.length; i++) {
              styles.push(new Style({
                geometry: new Point(coordinates[i]),
                image: new CircleStyle({
                  radius: 4,
                  fill: new Fill({ color: vertexDotColor }),
                  stroke: new Stroke({ color: '#ffffff', width: 1 })
                })
              }));
            }
            // Add span distance labels at midpoint of each segment between consecutive points
            for (let i = 0; i < coordinates.length - 1; i++) {
              const p1 = coordinates[i];
              const p2 = coordinates[i + 1];
              // Midpoint in projected coordinates
              const midX = (p1[0] + p2[0]) / 2;
              const midY = (p1[1] + p2[1]) / 2;
              const midPoint = new Point([midX, midY]);
              // Calculate span distance in meters using Haversine from original lon/lat
              const lonLat1 = toLonLat(p1);
              const lonLat2 = toLonLat(p2);
              const spanDist = getDistance(lonLat1, lonLat2);
              const spanLabel = spanDist < 1000
                ? `${spanDist.toFixed(0)}m`
                : `${(spanDist / 1000).toFixed(2)}km`;
              styles.push(new Style({
                geometry: midPoint,
                text: new Text({
                  text: spanLabel,
                  font: 'bold 9px system-ui, sans-serif',
                  fill: new Fill({ color: '#ef4444' }),
                  stroke: new Stroke({ color: '#ffffff', width: 2.5 }),
                  offsetY: -2,
                  textAlign: 'center',
                  textBaseline: 'middle'
                })
              }));
            }
            return styles;
          };
          addFeature('cables', line, html, 'cables', cableStyleFn, baseColor, cable.index);
        }
      }
    }

    // Render selected Feed Point if autoPlanData is not generated yet or closure 0 is missing
    if (feedPointCoord && (!autoPlanData || !autoPlanData.closures.some(c => c.index === 0))) {
      const point = new Point(fromLonLat(feedPointCoord));
      const html = getSelectedFeedPointPopupHtml();
      const baseColor = '#10b981';
      const customStyle = new Style({
        image: new CircleStyle({
          radius: 12,
          fill: new Fill({ color: hexToRgba(baseColor, 0.8) }),
          stroke: new Stroke({ color: '#059669', width: 3 })
        }),
        text: new Text({
          text: 'FEED POINT',
          font: 'bold 10px system-ui, sans-serif',
          fill: new Fill({ color: '#064e3b' }),
          stroke: new Stroke({ color: '#ffffff', width: 2 }),
          offsetY: -18,
          textAlign: 'center'
        })
      });
      addFeature('fiberJoints', point, html, 'fiberJoints', customStyle, baseColor, 9999);
    }

    // Render custom pinned Start Device location if selecting/pinned
    if (customStartDeviceCoord) {
      const point = new Point(fromLonLat(customStartDeviceCoord));
      const html = getPinnedStartDevicePopupHtml();
      const baseColor = '#f97316';
      const customStyle = new Style({
        image: new CircleStyle({
          radius: 12,
          fill: new Fill({ color: hexToRgba(baseColor, 0.8) }),
          stroke: new Stroke({ color: '#ea580c', width: 3 })
        }),
        text: new Text({
          text: `START DEVICE (${startDeviceType})`,
          font: 'bold 9px system-ui, sans-serif',
          fill: new Fill({ color: '#7c2d12' }),
          stroke: new Stroke({ color: '#ffffff', width: 2 }),
          offsetY: -18,
          textAlign: 'center'
        })
      });
      addFeature('fiberJoints', point, html, 'fiberJoints', customStyle, baseColor, 9998);
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
        const isPoint = overallExtent[0] === overallExtent[2] && overallExtent[1] === overallExtent[3];
        if (isPoint) {
          map.getView().setCenter([overallExtent[0], overallExtent[1]]);
          map.getView().setZoom(17);
        } else {
          map.getView().fit(overallExtent, { padding: [60, 60, 60, 60], maxZoom: 17, duration: 800 });
        }
        map.updateSize();
      }, 100);
    } else {
      // No data - reset to Sri Lanka
      map.getView().setCenter(fromLonLat([80.7718, 7.8731]));
      map.getView().setZoom(8);
    }
    setTimeout(() => map.updateSize(), 100);
    setTimeout(() => map.updateSize(), 400);
  }, [mapReady, gisRoutes, assets, autoPlanData, feedPointCoord, customStartDeviceCoord, pendingPolygon, drawnPolygon]); // eslint-disable-line react-hooks/exhaustive-deps

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
          let oldLon = 0;
          let oldLat = 0;
          let foundOld = false;
          if (layerKey === 'fdps' || layerKey === 'fiberJoints') {
            const oldClosure = autoPlanData?.closures?.find(c => c.index === index);
            if (oldClosure) {
              oldLon = oldClosure.longitude;
              oldLat = oldClosure.latitude;
              foundOld = true;
            }
          } else if (isPole) {
            const oldPole = autoPlanData?.poles?.find(p => p.index === index);
            if (oldPole) {
              oldLon = oldPole.longitude;
              oldLat = oldPole.latitude;
              foundOld = true;
            }
          }

          setAutoPlanData((prev) => {
            if (!prev) return null;

            if (layerKey === 'fdps' || layerKey === 'fiberJoints') {
              updatedClosures = prev.closures.map((c) => {
                if (c.index === index) {
                  return { ...c, longitude: coords[0], latitude: coords[1] };
                }
                return c;
              });

              let updatedCables = prev.cables;
              if (foundOld) {
                updatedCables = prev.cables.map((cb) => {
                  let updated = false;
                  const newCoords = cb.coordinates.map((pt) => {
                    if (Math.hypot(pt[0] - oldLon, pt[1] - oldLat) < 0.0001) {
                      updated = true;
                      return coords;
                    }
                    return pt;
                  });
                  return updated 
                    ? { ...cb, coordinates: newCoords, length: calculatePathLength(newCoords) } 
                    : cb;
                });
              }

              return { ...prev, closures: updatedClosures, cables: updatedCables };
            } else if (isPole) {
              const updatedPoles = prev.poles.map((p) => {
                if (p.index === index) {
                  return { ...p, longitude: coords[0], latitude: coords[1] };
                }
                return p;
              });

              let updatedCables = prev.cables;
              if (foundOld) {
                updatedCables = prev.cables.map((cb) => {
                  let updated = false;
                  const newCoords = cb.coordinates.map((pt) => {
                    if (Math.hypot(pt[0] - oldLon, pt[1] - oldLat) < 0.0001) {
                      updated = true;
                      return coords;
                    }
                    return pt;
                  });
                  return updated 
                    ? { ...cb, coordinates: newCoords, length: calculatePathLength(newCoords) } 
                    : cb;
                });
              }

              return { ...prev, poles: updatedPoles, cables: updatedCables };
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
                customClosures: updatedClosures,
                splitterRatio,
                feedPoint: feedPointCoord ? { lat: feedPointCoord[1], lon: feedPointCoord[0] } : undefined
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
  }, [mapReady, autoPlanData, drawnPolygon, splitterRatio, feedPointCoord]);

  // ─── AI Auto-Plan Functions ──────────────────────────────────────────
  const clearAutoPlan = useCallback(() => {
    setAutoPlanSummary(null);
    setAutoPlanData(null);
    setFeedPointCoord(null);
    setFeedPointSelectActive(false);
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

    draw.on('drawend', (evt) => {
      const feature = evt.feature;
      const geometry = feature.getGeometry();
      if (geometry && geometry instanceof Polygon) {
        const coords = geometry.getCoordinates()[0].map((coord) => {
          return toLonLat(coord) as [number, number];
        });

        setPendingPolygon(coords);
        setStartDeviceType('OLT');
        setSelectedExistingDevice(null);
        setCustomStartDeviceCoord(feedPointCoord);
        setIsCreateNewDevice(true);
        map.removeInteraction(draw);
        autoPlanDrawRef.current = null;
        setAutoPlanActive(false);
      }
    });
  }, [feedPointCoord]);

  const triggerAutoPlan = async (coords: [number, number][], selectedFP: [number, number] | null) => {
    setDrawnPolygon(coords);
    setAutoPlanLoading(true);
    setPendingPolygon(null);
    try {
      const res = await fetch('/api/gis/auto-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          polygon: coords, 
          splitterRatio,
          feedPoint: selectedFP ? { lat: selectedFP[1], lon: selectedFP[0] } : undefined,
          startDeviceType
        }),
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
  };

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

  const runAiLayoutAudit = async () => {
    if (!autoPlanData || !drawnPolygon) return;

    try {
      setAiAuditLoading(true);
      setAiAuditWarnings(null);
      setAiSuggestions(null);

      const res = await fetch('/api/gis/auto-plan/ai-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          polygon: drawnPolygon,
          customClosures: autoPlanData.closures,
          osmData: autoPlanData.osmData,
          poles: autoPlanData.poles,
          cables: autoPlanData.cables
        })
      });

      if (!res.ok) {
        throw new Error('AI optimization audit failed.');
      }

      const result = await res.json();
      setAiAuditWarnings(result.warnings || []);
      setAiSuggestions(result.suggestions || []);
    } catch (err) {
      console.error(err);
      setAiAuditWarnings(['Failed to run AI Audit. Please verify your connection or draw a larger polygon.']);
    } finally {
      setAiAuditLoading(false);
    }
  };

  const applyAiCorrections = async () => {
    if (!aiSuggestions || aiSuggestions.length === 0 || !autoPlanData || !drawnPolygon) return;

    // Apply snapped coordinates
    const updatedClosures = autoPlanData.closures.map(c => {
      const correction = aiSuggestions.find(s => s.index === c.index);
      if (correction) {
        return {
          ...c,
          latitude: correction.latitude,
          longitude: correction.longitude,
          notes: `${c.notes ? c.notes + ' ' : ''}[AI Snapped: ${correction.reason}]`
        };
      }
      return c;
    });

    try {
      setAiAuditLoading(true);

      const res = await fetch('/api/gis/auto-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          polygon: drawnPolygon,
          customClosures: updatedClosures,
          splitterRatio,
          feedPoint: feedPointCoord ? { lat: feedPointCoord[1], lon: feedPointCoord[0] } : undefined
        })
      });

      if (!res.ok) throw new Error('Failed to apply suggestions.');
      
      const newPlan = await res.json();
      setAutoPlanData(newPlan);
      setAutoPlanSummary(newPlan.summary);
      
      setAiAuditWarnings(null);
      setAiSuggestions(null);
    } catch (err) {
      console.error(err);
      alert('Failed to re-plan with AI optimized coordinates.');
    } finally {
      setAiAuditLoading(false);
    }
  };

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
          polygon: drawnPolygon,
          osmData: autoPlanData.osmData,
          metadata: { startDeviceType }
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

  const handleSaveCableGeometry = async () => {
    if (!selectedCableFeature || !editingCableId) return;
    
    const geom = selectedCableFeature.getGeometry();
    if (!(geom instanceof LineString)) return;

    const coords = geom.getCoordinates().map((c) => {
      const lonLat = toLonLat(c);
      return [lonLat[0], lonLat[1]] as [number, number];
    });

    setSavingCableGeometry(true);
    try {
      const res = await fetch('/api/gis/cable-segment', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          segmentId: editingCableId,
          coordinates: coords,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save cable geometry.');
      }

      alert('Cable path geometry updated successfully!');
      setSelectedCableFeature(null);
      setEditingCableId(null);
      if (onRouteSaved) {
        onRouteSaved();
      }
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Error updating cable geometry';
      alert(msg);
    } finally {
      setSavingCableGeometry(false);
    }
  };

  const handleCancelCableEdit = () => {
    if (selectedCableFeature && originalCoordsRef.current.length > 0) {
      const geom = selectedCableFeature.getGeometry();
      if (geom instanceof LineString) {
        geom.setCoordinates(originalCoordsRef.current);
      }
    }
    setSelectedCableFeature(null);
    setEditingCableId(null);
  };



  const nearbyDevices = useMemo(() => {
    if (!pendingPolygon) return [];
    const found: { id: string; name: string; type: string; lat: number; lon: number }[] = [];

    // Scan existing routes
    for (const route of gisRoutes) {
      if (route.closures) {
        for (const c of route.closures) {
          const lat = Number(c.latitude);
          const lon = Number(c.longitude);
          if (isPointInPolygon([lon, lat], pendingPolygon)) {
            const isTerminal = c.closureType === 'TERMINAL';
            found.push({
              id: c.id,
              name: `${isTerminal ? 'DP' : 'JB'}-${c.closureNumber} (${route.name})`,
              type: isTerminal ? 'CLOSURE' : 'JOINT',
              lat,
              lon
            });
          }
        }
      }
      if (route.poles) {
        for (const p of route.poles) {
          const lat = Number(p.latitude);
          const lon = Number(p.longitude);
          if (isPointInPolygon([lon, lat], pendingPolygon)) {
            found.push({
              id: p.id,
              name: `Pole-${p.poleNumber} (${route.name})`,
              type: 'POLE',
              lat,
              lon
            });
          }
        }
      }
    }

    if (assets) {
      for (const asset of assets) {
        const lat = Number(asset.latitude ?? asset.lat ?? 0);
        const lon = Number(asset.longitude ?? asset.lon ?? asset.lng ?? 0);
        if (lat && lon && isPointInPolygon([lon, lat], pendingPolygon)) {
          found.push({
            id: asset.id,
            name: `${asset.assetName || asset.assetCode || 'Asset'} (${asset.assetType || 'ASSET'})`,
            type: String(asset.assetType || 'ASSET').toUpperCase(),
            lat,
            lon
          });
        }
      }
    }

    return found;
  }, [pendingPolygon, gisRoutes, assets]);

  const filteredDevices = useMemo(() => {
    if (startDeviceType === 'CLOSURE') {
      return nearbyDevices.filter(d => d.type === 'CLOSURE');
    }
    if (startDeviceType === 'JOINT') {
      return nearbyDevices.filter(d => d.type === 'JOINT');
    }
    if (startDeviceType === 'POLE') {
      return nearbyDevices.filter(d => d.type === 'POLE');
    }
    return [];
  }, [nearbyDevices, startDeviceType]);

  return (
    <div className="relative" style={{ width, height }}>
      {/* ─── Map Type Switcher Floating Control ──────────────────────────────── */}
      <div className="absolute top-4 left-16 z-[1000] bg-slate-900/90 text-white px-2 py-2 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-indigo-500/30 backdrop-blur-xl flex gap-1 items-center">
        <button
          type="button"
          onClick={() => setMapType('osm')}
          className={`px-3 py-1.5 text-[10px] font-bold rounded-xl active:scale-95 transition-all ${
            mapType === 'osm' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          OSM
        </button>
        <button
          type="button"
          onClick={() => setMapType('google_satellite')}
          className={`px-3 py-1.5 text-[10px] font-bold rounded-xl active:scale-95 transition-all ${
            mapType === 'google_satellite' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          Satellite
        </button>
        <button
          type="button"
          onClick={() => setMapType('google_hybrid')}
          className={`px-3 py-1.5 text-[10px] font-bold rounded-xl active:scale-95 transition-all ${
            mapType === 'google_hybrid' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          Hybrid
        </button>
      </div>
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg z-10">
          <div className="text-center space-y-3">
            <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-gray-500">Loading map...</p>
          </div>
        </div>
      )}
      {mapReady && gisRoutes.length === 0 && !assets?.length && !preSurveyMode && !autoPlanData && (
        <div className="absolute top-4 left-4 z-[1000] bg-slate-900/80 text-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-indigo-500/30 p-4 max-w-[280px] backdrop-blur-xl transition-all duration-500 pointer-events-none animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs tracking-wide uppercase">
            <span>🗺️ No GIS Data Active</span>
          </div>
          <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">
            No routes or assets loaded yet. Use the <b className="text-white">🤖 AI Auto-Planner</b> panel to draw a planning area and generate layout.
          </p>
        </div>
      )}

      {/* ─── Pre-Survey AI Panel ─────────────────────────────────────────── */}
      {preSurveyMode && (
        <div className="absolute top-4 left-4 z-[1000] bg-slate-900/80 text-white rounded-2xl shadow-[0_8px_32px_rgba(79,70,229,0.2)] border border-indigo-500/50 p-4 max-w-[340px] backdrop-blur-xl transition-all duration-500 animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
            </span>
            <span>🤖 AI Pre-Survey Mode Active</span>
          </div>
          <p className="text-xs text-slate-200 mt-2.5 leading-relaxed bg-slate-800/50 rounded-lg p-2 border border-slate-700/50">
            {!preSurveyStart ? (
              "👉 Click anywhere on the map to set the starting location (Point A)."
            ) : !preSurveyEnd ? (
              "👉 Now click another point to set the ending location (Point B)."
            ) : (
              "✅ Points A and B selected! Click 'Start AI Draft' on the sidebar."
            )}
          </p>
          {preSurveyStart && (
            <div className="mt-3 text-[11px] text-slate-400 space-y-1.5 border-t border-slate-700/50 pt-3">
              <div className="flex justify-between items-center bg-slate-800/30 p-1.5 rounded">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Start Point A:</span>
                <span className="font-mono text-blue-300 font-medium">{preSurveyStart[1].toFixed(5)}, {preSurveyStart[0].toFixed(5)}</span>
              </div>
              {preSurveyEnd && (
                <div className="flex justify-between items-center bg-slate-800/30 p-1.5 rounded">
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> End Point B:</span>
                  <span className="font-mono text-purple-300 font-medium">{preSurveyEnd[1].toFixed(5)}, {preSurveyEnd[0].toFixed(5)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Cable Edit Mode active banner ─────────────────────────────────── */}
      {selectedCableFeature && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1001] bg-slate-900/90 text-white px-5 py-3 rounded-2xl shadow-xl border border-indigo-500/50 flex items-center gap-4 backdrop-blur-xl animate-in fade-in slide-in-from-top-4">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
              ✏️ Cable Edit Mode Active
            </span>
            <span className="text-[10px] text-slate-300 mt-0.5">
              Drag points to modify path. Alt+Click point to delete. Drag line to add point.
            </span>
          </div>
          <div className="flex items-center gap-2 border-l border-slate-700 pl-4">
            <button
              onClick={handleSaveCableGeometry}
              disabled={savingCableGeometry}
              className="px-3 py-1.5 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
            >
              {savingCableGeometry ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancelCableEdit}
              disabled={savingCableGeometry}
              className="px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg active:scale-95 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ─── Floating Controls Panel ──────────────────────────────────────── */}
      <GISSidebarPanel
        mapReady={mapReady}
        toolMode={toolMode}
        setToolMode={setToolMode}
        measureActive={measureActive}
        toggleMeasure={toggleMeasure}
        clearMeasure={clearMeasure}
        totalDistance={totalDistance}
        lastSegmentDistance={lastSegmentDistance}
        autoPlanData={autoPlanData}
        autoPlanLoading={autoPlanLoading}
        feedPointSelectActive={feedPointSelectActive}
        setFeedPointSelectActive={setFeedPointSelectActive}
        feedPointCoord={feedPointCoord}
        setFeedPointCoord={setFeedPointCoord}
        splitterRatio={splitterRatio}
        setSplitterRatio={setSplitterRatio}
        toggleAutoPlan={toggleAutoPlan}
        autoPlanActive={autoPlanActive}
        clearAutoPlan={clearAutoPlan}
        autoPlanSummary={autoPlanSummary}
        runAiLayoutAudit={runAiLayoutAudit}
        aiAuditLoading={aiAuditLoading}
        aiAuditWarnings={aiAuditWarnings}
        aiSuggestions={aiSuggestions}
        applyAiCorrections={applyAiCorrections}
        routeName={routeName}
        setRouteName={setRouteName}
        savingPlan={savingPlan}
        handleSavePlan={handleSavePlan}
        mapRef={mapRef}
        autoPlanDrawRef={autoPlanDrawRef}
        setAutoPlanActive={setAutoPlanActive}
        complianceReport={complianceReport}
        ospReasoning={ospReasoning}
      />
      {/* Map Legend Overlay */}
      <GISMapLegend />

      {/* Map container - must have explicit height for tiles to render */}
      <div
        ref={mapContainerRef}
        className="rounded-lg border border-gray-200 overflow-hidden"
        style={{ width: '100%', height, minHeight: '300px', display: 'block', position: 'relative' }}
      />

      {/* Pinning Start Device Location floating instructions */}
      {pinningStartDevice && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2500] bg-slate-900/90 text-white px-5 py-3 rounded-2xl shadow-xl border border-orange-500/50 flex items-center gap-4 backdrop-blur-xl animate-in fade-in slide-in-from-top-4">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
              📍 Select Start Location
            </span>
            <span className="text-[10px] text-slate-300 mt-0.5">
              Click anywhere on the map to pin the custom start position for this {startDeviceType}.
            </span>
          </div>
          <div className="flex items-center gap-2 border-l border-slate-700/50 pl-4">
            <button
              type="button"
              onClick={() => setPinningStartDevice(false)}
              className="px-3 py-1.5 text-[11px] font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg active:scale-95 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Feeder Origin / Selection Modal */}
      <GISAutoPlanModal
        pendingPolygon={pendingPolygon}
        startDeviceType={startDeviceType}
        setStartDeviceType={setStartDeviceType}
        selectedExistingDevice={selectedExistingDevice}
        setSelectedExistingDevice={setSelectedExistingDevice}
        isCreateNewDevice={isCreateNewDevice}
        setIsCreateNewDevice={setIsCreateNewDevice}
        nearbyDevices={nearbyDevices}
        filteredDevices={filteredDevices}
        customStartDeviceCoord={customStartDeviceCoord}
        setCustomStartDeviceCoord={setCustomStartDeviceCoord}
        setPinningStartDevice={setPinningStartDevice}
        setPendingPolygon={setPendingPolygon}
        triggerAutoPlan={triggerAutoPlan}
      />
    </div>
  );
}