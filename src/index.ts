// livingblocks: working web components as data (types.ts), checked by validate.ts,
// made to work on a page by the runtime (livingblocks/global, window.LivingBlocks).
// Every Block in blocks/ is here, checked at build time.

import { BLOCKS } from './registry.generated.js';
import type { Block } from './types.js';

export * from './types.js';
export { validateBlock, KINDS, PARTS, NEEDS, SETTINGS, TYPE_SCALE, type Verdict } from './validate.js';
export { CATEGORIES, type Category } from './categories.js';
export { BLOCKS };

/** A Block by its id. */
export const blockById = (id: string): Block | undefined => BLOCKS.find((b) => b.id === id);

/** What the runtime puts on the page (livingblocks/global). */
export interface LivingBlocksRuntime {
  /**
   * start every Block under root, and those added later; returns a function that stops them all.
   * `remember: false` shows a notice every time, even once dismissed (a design tool's preview).
   */
  start: (root: Element, options?: { remember?: boolean }) => () => void;
  version: string;
}

declare global {
  interface Window {
    LivingBlocks?: LivingBlocksRuntime;
  }
}
