"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Edit3, MapPin, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

// ─── Fix default marker icon issue with Leaflet + webpack ────────────────
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

// ─── Custom colored marker icons per layer ───────────────────────────────

const LAYER_COLORS: Record<string, string> = {
  survey_new_pole: "#dc2626",
  survey_existing_pole: "#ea580c",
  survey_joint_closure: "#7c3aed",
  survey_enclosure: "#2563eb",
  survey_fdp: "#059669",
  survey_chamber: "#0891b2",
  survey_cable_start: "#ca8a04",
  survey_cable_end: "#d97706",
  survey_road_crossing: "#dc2626",
  survey_obstruction: "#6b7280",
};

const LAYER_LABELS: Record<string, string> = {
  survey_new_pole: "New Pole",
  survey_existing_pole: "Existing Pole",
  survey_joint_closure: "Joint Closure",
  survey_enclosure: "ODF/Enclosure",
  survey_fdp: "FDP",
  survey_chamber: "Chamber",
  survey_cable_start: "Cable Start",
  survey_cable_end: "Cable End",
  survey_road_crossing: "Road Crossing",
  survey_obstruction: "Obstruction",
};

interface SurveyPoint {
  id: string;
  layerId: string;
  layerName: string;
  latitude: number;
  longitude: number;
  verificationStatus: string;
  attributes: Record<string, unknown>;
}

// ─── Draggable Marker Wrapper ─────────────────────────────────────────

