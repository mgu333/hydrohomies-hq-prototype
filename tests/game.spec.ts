import { test, expect } from '@playwright/test';

test('good and bad drop score and reset', async ({ page }) => {
  await page.goto('http://127.0.0.1:8000/index.html/index.html');
  // ensure initial score is 0
  const score = await page.locator('#score');
  await expect(score).toHaveText('0');

  // wait for the in-page test API to be available
  await page.waitForFunction(() => !!(window as any).__hh_test, { timeout: 5000 });

  // inject a good drop and click it
  // use deterministic test API to apply a good hit
  await page.evaluate(()=>{ (window as any).__hh_test && (window as any).__hh_test.hit('good'); });
  await expect(score).toHaveText('1');

  // inject a bad drop and click
  await page.evaluate(()=>{ (window as any).__hh_test && (window as any).__hh_test.hit('bad'); });
  await expect(score).toHaveText('-1'); // 1 + (-2) => -1

  // Reset
  // reset via UI and via test API
  await page.click('#resetBtn');
  await expect(score).toHaveText('0');
});
