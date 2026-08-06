# QA Agent Reports

This directory is populated by Playwright runs:

- `results.json` — machine-readable test results (Playwright JSON reporter)
- `html/` — HTML report (Playwright HTML reporter)
- `bugs.json` — JSON-lines bug log written by `writeBugEntry()` helper

Contents are `.gitignore`'d. To regenerate, run:

```powershell
npx playwright test --config=tests/qa-agent/_infrastructure/playwright.config.ts
```
