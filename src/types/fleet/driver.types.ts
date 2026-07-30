import { Vehicle } from './vehicle.types';

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
  photo_url?: string;
  license_front_url?: string;
  license_back_url?: string;
  nic_front_url?: string;
  nic_back_url?: string;
  created_at: Date;
  updated_at: Date;
}

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