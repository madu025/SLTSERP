# Email Template Customization Plan

## Overview
Convert hardcoded email templates in `dynamic-approval.service.ts` to a database-driven, customizable template system with placeholder support.

## Current State
- Email templates are hardcoded in `src/services/approval/dynamic-approval.service.ts` (lines 74-92, 175-198)
- No admin UI to modify templates
- Placeholders are not standardized

## Target State
- Templates stored in database (`NotificationTemplate` table)
- Admin UI for template management
- Standardized placeholders: `{User}`, `{Entity}`, `{Approval}`, `{Rejected}`, `{Amount}`, etc.
- Multi-channel support: Email, In-App, SMS (future)

---

## Implementation Plan

### Phase 1: Database Schema (Prisma)

**File:** `prisma/schema/notification.prisma`

```prisma
model NotificationTemplate {
  id          String   @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid
  code        String   @unique  // e.g., "APPROVAL_MATERIAL_REQUEST", "APPROVAL_SOD_STATUS"
  name        String            // e.g., "Material Request Approval"
  description String?
  
  // Template Content
  subject     String            // Email subject with placeholders
  htmlBody    String            // HTML template with placeholders
  textBody    String?           // Plain text fallback
  
  // Configuration
  entityType  String            // e.g., "MATERIAL_REQUEST", "SERVICE_ORDER"
  channels    String[]          // ["EMAIL", "IN_APP", "SMS"]
  
  // Metadata
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@map("notification_templates")
}
```

**Migration:** `prisma/migrations/YYYYMMDD_create_notification_templates/migration.sql`

---

### Phase 2: Template Engine Service

**File:** `src/services/notification/template-engine.service.ts`

```typescript
export class TemplateEngine {
  // Standard placeholders
  static readonly PLACEHOLDERS = {
    USER_NAME: '{{user}}',
    USER_EMAIL: '{{userEmail}}',
    USER_ROLE: '{{userRole}}',
    ENTITY_TYPE: '{{entityType}}',
    ENTITY_ID: '{{entityId}}',
    ENTITY_NAME: '{{entityName}}',
    APPROVAL_ACTION: '{{action}}',  // "Approved" or "Rejected"
    APPROVAL_STATUS: '{{status}}',  // "PENDING", "APPROVED", "REJECTED"
    AMOUNT: '{{amount}}',
    DATE: '{{date}}',
    APPROVE_URL: '{{approveUrl}}',
    REJECT_URL: '{{rejectUrl}}',
    EXPIRY_HOURS: '{{expiryHours}}'
  };

  /**
   * Render template with variable substitution
   */
  static render(
    template: string, 
    variables: Record<string, string | number | boolean | undefined>
  ): string {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
      const val = variables[key];
      return val !== undefined && val !== null ? String(val) : match;
    });
  }

  /**
   * Load template from DB and render
   */
  static async renderByCode(
    code: string, 
    variables: Record<string, string | number | boolean | undefined>
  ): Promise<{ subject: string; html: string; text: string; channels: string[] } | null> {
    const template = await prisma.notificationTemplate.findUnique({
      where: { code, isActive: true }
    });

    if (!template) return null;

    return {
      subject: this.render(template.subject, variables),
      html: this.render(template.htmlBody, variables),
      text: this.render(template.textBody || '', variables),
      channels: template.channels
    };
  }
}
```

---

### Phase 3: Email Service Update

**File:** `src/services/approval/dynamic-approval.service.ts`

**Replace hardcoded templates with:**

```typescript
static async sendMaterialRequestEmail(
  instanceId: string,
  stockRequestId: string,
  approverEmail: string,
  userId: string,
  requiredRole: string
) {
  // 1. Fetch stock request data
  const stockRequest = await prisma.stockRequest.findUnique({ ... });

  // 2. Generate tokens
  const approveToken = this.generateActionToken(instanceId, 'APPROVED', userId);
  const rejectToken = this.generateActionToken(instanceId, 'REJECTED', userId);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sltserp.vercel.app';
  const approveUrl = `${baseUrl}/api/approvals/webhook?token=${approveToken}`;
  const rejectUrl = `${baseUrl}/api/approvals/webhook?token=${rejectToken}`;

  // 3. Load template from DB
  const rendered = await TemplateEngine.renderByCode('APPROVAL_MATERIAL_REQUEST', {
    user: approverEmail,
    entityType: 'Material Request',
    entityId: stockRequest.requestNr,
    entityName: stockRequest.purpose || 'N/A',
    action: 'APPROVED',
    amount: stockRequest.items.reduce((sum, i) => sum + Number(i.requestedQty), 0),
    approveUrl,
    rejectUrl,
    expiryHours: 48
  });

  // 4. Fallback to hardcoded if template not found
  if (!rendered) {
    // Use existing hardcoded template as fallback
    console.warn('[DynamicApprovalService] Template APPROVAL_MATERIAL_REQUEST not found, using fallback');
    // ... existing hardcoded template
  }

  // 5. Send email
  await EmailService.sendMail({
    to: approverEmail,
    subject: rendered?.subject || `Action Required: Material Request ${stockRequest.requestNr}`,
    text: rendered?.text || 'Please approve or reject the request.',
    html: rendered?.html
  });
}
```

