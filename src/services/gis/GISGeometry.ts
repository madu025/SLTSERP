export class GISGeometry {
  /**
   * Calculates Haversine distance between two coordinates in meters.
   */
  static getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Calculates the bearing from point 1 to point 2 in degrees (0-360).
   */
  static calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    const brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
  }

  /**
   * Ray-casting algorithm to determine if a point is inside a polygon.
   */
  static isPointInPolygon(point: [number, number], vs: [number, number][]): boolean {
    const x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      const xi = vs[i][0], yi = vs[i][1];
      const xj = vs[j][0], yj = vs[j][1];
      const intersect = ((yi > y) !== (yj > y))
          && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Determines if two line segments (p1-p2 and q1-q2) intersect.
   */
  static doLineSegmentsIntersect(
    p1: [number, number], p2: [number, number],
    q1: [number, number], q2: [number, number]
  ): boolean {
    const orientation = (a: [number, number], b: [number, number], c: [number, number]) => {
      const val = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
      if (val === 0) return 0; // colinear
      return val > 0 ? 1 : 2; // clock or counterclock wise
    };
    const onSegment = (p: [number, number], q: [number, number], r: [number, number]) => {
      return q[0] <= Math.max(p[0], r[0]) && q[0] >= Math.min(p[0], r[0]) &&
             q[1] <= Math.max(p[1], r[1]) && q[1] >= Math.min(p[1], r[1]);
    };
    
    const o1 = orientation(p1, p2, q1);
    const o2 = orientation(p1, p2, q2);
    const o3 = orientation(q1, q2, p1);
    const o4 = orientation(q1, q2, p2);

    if (o1 !== o2 && o3 !== o4) return true;

    if (o1 === 0 && onSegment(p1, q1, p2)) return true;
    if (o2 === 0 && onSegment(p1, q2, p2)) return true;
    if (o3 === 0 && onSegment(q1, p1, q2)) return true;
    if (o4 === 0 && onSegment(q1, p2, q2)) return true;

    return false;
  }

  /**
   * Snaps a point (px=lon, py=lat) to a line segment (x1,y1)→(x2,y2) using a
   * latitude-corrected dot product so that longitude compression near the poles
   * does not skew the projection parameter `t`.
   *
   * Replaces the legacy `snapPointToSegment` where geographic accuracy matters
   * (road graph insertion, nearest-road snapping). The legacy flat-earth version
   * is kept for cheap internal uses (e.g. perpendicular-normal direction only).
   */
  static snapPointToSegmentAccurate(
    px: number, py: number,
    x1: number, y1: number,
    x2: number, y2: number
  ): { lat: number; lon: number } {
    const cosLat = Math.cos(((y1 + y2) / 2) * Math.PI / 180);
    const dx = (x2 - x1) * cosLat;
    const dy = y2 - y1;
    const wx = (px - x1) * cosLat;
    const wy = py - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return { lat: y1, lon: x1 };
    const t = Math.max(0, Math.min(1, (wx * dx + wy * dy) / lenSq));
    return {
      lon: x1 + t * (x2 - x1),
      lat: y1 + t * (y2 - y1),
    };
  }

  static getDistanceToSegment(point: [number, number], segmentStart: [number, number], segmentEnd: [number, number]): number {
    const [px, py] = point;
    const [x1, y1] = segmentStart;
    const [x2, y2] = segmentEnd;

    const latAvg = ((y1 + y2) / 2) * Math.PI / 180;
    const xFactor = 111320 * Math.cos(latAvg);
    const yFactor = 111320;

    const vx = (x2 - x1) * xFactor;
    const vy = (y2 - y1) * yFactor;
    const wx = (px - x1) * xFactor;
    const wy = (py - y1) * yFactor;
    const c = vx * vx + vy * vy;
    if (c === 0) {
      return this.getDistanceMeters(py, px, y1, x1);
    }
    const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / c));
    const projX = x1 + (vx * t) / xFactor;
    const projY = y1 + (vy * t) / yFactor;
    return this.getDistanceMeters(py, px, projY, projX);
  }

  static getDistanceToPolygon(point: [number, number], polygon: [number, number][]): number {
    if (polygon.length < 2) return Infinity;
    if (this.isPointInPolygon(point, polygon)) return 0;
    let minDistance = Infinity;
    for (let i = 0; i < polygon.length - 1; i++) {
      const segmentStart = polygon[i];
      const segmentEnd = polygon[i + 1];
      const distance = this.getDistanceToSegment(point, segmentStart, segmentEnd);
      if (distance < minDistance) {
        minDistance = distance;
      }
    }
    return minDistance;
  }

  /**
   * Calculates the centroid coordinate of a list of points.
   */
  static calculateCentroid(points: { lat: number; lon: number }[]): { lat: number; lon: number } {
    let sumLat = 0;
    let sumLon = 0;
    for (const pt of points) {
      sumLat += pt.lat;
      sumLon += pt.lon;
    }
    return {
      lat: sumLat / points.length,
      lon: sumLon / points.length,
    };
  }
}
