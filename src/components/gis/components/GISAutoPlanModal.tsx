import React from 'react';

interface NearbyDevice {
  id: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
}

interface GISAutoPlanModalProps {
  pendingPolygon: [number, number][] | null;
  startDeviceType: string;
  setStartDeviceType: (val: string) => void;
  selectedExistingDevice: NearbyDevice | null;
  setSelectedExistingDevice: (val: NearbyDevice | null) => void;
  isCreateNewDevice: boolean;
  setIsCreateNewDevice: (val: boolean) => void;
  nearbyDevices: NearbyDevice[];
  filteredDevices: NearbyDevice[];
  customStartDeviceCoord: [number, number] | null;
  setCustomStartDeviceCoord: (coord: [number, number] | null) => void;
  setPinningStartDevice: (val: boolean) => void;
  setPendingPolygon: (val: [number, number][] | null) => void;
  triggerAutoPlan: (coords: [number, number][], fp: [number, number]) => void;
}

export function getPolygonCenter(polygon: [number, number][]): [number, number] {
  let totalLon = 0, totalLat = 0;
  for (const [lon, lat] of polygon) {
    totalLon += lon;
    totalLat += lat;
  }
  return [totalLon / polygon.length, totalLat / polygon.length];
}

export function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function GISAutoPlanModal({
  pendingPolygon,
  startDeviceType,
  setStartDeviceType,
  selectedExistingDevice,
  setSelectedExistingDevice,
  isCreateNewDevice,
  setIsCreateNewDevice,
  nearbyDevices,
  filteredDevices,
  customStartDeviceCoord,
  setCustomStartDeviceCoord,
  setPinningStartDevice,
  setPendingPolygon,
  triggerAutoPlan,
}: GISAutoPlanModalProps) {
  if (!pendingPolygon) return null;

  return (
    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 max-w-sm w-full space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="space-y-1">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <span>🤖 Select Origin / Feeder Device</span>
          </h3>
          <p className="text-[10px] text-slate-500 leading-normal">
            Determine the optical fiber entry node to feed this newly drawn polygon area.
          </p>
        </div>

        <div className="space-y-3 text-xs">
          {/* Type Select */}
          <div className="space-y-1">
            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Start Device Type:</label>
            <select
              value={startDeviceType}
              onChange={(e) => {
                setStartDeviceType(e.target.value);
                setSelectedExistingDevice(null);
                setIsCreateNewDevice(true);
              }}
              className="w-full border border-slate-200 rounded p-1.5 text-xs focus:ring-1 focus:ring-orange-500 outline-none bg-white text-slate-700"
            >
              <option value="OLT">🏢 OLT (Central Office)</option>
              <option value="FTC">📦 Cabinet / FTC</option>
              <option value="CLOSURE">⚙️ Dome Closure / FDP</option>
              <option value="JOINT">🔗 Splice Joint (JB)</option>
              <option value="STUMP_CABLE">🔌 Stub / Stump Cable</option>
            </select>
          </div>

          {/* Existing Devices Scan */}
          <div className="space-y-1 border border-slate-100 rounded-lg p-2 bg-slate-50/50">
            <span className="block text-[9px] font-bold text-slate-500">
              🔍 Existing Devices in Marked Area:
            </span>
            
            {filteredDevices.length > 0 || (startDeviceType === 'OLT' && nearbyDevices.some(d => d.type === 'OLT')) || (startDeviceType === 'FTC' && nearbyDevices.some(d => d.type === 'FTC' || d.type === 'CABINET')) ? (
              <div className="space-y-2 mt-1">
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="deviceSource"
                      checked={!isCreateNewDevice}
                      onChange={() => setIsCreateNewDevice(false)}
                    />
                    <span>Use Existing</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="deviceSource"
                      checked={isCreateNewDevice}
                      onChange={() => {
                        setIsCreateNewDevice(true);
                        setSelectedExistingDevice(null);
                      }}
                    />
                    <span>Create New</span>
                  </label>
                </div>

                {!isCreateNewDevice && (
                  <select
                    value={selectedExistingDevice?.id || ''}
                    onChange={(e) => {
                      const dev = nearbyDevices.find(d => d.id === e.target.value);
                      setSelectedExistingDevice(dev || null);
                    }}
                    className="w-full border border-slate-200 rounded p-1 text-xs bg-white mt-1 text-slate-700"
                  >
                    <option value="">-- Choose Existing Device --</option>
                    {nearbyDevices
                      .filter(d => {
                        if (startDeviceType === 'CLOSURE') return d.type === 'CLOSURE';
                        if (startDeviceType === 'JOINT') return d.type === 'JOINT';
                        if (startDeviceType === 'OLT') return d.type === 'OLT';
                        if (startDeviceType === 'FTC') return d.type === 'FTC' || d.type === 'CABINET';
                        return false;
                      })
                      .map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))
                    }
                  </select>
                )}
              </div>
            ) : (
              <div className="text-[9px] text-slate-500 italic mt-1 space-y-1">
                <p>No existing {startDeviceType === 'CLOSURE' ? 'Closures' : startDeviceType === 'JOINT' ? 'Joints' : startDeviceType} detected in this polygon.</p>
                <p className="font-semibold text-orange-600">✓ A new {startDeviceType} will be placed at the center of the drawn area.</p>
              </div>
            )}

            {isCreateNewDevice && (
              <div className="flex gap-1.5 items-center mt-2">
                <button
                  type="button"
                  onClick={() => setPinningStartDevice(true)}
                  className="flex-1 text-[9px] font-semibold px-2 py-1 rounded transition-all bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 flex items-center justify-center gap-1"
                >
                  <span>📍 {customStartDeviceCoord ? 'Change Pinned Location' : 'Pin custom location on Map'}</span>
                </button>
                {customStartDeviceCoord && (
                  <button
                    type="button"
                    onClick={() => setCustomStartDeviceCoord(null)}
                    className="text-[9px] font-semibold px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-100"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Coordinates Preview */}
          <div className="bg-slate-900 text-slate-400 font-mono text-[9px] rounded p-2 flex justify-between">
            <span>Coordinates:</span>
            <span className="text-emerald-400 font-bold">
              {(() => {
                if (selectedExistingDevice) {
                  return `${selectedExistingDevice.lat.toFixed(6)}, ${selectedExistingDevice.lon.toFixed(6)}`;
                }
                if (customStartDeviceCoord) {
                  return `${customStartDeviceCoord[1].toFixed(6)}, ${customStartDeviceCoord[0].toFixed(6)} (Custom Pin)`;
                }
                const center = getPolygonCenter(pendingPolygon);
                return `${center[1].toFixed(6)}, ${center[0].toFixed(6)} (Center)`;
              })()}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2 text-xs font-semibold pt-1">
          <button
            type="button"
            onClick={() => {
              setPendingPolygon(null);
              setCustomStartDeviceCoord(null);
            }}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
          >
            Cancel Draw
          </button>
          <button
            type="button"
            onClick={() => {
              const center = getPolygonCenter(pendingPolygon);
              const fp: [number, number] = selectedExistingDevice 
                ? [selectedExistingDevice.lon, selectedExistingDevice.lat]
                : customStartDeviceCoord
                ? customStartDeviceCoord
                : center;
              triggerAutoPlan(pendingPolygon, fp);
            }}
            className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg shadow-md transition-colors"
          >
            🤖 Generate AI Auto-Plan
          </button>
        </div>
      </div>
    </div>
  );
}
