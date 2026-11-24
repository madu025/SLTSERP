---
name: sltserp-handover
description: Orient yourself in the SLTSERP code base before building or changing anything - authorization rules (capabilities, menu levels, no role names), site-office petty cash, approvals, deploy and test habits. Use at the start of any SLTSERP feature, review or QA task, and after a long break from the project.
---

# SLTSERP handover

1. Read `docs/ai-handover.md` (concepts, rules, how to test, known gaps), then `docs/CHANGELOG.md` for what changed lately.
2. Before adding a page, an approval or a menu entry follow the checklist in `docs/authorization-architecture.md`
   ("How to add a page, an approval or a menu entry"). One capability decides menu, page and API; no role name in runtime code.
3. Run the guards: `pnpm exec tsc --noEmit`, `pnpm run test:unit`, `pnpm run rbac:check`, `pnpm run check:guides`;
   audit menu against page rules with `pnpm exec tsx scripts/zz-audit-pages.ts`.
4. Production: ask before a schema migration or the RBAC seed; push and deploy are approved every time; after a deploy that adds a capability,
   check the database for it.

## Keeping this skill current

When a concept in `docs/ai-handover.md` changes (a new module rule, a new capability family, a new known gap, a changed deploy habit), edit that
file and add one line to `docs/CHANGELOG.md` in the same change. This skill only points to those files, so it needs no edit unless the file
names change.
