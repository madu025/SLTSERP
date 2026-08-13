import { apiHandler } from '@/lib/api-handler';
import { NotificationTemplateService } from '@/services/admin/notification-template.service';
import { ROLE_GROUPS } from '@/config/roles';
import { AppError } from '@/lib/error';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const templateSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  subject: z.string().optional().nullable(),
  htmlBody: z.string().optional().nullable(),
  entityType: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  channels: z.array(z.string()).default(['EMAIL'])
});

const updateTemplateSchema = templateSchema.partial().extend({
  id: z.string().min(1, 'ID is required')
});

// GET: List all notification templates
export const GET = apiHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get('entityType');
  const isActive = searchParams.get('isActive');

  return await NotificationTemplateService.list({
    entityType: entityType ?? undefined,
    isActive: isActive !== null && isActive !== undefined ? isActive === 'true' : undefined
  });
}, {
  roles: ROLE_GROUPS.ADMINS as unknown as string[],
  rawResponse: true
});

// POST: Create a new notification template
export const POST = apiHandler(async (_req, _params, body) => {
  const data = templateSchema.parse(body);
  return await NotificationTemplateService.create(data);
}, {
  schema: templateSchema,
  roles: ROLE_GROUPS.ADMINS as unknown as string[],
  audit: { action: 'CREATE', entity: 'NOTIFICATION_TEMPLATE' },
  rawResponse: true
});

// PUT: Update an existing notification template
export const PUT = apiHandler(async (_req, _params, body) => {
  const data = updateTemplateSchema.parse(body);
  return await NotificationTemplateService.update(data);
}, {
  schema: updateTemplateSchema,
  roles: ROLE_GROUPS.ADMINS as unknown as string[],
  audit: { action: 'UPDATE', entity: 'NOTIFICATION_TEMPLATE' },
  rawResponse: true
});

// DELETE: Delete a notification template
export const DELETE = apiHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    throw AppError.badRequest('Template ID is required');
  }

  await NotificationTemplateService.delete(id);
  return { message: 'Template deleted successfully' };
}, {
  roles: ROLE_GROUPS.ADMINS as unknown as string[],
  audit: { action: 'DELETE', entity: 'NOTIFICATION_TEMPLATE' },
  rawResponse: true
});
