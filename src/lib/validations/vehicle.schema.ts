import { z } from 'zod';

export const startLogSchema = z.object({
  driver_id: z.string().min(1, 'Driver ID is required'),
  start_odometer: z.number().nonnegative('Start odometer must be non-negative'),
  expected_start_odometer: z.number().nonnegative().optional().nullable(),
  mismatch_reason: z.string().optional().nullable(),
  passengers: z.string().optional().nullable(),
  start_time: z.string().optional().nullable(),
});

export const endLogSchema = z.object({
  end_odometer: z.number().nonnegative('End odometer must be non-negative'),
  end_time: z.string().optional().nullable(),
});

export type StartLogSchema = z.infer<typeof startLogSchema>;
export type EndLogSchema = z.infer<typeof endLogSchema>;
