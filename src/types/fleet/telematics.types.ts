export interface GPSLocation {
  id: string;
  vehicle_id: string;
  trip_id?: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed_kmh?: number;
  heading?: number;
  accuracy_meters?: number;
  recorded_at: Date;
  created_at: Date;
}

export interface Geofence {
  id: string;
  site_id?: string;
  name: string;
  fence_type: 'SITE' | 'ZONE' | 'DANGER_ZONE' | 'RESTRICTED_AREA';
  boundary_points: Array<{ lat: number; lng: number }>;
  radius_meters?: number;
  alert_on_entry: boolean;
  alert_on_exit: boolean;
  allowed_vehicles?: string[];
  allowed_drivers?: string[];
  status: 'ACTIVE' | 'INACTIVE';
  created_at: Date;
  updated_at: Date;
}