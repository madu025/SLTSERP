import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siteOfficeCode } from '../../src/lib/site-office-access';

test('a site office code is readable and unique enough for document numbers', () => {
    assert.equal(siteOfficeCode('Kaduwela Store'), 'KADUWELA');
    assert.equal(siteOfficeCode('Nuwaraeliya Store'), 'NUWARAELIYA');
    assert.notEqual(siteOfficeCode('Matale Store'), siteOfficeCode('Matara Store'));
    assert.equal(siteOfficeCode('  '), 'SITE');
});
