import { apiHandler } from '@/lib/api-handler';
import { TEMPLATE_CODES, getTemplateCodesByCategory } from '@/config/notification-templates';

export const dynamic = 'force-dynamic';

// GET: Return all registered template codes with metadata
export const GET = apiHandler(async () => {
  return {
    codes: TEMPLATE_CODES,
    grouped: getTemplateCodesByCategory()
  };
}, {
  rawResponse: true
});
