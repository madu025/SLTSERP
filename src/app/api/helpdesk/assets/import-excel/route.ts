import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { HelpdeskService } from '@/services/helpdesk/helpdesk.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = apiHandler(
  async (req) => {
    const userId = req.headers.get('x-user-id')!;
    const ipAddress = req.headers.get('x-real-ip') || undefined;
    const userAgent = req.headers.get('user-agent') || undefined;

    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      throw AppError.badRequest('Expected multipart/form-data with an Excel file');
    }

    const formData = await req.formData().catch(() => null);
    if (!formData) {
      throw AppError.badRequest('Failed to parse form data');
    }

    const file = formData.get('file') as File | null;
    if (!file) {
      throw AppError.badRequest('No Excel file provided in request (key: "file")');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    return await HelpdeskService.bulkImportAssets(userId, buffer, ipAddress, userAgent);
  },
  {
    roles: [...ROLE_GROUPS.OFFICE_ADMINS, ...ROLE_GROUPS.CORE_ADMINS, 'ENGINEER'],
    audit: {
      action: 'CREATE',
      entity: 'ITAsset'
    }
  }
);
