import { AppError } from '@/lib/error';
import { safe } from '@/utils/safe-await.util';
/**
 * Vehicle Service - Business logic for vehicle operations
 * Handles CRUD, status updates, location tracking, etc.
 */

import { CreateVehicleDTO, UpdateVehicleDTO, Vehicle, VehicleType, OwnershipType, VehicleStatus } from '@/types/fleet/vehicle.types';
import { prisma as db } from '@/lib/prisma';
import { UUID } from '@/types/common';

// Type-safe definitions for database rows to bypass stale IDE Prisma client generation issues.
interface DbVehicle {
  id: UUID;
  registration_number: string;
  chassis_number: string;
  engine_number: string;
  make: string;
  model: string;
  year: number;
  color: string;
  vehicle_type: string;
  ownership: string;
  status: string;
  capacity_passengers: number;
  capacity_cargo_weight_kg: number;
  capacity_cargo_volume_m3: number;
  site_id: UUID;
  current_driver_id: UUID | null;
  latitude: number | null;
  longitude: number | null;
  location_timestamp: Date | null;
  location_accuracy_meters: number | null;
  registration_date: Date;
  decommissioned_date: Date | null;
  purchase_cost: number | null;
  insurance_cost_annual: number | null;
  fuel_cost_per_liter: number | null;
  last_odometer: number;
  photo_url: string | null;
  createdAt: Date;
  updatedAt: Date;
  site?: { id: UUID; name: string } | null;
  driver?: { id: UUID; first_name: string; last_name: string; phone?: string; email?: string } | null;
}

interface DbTrip {
  actual_distance_km: number | null;
}

interface DbFuelLog {
  quantity_liters: number;
  total_cost: number;
}

// Client definition with exact types to prevent IDE missing property squiggles
interface CustomPrismaClient {
  vMVehicle: {
    create(args: unknown): Promise<unknown>;
    findUnique(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<unknown[]>;
    count(args: unknown): Promise<number>;
    update(args: unknown): Promise<unknown>;
    delete(args: unknown): Promise<unknown>;
  };
  vMGPSLocation: {
    create(args: unknown): Promise<unknown>;
  };
  vMTrip: {
    findMany(args: unknown): Promise<unknown[]>;
  };
  vMFuelLog: {
    findMany(args: unknown): Promise<unknown[]>;
  };
  vMDriver: {
    findMany(args: unknown): Promise<Array<{ id: string; first_name: string; last_name: string; phone?: string | null }>>;
  };
}

const prisma = db as unknown as CustomPrismaClient;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export class VehicleService {
  /**
   * Get list of active drivers
   */
  async getActiveDrivers(): Promise<Array<{ id: string; first_name: string; last_name: string; phone: string }>> {
    const [err, dbDrivers] = await safe(prisma.vMDriver.findMany({
      where: { employment_status: 'ACTIVE' },
      orderBy: { first_name: 'asc' },
    }));

    if (err || !dbDrivers) {
      throw AppError.badRequest(`Failed to fetch active drivers: ${getErrorMessage(err)}`);
    }

    return dbDrivers.map((d) => ({
      id: d.id,
      first_name: d.first_name,
      last_name: d.last_name,
      phone: d.phone || '',
    }));
  }

  /**
   * Create a new vehicle
   */
  async createVehicle(data: CreateVehicleDTO): Promise<Vehicle> {
    const [err, vehicle] = await safe<DbVehicle>(prisma.vMVehicle.create({
      data: {
        registration_number: data.registration_number,
        chassis_number: data.chassis_number,
        engine_number: data.engine_number,
        make: data.make,
        model: data.model,
        year: data.year,
        color: data.color,
        vehicle_type: data.vehicle_type,
        ownership: data.ownership,
        status: 'AVAILABLE',
        capacity_passengers: data.capacity_passengers,
        capacity_cargo_weight_kg: data.capacity_cargo_weight_kg,
        capacity_cargo_volume_m3: data.capacity_cargo_volume_m3,
        site_id: data.assigned_site_id,
        photo_url: data.photo_url || null,
        registration_date: new Date(),
      },
      include: { site: true, driver: { select: { id: true, first_name: true, last_name: true, phone: true, email: true } } },
    }) as Promise<DbVehicle>);

    if (err || !vehicle) {
      throw AppError.badRequest(`Failed to create vehicle: ${getErrorMessage(err)}`);
    }

    return this.mapVehicleToDTO(vehicle);
  }

  /**
   * Get vehicle by ID
   */
  async getVehicle(vehicleId: UUID): Promise<Vehicle | null> {
    const [err, vehicle] = await safe<DbVehicle | null>(prisma.vMVehicle.findUnique({
      where: { id: vehicleId },
      include: { site: true, driver: { select: { id: true, first_name: true, last_name: true, phone: true, email: true } } },
    }) as Promise<DbVehicle | null>);

    if (err) {
      throw AppError.badRequest(`Failed to fetch vehicle: ${getErrorMessage(err)}`);
    }

    return vehicle ? this.mapVehicleToDTO(vehicle) : null;
  }

  /**
   * List vehicles with filters
   */
  async listVehicles(
    filters: {
      site_id?: string;
      status?: string;
      ownership?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ data: Vehicle[]; total: number }> {
    const { page = 1, limit = 20, ...where } = filters;
    const skip = (page - 1) * limit;

    const [err, results] = await safe(Promise.all([
      prisma.vMVehicle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { site: true, driver: { select: { id: true, first_name: true, last_name: true, phone: true, email: true } } },
      }) as Promise<DbVehicle[]>,
      prisma.vMVehicle.count({ where }),
    ]));

    if (err || !results) {
      throw AppError.badRequest(`Failed to list vehicles: ${getErrorMessage(err)}`);
    }

    const [vehicles, total] = results;

    return {
      data: vehicles.map((v) => this.mapVehicleToDTO(v)),
      total,
    };
  }

