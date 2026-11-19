import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { GUIDES } from '../../src/content/guides';
import { guideFreshness, guideProblems } from '../../src/content/guides/verify';
import { GuideService, pageTrail } from '../../src/services/guides/guide.service';
import { NexusLocalReplyService } from '../../src/services/ai/nexus-local-reply.service';
import { RBAC_PERMISSIONS } from '../../src/config/rbac-permissions';

const all = new Set<string>([RBAC_PERMISSIONS.SOD_READ, RBAC_PERMISSIONS.SOD_WRITE, RBAC_PERMISSIONS.SOD_INVOICE]);
const readOnly = new Set<string>([RBAC_PERMISSIONS.SOD_READ]);

for (const guide of GUIDES) {
    test(`${guide.id} guide: every claim still matches the code`, () => {
        assert.deepEqual(guideProblems(guide), [], 'a button, title or rule the guide mentions was renamed or removed: update the guide');
    });

    test(`${guide.id} guide: the code it describes has not changed since it was reviewed`, () => {
        const f = guideFreshness(guide);
        assert.equal(f.state, 'fresh', `files the ${guide.id} guide describes changed. Review src/content/guides/${guide.id}.guide.ts against them, update it, then run: pnpm run guides:stamp ${guide.id}`);
    });
}

test('questions find the right section', () => {
    assert.equal(GuideService.lookup('how do I complete an order and record material', all).sections[0].id, 'complete-order');
    assert.equal(GuideService.lookup('generate a contractor invoice', all).sections[0].id, 'engineer-invoicing');
    assert.equal(GuideService.lookup('assign contractor team', all).sections[0].id, 'assign-contractor');
    assert.equal(GuideService.lookup('return an order or restore it', all).sections[0].id, 'returns-and-restore');
    assert.equal(GuideService.lookup('why can I not see the invoice page, permission', all).sections[0].id, 'access');
});

test('the module name in a question does not drag every answer to the overview', () => {
    assert.equal(GuideService.lookup('assign service order to contractor', all).sections[0].id, 'assign-contractor');
    assert.equal(GuideService.lookup('verify and invoice a service order', all).sections[0].id, 'engineer-invoicing');
    assert.equal(GuideService.lookup('generate contractor invoice from completed service orders', all).sections[0].id, 'engineer-invoicing');
    assert.equal(GuideService.lookup('complete an order and record material', all).sections[0].id, 'complete-order');
    assert.equal(GuideService.lookup('invoice eka hadanne kohomada', all).sections[0].id, 'engineer-invoicing');
});

test('a question about another module is not answered with a stray shared word', () => {
    for (const q of ['create a new project and assign tasks', 'how do I raise a helpdesk ticket', 'how to issue stock to a store']) {
        const a = GuideService.lookup(q, all);
        assert.equal(a.matched, false, q);
        assert.equal(a.sections.length, 0, q);
    }
});

test('a question about the whole module gets the overview and the terms', () => {
    const a = GuideService.lookup('explain the SOD module to a new staff member', all);
    assert.equal(a.sections[0].id, 'overview');
    assert.ok(a.glossary.some((g) => g.term === 'PAT'));
    assert.ok(a.otherTopics.length > 5);
});

test('a term question includes its meaning', () => {
    assert.ok(GuideService.lookup('what is PAT approval', all).glossary.some((g) => g.term === 'PAT'));
});

test('a question the guide does not cover is not answered by guessing', () => {
    const a = GuideService.lookup('how do I book a company vehicle for a trip', all);
    assert.equal(a.matched, false);
    assert.equal(a.sections.every((s) => s.steps.length === 0 || s.id === 'overview'), true);
    const text = NexusLocalReplyService.build([{ name: 'getSystemGuide', args: {}, result: a }], 'x').text;
    assert.match(text, /will not guess/);
});

test('a user without the capability is told what is missing instead of being taught the steps', () => {
    const a = GuideService.lookup('generate a contractor invoice', readOnly);
    const s = a.sections[0];
    assert.equal(s.id, 'engineer-invoicing');
    assert.equal(s.steps.length, 0);
    assert.match(s.blocked ?? '', /sod\.invoice/);
    const c = GuideService.lookup('complete an order', readOnly).sections[0];
    assert.match(c.blocked ?? '', /sod\.write/);
    assert.ok(GuideService.lookup('how to follow PAT approvals', readOnly).sections[0].steps.length > 0, 'read access is enough for the PAT monitor');
});

test('the contractor portal section is not blocked by an office capability', () => {
    const s = GuideService.lookup('contractor portal field sods van stock', new Set()).sections[0];
    assert.equal(s.id, 'contractor-field-sods');
    assert.ok(s.steps.length > 0);
});

test('"where" comes from the real sidebar', () => {
    assert.equal(pageTrail('/service-orders/work-order'), 'Service Orders → Pending SOD');
    assert.equal(pageTrail('/service-orders/invoicing'), 'Service Orders → Invoicing');
    assert.equal(pageTrail('/nope'), undefined);
});

test('the assistant renders a guide as numbered steps and says it used no ERP data', () => {
    const a = GuideService.lookup('how to assign contractor team', all);
    const built = NexusLocalReplyService.build([{ name: 'getSystemGuide', args: { topic: 'assign contractor' }, result: a }], 'how do I assign');
    assert.match(built.text, /Where: Service Orders → Pending SOD/);
    assert.match(built.text, /\n1\. /);
    assert.match(built.text, /Assign Contractor Team/);
    assert.match(built.evidence ?? '', /no ERP data used/);
    assert.equal(built.table, undefined);
});

after(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref?.(); });
