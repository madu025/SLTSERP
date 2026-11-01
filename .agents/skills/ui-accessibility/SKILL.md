---
name: ui-accessibility
description: Build and review SLTSERP UI for high contrast, accessible controls, clear errors, and reliable browser selectors.
metadata:
  short-description: Prevent invisible text and inaccessible workflows
---

# UI accessibility and QA contracts

Use for any React/Tailwind/page/sidebar/modal/table/form or selector change.

- Follow the high-contrast rules in `AGENTS.md`: never use light text on light
  surfaces or dark text on dark surfaces; verify table-header CSS overrides.
- Give buttons, form fields, dialogs, status messages, and navigation controls
  stable accessible names/labels. Use semantic roles only when they match the
  actual interaction; do not make tests expect a nonexistent `tablist`.
- Preserve keyboard focus, disabled/locked states, loading/error states, and
  visible validation feedback.
- Test the rendered contract with Playwright at desktop and mobile widths.
  Prefer role/name and label locators over brittle CSS or text fragments.
- Check WCAG contrast for titles, headers, KPI badges, and button labels before
  handoff.
