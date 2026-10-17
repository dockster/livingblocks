#!/usr/bin/env node
// A ring's Previous and Next turn it a card at a time without dragging (WCAG 2.5.7), named Turn back and Turn
// forward; its Pause stops its own spin and starts it again, reading Play and Pause, and is hidden when it does
// not spin (WCAG 2.2.2); the spin rests while the pointer is over the ring.
// Usage: node tests/browser/ring-controls.e2e.mjs (PLAYWRIGHT_MODULE)
import { readFileSync } from 'node:fs';
const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const chromium = pw.chromium ?? pw.default.chromium;
const src = readFileSync(new URL('../../dist/livingblocks.min.js', import.meta.url), 'utf8');
const page = (spin) => `<!doctype html><body style="margin:0;height:2000px"><div style="height:500px;width:800px" data-living='${JSON.stringify({ kind: 'ring', v: 1, settings: { radius: 300, spin, drag: true, turn: 0, tilt: 0 } })}'>
  <div data-living-part="track">${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<div style="width:120px;height:160px">Card ${n}</div>`).join('')}</div>
  <button data-living-part="prev">←</button><button data-living-part="next">→</button><button data-living-part="pause">Pause</button>
</div><script>${src}</script><script>window.LivingBlocks.start(document);</script></body>`;
const results = [];
const check = (n, ok, d = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `  (${d})` : ''}`); };
const browser = await chromium.launch();
let p = await browser.newPage({ viewport: { width: 900, height: 700 } });
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
const angle = () => p.evaluate(() => Number(document.querySelector('[data-living-part="track"]').style.transform.match(/rotateY\(([-\d.]+)deg\)/)?.[1] ?? NaN));

await p.setContent(page(0)); await p.waitForTimeout(300);
const names = await p.evaluate(() => [...document.querySelectorAll('button')].map((b) => [b.getAttribute('aria-label'), getComputedStyle(b).display]));
check('named Turn back and Turn forward', names[0][0] === 'Turn back' && names[1][0] === 'Turn forward', JSON.stringify(names));
check('no spin: Pause is hidden', names[2][1] === 'none');
const a0 = await angle();
await p.click('[data-living-part="next"]'); await p.waitForTimeout(900);
const a1 = await angle();
await p.click('[data-living-part="prev"]'); await p.waitForTimeout(900);
const a2 = await angle();
check('Next turns it one card (45°), Previous back', Math.round(a0 - a1) === 45 && Math.round(a2) === Math.round(a0), `${a0} ${a1} ${a2}`);

// a fresh tab: setContent keeps the window, and the first ring's runtime would bind the second one again
await p.close();
p = await browser.newPage({ viewport: { width: 900, height: 700 } });
p.on('pageerror', (e) => errors.push(e.message));
await p.setContent(page(20)); await p.mouse.move(890, 690); await p.waitForTimeout(600);
const b0 = await angle(); await p.waitForTimeout(500); const b1 = await angle();
check('spin 20: it turns by itself', b1 < b0 - 3, `${b0} -> ${b1}`);
const r0 = await p.evaluate(() => { const b = document.querySelector('[data-living-part="pause"]'); return [b.textContent.trim(), b.getAttribute('aria-label')]; });
await p.click('[data-living-part="pause"]'); await p.mouse.move(890, 690); await p.waitForTimeout(700);
const c0 = await angle(); await p.waitForTimeout(500); const c1 = await angle();
const r1 = await p.evaluate(() => { const b = document.querySelector('[data-living-part="pause"]'); return [b.textContent.trim(), b.getAttribute('aria-label')]; });
check('Pause stops the spin and reads Play', Math.abs(c1 - c0) < 0.5 && r0[0] === 'Pause' && r0[1] === 'Pause the ring' && r1[0] === 'Play' && r1[1] === 'Play the ring', `${c0} -> ${c1} ${JSON.stringify([r0, r1])}`);
await p.click('[data-living-part="pause"]'); await p.mouse.move(890, 690); await p.waitForTimeout(600);
const d0 = await angle(); await p.waitForTimeout(500); const d1 = await angle();
check('Play starts it again', d1 < d0 - 3, `${d0} -> ${d1}`);
await p.mouse.move(400, 250); await p.waitForTimeout(600);
const e0 = await angle(); await p.waitForTimeout(500); const e1 = await angle();
check('it rests while the pointer is over it', Math.abs(e1 - e0) < 0.5, `${e0} -> ${e1}`);
check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(`${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
