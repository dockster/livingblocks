// The table and the chart (0.7.0): a chart's data read as people paste it, its numbers said as the chart says them,
// its drawing laid out; the checker's rules for a table's columns and a row that wraps; the add-on loads after the
// runtime and registers both. Run after a build: npm run build && npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { blockById, dataText, formatValue, geometry, parseData, readNumber, summarise, validateBlock, NEEDS } from '../../dist/livingblocks.mjs';

const copy = (o) => structuredClone(o);

test('numbers as people write them', () => {
  assert.equal(readNumber('$1,200.50'), 1200.5);
  assert.equal(readNumber('-$1.80'), -1.8);
  assert.equal(readNumber('12%'), 12);
  assert.equal(readNumber('(40)'), -40);
  assert.equal(readNumber('1 200'), 1200);
  assert.equal(readNumber('−3'), -3);
  assert.equal(readNumber(''), null);
  assert.equal(readNumber('abc'), null);
  assert.equal(readNumber('12 apples'), null);
});

test('data pasted from a spreadsheet (tabs) or as CSV (quotes), the first row naming it', () => {
  const tabs = parseData('Month\tRevenue\tCosts\nJan\t$1,000\t400\nFeb\t1200\t\n');
  assert.equal(tabs.labelName, 'Month');
  assert.deepEqual(tabs.labels, ['Jan', 'Feb']);
  assert.deepEqual(tabs.series.map((s) => s.name), ['Revenue', 'Costs']);
  assert.deepEqual(tabs.series[0].values, [1000, 1200]);
  assert.deepEqual(tabs.series[1].values, [400, null], 'an empty cell is a gap');
  const csv = parseData('"Day, local",Visits\n"Oct 1, 2026",12\n');
  assert.deepEqual(csv.labels, ['Oct 1, 2026']);
  assert.equal(csv.labelName, 'Day, local');
  const bare = parseData('Q1,10\nQ2,20');
  assert.deepEqual(bare.series.map((s) => s.name), ['Series 1'], 'no names: numbered');
  assert.deepEqual(bare.labels, ['Q1', 'Q2']);
  assert.deepEqual(parseData('').series, []);
});

test('at most 60 points and 6 series; the data written back reads the same', () => {
  const many = 'L,' + Array.from({ length: 9 }, (_, i) => `S${i}`).join(',') + '\n' + Array.from({ length: 80 }, (_, i) => `p${i},` + Array(9).fill(i).join(',')).join('\n');
  const d = parseData(many);
  assert.equal(d.labels.length, 60);
  assert.equal(d.series.length, 6);
  const again = parseData(dataText(parseData('Month,"Revenue, net"\nJan,5\nFeb,')));
  assert.equal(again.series[0].name, 'Revenue, net');
  assert.deepEqual(again.series[0].values, [5, null]);
});

test('values said as the chart says them', () => {
  assert.equal(formatValue(-1.8, { prefix: '$', decimals: 2 }), '-$1.80');
  assert.equal(formatValue(1234567, { format: 'compact', prefix: '$' }), '$1.2M');
  assert.equal(formatValue(950, { format: 'compact' }), '950');
  assert.equal(formatValue(12, { format: 'percent' }), '12%');
  assert.equal(formatValue(1200, {}), '1,200');
  assert.equal(formatValue(null, {}), '');
  assert.equal(summarise([1, null, 3], 'sum'), 4);
  assert.equal(summarise([1, null, 3], 'last'), 3);
  assert.equal(summarise([1, 3], 'average'), 2);
  assert.equal(summarise([1, 3], 'max'), 3);
  assert.equal(summarise([1, 3], 'none'), null);
});

