const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const LIVE = 'https://mgu333.github.io/hydrohomies-hq-prototype/';

(async () => {
  const out = path.resolve(__dirname, '..', 'docs');
  if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true });

  const browser = await chromium.launch();
  try {
    // Desktop
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    await page.goto(LIVE, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__hh_test, { timeout: 5000 });
    await page.selectOption('#modeSelect', 'Hard');
    await page.evaluate(() => (localStorage.setItem('hh_mode', 'Hard'), window.__hh_test.reset()));
    for (let i = 0; i < 30; i++) {
      await page.evaluate(() => window.__hh_test.hit('good'));
      const s = await page.evaluate(() => Number(document.getElementById('score').textContent));
      if (s >= 10) break;
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, 'desktop.png') });
    await context.close();

    // Mobile
    const mobileCtx = await browser.newContext({ ...devices['Pixel 5'] });
    const mpage = await mobileCtx.newPage();
    await mpage.goto(LIVE, { waitUntil: 'load' });
    await mpage.waitForFunction(() => !!window.__hh_test, { timeout: 5000 });
    await mpage.selectOption('#modeSelect', 'Easy');
    await mpage.evaluate(() => (localStorage.setItem('hh_mode', 'Easy'), window.__hh_test.reset()));
    await mpage.evaluate(() => document.querySelector('.site-footer').scrollIntoView());
    await mpage.waitForTimeout(300);
    await mpage.screenshot({ path: path.join(out, 'mobile.png') });
    await mobileCtx.close();

    // Record short demo.webm
    const recCtx = await browser.newContext({ recordVideo: { dir: out, size: { width: 800, height: 600 } } });
    const recPage = await recCtx.newPage();
    await recPage.goto(LIVE, { waitUntil: 'load' });
    await recPage.waitForFunction(() => !!window.__hh_test, { timeout: 5000 });
    await recPage.evaluate(() => window.__hh_test.reset());
    for (let i = 0; i < 6; i++) { await recPage.evaluate(() => window.__hh_test.hit('good')); await recPage.waitForTimeout(300); }
    await recPage.waitForTimeout(2000);
    await recCtx.close();

    // find the recorded webm
    const vids = fs.readdirSync(out).filter(f => f.endsWith('.webm'));
    if (vids.length) {
      const latest = vids.sort().pop();
      const p = path.join(out, latest);
      const dest = path.join(out, 'demo.webm');
      if (p !== dest) fs.renameSync(p, dest);
      console.log('Wrote', 'desktop.png', 'mobile.png', 'demo.webm');
    } else {
      console.log('No video produced; screenshots saved.');
    }
  } finally {
    await browser.close();
  }
})();
const { chromium, devices } = require('playwright');
const fs = globalThis.fs || require('fs');

