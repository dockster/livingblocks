#!/usr/bin/env node
// 0.5.0: the form. Drawn fields become real, labelled controls with their placeholders; empty or wrong answers are
// refused before anything is sent, each saying why, the first taking the focus; a good one is posted to the page's
// own address with a trap field and the time the page opened; the status part shows its words after; a failure keeps
// what was typed; a paused form says so; Preview checks and never sends; an export says it sends from a published
// site; a redirect goes to its address; stopping puts the drawing back.
// Usage: npm run build && node tests/browser/form.e2e.mjs (PLAYWRIGHT_MODULE)
import { readFileSync } from 'node:fs';
const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const chromium = pw.chromium ?? pw.default.chromium;
const src = readFileSync(new URL('../../dist/livingblocks.min.js', import.meta.url), 'utf8');
const spec = (settings) => JSON.stringify({ kind: 'form', v: 1, settings });
const field = (f, label, placeholder) =>
  `<div data-living-part="field" data-living-field='${JSON.stringify(f)}'><div data-living-part="label" style="color: rgb(10, 20, 30)">${label}</div><div data-living-part="input"><span style="font-family: Georgia, serif; font-size: 17px; font-weight: 500; color: rgb(120, 121, 122)">${placeholder}</span></div></div>`;
const page = (settings, options = '{ remember: false }') => `<!doctype html><html><head></head><body>
<form id="f" data-living='${spec(settings)}' data-living-form="node42">
${field({ type: 'text', name: 'name', required: true }, 'Name', 'Your name')}
${field({ type: 'email', name: 'email', required: true }, 'Email', 'you@example.com')}
${field({ type: 'long', name: 'message', required: true }, 'Message', 'What would you like to say?')}
${field({ type: 'choice', name: 'topic', options: ['Design', 'Build'] }, 'Topic', 'Pick one')}
${field({ type: 'checkbox', name: 'news' }, 'Send me news', '')}
<button data-living-part="submit">Send message</button>
<p data-living-part="status">Thanks, your message is on its way.</p>
</form>
<script>${src}</script><script>window.stop = window.LivingBlocks.start(document, ${options});</script></body></html>`;

