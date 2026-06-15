/**
 * Vehicle Management Module - TypeScript Type Definitions
 * Generated from domain-models.md
 */

// ============================================================================
// Enums
// ============================================================================

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

export enum TripStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum PaymentType {
  RENTAL = 'RENTAL',
  MAINTENANCE = 'MAINTENANCE',
  INSURANCE_PREMIUM = 'INSURANCE_PREMIUM',
  FUEL = 'FUEL',
  DRIVER_OT_SALARY = 'DRIVER_OT_SALARY',
  TOLL = 'TOLL',
  PARKING = 'PARKING',
  FINE = 'FINE',
  REGISTRATION = 'REGISTRATION',
  OTHER = 'OTHER'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED'
}

export enum InsuranceType {
  LIABILITY = 'LIABILITY',
  COMPREHENSIVE = 'COMPREHENSIVE',
  THIRD_PARTY = 'THIRD_PARTY',
  THEFT = 'THEFT',
  ACCIDENT = 'ACCIDENT',
  DRIVER_COVER = 'DRIVER_COVER'
}

export enum InsuranceStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  PENDING_RENEWAL = 'PENDING_RENEWAL',
  LAPSED = 'LAPSED'
}

// ============================================================================
// Type Definitions
// ============================================================================

// Site/Office
export interface Site {
  id: string;
  name: string;
  code: string;
  location: {
    address: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    lat: number;
    lng: number;
  };
  contact_person: string;
  phone: string;
  email: string;
  manager_id: string;
  status: 'ACTIVE' | 'INACTIVE';
  vehicle_pool_capacity: number;
  created_at: Date;
  updated_at: Date;
}

// Vehicle Base
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
  site?: { id: string; name: string } | null;
  driver?: { id: string; first_name: string; last_name: string; phone?: string; email?: string } | null;
  created_at: Date;
  updated_at: Date;
}

// Owned Vehicle
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

// Rental Vehicle
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

// Driver
export interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: Date;
  address: {
    street: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  license_number: string;
  license_issue_date: Date;
  license_expiry_date: Date;
  license_class: string;
  medical_fitness_status: 'PASS' | 'FAIL' | 'PENDING' | 'EXPIRED';
  medical_fitness_expiry?: Date;
  certifications: string[];
  performance_score: number;
  safety_incidents_count: number;
  trips_completed: number;
  employment_date: Date;
  employment_status: 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE';
  assigned_site_id?: string;
  base_hourly_rate: number;
  ot_hourly_rate: number;
  created_at: Date;
  updated_at: Date;
}

