// livingblocks: working web components as data (types.ts), checked by validate.ts,
// made to work on a page by the runtime (livingblocks/global, window.LivingBlocks).
// Every Block in blocks/ is here, checked at build time.

import { BLOCKS } from './registry.generated.js';
import type { Block } from './types.js';

export * from './types.js';
export { validateBlock, KINDS, PARTS, NEEDS, SETTINGS, TYPE_SCALE, FIELD_TYPES, FIELD_NAME, FORBIDDEN, asksForSecret, COLUMN_KINDS, TONES, DATA_MAX, type Verdict } from './validate.js';
export { CATEGORIES, type Category } from './categories.js';
export { cellValue, compareCells, sortOrder, type SortValue } from './tableSort.js';
export { parseData, dataText, readNumber, formatValue, summarise, geometry, niceUp, MAX_POINTS, MAX_SERIES, type ChartData, type Series, type Geometry, type Point, type Bar, type Shape, type Format } from './chartData.js';
export { BLOCKS };

/** A Block by its id. */
export const blockById = (id: string): Block | undefined => BLOCKS.find((b) => b.id === id);

/** What the runtime puts on the page (livingblocks/global). */
export interface LivingBlocksRuntime {
  /**
   * start every Block under root, and those added later; returns a function that stops them all.
   * `remember: false` shows a notice every time, even once dismissed (a design tool's preview).
   * `formEndpoint`: where a form posts (else /__uxdeck/form on the page's own address); `formPreview`: a form is
   * checked, never sent; `formOff`: a page with nowhere to send to (an export) says so.
   */
  start: (root: Element, options?: { remember?: boolean; formEndpoint?: string; formPreview?: boolean; formOff?: boolean; toastIn?: HTMLElement }) => () => void;
  version: string;
}

declare global {
  interface Window {
    LivingBlocks?: LivingBlocksRuntime;
  }
}
