import { AppError } from '@/lib/error';
/**
 * Trip Service - Business logic for trip operations
 * Handles trip creation, status updates, trip analytics
 */

import { TripStatusEnum } from '@prisma/client';
import { CreateTripDTO, Trip } from '@/types/vehicle-management.types';
import { prisma } from '@/lib/prisma';

export class TripService {
  /**
   * Create a new trip
   */
  async createTrip(data: CreateTripDTO): Promise<Trip> {
    try {
      const trip = await prisma.vMTrip.create({
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
      });

      return this.mapTripToDTO(trip);
    } catch (error) {
      throw AppError.badRequest(`Failed to create trip: ${(error as any).message}`);
    }
  }

  /**
   * Get trip by ID
   */
  async getTrip(tripId: string): Promise<Trip | null> {
    try {
      const trip = await prisma.vMTrip.findUnique({
        where: { id: tripId },
        include: { vehicle: { select: { id: true, registration_number: true, make: true, model: true, year: true } }, driver: { select: { id: true, first_name: true, last_name: true, phone: true, email: true } } },
      });
      return trip ? this.mapTripToDTO(trip) : null;
    } catch (error) {
      throw AppError.badRequest(`Failed to fetch trip: ${(error as any).message}`);
    }
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
    try {
      const { page = 1, limit = 20, from_date, to_date, ...where } = filters;
      const skip = (page - 1) * limit;

      // Build where clause
      const whereClause: any = { ...where };
      if (from_date || to_date) {
        whereClause.actual_start_time = {
          ...(from_date && { gte: from_date }),
          ...(to_date && { lte: to_date }),
        };
      }

      const [trips, total] = await Promise.all([
        prisma.vMTrip.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { scheduled_start_time: 'desc' },
          include: { vehicle: { select: { id: true, registration_number: true, make: true, model: true, year: true } }, driver: { select: { id: true, first_name: true, last_name: true, phone: true, email: true } } },
        }),
        prisma.vMTrip.count({ where: whereClause }),
      ]);

      return {
        data: trips.map(t => this.mapTripToDTO(t)),
        total,
      };
    } catch (error) {
      throw AppError.badRequest(`Failed to list trips: ${(error as any).message}`);
    }
  }

  /**
   * Start a trip
   */
  async startTrip(tripId: string, actualStartTime: Date): Promise<Trip> {
    try {
      const trip = await prisma.vMTrip.update({
        where: { id: tripId },
        data: {
          trip_status: 'IN_PROGRESS' as TripStatusEnum,
          actual_start_time: actualStartTime,
        },
        include: { vehicle: { select: { id: true, registration_number: true, make: true, model: true, year: true } }, driver: { select: { id: true, first_name: true, last_name: true, phone: true, email: true } } },
      });

      // Update vehicle status
      if (trip.vehicle_id) {
        await prisma.vMVehicle.update({
          where: { id: trip.vehicle_id },
          data: { status: 'IN_USE' },
        });
      }

      return this.mapTripToDTO(trip);
    } catch (error) {
      throw AppError.badRequest(`Failed to start trip: ${(error as any).message}`);
    }
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
    try {
      // Calculate fuel cost if we have fuel consumed
      let fuelCost = 0;
      if (fuelConsumedLiters) {
        const trip = await prisma.vMTrip.findUnique({ where: { id: tripId } });
        const vehicle = await prisma.vMVehicle.findUnique({
          where: { id: trip?.vehicle_id },
        });
        if (vehicle?.fuel_cost_per_liter) {
          fuelCost = fuelConsumedLiters * vehicle.fuel_cost_per_liter;
        }
      }

      const updatedTrip = await prisma.vMTrip.update({
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
      if (updatedTrip.vehicle_id) {
        await prisma.vMVehicle.update({
          where: { id: updatedTrip.vehicle_id },
          data: { status: 'AVAILABLE' },
        });
      }

      return this.mapTripToDTO(updatedTrip);
    } catch (error) {
      throw AppError.badRequest(`Failed to end trip: ${(error as any).message}`);
    }
  }

  /**
   * Get trips for a driver on a specific date
   */
  async getDriverDailyTrips(driverId: string, date: Date) {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const trips = await prisma.vMTrip.findMany({
        where: {
          driver_id: driverId,
          scheduled_start_time: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        orderBy: { scheduled_start_time: 'asc' },
        include: { vehicle: { select: { id: true, registration_number: true, make: true, model: true, year: true } } },
      });

      return trips.map(t => this.mapTripToDTO(t));
    } catch (error) {
      throw AppError.badRequest(`Failed to get driver daily trips: ${(error as any).message}`);
    }
  }

  /**
   * Get trip performance metrics
   */
  async getTripMetrics(tripId: string) {
    try {
      const trip = await prisma.vMTrip.findUnique({
        where: { id: tripId },
      });

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
    } catch (error) {
      throw AppError.badRequest(`Failed to get trip metrics: ${(error as any).message}`);
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private mapTripToDTO(trip: any): Trip {
    return {
      id: trip.id,
      vehicle_id: trip.vehicle_id,
      driver_id: trip.driver_id,
      start_location: {
        name: trip.start_location_name,
        lat: trip.start_location_lat,
        lng: trip.start_location_lng,
        address: trip.start_location_address,
      },
      end_location: {
        name: trip.end_location_name,
        lat: trip.end_location_lat,
        lng: trip.end_location_lng,
        address: trip.end_location_address,
      },
      scheduled_start_time: trip.scheduled_start_time,
      actual_start_time: trip.actual_start_time,
      scheduled_end_time: trip.scheduled_end_time,
      actual_end_time: trip.actual_end_time,
      planned_distance_km: trip.planned_distance_km,
      actual_distance_km: trip.actual_distance_km,
      planned_duration_minutes: trip.planned_duration_minutes,
      actual_duration_minutes: trip.actual_duration_minutes,
      trip_status: trip.trip_status as any,
      trip_type: trip.trip_type,
      fuel_consumed_liters: trip.fuel_consumed_liters,
      fuel_cost: trip.fuel_cost,
      notes: trip.notes,
      vehicle: trip.vehicle ? { id: trip.vehicle.id, registration_number: trip.vehicle.registration_number, make: trip.vehicle.make, model: trip.vehicle.model, year: trip.vehicle.year } : null,
      driver: trip.driver ? { id: trip.driver.id, first_name: trip.driver.first_name, last_name: trip.driver.last_name, phone: trip.driver.phone, email: trip.driver.email } : null,
      created_at: trip.createdAt,
      updated_at: trip.updatedAt,
    };
  }
}

export default new TripService();
