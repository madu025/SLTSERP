import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NexusPrivacyService } from '../../src/services/ai/nexus-privacy.service';

test('phone numbers, e-mail addresses and NICs are masked in free text', () => {
    const t = NexusPrivacyService.maskText('call 0771234567 or +94711234567, mail a.b@slt.lk, NIC 912345678V and 199123456789, SO 112233', 'standard');
    assert.match(t, /\[phone\]/);
    assert.match(t, /\[email\]/);
    assert.match(t, /\[nic\]/);
    assert.doesNotMatch(t, /0771234567|a\.b@slt\.lk|912345678V/);
    assert.match(t, /SO 112233/); // order numbers are not personal data
});

test('personal fields in tool results are masked, numbers and business fields are kept', () => {
    const r = NexusPrivacyService.forModel('getServiceOrderProgressContext', { rtom: 'R-JA', count: 5, customerName: 'A B', rows: [{ voiceNumber: '0112345678', status: 'PENDING', amount: 10 }] }, 'standard') as { rtom: string; count: number; customerName: string; rows: { voiceNumber: string; status: string; amount: number }[] };
    assert.equal(r.customerName, '[masked]');
    assert.equal(r.rows[0].voiceNumber, '[masked]');
    assert.equal(r.rows[0].status, 'PENDING');
    assert.equal(r.rows[0].amount, 10);
    assert.equal(r.count, 5);
});

test('strict mode never sends report rows, only columns, count and numeric totals', () => {
    const r = NexusPrivacyService.forModel('runCustomReport', {
        type: 'STANDARD', columns: ['customerName', 'amount'], totalRows: 2,
        rows: [{ customerName: 'Nimal', amount: 100 }, { customerName: 'Kamal', amount: 50 }],
    }, 'strict') as { rows?: unknown; numericTotals: Record<string, { sum: number; min: number; max: number }>; totalRows: number };
    assert.equal(r.rows, undefined);
    assert.equal(JSON.stringify(r).includes('Nimal'), false);
    assert.equal(r.numericTotals.amount.sum, 150);
    assert.equal(r.totalRows, 2);
});

test('off mode changes nothing, and local models default to off while external ones default to standard', () => {
    assert.equal(NexusPrivacyService.maskText('0771234567', 'off'), '0771234567');
    const saved = process.env.NEXUS_PRIVACY_MODE;
    delete process.env.NEXUS_PRIVACY_MODE;
    assert.equal(NexusPrivacyService.mode('local'), 'off');
    assert.equal(NexusPrivacyService.mode('external'), 'standard');
    process.env.NEXUS_PRIVACY_MODE = 'strict';
    assert.equal(NexusPrivacyService.mode('local'), 'strict');
    if (saved === undefined) delete process.env.NEXUS_PRIVACY_MODE; else process.env.NEXUS_PRIVACY_MODE = saved;
});