---

### Phase 4: Admin UI for Template Management

**File:** `src/app/admin/settings/notification-templates/page.tsx`

**Features:**
1. List all templates with search/filter
2. Create new template
3. Edit existing template with:
   - Code (unique identifier)
   - Name
   - Subject (with placeholder picker)
   - HTML Body (rich text editor)
   - Text Body (fallback)
   - Channels (checkboxes: Email, In-App, SMS)
4. Preview template with sample data
5. Test send to email

**Placeholder Picker Component:**
```typescript
const PlaceholderPicker = ({ onInsert }) => (
  <div>
    <button onClick={() => onInsert('{{user}}')}>User Name</button>
    <button onClick={() => onInsert('{{entityType}}')}>Entity Type</button>
    <button onClick={() => onInsert('{{approveUrl}}')}>Approve URL</button>
    {/* ... more placeholders */}
  </div>
);
```

---

### Phase 5: Seed Data

**File:** `prisma/seed-notification-templates.ts`

**Default templates to seed:**

```typescript
const templates = [
  {
    code: 'APPROVAL_MATERIAL_REQUEST',
    name: 'Material Request Approval',
    subject: 'Action Required: {{entityType}} #{{entityId}}',
    htmlBody: `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Approval Required: {{entityType}} #{{entityId}}</h2>
          <p>Dear {{user}},</p>
          <p>You have been assigned to approve this request as <strong>{{userRole}}</strong>.</p>
          <p><strong>Entity:</strong> {{entityName}}</p>
          {{#if amount}}<p><strong>Amount:</strong> LKR {{amount}}</p>{{/if}}
          <div style="margin-top: 20px;">
            <a href="{{approveUrl}}" style="background-color: #22c55e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Approve</a>
            <a href="{{rejectUrl}}" style="background-color: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reject</a>
          </div>
          <p style="margin-top: 20px; font-size: 12px; color: #666;">This action link expires in {{expiryHours}} hours.</p>
        </body>
      </html>
    `,
    channels: ['EMAIL']
  },
  {
    code: 'APPROVAL_SOD_STATUS',
    name: 'SOD Status Change Approval',
    subject: 'Approval Required: SOD Status Change',
    htmlBody: '...',
    channels: ['EMAIL', 'IN_APP']
  },
  {
    code: 'APPROVAL_GENERIC',
    name: 'Generic Approval Request',
    subject: 'Action Required: {{entityType}} Approval',
    htmlBody: '...',
    channels: ['EMAIL']
  }
];
```

---

## Migration Steps

### Step 1: Create Schema
```bash
npx prisma migrate dev --name create_notification_templates
```

### Step 2: Seed Templates
```bash
npx tsx prisma/seed-notification-templates.ts
```

### Step 3: Update Services
- Update `dynamic-approval.service.ts` to use `TemplateEngine`
- Update `email.service.ts` to support channels

### Step 4: Create Admin UI
- Create `/admin/settings/notification-templates/page.tsx`
- Add to sidebar menu

### Step 5: Remove Hardcoded Templates
- Replace hardcoded templates with DB lookups
- Keep fallback for backward compatibility

---

## Testing Checklist

- [ ] Template renders correctly with placeholders
- [ ] Email sends with custom template
- [ ] Admin can create/edit templates
- [ ] Admin can preview templates
- [ ] Test send works
- [ ] Fallback to hardcoded if template missing
- [ ] Multi-channel support (Email + In-App)

---

## Future Enhancements

1. **Conditional Logic**: `{{#if amount}}Show amount{{/if}}`
2. **Localization**: Multi-language templates (si, en)
3. **Attachments**: Dynamic PDF generation
4. **SMS Integration**: Twilio/DirectSMS gateway
5. **Template Versioning**: Track changes over time
6. **A/B Testing**: Test different template variations

---

## Notes

- Current hardcoded templates remain as fallback until DB templates are created
- `EmailService.sendMail()` already has testing override (line 84: redirects to prasad@slts.lk)
- Remove testing override before production deployment
- SMTP config should be in environment variables, not hardcoded
