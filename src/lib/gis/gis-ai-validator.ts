export interface GISAnomaly {
  type: 'DISCONNECTED_CABLE' | 'OUT_OF_BOUNDS' | 'FLOATING_POLE';
  message: string;
  coordinates: [number, number]; // [lat, lng]
}

export class GISLocationService {
  // Approximate distance in meters between two lat/lng coordinates
  static getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // metres
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
  }
}

export class GISValidatorService {
  // 1. Geospatial Anomaly Checking
  static detectGISAnomalies(geojsonData: any): GISAnomaly[] {
    const anomalies: GISAnomaly[] = [];
    const features = geojsonData?.features || [];

    const poles: [number, number][] = [];
    const cables: [number, number][][] = [];

    // Parse features
    for (const f of features) {
      const geomType = f.geometry?.type;
      const coords = f.geometry?.coordinates;
      const layerName = f.properties?.layer || f.properties?.Layer || '';

      if (geomType === 'Point' && Array.isArray(coords)) {
        const lat = coords[1];
        const lng = coords[0];
        
        // 1. Bounds check (Sri Lanka bounds roughly Lat: 5.9 to 9.9, Lng: 79.5 to 82.0)
        if (lat < 5.9 || lat > 9.9 || lng < 79.5 || lng > 82.0) {
          anomalies.push({
            type: 'OUT_OF_BOUNDS',
            message: `⚠️ Out of Bounds: Pole/Joint placed outside Sri Lanka coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)}).`,
            coordinates: [lat, lng]
          });
        }

        if (layerName.toUpperCase().includes('POLE')) {
          poles.push([lat, lng]);
        }
      }

      if (geomType === 'LineString' && Array.isArray(coords)) {
        const lineCoords = coords.map((c: any) => [c[1], c[0]] as [number, number]);
        cables.push(lineCoords);
      }
    }

    // 2. Disconnected Cables Check (Snap tolerance check: 10 meters)
    const snapToleranceMeters = 10;
    for (const line of cables) {
      if (line.length === 0) continue;
      
      const startPt = line[0];
      const endPt = line[line.length - 1];

      // Check if start endpoint connects to a pole
      const startHasPole = poles.some(p => GISLocationService.getDistance(startPt[0], startPt[1], p[0], p[1]) <= snapToleranceMeters);
      const endHasPole = poles.some(p => GISLocationService.getDistance(endPt[0], endPt[1], p[0], p[1]) <= snapToleranceMeters);

      if (!startHasPole) {
        anomalies.push({
          type: 'DISCONNECTED_CABLE',
          message: `⚠️ Disconnected Cable: Cable starting point does not connect to any pole/joint within ${snapToleranceMeters}m.`,
          coordinates: startPt
        });
      }
      if (!endHasPole) {
        anomalies.push({
          type: 'DISCONNECTED_CABLE',
          message: `⚠️ Disconnected Cable: Cable ending point does not connect to any pole/joint within ${snapToleranceMeters}m.`,
          coordinates: endPt
        });
      }
    }

    // 3. Floating Poles Check (Poles not connected to any cable line)
    for (const p of poles) {
      const isConnected = cables.some(line => 
        line.some(node => GISLocationService.getDistance(p[0], p[1], node[0], node[1]) <= snapToleranceMeters)
      );

      if (!isConnected) {
        anomalies.push({
          type: 'FLOATING_POLE',
          message: `⚠️ Floating Pole: Pole is placed but has no cables connected to it.`,
          coordinates: p
        });
      }
    }

    return anomalies;
  }

  // 2. As-Built vs Planned Mismatch Auditor
  static detectBuiltMismatch(plannedGeoJSON: any, builtGeoJSON: any) {
    const plannedLen = this.getGeoJSONLength(plannedGeoJSON);
    const builtLen = this.getGeoJSONLength(builtGeoJSON);
    const deviationMeters = Math.abs(builtLen - plannedLen);

    return {
      plannedLengthMeters: Math.ceil(plannedLen),
      builtLengthMeters: Math.ceil(builtLen),
      deviationMeters: Math.ceil(deviationMeters),
      deviationPercent: plannedLen > 0 ? (deviationMeters / plannedLen) * 100 : 0,
      warnings: deviationMeters > 50 ? [`⚠️ Route deviation detected: Built route is ${Math.ceil(deviationMeters)}m different than planned.`] : []
    };
  }

  private static getGeoJSONLength(geojson: any): number {
    let len = 0;
    const features = geojson?.features || [];
    for (const f of features) {
      if (f.geometry?.type === 'LineString' && Array.isArray(f.geometry.coordinates)) {
        const coords = f.geometry.coordinates;
        for (let i = 0; i < coords.length - 1; i++) {
          len += GISLocationService.getDistance(coords[i][1], coords[i][0], coords[i+1][1], coords[i+1][0]);
        }
      }
    }
    return len;
  }
}