test('the drawing: a round top, points edge to edge, bars in bands, labels thinned, gaps split a line', () => {
  const d = parseData('L,A,B\na,10,5\nb,47,\nc,30,20\nd,12,8');
  const line = geometry(d, { type: 'line', ticks: 8 }, 300, 100);
  assert.equal(line.max, 50, 'the top is a round number at or past 47');
  assert.equal(line.min, 0);
  assert.deepEqual([line.xs[0], line.xs[3]], [0, 300], 'a line spans the plot');
  assert.equal(line.y(50), 0);
  assert.equal(line.y(0), 100);
  assert.equal(line.lines[1].length, 2, "B's gap splits its line in two");
  assert.equal(line.areas[0][0].length, 6, 'an area closes down to the baseline');
  const bars = geometry(d, { type: 'bar' }, 400, 100);
  assert.deepEqual(bars.xs, [50, 150, 250, 350], 'bars stand in the middle of their bands');
  assert.equal(bars.bars.length, 7, 'one bar per value, none for a gap');
  const stacked = geometry(d, { type: 'bar', stacked: true }, 400, 100);
  assert.equal(stacked.max, 50, 'stacked: the top fits the sum (30 + 20)');
  const thin = geometry(parseData('L,A\n' + Array.from({ length: 30 }, (_, i) => `d${i},${i}`).join('\n')), { type: 'line', ticks: 8 }, 300, 100);
  assert.ok(thin.ticks.length <= 8 && thin.ticks[0] === 0, String(thin.ticks));
  const smooth = geometry(d, { type: 'line', smooth: true }, 300, 100);
  assert.ok(smooth.lines[0][0][1].ix !== undefined, 'a smooth line has handles');
  const off = geometry(parseData('L,A\na,100\nb,120'), { type: 'line', zero: false }, 300, 100);
  assert.ok(off.min > 0, 'not from zero: the scale starts near the data');
});

test('the table and the chart Blocks: their parts, and a column only on a header cell, of a kind a table knows', () => {
  assert.deepEqual(NEEDS.table, ['head', 'column', 'body', 'row', 'cell']);
  assert.deepEqual(NEEDS.chart, ['plot']);
  const table = blockById('table');
  assert.deepEqual(validateBlock(table), { ok: true, errors: [] });
  const bad = copy(table);
  const head = bad.root.children[1].children[0];
  head.children[0].column = { kind: 'password' };
  head.children[1].column = { kind: 'text', min: 9 };
  delete head.children[2].column;
  const errors = validateBlock(bad).errors.join('\n');
  assert.match(errors, /column: kind one of/);
  assert.match(errors, /column: min from 40 to 600/);
  assert.match(errors, /a column says what it holds/);
  const tones = copy(table);
  tones.settings.tones = 'Paid:green';
  assert.match(validateBlock(tones).errors.join('\n'), /settings.tones/);
  const chart = blockById('chart');
  assert.deepEqual(validateBlock(chart), { ok: true, errors: [] });
  const long = copy(chart);
  long.settings.data = 'x'.repeat(8001);
  assert.match(validateBlock(long).errors.join('\n'), /settings.data/);
});

test('a row may wrap; a column may not', () => {
  const t = copy(blockById('table'));
  const footer = t.root.children.find((c) => c.name === 'Footer');
  assert.equal(footer.layout.wrap, true);
  footer.layout.direction = 'column';
  assert.match(validateBlock(t).errors.join('\n'), /wrap true or false, on a row/);
});

test('the add-on loads after the runtime and registers the table and the chart', () => {
  const kinds = [];
  const window = { LivingBlocks: { register: (k) => kinds.push(k), kit: { ease: 'ease' } } };
  runInNewContext(readFileSync('dist/livingblocks.dashboard.min.js', 'utf8'), { window });
  assert.deepEqual(kinds, ['table', 'chart']);
  // alone (no runtime yet), it does nothing and throws nothing
  runInNewContext(readFileSync('dist/livingblocks.dashboard.min.js', 'utf8'), { window: {} });
  // the runtime offers register and its helpers
  const w = {};
  runInNewContext(readFileSync('dist/livingblocks.min.js', 'utf8'), { window: w });
  assert.equal(typeof w.LivingBlocks.register, 'function');
  assert.equal(typeof w.LivingBlocks.kit.partOf, 'function');
});
