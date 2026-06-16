# Vehicle Management Module - Domain Models

**Version:** 1.0  
**Status:** In Progress  
**Created:** 2026-06-15

---

## Entity-Relationship Diagram (Conceptual)

```
┌─────────────────┐
│     Site        │
│   (Office)      │
└────────┬────────┘
         │1
         │
         │M
┌─────────────────────────────────────────────────┐
│          Vehicle                                │
│  ┌─────────────────────────────────────────┐   │
│  │ id, reg_number, status                  │   │
│  │ vehicle_type (CARS|VANS|LORRIES|...)    │   │
│  │ ownership (OWNED|RENTAL)                │   │
│  │ current_site_id, current_location (GPS) │   │
│  └─────────────────────────────────────────┘   │
└────────┬────────────┬────────────┬──────────────┘
         │1          │1           │1
         │M          │M           │M
         │           │            │
    ┌────▼────┐  ┌──▼──────┐  ┌─▼──────┐
    │ Driver  │  │Insurance│  │  Trip  │
    │ (M:M)   │  │ Policy  │  │ (M:1)  │
    └────┬────┘  └──┬──────┘  └─┬──────┘
         │          │          │
         │M         │M         │M
         │          │          │
    ┌────▼──────────▼──┐  ┌───▼───────┐
    │   DriverOT       │  │Fuel Log   │
    │ (1:M from Driver)│  │ (1:M Trip)│
    └──────────────────┘  └───────────┘

    ┌──────────────────────┐
    │    RentalVehicle     │
    │  (extends Vehicle)   │
    │ rental_start,_end    │
    │ supplier_id          │
    │ contract_id          │
    └──────────────────────┘

    ┌──────────────────────┐
    │   OwnedVehicle       │
    │  (extends Vehicle)   │
    │ purchase_date,_cost  │
    │ depreciation_plan    │
    └──────────────────────┘

    ┌──────────────────────┐
    │    Payment           │
    │  invoice_id          │
    │  amount, tax_amount  │
    │  payment_type        │
    │  status              │
    └──────────────────────┘
```

---

## 1. Core Entities

### 1.1 Site (Office/Branch)

**Purpose:** Multi-site management for vehicle allocation and dispatch.

```typescript
interface Site {
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
  manager_id: string; // User ID
  status: 'ACTIVE' | 'INACTIVE';
  vehicle_pool_capacity: number; // Max vehicles at this site
  created_at: DateTime;
  updated_at: DateTime;
}
```

### 1.2 Vehicle

**Purpose:** Base vehicle entity for both owned and rental vehicles.

```typescript
enum VehicleType {
  CAR = 'CAR',
  VAN = 'VAN',
  MINI_VAN = 'MINI_VAN',
  LORRY = 'LORRY',
  CAB = 'CAB',
  DOUBLE_CAB = 'DOUBLE_CAB',
  BOOM_TRUCK = 'BOOM_TRUCK',
  TRUCK = 'TRUCK'
}

enum OwnershipType {
  OWNED = 'OWNED',
  RENTAL = 'RENTAL',
  HYBRID = 'HYBRID'
}

enum VehicleStatus {
  AVAILABLE = 'AVAILABLE',
  IN_USE = 'IN_USE',
  MAINTENANCE = 'MAINTENANCE',
  DECOMMISSIONED = 'DECOMMISSIONED',
  RESERVED = 'RESERVED'
}

interface Vehicle {
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
  
  // Capacity
  capacity_passengers: number;
  capacity_cargo_weight_kg: number;
  capacity_cargo_volume_m3: number;
  
  // Location & Assignment
  assigned_site_id: string;
  current_location: {
    lat: number;
    lng: number;
    timestamp: DateTime;
    accuracy: number; // meters
  };
  current_driver_id?: string;
  
  // Lifecycle
  registration_date: DateTime;
  decommissioned_date?: DateTime;
  
  // Costs (owned vehicles)
  purchase_cost?: number;
  insurance_cost_annual?: number;
  fuel_cost_per_liter?: number;
  
  created_at: DateTime;
  updated_at: DateTime;
}
```

### 1.3 OwnedVehicle (Extension)

**Purpose:** Additional details for vehicles owned by the organization.

```typescript
interface OwnedVehicle extends Vehicle {
  purchase_date: DateTime;
  purchase_cost: number;
  depreciation_rate_percent: number; // Annual depreciation %
  depreciation_schedule: string; // JSON field with year-wise schedule
  book_value: number; // Current depreciation value
  salvage_value: number;
  finance_type: 'CASH' | 'LOAN' | 'LEASE';
  loan_amount?: number;
  loan_remaining?: number;
  loan_end_date?: DateTime;
}
```