function DraggableMarker({
  point,
  editable,
  onPointMoved,
}: {
  point: SurveyPoint;
  editable: boolean;
  onPointMoved: (pointId: string, lat: number, lng: number) => void;
}) {
  const markerRef = useRef<L.Marker>(null);
  const color = LAYER_COLORS[point.layerId] || "#6366f1";

  // Create custom icon with layer color
  const customIcon = L.divIcon({
    className: "custom-marker",
    html: `<div style="
      width: 28px; height: 28px; border-radius: 50% 50% 50% 0;
      background: ${color}; border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      transform: rotate(-45deg);
      cursor: ${editable ? "grab" : "pointer"};
    "></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current;
      if (!marker) return;
      const newPos = marker.getLatLng();
      onPointMoved(point.id, newPos.lat, newPos.lng);
    },
  };

  const statusBadge =
    point.verificationStatus === "APPROVED"
      ? "bg-emerald-100 text-emerald-700"
      : point.verificationStatus === "REJECTED"
        ? "bg-red-100 text-red-700"
        : "bg-yellow-100 text-yellow-700";

  return (
    <Marker
      position={[point.latitude, point.longitude]}
      icon={customIcon}
      draggable={editable}
      ref={markerRef}
      eventHandlers={eventHandlers}
    >
      <Popup>
        <div className="min-w-[220px] font-sans text-sm">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="w-3 h-3 rounded-full inline-block"
              style={{ backgroundColor: color }}
            />
            <strong className="text-gray-800">
              {LAYER_LABELS[point.layerId] || point.layerName || point.layerId}
            </strong>
          </div>
          <div className="text-xs space-y-1 text-gray-600">
            <div>
              <span className="font-medium">Lat:</span> {point.latitude.toFixed(6)}
            </div>
            <div>
              <span className="font-medium">Lng:</span> {point.longitude.toFixed(6)}
            </div>
            <div>
              <span className="font-medium">Status:</span>{" "}
              <Badge className={`text-[10px] py-0 px-1.5 ${statusBadge}`}>
                {point.verificationStatus.replace(/_/g, " ")}
              </Badge>
            </div>
            {editable && (
              <p className="text-violet-600 font-medium mt-1">
                🖐 Drag to reposition
              </p>
            )}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

// ─── Main Component ────────────────────────────────────────────────────

interface SurveyPointEditorProps {
  projectId: string;
  height?: string;
  className?: string;
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

export function SurveyPointEditor({
  projectId,
  height = "600px",
  className = "",
}: SurveyPointEditorProps) {
  const [points, setPoints] = useState<SurveyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [savingPointId, setSavingPointId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPoints = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/projects/${projectId}/survey/points?limit=500`
      );
      if (!res.ok) throw new Error("Failed to fetch survey points");
      const data = await res.json();
      setPoints(data.points || data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load points");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  const handlePointMoved = useCallback(
    async (pointId: string, lat: number, lng: number) => {
      setSavingPointId(pointId);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/survey/points/${pointId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": "web-editor",
            },
            body: JSON.stringify({
              action: "update_coordinates",
              latitude: lat,
              longitude: lng,
            }),
          }
        );

        if (res.ok) {
          // Update local state optimistically
          setPoints((prev) =>
            prev.map((p) =>
              p.id === pointId ? { ...p, latitude: lat, longitude: lng } : p
            )
          );
          toast.success(
            `Point #${pointId.slice(-6)} moved to ${lat.toFixed(6)}, ${lng.toFixed(6)}`
          );
        } else {
          const err = await res.json();
          toast.error(err.error || "Failed to save coordinates");
          // Revert marker position visually by refreshing
          fetchPoints();
        }
      } catch {
        toast.error("Network error while saving coordinates");
        fetchPoints();
      } finally {
        setSavingPointId(null);
      }
    },
    [projectId, fetchPoints]
  );

  // Calculate center from points or default to SL
  const center: [number, number] =
    points.length > 0
      ? [
          points.reduce((s, p) => s + p.latitude, 0) / points.length,
          points.reduce((s, p) => s + p.longitude, 0) / points.length,
        ]
      : [7.8731, 80.7718];

  // Group points by verification status for summary
  const approvedCount = points.filter(
    (p) => p.verificationStatus === "APPROVED"
  ).length;
  const pendingCount = points.filter(
    (p) => p.verificationStatus !== "APPROVED" && p.verificationStatus !== "REJECTED"
  ).length;
  const rejectedCount = points.filter(
    (p) => p.verificationStatus === "REJECTED"
  ).length;

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200 ${className}`}
        style={{ height }}
      >
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
          <p className="text-sm text-gray-500">Loading survey points...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200 ${className}`}
        style={{ height }}
      >
        <div className="text-center space-y-3 p-8">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <p className="text-sm font-medium text-gray-700">Failed to load survey points</p>
          <p className="text-xs text-gray-500">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchPoints}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative rounded-lg border border-gray-200 overflow-hidden bg-white ${className}`}>
      {/* Toolbar */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center justify-between bg-white/95 backdrop-blur rounded-lg shadow-lg border border-gray-200 px-4 py-2.5">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-indigo-600" />
              Survey Point Fine-Tuning
            </h3>
            <p className="text-[11px] text-gray-500">
              {points.length} points · {approvedCount} approved · {pendingCount} pending · {rejectedCount} rejected
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="edit-mode"
              checked={editing}
              onCheckedChange={setEditing}
              className="data-[state=checked]:bg-violet-600"
            />
            <Label htmlFor="edit-mode" className="text-sm font-medium cursor-pointer">
              {editing ? (
                <span className="text-violet-700 flex items-center gap-1">
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Mode ON
                </span>
              ) : (
                <span className="text-gray-500">Edit Mode OFF</span>
              )}
            </Label>
          </div>
          {editing && (
            <Badge className="bg-violet-100 text-violet-700 border-violet-200 animate-pulse">
              Drag markers to reposition
            </Badge>
          )}
          {savingPointId && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200">
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
              Saving...
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchPoints}
            className="text-gray-500"
          >
            <Loader2 className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Leaflet Map */}
      <MapContainer
        center={center}
        zoom={13}
        style={{ height, width: "100%" }}
        scrollWheelZoom={true}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapResizeHandler />

        {points.map((point) => (
          <DraggableMarker
            key={point.id}
            point={point}
            editable={editing}
            onPointMoved={handlePointMoved}
          />
        ))}
      </MapContainer>

      {/* Empty state overlay */}
      {points.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 backdrop-blur-sm z-[500] pointer-events-none">
          <div className="text-center space-y-2">
            <MapPin className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="text-sm text-gray-500">No survey points found</p>
            <p className="text-xs text-gray-400">
              Sync QFieldCloud data or manually add survey points first.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}