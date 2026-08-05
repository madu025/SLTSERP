/**
 * Rental Payment Module - TypeScript Type Definitions
 * Monthly Rented Vehicle Payment Summary types
 */

// ============================================================================
// Enums
// ============================================================================

export enum SummaryStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  CHECKED = 'CHECKED',
  RECOMMENDED = 'RECOMMENDED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// ============================================================================
// Rental Vehicle Extended (with billing params)
// ============================================================================

export interface RentalVehicleBillingParams {
  driver_portion_monthly: number | null;
  expected_working_days: number | null;
  rate_per_additional_km: number | null;
  absent_deduction_rate: number | null;
  fuel_allowance_per_km: number | null;
  driver_term: string | null;
  fuel_supplying: string | null; // "OWNER" | "COMPANY"
  fuel_efficiency: number | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_branch: string | null;
  bank_branch_code: string | null;
}

// ============================================================================
// Monthly Summary types
// ============================================================================

export interface MonthlySummary {
  id: string;
  rentalVehicleId: string;
  year: number;
  month: number;

  // Snapshot of billing params
  rental_cost_monthly: number;
  driver_portion_monthly: number | null;
  expected_working_days: number | null;
  rate_per_additional_km: number | null;
  absent_deduction_rate: number | null;
  fuel_allowance_per_km: number | null;
  fuel_supplying: string | null;
  fuel_efficiency: number | null;
  mileage_limit_monthly: number | null;
  excess_mileage_cost_per_km: number | null;
  fuel_included: boolean;

  // Calculated metrics
  total_days_worked: number | null;
  absent_days: number | null;
  total_km_traveled: number | null;
  base_rental: number;
  fuel_allowance_amount: number;
  driver_overtime_pay: number;
  absent_deductions: number;
  additional_km_charges: number;
  net_payment: number;

  // Workflow
  status: SummaryStatus;

  prepared_by_id: string | null;
  prepared_by_name: string | null;
  prepared_at: string | null;

  checked_by_id: string | null;
  checked_by_name: string | null;
  checked_at: string | null;
  checked_remarks: string | null;

  recommended_by_id: string | null;
  recommended_by_name: string | null;
  recommended_at: string | null;
  recommended_remarks: string | null;

  notes: string | null;

  createdAt: string;
  updatedAt: string;

  // Relations
  rentalVehicle?: {
    id: string;
    vehicle: {
      id: string;
      registration_number: string;
      make: string;
      model: string;
    };
  };
}

export interface MonthlySummaryPreview {
  // Period info
  year: number;
  month: number;

  // Billing params
  rental_cost_monthly: number;
  driver_portion_monthly: number | null;
  expected_working_days: number | null;
  rate_per_additional_km: number | null;
  absent_deduction_rate: number | null;
  fuel_allowance_per_km: number | null;
  fuel_supplying: string | null;
  fuel_efficiency: number | null;
  mileage_limit_monthly: number | null;
  excess_mileage_cost_per_km: number | null;
  fuel_included: boolean;

  // Calculated metrics
  total_days_worked: number;
  absent_days: number;
  total_km_traveled: number;
  base_rental: number;
  fuel_allowance_amount: number;
  driver_overtime_pay: number;
  absent_deductions: number;
  additional_km_charges: number;
  net_payment: number;

  // Source data
  vehicle_logs_count: number;
  driver_ot_count: number;

  // Rental vehicle snapshot
  rentalVehicle: {
    id: string;
    vehicle_id: string;
    supplier_id: string;
    rental_contract_id: string;
    rental_start_date: string;
    rental_end_date: string;
    rental_cost_daily: number;
    rental_cost_monthly: number | null;
    fuel_included: boolean;
    expected_working_days: number | null;
    absentee_deduction_rate: number | null;
    mileage_limit_monthly: number | null;
    fuel_supplying: string | null;
    fuel_allowance_per_km: number | null;
    vehicle: {
      id: string;
      registration_number: string;
      make: string;
      model: string;
      year: number;
      site?: { id: string; name: string } | null;
    };
  };
}

// ============================================================================
// API DTOs
// ============================================================================

export interface GetRentalSummaryQuery {
  year: number;
  month: number;
}

export interface CreateRentalSummaryDTO {
  year: number;
  month: number;
  preparedById?: string;
  preparedByName?: string;
}

export interface WorkflowActionDTO {
  action: 'submit' | 'check' | 'recommend' | 'approve' | 'reject';
  userId: string;
  userName: string;
  remarks?: string;
}
