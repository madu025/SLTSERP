export type GISFileFormat = 'GEOJSON' | 'QGIS' | 'SHP' | 'KML' | 'KMZ' | 'GEOPACKAGE';

/** GIS Layer names as per Telecom OSP standards - supports all 12 SLT template layers */
export type GISLayerType =
  | 'CABLE'
  | 'POLE'
  | 'FDP'
  | 'FIBER_JOINT'
  | 'ROAD_EOP'
  | 'DUCT'
  | 'HANDHOLE'
  | 'MANHOLE'
  | 'ODF'
  | 'RISER'
  | 'FTC'
  | 'TEST_POINT'
  | 'BUILDING'
  | 'UNKNOWN';

/** Project types detected from GIS data */
export type DetectedProjectType = 'SSD' | 'CLUSTER_DEVELOPMENT' | 'BUILDING_FIBER' | 'UNKNOWN';

/** Asset categories for auto-register */
export type AssetCategory = 'CABLE' | 'POLE' | 'FDP' | 'FIBER_JOINT';

/** Survey task types */
export type SurveyTaskType = 'ROUTE_VERIFICATION' | 'POLE_VERIFICATION' | 'GPS_CAPTURE' | 'PHOTO_COLLECTION';

/** Permit statuses */

/** Workflow template names */

// ============================================================================
// GeoJSON Feature Interfaces
// ============================================================================

export interface GeoJSONGeometry {
  type: string;
  coordinates: number[] | number[][] | number[][][] | number[][][][];
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: GeoJSONGeometry;
  properties: Record<string, string | number | boolean | null | undefined>;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
  crs?: {
    type: string;
    properties: {
      name: string;
    };
  };
}
