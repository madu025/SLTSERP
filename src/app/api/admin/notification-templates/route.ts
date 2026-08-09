import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
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

  const where: Record<string, unknown> = {};
  if (entityType) where.entityType = entityType;
  if (isActive !== null && isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  const templates = await prisma.notificationTemplate.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });

  return templates;
}, {
  roles: ROLE_GROUPS.ADMINS as unknown as string[],
  rawResponse: true
});

// POST: Create a new notification template
export const POST = apiHandler(async (req, _params, body) => {
  const data = templateSchema.parse(body);

  const existing = await prisma.notificationTemplate.findUnique({
    where: { code: data.code }
  });

  if (existing) {
    throw AppError.conflict('Template with this code already exists');
  }

  const template = await prisma.notificationTemplate.create({
    data: {
      code: data.code,
      title: data.title,
      message: data.message,
      subject: data.subject,
      htmlBody: data.htmlBody,
      entityType: data.entityType,
      isActive: data.isActive,
      channels: data.channels
    }
  });

  return template;
}, {
  schema: templateSchema,
  roles: ROLE_GROUPS.ADMINS as unknown as string[],
  audit: { action: 'CREATE', entity: 'NOTIFICATION_TEMPLATE' },
  rawResponse: true
});

// PUT: Update an existing notification template
export const PUT = apiHandler(async (req, _params, body) => {
  const data = updateTemplateSchema.parse(body);

  const template = await prisma.notificationTemplate.update({
    where: { id: data.id },
    data: {
      title: data.title,
      message: data.message,
      subject: data.subject,
      htmlBody: data.htmlBody,
      entityType: data.entityType,
      isActive: data.isActive,
      channels: data.channels
    }
  });

  return template;
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

  await prisma.notificationTemplate.delete({
    where: { id }
  });

  return { message: 'Template deleted successfully' };
}, {
  roles: ROLE_GROUPS.ADMINS as unknown as string[],
  audit: { action: 'DELETE', entity: 'NOTIFICATION_TEMPLATE' },
  rawResponse: true
});
