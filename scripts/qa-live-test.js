require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');

const JWT_SECRET = process.env.JWT_SECRET;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sltserp.vercel.app';

async function main() {
    const p = new PrismaClient();

    const setting = await p.systemSetting.findUnique({ where: { key: 'SMTP_CONFIG' } });
    if (!setting || !setting.value) { console.log('NO SMTP'); process.exit(1); }
    const cfg = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;

    const allUsers = await p.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true, email: true, name: true, role: true }, take: 20 });
    const approver = allUsers.find(u => u.email && u.email.includes('@'));
    if (!approver) { console.log('NO USER'); process.exit(1); }

    let policy = await p.processGatePolicy.findFirst({ where: { entityType: 'TEST_APPROVAL' }, include: { approvalLevels: true } });
    if (!policy) {
        policy = await p.processGatePolicy.create({
            data: { entityType: 'TEST_APPROVAL', fromStatus: 'DRAFT', toStatus: 'APPROVED', label: 'QA', isEnabled: true, rejectionBehavior: 'PERMANENT_CANCEL', approvalStrategy: 'ANY_CAN_APPROVE',
                approvalLevels: { create: { level: 1, requiredRole: approver.role, specificUserId: approver.id, description: 'QA' } } },
            include: { approvalLevels: true }
        });
    }
    const level = policy.approvalLevels[0];

    const instance = await p.universalApprovalInstance.create({
        data: { entityType: 'TEST_APPROVAL', entityId: 'QA-LIVE-TEST', policyId: policy.id, levelIndex: 0, level: level.level, requiredRole: approver.role, assignedUserId: approver.id, makerId: null, status: 'PENDING' }
    });

    const approveToken = jwt.sign({ instanceId: instance.id, action: 'APPROVED', userId: approver.id }, JWT_SECRET, { expiresIn: '48h' });
    const rejectToken = jwt.sign({ instanceId: instance.id, action: 'REJECTED', userId: approver.id }, JWT_SECRET, { expiresIn: '48h' });

    const approveUrl = `${BASE_URL}/api/approvals/webhook?token=${approveToken}`;
    const rejectUrl = `${BASE_URL}/api/approvals/webhook?token=${rejectToken}`;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:30px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <tr><td style="background:linear-gradient(135deg,#1e40af,#3b82f6);background-color:#1e40af;padding:24px 30px;">
      <h2 style="color:white;margin:0;font-size:20px;">Live Browser Test</h2>
      <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">Click Approve/Reject - should show HTML page, not JSON</p>
    </td></tr>
    <tr><td style="padding:28px 30px;">
      <p style="color:#1e293b;font-size:15px;margin:0 0 16px;">Dear ${approver.name},</p>
      <p style="color:#475569;font-size:14px;margin:0 0 20px;">Test the approval buttons. Expected: HTML confirmation page with green checkmark.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
        <tr>
          <td style="padding:0 8px;"><a href="${approveUrl}" style="display:inline-block;background:#22c55e;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;">Approve</a></td>
          <td style="padding:0 8px;"><a href="${rejectUrl}" style="display:inline-block;background:#ef4444;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;">Reject</a></td>
        </tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:24px;background:#f8fafc;border-radius:6px;">
        <tr><td style="padding:16px;">
          <p style="margin:0 0 6px;font-size:13px;color:#64748b;"><strong>Entity:</strong> QA Live Test #QA-LIVE-TEST</p>
          <p style="margin:0;font-size:13px;color:#64748b;"><strong>Status:</strong> PENDING</p>
        </td></tr>
      </table>
      <p style="color:#94a3b8;font-size:12px;margin:20px 0 0;text-align:center;">Link expires in 48 hours.</p>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:16px 30px;border-top:1px solid #e2e8f0;">
      <p style="color:#94a3b8;font-size:11px;margin:0;text-align:center;">SLTS ERP | Auto-generated</p>
    </td></tr>
  </table>
</body></html>`;

    const transporter = nodemailer.createTransport({
        host: cfg.host, port: parseInt(cfg.port || '587', 10),
        secure: parseInt(cfg.port || '587', 10) === 465,
        auth: { user: cfg.user, pass: cfg.pass },
        tls: { rejectUnauthorized: false }
    });

    const result = await transporter.sendMail({
        from: '"SLTS QMS" <sltsqms@gmail.com>',
        to: 'prasad@slts.lk',
        subject: 'Live Browser Test: Approve/Reject Buttons',
        text: `Approve: ${approveUrl}\nReject: ${rejectUrl}`,
        html
    });

    console.log(`Email sent: ${result.messageId}`);
    console.log(`Approve: ${approveUrl}`);
    console.log(`Reject: ${rejectUrl}`);

    await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
