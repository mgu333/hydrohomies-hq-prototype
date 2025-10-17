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