  /**
   * Update vehicle
   */
  async updateVehicle(vehicleId: UUID, data: UpdateVehicleDTO): Promise<Vehicle> {
    const [err, vehicle] = await safe<DbVehicle>(prisma.vMVehicle.update({
      where: { id: vehicleId },
      data: {
        ...(data.status && { status: data.status }),
        ...(data.assigned_site_id && { site_id: data.assigned_site_id }),
        ...(data.current_driver_id !== undefined && { current_driver_id: data.current_driver_id }),
        ...(data.photo_url !== undefined && { photo_url: data.photo_url }),
        ...(data.last_odometer !== undefined && { last_odometer: data.last_odometer }),
      },
      include: { site: true, driver: { select: { id: true, first_name: true, last_name: true, phone: true, email: true } } },
    }) as Promise<DbVehicle>);

    if (err || !vehicle) {
      throw AppError.badRequest(`Failed to update vehicle: ${getErrorMessage(err)}`);
    }

    return this.mapVehicleToDTO(vehicle);
  }

  /**
   * Delete a vehicle
   */
  async deleteVehicle(vehicleId: UUID): Promise<boolean> {
    const [err] = await safe(prisma.vMVehicle.delete({
      where: { id: vehicleId },
    }));

    if (err) {
      throw AppError.badRequest(`Failed to delete vehicle: ${getErrorMessage(err)}`);
    }

    return true;
  }

  /**
   * Update vehicle GPS location
   */
  async updateVehicleLocation(
    vehicleId: UUID,
    latitude: number,
    longitude: number,
    speed?: number,
    heading?: number
  ): Promise<Vehicle> {
    // Atomic: update vehicle location + insert GPS history via fn_vehicle_location_update
    const [err] = await safe(db.$executeRaw`
      SELECT fn_vehicle_location_update(
        ${vehicleId}::uuid,
        ${latitude}::numeric,
        ${longitude}::numeric,
        ${speed ?? null}::numeric,
        ${heading ?? null}::numeric,
        10
      )
    `);

    if (err) {
      throw AppError.badRequest(`Failed to update vehicle location: ${getErrorMessage(err)}`);
    }

    // Fetch updated vehicle for DTO mapping
    const [fetchErr, vehicle] = await safe<DbVehicle | null>(db.vMVehicle.findUnique({
      where: { id: vehicleId },
      include: { site: true, driver: { select: { id: true, first_name: true, last_name: true, phone: true, email: true } } },
    }) as Promise<DbVehicle | null>);

    if (fetchErr || !vehicle) {
      throw AppError.badRequest(`Failed to fetch vehicle after location update: ${getErrorMessage(fetchErr)}`);
    }

    return this.mapVehicleToDTO(vehicle);
  }

