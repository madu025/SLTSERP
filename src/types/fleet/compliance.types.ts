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