/**
 * Seed default notification templates for email customization.
 * Run: npx tsx prisma/seed-notification-templates.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_TEMPLATES = [
  {
    code: 'APPROVAL_MATERIAL_REQUEST',
    title: 'Material Request Approval',
    subject: 'Action Required: Material Request #{{entityId}}',
    message: 'Please approve or reject Material Request {{entityId}} from {{fromStore}}. Approve: {{approveUrl}} | Reject: {{rejectUrl}}',
    entityType: 'MATERIAL_REQUEST',
    channels: ['EMAIL'],
    htmlBody: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 0; margin: 0; background-color: #f4f6f9; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 24px 30px; border-radius: 8px 8px 0 0; }
    .header h2 { color: white; margin: 0; font-size: 20px; }
    .header p { color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px; }
    .body { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .greeting { font-size: 16px; color: #1e293b; margin-bottom: 16px; }
    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .info-row { display: flex; padding: 6px 0; font-size: 14px; }
    .info-label { color: #64748b; width: 120px; flex-shrink: 0; font-weight: 500; }
    .info-value { color: #1e293b; }
    .materials { margin: 16px 0; }
    .materials h3 { font-size: 15px; color: #475569; margin-bottom: 8px; }
    .materials ul { list-style: none; padding: 0; }
    .materials li { padding: 8px 12px; background: #f8fafc; border-radius: 4px; margin-bottom: 4px; font-size: 14px; color: #334155; border-left: 3px solid #3b82f6; }
    .actions { margin-top: 24px; text-align: center; }
    .btn { display: inline-block; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; margin: 0 8px; }
    .btn-approve { background-color: #22c55e; color: white; }
    .btn-reject { background-color: #ef4444; color: white; }
    .footer { margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h2>Approval Required: Material Request</h2>
      <p>Ref: {{entityId}} | Priority: {{priority}}</p>
    </div>
    <div class="body">
      <p class="greeting">Dear {{user}},</p>
      <p style="color: #475569; font-size: 14px;">You have been assigned to review this request as <strong>{{userRole}}</strong>.</p>
      
      <div class="info-box">
        <div class="info-row"><span class="info-label">From Store</span><span class="info-value">{{fromStore}}</span></div>
        <div class="info-row"><span class="info-label">To Store</span><span class="info-value">{{toStore}}</span></div>
        <div class="info-row"><span class="info-label">Purpose</span><span class="info-value">{{purpose}}</span></div>
        <div class="info-row"><span class="info-label">Stage</span><span class="info-value">{{status}}</span></div>
      </div>

      <div class="materials">
        <h3>Material Summary</h3>
        <ul>{{items}}</ul>
      </div>

      <div class="actions">
        <a href="{{approveUrl}}" class="btn btn-approve">Approve</a>
        <a href="{{rejectUrl}}" class="btn btn-reject">Reject</a>
      </div>

      <div class="footer">
        <p>This action link expires in {{expiryHours}} hours.</p>
        <p>If you did not request this, please ignore this email.</p>
        <p style="margin-top: 8px; color: #cbd5e1;">SLTS Nexus ERP - Outside Plant Operations</p>
      </div>
    </div>
  </div>
</body>
</html>`
  },
  {
    code: 'APPROVAL_GENERIC',
    title: 'Generic Approval Request',
    subject: 'Action Required: {{entityType}} #{{entityId}}',
    message: 'Please approve or reject the {{entityType}} request #{{entityId}}. Approve: {{approveUrl}} | Reject: {{rejectUrl}}',
    entityType: 'GENERIC',
    channels: ['EMAIL'],
    htmlBody: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 0; margin: 0; background-color: #f4f6f9; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 24px 30px; border-radius: 8px 8px 0 0; }
    .header h2 { color: white; margin: 0; font-size: 20px; }
    .body { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .info-row { display: flex; padding: 6px 0; font-size: 14px; }
    .info-label { color: #64748b; width: 120px; flex-shrink: 0; font-weight: 500; }
    .info-value { color: #1e293b; }
    .actions { margin-top: 24px; text-align: center; }
    .btn { display: inline-block; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; margin: 0 8px; }
    .btn-approve { background-color: #22c55e; color: white; }
    .btn-reject { background-color: #ef4444; color: white; }
    .footer { margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h2>Approval Required: {{entityType}}</h2>
    </div>
    <div class="body">
      <p style="font-size: 16px; color: #1e293b;">Dear {{user}},</p>
      <p style="color: #475569; font-size: 14px;">You have been assigned to review and approve this request.</p>
      
      <div class="info-box">
        <div class="info-row"><span class="info-label">Entity</span><span class="info-value">{{entityName}}</span></div>
        <div class="info-row"><span class="info-label">Type</span><span class="info-value">{{entityType}}</span></div>
        <div class="info-row"><span class="info-label">Status</span><span class="info-value">{{status}}</span></div>
      </div>

      <div class="actions">
        <a href="{{approveUrl}}" class="btn btn-approve">Approve</a>
        <a href="{{rejectUrl}}" class="btn btn-reject">Reject</a>
      </div>

      <div class="footer">
        <p>This action link expires in {{expiryHours}} hours.</p>
        <p>If you did not request this, please ignore this email.</p>
        <p style="margin-top: 8px; color: #cbd5e1;">SLTS Nexus ERP - Outside Plant Operations</p>
      </div>
    </div>
  </div>
</body>
</html>`
  },
  {
    code: 'APPROVAL_WASTAGE',
    title: 'Wastage Approval Request',
    subject: 'Wastage Approval Required: {{entityId}}',
    message: 'Please approve wastage record {{entityId}}. Approve: {{approveUrl}} | Reject: {{rejectUrl}}',
    entityType: 'WASTAGE',
    channels: ['EMAIL'],
    htmlBody: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 0; margin: 0; background-color: #f4f6f9; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #b45309, #f59e0b); padding: 24px 30px; border-radius: 8px 8px 0 0; }
    .header h2 { color: white; margin: 0; font-size: 20px; }
    .body { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .info-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .info-row { display: flex; padding: 6px 0; font-size: 14px; }
    .info-label { color: #92400e; width: 120px; flex-shrink: 0; font-weight: 500; }
    .info-value { color: #1e293b; }
    .actions { margin-top: 24px; text-align: center; }
    .btn { display: inline-block; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; margin: 0 8px; }
    .btn-approve { background-color: #22c55e; color: white; }
    .btn-reject { background-color: #ef4444; color: white; }
    .footer { margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h2>Wastage Approval Required</h2>
    </div>
    <div class="body">
      <p style="font-size: 16px; color: #1e293b;">Dear {{user}},</p>
      <p style="color: #475569; font-size: 14px;">A wastage record requires your approval.</p>
      
      <div class="info-box">
        <div class="info-row"><span class="info-label">Record</span><span class="info-value">{{entityId}}</span></div>
        <div class="info-row"><span class="info-label">Details</span><span class="info-value">{{entityName}}</span></div>
        <div class="info-row"><span class="info-label">Date</span><span class="info-value">{{date}}</span></div>
      </div>

      <div class="actions">
        <a href="{{approveUrl}}" class="btn btn-approve">Approve</a>
        <a href="{{rejectUrl}}" class="btn btn-reject">Reject</a>
      </div>

      <div class="footer">
        <p>This action link expires in {{expiryHours}} hours.</p>
        <p style="margin-top: 8px; color: #cbd5e1;">SLTS Nexus ERP - Outside Plant Operations</p>
      </div>
    </div>
  </div>
</body>
</html>`
  },
  {
    code: 'ALERT_GENERIC',
    title: 'Generic System Alert',
    subject: '[SLTS NEXUS] {{title}}',
    message: '{{message}}',
    entityType: 'ALERT',
    channels: ['EMAIL'],
    htmlBody: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 0; margin: 0; background-color: #f4f6f9; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #7c3aed, #a78bfa); padding: 24px 30px; border-radius: 8px 8px 0 0; }
    .header h2 { color: white; margin: 0; font-size: 20px; }
    .body { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .alert-box { background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .btn { display: inline-block; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; background-color: #7c3aed; color: white; }
    .footer { margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h2>{{title}}</h2>
    </div>
    <div class="body">
      <p style="font-size: 16px; color: #1e293b;">Dear {{user}},</p>
      <div class="alert-box">
        <p style="color: #475569; font-size: 14px; margin: 0;">{{message}}</p>
      </div>
      <p style="color: #94a3b8; font-size: 12px;">{{date}}</p>
      <div style="margin-top: 24px; text-align: center;">
        <a href="{{actionUrl}}" class="btn">View Details</a>
      </div>
      <div class="footer">
        <p style="margin-top: 8px; color: #cbd5e1;">SLTS Nexus ERP - Outside Plant Operations</p>
      </div>
    </div>
  </div>
</body>
</html>`
  },
  {
    code: 'ALERT_FEFO_EXPIRY',
    title: 'FEFO Batch Expiry Alert',
    subject: '[SLTS NEXUS FEFO Alert] {{itemCount}} Batch(es) Expiring Within 30 Days',
    message: 'The following {{itemCount}} batch(es) are expiring within 30 days at {{storeName}}.',
    entityType: 'FEFO_ALERT',
    channels: ['EMAIL'],
    htmlBody: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 0; margin: 0; background-color: #f4f6f9; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #dc2626, #f87171); padding: 24px 30px; border-radius: 8px 8px 0 0; }
    .header h2 { color: white; margin: 0; font-size: 20px; }
    .body { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .alert-box { background: #fff5f5; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .items { margin: 16px 0; }
    .items ul { list-style: none; padding: 0; }
    .items li { padding: 8px 12px; background: #fff5f5; border-radius: 4px; margin-bottom: 4px; font-size: 14px; color: #991b1b; border-left: 3px solid #ef4444; }
    .footer { margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h2>FEFO Compliance: Batch Expiry Digest</h2>
    </div>
    <div class="body">
      <p style="font-size: 16px; color: #1e293b;">Dear {{user}},</p>
      <div class="alert-box">
        <p style="color: #991b1b; font-size: 14px; margin: 0;">
          <strong>{{itemCount}}</strong> batch(es) are expiring within 30 days at <strong>{{storeName}}</strong>.
        </p>
      </div>
      <div class="items">
        <h3 style="font-size: 15px; color: #991b1b;">Expiring Batches</h3>
        <ul>{{items}}</ul>
      </div>
      <p style="color: #94a3b8; font-size: 12px;">Generated: {{date}}</p>
      <div class="footer">
        <p style="margin-top: 8px; color: #cbd5e1;">SLTS Nexus ERP - Outside Plant Operations</p>
      </div>
    </div>
  </div>
</body>
</html>`
  },
  {
    code: 'NOTIFICATION_DAILY_SUMMARY',
    title: 'Daily Notification Summary',
    subject: '[SLTS NEXUS] Daily Summary - {{unreadCount}} Unread Notifications',
    message: 'You have {{unreadCount}} unread notifications as of {{date}}.',
    entityType: 'DAILY_SUMMARY',
    channels: ['EMAIL'],
    htmlBody: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 0; margin: 0; background-color: #f4f6f9; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #0891b2, #22d3ee); padding: 24px 30px; border-radius: 8px 8px 0 0; }
    .header h2 { color: white; margin: 0; font-size: 20px; }
    .header p { color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px; }
    .body { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .notif-list { margin: 16px 0; }
    .notif-list ul { list-style: none; padding: 0; }
    .notif-list li { padding: 10px 12px; background: #f0fdfa; border-radius: 4px; margin-bottom: 4px; font-size: 14px; color: #134e4a; border-left: 3px solid #14b8a6; }
    .footer { margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h2>Daily Notification Summary</h2>
      <p>{{unreadCount}} unread notification(s)</p>
    </div>
    <div class="body">
      <p style="font-size: 16px; color: #1e293b;">Dear {{user}},</p>
      <p style="color: #475569; font-size: 14px;">Here is your daily notification digest for {{date}}.</p>
      <div class="notif-list">
        <ul>{{notifications}}</ul>
      </div>
      <div class="footer">
        <p style="margin-top: 8px; color: #cbd5e1;">SLTS Nexus ERP - Outside Plant Operations</p>
      </div>
    </div>
  </div>
</body>
</html>`
  },
  {
    code: 'NOTIFICATION_GENERIC',
    title: 'Generic Notification',
    subject: '[SLTS NEXUS] {{title}}',
    message: '{{message}}',
    entityType: 'NOTIFICATION',
    channels: ['EMAIL'],
    htmlBody: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 0; margin: 0; background-color: #f4f6f9; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 24px 30px; border-radius: 8px 8px 0 0; }
    .header h2 { color: white; margin: 0; font-size: 20px; }
    .body { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .btn { display: inline-block; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; background-color: #3b82f6; color: white; }
    .footer { margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h2>{{title}}</h2>
    </div>
    <div class="body">
      <p style="font-size: 16px; color: #1e293b;">Dear {{user}},</p>
      <p style="color: #475569; font-size: 14px;">{{message}}</p>
      <p style="color: #94a3b8; font-size: 12px;">{{date}}</p>
      <div style="margin-top: 24px; text-align: center;">
        <a href="{{actionUrl}}" class="btn">View Details</a>
      </div>
      <div class="footer">
        <p style="margin-top: 8px; color: #cbd5e1;">SLTS Nexus ERP - Outside Plant Operations</p>
      </div>
    </div>
  </div>
</body>
</html>`
  }
];

async function main() {
  console.log('Seeding notification templates...');
  
  for (const tpl of DEFAULT_TEMPLATES) {
    const existing = await prisma.notificationTemplate.findUnique({
      where: { code: tpl.code }
    });

    if (existing) {
      // Update with new fields
      await prisma.notificationTemplate.update({
        where: { code: tpl.code },
        data: {
          subject: tpl.subject,
          htmlBody: tpl.htmlBody,
          entityType: tpl.entityType
        }
      });
      console.log(`  Updated: ${tpl.code}`);
    } else {
      await prisma.notificationTemplate.create({
        data: tpl
      });
      console.log(`  Created: ${tpl.code}`);
    }
  }

  console.log('Done. Templates seeded successfully.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
