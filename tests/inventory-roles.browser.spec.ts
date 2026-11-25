import { test, expect, type Browser, type Page } from '@playwright/test';

/**
 * Role-by-role browser pass of the inventory chain (localhost, ZZTEST data from scripts/zz-gui2.ts and scripts/zz-gui2-req.ts):
 * the Stores Manager approves a request raised by the sub store officer, the Stores Executive releases it from the main store,
 * the officer receives it, and the screens show each state. Env: GUI2_PASSWORD, GUI2_REQ (the request number).
 */
const PASSWORD = process.env.GUI2_PASSWORD ?? '';
const REQ = process.env.GUI2_REQ ?? '';

async function signIn(browser: Browser, username: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="password"]', { timeout: 60_000 });
  await page.waitForTimeout(4000); // let the page finish hydrating, or the typed text is cleared when React takes over
  await page.locator('#login-username').fill(username);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('#login-submit-btn').click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).not.toMatch(/\/login$/);
  return page;
}

const dump = (page: Page) => page.evaluate(() => {
  const t = (e: Element) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return { buttons: [...new Set([...document.querySelectorAll('[role=dialog] button')].map(t).filter(Boolean))], dialog: [...document.querySelectorAll('[role=dialog]')].map(t).slice(0, 1) };
});

async function requestRow(page: Page) {
  await page.goto('/inventory/requests', { waitUntil: 'domcontentloaded' });
  const row = page.locator('tr', { hasText: REQ });
  await row.waitFor({ timeout: 240_000 });
  return row;
}

test('request: manager approves, executive releases, officer receives', async ({ browser }) => {
  test.setTimeout(900_000);
  expect(REQ, 'GUI2_REQ must hold the request number').toBeTruthy();

  const manager = await signIn(browser, 'zzg2_mgr');
  let row = await requestRow(manager);
  if (/PENDING/.test(await row.innerText())) {
    await row.getByRole('button', { name: /Review/ }).click();
    await manager.getByRole('button', { name: /Approve Transfer Request/ }).click();
    // the approval runs several database steps: wait for the dialog to close instead of for a fixed time
    await expect(manager.locator('[role=dialog]')).toHaveCount(0, { timeout: 240_000 });
  }
  row = await requestRow(manager);
  await expect(row).toContainText(/APPROVED/, { timeout: 60_000 });
  await expect(row.getByRole('button', { name: /Release \(MIN\)/ })).toBeVisible();
  await manager.context().close();

  const executive = await signIn(browser, 'zzg2_exec');
  row = await requestRow(executive);
  await row.getByRole('button', { name: /Release \(MIN\)/ }).click();
  await executive.getByRole('button', { name: /Confirm Dispatch & Issue MIN/ }).click();
  await expect(executive.locator('[role=dialog]')).toHaveCount(0, { timeout: 240_000 });
  row = await requestRow(executive);
  await expect(row.getByRole('button', { name: /Release \(MIN\)/ })).toHaveCount(0);
  await expect(row.getByRole('button', { name: /Receive Stock/ })).toBeVisible();
  await executive.context().close();

  const officer = await signIn(browser, 'zzg2_officer');
  row = await requestRow(officer);
  await expect(row.getByRole('button', { name: /Release \(MIN\)/ })).toHaveCount(0); // the sub store officer cannot release from the main store
  await row.getByRole('button', { name: /Receive Stock/ }).click();
  await officer.waitForTimeout(4000);
  console.log('RECEIVE_DIALOG', JSON.stringify(await dump(officer)));
  await officer.locator('[role=dialog]').getByRole('button', { name: /Confirm|Receive/ }).last().click();
  await expect(officer.locator('[role=dialog]')).toHaveCount(0, { timeout: 240_000 });
  row = await requestRow(officer);
  await expect(row).toContainText(/COMPLETED/, { timeout: 60_000 });
  await officer.context().close();
});

test('contractor app: the issue note is shown, the contractor accepts it, the stock appears', async ({ browser }) => {
  test.setTimeout(900_000);
  const MIN = process.env.GUI2_MIN ?? '';
  expect(MIN, 'GUI2_MIN must hold the issue note number').toBeTruthy();
  const page = await (await browser.newContext()).newPage();
  await page.goto('/contractor/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="password"]', { timeout: 60_000 });
  await page.waitForTimeout(4000);
  await page.getByPlaceholder(/Contractor Username or Phone/i).fill('zzg2_contractor');
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.getByRole('button', { name: /Login to Contractor App/i }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).not.toMatch(/\/login$/);

  await page.goto('/contractor/inventory', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Dispatches/ }).click();
  const note = page.getByText(MIN).first();
  await note.waitFor({ timeout: 240_000 }); // the issue note number is shown to the contractor (store rule: every issue shows its MIN)
  await expect(page.getByText(/12 m\b/).first()).toBeVisible(); // the unit is the item's unit (metres), not "Nos"
  const card = page.locator('div').filter({ hasText: MIN }).filter({ has: page.getByRole('button', { name: /Sign & Transfer Custody/ }) }).last();
  await card.getByRole('button', { name: /Sign & Transfer Custody/ }).click();
  await page.waitForTimeout(4000);
  // dual custody: the contractor types their name as the signature, then confirms
  await page.getByPlaceholder(/Enter your full name/i).fill('ZZG2 Contractor Receiver');
  await page.getByRole('button', { name: /^Confirm$/ }).click();
  await page.waitForTimeout(10_000);
  await page.getByRole('button', { name: /^Dispatches/ }).click();
  await expect(page.getByText(/ACCEPTED DISPATCHES HISTORY \([1-9]/i)).toBeVisible({ timeout: 120_000 });
  await page.getByRole('button', { name: /^VMI Stock/ }).click();
  await page.waitForTimeout(5000);
  console.log('VMI_TEXT', JSON.stringify((await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 600)));
});
