import { apiHandler } from '@/lib/api-handler';
import { SLTContractService, CreateContractInput } from '@/services/slt-contract.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const targetSchema = z.object({
    year: z.number().int().min(2020).max(2035),
    month: z.number().int().min(1).max(12),
    targetVolume: z.number().int().min(0),
    baseUnitRate: z.number().min(0),
    poleRate: z.number().optional(),
    perMeterRate: z.number().optional(),
    distanceThresholdMeters: z.number().optional(),
    customSurcharges: z.record(z.string(), z.number()).optional(),
    penaltyPerShortfall: z.number().optional(),
    bonusPerOverachieve: z.number().optional()
});

const createContractSchema = z.object({
    contractNumber: z.string().min(3),
    title: z.string().min(3),
    startDate: z.string(),
    endDate: z.string(),
    notes: z.string().optional(),
    documentUrl: z.string().optional(),
    tenderNo: z.string().optional(),
    ceilingValue: z.number().optional(),
    model1AQty: z.number().int().optional(),
    model1BQty: z.number().int().optional(),
    poleRate56: z.number().optional(),
    poleRate67: z.number().optional(),
    poleRate80: z.number().optional(),
    poleErectRate: z.number().optional(),
    poleAdminFee: z.number().optional(),
    peoTvRate: z.number().optional(),
    targets: z.array(targetSchema).min(1)
});

export const GET = apiHandler(
    async () => {
        const contracts = await SLTContractService.getContracts();
        return contracts;
    }
);

export const POST = apiHandler<Record<string, unknown>, CreateContractInput>(
    async (req, params, body) => {
        const userName = req.headers.get('x-user-name') || 'System User';
        const contract = await SLTContractService.createContract(body, userName);
        return contract;
    },
    {
        schema: createContractSchema,
        audit: { action: 'SLT_CONTRACT_CREATE', entity: 'SLTContract' }
    }
);