### 1.4 RentalVehicle (Extension)

**Purpose:** Additional details for rental vehicles.

```typescript
interface RentalVehicle extends Vehicle {
  supplier_id: string; // Third-party lessor
  rental_contract_id: string;
  rental_start_date: DateTime;
  rental_end_date: DateTime;
  rental_cost_daily: number;
  rental_cost_weekly?: number;
  rental_cost_monthly?: number;
  fuel_included: boolean;
  maintenance_included: boolean;
  insurance_included: boolean;
  mileage_limit_monthly?: number;
  excess_mileage_cost_per_km?: number;
  contract_terms: string; // JSON field
}
```

### 1.5 Driver

**Purpose:** Driver profile and certification management.

```typescript
interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: DateTime;
  
  // Address
  address: {
    street: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  
  // License
  license_number: string;
  license_issue_date: DateTime;
  license_expiry_date: DateTime;
  license_class: string; // A, B, C1, C, D1, D, etc.
  
  // Health & Compliance
  medical_fitness_status: 'PASS' | 'FAIL' | 'PENDING' | 'EXPIRED';
  medical_fitness_expiry?: DateTime;
  certifications: string[]; // HGV, PSV, Hazmat, etc.
  
  // Performance
  performance_score: number; // 0-100
  safety_incidents_count: number;
  trips_completed: number;
  
  // Employment
  employment_date: DateTime;
  employment_status: 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE';
  assigned_site_id?: string;
  base_hourly_rate: number;
  ot_hourly_rate: number;
  
  created_at: DateTime;
  updated_at: DateTime;
}
```

### 1.6 DriverOT (Overtime Tracking)

**Purpose:** Track driver work hours and overtime.

```typescript
interface DriverOT {
  id: string;
  driver_id: string;
  trip_id?: string;
  
  date: DateTime;
  shift_start_time: DateTime;
  shift_end_time: DateTime;
  
  // Hours
  regular_hours: number; // Up to 8 hours
  overtime_hours: number; // Beyond 8 hours
  break_duration_minutes: number;
  
  // Configuration
  ot_threshold_hours: number; // Default 8
  ot_rate_multiplier: number; // 1.5 or 2.0
  
  // Calculation
  regular_pay: number;
  ot_pay: number;
  total_pay: number;
  
  // Status
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PAID';
  approved_by?: string; // Manager ID
  approved_at?: DateTime;
  
  created_at: DateTime;
  updated_at: DateTime;
}
```

---

## 2. Insurance & Compliance Entities

### 2.1 Insurance Policy

**Purpose:** Track vehicle and driver insurance.

```typescript
enum InsuranceType {
  LIABILITY = 'LIABILITY',
  COMPREHENSIVE = 'COMPREHENSIVE',
  THIRD_PARTY = 'THIRD_PARTY',
  THEFT = 'THEFT',
  ACCIDENT = 'ACCIDENT',
  DRIVER_COVER = 'DRIVER_COVER'
}

enum InsuranceStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  PENDING_RENEWAL = 'PENDING_RENEWAL',
  LAPSED = 'LAPSED'
}

interface InsurancePolicy {
  id: string;
  vehicle_id?: string;
  driver_id?: string;
  
  policy_number: string;
  insurer_name: string;
  insurer_contact: string;
  
  insurance_type: InsuranceType;
  coverage_limit: number;
  excess_amount: number; // Deductible
  insured_value: number;
  
  // Dates
  issue_date: DateTime;
  start_date: DateTime;
  renewal_date: DateTime;
  expiry_date: DateTime;
  
  // Premium
  premium_amount: number;
  premium_frequency: 'ANNUAL' | 'MONTHLY' | 'QUARTERLY';
  next_premium_due_date: DateTime;
  
  status: InsuranceStatus;
  
  // Documents
  policy_document_url?: string;
  certificate_url?: string;
  
  created_at: DateTime;
  updated_at: DateTime;
}
```

### 2.2 Warranty

**Purpose:** Track vehicle warranty and service intervals.

