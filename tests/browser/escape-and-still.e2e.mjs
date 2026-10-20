#!/usr/bin/env node
// 0.4.3: Escape closes only the latest notice on show, not every notice on the page; under reduced motion a
// showcase does not play on its own, so its pause part is hidden and, if shown, reads Play.
// Usage: node tests/browser/escape-and-still.e2e.mjs (PLAYWRIGHT_MODULE)
import { readFileSync } from 'node:fs';
const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const chromium = pw.chromium ?? pw.default.chromium;
const src = readFileSync(new URL('../../dist/livingblocks.min.js', import.meta.url), 'utf8');
const note = (delay) => JSON.stringify({ kind: 'notice', v: 1, settings: { delay, position: 'bottom-center' } });
const show = JSON.stringify({ kind: 'showcase', v: 1, settings: { autoplay: true, interval: 3 } });
const html = `<!doctype html><body>
<div id="a" data-living='${note(0)}'><p>First</p><button data-living-part="dismiss">Close</button></div>
<div id="b" data-living='${note(0.2)}'><p>Second</p><button data-living-part="dismiss">Close</button></div>
<div id="s" data-living='${show}'><div data-living-part="track"><div>One</div><div>Two</div></div><button data-living-part="pause">Pause</button></div>
<script>${src}</script><script>window.LivingBlocks.start(document, { remember: false });</script></body>`;
const results = [];
const check = (n, ok, d = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `  (${d})` : ''}`); };
const browser = await chromium.launch();
const errors = [];
const on = (page, id) => page.evaluate((i) => document.getElementById(i).getAttribute('data-living-on'), id);

const page = await browser.newPage();
page.on('pageerror', (e) => errors.push(e.message));
await page.setContent(html);
await page.waitForTimeout(600);
check('both notices on show', (await on(page, 'a')) === 'true' && (await on(page, 'b')) === 'true');
await page.keyboard.press('Escape');
await page.waitForTimeout(100);
check('Escape closes the latest only', (await on(page, 'b')) === 'false' && (await on(page, 'a')) === 'true');
await page.keyboard.press('Escape');
await page.waitForTimeout(100);
check('a second Escape closes the one before', (await on(page, 'a')) === 'false');
const p0 = await page.evaluate(() => { const b = document.querySelector('#s [data-living-part="pause"]'); return [getComputedStyle(b).display, b.getAttribute('aria-label')]; });
check('with motion, the showcase pause shows and reads Pause', p0[0] !== 'none' && /^Pause/.test(p0[1] || ''), p0.join(' '));

const still = await browser.newPage();
still.on('pageerror', (e) => errors.push(e.message));
await still.emulateMedia({ reducedMotion: 'reduce' });
await still.setContent(html);
await still.waitForTimeout(400);
const p1 = await still.evaluate(() => { const b = document.querySelector('#s [data-living-part="pause"]'); return [getComputedStyle(b).display, b.getAttribute('aria-label') || '']; });
check('reduced motion: the showcase pause is hidden', p1[0] === 'none', p1.join(' '));
check('reduced motion: if shown it would read Play', /^Play/.test(p1[1]), p1[1]);
check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(`${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
