---
trigger: model_decision
description: How to navigate the SLTSERP codebase using the generated CODEMAP before broad searches. Use when locating services, API routes, Prisma models, or functions, or before any cross-module change.
---

# CODEMAP Navigation Rule

The codebase map lives at `.agent/CODEMAP.md` (~500 KB). It indexes services, functions, database models, and API routes with line numbers.

Rules:

1. NEVER read `.agent/CODEMAP.md` end-to-end — it is too large.
2. Use grep to pinpoint matching line numbers in the map, then load only the required slice of the target file.
3. Consult the map BEFORE broad codebase searches or loading entire files, to conserve tokens.
4. After any structural change (new service, route, model, or moved file), run `npm run codemap:update` to keep the map in sync.
