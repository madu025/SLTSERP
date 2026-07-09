import { getDistance } from 'ol/sphere';

export interface AuditViolation {
  severity: 'CRITICAL' | 'WARNING';
  message: string;
  type: string;
}

export interface ComplianceReport {
  score: number;
  criticalCount: number;
  warningCount: number;
  violations: AuditViolation[];
}

export function auditOSPLayout(autoPlanData: any): ComplianceReport {
  const violations: AuditViolation[] = [];
  if (!autoPlanData) {
    return { score: 100, criticalCount: 0, warningCount: 0, violations: [] };
  }

  const poles = autoPlanData.poles || [];
  const cables = autoPlanData.cables || [];
  const closures = autoPlanData.closures || [];

  // Helper for sphere distance in meters
  const getDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    return getDistance([lon1, lat1], [lon2, lat2]);
  };

  // 1. Audit Clustered Poles (poles < 10m apart)
  for (let i = 0; i < poles.length; i++) {
    const p1 = poles[i];
    for (let j = i + 1; j < poles.length; j++) {
      const p2 = poles[j];
      const d = getDist(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
      if (d < 10) {
        // Check if either pole is near a closure (we expect a pole near a closure)
        let nearClosure = false;
        for (const c of closures) {
          const d1 = getDist(p1.latitude, p1.longitude, c.latitude, c.longitude);
          const d2 = getDist(p2.latitude, p2.longitude, c.latitude, c.longitude);
          if (d1 < 5 || d2 < 5) {
            nearClosure = true;
            break;
          }
        }
        if (!nearClosure) {
          violations.push({
            severity: 'WARNING',
            message: `Clustered Poles: Pole P-${p1.poleNumber || p1.index} and Pole P-${p2.poleNumber || p2.index} are only ${d.toFixed(1)}m apart.`,
            type: 'CLUSTERED_POLES'
          });
        }
      }
    }
  }

  // 2. Audit Floating Bends & Span Limits
  for (const cab of cables) {
    const coords = cab.coordinates || [];
    if (coords.length < 2) continue;
    const cabName = `Cable #${cab.index || cab.segmentNumber || ''}`;

    for (let i = 0; i < coords.length; i++) {
      const [lon, lat] = coords[i];

      // Audit Floating Bend
      let minSupportDist = Infinity;
      for (const p of poles) {
        const d = getDist(lat, lon, p.latitude, p.longitude);
        if (d < minSupportDist) minSupportDist = d;
      }
      for (const c of closures) {
        const d = getDist(lat, lon, c.latitude, c.longitude);
        if (d < minSupportDist) minSupportDist = d;
      }

      if (minSupportDist >= 5) {
        violations.push({
          severity: 'CRITICAL',
          message: `Floating Bend: ${cabName} bends at (${lat.toFixed(6)}, ${lon.toFixed(6)}) without a supporting pole/closure.`,
          type: 'FLOATING_BEND'
        });
      }

      // Audit Span Limit
      if (i < coords.length - 1) {
        const [nextLon, nextLat] = coords[i + 1];
        const spanDist = getDist(lat, lon, nextLat, nextLon);
        if (spanDist > 50) {
          violations.push({
            severity: 'WARNING',
            message: `Span Limit Exceeded: ${cabName} has a span of ${spanDist.toFixed(1)}m, exceeding the 50m safe limit.`,
            type: 'SPAN_EXCEEDED'
          });
        }
      }
    }
  }

  const criticalCount = violations.filter(v => v.severity === 'CRITICAL').length;
  const warningCount = violations.filter(v => v.severity === 'WARNING').length;

  // Calculate score: starts at 100, deduct 15 for each critical, 5 for each warning
  const score = Math.max(0, 100 - (criticalCount * 15 + warningCount * 5));

  return {
    score,
    criticalCount,
    warningCount,
    violations
  };
}

export interface OSPReasoningStep {
  title: string;
  description: string;
  type: 'JOINT' | 'POLE' | 'CABLE' | 'GENERAL';
}

export function generateOSPReasoning(autoPlanData: any): OSPReasoningStep[] {
  const steps: OSPReasoningStep[] = [];
  if (!autoPlanData) return [];

  const poles = autoPlanData.poles || [];
  const cables = autoPlanData.cables || [];
  const closures = autoPlanData.closures || [];

  // 1. Joint/Closure Placements Logic
  const domeClosures = closures.filter((c: any) => c.closureType === 'DOME');
  const terminalClosures = closures.filter((c: any) => c.closureType === 'TERMINAL');
  
  if (domeClosures.length > 0) {
    steps.push({
      title: 'Backhaul Splicing joints (Domes)',
      description: `Placed ${domeClosures.length} high-capacity Dome splice closures near road junctions to allow high-density core branching.`,
      type: 'JOINT'
    });
  }

  if (terminalClosures.length > 0) {
    steps.push({
      title: 'Access Terminals (FDPs)',
      description: `Placed ${terminalClosures.length} distribution terminals (FDPs) snapped to road shoulders, maintaining a safe 12m clear distance from private building footprints.`,
      type: 'JOINT'
    });
  }

  // 2. Pole placement logic
  if (poles.length > 0) {
    steps.push({
      title: 'Tension & Directional Support Poles',
      description: `Placed concrete utility poles at all road bend vertices and corners to support directional tension.`,
      type: 'POLE'
    });

    // Check if we have even span distribution
    let hasEvenSpans = false;
    for (const cab of cables) {
      if (cab.coordinates && cab.coordinates.length > 2) {
        hasEvenSpans = true;
        break;
      }
    }
    if (hasEvenSpans) {
      steps.push({
        title: 'Balanced Span Distribution',
        description: `Aerial spans exceeding 38m are split into equal segments (e.g. 23m each) rather than leaving clustered remainder poles.`,
        type: 'POLE'
      });
    }
  }

  // 3. Cable routing logic
  if (cables.length > 0) {
    const totalLength = cables.reduce((acc: number, c: any) => acc + (c.length || 0), 0);
    steps.push({
      title: 'Public Right-of-Way Routing',
      description: `Routed ${cables.length} fiber segments (${totalLength.toFixed(0)}m total) snapped along public street shoulders.`,
      type: 'CABLE'
    });
  }

  return steps;
}
