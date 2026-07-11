/**
 * Vehicle Service - Business logic for vehicle operations
 * Handles CRUD, status updates, location tracking, etc.
 */

import { CreateVehicleDTO, UpdateVehicleDTO, Vehicle, VehicleType, OwnershipType, VehicleStatus } from '@/types/vehicle-management.types';
import { prisma as db } from '@/lib/prisma';

// Type-safe definitions for database rows to bypass stale IDE Prisma client generation issues.
interface DbVehicle {
  id: string;
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
  site_id: string;
  current_driver_id: string | null;
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
  site?: { id: string; name: string } | null;
  driver?: { id: string; first_name: string; last_name: string; phone?: string; email?: string } | null;
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
    try {
      const dbDrivers = await (db as any).vMDriver.findMany({
        where: { employment_status: 'ACTIVE' },
        orderBy: { first_name: 'asc' },
      });
      return dbDrivers.map((d: any) => ({
        id: d.id,
        first_name: d.first_name,
        last_name: d.last_name,
        phone: d.phone || '',
      }));
    } catch (error) {
      throw new Error(`Failed to fetch active drivers: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Create a new vehicle
   */
  async createVehicle(data: CreateVehicleDTO): Promise<Vehicle> {
    try {
      const vehicle = (await prisma.vMVehicle.create({
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
      })) as DbVehicle;

      return this.mapVehicleToDTO(vehicle);
    } catch (error) {
      throw new Error(`Failed to create vehicle: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get vehicle by ID
   */
  async getVehicle(vehicleId: string): Promise<Vehicle | null> {
    try {
      const vehicle = (await prisma.vMVehicle.findUnique({
        where: { id: vehicleId },
        include: { site: true, driver: { select: { id: true, first_name: true, last_name: true, phone: true, email: true } } },
      })) as DbVehicle | null;
      return vehicle ? this.mapVehicleToDTO(vehicle) : null;
    } catch (error) {
      throw new Error(`Failed to fetch vehicle: ${getErrorMessage(error)}`);
    }
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
    try {
      const { page = 1, limit = 20, ...where } = filters;
      const skip = (page - 1) * limit;

      const [vehicles, total] = await Promise.all([
        prisma.vMVehicle.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: { site: true, driver: { select: { id: true, first_name: true, last_name: true, phone: true, email: true } } },
        }) as Promise<DbVehicle[]>,
        prisma.vMVehicle.count({ where }),
      ]);

      return {
        data: vehicles.map((v) => this.mapVehicleToDTO(v)),
        total,
      };
    } catch (error) {
      throw new Error(`Failed to list vehicles: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Update vehicle
   */
  async updateVehicle(vehicleId: string, data: UpdateVehicleDTO): Promise<Vehicle> {
    try {
      const vehicle = (await prisma.vMVehicle.update({
        where: { id: vehicleId },
        data: {
          ...(data.status && { status: data.status }),
          ...(data.assigned_site_id && { site_id: data.assigned_site_id }),
          ...(data.current_driver_id !== undefined && { current_driver_id: data.current_driver_id }),
          ...(data.photo_url !== undefined && { photo_url: data.photo_url }),
          ...(data.last_odometer !== undefined && { last_odometer: data.last_odometer }),
        },
        include: { site: true, driver: { select: { id: true, first_name: true, last_name: true, phone: true, email: true } } },
      })) as DbVehicle;
      return this.mapVehicleToDTO(vehicle);
    } catch (error) {
      throw new Error(`Failed to update vehicle: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Delete a vehicle
   */
  async deleteVehicle(vehicleId: string): Promise<boolean> {
    try {
      await prisma.vMVehicle.delete({
        where: { id: vehicleId },
      });
      return true;
    } catch (error) {
      throw new Error(`Failed to delete vehicle: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Update vehicle GPS location
   */
  async updateVehicleLocation(
    vehicleId: string,
    latitude: number,
    longitude: number,
    speed?: number,
    heading?: number
  ): Promise<Vehicle> {
    try {
      const vehicle = (await prisma.vMVehicle.update({
        where: { id: vehicleId },
        data: {
          latitude,
          longitude,
          location_timestamp: new Date(),
          location_accuracy_meters: 10,
        },
        include: { site: true, driver: { select: { id: true, first_name: true, last_name: true, phone: true, email: true } } },
      })) as DbVehicle;

      // Also log GPS location
      await prisma.vMGPSLocation.create({
        data: {
          vehicle_id: vehicleId,
          latitude,
          longitude,
          speed_kmh: speed,
          heading,
          recorded_at: new Date(),
        },
      });

      return this.mapVehicleToDTO(vehicle);
    } catch (error) {
      throw new Error(`Failed to update vehicle location: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get vehicle current location
   */
  async getVehicleLocation(vehicleId: string): Promise<{
    latitude: number;
    longitude: number;
    timestamp: Date;
    accuracy: number;
  } | null> {
    try {
      const vehicle = (await prisma.vMVehicle.findUnique({
        where: { id: vehicleId },
      })) as DbVehicle | null;

      if (!vehicle || !vehicle.latitude || !vehicle.longitude) {
        return null;
      }

      return {
        latitude: vehicle.latitude,
        longitude: vehicle.longitude,
        timestamp: vehicle.location_timestamp || new Date(),
        accuracy: vehicle.location_accuracy_meters || 10,
      };
    } catch (error) {
      throw new Error(`Failed to get vehicle location: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get vehicle utilization report
   */
  async getVehicleUtilization(vehicleId: string, fromDate: Date, toDate: Date) {
    try {
      const trips = (await prisma.vMTrip.findMany({
        where: {
          vehicle_id: vehicleId,
          actual_start_time: {
            gte: fromDate,
            lte: toDate,
          },
          trip_status: 'COMPLETED',
        },
      })) as DbTrip[];

      const fuelLogs = (await prisma.vMFuelLog.findMany({
        where: {
          vehicle_id: vehicleId,
          fuel_date: {
            gte: fromDate,
            lte: toDate,
          },
        },
      })) as DbFuelLog[];

      const totalDistance = trips.reduce((sum: number, trip: DbTrip) => sum + (trip.actual_distance_km || 0), 0);
      const totalFuel = fuelLogs.reduce((sum: number, log: DbFuelLog) => sum + log.quantity_liters, 0);
      const totalFuelCost = fuelLogs.reduce((sum: number, log: DbFuelLog) => sum + log.total_cost, 0);
      const avgEfficiency = totalDistance > 0 ? totalDistance / totalFuel : 0;

      return {
        vehicle_id: vehicleId,
        total_trips: trips.length,
        total_distance_km: totalDistance,
        total_fuel_consumed_liters: totalFuel,
        average_efficiency_km_per_liter: parseFloat(avgEfficiency.toFixed(2)),
        total_fuel_cost: parseFloat(totalFuelCost.toFixed(2)),
        cost_per_km: parseFloat((totalFuelCost / totalDistance).toFixed(2)),
      };
    } catch (error) {
      throw new Error(`Failed to calculate vehicle utilization: ${getErrorMessage(error)}`);
    }
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
