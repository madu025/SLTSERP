import { apiHandler } from '@/lib/api-handler';
import { ROLE_GROUPS } from '@/config/roles';
import { NotificationTemplateEngineService } from '@/services/notification/template-engine.service';
import { EmailService } from '@/services/notification/email.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const testSendSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required'),
  to: z.string().email('Valid email is required').optional().nullable()
});

export const POST = apiHandler(async (req, _params, body) => {
  const { templateId, to } = testSendSchema.parse(body);

  // Use provided email or default to current user
  const recipientEmail = to || 'prasad@slts.lk';

  // Sample variables covering ALL template codes from the registry.
  // Each template code uses a subset of these keys.
  const sampleVars: Record<string, string> = {
    // --- Common ---
    user: 'Prasad Perera',
    userEmail: recipientEmail,
    date: new Date().toLocaleDateString('en-LK'),

    // --- APPROVAL_GENERIC / APPROVAL_WASTAGE ---
    entityType: 'Material Request',
    entityId: 'REQ-2026-TEST',
    entityName: 'Fiber Drop Wire - 100m (Test)',
    amount: '15,500',
    status: 'PENDING_APPROVAL',
    approveUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://sltserp.vercel.app'}/api/approvals/webhook?token=TEST_APPROVE_TOKEN`,
    rejectUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://sltserp.vercel.app'}/api/approvals/webhook?token=TEST_REJECT_TOKEN`,
    expiryHours: '48',

    // --- APPROVAL_MATERIAL_REQUEST ---
    userRole: 'STORES_MANAGER',
    priority: 'HIGH',
    purpose: 'FTTH Installation - Test Template',
    fromStore: 'Kaduwela Main Store',
    toStore: 'Contractor Site A',
    items: '<li>Cat5e UTP Cable - 5 Box</li><li>Drop Wire Retainer - 10 pcs</li><li>Fiber Drop Wire 100m - 2 Rolls</li>',

    // --- ALERT_GENERIC / NOTIFICATION_GENERIC ---
    title: 'System Alert - Low Stock Warning',
    message: 'Cat5e UTP Cable stock has fallen below the minimum threshold of 10 units. Current stock: 3 units.',
    actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://sltserp.vercel.app'}/inventory/stock`,

    // --- ALERT_FEFO_EXPIRY ---
    itemCount: '3',
    storeName: 'Kaduwela Main Store',

    // --- NOTIFICATION_DAILY_SUMMARY ---
    unreadCount: '5',
    notifications: '<li>PO-2026-0042 approved by DGM</li><li>GRN-2026-0118 received at Kaduwela</li><li>MIN-2026-0007 ready for collection</li><li>Stock alert: Cat5e below threshold</li><li>MRN-2026-0003 returned for correction</li>'
  };

  // Render the template using the template code lookup
  const { prisma } = await import('@/lib/prisma');
  const template = await prisma.notificationTemplate.findUnique({
    where: { id: templateId }
  });

  if (!template) {
    throw new Error('Template not found');
  }

  // Render using template engine
  const rendered = await NotificationTemplateEngineService.renderEmailByCode(template.code, sampleVars);

  if (!rendered) {
    throw new Error('Failed to render template');
  }

  // Send the email
  const info = await EmailService.sendMail({
    to: recipientEmail,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html
  });

  return {
    success: true,
    message: `Test email sent to ${recipientEmail}`,
    messageId: info?.messageId || 'logged-only',
    subject: rendered.subject
  };
}, {
  schema: testSendSchema,
  roles: ROLE_GROUPS.ADMINS as unknown as string[],
  rawResponse: true
});