```typescript
interface Warranty {
  id: string;
  vehicle_id: string;
  
  warranty_type: string; // Manufacturer, Extended, Service Plan, etc.
  start_date: DateTime;
  expiry_date: DateTime;
  
  // Coverage
  coverage_miles?: number;
  coverage_time_months?: number;
  coverage_details: string; // JSON field
  
  // Service Schedule
  service_interval_miles?: number;
  service_interval_months?: number;
  next_service_due_miles?: number;
  next_service_due_date?: DateTime;
  
  status: 'ACTIVE' | 'EXPIRED' | 'TRANSFERRED';
  created_at: DateTime;
  updated_at: DateTime;
}
```

### 2.3 Compliance Status

**Purpose:** Track regulatory compliance deadlines.

```typescript
interface ComplianceStatus {
  id: string;
  vehicle_id: string;
  
  compliance_type: 'MOT' | 'ROAD_TAX' | 'REGISTRATION' | 'EMISSION' | 'INSPECTION';
  compliance_due_date: DateTime;
  compliance_status: 'PENDING' | 'COMPLIANT' | 'OVERDUE' | 'EXEMPTED';
  
  last_checked_date?: DateTime;
  next_check_date?: DateTime;
  
  alert_sent: boolean;
  alert_sent_date?: DateTime;
  
  created_at: DateTime;
  updated_at: DateTime;
}
```

---

## 3. Trip & Fuel Entities

### 3.1 Trip

**Purpose:** Record vehicle trips and journeys.

```typescript
enum TripStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

interface Trip {
  id: string;
  vehicle_id: string;
  driver_id: string;
  
  // Route
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
  
  // Time
  scheduled_start_time: DateTime;
  actual_start_time?: DateTime;
  scheduled_end_time: DateTime;
  actual_end_time?: DateTime;
  
  // Distance & Duration
  planned_distance_km?: number;
  actual_distance_km?: number;
  planned_duration_minutes?: number;
  actual_duration_minutes?: number;
  
  // Status & Type
  trip_status: TripStatus;
  trip_type: 'DELIVERY' | 'PICKUP' | 'INSPECTION' | 'MAINTENANCE' | 'OTHER';
  
  // Fuel
  fuel_consumed_liters?: number;
  fuel_cost?: number;
  
  // Notes
  notes?: string;
  
  created_at: DateTime;
  updated_at: DateTime;
}
```

### 3.2 FuelLog

**Purpose:** Track fuel consumption and costs.

```typescript
interface FuelLog {
  id: string;
  vehicle_id: string;
  trip_id?: string;
  
  fuel_type: 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID' | 'LPG' | 'CNG';
  quantity_liters: number;
  cost_per_liter: number;
  total_cost: number;
  
  // Odometer reading
  odometer_reading_km: number;
  previous_odometer_km?: number;
  
  // Efficiency
  fuel_efficiency_km_per_liter?: number;
  
  fuel_date: DateTime;
  fuel_station?: string;
  
  created_at: DateTime;
  updated_at: DateTime;
}
```

---

## 4. Payment & Tax Entities

### 4.1 Payment

**Purpose:** Record all financial transactions.

```typescript
enum PaymentType {
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

enum PaymentStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED'
}

interface Payment {
  id: string;
  invoice_id: string;
  
  payment_type: PaymentType;
  reference_id: string; // rental_id, trip_id, etc.
  
  // Amounts
  base_amount: number;
  tax_amount: number;
  total_amount: number; // base_amount + tax_amount
  
  // Tax Details
  tax_config_id?: string;
  tax_rate_percent?: number;
  tax_type?: 'VAT' | 'GST' | 'SALES_TAX' | 'OTHER';
  
  // Payment details
  payment_date?: DateTime;
  payment_method: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'CHEQUE';
  payment_ref_number?: string;
  
  status: PaymentStatus;
  
  // Dates
  due_date: DateTime;
  payment_received_date?: DateTime;
  
  // Notes
  notes?: string;
  
  created_at: DateTime;
  updated_at: DateTime;
}
```

### 4.2 Invoice

**Purpose:** Generate and track invoices.

```typescript
interface Invoice {
  id: string;
  invoice_number: string;
  
  // From/To
  issued_by_site_id: string;
  issued_to_customer_id?: string; // For rental companies
  
  // Items
  items: InvoiceItem[];
  
  // Amounts
  subtotal: number;
  discount?: number;
  tax_before_discount?: boolean;
  
  // Total
  total_tax: number;
  total_amount: number;
  
  // Dates
  invoice_date: DateTime;
  due_date: DateTime;
  
  status: 'DRAFT' | 'ISSUED' | 'PARTIAL_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  
  description?: string;
  
  created_at: DateTime;
  updated_at: DateTime;
}

interface InvoiceItem {
  id: string;
  invoice_id: string;
  
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number; // quantity * unit_price
  
  tax_config_id?: string;
  tax_rate_percent?: number;
  line_tax: number;
  
  item_type: PaymentType;
  reference_id?: string; // rental_id, trip_id, etc.
}
```

