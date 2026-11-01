---
name: email-templates
description: Wire every SLTSERP email sender to the database notification-template registry and verify template coverage.
metadata:
  short-description: Keep email delivery registry-driven and auditable
---

# Email template wiring

Use whenever code adds or changes `EmailService.sendMail(...)` or any workflow
that sends notifications.

- Register a `TEMPLATE_CODES` entry in `src/config/notification-templates.ts`
  with label, description, category, placeholders, and default entity type.
- Seed a styled default template in `prisma/seed-notification-templates.ts`.
- Render with `NotificationTemplateEngineService.renderEmailByCode(...)` and
  use hardcoded HTML only as an explicit no-active-template fallback.
- Preserve tenant/entity context and never put secrets or uncontrolled HTML in
  template variables.
- Run `pnpm run check:email-templates` and the relevant notification tests.
