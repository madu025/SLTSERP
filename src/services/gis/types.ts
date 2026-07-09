export interface OSMNode {
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

export interface OSMWay {
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

export interface Building {
  id: number;
  lat: number;
  lon: number;
  isMDU: boolean;
  name: string;
  demand?: number;
}

export interface RoadSegment {
  id: number;
  coordinates: [number, number][]; // [lon, lat]
  highwayType?: string;
  junction?: string;
  lanes?: number;
  oneway?: boolean;
}

export interface RoadIndexItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  roadId: number;
  p1: [number, number];
  p2: [number, number];
}

export interface BuildingIndexItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  building: Building;
}

export interface PlannedPole {
  index: number;
  latitude: number;
  longitude: number;
  status: 'PLANNED';
  poleType: 'CONCRETE';
  height: number;
}

export interface PlannedClosure {
  index: number;
  closureType: 'TERMINAL' | 'DOME';
  latitude: number;
  longitude: number;
  capacity: number;
  status: 'PLANNED';
  notes: string;
  roadId?: number;
  mduBuildingId?: number;
}

export interface PlannedCable {
  index: number;
  length: number;
  coordinates: [number, number][]; // [lon, lat]
  status: 'PLANNED';
  cableType: 'ADSS' | 'DROP' | string;
  fiberCount: number;
}

export interface AutoPlanResult {
  poles: PlannedPole[];
  closures: PlannedClosure[];
  cables: PlannedCable[];
  debugLogs?: string[];
  summary: {
    totalBuildings: number;
    mduCount: number;
    sduCount: number;
    fdpCount: number;
    poleCount: number;
    totalCableLength: number;
    engineeringQualityScore?: number;
    violations?: string[];
  };
  warning?: string;
  osmData?: any;
}

export interface CandidateDP {
  lat: number;
  lon: number;
  roadId: number;
  highwayType: string;
  score: number;
  density: number;
  connectivity: number;
  accessibility: number;
  overlapPenalty: number;
  cablePenalty: number;
}

export const SERVICE_RADIUS = 35;
export const MIN_DP_SPACING = 35;
export const MAX_BUILDINGS_PER_DP = 8;

export const ROAD_PRIORITY: Record<string, number> = {
  residential: 5,
  tertiary: 4,
  secondary: 2,
  primary: 1,
  unclassified: 5,
  service: 3,
  trunk: 0,
  motorway: 0
};