const LIVE = 'https://mgu333.github.io/hydrohomies-hq-prototype/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto(LIVE, { waitUntil: 'load' });

  // Ensure helper available
  await page.waitForFunction(() => !!window.__hh_test, { timeout: 5000 });

  // Set Hard mode and reset
  await page.selectOption('#modeSelect', 'Hard');
  await page.evaluate(() => (window.__hh_test.reset(), localStorage.setItem('hh_mode','Hard')));

  // Simulate hits until score >= 10
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => window.__hh_test.hit('good'));
    const s = await page.evaluate(() => Number(document.getElementById('score').textContent));
    if (s >= 10) break;
    await page.waitForTimeout(120);
  }

  // Wait for banner (milestone)
  await page.waitForSelector('#banner:not([hidden])', { timeout: 3000 }).catch(()=>{});
  await page.screenshot({ path: 'docs/desktop.png', fullPage: false });

  // Mobile: use Pixel 5 emulation
  const mobile = await browser.newContext({ ...devices['Pixel 5'] });
  const mpage = await mobile.newPage();
  await mpage.goto(LIVE, { waitUntil: 'load' });
  await mpage.waitForFunction(() => !!window.__hh_test, { timeout: 5000 });
  await mpage.selectOption('#modeSelect', 'Easy');
  await mpage.evaluate(() => (window.__hh_test.reset(), localStorage.setItem('hh_mode','Easy')));
  // ensure footer in view
  await mpage.evaluate(() => document.querySelector('.site-footer').scrollIntoView());
  await mpage.screenshot({ path: 'docs/mobile.png', fullPage: false });

  // Record a short demo: navigate in a new context and record 6s
  const recCtx = await browser.newContext({ recordVideo: { dir: 'docs', size: { width: 800, height: 600 } } });
  const recPage = await recCtx.newPage();
  await recPage.goto(LIVE, { waitUntil: 'load' });
  await recPage.waitForFunction(() => !!window.__hh_test, { timeout: 5000 });
  // play a few hits for demo
  await recPage.evaluate(() => window.__hh_test.reset());
  for (let i = 0; i < 6; i++) { await recPage.evaluate(() => window.__hh_test.hit('good')); await recPage.waitForTimeout(300); }
  await recPage.waitForTimeout(2000);
  await recCtx.close();
  // find the created video file
  const files = fs.readdirSync('docs').filter(f => f.endsWith('.webm'));
  if (files.length) console.log('recorded', files[files.length-1]);

  await browser.close();
  console.log('captures saved to docs/');
})();
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

async function capture() {
  const outDir = path.resolve(__dirname, '..', 'docs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const url = 'http://127.0.0.1:8000/index.html/index.html';

  // desktop screenshot + video
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: outDir, size: { width: 1280, height: 800 } },
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  // let the game run a little and collect a drop
  await page.waitForTimeout(800);
  // click a couple drops via test API if available
  try { await page.evaluate(() => window.__hh_test && window.__hh_test.hit && window.__hh_test.hit('good')); } catch (e) {}
  await page.waitForTimeout(300);
  const desktopPath = path.join(outDir, 'desktop.png');
  await page.screenshot({ path: desktopPath, fullPage: false });
  await context.close();
  await browser.close();

  // mobile screenshot using iPhone 12 emulation
  const browser2 = await chromium.launch();
  const iPhone = devices['iPhone 12'];
  const context2 = await browser2.newContext({ ...iPhone });
  const page2 = await context2.newPage();
  await page2.goto(url, { waitUntil: 'networkidle' });
  await page2.waitForTimeout(800);
  try { await page2.evaluate(() => window.__hh_test && window.__hh_test.hit && window.__hh_test.hit('good')); } catch (e) {}
  const mobilePath = path.join(outDir, 'mobile.png');
  await page2.screenshot({ path: mobilePath, fullPage: false });
  await context2.close();
  await browser2.close();

  // find latest video in outDir
  const files = fs.readdirSync(outDir).filter(f => f.endsWith('.webm') || f.endsWith('.mp4'));
  if (files.length) {
    const latest = files.map(f => ({ f, t: fs.statSync(path.join(outDir, f)).mtimeMs })).sort((a,b)=>b.t-a.t)[0].f;
    const src = path.join(outDir, latest);
    const dest = path.join(outDir, 'demo.webm');
    fs.renameSync(src, dest);
    // try convert to gif using ffmpeg if available
    try {
      const { execSync } = require('child_process');
      const gifPath = path.join(outDir, 'demo.gif');
      execSync(`ffmpeg -y -i ${dest} -vf "fps=15,scale=480:-1:flags=lanczos" ${gifPath}`, { stdio: 'ignore' });
      console.log('Wrote', desktopPath, mobilePath, dest, gifPath);
    } catch (e) {
      console.log('Converted video not available (ffmpeg missing?), saved video at', dest);
    }
  } else {
    console.log('No video produced; screenshots saved.');
  }
}

capture().catch(e=>{ console.error(e); process.exit(1); });
