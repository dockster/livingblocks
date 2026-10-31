#!/usr/bin/env node
// 0.7.0: the dashboard add-on. A table is read as a table (roles), sorts by a column's kind from its header (mouse and
// keyboard, aria-sort, its arrow), lights the row under the pointer in the header's colour, searches, pages with its
// counter's words, says when nothing matches, and on a narrow screen scrolls sideways with its first column held and
// a column hidden on phones; a chart shows a tooltip and guide at the point under the pointer and from the keyboard
// (read aloud), carries its data as a table for screen readers, drops labels that would overlap, draws in, and rests
// under reduced motion; stopping puts everything back.
// Usage: npm run build && node tests/browser/dashboard.e2e.mjs (PLAYWRIGHT_MODULE)
import { readFileSync } from 'node:fs';
const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const chromium = pw.chromium ?? pw.default.chromium;
const runtime = readFileSync(new URL('../../dist/livingblocks.min.js', import.meta.url), 'utf8');
const addon = readFileSync(new URL('../../dist/livingblocks.dashboard.min.js', import.meta.url), 'utf8');

const col = (name, c) => `<div data-living-part="column" data-living-column='${JSON.stringify(c)}' style="flex:1;display:flex;gap:6px"><span>${name}</span><span data-living-part="icon">↓</span></div>`;
const cell = (v) => `<div data-living-part="cell" style="flex:1">${v}</div>`;
const ROWS = [
  ['Oct 18, 2026, 19:34', 'Maya Okafor', 'Refunded', '$20.00'],
  ['Oct 18, 2026, 15:40', 'Leo Martins', 'Paid', '$192.00'],
  ['Oct 17, 2026, 09:12', 'Ana Ruiz', 'Pending', '$9.50'],
  ['Oct 20, 2026, 08:00', 'Zoe Park', 'Paid', '$1,200.00'],
  ['', 'Ben Ito', 'Paid', ''],
];
const table = (settings) => `<section id="t" aria-label="Payments" data-living='${JSON.stringify({ kind: 'table', v: 1, settings })}' style="background:#fff;font-family:Arial">
  <div data-living-part="search" style="height:32px"><span style="color:rgb(90,90,90)">Search payments</span></div>
  <div id="grid" style="display:flex;flex-direction:column">
    <div data-living-part="head" style="display:flex;background:rgb(242, 242, 247)">
      ${col('Date', { kind: 'date', sort: true, min: 160 })}${col('Customer', { kind: 'person', sort: true, min: 160 })}${col('Status', { kind: 'status', sort: true, min: 120, phone: false })}${col('Amount', { kind: 'money', sort: true, min: 120 })}
    </div>
    <div data-living-part="body" style="display:flex;flex-direction:column">
      ${ROWS.map((r) => `<div data-living-part="row" class="row">${r.map(cell).join('')}</div>`).join('\n')}
    </div>
  </div>
  <p data-living-part="empty" hidden>No rows match.</p>
  <div><span data-living-part="counter">Viewing all</span><button data-living-part="first">«</button><button data-living-part="prev">‹</button><button data-living-part="next">›</button><button data-living-part="last">»</button></div>
</section>`;
const DATA = 'Month,Revenue,Costs\nJan,100,40\nFeb,140,60\nMar,90,\nApr,200,80';
const chart = (settings) => `<section id="c" aria-label="Revenue" data-living='${JSON.stringify({ kind: 'chart', v: 1, settings })}' style="font-family:Arial;color:#111">
  <p data-living-part="value" style="font-family: Georgia">$530</p>
  <div data-living-part="plot" style="width:400px;height:200px">
    <div data-living-series="0" style="position:absolute;inset:0"><svg width="400" height="200"><path d="M0 150 L133 130 L266 155 L400 100" fill="none" stroke="rgb(10, 80, 200)" stroke-width="2"/></svg></div>
    <div data-living-series="1" style="position:absolute;inset:0"><svg width="400" height="200"><path d="M0 180 L133 170 L400 160" fill="none" stroke="rgb(200, 100, 10)" stroke-width="2"/></svg></div>
    <div style="position:absolute;inset:0"><svg width="400" height="200"><path d="M0 0 L0 200" fill="none" stroke="rgb(220, 220, 220)"/></svg></div>
  </div>
  <div id="ticks" style="display:flex;justify-content:space-between;width:400px">${['Jan', 'Feb', 'Mar', 'Apr'].map((m) => `<span data-living-part="tick">${m}</span>`).join('')}</div>
</section>`;
const page = (body) => `<!doctype html><html><head><style>.row { display: flex; background-color: #fff; }</style></head><body style="margin:0">${body}<script>${runtime}</script><script>${addon}</script><script>window.stop = window.LivingBlocks.start(document.body, { remember: false });</script></body></html>`;

