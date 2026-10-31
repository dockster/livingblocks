// A chart's data and its drawing, shared by whoever draws it: a design tool turns the geometry into its own layers
// (a path for a line, boxes for bars), and the dashboard add-on (dashboard.js) reads the same data on the page for
// its tooltip, its keyboard and the table a screen reader reads. Pure: no DOM.
//
// The data is text, as a spreadsheet copies it: rows of a label then one value per series, separated by tabs or
// commas, the first row naming them ("Month,Revenue,Costs"). A value may carry a currency sign, thousands separators
// or a percent sign; an empty one is a gap.

export interface Series {
  name: string;
  values: Array<number | null>;
}

export interface ChartData {
  /** what the labels are (the first row's first name) */
  labelName: string;
  labels: string[];
  series: Series[];
}

/** At most this many points and series: a chart past them is unreadable, and a page carries its data. */
export const MAX_POINTS = 60;
export const MAX_SERIES = 6;

/** One row's cells: tab-separated when it has a tab (a spreadsheet's copy), else commas, with "quoted, cells". */
function cellsOf(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** A number as people write it: "$1,200.50", "-$1.80", "12%", "(40)", "1 200"; null when it is not one. */
export function readNumber(text: string): number | null {
  let t = String(text ?? '').trim();
  if (!t) return null;
  let negative = false;
  if (/^\(.*\)$/.test(t)) {
    negative = true;
    t = t.slice(1, -1);
  }
  if (/^[-−]/.test(t)) {
    negative = true;
    t = t.slice(1);
  }
  t = t.replace(/[\s ,]/g, '').replace(/[^\d.eE+-]/g, '');
  if (!t || !/^\d*\.?\d+([eE][+-]?\d+)?$|^\d+\.$/.test(t)) return null;
  const v = Number(t);
  return Number.isFinite(v) ? (negative ? -v : v) : null;
}

/** The data from its text; rows past MAX_POINTS and series past MAX_SERIES are left out. */
export function parseData(text: string): ChartData {
  const lines = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);
  if (!lines.length) return { labelName: '', labels: [], series: [] };
  const head = cellsOf(lines[0]);
  // a first row whose values are not numbers names the columns; otherwise the series are numbered
  const named = head.slice(1).some((c) => c && readNumber(c) === null) || head.length === 1;
  const names = named ? head.slice(1) : head.slice(1).map((_, i) => `Series ${i + 1}`);
  const rows = (named ? lines.slice(1) : lines).slice(0, MAX_POINTS).map(cellsOf);
  const count = Math.min(MAX_SERIES, Math.max(names.length, ...rows.map((r) => r.length - 1), 0));
  const series: Series[] = [];
  for (let s = 0; s < count; s++) series.push({ name: (names[s] || `Series ${s + 1}`).slice(0, 40), values: rows.map((r) => readNumber(r[s + 1] ?? '')) });
  return { labelName: named ? (head[0] || '').slice(0, 40) : '', labels: rows.map((r) => (r[0] ?? '').slice(0, 40)), series };
}

/** The data as text again (commas, quoted where a cell holds one), for a design tool's editor. */
export function dataText(d: ChartData): string {
  const cell = (c: string) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
  const rows = [[d.labelName || 'Label', ...d.series.map((s) => s.name)]];
  d.labels.forEach((l, i) => rows.push([l, ...d.series.map((s) => (s.values[i] === null ? '' : String(s.values[i])))]));
  return rows.map((r) => r.map(cell).join(',')).join('\n');
}

export interface Format {
  format?: 'number' | 'compact' | 'percent';
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

/** A value as the chart says it: "-$1.80", "1.2k", "12%". */
export function formatValue(v: number | null, f: Format): string {
  if (v === null || !Number.isFinite(v)) return '';
  const d = Math.max(0, Math.min(4, Math.round(f.decimals ?? 0)));
  const abs = Math.abs(v);
  let body: string;
  if (f.format === 'compact') {
    const units: Array<[number, string]> = [[1e9, 'B'], [1e6, 'M'], [1e3, 'k']];
    const u = units.find(([n]) => abs >= n);
    body = u ? `${(abs / u[0]).toFixed(abs / u[0] >= 100 ? 0 : 1).replace(/\.0$/, '')}${u[1]}` : abs.toFixed(d);
  } else body = abs.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const percent = f.format === 'percent' ? '%' : '';
  return `${v < 0 ? '-' : ''}${f.prefix ?? ''}${body}${percent}${f.suffix ?? ''}`;
}

/** What a chart's headline value says of a series: its sum, last value, average or largest. */
export function summarise(values: Array<number | null>, how: 'sum' | 'last' | 'average' | 'max' | 'none'): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (!nums.length || how === 'none') return null;
  if (how === 'sum') return nums.reduce((a, b) => a + b, 0);
  if (how === 'last') return nums[nums.length - 1];
  if (how === 'max') return Math.max(...nums);
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** A round number at or past v (1, 2, 2.5, 5 times a power of ten), for the top of the scale. */
export function niceUp(v: number): number {
  if (v <= 0) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v - 1e-9) return m * p;
  return 10 * p;
}

