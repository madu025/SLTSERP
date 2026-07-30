import { Site } from '../common/site.types';
import { Driver } from './driver.types';

export enum VehicleType {
  CAR = 'CAR',
  VAN = 'VAN',
  MINI_VAN = 'MINI_VAN',
  LORRY = 'LORRY',
  CAB = 'CAB',
  DOUBLE_CAB = 'DOUBLE_CAB',
  BOOM_TRUCK = 'BOOM_TRUCK',
  TRUCK = 'TRUCK'
}

export enum OwnershipType {
  OWNED = 'OWNED',
  RENTAL = 'RENTAL',
  HYBRID = 'HYBRID'
}

export enum VehicleStatus {
  AVAILABLE = 'AVAILABLE',
  IN_USE = 'IN_USE',
  MAINTENANCE = 'MAINTENANCE',
  DECOMMISSIONED = 'DECOMMISSIONED',
  RESERVED = 'RESERVED'
}

export interface Vehicle {
  id: string;
  registration_number: string;
  chassis_number: string;
  engine_number: string;
  make: string;
  model: string;
  year: number;
  color: string;
  vehicle_type: VehicleType;
  ownership: OwnershipType;
  status: VehicleStatus;
  capacity_passengers: number;
  capacity_cargo_weight_kg: number;
  capacity_cargo_volume_m3: number;
  assigned_site_id: string;
  current_location: {
    lat: number;
    lng: number;
    timestamp: Date;
    accuracy: number;
  };
  current_driver_id?: string;
  registration_date: Date;
  decommissioned_date?: Date;
  purchase_cost?: number;
  insurance_cost_annual?: number;
  fuel_cost_per_liter?: number;
  last_odometer: number;
  photo_url?: string;
  site?: { id: string; name: string } | null;
  driver?: { id: string; first_name: string; last_name: string; phone?: string; email?: string } | null;
  created_at: Date;
  updated_at: Date;
}

export interface OwnedVehicle extends Vehicle {
  purchase_date: Date;
  purchase_cost: number;
  depreciation_rate_percent: number;
  depreciation_schedule: string;
  book_value: number;
  salvage_value: number;
  finance_type: 'CASH' | 'LOAN' | 'LEASE';
  loan_amount?: number;
  loan_remaining?: number;
  loan_end_date?: Date;
}

export interface RentalVehicle extends Vehicle {
  supplier_id: string;
  rental_contract_id: string;
  rental_start_date: Date;
  rental_end_date: Date;
  rental_cost_daily: number;
  rental_cost_weekly?: number;
  rental_cost_monthly?: number;
  fuel_included: boolean;
  maintenance_included: boolean;
  insurance_included: boolean;
  mileage_limit_monthly?: number;
  excess_mileage_cost_per_km?: number;
  contract_terms: string;
}

export interface CreateVehicleDTO {
  registration_number: string;
  chassis_number: string;
  engine_number: string;
  make: string;
  model: string;
  year: number;
  color: string;
  vehicle_type: VehicleType;
  ownership: OwnershipType;
  capacity_passengers: number;
  capacity_cargo_weight_kg: number;
  capacity_cargo_volume_m3: number;
  assigned_site_id: string;
  photo_url?: string;
}

export interface UpdateVehicleDTO {
  status?: VehicleStatus;
  assigned_site_id?: string;
  current_driver_id?: string;
  notes?: string;
  photo_url?: string;
  last_odometer?: number;
}

export interface VehicleLog {
  id: string;
  vehicle_id: string;
  driver_id: string;
  start_time: Date;
  end_time?: Date;
  start_odometer: number;
  end_odometer?: number;
  expected_start_odometer: number;
  odometer_mismatch: boolean;
  mismatch_reason?: string;
  passengers?: string;
  status: 'ACTIVE' | 'COMPLETED';
  created_at: Date;
  updated_at: Date;
  vehicle?: Vehicle | null;
  driver?: Driver | null;
}

export interface CreateVehicleLogDTO {
  vehicle_id: string;
  driver_id: string;
  start_odometer: number;
  expected_start_odometer: number;
  mismatch_reason?: string;
  passengers?: string;
  start_time?: Date;
}

export interface EndVehicleLogDTO {
  end_odometer: number;
  end_time?: Date;
}