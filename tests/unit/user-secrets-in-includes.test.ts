import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * A person (User) linked to a record must not be included with `true`: that sends the password hash, the security answer and the
 * token version to the browser with the record. Use `{ select: PUBLIC_USER_SELECT }` (src/lib/public-user-select.ts).
 * Found on 26 Nov 2026: the material request list sent the requester's password hash to every reader of the list.
 */
const USER_RELATIONS = /\b(requestedBy|receivedBy|approvedBy|createdBy|issuedBy|releasedBy|rejectedBy|verifiedBy|submittedBy|reviewedBy|recordedBy|postedBy|preparedBy|checkedBy|uploadedBy|updatedBy|closedBy|completedBy|cancelledBy|requester|initiator)\s*:\s*true\b/;

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

test('no User relation is included whole (password hash, security answer, token version)', () => {
  const offenders: string[] = [];
  for (const dir of ['src/services', 'src/repositories', 'src/app/api']) {
    for (const f of files(dir)) {
      fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (USER_RELATIONS.test(line) && !/select\s*:\s*\{[^}]*$/.test(line)) offenders.push(`${f}:${i + 1} ${line.trim()}`);
      });
    }
  }
  assert.deepEqual(offenders, [], 'include the person with { select: PUBLIC_USER_SELECT }');
});
