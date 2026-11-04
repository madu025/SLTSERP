import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickDropWireStock, pickOntStock } from '../../src/lib/sod-material-items';

const s = (code: string, name: string, quantity = 1) => ({ quantity, item: { id: code, code, name } });

test('drop wire is chosen by exact code, never the retainer whose code contains DW', () => {
  const stock = [s('OSP-NC-ACC-DWRETNER', 'Drop Wire Retainer', 6), s('OSPFTA003', 'Fiber Drop Wire', 54), s('OSPFTA005', 'Fiber Drop Wire Retainer(White)', 9)];
  assert.equal(pickDropWireStock(stock)?.item.code, 'OSPFTA003');
  // Order of the stock list must not matter (it changes whenever a row is updated).
  assert.equal(pickDropWireStock([...stock].reverse())?.item.code, 'OSPFTA003');
});

test('with both drop wire codes the one holding more stock wins; none held gives undefined', () => {
  assert.equal(pickDropWireStock([s('OSPFTA003', 'a', 5), s('OSP-HC-CBL-DW', 'b', 80)])?.item.code, 'OSP-HC-CBL-DW');
  assert.equal(pickDropWireStock([s('OSP-NC-ACC-DWRETNER', 'Drop Wire Retainer')]), undefined);
});

test('ONT matches whole words only', () => {
  assert.equal(pickOntStock([s('OSP-JNT-001', 'Joint'), s('POINT-1', 'Access point'), s('ONT-GPON', 'ONT Router')])?.item.code, 'ONT-GPON');
  assert.equal(pickOntStock([s('OSP-FRONT', 'Front panel'), s('X', 'Controller')]), undefined);
});
