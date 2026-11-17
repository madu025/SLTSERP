import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { NexusClassifierService } from '../../src/services/ai/nexus-classifier.service';
import { NexusAgentService } from '../../src/services/ai/nexus-agent.service';

type Tool = (args: Record<string, unknown>, perms: ReadonlySet<string>, scope: readonly string[] | undefined) => Promise<{ error?: string }>;
const tool = (NexusAgentService as unknown as { runCustomReportTool: Tool }).runCustomReportTool.bind(NexusAgentService);

test('custom report is refused without the entity capability', async () => {
    const r = await tool({ entity: 'journalEntry', columns: ['id'] }, new Set(['sod.read']), undefined);
    assert.match(r.error ?? '', /do not have access/);
});

test('cost and revenue columns need their own capability', async () => {
    const cost = await tool({ entity: 'materialUsage', columns: ['costPrice'] }, new Set(['sod.read']), undefined);
    assert.match(cost.error ?? '', /cost/i);
    const rev = await tool({ entity: 'serviceOrder', columns: ['revenueAmount'] }, new Set(['sod.read']), undefined);
    assert.match(rev.error ?? '', /finance/i);
});

test('OPMC-scoped users cannot report on company-wide entities', async () => {
    const r = await tool({ entity: 'wastage', columns: ['id'] }, new Set(['inventory.read']), ['opmc-1']);
    assert.match(r.error ?? '', /company-wide/);
});

test('unknown entity is refused', async () => {
    const r = await tool({ entity: 'user', columns: ['password'] }, new Set(['sod.read']), undefined);
    assert.match(r.error ?? '', /do not have access/);
});

test('local fixed answers are limited to phrasings the classifier was trained on', async () => {
    assert.equal(await NexusClassifierService.hasNearExample('outstanding invoices monawada', 'FINANCE'), true);
    // an unseen report request must go to the agent, not to a canned module summary
    assert.equal(await NexusClassifierService.hasNearExample('service orders status wise count report eka hadala denna', 'PROCUREMENT'), false);
});

// Importing the service opens Prisma/Redis handles; do not wait for them to idle out.
after(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref?.(); });
