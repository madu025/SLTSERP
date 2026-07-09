export interface RouteClosure {
  id: string;
  closureNumber?: number | string | null;
  closureType?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  capacity?: number | string | null;
  notes?: string | null;
  roadId?: number | null;
}

export interface RouteCableSegment {
  id: string;
  segmentNumber?: number | string | null;
  length?: number | null;
  cableType?: string | null;
  fiberCount?: number | null;
  properties?: {
    coordinates?: [number, number][];
  } | null;
}

export interface RoutePole {
  id: string;
  poleNumber?: number | string | null;
  latitude?: number | null;
  longitude?: number | null;
  height?: number | null;
  poleType?: string | null;
}

export interface RouteData {
  id: string;
  name: string;
  routeLength?: number | null;
  status?: string | null;
  version?: number | null;
  isActive?: boolean;
  poles?: RoutePole[];
  closures?: RouteClosure[];
  cableSegments?: RouteCableSegment[];
  roadSegments?: unknown[];
  chambers?: unknown[];
  metadata?: unknown;
}

export interface BOQItem {
  description?: string;
  itemCategory?: string;
  quantity: number;
  unit: string;
  unitRate: number;
  amount: number;
}

export interface BOQData {
  totalEstimated?: number;
  totalEstimatedCost?: number;
  items?: BOQItem[];
}
export interface LayerRow {
  key: string;
  icon: string;
  label: string;
  color: string;
  count: number;
  metrics: { label: string; value: string }[];
}

export interface SurveyData {
  id: string;
  title: string;
  status: string;
  description?: string | null;
  requestNumber?: string | null;
  checkins?: unknown[];
  findings?: unknown[];
}

export interface GISLayerPanelProps {
  /** GIS route data from the API */
  gisRoutes?: RouteData[];
  /** Callback when a route is successfully deleted */
  onRouteDeleted?: (routeId: string) => void;
  /** Project assets */
  assets?: unknown[];
  /** BOQ data */
  boq?: BOQData | null;
  /** Survey data */
  surveys?: unknown[];
  /** Permit data */
  permits?: unknown[];
  /** Callback when "Import More" is clicked */
  onImportMore?: () => void;
  /** Callback when "View All" is clicked for a section */
  onViewDetails?: (section: string) => void;
  /** Project ID for API calls */
  projectId?: string;
  preSurveyMode?: boolean;
  setPreSurveyMode?: (active: boolean) => void;
  preSurveyStart?: [number, number] | null;
  preSurveyEnd?: [number, number] | null;
  setPreSurveyStart?: (pt: [number, number] | null) => void;
  setPreSurveyEnd?: (pt: [number, number] | null) => void;
  onPreSurveyCreated?: () => void;
}