export interface Point {
  x: number;
  y: number;
  /** a smooth line's handles, absolute */
  ix?: number;
  iy?: number;
  ox?: number;
  oy?: number;
}

export interface Bar {
  series: number;
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Geometry {
  min: number;
  max: number;
  /** x of each point (line, area) or the middle of each band (bars) */
  xs: number[];
  /** the y of a value */
  y: (v: number) => number;
  /** each series' line, a gap splitting it */
  lines: Point[][][];
  /** each series' area under its line, closed down to the baseline */
  areas: Point[][][];
  bars: Bar[];
  /** the points whose labels show, and where the dashed grid lines stand */
  ticks: number[];
}

export interface Shape {
  type?: 'line' | 'area' | 'bar';
  stacked?: boolean;
  smooth?: boolean;
  zero?: boolean;
  ticks?: number;
}

/** Monotone handles (Fritsch-Carlson): a smooth line that never overshoots its points. */
function smoothed(pts: Point[]): Point[] {
  const n = pts.length;
  if (n < 3) return pts.map((p) => ({ ...p }));
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    m.push(dx[i] === 0 ? 0 : (pts[i + 1].y - pts[i].y) / dx[i]);
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  return pts.map((p, i) => {
    const out: Point = { x: p.x, y: p.y };
    if (i > 0) {
      const d = dx[i - 1] / 3;
      out.ix = p.x - d;
      out.iy = p.y - t[i] * d;
    }
    if (i < n - 1) {
      const d = dx[i] / 3;
      out.ox = p.x + d;
      out.oy = p.y + t[i] * d;
    }
    return out;
  });
}

/** Where everything stands in a plot w by h px. */
export function geometry(d: ChartData, shape: Shape, w: number, h: number): Geometry {
  const n = d.labels.length;
  const type = shape.type ?? 'line';
  const stacked = type === 'bar' && !!shape.stacked;
  // the range: stacked bars reach the sum of a point's values
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i++) {
    if (stacked) {
      let pos = 0;
      let neg = 0;
      for (const s of d.series) {
        const v = s.values[i] ?? 0;
        if (v >= 0) pos += v;
        else neg += v;
      }
      hi = Math.max(hi, pos);
      lo = Math.min(lo, neg);
    } else
      for (const s of d.series) {
        const v = s.values[i];
        if (v === null) continue;
        hi = Math.max(hi, v);
        lo = Math.min(lo, v);
      }
  }
  if (!Number.isFinite(hi)) {
    hi = 1;
    lo = 0;
  }
  const fromZero = shape.zero !== false || type === 'bar';
  let min = fromZero ? Math.min(0, lo) : lo;
  let max = hi;
  if (min < 0) min = -niceUp(-min);
  max = max > 0 ? niceUp(max) : 0;
  if (!fromZero && lo > 0) min = Math.max(0, lo - (max - lo) * 0.1);
  if (max === min) max = min + 1;
  const y = (v: number) => h - ((v - min) / (max - min)) * h;
  const base = y(Math.max(min, Math.min(0, max)));

  const xs: number[] = [];
  const band = n ? w / n : w;
  for (let i = 0; i < n; i++) xs.push(type === 'bar' ? band * (i + 0.5) : n === 1 ? w / 2 : (i / (n - 1)) * w);

  const lines: Point[][][] = [];
  const areas: Point[][][] = [];
  const bars: Bar[] = [];
  if (type === 'bar') {
    const groups = stacked ? 1 : Math.max(1, d.series.length);
    const inner = band * 0.64;
    const each = inner / groups;
    for (let i = 0; i < n; i++) {
      let pos = 0;
      let neg = 0;
      d.series.forEach((s, si) => {
        const v = s.values[i];
        if (v === null) return;
        const left = xs[i] - inner / 2 + (stacked ? 0 : si * each);
        const from = stacked ? (v >= 0 ? pos : neg) : 0;
        const to = from + v;
        if (stacked) {
          if (v >= 0) pos = to;
          else neg = to;
        }
        const top = Math.min(y(from), y(to));
        bars.push({ series: si, index: i, x: left + (stacked ? 0 : each * 0.06), y: top, w: stacked ? inner : each * 0.88, h: Math.max(0, Math.abs(y(to) - y(from))) });
      });
    }
  } else
    for (const s of d.series) {
      const runs: Point[][] = [];
      let cur: Point[] = [];
      s.values.forEach((v, i) => {
        if (v === null) {
          if (cur.length) runs.push(cur);
          cur = [];
        } else cur.push({ x: xs[i], y: y(v) });
      });
      if (cur.length) runs.push(cur);
      const drawn = runs.map((r) => (shape.smooth ? smoothed(r) : r));
      lines.push(drawn);
      areas.push(drawn.map((r) => [...r, { x: r[r.length - 1].x, y: base }, { x: r[0].x, y: base }]));
    }

  const most = Math.max(2, Math.min(16, Math.round(shape.ticks ?? 8)));
  const step = Math.max(1, Math.ceil(n / most));
  const ticks: number[] = [];
  for (let i = 0; i < n; i += step) ticks.push(i);
  return { min, max, xs, y, lines, areas, bars, ticks };
}
