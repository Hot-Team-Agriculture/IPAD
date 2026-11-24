import { test, expect } from '@playwright/test';

for (const size of [
  { width: 1210, height: 834 },
  { width: 1210, height: 1000 },
  { width: 1194, height: 834 },
  { width: 1180, height: 820 },
  { width: 1024, height: 768 },
  { width: 1366, height: 1024 },
  { width: 834, height: 1194 },
]) {
  test(`five stages fit and can be selected at ${size.width} × ${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const externalRequests = [];
    page.on('request', request => {
      if (!request.url().startsWith('http://127.0.0.1:4173')) externalRequests.push(request.url());
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Select Crop Stage' })).toBeVisible();
    await expect(page.locator('.stage[aria-pressed="true"]')).toHaveAttribute('data-stage', 'seedling');
    await expect.poll(() => page.locator('img').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
    await expect(page.locator('.exhibition')).toHaveClass(/is-ready/);
    if (size.width === 1210 && size.height === 834) {
      await page.screenshot({ path: `qa/${test.info().project.name}-landscape.png` });
    }
    const background = await page.locator('.background').boundingBox();
    expect(background.x).toBe(0);
    expect(background.y).toBe(0);
    expect(background.width).toBe(size.width);
    expect(background.height).toBeGreaterThanOrEqual(size.height);
    if (size.height === 1000) await page.screenshot({ path: `qa/${test.info().project.name}-tall-window.png` });
    const cards = page.locator('.stage');
    await expect(cards).toHaveCount(5);
    for (let index = 0; index < 5; index++) {
      const card = cards.nth(index);
      await card.click();
      await expect(card).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.stage[aria-pressed="true"]')).toHaveCount(1);
    }
    if (size.width === 1210 && size.height === 834) {
      await page.locator('.exhibition').evaluate(async element => {
        await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished));
      });
      await page.screenshot({ path: `qa/${test.info().project.name}-selected.png` });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (size.width > size.height) {
      const heading = await page.locator('.heading').boundingBox();
      const logo = await page.locator('.brand').boundingBox();
      const cardRow = await page.locator('.stages').boundingBox();
      expect(heading.y).toBeCloseTo(92, 1);
      expect(logo.y - cardRow.y - cardRow.height).toBeCloseTo(32, 1);
      expect(size.height - logo.y - logo.height).toBeCloseTo(32, 1);
      const positions = await cards.evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().toJSON()));
      expect(new Set(positions.map(p => p.top)).size).toBe(1);
      expect(positions.every(p => p.left >= 0 && p.right <= size.width && p.bottom <= size.height)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    }
    expect(errors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
}

test('keyboard selection and focus remain accessible', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 1210, height: 834 });
  await page.goto('/');
  if (browserName === 'webkit') {
    // Safari's Tab-to-buttons behavior depends on the user's keyboard preference.
    await page.locator('[data-stage="vegetative"]').focus();
  } else {
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-stage="seedling"]')).toBeFocused();
    await page.keyboard.press('Tab');
  }
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-stage="vegetative"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status')).toContainText('Vegetative selected');
});