  /**
   * Get vehicle current location
   */
  async getVehicleLocation(vehicleId: UUID): Promise<{
    latitude: number;
    longitude: number;
    timestamp: Date;
    accuracy: number;
  } | null> {
    const [err, vehicle] = await safe<DbVehicle | null>(prisma.vMVehicle.findUnique({
      where: { id: vehicleId },
    }) as Promise<DbVehicle | null>);

    if (err) {
      throw AppError.badRequest(`Failed to get vehicle location: ${getErrorMessage(err)}`);
    }

    if (!vehicle || !vehicle.latitude || !vehicle.longitude) {
      return null;
    }

    return {
      latitude: vehicle.latitude,
      longitude: vehicle.longitude,
      timestamp: vehicle.location_timestamp || new Date(),
      accuracy: vehicle.location_accuracy_meters || 10,
    };
  }

  /**
   * Get vehicle utilization report via DB function fn_vehicle_utilization_summary().
   * Replaces JS .reduce() loops with single SQL aggregate query.
   */
  async getVehicleUtilization(vehicleId: UUID, fromDate: Date, toDate: Date) {
    const [err, result] = await safe(db.$queryRaw<{
      total_trips: number;
      total_distance_km: number;
      total_fuel_consumed_liters: number;
      total_fuel_cost: number;
      average_efficiency_km_per_liter: number;
      cost_per_km: number;
    }[]>`
      SELECT * FROM fn_vehicle_utilization_summary(
        ${vehicleId}::uuid,
        ${fromDate}::TIMESTAMP,
        ${toDate}::TIMESTAMP
      )
    `);

    if (err || !result || !Array.isArray(result) || result.length === 0) {
      throw AppError.badRequest(`Failed to calculate vehicle utilization: ${getErrorMessage(err)}`);
    }

    const r = result[0];

    return {
      vehicle_id: vehicleId,
      total_trips: Number(r.total_trips),
      total_distance_km: Number(r.total_distance_km),
      total_fuel_consumed_liters: Number(r.total_fuel_consumed_liters),
      average_efficiency_km_per_liter: Number(r.average_efficiency_km_per_liter),
      total_fuel_cost: Number(r.total_fuel_cost),
      cost_per_km: Number(r.cost_per_km),
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private mapVehicleToDTO(vehicle: DbVehicle): Vehicle {
    return {
      id: vehicle.id,
      registration_number: vehicle.registration_number,
      chassis_number: vehicle.chassis_number,
      engine_number: vehicle.engine_number,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color,
      vehicle_type: vehicle.vehicle_type as unknown as VehicleType,
      ownership: vehicle.ownership as unknown as OwnershipType,
      status: vehicle.status as unknown as VehicleStatus,
      capacity_passengers: vehicle.capacity_passengers,
      capacity_cargo_weight_kg: vehicle.capacity_cargo_weight_kg,
      capacity_cargo_volume_m3: vehicle.capacity_cargo_volume_m3,
      assigned_site_id: vehicle.site_id,
      current_driver_id: vehicle.current_driver_id || undefined,
      current_location: {
        lat: vehicle.latitude || 0,
        lng: vehicle.longitude || 0,
        timestamp: vehicle.location_timestamp || new Date(),
        accuracy: vehicle.location_accuracy_meters || 10,
      },
      registration_date: vehicle.registration_date,
      decommissioned_date: vehicle.decommissioned_date || undefined,
      purchase_cost: vehicle.purchase_cost || undefined,
      insurance_cost_annual: vehicle.insurance_cost_annual || undefined,
      fuel_cost_per_liter: vehicle.fuel_cost_per_liter || undefined,
      last_odometer: vehicle.last_odometer || 0,
      photo_url: vehicle.photo_url || undefined,
      site: vehicle.site ? { id: vehicle.site.id, name: vehicle.site.name } : null,
      driver: vehicle.driver ? { id: vehicle.driver.id, first_name: vehicle.driver.first_name, last_name: vehicle.driver.last_name, phone: vehicle.driver.phone, email: vehicle.driver.email } : null,
      created_at: vehicle.createdAt,
      updated_at: vehicle.updatedAt,
    };
  }
}

const vehicleServiceInstance = new VehicleService();
export default vehicleServiceInstance;
