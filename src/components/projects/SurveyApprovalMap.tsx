'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, CheckCircle2, AlertTriangle, XCircle, Flag, MapPin, Eye } from 'lucide-react';

// Setup default marker icons fix
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// @ts-expect-error - overriding default leaflet icon lookup logic
delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

type VerificationStatus =
  | 'PENDING_VERIFICATION' | 'VERIFIED' | 'APPROVED' | 'REJECTED' | 'FLAGGED';

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
      map.setView([selectedPoint.latitude, selectedPoint.longitude], 19, {
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
}

export default function SurveyApprovalMap({
  points,
  selectedPoint,
  onPointSelect,
  onAction,
}: MapProps) {
  const [mapStyle, setMapStyle] = useState<'streets' | 'light' | 'satellite'>('light');
  const lastSelectedPointIdRef = useRef<string | null>(null);

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

      <MapContainer
        center={center}
        zoom={selectedPoint ? 18 : 13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        className="z-0"
      >
        <TileLayer
          attribution={
            mapStyle === 'satellite'
              ? 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          }
          url={tileUrls[mapStyle]}
        />

        <MapController
          points={points}
          selectedPoint={selectedPoint}
          lastSelectedPointIdRef={lastSelectedPointIdRef}
        />

        {points.map((point) => {
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
                    {onAction && point.verificationStatus === 'VERIFIED' && (
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
