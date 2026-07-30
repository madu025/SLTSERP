import { AppError } from '@/lib/error';
/**
 * Vehicle Log Service - Business logic for vehicle usage/duty logs
 * Handles dynamic driver check-in, check-out, and odometer auditing
 */

import { prisma as db } from '@/lib/prisma';
import { safe } from '@/utils/safe-await.util';
import { VehicleLog, CreateVehicleLogDTO, EndVehicleLogDTO } from '@/types/vehicle-management.types';

interface CustomPrismaClient {
  vMVehicleLog: {
    findFirst(args: unknown): Promise<Record<string, unknown> | null>;
    create(args: unknown): Promise<Record<string, unknown>>;
    update(args: unknown): Promise<Record<string, unknown>>;
  };
  vMVehicle: {
    findUnique(args: unknown): Promise<Record<string, unknown> | null>;
    update(args: unknown): Promise<Record<string, unknown>>;
  };
  $transaction<T>(cb: (tx: CustomPrismaClient) => Promise<T>): Promise<T>;
}

const prisma = db as unknown as CustomPrismaClient;

export class VehicleLogService {
  /**
   * Get the current active usage log for a vehicle
   */
  async getActiveLog(vehicleId: string): Promise<VehicleLog | null> {
    const [err, log] = await safe(prisma.vMVehicleLog.findFirst({
      where: {
        vehicle_id: vehicleId,
        status: 'ACTIVE',
      },
      include: {
        vehicle: { include: { site: true } },
        driver: true,
      },
    }));

    if (err) {
      throw AppError.badRequest(`Failed to get active log: ${(err as Error).message}`);
    }

    return log ? this.mapLogToDTO(log) : null;
  }

  /**
   * Start a new usage log (Check-in / Duty On)
   */
  async startUsageLog(data: CreateVehicleLogDTO): Promise<VehicleLog> {
    // 1. Assert no active log exists
    const [activeLogErr, activeLog] = await safe(prisma.vMVehicleLog.findFirst({
      where: {
        vehicle_id: data.vehicle_id,
        status: 'ACTIVE',
      },
    }));

    if (activeLogErr) throw AppError.badRequest(`Failed to start vehicle log: ${(activeLogErr as Error).message}`);
    if (activeLog) {
      throw AppError.badRequest('Vehicle is already checked out and in use.');
    }

    // 2. Fetch vehicle to verify expected odometer
    const [vehicleErr, vehicle] = await safe(prisma.vMVehicle.findUnique({
      where: { id: data.vehicle_id },
    }));

    if (vehicleErr) throw AppError.badRequest(`Failed to start vehicle log: ${(vehicleErr as Error).message}`);
    if (!vehicle) {
      throw AppError.badRequest('Vehicle not found.');
    }

    // 3. Determine odometer mismatch
    const expectedOdometer = Number(vehicle.last_odometer || 0);
    const odometerMismatch = data.start_odometer !== expectedOdometer;

    // 4. Create the log in a transaction
    const [txErr, log] = await safe(prisma.$transaction(async (tx) => {
      // Create the usage log
      const newLog = await tx.vMVehicleLog.create({
        data: {
          vehicle_id: data.vehicle_id,
          driver_id: data.driver_id,
          start_odometer: data.start_odometer,
          expected_start_odometer: expectedOdometer,
          odometer_mismatch: odometerMismatch,
          mismatch_reason: odometerMismatch ? (data.mismatch_reason || 'Odometer mismatch reported') : null,
          passengers: data.passengers || null,
          start_time: data.start_time || new Date(),
          status: 'ACTIVE',
        },
        include: {
          vehicle: { include: { site: true } },
          driver: true,
        },
      });

      // Update vehicle state (status = IN_USE, current_driver_id, and sync last_odometer if mismatched)
      await tx.vMVehicle.update({
        where: { id: data.vehicle_id },
        data: {
          status: 'IN_USE',
          current_driver_id: data.driver_id,
          last_odometer: data.start_odometer, // Update vehicle meter to starting meter
        },
      });

      return newLog;
    }));

    if (txErr || !log) {
      throw AppError.badRequest(`Failed to start vehicle log: ${(txErr as Error).message}`);
    }

    return this.mapLogToDTO(log);
  }

  /**
   * End the active usage log (Check-out / Duty Off)
   */
  async endUsageLog(vehicleId: string, data: EndVehicleLogDTO): Promise<VehicleLog> {
    // 1. Get the active log
    const [activeLogErr, activeLog] = await safe(prisma.vMVehicleLog.findFirst({
      where: {
        vehicle_id: vehicleId,
        status: 'ACTIVE',
      },
    }));

    if (activeLogErr) throw AppError.badRequest(`Failed to end vehicle log: ${(activeLogErr as Error).message}`);
    if (!activeLog) {
      throw AppError.badRequest('No active usage log found for this vehicle.');
    }

    const startOdo = Number(activeLog.start_odometer || 0);
    if (data.end_odometer < startOdo) {
      throw AppError.badRequest(`End odometer (${data.end_odometer}) cannot be less than start odometer (${startOdo}).`);
    }

    // 2. Complete the log in a transaction
    const [txErr, log] = await safe(prisma.$transaction(async (tx) => {
      // Update the log
      const completedLog = await tx.vMVehicleLog.update({
        where: { id: activeLog.id },
        data: {
          end_time: data.end_time || new Date(),
          end_odometer: data.end_odometer,
          status: 'COMPLETED',
        },
        include: {
          vehicle: { include: { site: true } },
          driver: true,
        },
      });

      // Update vehicle state (status = AVAILABLE, current_driver_id = null, last_odometer = end_odometer)
      await tx.vMVehicle.update({
        where: { id: vehicleId },
        data: {
          status: 'AVAILABLE',
          current_driver_id: null,
          last_odometer: data.end_odometer,
        },
      });

      return completedLog;
    }));

    if (txErr || !log) {
      throw AppError.badRequest(`Failed to end vehicle log: ${(txErr as Error).message}`);
    }

    return this.mapLogToDTO(log);
  }

