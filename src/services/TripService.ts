import { AppError } from '@/lib/error';
/**
 * Trip Service - Business logic for trip operations
 * Handles trip creation, status updates, trip analytics
 */

import { TripStatusEnum, Prisma } from '@prisma/client';
import { CreateTripDTO, Trip } from '@/types/vehicle-management.types';
import { prisma } from '@/lib/prisma';
import { safe } from '@/utils/safe-await.util';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export class TripService {
  /**
   * Create a new trip
   */
  async createTrip(data: CreateTripDTO): Promise<Trip> {
    const [err, trip] = await safe(prisma.vMTrip.create({
      data: {
        vehicle_id: data.vehicle_id,
        driver_id: data.driver_id,
        start_location_name: data.start_location.name,
        start_location_lat: data.start_location.lat,
        start_location_lng: data.start_location.lng,
        start_location_address: data.start_location.address,
        end_location_name: data.end_location.name,
        end_location_lat: data.end_location.lat,
        end_location_lng: data.end_location.lng,
        end_location_address: data.end_location.address,
        scheduled_start_time: data.scheduled_start_time,
        scheduled_end_time: data.scheduled_end_time,
        trip_type: data.trip_type,
        trip_status: 'PLANNED' as TripStatusEnum,
      },
      include: { vehicle: { select: { id: true, registration_number: true, make: true, model: true, year: true } }, driver: { select: { id: true, first_name: true, last_name: true, phone: true, email: true } } },
    }));

    if (err || !trip) {
      throw AppError.badRequest(`Failed to create trip: ${getErrorMessage(err)}`);
    }

    return this.mapTripToDTO(trip);
  }

  /**
   * Get trip by ID
   */
  async getTrip(tripId: string): Promise<Trip | null> {
    const [err, trip] = await safe(prisma.vMTrip.findUnique({
      where: { id: tripId },
      include: { vehicle: { select: { id: true, registration_number: true, make: true, model: true, year: true } }, driver: { select: { id: true, first_name: true, last_name: true, phone: true, email: true } } },
    }));

    if (err) {
      throw AppError.badRequest(`Failed to fetch trip: ${getErrorMessage(err)}`);
    }

    return trip ? this.mapTripToDTO(trip) : null;
  }

  /**
   * List trips with filters
   */
  async listTrips(filters: {
    vehicle_id?: string;
    driver_id?: string;
    trip_status?: TripStatusEnum;
    from_date?: Date;
    to_date?: Date;
    page?: number;
    limit?: number;
  } = {}): Promise<{ data: Trip[]; total: number }> {
    const { page = 1, limit = 20, from_date, to_date, ...where } = filters;
    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause: Prisma.VMTripWhereInput = { ...where };
    if (from_date || to_date) {
      whereClause.actual_start_time = {
        ...(from_date && { gte: from_date }),
        ...(to_date && { lte: to_date }),
      };
    }

    const [err, results] = await safe(Promise.all([
      prisma.vMTrip.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { scheduled_start_time: 'desc' },
        include: { vehicle: { select: { id: true, registration_number: true, make: true, model: true, year: true } }, driver: { select: { id: true, first_name: true, last_name: true, phone: true, email: true } } },
      }),
      prisma.vMTrip.count({ where: whereClause }),
    ]));

    if (err || !results) {
      throw AppError.badRequest(`Failed to list trips: ${getErrorMessage(err)}`);
    }

    const [trips, total] = results;

    return {
      data: trips.map((t) => this.mapTripToDTO(t as unknown as Record<string, unknown>)),
      total,
    };
  }

  /**
   * Start a trip
   */
  async startTrip(tripId: string, actualStartTime: Date): Promise<Trip> {
    const [err, trip] = await safe(prisma.$transaction(async (tx) => {
      const updatedTrip = await tx.vMTrip.update({
        where: { id: tripId },
        data: {
          trip_status: 'IN_PROGRESS' as TripStatusEnum,
          actual_start_time: actualStartTime,
        },
        include: { vehicle: { select: { id: true, registration_number: true, make: true, model: true, year: true } }, driver: { select: { id: true, first_name: true, last_name: true, phone: true, email: true } } },
      });

      // Update vehicle status
      if (updatedTrip.vehicle_id) {
        await tx.vMVehicle.update({
          where: { id: updatedTrip.vehicle_id },
          data: { status: 'IN_USE' },
        });
      }

      return updatedTrip;
    }));

    if (err || !trip) {
      throw AppError.badRequest(`Failed to start trip: ${getErrorMessage(err)}`);
    }

    return this.mapTripToDTO(trip as unknown as Record<string, unknown>);
  }

  /**
   * End a trip
   */
  async endTrip(
    tripId: string,
    actualEndTime: Date,
    actualDistanceKm?: number,
    fuelConsumedLiters?: number
  ): Promise<Trip> {
    const [err, updatedTrip] = await safe(prisma.$transaction(async (tx) => {
      // Calculate fuel cost if we have fuel consumed
      let fuelCost = 0;
      if (fuelConsumedLiters) {
        const trip = await tx.vMTrip.findUnique({ where: { id: tripId } });
        if (trip?.vehicle_id) {
          const vehicle = await tx.vMVehicle.findUnique({
            where: { id: trip.vehicle_id },
          });
          if (vehicle?.fuel_cost_per_liter) {
            fuelCost = fuelConsumedLiters * vehicle.fuel_cost_per_liter;
          }
        }
      }

      const completedTrip = await tx.vMTrip.update({
        where: { id: tripId },
        data: {
          trip_status: 'COMPLETED' as TripStatusEnum,
          actual_end_time: actualEndTime,
          actual_distance_km: actualDistanceKm,
          fuel_consumed_liters: fuelConsumedLiters,
          fuel_cost: fuelCost,
        },
        include: { vehicle: { select: { id: true, registration_number: true, make: true, model: true, year: true } }, driver: { select: { id: true, first_name: true, last_name: true, phone: true, email: true } } },
      });

      // Update vehicle status back to available
      if (completedTrip.vehicle_id) {
        await tx.vMVehicle.update({
          where: { id: completedTrip.vehicle_id },
          data: { status: 'AVAILABLE' },
        });
      }

      return completedTrip;
    }));

    if (err || !updatedTrip) {
      throw AppError.badRequest(`Failed to end trip: ${getErrorMessage(err)}`);
    }

    return this.mapTripToDTO(updatedTrip as unknown as Record<string, unknown>);
  }

  /**
   * Get trips for a driver on a specific date
   */
  async getDriverDailyTrips(driverId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const [err, trips] = await safe(prisma.vMTrip.findMany({
      where: {
        driver_id: driverId,
        scheduled_start_time: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { scheduled_start_time: 'asc' },
      include: { vehicle: { select: { id: true, registration_number: true, make: true, model: true, year: true } } },
    }));

    if (err) {
      throw AppError.badRequest(`Failed to get driver daily trips: ${getErrorMessage(err)}`);
    }

    return (trips || []).map((t) => this.mapTripToDTO(t as unknown as Record<string, unknown>));
  }

  /**
   * Get trip performance metrics
   */
  async getTripMetrics(tripId: string) {
    const [err, trip] = await safe(prisma.vMTrip.findUnique({
      where: { id: tripId },
    }));

    if (err) {
      throw AppError.badRequest(`Failed to get trip metrics: ${getErrorMessage(err)}`);
    }

    if (!trip) return null;

    const duration = trip.actual_end_time && trip.actual_start_time
      ? (trip.actual_end_time.getTime() - trip.actual_start_time.getTime()) / (1000 * 60) // minutes
      : null;

    const avgSpeed = trip.actual_distance_km && duration
      ? (trip.actual_distance_km / duration) * 60 // km/h
      : null;

    const fuelEfficiency = trip.actual_distance_km && trip.fuel_consumed_liters
      ? trip.actual_distance_km / trip.fuel_consumed_liters // km/liter
      : null;

    return {
      trip_id: tripId,
      actual_distance_km: trip.actual_distance_km || 0,
      actual_duration_minutes: duration,
      average_speed_kmh: avgSpeed ? parseFloat(avgSpeed.toFixed(2)) : null,
      fuel_consumed_liters: trip.fuel_consumed_liters || 0,
      fuel_efficiency_km_per_liter: fuelEfficiency ? parseFloat(fuelEfficiency.toFixed(2)) : null,
      fuel_cost: trip.fuel_cost || 0,
      trip_status: trip.trip_status,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private mapTripToDTO(trip: Record<string, unknown>): Trip {
    const startLoc = (trip.start_location as Record<string, unknown>) || {};
    const endLoc = (trip.end_location as Record<string, unknown>) || {};
    const vehicleObj = trip.vehicle as { id: string; registration_number: string; make: string; model: string; year: number } | null | undefined;
    const driverObj = trip.driver as { id: string; first_name: string; last_name: string; phone?: string | null; email?: string | null } | null | undefined;

    return {
      id: trip.id as string,
      vehicle_id: trip.vehicle_id as string,
      driver_id: trip.driver_id as string,
      start_location: {
        name: (trip.start_location_name || startLoc.name || '') as string,
        lat: Number(trip.start_location_lat ?? startLoc.lat ?? 0),
        lng: Number(trip.start_location_lng ?? startLoc.lng ?? 0),
        address: (trip.start_location_address || startLoc.address || '') as string,
      },
      end_location: {
        name: (trip.end_location_name || endLoc.name || '') as string,
        lat: Number(trip.end_location_lat ?? endLoc.lat ?? 0),
        lng: Number(trip.end_location_lng ?? endLoc.lng ?? 0),
        address: (trip.end_location_address || endLoc.address || '') as string,
      },
      scheduled_start_time: trip.scheduled_start_time as Date,
      actual_start_time: (trip.actual_start_time as Date) || undefined,
      scheduled_end_time: trip.scheduled_end_time as Date,
      actual_end_time: (trip.actual_end_time as Date) || undefined,
      planned_distance_km: (trip.planned_distance_km as number) || undefined,
      actual_distance_km: (trip.actual_distance_km as number) || undefined,
      planned_duration_minutes: (trip.planned_duration_minutes as number) || undefined,
      actual_duration_minutes: (trip.actual_duration_minutes as number) || undefined,
      trip_status: trip.trip_status as unknown as import('@/types/vehicle-management.types').TripStatus,
      trip_type: trip.trip_type as any,
      fuel_consumed_liters: (trip.fuel_consumed_liters as number) || undefined,
      fuel_cost: (trip.fuel_cost as number) || undefined,
      notes: (trip.notes as string) || undefined,
      vehicle: vehicleObj ? { id: vehicleObj.id, registration_number: vehicleObj.registration_number, make: vehicleObj.make, model: vehicleObj.model, year: vehicleObj.year } : null,
      driver: driverObj ? { id: driverObj.id, first_name: driverObj.first_name, last_name: driverObj.last_name, phone: driverObj.phone || '', email: driverObj.email || '' } : null,
      created_at: (trip.createdAt || trip.created_at) as Date,
      updated_at: (trip.updatedAt || trip.updated_at) as Date,
    };
  }
}

const tripServiceInstance = new TripService();
export default tripServiceInstance;
