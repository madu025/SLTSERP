/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma stubs model only the exercised calls. */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { grnSchema, mrnSchema } from '@/lib/validations/inventory.schema';
import { prisma } from '@/lib/prisma';
import { GRNService } from '@/services/inventory/grn.service';
import { MRNService } from '@/services/inventory/mrn.service';
import { StoreService } from '@/services/inventory/store.service';

const db = prisma as any;
const originalUserFindUnique = db.user.findUnique;
const originalMrnFindUnique = db.mRN.findUnique;
const originalMrnUpdateMany = db.mRN.updateMany;
const originalTransaction = db.$transaction;
const originalStoreAccess = StoreService.assertStoreWriteAccess;

afterEach(() => {
  db.user.findUnique = originalUserFindUnique;
  db.mRN.findUnique = originalMrnFindUnique;
  db.mRN.updateMany = originalMrnUpdateMany;
  db.$transaction = originalTransaction;
  StoreService.assertStoreWriteAccess = originalStoreAccess;
});

test('GRN schema preserves procurement fields and rejects non-positive quantities', () => {
  const valid = grnSchema.safeParse({
    storeId: 'store-1',
    sourceType: 'LOCAL_PURCHASE',
    reference: 'INV-001',
    sltReferenceId: null,
    items: [{
      itemId: 'item-1',
      quantity: '2',
      serials: ['SN-1', 'SN-2'],
      expiryDate: '2027-01-01',
      locator: 'RACK-01',
    }],
  });

  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.items[0].quantity, 2);
    assert.equal(valid.data.reference, 'INV-001');
    assert.deepEqual(valid.data.items[0].serials, ['SN-1', 'SN-2']);
    assert.equal(valid.data.items[0].locator, 'RACK-01');
  }

  for (const quantity of [-1, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = grnSchema.safeParse({
      storeId: 'store-1',
      sourceType: 'SUPPLIER',
      items: [{ itemId: 'item-1', quantity }],
    });
    assert.equal(result.success, false, `invalid GRN quantity was accepted: ${quantity}`);
  }
});

test('MRN schema rejects non-positive quantities and normalizes numeric strings', () => {
  const valid = mrnSchema.safeParse({
    storeId: 'store-1',
    returnType: 'RETURN_TO_SUPPLIER',
    supplier: 'Supplier A',
    items: [{ itemId: 'item-1', quantity: '3.5', reason: 'Damaged packaging' }],
  });

  assert.equal(valid.success, true);
  if (valid.success) assert.equal(valid.data.items[0].quantity, 3.5);

  for (const quantity of [-1, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = mrnSchema.safeParse({
      storeId: 'store-1',
      returnType: 'RETURN_TO_SUPPLIER',
      items: [{ itemId: 'item-1', quantity }],
    });
    assert.equal(result.success, false, `invalid MRN quantity was accepted: ${quantity}`);
  }
});

test('GRN service rejects invalid quantities before store authorization or writes', async () => {
  let storeAuthorizationCalls = 0;
  StoreService.assertStoreWriteAccess = async () => { storeAuthorizationCalls++; };
  db.$transaction = async () => { throw new Error('transaction must not start'); };

  await assert.rejects(
    GRNService.createGRN({
      storeId: 'store-1',
      sourceType: 'SUPPLIER',
      receivedById: 'user-1',
      items: [{ itemId: 'item-1', quantity: -5 }],
    }),
    /INVALID_GRN_PAYLOAD/,
  );
  assert.equal(storeAuthorizationCalls, 0);
});

test('MRN service rejects invalid quantities before store authorization or writes', async () => {
  let storeAuthorizationCalls = 0;
  StoreService.assertStoreWriteAccess = async () => { storeAuthorizationCalls++; };
  db.$transaction = async () => { throw new Error('transaction must not start'); };

  await assert.rejects(
    MRNService.createMRN({
      storeId: 'store-1',
      returnType: 'RETURN_TO_SUPPLIER',
      returnedById: 'user-1',
      items: [{ itemId: 'item-1', quantity: -2 }],
    }),
    /INVALID_MRN_PAYLOAD/,
  );
  assert.equal(storeAuthorizationCalls, 0);
});

test('MRN approval requires canonical inventory approval permission', async () => {
  db.user.findUnique = async () => ({
    id: 'user-2',
    permissions: JSON.stringify([]),
    systemRole: null,
    sectionAssignments: [],
  });
  db.mRN.findUnique = async () => ({ returnedById: 'user-1', status: 'PENDING' });
  db.$transaction = async () => { throw new Error('transaction must not start'); };

  await assert.rejects(
    MRNService.updateMRNStatus('mrn-1', 'APPROVE', 'user-2'),
    /INVENTORY_ACTION_PERMISSION_DENIED/,
  );
});

test('legacy admin display role cannot bypass MRN self-approval', async () => {
  db.user.findUnique = async () => ({
    id: 'user-1',
    role: 'ADMIN',
    permissions: JSON.stringify(['inventory.approve']),
    systemRole: null,
    sectionAssignments: [],
  });
  db.mRN.findUnique = async () => ({ returnedById: 'user-1', status: 'PENDING' });
  db.$transaction = async () => { throw new Error('transaction must not start'); };

  await assert.rejects(
    MRNService.updateMRNStatus('mrn-1', 'APPROVE', 'user-1'),
    /SEGREGATION_OF_DUTIES_VIOLATION/,
  );
});
