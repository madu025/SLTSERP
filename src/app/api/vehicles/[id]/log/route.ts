export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import VehicleLogService from '@/services/fleet/VehicleLogService';
import VehicleService from '@/services/fleet/VehicleService';
import { startLogSchema, endLogSchema, StartLogSchema, EndLogSchema } from '@/lib/validations/vehicle.schema';
import { VehicleLog } from '@/types/fleet/vehicle.types';
import { ROLE_GROUPS } from '@/config/roles';
import { AppError } from '@/lib/error';

/**
 * GET: Get active log status, last odometer, and active driver list
 */
export const GET = apiHandler<unknown, void>(
  async (req, params) => {
    const { id } = params;
    const vehicle = await VehicleService.getVehicle(id);
    if (!vehicle) {
      throw AppError.notFound('Vehicle not found');
    }

    const activeLog = await VehicleLogService.getActiveLog(id);
    const drivers = await VehicleService.getActiveDrivers();

    return {
      vehicle,
      activeLog,
      drivers,
    };
  }
);

/**
 * POST: Start a vehicle usage log (Check-in / Duty On)
 */
export const POST = apiHandler<VehicleLog, StartLogSchema>(
  async (req, params, body) => {
    const { id } = params;

    const log = await VehicleLogService.startUsageLog({
      vehicle_id: id,
      driver_id: body.driver_id,
      start_odometer: Number(body.start_odometer),
      expected_start_odometer: Number(body.expected_start_odometer || 0),
      mismatch_reason: body.mismatch_reason || undefined,
      passengers: body.passengers || undefined,
      start_time: body.start_time ? new Date(body.start_time) : new Date(),
    });

    return log;
  },
  { schema: startLogSchema, roles: ROLE_GROUPS.OFFICE_ADMINS }
);

/**
 * PUT: End a vehicle usage log (Check-out / Duty Off)
 */
export const PUT = apiHandler<VehicleLog, EndLogSchema>(
  async (req, params, body) => {
    const { id } = params;

    const log = await VehicleLogService.endUsageLog(id, {
      end_odometer: Number(body.end_odometer),
      end_time: body.end_time ? new Date(body.end_time) : new Date(),
    });

    return log;
  },
  { schema: endLogSchema, roles: ROLE_GROUPS.OFFICE_ADMINS }
);
