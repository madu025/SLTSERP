import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { HelpdeskService } from '@/services/helpdesk/helpdesk.service';
import { CreateAssetHandoverSchema } from '@/lib/validations/helpdesk.schema';
import { AppError } from '@/lib/error';


export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (req, params) => {
  const body = await req.json();
  const parsed = CreateAssetHandoverSchema.parse(body);

  const userId = params._userId;
  if (!userId) throw AppError.unauthorized('Authentication required');
  const ipAddress = req.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  const log = await HelpdeskService.logAssetHandover(
    userId,
    params.id,
    parsed,
    ipAddress,
    userAgent
  );

  return { message: 'Asset handover recorded successfully', handover: log };
}, {
});

export const GET = apiHandler(async (_req, params) => {
  const handovers = await HelpdeskService.getAssetHandovers(params.id);
  return handovers;
}, {
});
