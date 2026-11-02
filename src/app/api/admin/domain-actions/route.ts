import { DOMAIN_ACTIONS_REGISTRY } from '@/config/domain-actions';
import { apiHandler } from '@/lib/api-handler';
export const dynamic = 'force-dynamic';
export const GET = apiHandler(
  async () => {
    return DOMAIN_ACTIONS_REGISTRY;
  },
  {}
);
