export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { SystemConfigService } from '@/services/core/system-config.service';

/** The only system settings the SOD screens need. Everything else stays admin-only. */
const SOD_UI_KEYS = ['OSP_MATERIAL_SOURCE', 'OSP_CATEGORY_ORDER', 'OSP_ITEM_ORDER'] as const;

export const GET = apiHandler(async () => {
    const all = await SystemConfigService.getConfigs();
    const picked: Record<string, string> = {};
    for (const key of SOD_UI_KEYS) if (all[key] !== undefined) picked[key] = all[key];
    return picked;
}, {
    rawResponse: true
});
