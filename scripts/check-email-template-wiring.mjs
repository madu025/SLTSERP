#!/usr/bin/env node
/**
 * Email Template Wiring Guard
 * ----------------------------
 * Enforces the SLTSERP mandate: every code path that sends an email via
 * EmailService.sendMail() MUST be wired to the DB notification template
 * system (NotificationTemplateEngineService.renderEmailByCode) so admins
 * can customize the email from the admin UI.
 *
 * Usage: npm run check:email-templates
 *
 * Exit codes: 0 = all send sites wired, 1 = unwired send site detected.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const SRC_DIR = join(ROOT, 'src');

// Files allowed to call sendMail without a DB template lookup.
// email.service.ts defines the transport itself.
const WHITELIST = [
  'src/services/notification/email.service.ts'
];

const SEND_CALL_RE = /EmailService\.sendMail\s*\(/;
const WIRED_RE = /renderEmailByCode\s*\(/;

/** Recursively collect .ts/.tsx files under a directory. */
function collectFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function main() {
  const files = collectFiles(SRC_DIR);
  const violations = [];
  let wiredCount = 0;

  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    const src = readFileSync(file, 'utf8');
    if (!SEND_CALL_RE.test(src)) continue;
    if (WHITELIST.includes(rel)) continue;

    if (WIRED_RE.test(src)) {
      wiredCount++;
    } else {
      violations.push(rel);
    }
  }

  console.log(`[email-template-guard] Scanned ${files.length} files under src/`);
  console.log(`[email-template-guard] Wired send sites (renderEmailByCode): ${wiredCount}`);

  if (violations.length > 0) {
    console.error('\n[email-template-guard] VIOLATION: email sent without DB template wiring:');
    for (const v of violations) {
      console.error(`  - ${v}`);
    }
    console.error(`
Fix required (MANDATORY):
  1. Register a template code in src/config/notification-templates.ts (TEMPLATE_CODES)
  2. Seed a default HTML template in prisma/seed-notification-templates.ts
  3. Call NotificationTemplateEngineService.renderEmailByCode(CODE, vars) and
     fall back to hardcoded HTML only when no DB template exists.
`);
    process.exit(1);
  }

  console.log('[email-template-guard] OK - all email send sites are template-wired.');
  process.exit(0);
}

main();
