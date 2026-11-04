// ============================================================================
// GIS import - OPMC resolution
// ============================================================================
// A GIS import creates a project, and the project's OPMC is its data scope.
// Resolving it by "region contains text" silently picked an arbitrary OPMC out
// of a region (REGION 03 has 11), so the importer could not even open the
// project they had just created. Prefer the explicit selection, then an exact
// name/RTOM match, and only fall back to the region when it is unambiguous.
// ============================================================================

export interface OpmcCandidate {
  id: string;
  name: string;
  rtom: string;
  region: string;
}

export interface ImportOpmcHint {
  opmcId?: string | null;
  /** The upload page sends the selected OPMC's name as "district". */
  district?: string | null;
  region?: string | null;
}

export type ImportOpmcResolution =
  | { id: string; by: 'id' | 'name' | 'region' }
  | { id: null; by: 'unknown-id' | 'ambiguous-region' | 'none'; candidates?: number };

const norm = (value?: string | null) => (value ?? '').trim().toLowerCase();

export function resolveImportOpmc(candidates: OpmcCandidate[], hint: ImportOpmcHint): ImportOpmcResolution {
  if (hint.opmcId) {
    const exact = candidates.find((c) => c.id === hint.opmcId);
    return exact ? { id: exact.id, by: 'id' } : { id: null, by: 'unknown-id' };
  }

  const district = norm(hint.district);
  if (district) {
    const named = candidates.filter((c) => norm(c.name) === district || norm(c.rtom) === district);
    if (named.length === 1) return { id: named[0].id, by: 'name' };
  }

  const region = norm(hint.region);
  if (region) {
    const inRegion = candidates.filter((c) => norm(c.region) === region || norm(c.name) === region || norm(c.rtom) === region);
    if (inRegion.length === 1) return { id: inRegion[0].id, by: 'region' };
    if (inRegion.length > 1) return { id: null, by: 'ambiguous-region', candidates: inRegion.length };
  }

  return { id: null, by: 'none' };
}
