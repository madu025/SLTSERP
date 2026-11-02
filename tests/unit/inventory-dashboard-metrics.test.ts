import test from 'node:test';
import assert from 'node:assert/strict';
import {
    availableInventoryQuantity,
    effectiveInventoryMinLevel,
    isInventoryOverAllocated,
    isInventoryReorderNeeded,
} from '../../src/lib/inventory-dashboard-metrics';
import { RBAC_PERMISSIONS } from '../../src/config/rbac-permissions';
import { getStockRequestActionPermission } from '../../src/lib/inventory-stock-request-permissions';

test('inventory dashboards subtract allocated reservations from available stock', () => {
    const row = { quantity: 10, allocatedQuantity: 9, minLevel: 5, itemMinLevel: 2 };

    assert.equal(availableInventoryQuantity(row), 1);
    assert.equal(isInventoryReorderNeeded(row), true);
    assert.equal(isInventoryOverAllocated(row), false);
});

test('item minimum is used when the store minimum is not configured', () => {
    const row = { quantity: 7, allocatedQuantity: 0, minLevel: 0, itemMinLevel: 8 };

    assert.equal(effectiveInventoryMinLevel(row), 8);
    assert.equal(isInventoryReorderNeeded(row), true);
});

test('negative available stock is always a data-quality and reorder exception', () => {
    const row = { quantity: 4, allocatedQuantity: 6, minLevel: 0, itemMinLevel: 0 };

    assert.equal(availableInventoryQuantity(row), -2);
    assert.equal(isInventoryOverAllocated(row), true);
    assert.equal(isInventoryReorderNeeded(row), true);
});

test('zero minimum does not create a false low-stock alert for positive available stock', () => {
    const row = { quantity: 4, allocatedQuantity: 1, minLevel: 0, itemMinLevel: 0 };

    assert.equal(availableInventoryQuantity(row), 3);
    assert.equal(isInventoryReorderNeeded(row), false);
});

test('stock request actions use canonical capability boundaries', () => {
    assert.equal(getStockRequestActionPermission('ARM_APPROVE'), RBAC_PERMISSIONS.INVENTORY_APPROVE);
    assert.equal(getStockRequestActionPermission('RELEASE'), RBAC_PERMISSIONS.INVENTORY_WRITE);
    assert.equal(getStockRequestActionPermission('CREATE_PO'), RBAC_PERMISSIONS.PROCUREMENT_WRITE);
    assert.equal(getStockRequestActionPermission('UNKNOWN'), undefined);
});
