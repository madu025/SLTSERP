import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { groundValue, editDistance, norm, describeSearch, SERVICE_ORDER_STATUSES, ENTITY_DICTIONARY } from '../../src/services/ai/semantic-layer.service';

const RTOMS = ['R-JA', 'R-JK', 'R-KX', 'R-HO', 'R-HK', 'R-MD'];

test('exact matches ignore case, spaces and punctuation', () => {
    assert.deepEqual(groundValue('r-ja', RTOMS), { kind: 'match', value: 'R-JA' });
    assert.deepEqual(groundValue('R JA', RTOMS), { kind: 'match', value: 'R-JA' });
    assert.deepEqual(groundValue(' rja ', RTOMS), { kind: 'match', value: 'R-JA' });
});

test('a prefix shared by several values is a question, not a guess', () => {
    const g = groundValue('R-J', RTOMS);
    assert.equal(g.kind, 'ambiguous');
    assert.deepEqual(g.kind === 'ambiguous' ? g.options.sort() : [], ['R-JA', 'R-JK']);
    assert.deepEqual(groundValue('R-M', RTOMS), { kind: 'match', value: 'R-MD' }); // unique prefix
});

test('a value that does not exist is reported with the closest real ones, never silently accepted', () => {
    const g = groundValue('R-XYZ', RTOMS);
    assert.equal(g.kind, 'none');
    assert.ok(g.kind === 'none' && g.suggestions.length > 0 && g.suggestions.length <= 5);
    assert.equal(groundValue('', RTOMS).kind, 'none');
});

test('one clear typo is corrected, two equally close values are a question', () => {
    assert.deepEqual(groundValue('R-KZ', ['R-KX', 'R-HO', 'R-MD']), { kind: 'match', value: 'R-KX' });
    assert.equal(groundValue('R-HZ', ['R-HO', 'R-HK']).kind, 'ambiguous');
});

test('status words people use map to the real enum values', () => {
    const syn = { COMPLETED: ['completed', 'complete', 'done', 'finished'], PENDING: ['pending', 'waiting'], INPROGRESS: ['in progress', 'ongoing'] };
    assert.deepEqual(groundValue('done', SERVICE_ORDER_STATUSES, syn), { kind: 'match', value: 'COMPLETED' });
    assert.deepEqual(groundValue('Pending', SERVICE_ORDER_STATUSES, syn), { kind: 'match', value: 'PENDING' });
    assert.deepEqual(groundValue('in progress', SERVICE_ORDER_STATUSES, syn), { kind: 'match', value: 'INPROGRESS' });
    assert.equal(groundValue('closed', SERVICE_ORDER_STATUSES, syn).kind, 'ambiguous'); // INSTALL_CLOSED or PROV_CLOSED
    assert.equal(groundValue('foobar', SERVICE_ORDER_STATUSES, syn).kind, 'none');
});

test('helpers and the one-line description of what was searched', () => {
    assert.equal(editDistance('kitten', 'sitting'), 3);
    assert.equal(norm('R-J A'), 'rja');
    assert.ok(ENTITY_DICTIONARY.serviceOrder.fields.rtom.synonyms.includes('area'));
    const line = describeSearch({ entity: 'serviceOrder', filters: [{ field: 'rtom', operator: 'equals', value: 'R-JA' }, { field: 'status', operator: 'equals', value: 'PENDING' }], rows: 31, asOf: new Date('2026-11-17T15:19:00Z'), scope: 'limited to your OPMC' });
    assert.equal(line, 'Service orders · RTOM equals R-JA and Status equals PENDING · limited to your OPMC · 31 rows · as of 2026-11-17 15:19 UTC');
    assert.match(describeSearch({ entity: 'wastage', rows: 500, capped: true }), /no filters · 500\+ rows/);
});

after(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref?.(); });
