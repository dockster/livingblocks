// Every Block in blocks/ is accepted by the checker and follows the rules a
// contributor's Block must follow; the checker refuses what it should, each
// time saying why; the runtime loads as a plain script. Run after a build:
// npm run build && npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { BLOCKS, CATEGORIES, KINDS, NEEDS, validateBlock, blockById } from '../../dist/livingblocks.mjs';

const files = readdirSync('blocks').filter((f) => f.endsWith('.json'));
const carousel = JSON.parse(readFileSync('blocks/carousel.json', 'utf8'));
const copy = (o) => structuredClone(o);

test('every file in blocks/ is in the package, under its own id', () => {
  assert.equal(BLOCKS.length, files.length);
  for (const f of files) assert.ok(blockById(f.replace('.json', '')), f);
});

test('every Block passes the checker', () => {
  for (const b of BLOCKS) assert.deepEqual(validateBlock(b), { ok: true, errors: [] }, b.id);
});

test('every Block is in a known category and has the parts its behaviour needs', () => {
  const cats = new Set(CATEGORIES.map((c) => c.id));
  for (const b of BLOCKS) {
    assert.ok(cats.has(b.category), `${b.id}: ${b.category}`);
    assert.ok(KINDS.includes(b.kind));
    const parts = new Set();
    const walk = (l) => (l.part && parts.add(l.part), (l.children ?? []).forEach(walk));
    walk(b.root);
    for (const p of NEEDS[b.kind]) assert.ok(parts.has(p), `${b.id} needs ${p}`);
  }
});

test('auto layout throughout: a container without a layout is refused', () => {
  const b = copy(carousel);
  delete b.root.children[0].layout;
  const v = validateBlock(b);
  assert.equal(v.ok, false);
  assert.match(v.errors.join('\n'), /needs a layout \(auto layout throughout\)/);
});

test('spacing off the 4 pt scale is refused', () => {
  const b = copy(carousel);
  b.root.layout.gap = 18;
  assert.match(validateBlock(b).errors.join('\n'), /4 pt scale \(multiples of 4\), not 18/);
});

test('the Blocks come grouped by behaviour, each behaviour own Block first', () => {
  const kinds = BLOCKS.map((b) => b.kind);
  // each behaviour's Blocks together, in the behaviours' order
  assert.deepEqual([...new Set(kinds)], KINDS.filter((k) => kinds.includes(k)));
  for (const k of new Set(kinds)) assert.equal(BLOCKS.find((b) => b.kind === k).id, k, `${k} first`);
  // then by name
  for (const k of new Set(kinds)) {
    const rest = BLOCKS.filter((b) => b.kind === k).slice(1).map((b) => b.id);
    assert.deepEqual(rest, [...rest].sort());
  }
});

test('a size off the Blocks\' type scale is refused', () => {
  const b = copy(carousel);
  const walk = (l) => (l.typography ? l : (l.children ?? []).map(walk).find(Boolean));
  walk(b.root).typography.size = 22;
  assert.match(validateBlock(b).errors.join('\n'), /Blocks' scale \(15, 17, 28\), not 22/);
});

test('a layer floating over a parent with no layout is refused', () => {
  const b = copy(carousel);
  b.root.children[1].children[0].float = { left: 0 };
  delete b.root.children[1].layout;
  b.root.children[1].children = [{ type: 'ellipse', name: 'Dot', w: 8, h: 8, float: { left: 0 } }];
  assert.match(validateBlock(b).errors.join('\n'), /floats, but its parent has no layout/);
});

test('a part the behaviour needs, missing, is refused', () => {
  const b = copy(carousel);
  const strip = (l) => (delete l.part, (l.children ?? []).forEach(strip));
  strip(b.root);
  const errs = validateBlock(b).errors.join('\n');
  for (const p of ['track', 'prev', 'next', 'dots', 'pause']) assert.match(errs, new RegExp(`marked ${p}`));
});

test('a setting the behaviour does not read, or out of range, is refused', () => {
  const b = copy(carousel);
  b.settings.perView = 9;
  b.settings.script = 'alert(1)';
  const errs = validateBlock(b).errors.join('\n');
  assert.match(errs, /settings\.perView: a number from 1 to 4/);
  assert.match(errs, /settings\.script: carousel does not read it/);
});

test('an unknown behaviour, format or id shape is refused', () => {
  const b = copy(carousel);
  b.kind = 'marquee';
  b.format = 2;
  b.id = 'Bad Id';
  const errs = validateBlock(b).errors.join('\n');
  assert.match(errs, /kind: one of/);
  assert.match(errs, /format: must be 1/);
  assert.match(errs, /^id:/m);
  assert.deepEqual(validateBlock('nope'), { ok: false, errors: ['not an object'] });
});

test('the schema reads, and names the same behaviours', () => {
  const schema = JSON.parse(readFileSync('schema/block.schema.json', 'utf8'));
  assert.deepEqual(schema.properties.kind.enum, [...KINDS]);
});

test('the runtime loads as a plain script and offers LivingBlocks.start', () => {
  const window = {};
  runInNewContext(readFileSync('dist/livingblocks.min.js', 'utf8'), { window });
  assert.equal(typeof window.LivingBlocks.start, 'function');
  assert.match(window.LivingBlocks.version, /^\d+\.\d+\.\d+$/);
});

test('the ring: its settings within their ranges, a track it cannot do without', () => {
  const ring = JSON.parse(readFileSync('blocks/ring.json', 'utf8'));
  assert.deepEqual(validateBlock(ring), { ok: true, errors: [] });
  assert.deepEqual(NEEDS.ring, ['track']);
  const far = copy(ring);
  far.settings.radius = 5000;
  assert.equal(validateBlock(far).ok, false);
  const odd = copy(ring);
  odd.settings.drag = 'yes';
  assert.equal(validateBlock(odd).ok, false);
  const bare = copy(ring);
  delete bare.root.children[0].part;
  assert.equal(validateBlock(bare).ok, false);
});

test('the text cylinder: its settings within their ranges, a track it cannot do without', () => {
  const cyl = JSON.parse(readFileSync('blocks/cylinder.json', 'utf8'));
  assert.deepEqual(validateBlock(cyl), { ok: true, errors: [] });
  assert.deepEqual(NEEDS.cylinder, ['track']);
  const wide = copy(cyl);
  wide.settings.span = 2;
  assert.equal(validateBlock(wide).ok, false);
  const long = copy(cyl);
  long.settings.hold = 20;
  assert.equal(validateBlock(long).ok, false);
  const bare = copy(cyl);
  delete bare.root.children[0].part;
  assert.equal(validateBlock(bare).ok, false);
});

test('the showcase and the mosaic: their settings within range, the parts they need', () => {
  const show = JSON.parse(readFileSync('blocks/showcase.json', 'utf8'));
  const grid = JSON.parse(readFileSync('blocks/mosaic.json', 'utf8'));
  assert.deepEqual(validateBlock(show), { ok: true, errors: [] });
  assert.deepEqual(validateBlock(grid), { ok: true, errors: [] });
  assert.deepEqual(NEEDS.showcase, ['track']);
  assert.deepEqual(NEEDS.mosaic, ['tile']);
  const fast = copy(show);
  fast.settings.speed = 9;
  assert.equal(validateBlock(fast).ok, false);
  const odd = copy(show);
  odd.settings.transition = 'ripple';
  assert.equal(validateBlock(odd).ok, false);
  const many = copy(grid);
  many.settings.columns = 12;
  assert.equal(validateBlock(many).ok, false);
  const video = copy(grid);
  video.settings.video = 'never';
  assert.equal(validateBlock(video).ok, false);
});
