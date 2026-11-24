import { test, expect } from '@playwright/test';
import { fixture } from '../server-tests/backend.mjs';
import { mkdir, rm, copyFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

let f;
test.beforeEach(async ({ page }) => {
  f = await fixture();
  await page.setViewportSize({ width: 1210, height: 834 });
});
test.afterEach(async () => { await f?.close(); f = undefined; });

test('stage cards persist the correct stage to the configured cycle and restore it on reload', async ({ page }) => {
  await page.goto(f.url);
  for (const [card, code] of [['vegetative', 'vegetative'], ['reproductive', 'flowering'], ['ripening', 'grain_fill'], ['ripe', 'drain'], ['seedling', 'seedling']]) {
    const button = page.locator(`[data-stage="${card}"]`);
    await expect(button).toBeEnabled();
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(f.state.stage).toBe(code);
  }
  await page.locator('[data-stage="ripening"]').click();
  await expect(page.locator('[data-stage="ripening"]')).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.locator('[data-stage="ripening"]')).toHaveAttribute('aria-pressed', 'true');
  expect(f.state.requests.filter(r => r.method === 'PATCH')).toHaveLength(6);
});

test('pending writes keep the old selection and prevent duplicate stage requests', async ({ page }) => {
  f.state.delay = 400;
  await page.goto(f.url);
  const button = page.locator('[data-stage="vegetative"]');
  await expect(button).toBeEnabled();
  await button.click();
  await expect(button).toBeDisabled();
  await expect(page.locator('[data-stage="seedling"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(f.state.requests.filter(r => r.method === 'PATCH')).toHaveLength(1);
});

test('a backend rejection reports failure and retains the confirmed selection', async ({ page }) => {
  f.state.patchStatus = 409;
  const messages = [];
  page.on('dialog', async dialog => { messages.push(dialog.message()); await dialog.dismiss(); });
  await page.goto(f.url);
  const button = page.locator('[data-stage="vegetative"]');
  await expect(button).toBeEnabled();
  await button.click();
  await expect(button).toBeEnabled();
  await expect(page.locator('[data-stage="seedling"]')).toHaveAttribute('aria-pressed', 'true');
  expect(messages.join(' ')).toContain('declined');
  expect(f.state.stage).toBe('seedling');
});

test('missing season has no false current stage and sends no writes', async ({ page }) => {
  f.state.missingCycle = true;
  page.on('dialog', dialog => dialog.dismiss());
  await page.goto(f.url);
  await expect(page.locator('.stage[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('#stage-announcement')).toContainText('active season');
  await expect(page.locator('[data-stage="seedling"]')).toBeDisabled();
  expect(f.state.requests.filter(r => r.method === 'PATCH')).toHaveLength(0);
});

test('connected mode preserves the static layout and appearance', async ({ page, context }, info) => {
  const original = await context.newPage();
  await original.setViewportSize({ width: 1210, height: 834 });
  await original.goto('http://127.0.0.1:4173/');
  await page.goto(f.url);
  for (const current of [original, page]) {
    await expect(current.locator('.exhibition')).toHaveClass(/is-ready/);
    await expect(current.locator('[data-stage="seedling"]')).toBeEnabled();
    await expect.poll(() => current.locator('img').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
    await current.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
  }
  const geometry = current => current.locator('.exhibition, .stage, img').evaluateAll(nodes => nodes.map(node => {
    const { x, y, width, height } = node.getBoundingClientRect();
    return { x, y, width, height };
  }));
  expect(await geometry(page)).toEqual(await geometry(original));
  const expected = info.snapshotPath('connected-design.png');
  await mkdir(dirname(expected), { recursive: true });
  await original.bringToFront();
  await original.screenshot({ path: expected, animations: 'disabled' });
  try {
    await page.bringToFront();
    const actual = await page.screenshot({ animations: 'disabled' });
    await mkdir('qa', { recursive: true });
    await copyFile(expected, `qa/${info.project.name}-static.png`);
    await writeFile(`qa/${info.project.name}-connected.png`, actual);
    // Fractional image sizing produced a one-pixel heading difference; geometry above is exact.
    expect(actual).toMatchSnapshot('connected-design.png', { maxDiffPixels: 10, threshold: 0.2 });
  } finally { await rm(expected, { force: true }); }
  await original.close();
});
