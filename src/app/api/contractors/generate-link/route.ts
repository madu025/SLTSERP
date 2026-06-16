import { apiHandler } from '@/lib/api-handler';
import { ContractorService } from '@/services/contractor.service';
import { AppError, ErrorCode } from '@/lib/error';
import { registrationInviteSchema, RegistrationInviteSchema } from '@/lib/validations/contractor.schema';

export const POST = apiHandler<unknown, RegistrationInviteSchema>(
    async (req, params, body) => {
        const protocol = req.headers.get('x-forwarded-proto') || 'http';
        const host = req.headers.get('host');
        // Prefer 'origin' header if available, fallback to reconstructed host-based origin, then to env
        const origin = req.headers.get('origin') || (host ? `${protocol}://${host}` : (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin));

        try {
            const result = await ContractorService.generateRegistrationLink({
                ...body,
                origin
            });

            return result;
        } catch (error) {
            const err = error as { code?: string; message: string };
            console.error(`[GENERATE-INVITE ERROR] ${req.url}:`, error);

            // Handle Prisma specific errors
            if (err.code === 'P2002') {
                throw new AppError('Unique constraint violation: This contractor might already exist with this number or NIC.', ErrorCode.VALIDATION_ERROR, 400);
            }
            if (err.code === 'P2003') {
                throw new AppError('Foreign key failure: The provided RTOM Office or Staff ID was not found in our records.', ErrorCode.VALIDATION_ERROR, 400);
            }

            if (err.message === 'CONTACT_NUMBER_ALREADY_EXISTS' || 
                err.message === 'NIC_ALREADY_REGISTERED' || 
                err.message === 'REGISTRATION_NUMBER_ALREADY_EXISTS') {
                throw new AppError(err.message, ErrorCode.VALIDATION_ERROR, 400);
            }
            throw error;
        }
    },
    {
        schema: registrationInviteSchema,
        roles: ['ADMIN', 'SUPER_ADMIN', 'OFFICE_ADMIN', 'SITE_OFFICE_STAFF', 'SA_MANAGER', 'SA_ASSISTANT', 'MANAGER', 'AREA_MANAGER'],
        audit: {
            action: 'GENERATE_INVITE',
            entity: 'Contractor'
        }
    }
);