  /**
   * Map database log object to DTO
   */
  private mapLogToDTO(logRecord: Record<string, unknown>): VehicleLog {
    const v = logRecord.vehicle as Record<string, unknown> | null | undefined;
    const d = logRecord.driver as Record<string, unknown> | null | undefined;
    const vSite = v?.site as Record<string, unknown> | null | undefined;

    return {
      id: logRecord.id as string,
      vehicle_id: logRecord.vehicle_id as string,
      driver_id: logRecord.driver_id as string,
      start_time: logRecord.start_time as Date,
      end_time: (logRecord.end_time as Date) || undefined,
      start_odometer: Number(logRecord.start_odometer || 0),
      end_odometer: logRecord.end_odometer ? Number(logRecord.end_odometer) : undefined,
      expected_start_odometer: Number(logRecord.expected_start_odometer || 0),
      odometer_mismatch: Boolean(logRecord.odometer_mismatch),
      mismatch_reason: (logRecord.mismatch_reason as string) || undefined,
      passengers: (logRecord.passengers as string) || undefined,
      status: logRecord.status as 'ACTIVE' | 'COMPLETED',
      created_at: (logRecord.createdAt || logRecord.created_at) as Date,
      updated_at: (logRecord.updatedAt || logRecord.updated_at) as Date,
      vehicle: v ? {
        id: v.id as string,
        registration_number: v.registration_number as string,
        chassis_number: v.chassis_number as string,
        engine_number: v.engine_number as string,
        make: v.make as string,
        model: v.model as string,
        year: Number(v.year || 0),
        color: v.color as string,
        vehicle_type: v.vehicle_type as any,
        ownership: v.ownership as any,
        status: v.status as any,
        capacity_passengers: Number(v.capacity_passengers || 0),
        capacity_cargo_weight_kg: Number(v.capacity_cargo_weight_kg || 0),
        capacity_cargo_volume_m3: Number(v.capacity_cargo_volume_m3 || 0),
        assigned_site_id: (v.site_id as string) || '',
        current_driver_id: (v.current_driver_id as string) || undefined,
        current_location: {
          lat: Number(v.latitude || 0),
          lng: Number(v.longitude || 0),
          timestamp: (v.location_timestamp as Date) || new Date(),
          accuracy: Number(v.location_accuracy_meters || 10),
        },
        registration_date: v.registration_date as Date,
        decommissioned_date: (v.decommissioned_date as Date) || undefined,
        purchase_cost: v.purchase_cost ? Number(v.purchase_cost) : undefined,
        insurance_cost_annual: v.insurance_cost_annual ? Number(v.insurance_cost_annual) : undefined,
        fuel_cost_per_liter: v.fuel_cost_per_liter ? Number(v.fuel_cost_per_liter) : undefined,
        last_odometer: Number(v.last_odometer || 0),
        photo_url: (v.photo_url as string) || undefined,
        site: vSite ? { id: vSite.id as string, name: vSite.name as string } : null,
        created_at: (v.createdAt || v.created_at) as Date,
        updated_at: (v.updatedAt || v.updated_at) as Date,
      } : undefined,
      driver: d ? {
        id: d.id as string,
        first_name: d.first_name as string,
        last_name: d.last_name as string,
        email: d.email as string,
        phone: d.phone as string,
        date_of_birth: d.date_of_birth as Date,
        address: {
          street: (d.street as string) || '',
          city: (d.city as string) || '',
          state: (d.state as string) || '',
          postal_code: (d.postal_code as string) || '',
          country: (d.country as string) || '',
        },
        license_number: d.license_number as string,
        license_issue_date: d.license_issue_date as Date,
        license_expiry_date: d.license_expiry_date as Date,
        license_class: d.license_class as any,
        medical_fitness_status: d.medical_fitness_status as any,
        medical_fitness_expiry: (d.medical_fitness_expiry as Date) || undefined,
        certifications: d.certifications ? (d.certifications as string).split(',') : [],
        performance_score: Number(d.performance_score || 0),
        safety_incidents_count: Number(d.safety_incidents_count || 0),
        trips_completed: Number(d.trips_completed || 0),
        employment_date: d.employment_date as Date,
        employment_status: d.employment_status as any,
        assigned_site_id: (d.site_id as string) || undefined,
        base_hourly_rate: Number(d.base_hourly_rate || 0),
        ot_hourly_rate: Number(d.ot_hourly_rate || 0),
        photo_url: (d.photo_url as string) || undefined,
        license_front_url: (d.license_front_url as string) || undefined,
        license_back_url: (d.license_back_url as string) || undefined,
        nic_front_url: (d.nic_front_url as string) || undefined,
        nic_back_url: (d.nic_back_url as string) || undefined,
        created_at: (d.createdAt || d.created_at) as Date,
        updated_at: (d.updatedAt || d.updated_at) as Date,
      } : undefined,
    };
  }
}

const vehicleLogServiceInstance = new VehicleLogService();
export default vehicleLogServiceInstance;
