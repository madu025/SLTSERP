/**
 * Vehicle Service - Business logic for vehicle operations
 * Handles CRUD, status updates, location tracking, etc.
 */

import { VehicleStatusEnum, OwnershipTypeEnum, VehicleTypeEnum } from '@prisma/client';
import { CreateVehicleDTO, UpdateVehicleDTO, Vehicle } from '@/types/vehicle-management.types';
import { prisma } from '@/lib/prisma';

export class VehicleService {
  /**
   * Create a new vehicle
   */
  async createVehicle(data: CreateVehicleDTO): Promise<Vehicle> {
    try {
      const vehicle = await prisma.vMVehicle.create({
        data: {
          registration_number: data.registration_number,
          chassis_number: data.chassis_number,
          engine_number: data.engine_number,
          make: data.make,
          model: data.model,
          year: data.year,
          color: data.color,
          vehicle_type: data.vehicle_type as VehicleTypeEnum,
          ownership: data.ownership as OwnershipTypeEnum,
          status: 'AVAILABLE' as VehicleStatusEnum,
          capacity_passengers: data.capacity_passengers,
          capacity_cargo_weight_kg: data.capacity_cargo_weight_kg,
          capacity_cargo_volume_m3: data.capacity_cargo_volume_m3,
          site_id: data.assigned_site_id,
          registration_date: new Date(),
        },
        include: { site: true, driver: { select: { id: true, first_name: true, last_name: true, phone: true, email: true } } },
      });

      return this.mapVehicleToDTO(vehicle);
    } catch (error) {
      throw new Error(`Failed to create vehicle: ${(error as any).message}`);
    }
  }

  /**
   * Get vehicle by ID
   */
  async getVehicle(vehicleId: string): Promise<Vehicle | null> {
    try {
      const vehicle = await prisma.vMVehicle.findUnique({
        where: { id: vehicleId },
        include: { site: true, driver: { select: { id: true, first_name: true, last_name: true, phone: true, email: true } } },
      });
      return vehicle ? this.mapVehicleToDTO(vehicle) : null;
    } catch (error) {
      throw new Error(`Failed to fetch vehicle: ${(error as any).message}`);
    }
  }

  /**
   * List vehicles with filters
   */
  async listVehicles(
    filters: {
      site_id?: string;
      status?: VehicleStatusEnum;
      ownership?: OwnershipTypeEnum;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ data: Vehicle[]; total: number }> {
    try {
      const { page = 1, limit = 20, ...where } = filters;
      const skip = (page - 1) * limit;

      const [vehicles, total] = await Promise.all([
        prisma.vMVehicle.findMany({
          where: where as any,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: { site: true, driver: { select: { id: true, first_name: true, last_name: true, phone: true, email: true } } },
        }),
        prisma.vMVehicle.count({ where: where as any }),
      ]);

      return {
        data: vehicles.map(v => this.mapVehicleToDTO(v)),
        total,
      };
    } catch (error) {
      throw new Error(`Failed to list vehicles: ${(error as any).message}`);
    }
  }

  /**
   * Update vehicle
   */
  async updateVehicle(vehicleId: string, data: UpdateVehicleDTO): Promise<Vehicle> {
    try {
      const vehicle = await prisma.vMVehicle.update({
        where: { id: vehicleId },
        data: {
          ...(data.status && { status: data.status as VehicleStatusEnum }),
          ...(data.assigned_site_id && { site_id: data.assigned_site_id }),
          ...(data.current_driver_id !== undefined && { current_driver_id: data.current_driver_id }),
        },
        include: { site: true, driver: { select: { id: true, first_name: true, last_name: true, phone: true, email: true } } },
      });
      return this.mapVehicleToDTO(vehicle);
    } catch (error) {
      throw new Error(`Failed to update vehicle: ${(error as any).message}`);
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
      throw new Error(`Failed to delete vehicle: ${(error as any).message}`);
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
      const vehicle = await prisma.vMVehicle.update({
        where: { id: vehicleId },
        data: {
          latitude,
          longitude,
          location_timestamp: new Date(),
          location_accuracy_meters: 10, // Default accuracy in meters
        },
        include: { site: true, driver: { select: { id: true, first_name: true, last_name: true, phone: true, email: true } } },
      });

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
      throw new Error(`Failed to update vehicle location: ${(error as any).message}`);
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
      const vehicle = await prisma.vMVehicle.findUnique({
        where: { id: vehicleId },
      });

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
      throw new Error(`Failed to get vehicle location: ${(error as any).message}`);
    }
  }

  /**
   * Get vehicle utilization report
   */
  async getVehicleUtilization(vehicleId: string, fromDate: Date, toDate: Date) {
    try {
      const trips = await prisma.vMTrip.findMany({
        where: {
          vehicle_id: vehicleId,
          actual_start_time: {
            gte: fromDate,
            lte: toDate,
          },
          trip_status: 'COMPLETED',
        },
      });

      const fuelLogs = await prisma.vMFuelLog.findMany({
        where: {
          vehicle_id: vehicleId,
          fuel_date: {
            gte: fromDate,
            lte: toDate,
          },
        },
      });

      const totalDistance = trips.reduce((sum, trip) => sum + (trip.actual_distance_km || 0), 0);
      const totalFuel = fuelLogs.reduce((sum, log) => sum + log.quantity_liters, 0);
      const totalFuelCost = fuelLogs.reduce((sum, log) => sum + log.total_cost, 0);
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
      throw new Error(`Failed to calculate vehicle utilization: ${(error as any).message}`);
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private mapVehicleToDTO(vehicle: any): Vehicle {
    return {
      id: vehicle.id,
      registration_number: vehicle.registration_number,
      chassis_number: vehicle.chassis_number,
      engine_number: vehicle.engine_number,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color,
      vehicle_type: vehicle.vehicle_type as any,
      ownership: vehicle.ownership as any,
      status: vehicle.status as any,
      capacity_passengers: vehicle.capacity_passengers,
      capacity_cargo_weight_kg: vehicle.capacity_cargo_weight_kg,
      capacity_cargo_volume_m3: vehicle.capacity_cargo_volume_m3,
      assigned_site_id: vehicle.site_id,
      current_driver_id: vehicle.current_driver_id,
      current_location: {
        lat: vehicle.latitude || 0,
        lng: vehicle.longitude || 0,
        timestamp: vehicle.location_timestamp || new Date(),
        accuracy: vehicle.location_accuracy_meters || 10,
      },
      registration_date: vehicle.registration_date,
      decommissioned_date: vehicle.decommissioned_date,
      purchase_cost: vehicle.purchase_cost,
      insurance_cost_annual: vehicle.insurance_cost_annual,
      fuel_cost_per_liter: vehicle.fuel_cost_per_liter,
      site: vehicle.site ? { id: vehicle.site.id, name: vehicle.site.name } : null,
      driver: vehicle.driver ? { id: vehicle.driver.id, first_name: vehicle.driver.first_name, last_name: vehicle.driver.last_name, phone: vehicle.driver.phone, email: vehicle.driver.email } : null,
      created_at: vehicle.createdAt,
      updated_at: vehicle.updatedAt,
    };
  }
}

export default new VehicleService();
