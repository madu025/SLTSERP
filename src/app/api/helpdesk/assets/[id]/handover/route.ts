import { ROLE_GROUPS } from '@/config/roles';
import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { HelpdeskService } from '@/services/helpdesk/helpdesk.service';
import { CreateAssetHandoverSchema } from '@/lib/validations/helpdesk.schema';


export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (req, params) => {
  const body = await req.json();
  const parsed = CreateAssetHandoverSchema.parse(body);

  const userId = req.headers.get('x-user-id') || 'unknown';
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
  roles: ROLE_GROUPS.PROJECT_MANAGERS
});

export const GET = apiHandler(async (_req, params) => {
  const handovers = await HelpdeskService.getAssetHandovers(params.id);
  return handovers;
}, {
  roles: ROLE_GROUPS.OFFICE_ADMINS
});