const results = [];
const check = (n, ok, d = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `  (${d})` : ''}`); };
const browser = await chromium.launch();
const errors = [];
let answer = { status: 200, body: { ok: true } };
const posts = [];
const tokens = [];
const open = async (settings = { after: 'message', to: 'account' }, options) => {
  const p = await browser.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.route('https://site.test/**', async (route) => {
    const req = route.request();
    if (req.method() === 'GET' && req.url().endsWith('/__uxdeck/form')) {
      tokens.push(req.url());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ t: 'tok.sig' }) });
    }
    if (req.method() === 'POST' && req.url().endsWith('/__uxdeck/form')) {
      posts.push(JSON.parse(req.postData() || '{}'));
      return route.fulfill({ status: answer.status, contentType: 'application/json', body: JSON.stringify(answer.body) });
    }
    if (req.url().endsWith('/thanks')) return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>thanks page</p>' });
    return route.fulfill({ status: 200, contentType: 'text/html', body: page(settings, options) });
  });
  await p.goto('https://site.test/');
  await p.waitForTimeout(150);
  return p;
};
const status = (p) => p.evaluate(() => { const s = document.querySelector('[data-living-part="status"]'); return { hidden: s.hidden, text: s.textContent, role: s.getAttribute('role') }; });
const state = (p) => p.evaluate(() => document.getElementById('f').getAttribute('data-living-state'));

const p = await open();
const made = await p.evaluate(() => [...document.querySelectorAll('.living-control')].map((c) => ({ tag: c.tagName, type: c.type, name: c.name, ph: c.placeholder, req: c.required, auto: c.getAttribute('autocomplete'), lab: document.getElementById(c.getAttribute('aria-labelledby'))?.textContent })));
check('each drawn field becomes a real control under its name', made.map((m) => `${m.tag}:${m.name}`).join(' ') === 'INPUT:name INPUT:email TEXTAREA:message SELECT:topic INPUT:news', JSON.stringify(made.map((m) => m.tag + ':' + m.name)));
check('the box’s words are the placeholder, and the drawn words are hidden', made[1].ph === 'you@example.com' && (await p.evaluate(() => getComputedStyle(document.querySelector('[data-living-part="input"] span')).display)) === 'none');
check('each control is named by its label, required where asked, autocomplete for name and email', made.every((m) => m.lab) && made[0].req && !made[3].req && made[0].auto === 'name' && made[1].auto === 'email' && made[1].type === 'email', JSON.stringify(made[0]));
const look = await p.evaluate(() => { const c = document.querySelector('.living-control[name=name]'); const cs = getComputedStyle(c); const ph = getComputedStyle(c, '::placeholder'); return { family: cs.fontFamily, size: cs.fontSize, weight: cs.fontWeight, color: cs.color, placeholder: ph.color }; });
check('a control takes the drawn placeholder\'s font and colour, and the label\'s colour for what is typed (no browser serif)', /Georgia/.test(look.family) && look.size === '17px' && look.weight === '500' && look.color === 'rgb(10, 20, 30)' && look.placeholder === 'rgb(120, 121, 122)', JSON.stringify(look));
check('the status is hidden until it has something to say, read out politely', (await status(p)).hidden === true && (await status(p)).role === 'status');
check('a trap field for bots, out of reach of the keyboard', await p.evaluate(() => { const t = document.querySelector('.living-trap'); return !!t && t.tabIndex === -1 && t.getAttribute('aria-hidden') === 'true'; }));

await p.click('[data-living-part="submit"]');
await p.waitForTimeout(80);
check('empty: nothing is sent, the first missing answer says so and takes the focus', posts.length === 0 && (await status(p)).text === 'Please fill in name.' && (await p.evaluate(() => document.activeElement.name)) === 'name' && (await state(p)) === 'error');
check('every wrong field is marked invalid', (await p.evaluate(() => [...document.querySelectorAll('.living-control')].filter((c) => c.getAttribute('aria-invalid') === 'true').map((c) => c.name).join(','))) === 'name,email,message');
await p.fill('[name=name]', 'Ada');
await p.fill('[name=email]', 'ada@nope');
await p.fill('[name=message]', 'Hello there');
await p.click('[data-living-part="submit"]');
await p.waitForTimeout(80);
check('a wrong email address is refused, with an example', posts.length === 0 && /name@example\.com/.test((await status(p)).text) && (await p.evaluate(() => document.activeElement.name)) === 'email');
await p.fill('[name=email]', 'ada@example.com');
await p.selectOption('[name=topic]', 'Build');
await p.check('[name=news]');
await p.press('[name=email]', 'Enter');
await p.waitForTimeout(250);
const sent = posts[0] || {};
check('Enter in a field sends it', posts.length === 1);
check('posted: the form’s id, the recipient id, every answer under its name, the labels', sent.form === 'node42' && sent.to === 'account' && sent.fields?.name === 'Ada' && sent.fields?.email === 'ada@example.com' && sent.fields?.topic === 'Build' && sent.fields?.news === 'yes' && sent.labels?.message === 'Message', JSON.stringify(sent));
check('the form asked the host for its token as it started', tokens.length >= 1);
check('with the empty trap, the host’s token and when the page opened', sent.website === '' && sent.t === 'tok.sig' && typeof sent.at === 'number' && Date.now() - sent.at < 60000);
check('after sending: the status shows its own words, the fields are cleared', (await status(p)).text === 'Thanks, your message is on its way.' && !(await status(p)).hidden && (await state(p)) === 'sent' && (await p.inputValue('[name=message]')) === '');

answer = { status: 500, body: {} };
await p.fill('[name=name]', 'Ada');
await p.fill('[name=email]', 'ada@example.com');
await p.fill('[name=message]', 'Second try');
await p.click('[data-living-part="submit"]');
await p.waitForTimeout(250);
check('after a failure the token is asked for again', tokens.length >= 2);
check('a failure says so and keeps what was typed', /could not be sent/.test((await status(p)).text) && (await p.inputValue('[name=message]')) === 'Second try' && (await state(p)) === 'error');
answer = { status: 429, body: { closed: true } };
await p.click('[data-living-part="submit"]');
await p.waitForTimeout(250);
check('a paused form says it is not taking messages', /not taking messages/.test((await status(p)).text) && (await state(p)) === 'closed');

await p.evaluate(() => window.stop());
check('stopping puts the drawing back: no controls, no trap, the status as drawn', await p.evaluate(() => !document.querySelector('.living-control') && !document.querySelector('.living-trap') && getComputedStyle(document.querySelector('[data-living-part="input"] span')).display !== 'none' && document.querySelector('[data-living-part="status"]').textContent === 'Thanks, your message is on its way.'));
await p.close();

const before = posts.length;
const askedBefore = tokens.length;
const prev = await open({ after: 'message', to: 'account' }, '{ remember: false, formPreview: true }');
await prev.click('[data-living-part="submit"]');
await prev.waitForTimeout(80);
check('Preview checks the answers as the published form does', (await status(prev)).text === 'Please fill in name.');
await prev.fill('[name=name]', 'A'); await prev.fill('[name=email]', 'a@b.co'); await prev.fill('[name=message]', 'x');
await prev.click('[data-living-part="submit"]');
await prev.waitForTimeout(150);
check('Preview acts out a send: its own words, the fields cleared, nothing posted, no token asked for', posts.length === before && tokens.length === askedBefore && (await status(prev)).text === 'Thanks, your message is on its way.' && (await state(prev)) === 'sent' && (await prev.inputValue('[name=message]')) === '');
await prev.close();
const failing = await open({ after: 'message', to: 'account', preview: 'failed', failText: 'Something went wrong, try again soon.' }, '{ remember: false, formPreview: true }');
await failing.fill('[name=name]', 'A'); await failing.fill('[name=email]', 'a@b.co'); await failing.fill('[name=message]', 'kept');
await failing.click('[data-living-part="submit"]');
await failing.waitForTimeout(150);
check('Preview can act out a failure, with its own words, keeping what was typed', (await status(failing)).text === 'Something went wrong, try again soon.' && (await state(failing)) === 'error' && (await failing.inputValue('[name=message]')) === 'kept' && posts.length === before);
await failing.close();
const toasting = await open({ after: 'message', to: 'account', show: 'toast', sentText: 'Got it, I will write back soon.' }, '{ remember: false, formPreview: true }');
await toasting.fill('[name=name]', 'A'); await toasting.fill('[name=email]', 'a@b.co'); await toasting.fill('[name=message]', 'x');
await toasting.click('[data-living-part="submit"]');
await toasting.waitForTimeout(400);
const t = await toasting.evaluate(() => { const e = document.querySelector('.living-toast'); return e && { text: e.textContent, on: e.classList.contains('is-on'), role: e.getAttribute('role'), live: e.getAttribute('aria-live'), opacity: getComputedStyle(e).opacity, bg: getComputedStyle(e).backgroundColor }; });
check('toast: the sent words in a toast at the foot of the page, read out politely, the helper left hidden', t?.text === 'Got it, I will write back soon.' && t.on && t.role === 'status' && t.live === 'polite' && Number(t.opacity) > 0.9 && (await status(toasting)).hidden === true, JSON.stringify(t));
await toasting.click('[data-living-part="submit"]');
await toasting.waitForTimeout(150);
check('toast: a wrong answer is said there too, urgently, its field focused', (await toasting.evaluate(() => document.querySelector('.living-toast').getAttribute('aria-live'))) === 'assertive' && (await toasting.evaluate(() => document.activeElement.name)) === 'name');
await toasting.evaluate(() => window.stop());
check('stopping takes the toast away', (await toasting.evaluate(() => document.querySelectorAll('.living-toast').length)) === 0);
await toasting.close();
const off = await open({ after: 'message', to: 'account' }, '{ remember: false, formOff: true }');
await off.fill('[name=name]', 'A'); await off.fill('[name=email]', 'a@b.co'); await off.fill('[name=message]', 'x');
await off.click('[data-living-part="submit"]');
await off.waitForTimeout(150);
check('an export: never sent, says it sends from a published site', posts.length === before && /published with uxdeck/.test((await status(off)).text));
await off.close();

answer = { status: 200, body: { ok: true } };
const red = await open({ after: 'redirect', redirect: '/thanks', to: 'account' });
await red.fill('[name=name]', 'A'); await red.fill('[name=email]', 'a@b.co'); await red.fill('[name=message]', 'x');
await red.click('[data-living-part="submit"]');
await red.waitForURL('**/thanks', { timeout: 3000 }).catch(() => {});
check('after: redirect goes to its address', red.url().endsWith('/thanks'));
await red.close();

// Turnstile (0.6.0): a host that hands a site key with its token gets Turnstile's pass with the message
{
  const tp = await browser.newPage();
  tp.on('pageerror', (e) => errors.push(e.message));
  const sent = [];
  await tp.route('https://challenges.cloudflare.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: `window.turnstile = { render(box, o) { this.o = o; box.setAttribute('data-sitekey', o.sitekey); return 'w1'; }, reset() {}, execute() { setTimeout(() => this.o.callback('pass-123'), 10); }, remove() { window.__removed = true; } }; window.livingTurnstileReady();` }));
  await tp.route('https://site.test/**', async (route) => {
    const req = route.request();
    if (req.method() === 'GET' && req.url().endsWith('/__uxdeck/form')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ t: 'tok.sig', ts: '1x00000000000000000000AA' }) });
    if (req.method() === 'POST' && req.url().endsWith('/__uxdeck/form')) { sent.push(JSON.parse(req.postData() || '{}')); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }); }
    return route.fulfill({ status: 200, contentType: 'text/html', body: page({ after: 'message', to: 'account' }) });
  });
  await tp.goto('https://site.test/');
  await tp.waitForTimeout(300);
  check('Turnstile: loaded with the host\'s site key, in a box of the form\'s own', (await tp.evaluate(() => document.querySelector('.living-turnstile')?.getAttribute('data-sitekey'))) === '1x00000000000000000000AA');
  await tp.fill('[name=name]', 'A'); await tp.fill('[name=email]', 'a@b.co'); await tp.fill('[name=message]', 'x');
  await tp.click('[data-living-part="submit"]');
  await tp.waitForTimeout(300);
  check('Turnstile: its pass goes with the message', sent[0]?.cf === 'pass-123', JSON.stringify(sent[0]?.cf));
  await tp.evaluate(() => window.stop());
  check('Turnstile: stopping removes its widget and box', (await tp.evaluate(() => window.__removed === true && !document.querySelector('.living-turnstile'))));
  await tp.close();
}

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
