'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, CheckCircle2, AlertTriangle, XCircle, Flag, MapPin, Eye, Pencil, Save, X, ZoomIn } from 'lucide-react';

// Setup default marker icons fix
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// @ts-expect-error - overriding default leaflet icon lookup logic
delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

type VerificationStatus =
  | 'PENDING_VERIFICATION' | 'VERIFIED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'FLAGGED';

interface SurveyPoint {
  id: string;
  layerId: string;
  layerName: string;
  latitude: number;
  longitude: number;
  verificationStatus: VerificationStatus;
  verificationStep: string;
  attributes: Record<string, unknown>;
  photoUrls: string[];
  verifiedById?: string;
  verifiedAt?: string;
  approvedById?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

const SURVEY_LAYERS = [
  { id: 'survey_new_pole',       name: 'New Poles',          icon: '🪵', color: '#3b82f6' },
  { id: 'survey_existing_pole',  name: 'Existing Poles',     icon: '📍', color: '#8b5cf6' },
  { id: 'survey_joint_closure',  name: 'Joint Closures',     icon: '🔗', color: '#f59e0b' },
  { id: 'survey_enclosure',      name: 'Enclosures (ODF)',   icon: '📦', color: '#10b981' },
  { id: 'survey_fdp',            name: 'FDPs',               icon: '🔲', color: '#06b6d4' },
  { id: 'survey_chamber',        name: 'Chambers',           icon: '⬛', color: '#6366f1' },
  { id: 'survey_road_crossing',  name: 'Road Crossings',     icon: '🛣️',  color: '#ef4444' },
  { id: 'survey_obstruction',    name: 'Obstructions',       icon: '⚠️',  color: '#f97316' },
  { id: 'survey_cable_start',    name: 'Cable A-Ends',       icon: '🔴', color: '#dc2626' },
  { id: 'survey_cable_end',      name: 'Cable B-Ends',       icon: '🟢', color: '#16a34a' },
  { id: 'survey_access_point',   name: 'Access Points',      icon: '🏠', color: '#0ea5e9' },
  { id: 'survey_note',           name: 'Field Notes',        icon: '📝', color: '#64748b' },
];

const LAYER_MAP = new Map(SURVEY_LAYERS.map(l => [l.id, l]));

const STATUS_CONFIG: Record<VerificationStatus, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  PENDING_VERIFICATION: {
    label: 'Pending',
    bg: 'bg-amber-500/10 border-amber-500/20',
    text: 'text-amber-600',
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  VERIFIED: {
    label: 'Verified',
    bg: 'bg-blue-500/10 border-blue-500/20',
    text: 'text-blue-600',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  PENDING_APPROVAL: {
    label: 'Pending Approval',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    text: 'text-yellow-600',
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  APPROVED: {
    label: 'Approved',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    text: 'text-emerald-600',
    icon: <Check className="h-3 w-3" />,
  },
  REJECTED: {
    label: 'Rejected',
    bg: 'bg-red-500/10 border-red-500/20',
    text: 'text-red-600',
    icon: <XCircle className="h-3 w-3" />,
  },
  FLAGGED: {
    label: 'Flagged',
    bg: 'bg-orange-500/10 border-orange-500/20',
    text: 'text-orange-600',
    icon: <Flag className="h-3 w-3" />,
  },
};

// ─── Map Controller for Pan and Zoom ──────────────────────────────────────────
function MapController({
  points,
  selectedPoint,
  lastSelectedPointIdRef,
}: {
  points: SurveyPoint[];
  selectedPoint: SurveyPoint | null;
  lastSelectedPointIdRef: React.MutableRefObject<string | null>;
}) {
  const map = useMap();

  // Focus and zoom when a point is selected
  useEffect(() => {
    if (selectedPoint && selectedPoint.id !== lastSelectedPointIdRef.current) {
      lastSelectedPointIdRef.current = selectedPoint.id;
      map.setView([selectedPoint.latitude, selectedPoint.longitude], 21, {
        animate: true,
        duration: 0.8,
      });
    }
  }, [selectedPoint, map, lastSelectedPointIdRef]);

  // Fit bounds when all points load initially
  useEffect(() => {
    if (points.length > 0 && !selectedPoint) {
      const bounds = points.map((p) => [p.latitude, p.longitude] as [number, number]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [points, selectedPoint, map]);

  return null;
}

interface MapProps {
  points: SurveyPoint[];
  selectedPoint: SurveyPoint | null;
  onPointSelect: (point: SurveyPoint) => void;
  onAction?: (pointId: string, action: string) => void;
  onUpdateCoordinates?: (pointId: string, latitude: number, longitude: number) => Promise<void>;
  /** Enable pre-approval map confirmation mode */
  confirmMode?: boolean;
  /** The point currently being confirmed */
  confirmingPointId?: string | null;
  /** Called when user clicks "Confirm on Map" for a VERIFIED point */
  onConfirmPoint?: (pointId: string) => void;
  /** Called when user clicks "Cancel Confirmation" */
  onCancelConfirm?: () => void;
  /** Whether a confirm action is in progress */
  isConfirming?: boolean;
}

export default function SurveyApprovalMap({
  points,
  selectedPoint,
  onPointSelect,
  onAction,
  onUpdateCoordinates,
  confirmMode = false,
  confirmingPointId = null,
  onConfirmPoint,
  onCancelConfirm,
  isConfirming = false,
}: MapProps) {
  const [mapStyle, setMapStyle] = useState<'streets' | 'light' | 'satellite'>('light');
  const lastSelectedPointIdRef = useRef<string | null>(null);

  // ─── Drag-and-Drop Editing States ─────────────────────────────────────
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [tempPosition, setTempPosition] = useState<[number, number] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const originalPositionRef = useRef<[number, number] | null>(null);

  // Enter edit mode for a specific point
  const enterEditMode = useCallback((point: SurveyPoint) => {
    setEditingPointId(point.id);
    setTempPosition([point.latitude, point.longitude]);
    originalPositionRef.current = [point.latitude, point.longitude];
  }, []);

  // Exit edit mode (cancel)
  const cancelEditMode = useCallback(() => {
    setEditingPointId(null);
    setTempPosition(null);
    originalPositionRef.current = null;
  }, []);

  // Save coordinates
  const handleSaveLocation = useCallback(async () => {
    if (!editingPointId || !tempPosition || !onUpdateCoordinates) return;
    setIsSaving(true);
    try {
      await onUpdateCoordinates(editingPointId, tempPosition[0], tempPosition[1]);
      setEditingPointId(null);
      setTempPosition(null);
      originalPositionRef.current = null;
    } catch {
      // error handled by parent
    } finally {
      setIsSaving(false);
    }
  }, [editingPointId, tempPosition, onUpdateCoordinates]);

  const tileUrls = {
    streets: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  };

  const center: [number, number] =
    selectedPoint
      ? [selectedPoint.latitude, selectedPoint.longitude]
      : points.length > 0
      ? [
          points.reduce((s, p) => s + p.latitude, 0) / points.length,
          points.reduce((s, p) => s + p.longitude, 0) / points.length,
        ]
      : [7.8731, 80.7718]; // Sri Lanka Center

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden shadow-inner border border-slate-200 bg-slate-100">
      {/* Dynamic Base Map Style Control */}
      <div className="absolute top-3 right-3 z-[1000] flex bg-white/90 backdrop-blur border border-slate-200/80 shadow-md rounded-lg p-0.5 overflow-hidden transition-all hover:bg-white">
        {(['light', 'streets', 'satellite'] as const).map((style) => (
          <button
            key={style}
            onClick={() => setMapStyle(style)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all uppercase tracking-wider ${
              mapStyle === style
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {style}
          </button>
        ))}
      </div>

      {/* ─── Pre-Approval Confirmation Banner ──────────────────────────────── */}
      {confirmMode && confirmingPointId && (() => {
        const point = points.find(p => p.id === confirmingPointId);
        if (!point) return null;
        const layerDef = LAYER_MAP.get(point.layerId);
        return (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1100] bg-white/95 backdrop-blur-xl border-2 border-yellow-400/60 shadow-2xl rounded-2xl px-5 py-4 max-w-[380px] w-full animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-100 border border-yellow-200 flex items-center justify-center flex-shrink-0">
                <ZoomIn className="h-5 w-5 text-yellow-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-800 leading-tight">
                  Confirm Point on Map
                </p>
                <p className="text-[10px] text-slate-500 font-medium truncate">
                  Visually verify the location before approving
                </p>
              </div>
            </div>

            {/* Point info */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-base">{layerDef?.icon}</span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-700 truncate">
                    {layerDef?.name ?? point.layerName}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    #{point.id.substring(0, 8)}
                  </p>
                </div>
                <Badge className="ml-auto flex items-center gap-1 px-1.5 py-0.5 border text-[10px] font-semibold bg-blue-500/10 text-blue-600 border-blue-500/20 flex-shrink-0">
                  <CheckCircle2 className="h-3 w-3" />
                  VERIFIED
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                <span className="font-mono font-semibold text-slate-700">
                  {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-9 text-xs flex-1 text-slate-600 hover:bg-slate-50 border-slate-200 font-semibold"
                onClick={onCancelConfirm}
                disabled={isConfirming}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-9 text-xs flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold shadow-lg shadow-yellow-500/20"
                onClick={() => onConfirmPoint?.(point.id)}
                disabled={isConfirming}
              >
                {isConfirming ? (
                  <>Confirming...</>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Confirm & Approve
                  </>
                )}
              </Button>
            </div>

            <p className="text-[9px] text-slate-400 mt-2 text-center font-medium">
              Drag the map to inspect the point location. You can also edit coordinates before confirming.
            </p>
          </div>
        );
      })()}

      <MapContainer
        center={center}
        zoom={selectedPoint ? 18 : 13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        maxZoom={22}
        className="z-0"
      >
        <TileLayer
          attribution={
            mapStyle === 'satellite'
              ? 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          }
          url={tileUrls[mapStyle]}
          maxNativeZoom={mapStyle === 'satellite' ? 18 : 19}
        />

        <MapController
          points={points}
          selectedPoint={selectedPoint}
          lastSelectedPointIdRef={lastSelectedPointIdRef}
        />

        {/* ─── Editing Marker (when in edit mode, render a separate draggable marker) ─── */}
        {editingPointId && tempPosition && (() => {
          const editingPoint = points.find(p => p.id === editingPointId);
          if (!editingPoint) return null;
          const layerDef = LAYER_MAP.get(editingPoint.layerId);
          const color = layerDef?.color ?? '#6366f1';
          const iconSymbol = layerDef?.icon ?? '📍';

          const editIcon = L.divIcon({
            className: 'custom-leaflet-marker editing',
            html: `
              <div class="relative flex items-center justify-center" style="width: 40px; height: 40px;">
                <div class="absolute w-10 h-10 rounded-full bg-[${color}] opacity-25 animate-pulse" style="background-color: ${color};"></div>
                <div class="w-9 h-9 rounded-full flex items-center justify-center border-[3px] shadow-lg"
                  style="
                    background-color: ${color};
                    border-color: #ffffff;
                    transform: scale(1.25);
                    box-shadow: 0 4px 16px rgba(0,0,0,0.35);
                  ">
                  <span class="text-base leading-none select-none">${iconSymbol}</span>
                </div>
                <div class="absolute -bottom-1 w-3 h-3 rounded-full border-2 border-white shadow-md"
                  style="background-color: ${color}; left: 50%; transform: translateX(-50%);">
                </div>
              </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, -40],
          });

          return (
            <Marker
              key={`edit-${editingPointId}`}
              position={tempPosition}
              icon={editIcon}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  const marker = e.target;
                  const pos = marker.getLatLng();
                  setTempPosition([pos.lat, pos.lng]);
                },
              }}
            >
              <Popup className="premium-leaflet-popup">
                <div className="w-[280px] p-0.5 font-sans">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{iconSymbol}</span>
                      <span className="font-bold text-sm text-slate-800">
                        {layerDef?.name || editingPoint.layerName}
                      </span>
                    </div>
                    <Badge className="flex items-center gap-1 px-1.5 py-0.5 border text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 border-indigo-500/20">
                      <Pencil className="h-3 w-3" />
                      Editing
                    </Badge>
                  </div>

                  <div className="text-xs text-slate-500 flex items-center gap-1 mb-2.5">
                    <MapPin className="h-3 w-3 text-indigo-400" />
                    <span className="font-mono font-semibold text-indigo-600">
                      {tempPosition[0].toFixed(6)}, {tempPosition[1].toFixed(6)}
                    </span>
                  </div>

                  {originalPositionRef.current && (
                    <div className="text-[10px] text-slate-400 mb-3 flex items-center gap-1">
                      <span>Original: {originalPositionRef.current[0].toFixed(6)}, {originalPositionRef.current[1].toFixed(6)}</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                    <Button
                      size="sm"
                      className="h-8 text-xs flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                      onClick={handleSaveLocation}
                      disabled={isSaving}
                    >
                      <Save className="h-3.5 w-3.5 mr-1" />
                      {isSaving ? 'Saving...' : 'Save Location'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs flex-1 text-slate-600 hover:bg-slate-50 border-slate-200"
                      onClick={cancelEditMode}
                      disabled={isSaving}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })()}

        {/* ─── Confirming Marker (animated glow ring for point being confirmed) ─── */}
        {confirmingPointId && (() => {
          const confirmingPoint = points.find(p => p.id === confirmingPointId);
          if (!confirmingPoint) return null;
          const layerDef = LAYER_MAP.get(confirmingPoint.layerId);
          const color = layerDef?.color ?? '#eab308';
          const iconSymbol = layerDef?.icon ?? '📍';

          const confirmIcon = L.divIcon({
            className: 'custom-leaflet-marker confirming',
            html: `
              <div class="relative flex items-center justify-center" style="width: 44px; height: 44px;">
                <div class="absolute w-11 h-11 rounded-full animate-ping opacity-30" style="background-color: #eab308;"></div>
                <div class="absolute w-11 h-11 rounded-full animate-pulse opacity-40" style="background-color: #eab308;"></div>
                <div class="w-9 h-9 rounded-full flex items-center justify-center border-[3px] shadow-xl"
                  style="
                    background-color: ${color};
                    border-color: #fef08a;
                    transform: scale(1.3);
                    box-shadow: 0 0 24px rgba(234,179,8,0.5), 0 4px 12px rgba(0,0,0,0.3);
                  ">
                  <span class="text-lg leading-none select-none">${iconSymbol}</span>
                </div>
                <div class="absolute w-2.5 h-2.5 rounded-full border-2 border-white shadow-md"
                  style="
                    background-color: ${color};
                    bottom: -2px;
                    left: 50%;
                    transform: translateX(-50%);
                  ">
                </div>
              </div>
            `,
            iconSize: [44, 44],
            iconAnchor: [22, 44],
            popupAnchor: [0, -44],
          });

          // Skip the default marker for the confirming point
          return (
            <Marker
              key={`confirm-${confirmingPointId}`}
              position={[confirmingPoint.latitude, confirmingPoint.longitude]}
              icon={confirmIcon}
              eventHandlers={{
                click: () => onPointSelect(confirmingPoint),
              }}
            />
          );
        })()}

        {points.map((point) => {
          // Skip rendering the original marker for the point being edited or confirmed
          if (editingPointId === point.id) return null;
          if (confirmingPointId === point.id) return null;

          const layerDef = LAYER_MAP.get(point.layerId);
          const color = layerDef?.color ?? '#6366f1';
          const iconSymbol = layerDef?.icon ?? '📍';
          const isSelected = selectedPoint?.id === point.id;

          // Custom colored Pin DivIcon with smooth transition and scale animation
          const markerIcon = L.divIcon({
            className: 'custom-leaflet-marker',
            html: `
              <div class="relative flex items-center justify-center" style="width: 32px; height: 32px;">
                ${
                  isSelected
                    ? `<div class="absolute w-8 h-8 rounded-full bg-[${color}] opacity-30 animate-ping" style="background-color: ${color};"></div>`
                    : ''
                }
                <div class="w-7 h-7 rounded-full flex items-center justify-center border-2 shadow-md transition-all duration-300"
                  style="
                    background-color: ${color};
                    border-color: ${isSelected ? '#ffffff' : '#ffffffbb'};
                    transform: ${isSelected ? 'scale(1.2)' : 'scale(1)'};
                    box-shadow: 0 4px 10px rgba(0,0,0,0.25);
                  ">
                  <span class="text-sm leading-none select-none">${iconSymbol}</span>
                </div>
                <div class="absolute w-2 h-2 rounded-full border border-slate-300/80 shadow-sm"
                  style="
                    background-color: ${color};
                    bottom: -3px;
                    left: 50%;
                    transform: translateX(-50%);
                  ">
                </div>
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32],
          });

          const statusConfig = STATUS_CONFIG[point.verificationStatus] || STATUS_CONFIG.PENDING_VERIFICATION;

          return (
            <Marker
              key={point.id}
              position={[point.latitude, point.longitude]}
              icon={markerIcon}
              eventHandlers={{
                click: () => onPointSelect(point),
              }}
            >
              <Popup className="premium-leaflet-popup">
                <div className="w-[280px] p-0.5 font-sans">
                  {/* Popup Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{iconSymbol}</span>
                      <span className="font-bold text-sm text-slate-800">
                        {layerDef?.name || point.layerName}
                      </span>
                    </div>
                    <Badge className={`flex items-center gap-1 px-1.5 py-0.5 border text-[10px] font-semibold ${statusConfig.bg} ${statusConfig.text}`}>
                      {statusConfig.icon}
                      {statusConfig.label}
                    </Badge>
                  </div>

                  {/* Lat/Long Info */}
                  <div className="text-xs text-slate-500 flex items-center gap-1 mb-2.5">
                    <MapPin className="h-3 w-3 text-slate-400" />
                    <span>{point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}</span>
                    {onUpdateCoordinates && (
                      <button
                        className="ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded text-[10px] font-semibold transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          enterEditMode(point);
                        }}
                        title="Edit Location"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit Location
                      </button>
                    )}
                  </div>

                  {/* Attributes Summary */}
                  {Object.keys(point.attributes).length > 0 && (
                    <div className="mb-2.5">
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Key Attributes</div>
                      <div className="bg-slate-50/60 rounded-md border border-slate-100 p-1.5 space-y-1 max-h-[100px] overflow-y-auto">
                        {Object.entries(point.attributes).slice(0, 4).map(([key, val]) => (
                          <div key={key} className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-500 truncate max-w-[100px]">{key.replace(/_/g, ' ')}</span>
                            <span className="font-semibold text-slate-700 truncate max-w-[120px]">{String(val)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Photo Thumbnail */}
                  {point.photoUrls.length > 0 && (
                    <div className="relative mb-2.5 rounded-md overflow-hidden border border-slate-100 h-16 bg-slate-50 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={point.photoUrls[0]}
                        alt="Survey Thumbnail"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-sm text-white text-[9px] px-1 py-0.5 rounded font-mono flex items-center gap-0.5">
                        <Eye className="w-2.5 h-2.5" />
                        {point.photoUrls.length}
                      </span>
                    </div>
                  )}

                  {/* Inline Rejection Reason */}
                  {point.rejectionReason && (
                    <div className="mb-3 px-2 py-1.5 bg-red-50/50 border border-red-100 rounded text-[10px] text-red-700 leading-normal">
                      <span className="font-bold">Reason:</span> {point.rejectionReason}
                    </div>
                  )}

                  {/* Footer Quick Actions */}
                  <div className="flex gap-1.5 pt-2 border-t border-slate-100">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs flex-1 text-slate-700 hover:bg-slate-50 border-slate-200"
                      onClick={() => onPointSelect(point)}
                    >
                      Details
                    </Button>
                    {onAction && point.verificationStatus === 'PENDING_VERIFICATION' && (
                      <Button
                        size="sm"
                        className="h-7 text-xs flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                        onClick={() => onAction(point.id, 'verify')}
                      >
                        Verify
                      </Button>
                    )}
                    {/* VERIFIED → Confirm on Map (pre-approval visual gate) */}
                    {onAction && point.verificationStatus === 'VERIFIED' && (
                      <Button
                        size="sm"
                        className="h-7 text-xs flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold"
                        onClick={() => onAction(point.id, 'confirm')}
                      >
                        <ZoomIn className="h-3 w-3 mr-1" />
                        Confirm on Map
                      </Button>
                    )}
                    {/* PENDING_APPROVAL → Approve (only after map confirmation) */}
                    {onAction && point.verificationStatus === 'PENDING_APPROVAL' && (
                      <Button
                        size="sm"
                        className="h-7 text-xs flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                        onClick={() => onAction(point.id, 'approve')}
                      >
                        Approve
                      </Button>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Empty State Overlay */}
      {points.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50/90 backdrop-blur-sm z-[999] pointer-events-none">
          <div className="text-center p-6 space-y-2">
            <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <MapPin className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No spatial markers</p>
            <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed mx-auto">
              Please sync QField survey data or verify that the active layer contains points.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}