import { NextResponse } from 'next/server';
import { DOMAIN_ACTIONS_REGISTRY } from '@/config/domain-actions';
import { apiHandler } from '@/lib/api-handler';
import { ROLE_GROUPS } from '@/config/roles';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(
  async () => {
    return DOMAIN_ACTIONS_REGISTRY;
  },
  { roles: ROLE_GROUPS.CORE_ADMINS }
);
