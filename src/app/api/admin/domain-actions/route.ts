import { NextResponse } from 'next/server';
import { DOMAIN_ACTIONS_REGISTRY } from '@/config/domain-actions';
import { apiHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(
  async (req) => {
    // We could add role-based access checks here if needed, 
    // but reading the registry is generally safe for any logged in admin.
    return DOMAIN_ACTIONS_REGISTRY;
  }
);
