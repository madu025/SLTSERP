import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { HelpdeskService } from '@/services/helpdesk.service';
import { CreateAssetHandoverSchema } from '@/lib/validations/helpdesk.schema';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (req, params, user) => {
  const { id } = await params;
  const body = await req.json();
  const parsed = CreateAssetHandoverSchema.parse(body);

  const ipAddress = req.headers.get('x-forwarded-for') || (req as any).ip || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  const log = await HelpdeskService.logAssetHandover(
    user.id,
    id,
    parsed,
    ipAddress,
    userAgent
  );

  return { message: 'Asset handover recorded successfully', handover: log };
}, {
  roles: ['SUPER_ADMIN', 'ADMIN', 'ENGINEER', 'STORE_KEEPER']
});

export const GET = apiHandler(async (req, params) => {
  const { id } = await params;
  
  const handovers = await prisma.assetHandoverLog.findMany({
    where: { assetId: id },
    include: {
      performedBy: { select: { name: true, username: true } },
      targetStaff: { select: { name: true, employeeId: true } }
    },
    orderBy: { date: 'desc' }
  });

  return handovers;
}, {
  roles: ['SUPER_ADMIN', 'ADMIN', 'ENGINEER', 'STORE_KEEPER', 'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT']
});
