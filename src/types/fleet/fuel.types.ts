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