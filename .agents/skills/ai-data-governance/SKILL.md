---
name: ai-data-governance
description: Govern SLTSERP AI and agent features for prompt injection, sensitive data, tool authorization, output validation, and auditability.
metadata:
  short-description: Keep AI-assisted decisions bounded and auditable
---

# AI and data governance

Use for AI predictions, Nexus agents, classifiers, training data, prompts,
automated actions, or model-generated reports.

- Treat user content, documents, and retrieved records as untrusted prompt
  data; separate instructions from data and defend against prompt injection.
- Minimize and redact personal, financial, credential, and tenant data before
  model calls. Never send secrets or unrestricted cross-tenant context.
- Authorize every tool/action independently with canonical permissions and
  scope; model output must never become an approval or database mutation by
  itself.
- Validate structured model output against a schema, preserve uncertainty and
  provenance, and require human approval for financial, inventory, access, or
  destructive actions.
- Log model/version, input classification, action decision, and reviewer outcome
  without storing raw sensitive prompts.
