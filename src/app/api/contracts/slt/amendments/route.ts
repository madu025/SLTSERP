import { apiHandler } from '@/lib/api-handler';
import { SLTContractService, CreateAmendmentInput } from '@/services/slt-contract.service';
import { z } from 'zod';

const createAmendmentSchema = z.object({
    contractId: z.string().min(1),
    amendmentNumber: z.string().min(3),
    effectiveDate: z.string(),
    reason: z.string().min(3),
    targetMonths: z.array(z.number()).optional(),
    revisedUnitRate: z.number().optional(),
    revisedTargetVolume: z.number().int().optional(),
    revisedPoleRate: z.number().optional(),
    revisedPerMeterRate: z.number().optional(),
    revisedDistanceThreshold: z.number().optional(),
    revisedEndDate: z.string().optional(),
    ceilingValue: z.number().optional(),
    ceilingIncrease: z.number().optional(),
    parentAmendmentId: z.string().optional(),
    customSurcharges: z.record(z.string(), z.number()).optional(),
    documentUrl: z.string().optional(),
    approvedBy: z.string().optional()
});

export const POST = apiHandler<Record<string, unknown>, CreateAmendmentInput>(
    async (req, params, body) => {
        const userName = req.headers.get('x-user-name') || 'Commercial Manager';
        const amendment = await SLTContractService.createAmendment(body, userName);
        return amendment;
    },
    {
        schema: createAmendmentSchema,
        audit: { action: 'SLT_AMENDMENT_CREATE', entity: 'SLTContractAmendment' }
    }
);
