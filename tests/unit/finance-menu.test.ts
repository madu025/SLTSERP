import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SIDEBAR_MENU } from '../../src/config/sidebar-menu';

type Item = { title: string; path: string; submenu?: Item[] };
const leaves = (items: Item[], group = ''): Array<{ group: string; title: string; path: string }> =>
    items.flatMap((i) => (i.submenu ? leaves(i.submenu, group ? `${group} > ${i.title}` : i.title) : [{ group, title: i.title, path: i.path }]));

const finance = SIDEBAR_MENU.find((m) => m.title === 'Finance & Accounting') as unknown as Item;
const all = leaves(SIDEBAR_MENU as unknown as Item[]);

test('no page is listed twice inside the Finance menu', () => {
    const seen = new Map<string, string>();
    for (const l of leaves(finance.submenu ?? [])) {
        assert.ok(!seen.has(l.path), `${l.path} is listed twice: "${seen.get(l.path)}" and "${l.group} > ${l.title}"`);
        seen.set(l.path, `${l.group} > ${l.title}`);
    }
});

test('no two Finance menu items share a title', () => {
    const titles = leaves(finance.submenu ?? []).map((l) => l.title);
    const dup = titles.filter((t, i) => titles.indexOf(t) !== i);
    assert.deepEqual(dup, [], `duplicate titles: ${dup.join(', ')}`);
});

test('the area invoice approval is one page, listed in Service Orders and not again in Finance', () => {
    assert.equal(all.filter((l) => l.path === '/invoices/confirmations').length, 1);
    assert.ok(!leaves(finance.submenu ?? []).some((l) => l.path === '/invoices/confirmations'));
});

test('petty cash has its own menu entry, opened by the petty cash capability and not by the Finance menu', () => {
    const top = (SIDEBAR_MENU as unknown as Array<Item & { permissionId?: string }>).find((m) => m.path === '/petty-cash');
    assert.ok(top, 'a top-level Petty Cash entry');
    assert.equal(top!.permissionId, 'petty-cash.site');
    assert.ok(!leaves(finance.submenu ?? []).some((l) => l.path === '/finance/petty-cash' || l.path === '/petty-cash'), 'not repeated under Finance');
});

test('every finance page can be opened from the menu (a redirect page is the only exception)', () => {
    const menu = new Set(all.map((l) => l.path));
    const pages: string[] = [];
    const walk = (d: string) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name === 'page.tsx') pages.push('/' + path.relative('src/app', d).split(path.sep).join('/')); } };
    walk('src/app/finance');
    const unreachable = pages.filter((p) => !menu.has(p) && !/redirect|router\.replace/.test(fs.readFileSync(path.join('src/app', p, 'page.tsx'), 'utf8')) && !/\[/.test(p));
    assert.deepEqual(unreachable, [], `finance pages with no menu item: ${unreachable.join(', ')}`);
});
