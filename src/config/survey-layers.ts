// ============================================================================
// 12 QGIS Survey Layers for OSP Fiber Optic Project Surveys
// Phase 3: Survey Layer Configuration
// ============================================================================

export interface SurveyLayerConfig {
  id: string;
  name: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  isNewMaterial: boolean;
  boqCategory: string;
  requiredAttributes: string[];
  optionalAttributes: string[];
  pointStyle: {
    markerColor: string;
    markerSize: number;
    markerSymbol: string;
    fillOpacity: number;
  };
}

export const SURVEY_LAYERS: SurveyLayerConfig[] = [
  // ─── Layer 1: Existing Poles ─────────────────────────────────────────
  {
    id: 'survey_existing_pole',
    name: 'Existing Pole',
    label: 'Existing Poles',
    icon: '🌳',
    color: '#22c55e', // green
    description: 'Existing poles to be used for fiber attachment (labor only)',
    isNewMaterial: false,
    boqCategory: 'LABOR',
    requiredAttributes: ['pole_id', 'type', 'condition'],
    optionalAttributes: ['owner', 'height', 'tag_number', 'notes'],
    pointStyle: { markerColor: '#22c55e', markerSize: 10, markerSymbol: 'circle', fillOpacity: 0.8 },
  },

  // ─── Layer 2: New Poles ──────────────────────────────────────────────
  {
    id: 'survey_new_pole',
    name: 'New Pole',
    label: 'New Poles',
    icon: '🔩',
    color: '#ef4444', // red
    description: 'New poles to be erected (material + labor)',
    isNewMaterial: true,
    boqCategory: 'MATERIAL+LABOR',
    requiredAttributes: ['pole_number', 'type', 'height'],
    optionalAttributes: ['foundation_type', 'guy_bracket', 'class', 'notes'],
    pointStyle: { markerColor: '#ef4444', markerSize: 12, markerSymbol: 'triangle', fillOpacity: 0.8 },
  },

  // ─── Layer 3: Joint Closures ─────────────────────────────────────────
  {
    id: 'survey_joint_closure',
    name: 'Joint Closure',
    label: 'Joint Closures',
    icon: '🔗',
    color: '#3b82f6', // blue
    description: 'Fiber joint/splice closure locations',
    isNewMaterial: true,
    boqCategory: 'MATERIAL+LABOR',
    requiredAttributes: ['closure_number', 'type', 'capacity'],
    optionalAttributes: ['splice_count', 'mounting_type', 'notes'],
    pointStyle: { markerColor: '#3b82f6', markerSize: 10, markerSymbol: 'diamond', fillOpacity: 0.8 },
  },

  // ─── Layer 4: Enclosures ─────────────────────────────────────────────
  {
    id: 'survey_enclosure',
    name: 'Enclosure/ODF',
    label: 'Enclosures/ODF',
    icon: '📦',
    color: '#8b5cf6', // purple
    description: 'ODF enclosures for fiber distribution',
    isNewMaterial: true,
    boqCategory: 'MATERIAL+LABOR',
    requiredAttributes: ['enclosure_number', 'type', 'size'],
    optionalAttributes: ['capacity', 'location_type', 'notes'],
    pointStyle: { markerColor: '#8b5cf6', markerSize: 11, markerSymbol: 'square', fillOpacity: 0.8 },
  },

  // ─── Layer 5: Cable Start (A-End) ────────────────────────────────────
  {
    id: 'survey_cable_start',
    name: 'Cable Start',
    label: 'Cable Start Points (A-End)',
    icon: '🅰️',
    color: '#f59e0b', // amber
    description: 'Cable section start points (A-End)',
    isNewMaterial: false,
    boqCategory: 'CABLE',
    requiredAttributes: ['section_number', 'fiber_count', 'cable_type'],
    optionalAttributes: ['from_facility', 'connector_type', 'notes'],
    pointStyle: { markerColor: '#f59e0b', markerSize: 12, markerSymbol: 'circle', fillOpacity: 0.9 },
  },

  // ─── Layer 6: Cable End (B-End) ──────────────────────────────────────
  {
    id: 'survey_cable_end',
    name: 'Cable End',
    label: 'Cable End Points (B-End)',
    icon: '🅱️',
    color: '#ea580c', // orange
    description: 'Cable section end points (B-End)',
    isNewMaterial: false,
    boqCategory: 'CABLE',
    requiredAttributes: ['section_number', 'fiber_count', 'cable_type'],
    optionalAttributes: ['to_facility', 'connector_type', 'notes'],
    pointStyle: { markerColor: '#ea580c', markerSize: 12, markerSymbol: 'circle', fillOpacity: 0.9 },
  },

  // ─── Layer 7: Cable Mid-Points ───────────────────────────────────────
  {
    id: 'survey_cable_mid',
    name: 'Cable Mid-Point',
    label: 'Cable Mid-Points',
    icon: '➖',
    color: '#fbbf24', // yellow
    description: 'Intermediate cable route markers',
    isNewMaterial: false,
    boqCategory: 'CABLE',
    requiredAttributes: ['section_number'],
    optionalAttributes: ['bend_radius', 'support_type', 'notes'],
    pointStyle: { markerColor: '#fbbf24', markerSize: 8, markerSymbol: 'circle', fillOpacity: 0.7 },
  },

  // ─── Layer 8: FDP Points ─────────────────────────────────────────────
  {
    id: 'survey_fdp',
    name: 'FDP Point',
    label: 'FDP Distribution Points',
    icon: '📍',
    color: '#06b6d4', // cyan
    description: 'Fiber Distribution Point locations',
    isNewMaterial: true,
    boqCategory: 'MATERIAL',
    requiredAttributes: ['fdp_number', 'capacity', 'type'],
    optionalAttributes: ['splitter_ratio', 'connector_count', 'notes'],
    pointStyle: { markerColor: '#06b6d4', markerSize: 11, markerSymbol: 'star', fillOpacity: 0.8 },
  },

  // ─── Layer 9: Underground Chambers ───────────────────────────────────
  {
    id: 'survey_chamber',
    name: 'Chamber',
    label: 'Underground Chambers',
    icon: '🕳️',
    color: '#78716c', // brown
    description: 'Underground pull/splice chambers',
    isNewMaterial: true,
    boqCategory: 'MATERIAL+LABOR',
    requiredAttributes: ['chamber_number', 'type', 'dimensions'],
    optionalAttributes: ['depth', 'cover_type', 'location_type', 'notes'],
    pointStyle: { markerColor: '#78716c', markerSize: 13, markerSymbol: 'square', fillOpacity: 0.8 },
  },

  // ─── Layer 10: DP Location (Route Changes) ───────────────────────────
  {
    id: 'survey_dp_location',
    name: 'DP Location',
    label: 'DP Route Change Locations',
    icon: '🔀',
    color: '#ec4899', // pink
    description: 'Distribution Point where route diverges (new path)',
    isNewMaterial: false,
    boqCategory: 'MISC',
    requiredAttributes: ['dp_number', 'route_change_reason'],
    optionalAttributes: ['new_route_description', 'distance_from_main', 'notes'],
    pointStyle: { markerColor: '#ec4899', markerSize: 12, markerSymbol: 'star', fillOpacity: 0.9 },
  },

  // ─── Layer 11: Road Crossings ────────────────────────────────────────
  {
    id: 'survey_road_crossing',
    name: 'Road Crossing',
    label: 'Road Crossings',
    icon: '🛣️',
    color: '#64748b', // slate
    description: 'Road crossing points requiring special permits/labor',
    isNewMaterial: false,
    boqCategory: 'LABOR',
    requiredAttributes: ['crossing_number', 'road_type', 'crossing_method'],
    optionalAttributes: ['road_width', 'traffic_density', 'permit_required', 'notes'],
    pointStyle: { markerColor: '#64748b', markerSize: 11, markerSymbol: 'cross', fillOpacity: 0.8 },
  },

  // ─── Layer 12: Obstructions ──────────────────────────────────────────
  {
    id: 'survey_obstruction',
    name: 'Obstruction',
    label: 'Obstructions',
    icon: '⚠️',
    color: '#dc2626', // red
    description: 'Physical obstructions requiring mitigation',
    isNewMaterial: false,
    boqCategory: 'MISC',
    requiredAttributes: ['obstruction_type', 'severity', 'description'],
    optionalAttributes: ['mitigation_required', 'impact_length', 'photo_required', 'notes'],
    pointStyle: { markerColor: '#dc2626', markerSize: 14, markerSymbol: 'cross', fillOpacity: 0.9 },
  },
];

// ─── Helper Functions ────────────────────────────────────────────────────
export function getLayerById(id: string): SurveyLayerConfig | undefined {
  return SURVEY_LAYERS.find((l) => l.id === id);
}

export function getLayersByCategory(category: string): SurveyLayerConfig[] {
  return SURVEY_LAYERS.filter((l) => l.boqCategory === category);
}

export function getNewMaterialLayers(): SurveyLayerConfig[] {
  return SURVEY_LAYERS.filter((l) => l.isNewMaterial);
}

export function getLaborOnlyLayers(): SurveyLayerConfig[] {
  return SURVEY_LAYERS.filter((l) => !l.isNewMaterial && l.boqCategory === 'LABOR');
}

export function getLayerIcon(id: string): string {
  return SURVEY_LAYERS.find((l) => l.id === id)?.icon ?? '📍';
}