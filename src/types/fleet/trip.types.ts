export enum TripStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}
export interface Trip {
  id: string;
  vehicle_id: string;
  driver_id: string;
  start_location: {
    name: string;
    lat: number;
    lng: number;
    address?: string;
  };
  end_location: {
    name: string;
    lat: number;
    lng: number;
    address?: string;
  };
  scheduled_start_time: Date;
  actual_start_time?: Date;
  scheduled_end_time: Date;
  actual_end_time?: Date;
  planned_distance_km?: number;
  actual_distance_km?: number;
  planned_duration_minutes?: number;
  actual_duration_minutes?: number;
  trip_status: TripStatus;
  trip_type: 'DELIVERY' | 'PICKUP' | 'INSPECTION' | 'MAINTENANCE' | 'OTHER';
  fuel_consumed_liters?: number;
  fuel_cost?: number;
  notes?: string;
  vehicle?: { id: string; registration_number: string; make: string; model: string; year?: number } | null;
  driver?: { id: string; first_name: string; last_name: string; phone?: string; email?: string } | null;
  created_at: Date;
  updated_at: Date;
}
export interface DispatchOrder {
  id: string;
  site_id: string;
  vehicle_id: string;
  driver_id: string;
  trip_id?: string;
  assignment_date: Date;
  scheduled_start_time: Date;
  scheduled_end_time: Date;
  purpose: 'DELIVERY' | 'PICKUP' | 'SERVICE' | 'INSPECTION' | 'OTHER';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  special_instructions?: string;
  customer_info?: string;
  created_at: Date;
  updated_at: Date;
}
export interface CreateTripDTO {
  vehicle_id: string;
  driver_id: string;
  start_location: {
    name: string;
    lat: number;
    lng: number;
    address?: string;
  };
  end_location: {
    name: string;
    lat: number;
    lng: number;
    address?: string;
  };
  scheduled_start_time: Date;
  scheduled_end_time: Date;
  trip_type: 'DELIVERY' | 'PICKUP' | 'INSPECTION' | 'MAINTENANCE' | 'OTHER';
}