### 4.3 TaxConfig

**Purpose:** Manage tax rates and configurations.

```typescript
interface TaxConfig {
  id: string;
  
  tax_name: string; // VAT, GST, etc.
  tax_type: 'VAT' | 'GST' | 'SALES_TAX' | 'OTHER';
  
  // Rate
  tax_rate_percent: number;
  effective_from_date: DateTime;
  effective_to_date?: DateTime;
  
  // Scope
  applicable_to: PaymentType[]; // Which payment types use this tax
  
  // Calculation
  tax_inclusive: boolean; // Is price inclusive of tax?
  tax_exempt_items?: string[]; // JSON array
  
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  
  created_at: DateTime;
  updated_at: DateTime;
}
```

---

## 5. Dispatch Entities

### 5.1 DispatchOrder

**Purpose:** Manage vehicle dispatch and assignments.

```typescript
interface DispatchOrder {
  id: string;
  site_id: string;
  
  // Assignment
  vehicle_id: string;
  driver_id: string;
  
  // Trip Details
  trip_id?: string;
  assignment_date: DateTime;
  scheduled_start_time: DateTime;
  scheduled_end_time: DateTime;
  
  // Purpose
  purpose: 'DELIVERY' | 'PICKUP' | 'SERVICE' | 'INSPECTION' | 'OTHER';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  
  // Status
  status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  
  // Notes
  special_instructions?: string;
  customer_info?: string;
  
  created_at: DateTime;
  updated_at: DateTime;
}
```

---

## 6. GPS & Location Entities

### 6.1 GPSLocation

**Purpose:** Real-time GPS tracking history.

```typescript
interface GPSLocation {
  id: string;
  vehicle_id: string;
  trip_id?: string;
  
  latitude: number;
  longitude: number;
  altitude?: number;
  
  speed_kmh?: number;
  heading?: number; // Direction in degrees
  accuracy_meters?: number;
  
  recorded_at: DateTime;
  created_at: DateTime;
}
```

### 6.2 Geofence

**Purpose:** Define geographic boundaries for alerts.

```typescript
interface Geofence {
  id: string;
  site_id?: string;
  
  name: string;
  fence_type: 'SITE' | 'ZONE' | 'DANGER_ZONE' | 'RESTRICTED_AREA';
  
  // Geometry
  boundary_points: Array<{ lat: number; lng: number }>;
  radius_meters?: number; // For circular fences
  
  // Rules
  alert_on_entry: boolean;
  alert_on_exit: boolean;
  allowed_vehicles?: string[]; // Vehicle IDs
  allowed_drivers?: string[]; // Driver IDs
  
  status: 'ACTIVE' | 'INACTIVE';
  
  created_at: DateTime;
  updated_at: DateTime;
}
```

---

## Summary

| Entity | Purpose | Key Fields |
|--------|---------|-----------|
| Site | Multi-site management | name, location, capacity |
| Vehicle | Base vehicle info | reg_number, type, ownership, status |
| OwnedVehicle | Owned vehicle details | purchase_cost, depreciation |
| RentalVehicle | Rental vehicle details | supplier, contract, rental_dates |
| Driver | Driver profile | license, certifications, performance |
| DriverOT | Overtime tracking | hours, rate, pay calculation |
| Trip | Trip records | start/end, distance, fuel |
| FuelLog | Fuel consumption | quantity, cost, efficiency |
| InsurancePolicy | Insurance tracking | policy details, premium, expiry |
| Warranty | Warranty tracking | coverage, service intervals |
| Payment | Financial transactions | amount, tax, status |
| Invoice | Invoice records | items, total, tax breakdown |
| TaxConfig | Tax management | rates, applicable items |
| DispatchOrder | Vehicle assignments | vehicle, driver, purpose |
| GPSLocation | Location tracking | coordinates, speed |
| Geofence | Geographic boundaries | coordinates, alert rules |

---

**Next Steps:**
1. ✅ Domain models defined
2. ⏳ Create Prisma schema (Task 3)
3. ⏳ Define REST API spec (Task 4)

