---
name: update-system-guides
description: Keep the Nexus assistant's step-by-step system guides in step with the code. Use after changing any screen, button, workflow, status, permission or business rule of a module that has a guide (src/content/guides), when `pnpm run check:guides` or the system-guides unit test fails, or when writing a guide for a new module.
---

# Update the system guides

The guides (`src/content/guides/<module>.guide.ts`) teach new staff how to use the ERP. The Nexus assistant answers
"how do I...?" questions from them (tool `getSystemGuide`), filtered by what the asking user is allowed to do.
A guide is only useful if it is true, so two checks tie it to the code:

- **Anchors**: each section lists text that must still exist in a named source file (a button label, a page title, a
  rule code). If you rename or delete it, `tests/unit/system-guides.test.ts` fails.
- **Fingerprint**: each guide lists the files and folders it describes (`watch`). `pnpm run check:guides` hashes them and
  compares with `src/content/guides/guide-stamps.json`. Any change in those files makes the guide **stale** (the same
  test fails) until the guide is reviewed and re-stamped.

## When code changes in a guided module

1. Run `pnpm run check:guides`. It names the stale guide, or lists claims that no longer match.
2. Look at what changed (`git diff` of the files in the guide's `watch` list). For every change ask: does a step, tip,
   label, status, permission or rule in the guide now say something different?
3. Edit `src/content/guides/<module>.guide.ts`:
   - Use the exact labels on screen, copied from the source, in the order a person meets them.
   - New screen, button, status or rule that staff will meet: add or extend a section, with at least one anchor.
   - Removed or renamed thing: remove or rename it in the steps and in the anchors.
   - `requires` is the capability from `src/config/rbac-permissions.ts`; `page` is a sidebar path. Never hard-code a role name.
   - Write only what the code does. If you cannot confirm a behaviour in the source, leave it out or say less.
4. Run `pnpm run check:guides`, fix any problem it prints, then `pnpm run guides:stamp <module>`.
   Never stamp without step 2: stamping only records that someone read the change.
5. Run `node --import tsx --test tests/unit/system-guides.test.ts`.
6. Commit the guide, `guide-stamps.json` and the code change together.

## Writing a guide for a new module

1. Read the module's pages, modals, services and permissions. Check the sidebar entries and the RBAC permission codes.
2. Create `src/content/guides/<module>.guide.ts` exporting a `ModuleGuide` (see `sod.guide.ts` and `types.ts`):
   purpose, `watch` list, glossary, and sections (overview first, then one section per task a new person must do).
3. Register it in `src/content/guides/index.ts`, add `"<module>": { "stamp": "pending", "reviewedAt": "<date>" }` to
   `guide-stamps.json`, run `pnpm run guides:stamp <module>`, then add tests for the questions people will ask
   (see `tests/unit/system-guides.test.ts`).
4. Add the module to the `getSystemGuide` tool description in `src/services/ai/nexus-agent.service.ts` so the model knows
   it is covered.

## Rules for the text

- Staff-facing English, short numbered steps, exact on-screen labels, no developer terms.
- Say who can do it through `requires`; the assistant withholds the steps from users who lack it.
- Business rules (what blocks billing, what a status means) must be taken from the code that enforces them, with an
  anchor on the rule.
- Do not put customer, contractor, financial or other ERP data in a guide. Guides are public-safe text.

## Modules with a guide

| Module | Guide | Describes |
|---|---|---|
| Service Orders (SOD) | `sod.guide.ts` | `/service-orders/*`, contractor Field SODs, SOD modals and rules |
| Purchase flow | `purchase.guide.ts` | material request to HO payment: `/inventory/requests`, `/procurement/approvals`, `/procurement/orders`, `/inventory/grn`, `/finance/ho-payments`, `/procurement/payment-approvals`, `/procurement/vendor-payments` |
| Opening stock | `opening-stock.guide.ts` | `/inventory/admin/initial`: go-live stock per store, Excel upload, second-person approval |

Modules still to be written: Projects, Inventory/Stores (other than purchasing), Finance (other than vendor payments), Contractors, Helpdesk, Fleet, Administration.
