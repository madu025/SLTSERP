import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { HelpdeskService } from '@/services/helpdesk/helpdesk.service';
import { ITDeviceType } from '@prisma/client';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(
  async (req) => {
    const url = new URL(req.url);
    const rawType = url.searchParams.get('deviceType') || 'LAPTOP';
    const validTypes: ITDeviceType[] = ['LAPTOP', 'DESKTOP', 'MOBILE', 'PRINTER', 'NETWORK', 'OTHER'];
    const deviceType = validTypes.includes(rawType as ITDeviceType)
      ? (rawType as ITDeviceType)
      : 'LAPTOP';

    const nextAssetNumber = await HelpdeskService.previewNextAssetNumber(deviceType);
    return { nextAssetNumber };
  },
  {
    roles: ROLE_GROUPS.OFFICE_ADMINS
  }
);
