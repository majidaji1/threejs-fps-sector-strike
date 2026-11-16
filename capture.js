// Screenshot capture via Playwright: load each shot URL, wait for __shotReady, save PNG.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const SHOTS = [
  { name: '01-start', url: 'http://localhost:8123/?shot=start&seed=1' },
  { name: '02-play', url: 'http://localhost:8123/?shot=play&seed=2' },
  { name: '03-plant', url: 'http://localhost:8123/?shot=plant&seed=3' },
  { name: '04-end', url: 'http://localhost:8123/?shot=end&seed=4' },
];

const OUTPUT_DIR = path.join(__dirname, 'screenshots');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  for (const shot of SHOTS) {
    console.log(`Capturing ${shot.name}...`);
    await page.goto(shot.url, { waitUntil: 'load' });
    // Wait for __shotReady flag (set after 2 paint frames)
    try {
      await page.waitForFunction('window.__shotReady === true', { timeout: 15000 });
      await page.screenshot({ path: path.join(OUTPUT_DIR, `${shot.name}.png`) });
      console.log(`  ✓ ${shot.name}.png`);
    } catch (error) {
      console.error(`  ✗ ${shot.name} failed: ${error.message}`);
      // Take screenshot anyway
      await page.screenshot({ path: path.join(OUTPUT_DIR, `${shot.name}.png`) });
    }
  }

  await browser.close();
  console.log('All screenshots captured.');
})();