// Driver OT
export interface DriverOT {
  id: string;
  driver_id: string;
  trip_id?: string;
  date: Date;
  shift_start_time: Date;
  shift_end_time: Date;
  regular_hours: number;
  overtime_hours: number;
  break_duration_minutes: number;
  ot_threshold_hours: number;
  ot_rate_multiplier: number;
  regular_pay: number;
  ot_pay: number;
  total_pay: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PAID';
  approved_by?: string;
  approved_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// Trip
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

// Fuel Log
export interface FuelLog {
  id: string;
  vehicle_id: string;
  trip_id?: string;
  fuel_type: 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID' | 'LPG' | 'CNG';
  quantity_liters: number;
  cost_per_liter: number;
  total_cost: number;
  odometer_reading_km: number;
  previous_odometer_km?: number;
  fuel_efficiency_km_per_liter?: number;
  fuel_date: Date;
  fuel_station?: string;
  created_at: Date;
  updated_at: Date;
}

// Insurance Policy
export interface InsurancePolicy {
  id: string;
  vehicle_id?: string;
  driver_id?: string;
  policy_number: string;
  insurer_name: string;
  insurer_contact: string;
  insurance_type: InsuranceType;
  coverage_limit: number;
  excess_amount: number;
  insured_value: number;
  issue_date: Date;
  start_date: Date;
  renewal_date: Date;
  expiry_date: Date;
  premium_amount: number;
  premium_frequency: 'ANNUAL' | 'MONTHLY' | 'QUARTERLY';
  next_premium_due_date: Date;
  status: InsuranceStatus;
  policy_document_url?: string;
  certificate_url?: string;
  created_at: Date;
  updated_at: Date;
}

// Warranty
export interface Warranty {
  id: string;
  vehicle_id: string;
  warranty_type: string;
  start_date: Date;
  expiry_date: Date;
  coverage_miles?: number;
  coverage_time_months?: number;
  coverage_details: string;
  service_interval_miles?: number;
  service_interval_months?: number;
  next_service_due_miles?: number;
  next_service_due_date?: Date;
  status: 'ACTIVE' | 'EXPIRED' | 'TRANSFERRED';
  created_at: Date;
  updated_at: Date;
}

// Compliance Status
export interface ComplianceStatus {
  id: string;
  vehicle_id: string;
  compliance_type: 'MOT' | 'ROAD_TAX' | 'REGISTRATION' | 'EMISSION' | 'INSPECTION';
  compliance_due_date: Date;
  compliance_status: 'PENDING' | 'COMPLIANT' | 'OVERDUE' | 'EXEMPTED';
  last_checked_date?: Date;
  next_check_date?: Date;
  alert_sent: boolean;
  alert_sent_date?: Date;
  created_at: Date;
  updated_at: Date;
}

// Payment
export interface Payment {
  id: string;
  invoice_id: string;
  payment_type: PaymentType;
  reference_id: string;
  base_amount: number;
  tax_amount: number;
  total_amount: number;
  tax_config_id?: string;
  tax_rate_percent?: number;
  tax_type?: 'VAT' | 'GST' | 'SALES_TAX' | 'OTHER';
  payment_date?: Date;
  payment_method: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'CHEQUE';
  payment_ref_number?: string;
  status: PaymentStatus;
  due_date: Date;
  payment_received_date?: Date;
  notes?: string;
  invoice?: { id: string; invoice_number: string; total_amount: number } | null;
  created_at: Date;
  updated_at: Date;
}

// Invoice
export interface Invoice {
  id: string;
  invoice_number: string;
  issued_by_site_id: string;
  issued_to_customer_id?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount?: number;
  tax_before_discount?: boolean;
  total_tax: number;
  total_amount: number;
  invoice_date: Date;
  due_date: Date;
  status: 'DRAFT' | 'ISSUED' | 'PARTIAL_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  description?: string;
  created_at: Date;
  updated_at: Date;
}

// Invoice Item
export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  tax_config_id?: string;
  tax_rate_percent?: number;
  line_tax: number;
  item_type: PaymentType;
  reference_id?: string;
}

// Tax Config
export interface TaxConfig {
  id: string;
  tax_name: string;
  tax_type: 'VAT' | 'GST' | 'SALES_TAX' | 'OTHER';
  tax_rate_percent: number;
  effective_from_date: Date;
  effective_to_date?: Date;
  applicable_to: PaymentType[];
  tax_inclusive: boolean;
  tax_exempt_items?: string[];
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  created_at: Date;
  updated_at: Date;
}

// Dispatch Order
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

// GPS Location
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

// Geofence
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

// ============================================================================
// DTO Types (Data Transfer Objects)
// ============================================================================

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
}

export interface UpdateVehicleDTO {
  status?: VehicleStatus;
  assigned_site_id?: string;
  current_driver_id?: string;
  notes?: string;
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

export interface CreatePaymentDTO {
  invoice_id: string;
  payment_type: PaymentType;
  reference_id: string;
  base_amount: number;
  tax_config_id?: string;
  payment_method: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'CHEQUE';
  payment_ref_number?: string;
  due_date: Date;
}

export interface CreateInvoiceDTO {
  issued_by_site_id: string;
  issued_to_customer_id?: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    tax_config_id?: string;
    item_type: PaymentType;
    reference_id?: string;
  }>;
  invoice_date: Date;
  due_date: Date;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    timestamp: Date;
    requestId: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta?: {
    timestamp: Date;
    requestId: string;
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}
