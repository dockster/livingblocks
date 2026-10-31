// How a Table's rows sort by one column, shared by the runtime (a header pressed on the page) and design tools (the
// order a table is drawn in, so the canvas shows what a visitor first sees). A column's kind says how its words compare.

import { readNumber } from './chartData.js';

export type SortValue = number | string | null;

/** What a cell's words sort as, by its column's kind: numbers, money and percents as numbers, dates as dates. */
export function cellValue(text: string, kind: string): SortValue {
  const t = text.trim();
  if (!t) return null;
  if (kind === 'number' || kind === 'money' || kind === 'percent') return readNumber(t);
  if (kind === 'date') {
    const d = Date.parse(t.replace(/(\d{1,2}),\s*(\d{4}),\s*/, '$1 $2 '));
    return Number.isFinite(d) ? d : t.toLowerCase();
  }
  return t.toLowerCase();
}

/** Two cells' values, ascending; an empty cell after any value. */
export function compareCells(a: SortValue, b: SortValue): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/** The rows' order (their indices) sorted by one column's words; equal rows keep their order, empty cells stay last. */
export function sortOrder(texts: string[], kind: string, dir: 'asc' | 'desc'): number[] {
  const keyed = texts.map((t, i) => ({ i, v: cellValue(t, kind) }));
  keyed.sort((a, b) => {
    const c = compareCells(a.v, b.v);
    if (a.v === null || b.v === null) return c || a.i - b.i;
    return (dir === 'asc' ? c : -c) || a.i - b.i;
  });
  return keyed.map((k) => k.i);
}
