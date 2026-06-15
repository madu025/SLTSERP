import { NextRequest, NextResponse } from 'next/server';
import VehicleLogService from '@/services/VehicleLogService';
import VehicleService from '@/services/VehicleService';
import { prisma } from '@/lib/prisma';

// Bypass type validation for dynamic extended Prisma client inside routes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET: Get active log status, last odometer, and active driver list
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const vehicle = await VehicleService.getVehicle(id);
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    const activeLog = await VehicleLogService.getActiveLog(id);

    // Fetch active drivers list so the UI can let the user pick a driver (especially for Hired Without Driver)
    const dbDrivers = await db.vMDriver.findMany({
      where: { employment_status: 'ACTIVE' },
      orderBy: { first_name: 'asc' },
    });

    const drivers = dbDrivers.map((d: { id: string; first_name: string; last_name: string; phone: string }) => ({
      id: d.id,
      first_name: d.first_name,
      last_name: d.last_name,
      phone: d.phone,
    }));

    return NextResponse.json({
      success: true,
      data: {
        vehicle,
        activeLog,
        drivers,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to fetch log info' },
      { status: 500 }
    );
  }
}

/**
 * POST: Start a vehicle usage log (Check-in / Duty On)
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (!body.driver_id) {
      return NextResponse.json({ error: 'driver_id is required' }, { status: 400 });
    }
    if (body.start_odometer === undefined || body.start_odometer === null) {
      return NextResponse.json({ error: 'start_odometer is required' }, { status: 400 });
    }

    const log = await VehicleLogService.startUsageLog({
      vehicle_id: id,
      driver_id: body.driver_id,
      start_odometer: Number(body.start_odometer),
      expected_start_odometer: Number(body.expected_start_odometer || 0),
      mismatch_reason: body.mismatch_reason,
      passengers: body.passengers,
      start_time: body.start_time ? new Date(body.start_time) : new Date(),
    });

    return NextResponse.json({
      success: true,
      data: log,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to start log' },
      { status: 500 }
    );
  }
}

/**
 * PUT: End a vehicle usage log (Check-out / Duty Off)
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (body.end_odometer === undefined || body.end_odometer === null) {
      return NextResponse.json({ error: 'end_odometer is required' }, { status: 400 });
    }

    const log = await VehicleLogService.endUsageLog(id, {
      end_odometer: Number(body.end_odometer),
      end_time: body.end_time ? new Date(body.end_time) : new Date(),
    });

    return NextResponse.json({
      success: true,
      data: log,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to end log' },
      { status: 500 }
    );
  }
}
