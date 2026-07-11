import { z } from 'zod';

export const locationSchema = z.object({
  name: z.string().min(1, 'Location name is required'),
  lat: z.number(),
  lng: z.number(),
  address: z.string().optional(),
});

export const createTripSchema = z.object({
  vehicle_id: z.string().min(1, 'Vehicle ID is required'),
  driver_id: z.string().min(1, 'Driver ID is required'),
  start_location: locationSchema,
  end_location: locationSchema,
  scheduled_start_time: z.string().min(1, 'Scheduled start time is required'),
  scheduled_end_time: z.string().min(1, 'Scheduled end time is required'),
  trip_type: z.enum(['DELIVERY', 'PICKUP', 'INSPECTION', 'MAINTENANCE', 'OTHER']),
});

export const startTripSchema = z.object({
  actual_start_time: z.string().optional(),
});

export const endTripSchema = z.object({
  actual_end_time: z.string().optional(),
  actual_distance_km: z.number().nonnegative().optional(),
  fuel_consumed_liters: z.number().nonnegative().optional(),
});

export type CreateTripSchema = z.infer<typeof createTripSchema>;
export type StartTripSchema = z.infer<typeof startTripSchema>;
export type EndTripSchema = z.infer<typeof endTripSchema>;
