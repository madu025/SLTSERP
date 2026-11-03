---
name: browser-qa
description: Run authenticated SLTSERP browser and lifecycle QA with real database writes, read-back evidence, and role boundaries.
metadata:
  short-description: Verify real UI workflows without mocks
---

# Real browser QA

Use for Project, Finance, Inventory, approvals, or any request for end-to-end
browser validation.

- Use Playwright/Chromium with a dedicated authenticated fixture account; never
  print or commit credentials.
- Exercise the UI, not only direct API calls. API setup is allowed only to
  create a clearly identified fixture when the UI cannot create prerequisites.
- Verify each mutation through UI state, API read-back, and the relevant
  database/read model/ledger where applicable.
- Test maker submit -> checker login -> approve/reject -> reload -> downstream
  module, plus duplicate/self-approval and cross-scope negative cases.
- Do not use mocks, fake IDs, hard-coded tokens, simulated identities, or
  `test.skip` for setup gaps. Repair the fixture or record the exact external
  prerequisite failure.
- Keep local/API evidence separate from deployed production evidence. A PASS
  requires command output, URL/role, and persisted read-back evidence.

Use pnpm commands only. At minimum run the targeted Playwright project and the
related unit/type suites; collect screenshots and console/network evidence on
failure.

## Lessons from project hand-off QA

- Log in through the login form for any UI assertion. A cookie set by `fetch('/api/login')` leaves
  the header on "Guest" and hides permission-gated sidebar items. Access tokens expire after
  15 minutes, so re-login before assuming a 401 is a defect.
- Prefer one account per role with explicit permissions and a single OPMC scope; assert both the
  positive path and that the maker cannot act on their own item.
- Check the recipient's `/api/notifications` and queue after each hand-off; notification failures
  are swallowed by design, so absence is the only signal.
- See `project-workflow-notification-qa` for the project hand-off scenario and fixtures.
