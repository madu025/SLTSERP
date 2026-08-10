/**
 * Seed default notification templates for email customization.
 * All styles are INLINE for Gmail/mobile compatibility.
 * Layout uses TABLES (not flexbox/divs) so it also renders correctly
 * in Outlook desktop (Word rendering engine) and other legacy clients.
 * Gradients include a solid `bgcolor`/`background-color` fallback since
 * Outlook desktop does not support CSS linear-gradient().
 * Run: npx tsx prisma/seed-notification-templates.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Shared button generator (Outlook-safe: plain <a> with padding, no border-radius reliance)
function actionButtons(approveUrl: string, rejectUrl: string, viewUrl?: string) {
  const viewRow = viewUrl ? `
          <tr>
            <td colspan="2" style="padding:0 8px 12px;text-align:center;">
              <a href="${viewUrl}" style="display:inline-block;padding:12px 32px;text-decoration:none;border-radius:6px;font-weight:700;font-size:14px;background-color:#1e40af;color:#ffffff;font-family:'Segoe UI',Arial,sans-serif;">Review &amp; Take Action</a>
            </td>
          </tr>` : '';
  return `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto 0;">
          ${viewRow}
          <tr>
            <td style="padding:0 8px;">
              <a href="${approveUrl}" style="display:inline-block;padding:12px 32px;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;background-color:#22c55e;color:#ffffff;font-family:'Segoe UI',Arial,sans-serif;">Approve</a>
            </td>
            <td style="padding:0 8px;">
              <a href="${rejectUrl}" style="display:inline-block;padding:12px 32px;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;background-color:#ef4444;color:#ffffff;font-family:'Segoe UI',Arial,sans-serif;">Reject</a>
            </td>
          </tr>
        </table>`;
}

// Shared key/value info row (table-based, replaces display:flex rows)
function infoRow(label: string, value: string, labelColor = '#64748b') {
  return `
          <tr>
            <td style="padding:6px 0;font-size:14px;width:120px;color:${labelColor};font-weight:500;vertical-align:top;font-family:'Segoe UI',Arial,sans-serif;">${label}</td>
            <td style="padding:6px 0;font-size:14px;color:#1e293b;font-family:'Segoe UI',Arial,sans-serif;">${value}</td>
          </tr>`;
}

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
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;padding:0;margin:0;background-color:#f4f6f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f9;">
    <tr>
      <td align="center" style="padding:20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td bgcolor="#1e40af" style="background-color:#1e40af;background-image:linear-gradient(135deg,#1e40af,#3b82f6);padding:24px 30px;border-radius:8px 8px 0 0;">
              <h2 style="color:#ffffff;margin:0;font-size:20px;font-family:'Segoe UI',Arial,sans-serif;">Approval Required: Material Request</h2>
              <p style="color:#dbeafe;margin:4px 0 0;font-size:13px;font-family:'Segoe UI',Arial,sans-serif;">Ref: {{entityId}} | Priority: {{priority}}</p>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background-color:#ffffff;padding:30px;border-radius:0 0 8px 8px;">
              <p style="font-size:16px;color:#1e293b;margin:0 0 16px;font-family:'Segoe UI',Arial,sans-serif;">Dear {{user}},</p>
              <p style="color:#475569;font-size:14px;margin:0 0 16px;font-family:'Segoe UI',Arial,sans-serif;">You have been assigned to review this request as <strong>{{userRole}}</strong>.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
                <tr><td style="padding:16px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    ${infoRow('From Store', '{{fromStore}}')}
                    ${infoRow('To Store', '{{toStore}}')}
                    ${infoRow('Purpose', '{{purpose}}')}
                    ${infoRow('Stage', '{{status}}')}
                  </table>
                </td></tr>
              </table>
              <div style="margin:16px 0;">
                <h3 style="font-size:15px;color:#475569;margin:0 0 8px;font-family:'Segoe UI',Arial,sans-serif;">Material Summary</h3>
                <ul style="list-style:none;padding:0;margin:0;">{{items}}</ul>
              </div>
              ${actionButtons('{{approveUrl}}', '{{rejectUrl}}', '{{viewUrl}}')}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
                <tr><td style="padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;font-family:'Segoe UI',Arial,sans-serif;">
                  <p style="margin:0 0 4px;">This action link expires in {{expiryHours}} hours.</p>
                  <p style="margin:0 0 4px;">If you did not request this, please ignore this email.</p>
                  <p style="margin:8px 0 0;color:#94a3b8;">SLTS Nexus ERP - Outside Plant Operations</p>
                </td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;padding:0;margin:0;background-color:#f4f6f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f9;">
    <tr>
      <td align="center" style="padding:20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td bgcolor="#1e40af" style="background-color:#1e40af;background-image:linear-gradient(135deg,#1e40af,#3b82f6);padding:24px 30px;border-radius:8px 8px 0 0;">
              <h2 style="color:#ffffff;margin:0;font-size:20px;font-family:'Segoe UI',Arial,sans-serif;">Approval Required: {{entityType}}</h2>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background-color:#ffffff;padding:30px;border-radius:0 0 8px 8px;">
              <p style="font-size:16px;color:#1e293b;margin:0 0 16px;font-family:'Segoe UI',Arial,sans-serif;">Dear {{user}},</p>
              <p style="color:#475569;font-size:14px;margin:0 0 16px;font-family:'Segoe UI',Arial,sans-serif;">You have been assigned to review and approve this request.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
                <tr><td style="padding:16px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    ${infoRow('Entity', '{{entityName}}')}
                    ${infoRow('Type', '{{entityType}}')}
                    ${infoRow('Status', '{{status}}')}
                  </table>
                </td></tr>
              </table>
              ${actionButtons('{{approveUrl}}', '{{rejectUrl}}', '{{viewUrl}}')}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
                <tr><td style="padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;font-family:'Segoe UI',Arial,sans-serif;">
                  <p style="margin:0 0 4px;">This action link expires in {{expiryHours}} hours.</p>
                  <p style="margin:0 0 4px;">If you did not request this, please ignore this email.</p>
                  <p style="margin:8px 0 0;color:#94a3b8;">SLTS Nexus ERP - Outside Plant Operations</p>
                </td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;padding:0;margin:0;background-color:#f4f6f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f9;">
    <tr>
      <td align="center" style="padding:20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td bgcolor="#b45309" style="background-color:#b45309;background-image:linear-gradient(135deg,#b45309,#f59e0b);padding:24px 30px;border-radius:8px 8px 0 0;">
              <h2 style="color:#ffffff;margin:0;font-size:20px;font-family:'Segoe UI',Arial,sans-serif;">Wastage Approval Required</h2>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background-color:#ffffff;padding:30px;border-radius:0 0 8px 8px;">
              <p style="font-size:16px;color:#1e293b;margin:0 0 16px;font-family:'Segoe UI',Arial,sans-serif;">Dear {{user}},</p>
              <p style="color:#475569;font-size:14px;margin:0 0 16px;font-family:'Segoe UI',Arial,sans-serif;">A wastage record requires your approval.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fffbeb" style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:16px 0;">
                <tr><td style="padding:16px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    ${infoRow('Record', '{{entityId}}', '#92400e')}
                    ${infoRow('Details', '{{entityName}}', '#92400e')}
                    ${infoRow('Date', '{{date}}', '#92400e')}
                  </table>
                </td></tr>
              </table>
              ${actionButtons('{{approveUrl}}', '{{rejectUrl}}', '{{viewUrl}}')}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
                <tr><td style="padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;font-family:'Segoe UI',Arial,sans-serif;">
                  <p style="margin:0 0 4px;">This action link expires in {{expiryHours}} hours.</p>
                  <p style="margin:8px 0 0;color:#94a3b8;">SLTS Nexus ERP - Outside Plant Operations</p>
                </td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;padding:0;margin:0;background-color:#f4f6f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f9;">
    <tr>
      <td align="center" style="padding:20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td bgcolor="#7c3aed" style="background-color:#7c3aed;background-image:linear-gradient(135deg,#7c3aed,#a78bfa);padding:24px 30px;border-radius:8px 8px 0 0;">
              <h2 style="color:#ffffff;margin:0;font-size:20px;font-family:'Segoe UI',Arial,sans-serif;">{{title}}</h2>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background-color:#ffffff;padding:30px;border-radius:0 0 8px 8px;">
              <p style="font-size:16px;color:#1e293b;margin:0 0 16px;font-family:'Segoe UI',Arial,sans-serif;">Dear {{user}},</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f3ff" style="background-color:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:16px;margin:16px 0;">
                <tr><td style="padding:16px;">
                  <p style="color:#475569;font-size:14px;margin:0;font-family:'Segoe UI',Arial,sans-serif;">{{message}}</p>
                </td></tr>
              </table>
              <p style="color:#94a3b8;font-size:12px;margin:0 0 16px;font-family:'Segoe UI',Arial,sans-serif;">{{date}}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto 0;">
                <tr><td>
                  <a href="{{actionUrl}}" style="display:inline-block;padding:12px 32px;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;background-color:#7c3aed;color:#ffffff;font-family:'Segoe UI',Arial,sans-serif;">View Details</a>
                </td></tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
                <tr><td style="padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;font-family:'Segoe UI',Arial,sans-serif;">
                  <p style="margin:8px 0 0;color:#94a3b8;">SLTS Nexus ERP - Outside Plant Operations</p>
                </td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;padding:0;margin:0;background-color:#f4f6f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f9;">
    <tr>
      <td align="center" style="padding:20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td bgcolor="#dc2626" style="background-color:#dc2626;background-image:linear-gradient(135deg,#dc2626,#f87171);padding:24px 30px;border-radius:8px 8px 0 0;">
              <h2 style="color:#ffffff;margin:0;font-size:20px;font-family:'Segoe UI',Arial,sans-serif;">FEFO Compliance: Batch Expiry Digest</h2>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background-color:#ffffff;padding:30px;border-radius:0 0 8px 8px;">
              <p style="font-size:16px;color:#1e293b;margin:0 0 16px;font-family:'Segoe UI',Arial,sans-serif;">Dear {{user}},</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fff5f5" style="background-color:#fff5f5;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
                <tr><td style="padding:16px;">
                  <p style="color:#991b1b;font-size:14px;margin:0;font-family:'Segoe UI',Arial,sans-serif;"><strong>{{itemCount}}</strong> batch(es) are expiring within 30 days at <strong>{{storeName}}</strong>.</p>
                </td></tr>
              </table>
              <div style="margin:16px 0;">
                <h3 style="font-size:15px;color:#991b1b;margin:0 0 8px;font-family:'Segoe UI',Arial,sans-serif;">Expiring Batches</h3>
                <ul style="list-style:none;padding:0;margin:0;">{{items}}</ul>
              </div>
              <p style="color:#94a3b8;font-size:12px;margin:0 0 16px;font-family:'Segoe UI',Arial,sans-serif;">Generated: {{date}}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
                <tr><td style="padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;font-family:'Segoe UI',Arial,sans-serif;">
                  <p style="margin:8px 0 0;color:#94a3b8;">SLTS Nexus ERP - Outside Plant Operations</p>
                </td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;padding:0;margin:0;background-color:#f4f6f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f9;">
    <tr>
      <td align="center" style="padding:20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td bgcolor="#0891b2" style="background-color:#0891b2;background-image:linear-gradient(135deg,#0891b2,#22d3ee);padding:24px 30px;border-radius:8px 8px 0 0;">
              <h2 style="color:#ffffff;margin:0;font-size:20px;font-family:'Segoe UI',Arial,sans-serif;">Daily Notification Summary</h2>
              <p style="color:#cffafe;margin:4px 0 0;font-size:13px;font-family:'Segoe UI',Arial,sans-serif;">{{unreadCount}} unread notification(s)</p>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background-color:#ffffff;padding:30px;border-radius:0 0 8px 8px;">
              <p style="font-size:16px;color:#1e293b;margin:0 0 16px;font-family:'Segoe UI',Arial,sans-serif;">Dear {{user}},</p>
              <p style="color:#475569;font-size:14px;margin:0 0 16px;font-family:'Segoe UI',Arial,sans-serif;">Here is your daily notification digest for {{date}}.</p>
              <div style="margin:16px 0;">
                <ul style="list-style:none;padding:0;margin:0;">{{notifications}}</ul>
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
                <tr><td style="padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;font-family:'Segoe UI',Arial,sans-serif;">
                  <p style="margin:8px 0 0;color:#94a3b8;">SLTS Nexus ERP - Outside Plant Operations</p>
                </td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;padding:0;margin:0;background-color:#f4f6f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f9;">
    <tr>
      <td align="center" style="padding:20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td bgcolor="#1e40af" style="background-color:#1e40af;background-image:linear-gradient(135deg,#1e40af,#3b82f6);padding:24px 30px;border-radius:8px 8px 0 0;">
              <h2 style="color:#ffffff;margin:0;font-size:20px;font-family:'Segoe UI',Arial,sans-serif;">{{title}}</h2>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background-color:#ffffff;padding:30px;border-radius:0 0 8px 8px;">
              <p style="font-size:16px;color:#1e293b;margin:0 0 16px;font-family:'Segoe UI',Arial,sans-serif;">Dear {{user}},</p>
              <p style="color:#475569;font-size:14px;margin:0 0 16px;font-family:'Segoe UI',Arial,sans-serif;">{{message}}</p>
              <p style="color:#94a3b8;font-size:12px;margin:0 0 16px;font-family:'Segoe UI',Arial,sans-serif;">{{date}}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto 0;">
                <tr><td>
                  <a href="{{actionUrl}}" style="display:inline-block;padding:12px 32px;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;background-color:#3b82f6;color:#ffffff;font-family:'Segoe UI',Arial,sans-serif;">View Details</a>
                </td></tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
                <tr><td style="padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;font-family:'Segoe UI',Arial,sans-serif;">
                  <p style="margin:8px 0 0;color:#94a3b8;">SLTS Nexus ERP - Outside Plant Operations</p>
                </td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  }
];

async function main() {
  console.log('Seeding notification templates (email-client-safe, inline + table layout)...');

  for (const tpl of DEFAULT_TEMPLATES) {
    await prisma.notificationTemplate.upsert({
      where: { code: tpl.code },
      create: tpl,
      update: {
        subject: tpl.subject,
        htmlBody: tpl.htmlBody,
        entityType: tpl.entityType
      }
    });
    console.log(`  Upserted: ${tpl.code}`);
  }

  console.log('Done. Templates seeded successfully.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