const results = [];
const check = (n, ok, d = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `  (${d})` : ''}`); };
const browser = await chromium.launch();
const errors = [];
const open = async (body, opts = {}) => {
  const ctx = await browser.newContext({ viewport: opts.viewport ?? { width: 1000, height: 800 }, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.setContent(page(body));
  await p.waitForTimeout(150);
  return p;
};
const order = (p) => p.evaluate(() => [...document.querySelectorAll('[data-living-part="row"]')].filter((r) => !r.hidden).map((r) => r.children[1].textContent));

// ── the table ──
let p = await open(table({ sort: 0, dir: 'desc', pageSize: 0, pin: true }));
const roles = await p.evaluate(() => ({ grid: document.getElementById('grid').getAttribute('role'), label: document.getElementById('grid').getAttribute('aria-label'), head: document.querySelector('[data-living-part="head"]').getAttribute('role'), col: document.querySelector('[data-living-part="column"]').getAttribute('role'), body: document.querySelector('[data-living-part="body"]').getAttribute('role'), row: document.querySelector('[data-living-part="row"]').getAttribute('role'), cell: document.querySelector('[data-living-part="cell"]').getAttribute('role') }));
check('read as a table: its header row, column headers, rows and cells, named by the Block', roles.grid === 'table' && roles.label === 'Payments' && roles.head === 'row' && roles.col === 'columnheader' && roles.body === 'rowgroup' && roles.row === 'row' && roles.cell === 'cell', JSON.stringify(roles));
check('sorted at first by its setting: dates newest first, an empty date last', (await order(p)).join(',') === 'Zoe Park,Maya Okafor,Leo Martins,Ana Ruiz,Ben Ito', (await order(p)).join(','));
const sorted = await p.evaluate(() => [...document.querySelectorAll('[data-living-part="column"]')].map((c) => c.getAttribute('aria-sort')));
check('aria-sort on the sorted column, none on the others', sorted.join(',') === 'descending,none,none,none', sorted.join(','));
const arrows = await p.evaluate(() => [...document.querySelectorAll('[data-living-part="icon"]')].map((i) => i.style.opacity));
check('only the sorted column shows its arrow', arrows.join(',') === '1,0,0,0', arrows.join(','));
await p.click('[data-living-part="column"]:nth-child(4)');
await p.waitForTimeout(80);
check('pressing Amount sorts by money as numbers, largest first ($1,200 above $192, empty last)', (await order(p)).join(',') === 'Zoe Park,Leo Martins,Maya Okafor,Ana Ruiz,Ben Ito', (await order(p)).join(','));
await p.focus('[data-living-part="column"]:nth-child(4)');
await p.keyboard.press('Enter');
await p.waitForTimeout(80);
check('Enter on the same header turns it round, smallest first, an empty amount still last', (await order(p)).join(',') === 'Ana Ruiz,Maya Okafor,Leo Martins,Zoe Park,Ben Ito', (await order(p)).join(','));
const turned = await p.evaluate(() => ({ sort: document.querySelector('[data-living-part="column"]:nth-child(4)').getAttribute('aria-sort'), icon: document.querySelectorAll('[data-living-part="icon"]')[3].style.transform, said: document.querySelector('[data-living-announcer]')?.textContent }));
check('its arrow turns, aria-sort says ascending, and the change is read out', turned.sort === 'ascending' && /180/.test(turned.icon) && /Sorted by Amount, ascending/.test(turned.said ?? ''), JSON.stringify(turned));
await p.click('[data-living-part="column"]:nth-child(2)');
await p.waitForTimeout(80);
check('a name column sorts A to Z on its first press', (await order(p)).join(',') === 'Ana Ruiz,Ben Ito,Leo Martins,Maya Okafor,Zoe Park', (await order(p)).join(','));
await p.hover('[data-living-part="row"]:nth-child(2)');
await p.waitForTimeout(300);
const hover = await p.evaluate(() => getComputedStyle(document.querySelectorAll('[data-living-part="row"]')[1]).backgroundColor);
check('the row under the pointer lights up in the header’s colour', hover === 'rgb(242, 242, 247)', hover);
const search = p.locator('[data-living-part="search"] input');
check('the search part becomes a box, its drawn words the placeholder', (await search.getAttribute('placeholder')) === 'Search payments' && (await search.getAttribute('type')) === 'search');
await search.fill('paid');
await p.waitForTimeout(80);
check('searching keeps the rows that say it', (await order(p)).join(',') === 'Ben Ito,Leo Martins,Zoe Park', (await order(p)).join(','));
await search.fill('nobody');
await p.waitForTimeout(80);
check('nothing matches: the empty part says so', (await order(p)).length === 0 && (await p.evaluate(() => document.querySelector('[data-living-part="empty"]').hidden)) === false);
await p.evaluate(() => window.stop());
const back = await p.evaluate(() => ({ rows: [...document.querySelectorAll('[data-living-part="row"]')].map((r) => r.children[1].textContent).join(','), search: !!document.querySelector('[data-living-part="search"] input'), role: document.getElementById('grid').getAttribute('role'), empty: document.querySelector('[data-living-part="empty"]').hidden }));
check('stopped: the rows back as drawn, no box, no roles, the empty part hidden again', back.rows === ROWS.map((r) => r[1]).join(',') && !back.search && back.role === null && back.empty, JSON.stringify(back));
await p.context().close();

// pages
p = await open(table({ sort: -1, pageSize: 2, count: 'Viewing {from} to {to} of {total}' }));
const counter = () => p.evaluate(() => document.querySelector('[data-living-part="counter"]').textContent);
check('pages: two rows, the counter in its words', (await order(p)).length === 2 && (await counter()) === 'Viewing 1 to 2 of 5', await counter());
check('first and previous are off on the first page', await p.evaluate(() => ['first', 'prev'].every((n) => document.querySelector(`[data-living-part="${n}"]`).getAttribute('aria-disabled') === 'true')));
await p.click('[data-living-part="next"]');
check('next: the next two rows', (await counter()) === 'Viewing 3 to 4 of 5' && (await order(p)).join(',') === 'Ana Ruiz,Zoe Park', `${await counter()} ${(await order(p)).join(',')}`);
await p.click('[data-living-part="last"]');
check('last: the last row, next and last off', (await counter()) === 'Viewing 5 to 5 of 5' && (await p.evaluate(() => document.querySelector('[data-living-part="next"]').getAttribute('aria-disabled'))) === 'true');
await p.context().close();

// a phone
p = await open(table({ sort: -1, pageSize: 0, pin: true }), { viewport: { width: 390, height: 800 } });
const narrow = await p.evaluate(() => { const g = document.getElementById('grid'); const firstCell = document.querySelector('[data-living-part="row"] [data-living-part="cell"]'); return { scrolls: g.scrollWidth > g.clientWidth, overflow: g.style.overflowX, pinned: firstCell.style.position, statusHidden: getComputedStyle(document.querySelectorAll('[data-living-part="column"]')[2]).display, page: document.documentElement.scrollWidth > innerWidth }; });
check('a phone: the table scrolls sideways inside itself, its first column held, Status hidden, the page does not scroll', narrow.scrolls && narrow.overflow === 'auto' && narrow.pinned === 'sticky' && narrow.statusHidden === 'none' && !narrow.page, JSON.stringify(narrow));
await p.evaluate(() => { document.getElementById('grid').scrollLeft = 120; });
const held = await p.evaluate(() => Math.round(document.querySelector('[data-living-part="row"] [data-living-part="cell"]').getBoundingClientRect().left - document.getElementById('grid').getBoundingClientRect().left));
check('scrolled sideways, the first column stays at the left edge', held === 0, String(held));
await p.context().close();

// ── the chart ──
p = await open(chart({ type: 'line', data: DATA, prefix: '$', format: 'number', draw: 'once' }));
const sr = await p.evaluate(() => { const t = document.querySelector('table.living-sr'); return t ? { caption: t.caption?.textContent, rows: t.rows.length, head: [...t.rows[0].cells].map((c) => c.textContent).join(','), mar: [...t.rows[3].cells].map((c) => c.textContent).join(',') } : null; });
check('its data as a table for screen readers: caption, names, a row a point, a gap left empty', sr && sr.caption === 'Revenue' && sr.rows === 5 && sr.head === 'Month,Revenue,Costs' && sr.mar === 'Mar,$90,', JSON.stringify(sr));
const plotRole = await p.evaluate(() => { const pl = document.querySelector('[data-living-part="plot"]'); return { role: pl.getAttribute('role'), tab: pl.getAttribute('tabindex'), label: pl.getAttribute('aria-label') }; });
check('the drawing is one picture with a name, reachable from the keyboard', plotRole.role === 'img' && plotRole.tab === '0' && /Revenue, Costs, 4 points/.test(plotRole.label), JSON.stringify(plotRole));
const box = await p.locator('[data-living-part="plot"]').boundingBox();
await p.mouse.move(box.x + 140, box.y + 100);
await p.waitForTimeout(250);
const tip = await p.evaluate(() => { const t = document.querySelector('.living-tip'); const sw = [...t.querySelectorAll('i')].map((i) => i.style.background); return { on: t.classList.contains('is-on'), text: t.textContent, sw, font: getComputedStyle(t).fontFamily, guide: document.querySelector('.living-guide').classList.contains('is-on') }; });
check('the pointer near Feb: a tooltip with its label and each series, a guide line', tip.on && tip.text === 'FebRevenue: $140Costs: $60' && tip.guide, tip.text);
check('the tooltip’s dots in each series’ own colour (not the grid’s), in the chart’s type', tip.sw[0] === 'rgb(10, 80, 200)' && tip.sw[1] === 'rgb(200, 100, 10)' && /Georgia/.test(tip.font), JSON.stringify(tip));
await p.mouse.move(box.x + 800, box.y + 600);
await p.waitForTimeout(200);
check('the pointer leaves: the tooltip goes', !(await p.evaluate(() => document.querySelector('.living-tip').classList.contains('is-on'))));
await p.focus('[data-living-part="plot"]');
await p.keyboard.press('End');
await p.keyboard.press('ArrowLeft');
await p.waitForTimeout(150);
const keyed = await p.evaluate(() => ({ tip: document.querySelector('.living-tip').textContent, said: document.querySelector('[data-living-announcer]')?.textContent }));
check('the keyboard: End then Left reads March aloud, its gap said as no value', /^Mar/.test(keyed.tip) && keyed.said === 'Mar: Revenue $90, Costs no value', JSON.stringify(keyed));
await p.keyboard.press('Escape');
check('Escape hides it', !(await p.evaluate(() => document.querySelector('.living-tip').classList.contains('is-on'))));
await p.evaluate(() => window.stop());
const restored = await p.evaluate(() => ({ sr: !!document.querySelector('table.living-sr'), tip: !!document.querySelector('.living-tip'), role: document.querySelector('[data-living-part="plot"]').getAttribute('role') }));
check('stopped: no table, tooltip or role left', !restored.sr && !restored.tip && restored.role === null, JSON.stringify(restored));
await p.context().close();

// labels that would overlap, and drawing in
const crowded = chart({ type: 'line', data: 'L,A\n' + Array.from({ length: 12 }, (_, i) => `Label number ${i},${i}`).join('\n') }).replace(/<div id="ticks"[\s\S]*?<\/div>/, `<div id="ticks" style="display:flex;justify-content:space-between;width:400px">${Array.from({ length: 12 }, (_, i) => `<span data-living-part="tick">Label number ${i}</span>`).join('')}</div>`);
p = await open(crowded);
const shown = await p.evaluate(() => [...document.querySelectorAll('[data-living-part="tick"]')].filter((t) => t.style.visibility !== 'hidden').length);
check('labels that would overlap step aside, every other one, until none do', shown > 0 && shown < 12, String(shown));
await p.context().close();
p = await open(chart({ type: 'line', data: DATA, draw: 'once' }));
const anims = await p.evaluate(() => document.getAnimations().length);
check('drawing in: the lines trace themselves as the chart comes into view', anims >= 2, String(anims));
await p.context().close();
p = await open(chart({ type: 'line', data: DATA, draw: 'once' }), { reduced: true });
check('reduced motion: drawn at rest, nothing animates', (await p.evaluate(() => document.getAnimations().length)) === 0);
await p.context().close();

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
