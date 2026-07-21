import { AppError } from '@/lib/error';
/**
 * Vehicle Log Service - Business logic for vehicle usage/duty logs
 * Handles dynamic driver check-in, check-out, and odometer auditing
 */

import { prisma as db } from '@/lib/prisma';
import { VehicleLog, CreateVehicleLogDTO, EndVehicleLogDTO } from '@/types/vehicle-management.types';

// Workaround for IDE/Language Server caching issues with dynamic extended PrismaClient types.

const prisma = db as any;

export class VehicleLogService {
  /**
   * Get the current active usage log for a vehicle
   */
  async getActiveLog(vehicleId: string): Promise<VehicleLog | null> {
    try {
      const log = await prisma.vMVehicleLog.findFirst({
        where: {
          vehicle_id: vehicleId,
          status: 'ACTIVE',
        },
        include: {
          vehicle: { include: { site: true } },
          driver: true,
        },
      });

      return log ? this.mapLogToDTO(log) : null;
    } catch (error) {
      throw AppError.badRequest(`Failed to get active log: ${(error as Error).message}`);
    }
  }

  /**
   * Start a new usage log (Check-in / Duty On)
   */
  async startUsageLog(data: CreateVehicleLogDTO): Promise<VehicleLog> {
    try {
      // 1. Assert no active log exists
      const activeLog = await prisma.vMVehicleLog.findFirst({
        where: {
          vehicle_id: data.vehicle_id,
          status: 'ACTIVE',
        },
      });

      if (activeLog) {
        throw AppError.badRequest('Vehicle is already checked out and in use.');
      }

      // 2. Fetch vehicle to verify expected odometer
      const vehicle = await prisma.vMVehicle.findUnique({
        where: { id: data.vehicle_id },
      });

      if (!vehicle) {
        throw AppError.badRequest('Vehicle not found.');
      }

      // 3. Determine odometer mismatch
      const expectedOdometer = vehicle.last_odometer;
      const odometerMismatch = data.start_odometer !== expectedOdometer;

      // 4. Create the log in a transaction
      const log = await prisma.$transaction(async (tx: any) => {
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
      });

      return this.mapLogToDTO(log);
    } catch (error) {
      throw AppError.badRequest(`Failed to start vehicle log: ${(error as Error).message}`);
    }
  }

  /**
   * End the active usage log (Check-out / Duty Off)
   */
  async endUsageLog(vehicleId: string, data: EndVehicleLogDTO): Promise<VehicleLog> {
    try {
      // 1. Get the active log
      const activeLog = await prisma.vMVehicleLog.findFirst({
        where: {
          vehicle_id: vehicleId,
          status: 'ACTIVE',
        },
      });

      if (!activeLog) {
        throw AppError.badRequest('No active usage log found for this vehicle.');
      }

      if (data.end_odometer < activeLog.start_odometer) {
        throw AppError.badRequest(`End odometer (${data.end_odometer}) cannot be less than start odometer (${activeLog.start_odometer}).`);
      }

      // 2. Complete the log in a transaction
      const log = await prisma.$transaction(async (tx: any) => {
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
      });

      return this.mapLogToDTO(log);
    } catch (error) {
      throw AppError.badRequest(`Failed to end vehicle log: ${(error as Error).message}`);
    }
  }

  /**
   * Map database log object to DTO
   */
  private mapLogToDTO(log: any): VehicleLog {
    return {
      id: log.id,
      vehicle_id: log.vehicle_id,
      driver_id: log.driver_id,
      start_time: log.start_time,
      end_time: log.end_time || undefined,
      start_odometer: log.start_odometer,
      end_odometer: log.end_odometer || undefined,
      expected_start_odometer: log.expected_start_odometer,
      odometer_mismatch: log.odometer_mismatch,
      mismatch_reason: log.mismatch_reason || undefined,
      passengers: log.passengers || undefined,
      status: log.status as 'ACTIVE' | 'COMPLETED',
      created_at: log.createdAt,
      updated_at: log.updatedAt,
      vehicle: log.vehicle ? {
        id: log.vehicle.id,
        registration_number: log.vehicle.registration_number,
        chassis_number: log.vehicle.chassis_number,
        engine_number: log.vehicle.engine_number,
        make: log.vehicle.make,
        model: log.vehicle.model,
        year: log.vehicle.year,
        color: log.vehicle.color,
        vehicle_type: log.vehicle.vehicle_type,
        ownership: log.vehicle.ownership,
        status: log.vehicle.status,
        capacity_passengers: log.vehicle.capacity_passengers,
        capacity_cargo_weight_kg: log.vehicle.capacity_cargo_weight_kg,
        capacity_cargo_volume_m3: log.vehicle.capacity_cargo_volume_m3,
        assigned_site_id: log.vehicle.site_id,
        current_driver_id: log.vehicle.current_driver_id,
        current_location: {
          lat: log.vehicle.latitude || 0,
          lng: log.vehicle.longitude || 0,
          timestamp: log.vehicle.location_timestamp || new Date(),
          accuracy: log.vehicle.location_accuracy_meters || 10,
        },
        registration_date: log.vehicle.registration_date,
        decommissioned_date: log.vehicle.decommissioned_date,
        purchase_cost: log.vehicle.purchase_cost,
        insurance_cost_annual: log.vehicle.insurance_cost_annual,
        fuel_cost_per_liter: log.vehicle.fuel_cost_per_liter,
        last_odometer: log.vehicle.last_odometer || 0,
        photo_url: log.vehicle.photo_url || undefined,
        site: log.vehicle.site ? { id: log.vehicle.site.id, name: log.vehicle.site.name } : null,
        created_at: log.vehicle.createdAt,
        updated_at: log.vehicle.updatedAt,
      } : undefined,
      driver: log.driver ? {
        id: log.driver.id,
        first_name: log.driver.first_name,
        last_name: log.driver.last_name,
        email: log.driver.email,
        phone: log.driver.phone,
        date_of_birth: log.driver.date_of_birth,
        address: {
          street: log.driver.street,
          city: log.driver.city,
          state: log.driver.state,
          postal_code: log.driver.postal_code,
          country: log.driver.country,
        },
        license_number: log.driver.license_number,
        license_issue_date: log.driver.license_issue_date,
        license_expiry_date: log.driver.license_expiry_date,
        license_class: log.driver.license_class,
        medical_fitness_status: log.driver.medical_fitness_status,
        medical_fitness_expiry: log.driver.medical_fitness_expiry || undefined,
        certifications: log.driver.certifications ? log.driver.certifications.split(',') : [],
        performance_score: log.driver.performance_score,
        safety_incidents_count: log.driver.safety_incidents_count,
        trips_completed: log.driver.trips_completed,
        employment_date: log.driver.employment_date,
        employment_status: log.driver.employment_status,
        assigned_site_id: log.driver.site_id || undefined,
        base_hourly_rate: log.driver.base_hourly_rate,
        ot_hourly_rate: log.driver.ot_hourly_rate,
        photo_url: log.driver.photo_url || undefined,
        license_front_url: log.driver.license_front_url || undefined,
        license_back_url: log.driver.license_back_url || undefined,
        nic_front_url: log.driver.nic_front_url || undefined,
        nic_back_url: log.driver.nic_back_url || undefined,
        created_at: log.driver.createdAt,
        updated_at: log.driver.updatedAt,
      } : undefined,
    };
  }
}

const vehicleLogServiceInstance = new VehicleLogService();
export default vehicleLogServiceInstance;
