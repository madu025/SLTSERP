import VehicleService from '@/services/fleet/VehicleService';
import { VehicleStatusEnum, OwnershipTypeEnum } from '@prisma/client';
import { VehicleType, OwnershipType } from '@/types/fleet/vehicle.types';
import { apiHandler } from '@/lib/api-handler';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createVehicleSchema = z.object({
    registration_number: z.string().trim().min(1).max(50),
    chassis_number: z.string().trim().min(1).max(100),
    engine_number: z.string().trim().max(100),
    make: z.string().trim().min(1).max(100),
    model: z.string().trim().min(1).max(100),
    year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
    color: z.string().trim().max(50),
    vehicle_type: z.nativeEnum(VehicleType),
    ownership: z.nativeEnum(OwnershipType),
    capacity_passengers: z.number().finite().min(0).max(1000),
    capacity_cargo_weight_kg: z.number().finite().min(0).max(1_000_000),
    capacity_cargo_volume_m3: z.number().finite().min(0).max(1_000_000),
    assigned_site_id: z.string().min(1).max(100),
    photo_url: z.string().url().max(2048).optional().or(z.literal('')),
}).strict();
type CreateVehicleRequest = z.infer<typeof createVehicleSchema>;

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const site_id = searchParams.get('site_id');
    const status = searchParams.get('status');
    const ownership = searchParams.get('ownership');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const filters: {
        site_id?: string;
        status?: VehicleStatusEnum;
        ownership?: OwnershipTypeEnum;
        page?: number;
        limit?: number;
    } = {};
    if (site_id) filters.site_id = site_id;
    if (status) filters.status = status as VehicleStatusEnum;
    if (ownership) filters.ownership = ownership as OwnershipTypeEnum;
    filters.page = page;
    filters.limit = limit;

    const { data, total } = await VehicleService.listVehicles(filters);

    return {
        data,
        meta: { total, page, limit, pages: Math.ceil(total / limit) }
    };
});

export const POST = apiHandler<unknown, CreateVehicleRequest>(async (request, _params, body) => {
    return await VehicleService.createVehicle(body);
}, {
    schema: createVehicleSchema,
    audit: { action: 'CREATE', entity: 'VEHICLE' }
});

