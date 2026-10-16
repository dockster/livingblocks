#!/usr/bin/env node
// A carousel's Pause button whose only text is "Pause" reads "Play" once pressed, and back again;
// its accessible name follows. Usage: node tests/browser/pause-word.e2e.mjs (PLAYWRIGHT_MODULE)
import { readFileSync } from 'node:fs';
const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const chromium = pw.chromium ?? pw.default.chromium;
const src = readFileSync(new URL('../../dist/livingblocks.min.js', import.meta.url), 'utf8');
const spec = JSON.stringify({ kind: 'carousel', v: 1, settings: { perView: 1, autoplay: true, interval: 5, loop: true } });
const html = `<!doctype html><body><div data-living='${spec}'>
  <div data-living-part="track"><div>One</div><div>Two</div><div>Three</div></div>
  <button data-living-part="pause"><span><svg width="8" height="8"></svg> PAUSE </span></button>
</div><script>${src}</script><script>window.LivingBlocks && window.LivingBlocks.start && window.LivingBlocks.start(document);</script></body>`;
const results = [];
const check = (n, ok, d = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `  (${d})` : ''}`); };
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.setContent(html);
await page.waitForTimeout(300);
const read = () => page.evaluate(() => { const b = document.querySelector('[data-living-part="pause"]'); return { text: b.textContent.trim(), label: b.getAttribute('aria-label') }; });
let r = await read();
check('playing: it reads PAUSE (its own casing)', r.text === 'PAUSE' && r.label === 'Pause slides', JSON.stringify(r));
await page.click('[data-living-part="pause"]');
r = await read();
check('pressed: it reads PLAY', r.text === 'PLAY' && r.label === 'Play slides', JSON.stringify(r));
await page.click('[data-living-part="pause"]');
r = await read();
check('pressed again: PAUSE', r.text === 'PAUSE' && r.label === 'Pause slides', JSON.stringify(r));
check('the icon beside the word stays', await page.locator('[data-living-part="pause"] svg').count() === 1);
check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(`${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
