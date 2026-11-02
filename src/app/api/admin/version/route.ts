import { apiHandler } from '@/lib/api-handler';
import { getWebVersion } from '@/lib/app-version';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
    return getWebVersion();
}, {
});
