const playwright = require('playwright');

(async () => {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  const url = 'http://127.0.0.1:8000/index.html';
  console.log('loading', url);
  await page.goto(url, { waitUntil: 'load' });

  // capture console messages
  page.on('console', (msg) => {
    const t = msg.type();
    if (t === 'error' || t === 'warning') console.error('PAGE', t, msg.text());
    else console.log('PAGE', t, msg.text());
  });

  // wait for the test helper to be available (pages spawn drops asynchronously)
  let found = false;
  for (let i = 0; i < 20; i++) {
    const hasHelper = await page.evaluate(() => !!window.__hh_test);
    if (hasHelper) { found = true; break; }
    await page.waitForTimeout(250);
  }
  if (!found) {
    console.error('Test helper window.__hh_test not found after wait');
    await browser.close();
    process.exit(2);
  }

  // reset and check initial score
  await page.evaluate(() => window.__hh_test.reset());
  let score = await page.evaluate(() => Number(document.getElementById('score').textContent));
  if (score !== 0) { console.error('expected score 0 after reset, got', score); await browser.close(); process.exit(3); }

  // hit good
  await page.evaluate(() => window.__hh_test.hit('good'));
  score = await page.evaluate(() => Number(document.getElementById('score').textContent));
  if (score !== 1) { console.error('expected score 1 after good, got', score); await browser.close(); process.exit(4); }

  // hit bad
  await page.evaluate(() => window.__hh_test.hit('bad'));
  score = await page.evaluate(() => Number(document.getElementById('score').textContent));
  if (score !== -1) { console.error('expected score -1 after bad, got', score); await browser.close(); process.exit(5); }

  // test mode change persistence
  await page.selectOption('#modeSelect', 'Hard');
  const mode = await page.evaluate(() => localStorage.getItem('hh_mode'));
  if (mode !== 'Hard') { console.error('expected hh_mode=Hard, got', mode); await browser.close(); process.exit(6); }

  console.log('All smoke checks passed');
  await browser.close();
  process.exit(0);
})();
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8000/index.html');
  // wait for the page to wire helpers
  await page.waitForFunction(() => window.__hh_test !== undefined);
  // check initial score
  const s0 = await page.$eval('#score', (el) => el.textContent.trim());
  console.log('initial score=', s0);
  // hit a good drop via helper
  await page.evaluate(() => window.__hh_test.hit('good'));
  await page.waitForTimeout(200);
  const s1 = await page.$eval('#score', (el) => el.textContent.trim());
  console.log('after good hit=', s1);
  // hit a bad drop
  await page.evaluate(() => window.__hh_test.hit('bad'));
  await page.waitForTimeout(200);
  const s2 = await page.$eval('#score', (el) => el.textContent.trim());
  console.log('after bad hit=', s2);
  // reset
  await page.evaluate(() => window.__hh_test.reset());
  await page.waitForTimeout(300);
  const s3 = await page.$eval('#score', (el) => el.textContent.trim());
  const t1 = await page.$eval('#timer', (el) => el.textContent.trim());
  console.log('after reset score=', s3, 'timer=', t1);
  await browser.close();
})();
